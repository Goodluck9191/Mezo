/**
 * Test database harness.
 *
 * Two targets are supported, selected by MEZO_DB_TEST_TARGET:
 *
 *   "pglite"   (default) — in-memory PostgreSQL 17 with an `auth` schema shim
 *              that mirrors Supabase (auth.users, auth.uid()). Used by
 *              `npm run test:db`.
 *   "staging"  — the mezo-staging Supabase project, reached through the
 *              session pooler. Used by `npm run test:db:staging` only; the
 *              migrations must already be applied there.
 *
 * Every identity-scoped statement runs inside an explicit transaction with
 * `SET LOCAL ROLE`, because transaction/session poolers do not reliably keep
 * session state across separate statements. SET LOCAL is transaction-scoped,
 * so role and GUC settings can never leak between statements.
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { PGlite } from "@electric-sql/pglite";

export type ClientRole = "anon" | "authenticated" | "service_role";

export interface TestDb {
  query<T extends Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: T[]; affectedRows?: number }>;
  exec(sql: string): Promise<void>;
  close(): Promise<void>;
}

const projectRoot = path.resolve(import.meta.dirname, "../..");

function pgliteAdapter(db: PGlite): TestDb {
  return {
    query: async <T extends Record<string, unknown>>(
      sql: string,
      params: unknown[] = [],
    ): Promise<{ rows: T[]; affectedRows?: number }> => {
      const result = await db.query<T>(sql, params);
      return { rows: result.rows as T[], affectedRows: result.affectedRows };
    },
    exec: async (sql) => {
      await db.exec(sql);
    },
    close: () => db.close(),
  };
}

const authShim = `
create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key,
  email text,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Mirror of Supabase's storage.buckets for PGlite tests; not present in production schema.
create schema if not exists storage;
create table if not exists storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false,
  file_size_limit bigint,
  allowed_mime_types text[]
);
create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text not null references storage.buckets(id) on delete cascade,
  name text not null
);



create or replace function auth.jwt()
returns jsonb
stable
language sql
as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb);
$$;

create or replace function auth.uid()
returns uuid
stable
language sql
as $$
  select nullif(auth.jwt() ->> 'sub', '')::uuid;
$$;

create role anon nologin noinherit;
create role authenticated nologin noinherit;
create role service_role nologin noinherit bypassrls;

grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.jwt() to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
`;

function asMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Applies the test-only auth shim and every migration, then the seed file. */
export async function createTestDatabase(): Promise<TestDb> {
  const db = new PGlite();

  try {
    await db.exec(authShim);
  } catch (error) {
    await db.close();
    throw new Error(`auth shim failed: ${asMessage(error)}`);
  }

  const migrationsDir = path.join(projectRoot, "supabase", "migrations");
  const files = (await readdir(migrationsDir)).filter((file) => file.endsWith(".sql")).sort();

  for (const file of files) {
    const sql = await readFile(path.join(migrationsDir, file), "utf8");
    try {
      await db.exec(sql);
    } catch (error) {
      await db.close();
      throw new Error(`migration ${file} failed: ${asMessage(error)}`);
    }
  }

  try {
    await db.exec(await readFile(path.join(projectRoot, "supabase", "seed.sql"), "utf8"));
  } catch (error) {
    await db.close();
    throw new Error(`seed.sql failed: ${asMessage(error)}`);
  }

  return pgliteAdapter(db);
}

function parseRef(raw: string): string {
  const trimmed = raw.trim();
  if (/^https?:\/\//i.test(trimmed)) {
    const host = new URL(trimmed).host;
    return host.split(".")[0] ?? "";
  }
  return trimmed;
}

/**
 * Connects to the mezo-staging Supabase project through the session pooler.
 * The direct `db.<ref>.supabase.co` endpoint is not resolvable from this
 * network (IPv6-first), so the pooler is used instead.
 */
export async function createStagingDb(): Promise<TestDb> {
  const ref = parseRef(process.env.MEZO_STAGING_PROJECT_REF ?? "");
  if (ref !== "sskooncjmymzoxlhkulh") {
    throw new Error(
      "Refusing to run staging tests: MEZO_STAGING_PROJECT_REF does not identify the mezo-staging project.",
    );
  }

  const password = process.env.SUPABASE_DB_PASSWORD;
  if (!password) {
    throw new Error("SUPABASE_DB_PASSWORD is required for the staging suite.");
  }

  const host = process.env.MEZO_STAGING_DB_HOST ?? "aws-1-eu-central-1.pooler.supabase.com";

  const { Client } = await import("pg");
  const client = new Client({
    connectionString: `postgresql://postgres.${ref}:${encodeURIComponent(password)}@${host}:5432/postgres`,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  return {
    query: async <T extends Record<string, unknown>>(
      sql: string,
      params: unknown[] = [],
    ): Promise<{ rows: T[]; affectedRows?: number }> => {
      const result = await client.query<T>(sql, params);
      return { rows: result.rows, affectedRows: result.rowCount ?? undefined };
    },
    exec: async (sql) => {
      await client.query(sql);
    },
    close: () => client.end(),
  };
}

export async function createTargetDatabase(): Promise<TestDb> {
  const target = process.env.MEZO_DB_TEST_TARGET ?? "pglite";
  return target === "staging" ? createStagingDb() : createTestDatabase();
}

export interface Identity {
  id: string;
  email: string;
}

export function makeIdentity(label: string): Identity {
  return {
    id: crypto.randomUUID(),
    email: `${label.toLowerCase().replace(/[^a-z0-9]/g, "")}@example.test`,
  };
}

/** Creates an auth user; the on_auth_user_created trigger makes their profile. */
export async function createUser(db: TestDb, identity: Identity, fullName?: string) {
  await db.query(
    "insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3::jsonb)",
    [identity.id, identity.email, JSON.stringify(fullName ? { full_name: fullName } : {})],
  );
}

/**
 * Runs `sql` as the given role inside one transaction. `alterRoleSql` is
 * applied after `BEGIN` but before the statement (used to set SET LOCAL ROLE
 * and the JWT claim GUC). Commits on success, rolls back on failure.
 */
async function runInTransaction(
  db: TestDb,
  role: ClientRole,
  userId: string | null,
  sql: string,
  params: unknown[],
  isAnonymous: boolean,
): Promise<{
  rows: Record<string, unknown>[];
  affectedRows?: number;
}> {
  await db.exec("begin;");
  await db.exec(`set local role ${role};`);
  const claims = userId
    ? JSON.stringify({
        sub: userId,
        aud: "authenticated",
        role: "authenticated",
        is_anonymous: isAnonymous,
      })
    : "{}";
  if (userId) {
    await db.exec(`select set_config('request.jwt.claim.sub', '${userId}', true)`);
  }
  await db.exec(`select set_config('request.jwt.claims', '${claims}', true)`);
  try {
    const result = await db.query(sql, params);
    await db.exec("commit;");
    return { rows: result.rows, affectedRows: result.affectedRows };
  } catch (error) {
    await db.exec("rollback;").catch(() => undefined);
    throw error;
  }
}

/** Read rows as a client role. Throws on failure. */
export async function queryRows<T extends Record<string, unknown>>(
  db: TestDb,
  role: ClientRole,
  userId: string | null,
  sql: string,
  params: unknown[] = [],
  isAnonymous = false,
): Promise<T[]> {
  const result = await runInTransaction(db, role, userId, sql, params, isAnonymous);
  return result.rows as T[];
}

/** Execute a statement as a client role. Throws on failure. */
export async function runAs(
  db: TestDb,
  role: ClientRole,
  userId: string | null,
  sql: string,
  params: unknown[] = [],
  isAnonymous = false,
) {
  return runInTransaction(db, role, userId, sql, params, isAnonymous);
}

/** Expects the statement to fail; returns the SQLSTATE and message. */
export async function expectSqlFailure(
  db: TestDb,
  role: ClientRole,
  userId: string | null,
  sql: string,
  params: unknown[] = [],
  isAnonymous = false,
): Promise<{ code?: string; message: string }> {
  await db.exec("begin;");
  await db.exec(`set local role ${role};`);
  const claims = userId
    ? JSON.stringify({
        sub: userId,
        aud: "authenticated",
        role: "authenticated",
        is_anonymous: isAnonymous,
      })
    : "{}";
  if (userId) {
    await db.exec(`select set_config('request.jwt.claim.sub', '${userId}', true)`);
  }
  await db.exec(`select set_config('request.jwt.claims', '${claims}', true)`);
  try {
    await db.query(sql, params);
    throw new Error("Expected the statement to fail, but it succeeded.");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === "Expected the statement to fail, but it succeeded.") {
      throw error;
    }
    const pg = error as { code?: string; message?: string };
    return { code: pg.code, message: pg.message ?? message };
  } finally {
    await db.exec("rollback;").catch(() => undefined);
  }
}
