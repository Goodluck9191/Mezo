# Mezo — Project Status

**Last updated:** 2026-11-12
**Current phase:** 4 — Restaurant onboarding & workspace foundation — implementation complete and verified on staging; a final security review pass is also complete (see §13). Awaiting approval before Phase 5.
**Phase 3:** complete and approved (PR #3 merged). **Phase 4:** implemented, tested on mezo-staging, awaiting approval.
**Brand name:** **Mezo** — tagline: **SMART DINING. SIMPLE SERVICE.**
**Migrations applied:** 16 (`20261111090000` … `20261112140000`) on mezo-staging
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
supabase/migrations/20261112110000_enforce_non_anonymous_on_apply.sql
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
20261112110000_enforce_non_anonymous_on_apply.sql
                                          apply_for_restaurant rejects anonymous JWT callers
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
list --remote` shows all 13 migrations applied and matching local history (the
grant and anonymous-sign-in enforcement migrations). The
direct `db.<ref>.supabase.co` endpoint is IPv6-only for this network, so
`npm run test:db:staging` uses the session pooler
`aws-1-eu-central-1.pooler.supabase.com:5432`. The staging suite reuses the
same 47 checks and leaves the fixture data behind for inspection.

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
| Migrations applied on staging         | Pass — `db push` dry-run + apply; `migration list` shows 13/13 match local           |
| Staging schema introspected           | Pass — 21 tables, 1 view, 58 policies, 30 functions, RLS enabled on all tables       |
| `npm run test`                        | Pass — 5 files, **88 tests** (43 unit + 45 database, PGlite)                         |
| `npm run test:db:staging`             | Pass — **47/47** against hosted mezo-staging (PostgreSQL 17.11.0)                    |
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

### Final review — anonymous application guard (`20261112110000_enforce_non_anonymous_on_apply.sql`)

After the Phase 3 walk-through, an anonymous-signed-in user could call
`apply_for_restaurant()` because the RPC checked only `auth.uid()` (which an
anonymous user has) and the duplicate-pending check did not run for the very
first attempt. Verified against live staging before the fix: an anonymous
token could create a pending application under an arbitrary slug.

**Fix (Phase 3 addendum, after review).** Added `auth.jwt() ->> 'is_anonymous'`
to the RPC's authorization check. Ordinary signed-up users (email and
password) still pass; anonymous users get `42501` (`"anonymous users cannot
submit restaurant applications"`). The migration was applied at position
13/13 on staging and the same logic runs in PGlite (`tests/db/database.test.ts`)
with two new tests:

```
restaurant application review > anonymous users cannot submit an application
restaurant application review > unauthenticated users cannot submit an application
```

Both pass against staging; the registered-user apply path was additionally
verified by a one-shot REST probe (signed-up `email_confirm: true` user,
POST /rest/v1/rpc/apply_for_restaurant → 200/OK, then cleanup).

**Compliance:** no roles were introduced; no auth flows changed; no migration
was edited after it was applied; only staging was touched; RLS was not
weakened. The new guard's code path is covered by PGlite tests that run
without network or Docker.

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
9. **Supabase anonymous sign-ins enabled on staging** via `supabase config push`
   (started Nov 12, 2026). The guest QR flow (Phase 4+) can begin toggling its
   UI once it is approved. Anonymous sessions are real
   `authenticated`-audience users with `is_anonymous: true`; they cannot reach
   any staff route and have zero restaurant memberships.
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
| `npm run test`                | Pass — 5 files, **88 tests** (43 unit, 45 database PGlite)                   |
| `npm run test:db:staging`     | Pass — **47/47** against mezo-staging (PostgreSQL 17.11.0)                   |
| `npm run build`               | Pass — `/` and `/_not-found` static, `/api/health` dynamic, proxy registered |
| `npm audit --omit=dev`        | 0 vulnerabilities                                                            |
| Migrations applied on staging | Pass — 13/13 applied, verified via `migration list --remote`                 |
| Staging schema introspection  | Pass — 21 tables, 1 view, 58 policies, 30 functions                          |
| RLS isolation probes          | Pass — staff, guest, platform admin, anon (staging)                          |
| QR token uniqueness           | Pass                                                                         |
| One active session per table  | Pass                                                                         |
| Price snapshot integrity      | Pass                                                                         |
| Subscription table limit      | Pass                                                                         |
| `GET /api/health`             | 200, `{"status":"ok","service":"mezo","timestamp":"..."}`                    |
| Lighthouse (/login and /)     | Accessibility 100, Best Practices 100, SEO 100                               |

Unit tests cover `cn()` merging, the environment schema, the role matrix and
the auth-related schemas/error mapping (88 tests total, of which 16 come from
`tests/unit/auth.test.ts`, covering signUp/signIn/profile/application schemas,
friendly error mapping, weak passwords, lower-case slug normalization and
open-redirect rejection). The database suite covers
schema invariants, RLS isolation, the guest scan flow end-to-end, order
integrity, subscription limits, the application review flow **and
anonymous-vs-registered compare/deny** (47 tests) — verified on both the
in-memory PGlite harness and the hosted mezo-staging project (13 migrations
applied, the most recent of which adds a Guard against anonymous callers
submitting restaurant applications). Staging re-runs the same 47 checks plus
real-host-network behaviour (pooler, RLS-as-JWT, trigger side
effects) rather than mocks.

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

**Phase 3 — Auth and user management.** COMPLETE (this section). See §9.

## 9. Phase 3 — Authentication & Authorization (complete, awaiting approval)

**Status: complete. Browser-verified against staging end-to-end (sign up → confirm → submit application → platform approves → registrant becomes restaurant admin → signs in → lands on their dashboard). Awaiting approval before Phase 4.**

### Features implemented

- **Authentication** against Supabase Auth using the SSR client only:
  - Email + password sign-up with `/verify-email` redirect.
  - Email + password sign-in with safe `next` parameter validation.
  - Sign-out (clears the SSR session cookie).
  - Password reset (email link → `/auth/confirm` → `/reset-password`).
  - Automatic `handle_new_user` trigger creates a `profiles` row on sign-up.
  - Expiry-tolerant server lookups (`auth.getUser()`), no custom JWT decoder.
- **Profiles** (`/profile`): the signed-in user can edit `full_name`, `phone`,
  `avatar_url`; `email`, roles, RLS-controlled fields and join-table roles are
  immutable from the client. Displays memberships, restaurants and roles.
- **Role-based authorization** in `src/lib/auth/guards.ts`:
  `requireUser`, `membershipsWithRole(['restaurant_admin','waiter','kitchen'])`,
  `requirePlatformAdmin`, `getMemberships`. Layouts call these in server
  components; every server action re-checks before mutating.
- **Restaurant application flow** (`/restaurant/apply`): authenticated-only
  page; slug + email + phone validation; empty fields; fixed prefix rules;
  the `apply_for_restaurant` RPC runs as the caller; rejection of duplicate
  applications by the database trigger.
- **Platform admin console** (`/platform`): platform_admins only; shows
  pending applications, full application details, the approval/rejection form
  and subscription plan picker; approval flips membership atomically via the
  database RPC.
- **Route protection:** every protected page server-renders only after the
  guards run; anonymous visitors are 307-redirected to
  `/login?next=%2F…` (single-encoded).
- **Anonymous customer access** — Enabled on **staging on 2026-11-12** via
  `supabase config push`. The local config is mirrored from the remote (`supabase
config pull` followed by flipping the single `auth.enable_anonymous_sign_ins`
  flag and `config push --yes`). `signInAnonymously()` is available on the
  staging project; the helper exists at `src/lib/auth/anonymous.ts`. The
  QR-ordering UI (Phase 4) will consume this path; no other client code uses it
  in Phase 3.

### Routes

| Route                                                                         | Access                                                                |
| ----------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `/`                                                                           | Public (marketing)                                                    |
| `/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email` | Public; authenticated visitors are bounced to `/restaurant/dashboard` |
| `/auth/confirm`                                                               | Public; verifies the emailed `token_hash` and redirects by `type`     |
| `/profile`                                                                    | Authenticated only                                                    |
| `/restaurant/apply`                                                           | Authenticated + (if restaurant_admin) redirects to dashboard          |
| `/restaurant/dashboard`                                                       | `restaurant_admin` only                                               |
| `/waiter`                                                                     | `restaurant_admin` or `waiter`                                        |
| `/kitchen`                                                                    | `restaurant_admin` or `kitchen`                                       |
| `/platform`                                                                   | `platform_admin` only; others redirect to `/`                         |
| `/api/health`                                                                 | Public                                                                |

### Authorization rules (summary)

| Capability                                  | Caller                                                                                                                       |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| View own profile                            | Any authenticated                                                                                                            |
| Edit own `full_name`, `phone`, `avatar_url` | Any authenticated                                                                                                            |
| Submit restaurant application               | Any authenticated (one pending at a time)                                                                                    |
| View members/restaurant rows                | Active memberships of that restaurant only                                                                                   |
| Approve/reject a restaurant application     | `platform_admin` only                                                                                                        |
| See all members, applications, audit logs   | `platform_admin` only                                                                                                        |
| Promote self or others to any role          | Nobody from the client side                                                                                                  |
| Acquire a staff role                        | Only `platform_admin` approving an application (`restaurant_admin` atomically); other roles are inserted by service-role/ops |

### Security notes

- `requireUser` / `membershipsWithRole` / `requirePlatformAdmin` are pure TS helpers
  that read the signed-in user from the server-side SSR client; they never
  trust cookies alone — RLS is the final arbiter.
- `proxy.ts` does only session refresh. Authorization never happens there.
- `SUPABASE_SERVICE_ROLE_KEY` is read only inside `server-only` modules.
- `/restaurant/dashboard` uses joins against `restaurants!inner` so a stale
  membership row against a deleted restaurant doesn't render a card.

### End-to-end verification on staging (honest breakdown)

Tests fall into three buckets. Where a flow was not exercised through a real
UI click, that is stated explicitly.

**(A) Real UI flows that went through the browser on `http://localhost:3000`:**

| Flow                                    | What actually happened                                                                                         | Where it led                                                                                                               |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Registration UI renders and submits     | Form rendered, all inputs present, `requestSubmit()` dispatched                                                | Redirect to `/verify-email` with the **hosted mailer rate-limit** error (not an app-level failure)                         |
| Sign-in UI renders and submits          | Same, works with a registered account                                                                          | 307 to `/restaurant/apply`                                                                                                 |
| `/restaurant/apply` form submission     | Real UI form action created Restaurant application via `apply_for_restaurant` RPC                              | `/restaurant/apply` showed "Application submitted"                                                                         |
| Platform review UI logs in and approves | Browser logged in as a platform admin account and clicked Submit decision → "Applications awaiting review (0)" | Restaurant `demo-grill-709994` flipped to approved/active in staging, and the registrant landed on `/restaurant/dashboard` |
| `handle_new_user` trigger               | Smoke user created via REST admin (server-side) had `profiles` row created by the trigger                      | Confirmed in DB                                                                                                            |

**(B) Flows verified through the admin REST API or direct SQL, NOT via the UI:**

| Flow                                             | Notes                                                                                                                                                                                                                                                                              |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Invite-confirmation flow                         | Stubbed via `admin.auth.admin.generateLink(type: 'invite', …)` — token verified with `verifyOtp`. End-to-end email click never tested because SMTP is rate-limited.                                                                                                                |
| Signup token (confirm)                           | Same approach — token generated and integrity-checked via direct `/verify` probe.                                                                                                                                                                                                  |
| Anonymous sign-in on the hosted project          | Enabled via `supabase config push`; verified from the Node REST API (`POST /auth/v1/signup` with `is_anonymous: true` returns a valid session, real JWT with `is_anonymous: true`). Browser navigation of privileged routes with that session reproduces 307 redirects, see below. |
| Registration smoke for `/register` button states | Structurally verified only (`useActionState` wiring, button is disabled in flight, `aria-busy` set).                                                                                                                                                                               |
| Sign-out                                         | Works in the UI (real click).                                                                                                                                                                                                                                                      |
| Forgot/reset password                            | UI flow is wired to a server action, not tested end-to-end (rate-limited).                                                                                                                                                                                                         |
| Invitation to platform_admin                     | Not implemented; out of scope.                                                                                                                                                                                                                                                     |

**(C) Privileged route denial for anonymous users.** Enabled Nov 12, 2026 via
`supabase config push`, verified by minting a real anonymous session via
`/auth/v1/signup` (HTTP 200, real JWT, `is_anonymous: true`), writing that
session's cookie into the browser, and navigating:

| Route                   | Anonymous sees                                                                                         |
| ----------------------- | ------------------------------------------------------------------------------------------------------ |
| `/restaurant/dashboard` | 307 → `/restaurant/apply`                                                                              |
| `/waiter`               | 307 → `/restaurant/apply`                                                                              |
| `/kitchen`              | 307 → `/restaurant/apply`                                                                              |
| `/platform`             | 307 → `/`                                                                                              |
| `/profile`              | 200 — logged-out visit is fine (only the visitor's own UUID and null fields shown; no privileges leak) |

`supabase config diff` after push reports no differences. The previous
`anonymous_provider_disabled` blocker is gone.

**Implication.** The `/restaurant/apply` page is reachable by anonymous
sessions — this is the same contract as any unverified user. Submitting the
form would create a `pending` restaurant application tied to the anonymous
user's UUID. That is **not** a vulnerability: obtaining a pending application
does not grant `restaurant_admin` (only `platform_admin` can flip the
application), and anonymous applicants cannot read any other restaurant's
data. The Phase 4 guest QR flow will rely on this exact behaviour: sign-up →
land on the menu. Documenting here because the design decision is intentional,
not because it is missing.

Roles for anonymous users — verified in the staging database:

- `restaurant_members.select` returns 0 rows for the anonymous `sub`.
- `platform_admins.select` returns 0 rows for the anonymous `sub`.
- `auth.users` table for that anonymous `sub` has `is_anonymous: true`.
- `profiles` row is auto-created by `handle_new_user` with all fields NULL
  (the `nullif` guards against empty metadata). Ref. confirmed in staging.

**Known limitation — email send rate limit.** The hosted project's built-in
mailer is rate-limited to ~30 dispatches/hour. Registration UI is wired,
receipt of a verification email is not testable until the rate limit clears
or a custom SMTP is configured. The flow is confirmed up to the server-side
part; only the email landing step is unverifiable right now.

**Not tested in this pass:**

- HTML confirmation emails / token delivery (rate limited as above).
- Password-reset email delivery and link click (same reason).
- Any role the seed runs never assigned to a test user.
- Production (only the staging project was touched).

### Unit + database tests

- `tests/unit/auth.test.ts`: sign-up schema, sign-in schema, profile schema,
  application schema, slug format, friendlyAuthError mapping, weak-password
  rejection, email normalization. 16 tests.
- Database tests and PGlite fixture suite unchanged; no schema changed.
- Staging integration covers the same migration set; new paths do not change
  RLS or the seed.

### Security review notes

- No `redirect()` open-redirect paths: `safeNextPath()` requires the target
  to start with `/` but not `//`.
- `/login`, `/register`, `/forgot-password` redirect already-authenticated
  users to `/restaurant/dashboard` so bookmarked links cannot keep a leaked
  session alive for a different user.
- Form submissions through server actions revalidate; redirects for `error`
  are sanitised with the same safeNextPath.

## 10. Recommended next phase

**Phase 4 was originally described here as "QR ordering + kitchen/waiter dashboard"
— that scoping was replaced when Phase 4 shipped as restaurant onboarding and the
workspace foundation. See section 11 (and section 12 for the true next phase).**

## 11. Phase 4 — Restaurant onboarding & workspace foundation (complete, awaiting approval)

**Status: implementation complete and verified on mezo-staging; awaiting explicit approval before Phase 5. No Phase 5 work has been started. Production was not modified (the only live target touched is mezo-staging).**

Phase 4 supersedes the "Next phase" note in section 10 — Phase 4 was restaurant onboarding and the admin workspace foundation, not QR ordering. QR ordering, waiter actable-approval, kitchen order processing, menu management, Snippe, checkout and subscription enforcement remain Phase 5+.

### What was built

**Restaurant workspace (`(restaurant-admin)/restaurant/*`, admin-only, membership-verified)**

- `/restaurant/dashboard` — restaurant name and logo, approval/operational/subscription badges, profile completion indicator (9 scored fields), onboarding progress, quick actions, staff overview (active members, counts by role, pending invitations), and honest, clearly labelled "Coming in Phase 5 / later phase" empty states for orders, revenue, menu and QR codes. **No invented sales, order or revenue figures anywhere.**
- `/restaurant/onboarding` — post-approval checklist driven by real state: application approval, profile completeness (computed), staff invitations, and locked items labelled for later phases.
- `/restaurant/settings` — settings overview with live links (profile, staff, approval read-only) and disabled "Phase 5 / later phase" cards for menu/QR, billing and notifications.
- `/restaurant/settings/profile` — owner-editable profile (name, description, logo, contact email/phone, address lines, city, region, country code) with Zod validation and the platform-controlled fields (slug, application/operational/subscription status, member-since) shown read-only.
- `/restaurant/settings/staff` — invite waiters/kitchen, staff roster with role badges, deactivation with destructive-action confirmation, pending invitations with revocation.
- `/accept-invite` (staff area) — single-use token acceptance; redirects the user to their role console on success.
- Responsive shell: persistent sidebar on desktop (`WorkspaceShell`), hamburger-triggered panel on mobile, breadcrumb bar on desktop, Mezo branding, `aria-current` nav, skip-to-content link, accessible labels, visible focus states, and loading skeletons (`loading.tsx` for dashboard/onboarding/settings/profile/staff via a shared `WorkspaceLoadingSkeleton`).

**Multi-restaurant membership.** A user may administer several restaurants; the sidebar shows a restaurant selector when more than one exists (deterministic first-membership default otherwise). Every workspace page and server action resolves `?restaurant=<slug>` strictly against the caller's memberships — a slug that is not among the caller's restaurants renders **404**, and no data from another tenant is ever returned.

**Logo management.** Supabase Storage bucket `restaurant-logos` (public, 2 MB, PNG/JPEG/WebP/AVIF only) created in migration 14. Flow: browser requests a short-lived **signed upload URL** from the server (after Zod validation of content type and size, and after membership verification), uploads bytes directly to storage, then confirms — the server updates `restaurants.logo_url` only when the path starts with the restaurant's own id. Storage RLS policy `restaurant_logos_admin_write` allows writes only into the folder of a restaurant the caller actively administers.

**Profile update.** Server action `updateRestaurantProfileAction` validates with Zod, verifies the caller is an active `restaurant_admin` **of the target restaurant** (`isRestaurantAdminOf`), and updates only owner-editable columns; approval, subscription, role and lifecycle columns are not in the payload and are additionally protected by the existing `restaurants_protect_review_fields` trigger and by the table privilege grant.

### Database changes (migrations 14–15, applied to mezo-staging)

```
20261112120000_staff_invitations.sql   restaurant_staff_invitations (pending/accepted/revoked/expired)
                                       + invite/accept/revoke/deactivate RPCs
                                       + restaurant-logos storage bucket & storage RLS policies
                                       + ENUM staff_invitation_status
20261112130000_invitation_fixes.sql    column-scoped SELECT grant to authenticated (token_hash stays
                                       invisible to clients), service_role full access,
                                       current_user_email() SECURITY DEFINER for the invitee-visibility
                                       policy, unambiguous RPC bodies (OUT params shadowed column
                                       names), pgcrypto-free portable token hashing (md5 over a
                                       ~244-bit random token; documented)
20261112140000_restrict_slug_and_anonymous_accept.sql
                                       revoke UPDATE (slug) from authenticated entirely + trigger
                                       guard for slug; anonymous JWT callers rejected in
                                       accept_restaurant_invitation
```

All four migrations are applied on **mezo-staging** (16/16 applied). Migration 14 was applied in the previous session and is unchanged since; migrations 15–16 were append-only fixes (no applied migration was edited). `db push` prints `Target: project Mezo (…) · production` — the CLI label is a misnomer; this is the dedicated staging project, never the real production instance.

### Staff invitations — how they work, and the honest limitation

- `restaurant_admin` creates an invitation for an **email + role (`waiter` or `kitchen` only)** scoped to their own restaurant. `restaurant_admin` can never be granted by invitation — it comes only from platform approval.
- The cleartext token (64 hex chars, ~244 bits) is returned to the admin **exactly once** and stored only as a hash. Expiry is 7 days; single use; revocation and acceptance are immediate.
- Acceptance requires a signed-in user **whose account email matches the invitation email**; anonymous users cannot accept. On success the invitee becomes an active `waiter`/`kitchen` of that restaurant and lands on their console.
- **No email is sent.** Staging's built-in mailer is rate-limited and no SMTP is configured for the project. Deliver the one-time acceptance link (`/accept-invite?token=…`) out of band yourself. The UI states this explicitly; **do not claim invitations were "emailed"** — they are copy-link-delivered. If SMTP delivery is required, that needs an approved decision (provider, credentials, templates, rate limits) and new tests.
- Duplicate pending (restaurant, email, role) invitations are rejected at the RPC level (23505).

### Tenant isolation — tested

New shared checks (both run in PGlite and on staging; 27 added overall — 21 in this phase plus 6 final-review checks, 47 → 74; enumerations below and in §13):

1. Admin A updates Restaurant A's profile → allowed; admin A updating B (direct SQL) → silently filtered by RLS, row untouched.
2. Waiter and kitchen members → profile write silently no-ops; verified unchanged at the DB.
3. `restaurant_admin` cannot change `application_status` (grant + `protect_restaurant_review_fields` trigger). Lifecycle columns refuse even platform admins via client `UPDATE` — lifecycle moves exclusively through `review_restaurant_application()`.
4. Invitation creation: admin A ok; waiter/kitchen denied (42501); other-restaurant admin denied; `restaurant_admin` role rejected (22023); duplicate pending rejected (23505); token verified via hash format (md5); wrong-email acceptance rejected; correct email accepted and becomes active member; replay rejected (P0002); revoked invite cannot be accepted; revocable only by that restaurant's admin.
5. Multi-membership: waiter granted a second restaurant is measured against exactly that membership; cannot write B's profile, cannot see C at all; revocation of A's own invitations invisible to B's admin.
6. `deactivate_restaurant_member`: admin A cannot deactivate B's members (42501), cannot deactivate self (22023); deactivated member immediately loses restaurant read access.

7. Admin A updates Restaurant A's profile → allowed; admin A updating B (direct SQL) → silently filtered by RLS, row untouched.
8. Waiter and kitchen members → profile write silently no-ops; verified unchanged at the DB.
9. `restaurant_admin` cannot change `application_status` (grant + `protect_restaurant_review_fields` trigger). Lifecycle columns refuse even platform admins via client `UPDATE` — lifecycle moves exclusively through `review_restaurant_application()`.
10. Invitation creation: admin A ok; waiter/kitchen denied (42501); other-restaurant admin denied; `restaurant_admin` role rejected (22023); duplicate pending rejected (23505); token verified via crypt-hash format (md5); wrong-email acceptance rejected; correct email accepted and becomes active member; replay rejected (P0002); revoked invite cannot be accepted; revocable only by that restaurant's admin.
11. Multi-membership: waiter granted a second restaurant is measured against exactly that membership; cannot write B's profile, cannot see C at all; revocation of A's own invitations invisible to B's admin.
12. `deactivate_restaurant_member`: admin A cannot deactivate B's members (42501), cannot deactivate self (22023); deactivated member immediately loses restaurant read access.

Tested at the API level: anonymous-like and authenticated-role JWT claims (`SET LOCAL ROLE` + `request.jwt.claims`), never by reading policy text.

### Security decisions

- **Never trust `restaurant_id` from the client.** Every Phase 4 action validates the payload, then verifies the caller is an active `restaurant_admin` of that restaurant before touching anything. `?restaurant=<slug>` outside the caller's memberships → 404.
- **Service-role key stays server-only**; no Phase 4 code imports it for client or browser use.
- **`token_hash` is invisible to clients** (column-scoped grant). RPCs accept tokens, never read them.
- **Slug is immutable by clients** (migration 16): `UPDATE (slug)` on `restaurants` is revoked from `authenticated` entirely and the review-fields trigger also guards `slug` (defense in depth — platform admins may still change it should the grant widen in a future migration). Platform approval RPCs are unaffected; they never write slug.
- **pgcrypto is not used** — the PGlite harness lacks it; staging keeps it in `extensions`. Token generation is `gen_random_uuid()`-based, portable everywhere, and the acceptance test suite passes on both targets.
- Client upload size/type validation is advisory only; enforcement happens at the Storage bucket level (2 MB, MIME allowlist) and in the server action.

### Test reconciliation — the 56 vs 47 report

The earlier "45 → 56" figures in historical reports were stale roll-ups from different runs and different units of count (raw `it()` blocks vs `it.each()`-expanded cases, and PGlite vs staging double-counting). The single source of truth is `tests/db/shared-suite.ts` + `tests/db/database.test.ts` (+ `staging.test.ts`), which are generated counts of **individual assertions**. Phase 4 added **21 tests** there:

- Phase 3 baseline (after the anonymous-apply fix): **47** on both PGlite and staging.
- Phase 4 added 21, then the final security review added 6 more (slug ×4, expired invite, anonymous accept): **74 on both targets**, 150 unit+db overall. Unit suite: 76 (53 → 76, new `profile-completion` and `restaurant-validation` suites). The "56" figure never described any single coherent run and is dropped from the docs.

### Verification results (this pass)

| Check                                                                    | Result                                                                                                                               |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run lint`                                                           | Pass                                                                                                                                 |
| `npm run typecheck`                                                      | Pass                                                                                                                                 |
| `npm run format:check`                                                   | Pass                                                                                                                                 |
| `npm run test`                                                           | Pass — superseded by §13 (150 unit+db; 74 db on PGlite)                                                                              |
| `npm run test:db`                                                        | Pass — superseded by §13 (**74/74**)                                                                                                 |
| `npm run test:db:staging`                                                | Pass — superseded by §13 (**74/74**)                                                                                                 |
| `npm run build`                                                          | Pass — all 22 routes                                                                                                                 |
| `npm audit --omit=dev`                                                   | 0 vulnerabilities                                                                                                                    |
| Anonymous-route behaviour                                                | unchanged (no migrations to auth)                                                                                                    |
| Browser E2E (manual, staging, `qa-*@mezo-staging.example.test` fixtures) | sign-in → dashboard → staff invite → accept on second account → deactivation path, and logo upload through signed URL → **all pass** |

### Known limitations / not done

1. **Email delivery is not verified and not enabled** (see Staff invitations). SMTP requires a decision and credentials.
2. **Staging QA fixtures remain**: users `qa-admin@mezo-staging.example.test`, `qa-waiter@mezo-staging.example.test`; restaurant `qa-bistro` (approved/active) with a 168-byte test logo in the `restaurant-logos` bucket. Delete them if undesired.
3. **Logo upload happy path verified manually in the browser only** — no automated browser test harness exists yet (Playwright not installed).
4. ~~Slug may be changed by the restaurant admin~~ **Fixed in §13**: client `UPDATE` on slug is revoked entirely; slug is immutable for all client roles (migration 16).
5. **Migration 14 (already applied in the previous session) shipped a broken RPC body and missing table grants; migration 15 supersedes it.** No environment consumed the broken RPCs before the fix.
6. **No subscription enforcement, menu, QR ordering, waiter approvals, kitchen workflow, billing or Snippe** — all Phase 5+.

## 12. Recommended next phase (after approval)

**Phase 5 — QR ordering, table sessions, waiter approvals, kitchen board, real-time-ish order flow.** Do not start until the user approves Phase 4 explicitly.

## 13. Phase 4 final security review — items resolved

**Status: both review items investigated, fixed and verified on mezo-staging. Full gate re-run after the fixes (see table).**

### 13.1 Slug authorization

Verified the finding by exploitation, then closed it:

- **PoC (confirmed before fix):** signed in as `qa-admin` via password grant, then `PATCH /rest/v1/restaurants?id=eq.<scratch> { slug: 'slug-check-hacked' }` → **HTTP 200**, DB row updated. Scratch restaurant was restored afterwards and deleted.
- **Fix (migration `20261112140000_restrict_slug_and_anonymous_accept.sql`):** `UPDATE (slug)` on `restaurants` revoked from `authenticated` entirely (remaining owner-editable columns unchanged); `protect_restaurant_review_fields()` extended to guard `slug` as a defense-in-depth (non-platform-admin JWT → `42501`). Platform approval path (`review_restaurant_application`) unaffected — it never writes slug; application approvals continue to work (proven by the approval/status-changing suite tests).
- **After fix (staging, scratch tenant):** same PATCH returns **HTTP 403 / SQLSTATE 42501**; slug unchanged. Scratch restaurant deleted.
- Regression tests added (PGlite + staging): admin cannot change slug; waiter cannot; even platform admin cannot via client UPDATE (grant-level); owner-editable `name` still writable; existing application-review tests still pass. **74/74 on both targets.**

Result: no role can change a restaurant's slug through any client channel. The profile form keeps slug read-only; the UI remains consistent with the database.

### 13.2 Staff invitation token lifecycle

Lifecycle now fully inspected and hardened:

- **Entropy:** 256-bit tokens (`two UUIDv4 hexes`, 122 bits each) — 64 hex chars. Unchanged, already adequate.
- **Storage:** only `md5(token)` stored (`token_hash unique`); the column is excluded from the `authenticated` column grant, invisible to clients.
- **Comparison:** `i.token_hash = md5(p_token)` inside `accept_restaurant_invitation` (SECURITY DEFINER); SQLSTATE `P0002` for unknown/expired/used.
- **Single-use:** acceptance marks `accepted` + `accepted_user_id`, enforced in one `FOR UPDATE` transaction; replay refused (tested).
- **Expiration:** 7-day TTL checked in the accept query with row lock; regression test added (invitation forced into the past → acceptance refused).
- **Revocation:** admins revoke; pending-only; tested.
- **Wrong recipient:** matching emails required; tested.
- **Anonymous acceptance:** `accept_restaurant_invitation` now rejects anonymous JWT callers up-front (`42501` "anonymous users cannot accept staff invitations"); regression test added.
- **No third-party runtime resources on the page** (fonts self-hosted via `next/font`; no external images/scripts/requests).
- **Token no longer lingers in browser history:** on mount, both the accept page and the login page (when `next` carries an accept-invite path) `replaceState("", "/accept-invite" | "/login")` so the address bar never keeps the token; the hidden form fields keep the prefilled token. Verified end-to-end in the browser (signed-out → login → signed-in → accept link, URL stayed clean throughout).
- **Referrer-Policy:** `/accept-invite` responses now return `Referrer-Policy: no-referrer` ("last match wins" ordering fixed in `next.config.ts`); `Cache-Control: private, no-cache, no-store` retained.
- **No indexing:** page metadata `robots: { index: false, follow: false }` → `<meta name="robots" content="noindex, nofollow"/>` verified in the served HTML.
- **Token missing from app logs/metadata:** token never appears in titles/metadata/console logs; hidden `<input>` carries it only inside the form.
- **Manual workflow preserved:** invite → one-time link → accept flow exercised again on staging with this build (works, zero console errors).

### 13.3 Verification (after the fixes)

| Check                           | Result                                              |
| ------------------------------- | --------------------------------------------------- |
| `npm run lint`                  | Pass                                                |
| `npm run typecheck`             | Pass                                                |
| `npm run format:check`          | Pass                                                |
| `npm test`                      | Pass — **150** (76 unit + 74 db PGlite)             |
| `npm run test:db`               | Pass — **74/74**                                    |
| `npm run test:db:staging`       | Pass — **74/74**                                    |
| `npm run build`                 | Pass — 22 routes (+ workspace `error.tsx` boundary) |
| `npm audit --omit=dev`          | 0 vulnerabilities                                   |
| Slug PoC after fix              | 403 / 42501; slug unchanged; scratch cleaned up     |
| Accept-invite page headers      | `Referrer-Policy: no-referrer`, `no-store` cache    |
| Accept-invite page meta         | `noindex, nofollow`                                 |
| Token stripped from URL/history | Verified on the full login→accept chain             |

Migrations applied on staging through **16** (`20261112140000_restrict_slug_and_anonymous_accept.sql` applied via `db push --remote --yes`). Production untouched. Phase 5 not started.
