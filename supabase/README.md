# Supabase

Phase 1 only establishes the directory. There are intentionally **no migrations, no seed data, and no local Supabase configuration yet**.

## Phase 2

Phase 2 will add:

- `config.toml` from `npx supabase init`
- tenant tables, enums, indexes, and constraints
- `SECURITY DEFINER` helper functions and RLS policies
- pgTAP isolation tests
- plan and demo seed data
- generated TypeScript types

Migrations must be created with the CLI, committed to git, and never edited after being applied.

## Roles

No role enum exists yet. Phase 2 must create exactly these values, matching
`src/lib/security/roles.ts`:

- `platform_admin`
- `restaurant_admin`
- `waiter`
- `kitchen`

`restaurant_admin` replaces the earlier `owner` and `manager` roles. Do not add
either back. `platform_admin` is provisioned outside restaurant flows.

## Local development requirement

`npx supabase start` requires Docker Desktop, which is not installed on this machine yet.
