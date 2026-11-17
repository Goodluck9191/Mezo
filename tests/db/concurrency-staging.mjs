/**
 * Concurrency probe for the Phase 7 approval race — mezo-staging ONLY.
 *
 * Two independent authorized waiter sessions (waiterA, waiterA2, both active
 * `waiter` members of Demo Cafe / restaurant A) fire approve_table_access at
 * the same pending request pair for the same table over TWO separate pooler
 * connections. Repeated N times.
 *
 * Expected invariant each iteration:
 *   - both requests end `approved`;
 *   - exactly one open table_session exists for the table;
 *   - both guest_sessions reference that same session;
 *   - one audit row per approval is written.
 *
 * The fixtures reset between iterations. Fixtures are shared with the
 * staging suite — run this alone (never alongside test:db:staging). Exits
 * non-zero if any iteration violates the invariant.
 *
 * Usage: node tests/db/concurrency-staging.mjs [iterations]   (default 10)
 */
import { readFileSync } from "node:fs";
import path from "node:path";

const projectRoot = path.resolve(import.meta.dirname, "../..");
const envPath = path.join(projectRoot, ".env.local");
const env = Object.fromEntries(
  readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => {
      const eq = line.indexOf("=");
      return [
        line.slice(0, eq).trim(),
        line
          .slice(eq + 1)
          .trim()
          .replace(/^["']|["']$/g, ""),
      ];
    }),
);
if (!env.MEZO_STAGING_PROJECT_REF || !env.SUPABASE_DB_PASSWORD) {
  console.error(".env.local is missing MEZO_STAGING_PROJECT_REF or SUPABASE_DB_PASSWORD");
  process.exit(1);
}

const ref = /^https?:\/\//i.test(env.MEZO_STAGING_PROJECT_REF.trim())
  ? new URL(env.MEZO_STAGING_PROJECT_REF.trim()).host.split(".")[0]
  : env.MEZO_STAGING_PROJECT_REF.trim();
if (ref !== "sskooncjmymzoxlhkulh") {
  console.error("Refusing to run against a non-staging project");
  process.exit(1);
}
const host = env.MEZO_STAGING_DB_HOST ?? "aws-1-eu-central-1.pooler.supabase.com";
const connectionString = `postgresql://postgres.${ref}:${encodeURIComponent(env.SUPABASE_DB_PASSWORD)}@${host}:5432/postgres`;

const iterations = Number(process.argv[2] ?? 10);
if (!Number.isInteger(iterations) || iterations < 1) {
  console.error("iterations must be a positive integer");
  process.exit(1);
}

const { Client } = await import("pg");

const superClient = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
await superClient.connect();

/** Runs statements as a client role with JWT claims inside one transaction. */
async function asRole(client, role, sub, sql, params) {
  await client.query("begin");
  await client.query(`set local role ${role}`);
  const claims = JSON.stringify({
    sub,
    aud: "authenticated",
    role: "authenticated",
    is_anonymous: false,
  });
  await client.query(`select set_config('request.jwt.claims', '${claims}', true)`);
  try {
    const result = await client.query(sql, params);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  }
}

const { rows: demoCafe } = await superClient.query(
  "select id from public.restaurants where slug = 'demo-cafe'",
);
if (demoCafe.length !== 1) {
  console.error(
    "demo-cafe fixture not found — run the staging fixture suite or apply seed fixtures first",
  );
  await superClient.end();
  process.exit(1);
}
const restaurantA = demoCafe[0].id;

const { rows: tables } = await superClient.query(
  "select id from public.restaurant_tables where restaurant_id = $1 and name = 'Table 2'",
  [restaurantA],
);
if (tables.length !== 1) {
  console.error("Demo Cafe 'Table 2' fixture not found");
  await superClient.end();
  process.exit(1);
}
const tableA2 = tables[0].id;

// Ensure two authorized waiter fixtures exist for restaurant A.
async function ensureWaiter(email) {
  const { rows } = await superClient.query("select id from auth.users where email = $1", [email]);
  if (rows.length === 1) return rows[0].id;
  const { rows: created } = await superClient.query(
    'insert into auth.users (id, email, raw_user_meta_data) values (gen_random_uuid(), $1, \'{"full_name": "Concurrency Fixture"}\'::jsonb) returning id',
    [email],
  );
  const id = created[0].id;
  await superClient.query(
    "insert into public.restaurant_members (restaurant_id, user_id, role) values ($1, $2, 'waiter') on conflict do nothing",
    [restaurantA, id],
  );
  return id;
}
const waiterA = await ensureWaiter("concurrency-waiter-1@example.test");
const waiterA2 = await ensureWaiter("concurrency-waiter-2@example.test");

// Ensure two guest fixtures exist.
async function ensureUser(email) {
  const { rows } = await superClient.query("select id from auth.users where email = $1", [email]);
  if (rows.length === 1) return rows[0].id;
  const { rows: created } = await superClient.query(
    'insert into auth.users (id, email, raw_user_meta_data) values (gen_random_uuid(), $1, \'{"full_name": "Concurrency Guest"}\'::jsonb) returning id',
    [email],
  );
  return created[0].id;
}
const guestA = await ensureUser("concurrency-guest-1@example.test");
const guestB = await ensureUser("concurrency-guest-2@example.test");

// Deterministic QR tokens for this probe (md5 matches the app's scheme).
const QR_PROBE = "ab".repeat(32);
await superClient.query(
  "update public.restaurant_tables set qr_token_hash = md5($2) where id = $1",
  [tableA2, QR_PROBE],
);

/** Resets the race surface: no open session, guests have no live requests. */
async function reset() {
  await superClient.query(
    "update public.table_sessions set status = 'closed', closed_at = now(), closed_by = null where table_id = $1 and status in ('active', 'pending')",
    [tableA2],
  );
  await superClient.query(
    "delete from public.guest_sessions where table_session_id in (select id from public.table_sessions where table_id = $1)",
    [tableA2],
  );
  await superClient.query(
    "delete from public.table_access_requests where table_id = $1 and user_id = any($2::uuid[])",
    [tableA2, [guestA, guestB]],
  );
}

/** Creates a pending request for a guest via the real RPC path. */
async function createPending(guestId) {
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    const result = await asRole(
      client,
      "authenticated",
      guestId,
      "select * from public.request_table_access($1)",
      [QR_PROBE],
    );
    return result.rows[0].id;
  } finally {
    await client.end();
  }
}

/** Approves as the given waiter over its own connection. */
async function approveAs(waiterId, requestId) {
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    const result = await asRole(
      client,
      "authenticated",
      waiterId,
      "select status, table_session_id from public.approve_table_access($1)",
      [requestId],
    );
    return result.rows[0];
  } finally {
    await client.end();
  }
}

const histogram = { single: 0, duplicate: 0, other: 0 };
let auditFail = 0;
const failures = [];

for (let iteration = 1; iteration <= iterations; iteration += 1) {
  await reset();
  const [reqA, reqB] = await Promise.all([createPending(guestA), createPending(guestB)]);

  const [resA, resB] = await Promise.allSettled([
    approveAs(waiterA, reqA),
    approveAs(waiterA2, reqB),
  ]);

  const { rows: sessionRows } = await superClient.query(
    "select count(*)::int as open from public.table_sessions where table_id = $1 and status = 'active'",
    [tableA2],
  );
  const { rows: guestRows } = await superClient.query(
    `select g.table_session_id, count(*)::int as guests
       from public.guest_sessions g
       join public.table_sessions s on s.id = g.table_session_id
      where s.table_id = $1 and g.user_id = any($2::uuid[])
      group by g.table_session_id`,
    [tableA2, [guestA, guestB]],
  );
  const { rows: requestRows } = await superClient.query(
    "select status, decided_by from public.table_access_requests where id = any($1::uuid[])",
    [[reqA, reqB]],
  );
  const { rows: auditRows } = await superClient.query(
    "select action, count(*)::int as n from public.audit_logs where entity_id = any($1::uuid[]) and action = 'table_access.approved' group by action",
    [[reqA, reqB]],
  );
  const approvedAudits = auditRows.reduce((sum, row) => sum + row.n, 0);

  const open = sessionRows[0].open;
  const guestsInWinningSession = guestRows.length === 1 ? guestRows[0].guests : -1;
  const bothApproved =
    requestRows.length === 2 && requestRows.every((r) => r.status === "approved");

  let verdict;
  if (open === 1 && guestsInWinningSession === 2 && bothApproved) {
    verdict = "PASS";
    histogram.single += 1;
  } else {
    verdict = "FAIL";
    histogram.duplicate += 1;
    failures.push({
      iteration,
      open,
      guestsInWinningSession,
      bothApproved,
      resA: resA.status,
      resB: resB.status,
    });
  }
  if (approvedAudits !== 2) {
    auditFail += 1;
  }
  const decidedByDistinct = new Set(requestRows.map((r) => r.decided_by)).size === 2;
  console.log(
    `iter ${String(iteration).padStart(2, "0")}: ${verdict}  openSessions=${open} guests=${guestsInWinningSession} approved=${bothApproved} audits=${approvedAudits} decidedByDistinct=${decidedByDistinct}`,
  );
}

await superClient.query(
  "update public.table_sessions set status = 'closed', closed_at = now() where table_id = $1 and status in ('active', 'pending')",
  [tableA2],
);

console.log(
  `\nsummary: ${histogram.single}/${iterations} invariant-holding iterations; audit anomalies: ${auditFail}`,
);
if (failures.length > 0) {
  console.error("FAILURES:", JSON.stringify(failures, null, 2));
}
await superClient.end();
process.exit(failures.length > 0 || auditFail > 0 ? 1 : 0);
