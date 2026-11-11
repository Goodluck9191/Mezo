/**
 * Launcher for the staging verification suite.
 *
 * Reads .env.local (never printed), sets MEZO_DB_TEST_TARGET=staging and the
 * required keys, then spawns vitest against tests/db/staging.test.ts. Fails
 * loudly if .env.local is missing the two keys. Never prints secret values.
 */
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const envPath = path.join(root, ".env.local");

if (!existsSync(envPath)) {
  console.error("Expected .env.local at the project root (it is git-ignored).");
  process.exit(1);
}

const text = readFileSync(envPath, "utf8");
const env = { ...process.env };
for (const line of text.split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eq = trimmed.indexOf("=");
  if (eq === -1) continue;
  const key = trimmed.slice(0, eq).trim();
  let value = trimmed
    .slice(eq + 1)
    .trim()
    .replace(/^["']|["']$/g, "");
  env[key] = value;
}

if (!env.MEZO_STAGING_PROJECT_REF) {
  console.error("MEZO_STAGING_PROJECT_REF is missing from .env.local.");
  process.exit(1);
}
if (!env.SUPABASE_DB_PASSWORD) {
  console.error("SUPABASE_DB_PASSWORD is missing from .env.local.");
  process.exit(1);
}

env.MEZO_DB_TEST_TARGET = "staging";

const vitestEntry = path.join(root, "node_modules", "vitest", "vitest.mjs");
const nodeCmd = process.execPath;
const child = spawn(nodeCmd, [vitestEntry, "run", "tests/db/staging.test.ts"], {
  env,
  stdio: "inherit",
  cwd: root,
  shell: false,
});

child.on("exit", (code) => process.exit(code ?? 1));
