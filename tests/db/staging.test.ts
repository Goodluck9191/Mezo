/**
 * Schema and RLS verification against the hosted mezo-staging Supabase
 * project. The migrations must already be applied there (supabase db push);
 * this suite reuses them instead of booting PGlite.
 *
 * Skipped automatically unless MEZO_DB_TEST_TARGET=staging is set by
 * `npm run test:db:staging`. Never runs during plain `npm test`.
 */
import { describe } from "vitest";

const enabled = process.env.MEZO_DB_TEST_TARGET === "staging";

if (enabled) {
  const { registerDatabaseSecuritySuite } = await import("./shared-suite");
  registerDatabaseSecuritySuite("staging");
} else {
  describe.skip("staging suite (set MEZO_DB_TEST_TARGET=staging to run)", () => {});
}
