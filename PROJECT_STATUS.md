# Mezo — Project Status

**Last updated:** 2026-11-11
**Phase:** 2 — Database Architecture & Security (complete and verified; awaiting approval before Phase 3)
**Brand name:** **Mezo** — tagline: **SMART DINING. SIMPLE SERVICE.**
**Verified against:** hosted Supabase project **mezo-staging** (`sskooncjmymzoxlhkulh`, PostgreSQL 17.11, `eu-central-1`) in addition to PGlite

---

## 1. Completed work

### Framework and tooling

- Next.js **16.4.6** with the App Router, Turbopack build pipeline, and `src/` directory.
- React **19.3.1** / React DOM **19.3.1**.
- TypeScript **5.9.3** with additional strictness beyond the default scaffold:
  `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`,
  `noFallthroughCasesInSwitch`, `verbatimModuleSyntax`,
  `forceConsistentCasingInFileNames`, `allowJs: false`.
- ESLint **10** flat config built on `eslint-config-next/core-web-vitals` and
  `eslint-config-next/typescript`, plus `eslint-config-prettier` to prevent rule
  conflicts and two project rules (consistent type imports, unused vars).
- Prettier **3.9.10** with `.prettierrc` and `.prettierignore`.
- Vitest **5.1.0** for unit tests (`vitest.config.mts`, node environment).
- Tailwind CSS **4.3.5** with CSS-first configuration (`@import "tailwindcss"`,
  `@theme inline`, `@custom-variant dark`) and the `@tailwindcss/turbopack` loader.
- `package.json` scripts: `dev`, `build`, `start`, `lint`, `lint:fix`, `format`,
  `format:check`, `typecheck`, `test`, `test:watch`.
- `engines.node: >=22.12.0`.

### Security headers

`next.config.ts` sends the following on every route, and `poweredByHeader` is
disabled:

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()`
- `Strict-Transport-Security: max-age=63072000; includeSubDomains`

### Typed environment configuration

- `src/lib/env/shared.ts` — Zod schemas (`supabaseEnvSchema`, `publicEnvSchema`)
  shared by browser and server, plus a secret-safe error formatter.
- `src/lib/env/client.ts` — browser-safe accessors with caching and an optional
  accessor used by the proxy so the site runs without credentials.
- `src/lib/env/server.ts` — `server-only` module including
  `SUPABASE_SERVICE_ROLE_KEY` and `NODE_ENV`.
- `.env.example` — placeholders only; no real values anywhere in the repo.

### Supabase SSR clients

- `src/lib/supabase/client.ts` — browser client via `@supabase/ssr`.
- `src/lib/supabase/server.ts` — server client bound to request cookies for
  Server Components, Server Actions, and Route Handlers.
- `src/lib/supabase/admin.ts` — privileged service-role client, server-only,
  with session persistence disabled.
- `src/lib/supabase/proxy.ts` — session refresh helper; skips cleanly when
  Supabase is unconfigured.
- `src/proxy.ts` — Next.js 16 proxy (the replacement for `middleware.ts`) with a
  static-asset matcher. Session refresh only; never an authorization boundary.

### Layout, navigation, and design system

- `src/app/layout.tsx` — root layout, Geist fonts, metadata/viewport, and a
  pre-paint theme script that avoids a flash of the wrong theme.
- `src/app/(marketing)/layout.tsx` — skip link, header, main landmark, footer.
- `src/components/shared/site-header.tsx` — responsive header with desktop nav,
  mobile disclosure menu (`aria-expanded` / `aria-controls`), Escape to close,
  and auto-close when resized to desktop.
- `src/components/shared/site-footer.tsx` — footer navigation and disclaimer.
- `src/components/shared/logo.tsx` — accessible logo link.
- `src/components/shared/theme-toggle.tsx` — light/dark toggle persisted in
  `localStorage` under `mezo-theme`.
- `src/components/ui/button.tsx` — button plus `buttonVariants()` for link
  styling.
- `src/components/ui/icons.tsx` — inline, decorative SVG icon set.
- `src/utils/cn.ts` — `clsx` + `tailwind-merge` class merge helper.
- `src/app/globals.css` — neutral design tokens, one emerald accent, dark theme
  via `.dark`, focus-visible styles, and reduced-motion handling.

### Roles

- `src/lib/security/roles.ts` — canonical `Role` type, the four role constants,
  tenant-scoped classification, display labels, permission constants, the
  explicit role â†’ permission matrix, and `hasPermission()`.
- `src/lib/validation/roles.ts` — Zod `roleSchema` and `restaurantRoleSchema` for
  validating roles at server boundaries.

| Role               | Scope      | Permissions                                                                                      |
| ------------------ | ---------- | ------------------------------------------------------------------------------------------------ |
| `platform_admin`   | Platform   | `applications.review`, `restaurants.suspend`, `plans.manage` — no restaurant-tenant permissions. |
| `restaurant_admin` | Restaurant | Settings, menu, tables, staff, subscription, orders (read/manage), reports, table sessions.      |
| `waiter`           | Restaurant | `orders.read`, `orders.manage`, `table_sessions.open`, `table_sessions.close`.                   |
| `kitchen`          | Restaurant | `orders.read`, `orders.prepare`.                                                                 |

`restaurant_admin` replaces the previous separate `owner` and `manager` roles.
The registering user becomes the restaurant's first `restaurant_admin` after a
platform administrator approves the application.

### Landing page

`src/app/(marketing)/page.tsx`: hero with product preview, platform features,
three-step flow, restaurant roles, and an early-access section. It describes the
planned product and states that Mezo is in active development — it does not
simulate working ordering. The role list is rendered from the canonical role
constants so the copy cannot drift from the definitions.

### Health check

`src/app/api/health/route.ts` — `GET` returning HTTP 200 with
`{ status, service, timestamp }`, `Cache-Control: no-store`, and no
configuration or database access. `dynamic = "force-dynamic"`.

### Folder structure for future phases

Created with `.gitkeep` where empty:

```
src/app/(auth)            src/components/customer
src/app/(customer)        src/components/staff
src/app/(staff)           src/components/restaurant
src/app/(restaurant-admin) src/components/platform
src/app/platform          src/lib/validation
src/services              src/lib/security
src/utils                 supabase/migrations
```

`src/types/database.ts` contains a documented placeholder for CLI-generated
Supabase types.

### Documentation

- `README.md` — stack, requirements, setup, env table, scripts, structure,
  architecture notes, health check, next phase.
- `AGENTS.md` — Next.js 16 conventions and project rules.
- `supabase/README.md` — database workflow, public surface, role contract and PGlite path.

### Phase 1 corrections — branding and roles

**Branding.** The product is **Mezo**, tagline **SMART DINING. SIMPLE SERVICE.**
Branding was updated in:

| Location                                                      | Change                                                             |
| ------------------------------------------------------------- | ------------------------------------------------------------------ |
| `src/lib/site.ts`                                             | `name: "Mezo"`, official tagline                                   |
| `src/app/layout.tsx`                                          | metadata title, application name, OG/Twitter inherits `siteConfig` |
| `src/app/(marketing)/page.tsx`                                | hero copy, tagline badge                                           |
| `src/components/shared/logo.tsx`                              | accessible name from `siteConfig.name`                             |
| `src/components/shared/site-footer.tsx`                       | copyright, disclaimer, tagline                                     |
| `src/app/api/health/route.ts`                                 | `service: "mezo"`                                                  |
| `src/lib/supabase/proxy.ts`                                   | log prefix `[mezo]`                                                |
| `package.json` / lockfile                                     | package name `mezo`                                                |
| `.env.example`, `README.md`, `AGENTS.md`, `PROJECT_STATUS.md` | product name and tagline                                           |

The theme storage key changed from `meza-theme` to `mezo-theme` because it is
brand-derived. Any previously stored preference is ignored and the theme falls
back to the OS setting; there are no production users yet.

**Roles.** `owner` and `manager` are gone. The four supported roles are
`platform_admin`, `restaurant_admin`, `waiter`, and `kitchen`. `restaurant_admin`
absorbs owner and manager responsibilities. Platform administration stays
separate: only `platform_admin` holds `applications.review`,
`restaurants.suspend`, and `plans.manage`, and `restaurant_admin` holds no
platform permission.

**Database and RLS.** Phase 1 shipped no schema, no policies, and no applied
migrations, so no migration was needed. Phase 2 will create the role enum with
the same four values; nothing has to be backfilled or altered.

---

## 2. Files created or modified

Created:

```
.env.example
.prettierignore
.prettierrc
eslint.config.mjs
vitest.config.mts
src/proxy.ts
src/app/globals.css
src/app/layout.tsx
src/app/(marketing)/layout.tsx
src/app/(marketing)/page.tsx
src/app/api/health/route.ts
src/components/shared/logo.tsx
src/components/shared/site-footer.tsx
src/components/shared/site-header.tsx
src/components/shared/theme-toggle.tsx
src/components/ui/button.tsx
src/components/ui/icons.tsx
src/lib/site.ts
src/lib/env/shared.ts
src/lib/env/client.ts
src/lib/env/server.ts
src/lib/security/roles.ts
src/lib/validation/roles.ts
src/lib/supabase/client.ts
src/lib/supabase/server.ts
src/lib/supabase/admin.ts
src/lib/supabase/proxy.ts
src/types/database.ts
src/utils/cn.ts
tests/unit/cn.test.ts
tests/unit/env.test.ts
tests/unit/roles.test.ts
supabase/README.md
PROJECT_STATUS.md
```

Modified (replacing scaffold defaults):

```
package.json
tsconfig.json
next.config.ts
.gitignore
README.md
AGENTS.md
```

Modified during the Phase 1 corrections (branding and roles):

```
package.json                       name meza â†’ mezo
package-lock.json                  name synced with package.json
.env.example                       header comment
README.md                          brand, tagline, roles table
AGENTS.md                          brand, role conventions
PROJECT_STATUS.md                  brand, roles, verification results
src/lib/site.ts                    name and tagline
src/app/layout.tsx                 theme storage key
src/app/(marketing)/page.tsx       brand copy, tagline, role list
src/components/shared/theme-toggle.tsx  theme storage key
src/components/shared/site-footer.tsx   brand copy, tagline
src/app/api/health/route.ts        service name
src/lib/supabase/proxy.ts          log prefix
```

### Phase 2 files

Created:

```
supabase/config.toml                              CLI-generated local config
supabase/migrations/20261111090000_enums_and_utilities.sql
supabase/migrations/20261111090100_core_tables.sql
supabase/migrations/20261111090200_operations_tables.sql
supabase/migrations/20261111090300_ordering_tables.sql
supabase/migrations/20261111090400_payments_tables.sql
supabase/migrations/20261111090500_subscriptions_tables.sql
supabase/migrations/20261111090600_audit_logs.sql
supabase/migrations/20261111090700_security_functions.sql
supabase/migrations/20261111090800_rls_policies.sql
supabase/migrations/20261111090900_integrity_triggers.sql
supabase/migrations/20261111091000_grants.sql
supabase/migrations/20261111100000_grant_public_catalogue_to_authenticated.sql
supabase/seed.sql                                 development plan catalogue only
tests/db/harness.ts                               in-memory Postgres harness (PGlite)
tests/db/fixtures.ts                              seeded test world
tests/db/database.test.ts                         45 schema / RLS / isolation tests
tests/db/shared-suite.ts                          shared 45-check battery (used by PGlite and staging)
tests/db/staging.test.ts                          staging entry; reuses the shared suite
tests/db/run-staging.mjs                          reads .env.local, spawns the staging suite
```

Modified:

```
package.json / package-lock.json   test:db, test:db:staging, test:unit and db:* scripts; @electric-sql/pglite + pg devDependencies
src/types/database.ts              generated from staging (103 KB; all 22 public objects)
README.md                          database section, scripts table
supabase/README.md                 database workflow, staging path, public-surface notes
PROJECT_STATUS.md                  this file
vitest.config.mts                  testTimeout 30s, hookTimeout 120s for networked targets
```

Scaffold output removed as unused: `src/app/page.tsx` and the default
`public/*.svg` assets. `src/app/favicon.ico` was kept.

---

## 3. Dependencies installed

Runtime:

| Package               | Version |
| --------------------- | ------- |
| next                  | 16.4.6  |
| react                 | 19.3.1  |
| react-dom             | 19.3.1  |
| @supabase/ssr         | 0.12.7  |
| @supabase/supabase-js | 2.119.0 |
| zod                   | 4.6.7   |
| clsx                  | 2.1.1   |
| tailwind-merge        | 3.7.0   |
| server-only           | 0.0.1   |

Development:

| Package                | Version                                |
| ---------------------- | -------------------------------------- |
| typescript             | 5.9.3                                  |
| @types/node            | 24.19.2                                |
| @types/react           | 19.3.0                                 |
| @types/react-dom       | 19.3.0                                 |
| tailwindcss            | 4.3.5                                  |
| @tailwindcss/turbopack | 4.3.5                                  |
| eslint                 | 10.14.0                                |
| eslint-config-next     | 16.4.6                                 |
| eslint-config-prettier | 10.1.8                                 |
| prettier               | 3.9.10                                 |
| vitest                 | 5.1.0                                  |
| @electric-sql/pglite   | 0.5.16                                 |
| pg                     | 8.x (driver for the staging test path) |
| @types/pg              | ^8                                     |

Phase 2 uses `@electric-sql/pglite` as a devDependency for the in-memory
PostgreSQL used by the database and RLS test suite, and `pg` for the
mezo-staging connection in the staging test path. Everything else in the
stack is unchanged from Phase 1.

Deliberately **not** installed yet: payment SDK, form library, state manager,
component library, ORM/query builder, Playwright. The exceptions are
`@electric-sql/pglite` (Phase 2, in-memory PostgreSQL for DB/RLS tests) and
`pg` (Phase 2, staging test path only).

---

## 4. Commands executed

```bash
npx create-next-app@16.4.6 ...      # scaffolded in a lowercase temp dir, then copied
npm install                         # 389 packages initial install
npm install -D eslint@9.39.5        # evaluated, then reverted (see Known issues)
npm install -D eslint@10.14.0       # final state
npm run lint
npm run typecheck
npm run test
npm run format
npm run format:check
npm run build
npm run start                       # production server for runtime checks
npm audit --omit=dev
```

Runtime verification used `Invoke-WebRequest`, the in-app browser, DOM evaluation,
and Lighthouse.

Phase 2 additionally ran: `npx supabase init --force`, the new
`npm run test:db` suite (45 tests), repeated `npx vitest run` cycles while
fixing the Security review items noted in section 5, `npm run build` after the
foundation was established, and `npm run db:types` was documented but not
executed (requires Docker Desktop or a linked project).

---

## 5. Phase 2 — Database Architecture & Security (complete)

**Status: complete — applied to mezo-staging, tests green, types generated; awaiting approval before Phase 3.**

### Deliverables

- **21 tables**, one **public view** (`public.public_restaurants`), **14 enums**,
  **235 columns**, **83 indexes**, **30 functions**, **30 triggers**,
  **58 Row Level Security policies**. Every public table has RLS enabled —
  this is enforced by an automated test that fails if a table ever loses it.
- Ordered, transactional migrations (`begin`/`commit` in every file), applied
  in filename order by both the Supabase CLI and the PGlite test harness.
- Client grants are deny-by-default: `anon` and `authenticated` receive only
  explicit, per-table (and where relevant per-column) privileges. The
  `service_role` keeps full access and is server-only. `PUBLIC` execute on
  functions was revoked throughout.

### Tables

| Migration group                  | Tables                                                                                        |
| -------------------------------- | --------------------------------------------------------------------------------------------- |
| Platform & restaurant management | `profiles`, `platform_admins`, `restaurants`, `restaurant_members`, `restaurant_applications` |
| Restaurant operations            | `restaurant_tables`, `menu_categories`, `menu_items`, `table_sessions`, `guest_sessions`      |
| Ordering                         | `orders`, `order_items`, `order_events`, `waiter_requests`                                    |
| Payments                         | `payments`, `payment_attempts`, `payment_webhook_events`                                      |
| Subscriptions                    | `subscription_plans`, `restaurant_subscriptions`, `subscription_payments`                     |
| Audit                            | `audit_logs`                                                                                  |
| Public surface                   | `public_restaurants` (view), plus read access to active `subscription_plans`                  |

Every restaurant-owned row carries `restaurant_id`. Children use composite
foreign keys `(child_id, restaurant_id)` referencing parent `(id, restaurant_id)`
pairs, so cross-tenant mismatches are rejected at the database level. Conflict
rules: cascade from restaurants; restrict from `menu_categories` (cannot delete
a category that still has items); `on delete set null` on informational
references such as `menu_item_id` on order items.

### Migrations (in order)

```
20261111090000_enums_and_utilities.sql    14 enums + set_updated_at()
20261111090100_core_tables.sql            profiles, platform_admins, restaurants,
                                          restaurant_members, restaurant_applications
20261111090200_operations_tables.sql      restaurant_tables, menu_categories, menu_items,
                                          table_sessions, guest_sessions
20261111090300_ordering_tables.sql        orders, order_items, order_events, waiter_requests
20261111090400_payments_tables.sql        payments, payment_attempts, payment_webhook_events
20261111090500_subscriptions_tables.sql   subscription_plans, restaurant_subscriptions,
                                          subscription_payments
20261111090600_audit_logs.sql             audit_logs (append-only)
20261111090700_security_functions.sql     privilege helpers + RPCs (request/approve/close
                                          session, apply/review application)
20261111090800_rls_policies.sql           RLS on every table + public_restaurants view
20261111090900_integrity_triggers.sql     integrity triggers (snapshots, totals,
                                          state machine, updated_at)
20261111091000_grants.sql                 privilege revoke + explicit grants
20261111100000_grant_public_catalogue_to_authenticated.sql
                                          authenticated read access to public_restaurants
```

Migration files are never edited after being applied anywhere. The defects
found during testing (an invalid `pg_catalog.current_user` reference, and the
caller-identity bypass in the SECURITY DEFINER RPCs described under Security
review notes below) were fixed before the first apply;
once a migration has been applied, fixes ship as new migrations.

### Design decisions

- **Roles.** `restaurant_role` = `restaurant_admin`, `waiter`, `kitchen`.
  `platform_admin` is a separate table (`platform_admins`); no restaurant role
  can hold it. The onboarding flow (`apply_for_restaurant` â†’
  `review_restaurant_application`) makes the registrant the first
  `restaurant_admin` atomically with approval.
- **QR tokens.** `restaurant_tables.qr_token` defaults to
  `replace(gen_random_uuid()::text, '-', '')` concatenated with itself:
  64 hex characters from two random UUIDs. Not sequential, not derivable.
- **One open session per table.** A partial unique index on
  `(table_id) WHERE status IN ('pending','active')` makes two open sessions
  impossible even under a direct superuser insert. Waiters approve with
  `approve_table_session()`; guests scan with `request_table_session()`, which
  creates the pending session or joins the existing pending/active one. Guests
  need no individual approval to join an already-approved table session.
- **Orders only in active sessions.** `guest_can_order()` gates the guest
  insert policy on the table session being `active` and the restaurant being
  `approved`/`active`. The `orders_sanitize_new_order()` trigger forces
  `status='placed'`, zeroes totals and sets `placed_at`/`placed_by` from the
  caller's JWT, so clients cannot open or approve orders.
- **Price snapshots.** `snapshot_order_item()` (BEFORE INSERT, SECURITY
  DEFINER) copies `name` and `price_tzs` from `menu_items` and ignores client
  values; `order_items.subtotal_tzs` is a STORED generated column
  (`unit_price_tzs * quantity`); `protect_order_item_snapshot()` freezes the
  snapshot fields (no client `UPDATE` grant on `order_items` at all);
  `refresh_order_totals()` recomputes `orders.subtotal_tzs`/`total_tzs` from
  the items. Historical prices never move when the menu changes — verified by
  test. All money columns are `BIGINT` integer TZS.
- **Order status machine.** `placed â†’ accepted â†’ preparing â†’ ready â†’ served`,
  any step may be cancelled except from `served`/`cancelled`;
  `enforce_order_status_transition()` blocks backward transitions and blocks
  kitchen staff from cancelling or serving. Restaurant admins and waiters can
  do both. Order events are written exclusively by triggers
  (`created`, `status_changed`); clients have no write grant on `order_events`.
- **Payments are separate.** Payment state
  (`pending/processing/successful/failed/cancelled/refunded`) lives in
  `payments.status` and `subscription_payments.status`; the order table never
  stores it. No API keys are stored anywhere; `payment_webhook_events.payload`
  is retained for idempotency but is readable by platform admins only. Snippe
  is **not** integrated; the schema is prepared for it.
- **Subscriptions.** Seeded development plans: Starter 5 tables, Growth 20,
  Pro 100, plus yearly Starter/Growth variants — pricing is a documented
  placeholder. `restaurant_subscriptions.table_limit` is snapshotted from the
  plan by trigger; clients cannot raise it. One current subscription per
  restaurant via a partial unique index; `enforce_table_limit()` rejects table
  inserts beyond the snapshot.
- **Tenant isolation.** Every policy consults SECURITY DEFINER helpers
  (`is_restaurant_member`, `has_restaurant_role`, “¦) owned by the table owner,
  so no policy re-reads its own table under RLS and recursion cannot occur.
  Guests never read restaurant admin data, waiters and kitchen hold only
  operational privileges, platform admins hold platform privileges and no
  operational ones, and `anon` reads exactly the public catalogue.
- **Column-level privileges** prevent writes to immutable/sensitive columns
  (e.g. `guest_sessions.table_session_id`, `restaurants.application_status`)
  independently of RLS.
- **`SECURITY DEFINER` functions** always set `search_path = ''` and never
  trust the definer context: administrative authorization is computed from the
  caller's JWT (`auth.uid()` / `is_platform_admin()` /
  `has_restaurant_role()`), never from `current_user`.

### Environment variables

Unchanged. Still required: `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY` (browser and server), and the server-only
`SUPABASE_SERVICE_ROLE_KEY`, which bypasses RLS. `SNIPPE_*` variables will be
added in a later phase. **No new environment variables were added and no
credentials exist yet**; there is nothing to leak.

### Applying the schema

Requires Docker Desktop for the local Supabase stack. On machines without it,
`npm run test:db` applies the migration chain to in-memory PostgreSQL 17 and
is the fast local verification path:

```bash
npm run db:start    # supabase start
npm run db:reset    # recreate db, apply migrations + seed
npm run db:push     # push to linked project
npm run test:db     # apply migrations + run schema tests on in-memory PGlite
npm run test:db:staging   # reuse the same suite against the hosted staging project
```

Hosted staging was used to verify this phase: the mezo-staging project
(`sskooncjmymzoxlhkulh`, `eu-central-1`, PostgreSQL 17.11.0) received all
migrations via `supabase db push --remote --include-seed` — `supabase migration
list --remote` shows all 12 migrations applied and matching local history (the
grant migration added later brought the count from 11 to 12). The
direct `db.<ref>.supabase.co` endpoint is IPv6-only for this network, so
`npm run test:db:staging` uses the session pooler
`aws-1-eu-central-1.pooler.supabase.com:5432`. The staging suite reuses the
same 45 checks and leaves the fixture data behind for inspection.

TypeScript types: `src/types/database.ts` is generated from the applied
staging project (103 KB, all 22 public objects). `npm run db:types` regenerates
from the local stack (`--local`, needs Docker), or regenerate from a linked
remote project with:

```bash
npx supabase gen types typescript --project-id <ref> > src/types/database.ts
```

(`--project-id` is deprecated in CLI v4 and will be removed; prefer `--remote`
where the direct DB connection is reachable. Types are never to be
hand-maintained.)

Seed data: `supabase/seed.sql` inserts only the development plan catalogue.
No fake accounts or credentials. Staging's seed was applied by
`supabase db push --include-seed`.

### Verification (what was actually run)

| Check                                 | Result                                                                               |
| ------------------------------------- | ------------------------------------------------------------------------------------ |
| Migrations applied on staging         | Pass — `db push` dry-run + apply; `migration list` shows 12/12 match local           |
| Staging schema introspected           | Pass — 21 tables, 1 view, 58 policies, 30 functions, RLS enabled on all tables       |
| `npm run test`                        | Pass — 4 files, **70 tests** (25 unit + 45 database, PGlite)                         |
| `npm run test:db:staging`             | Pass — **45/45** against hosted mezo-staging (PostgreSQL 17.11.0)                    |
| `npm run lint`                        | Pass                                                                                 |
| `npm run typecheck`                   | Pass — against generated `src/types/database.ts`                                     |
| `npm run format:check`                | Pass                                                                                 |
| `npm run build`                       | Pass — same routes as Phase 1; Turbopack build clean                                 |
| `npm audit --omit=dev`                | 0 vulnerabilities                                                                    |
| RLS on every table                    | Enforced by test (`enables RLS on every table in the public schema`)                 |
| `anon` blocked from 18 private tables | Pass                                                                                 |
| Restaurant A↔B isolation              | Pass (admin, waiter, kitchen, guest, platform admin each tested)                     |
| Approve/close/reject flows            | Pass (RPC-only writes, role-checked on the caller's JWT)                             |
| OK — `public_restaurants` view        | Both `anon` and `authenticated` read exactly the same 11 approved+active rows/fields |

**Database test coverage (from the approved list):** restaurant tenant
isolation âœ“ Â· restaurant admin permissions âœ“ Â· waiter permissions âœ“ Â· kitchen
permissions âœ“ Â· platform admin permissions âœ“ Â· customer access restrictions âœ“ Â·
QR token uniqueness âœ“ Â· one active session per table âœ“ (at the RLS level and
under a direct superuser insert) Â· foreign-key integrity âœ“ Â· order-item price
snapshots (spoofed `unit_price_tzs`/`name_snapshot` overwritten; menu price
changes do not rewrite history) âœ“ Â· subscription table limits (enforced on
insert; plan snapshot retaken on plan change; client cannot raise the limit) âœ“ Â·
plus schema invariants (RLS enabled everywhere, all 21 tables created, seed
plans present) and the application review flow end-to-end (apply â†’ reject â†’
approve â†’ role assignment).

RLS was exercised by `SET ROLE` + `request.jwt.claim.sub` on real PostgreSQL,
not by reading policy text. PGlite is PostgreSQL 17 embedded in-process, not a
mock.

### Final review and grant fix — `20261111100000_grant_public_catalogue_to_authenticated.sql`

Phase 2 was concluded with a focused review of the one intentional RLS bypass,
the public catalogue view `public_restaurants`, and of every `SECURITY DEFINER`
function on staging.

**`public_restaurants` review result.**

- Definition: `SELECT id, name, slug, description, logo_url, contact_phone,
address_line1, address_line2, city, region, country_code FROM restaurants
WHERE application_status = 'approved' AND operational_status = 'active'`.
- Exactly 11 public columns; private columns (`application_status`,
  `operational_status`, `subscription_status`, `contact_email`, `created_by`,
  `approved_by`, `approved_at`) are **not** in the view and cannot be projected
  from it.
- `security_invoker=false` is appropriate and required: only the view's
  `WHERE` decides visibility; there is no possibility for a client to
  impersonate RLS context.
- Confirmed on staging:
  - `anon` and `authenticated` both see the same 4 approved-and-active fixture
    restaurants; 0 suspended/rejected row is ever visible via the view.
  - Writes (`INSERT`/`UPDATE`/`DELETE`) on the view are denied for clients.
  - `service_role` can read all rows (RLS bypass by design).

**Grant fix.** The single ACL asymmetry found during that review — `anon`
could read the public catalogue but `authenticated` (which is what Supabase
anonymous sign-ins issue in the guest flow) could not — was filed in a new
migration `20261111100000_grant_public_catalogue_to_authenticated.sql`; it was
never edited after being applied.

**SECURITY DEFINER review.** All 22 definer functions are owned by `postgres`
and pin `search_path = ''`. None of them trusts `current_user`; authorization
always derives from the caller's JWT (`auth.uid()`, `is_platform_admin()`,
`has_restaurant_role()`). In particular:

- `approve_table_session(p_session_id)` locks the row `FOR UPDATE`, requires
  caller auth, requires the caller to hold `restaurant_admin` or `waiter` in
  the session's restaurant (`has_restaurant_role`), refuses sessions not in
  `pending`, and refuses restaurants that are not approved-and-active.
- `close_table_session(p_session_id)` has the same staff gating and removes
  ordering ability before guests re-scan.
- `review_restaurant_application(p_application_id, p_status, ...)` is
  `platform_admin`-gated; it locks the application row and flips restaurant
  state + membership atomically; it records every decision in `audit_logs`.
- `apply_for_restaurant(...)`, `request_table_session(...)`,
  `sanitize_new_order(...)` and all the trigger definers carry no client
  privilege; the trigger definers cannot be called directly
  (`X/client` ACLs on none of them).

**ACLs confirmed on staging (probed, not just migration-read):**

- `public_restaurants`: `{anon=r/postgres, authenticated=r/postgres,
service_role=X/postgres, postgres=X/postgres}`.
- All 13 trigger definers have no client privilege.
- All 22 definer functions: `authenticated=X` only on the 12 RPCs/helpers that
  are meant to be callable; `anon` on only the two `is_*_public()` helpers;
  nothing else.

### Known limitations and remaining issues

1. **Staging fixture data persists, by decision.** The mezo-staging project now
   contains the demo fixture restaurants, staff accounts (`example.test`
   addresses), tables, menu items, and orders created by the first run. The
   suite resets only that fixture universe before re-running, so
   `npm run test:db:staging` is safe to re-run.
2. **Direct DB connectivity is unavailable here.** `db.<ref>.supabase.co` does
   not resolve from this network (IPv6), so the pooler endpoint is used. Docker
   Desktop is also still absent. A disposable staging project is required for
   every future migration — never apply one straight to production.
3. **TypeScript database types are generated from staging** as of this phase
   (`src/types/database.ts`, all 22 public objects). Regenerate after every
   schema change with `npm run db:types` or `npx supabase gen types
typescript --remote` once the direct connection is reachable.
4. **`protect_restaurant_review_fields()` is defense-in-depth.** Lifecycle
   columns are not granted to any client role, so its blocking path is never
   reached by clients. It protects the day column privileges are ever widened.
5. **Seed prices are placeholders**; commercial terms are not yet approved.
6. **Expired subscription history is retained** (the partial unique index only
   constrains the current subscription).
7. **No QR token rotation UI**; rotation is a table update.
8. **`order_events` actor role is not recorded** — only the user id; role
   attribution would require joining `restaurant_members`.
9. **Supabase anonymous sign-ins must be enabled** in the Supabase dashboard
   for the guest QR flow (a Phase 3 decision).
10. **No component or end-to-end tests** yet; interaction-level behaviour arrives
    with authenticated flows in Phase 3/4.
11. **Phase 1 residual items still apply**: dev-only `minimatch` advisories,
    no git repository initialized, no `.env.local`, and a stray dev server
    may hold port 3000 on this machine.
12. **No guest-side order cancel.** Customers cannot cancel; waiters/admins
    cancel on their behalf to keep the lifecycle auditable.

### Security review notes

Testing caught two real defects, fixed before the chain was ever applied:

1. `pg_catalog.current_user` is not a valid qualified reference; `current_user`
   is a keyword, not a function (`missing FROM-clause entry for table
"pg_catalog"`). Replaced with `current_user`. `pg_catalog.now()` is valid
   because `now()` is a real built-in function.
2. **Caller identity was not being enforced inside `SECURITY DEFINER` RPCs.**
   Inside a definer function `current_user` is always the function owner, so a
   `current_user IN ('postgres', 'service_role')` "bypass" is permanently true
   and the staff/platform-admin checks in `approve_table_session()`,
   `close_table_session()` and `review_restaurant_application()` never fired.
   Fixed by removing the bypass entirely: every administrative path is now
   authorised solely from the caller's JWT (`auth.uid()` / `is_platform_admin()`
   / `has_restaurant_role()`), and fixtures insert privileged rows directly
   instead of bypassing authorization. Verified by tests: a non-staff guest
   could approve a session before the fix and is rejected with `42501` after it.

A third trap worth recording: `information_schema` hides objects from roles
without privileges, so schema-existence assertions run as `service_role`.

---

## 6. Test results

| Check                         | Result                                                                       |
| ----------------------------- | ---------------------------------------------------------------------------- |
| `npm run lint`                | Pass                                                                         |
| `npm run typecheck`           | Pass                                                                         |
| `npm run format:check`        | Pass                                                                         |
| `npm run test`                | Pass — 4 files, **70 tests** (25 unit, 45 database PGlite)                   |
| `npm run test:db:staging`     | Pass — **45/45** against mezo-staging (PostgreSQL 17.11.0)                   |
| `npm run build`               | Pass — `/` and `/_not-found` static, `/api/health` dynamic, proxy registered |
| `npm audit --omit=dev`        | 0 vulnerabilities                                                            |
| Migrations applied on staging | Pass — 12/12 applied, verified via `migration list --remote`                 |
| Staging schema introspection  | Pass — 21 tables, 1 view, 58 policies, 30 functions                          |
| RLS isolation probes          | Pass — staff, guest, platform admin, anon (staging)                          |
| QR token uniqueness           | Pass                                                                         |
| One active session per table  | Pass                                                                         |
| Price snapshot integrity      | Pass                                                                         |
| Subscription table limit      | Pass                                                                         |
| `GET /api/health`             | 200, `{"status":"ok","service":"mezo","timestamp":"..."}`                    |
| Lighthouse (full corrections) | Accessibility 100, Best Practices 100, SEO 100                               |

Unit tests cover `cn()` merging, the environment schema and the role
definitions and permission matrix (25 tests). The database suite covers schema
invariants, RLS isolation, the guest scan flow end-to-end, order integrity,
subscription limits and the application review flow (45 tests) — verified on
both the in-memory PGlite harness and the hosted mezo-staging project. The
staging run additionally indexes the real `auth.users` table and egress via the
region pooler, so the full path (migration apply → query → RLS → fixtures) is
proven against Supabase itself, not a mock.

---

## 7. Security notes

- No secrets are committed; `.env.example` holds placeholders only.
- `SUPABASE_SERVICE_ROLE_KEY` is only read inside a `server-only` module.
- No client input is trusted: prices, totals, roles, QR tokens and session
  joins are validated server-side; `restaurant_id` from the client is never
  trusted — policies and SECURITY DEFINER RPCs verify membership.
- Authorization is enforced by Postgres RLS plus explicit table privileges,
  column privileges and integrity triggers. The proxy only refreshes sessions.
- `anon` and `authenticated` have no privileges on private tables; `PUBLIC`
  has no execute on any function; nothing client-reachable bypasses RLS.
- Audit events are written by definer functions only; nobody can forge an
  audit row through the client surface.
- Phase 1 items still apply: headers baseline; no nonce-based CSP yet.

---

## 8. Recommended next phase

**Phase 3 — Auth and user management.** Do not start until approved. Suggested scope:

1. Enable Supabase anonymous sign-ins (dashboard setting) for the QR flow.
2. Auth UI: sign in / sign up, email verification, and the staff invitation
   flow (`restaurant_members` inserts by restaurant admins).
3. Registrant onboarding UI powered by `apply_for_restaurant()`, and the
   platform review console powered by `review_restaurant_application()`.
4. Session utilities that propagate the Supabase SSR session into the
   `request.jwt.claim.sub` GUC path used by the RLS helpers, and a verified
   end-to-end scan → approve → order loop against a staging project.
5. Auth redirect and protection policy in `src/proxy.ts`.
6. Component tests for the auth flows.

Phase 2 must be reviewed and approved before Phase 3 begins.
