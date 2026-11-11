/**
 * Schema and RLS verification against in-memory PostgreSQL (PGlite).
 * Fast path; safe default. See `npm run test:db:staging` for the staging run.
 */
import { registerDatabaseSecuritySuite } from "./shared-suite";

registerDatabaseSecuritySuite("pglite");
