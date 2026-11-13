# Mezo

Multi-restaurant QR ordering SaaS for dine-in restaurants in Tanzania.

**SMART DINING. SIMPLE SERVICE.**

> **Status: Phase 6 — menu management complete and verified on staging; awaiting approval.** Sign-in, applications, workspace, subscriptions, and menu management (categories, items, images, availability, public `/menu/[restaurantSlug]`) all work end-to-end. Customer QR ordering is not yet live.

## Stack

| Layer                                | Choice                                   |
| ------------------------------------ | ---------------------------------------- |
| Framework                            | Next.js 16 (App Router, Turbopack)       |
| Language                             | TypeScript 5.9, strict mode              |
| Styling                              | Tailwind CSS 4 (CSS-first configuration) |
| Database / Auth / Realtime / Storage | Supabase                                 |
| Validation                           | Zod 4                                    |
| Payments                             | Snippe (not integrated yet)              |
| Hosting                              | Vercel (not configured yet)              |

## Requirements

- Node.js **22.12+** (Node 24 recommended)
- npm 11+
- Docker Desktop for local Supabase (Phase 2)

## Getting started

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open <http://localhost:3000>.

The landing page and health check run without Supabase credentials. Supabase clients fail with a readable configuration error if used before `.env.local` is complete.

### Environment variables

| Variable                        | Scope            | Purpose                           |
| ------------------------------- | ---------------- | --------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Browser + server | Supabase project URL              |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser + server | Public anon key, protected by RLS |
| `SUPABASE_SERVICE_ROLE_KEY`     | **Server only**  | Privileged key; bypasses RLS      |
| `NEXT_PUBLIC_APP_URL`           | Browser + server | Canonical app URL                 |

Never commit `.env.local` or real keys. The service-role key must only be imported by server-only modules.

## Scripts

| Command                   | Purpose                                                           |
| ------------------------- | ----------------------------------------------------------------- |
| `npm run dev`             | Start the development server                                      |
| `npm run build`           | Production build                                                  |
| `npm run start`           | Run the production build                                          |
| `npm run lint`            | ESLint                                                            |
| `npm run lint:fix`        | ESLint with autofix                                               |
| `npm run typecheck`       | TypeScript, no emit                                               |
| `npm run test`            | Unit + database tests (Vitest)                                    |
| `npm run test:watch`      | Tests in watch mode                                               |
| `npm run test:unit`       | Unit tests only                                                   |
| `npm run test:db`         | Database schema and RLS tests (PGlite, default)                   |
| `npm run test:db:staging` | Same suite against mezo-staging (set credentials in `.env.local`) |
| `npm run db:start`        | Start the local Supabase stack (Docker Desktop required)          |
| `npm run db:stop`         | Stop the local Supabase stack                                     |
| `npm run db:reset`        | Drop, recreate and re-migrate the local database                  |
| `npm run db:push`         | Push migrations to the linked project                             |
| `npm run db:types`        | Regenerate `src/types/database.ts` from the local stack           |
| `npm run format`          | Prettier write                                                    |
| `npm run format:check`    | Prettier check                                                    |

## Project structure

```
src/
├─ app/
│  ├─ (marketing)/        Public landing page and marketing layout
│  ├─ (auth)/             Login, register, forgot/reset password, verify email, profile
│  ├─ auth/confirm/       Email verification + invite token handler
│  ├─ (restaurant-admin)/ Restaurant apply, dashboard, onboarding, settings (Phase 3–4), billing (Phase 5), menu (Phase 6)
│  ├─ (staff)/            Waiter and kitchen consoles (Phase 3); accept-invite (Phase 4)
│  ├─ platform/           Platform-admin area (applications; subscriptions + plans in Phase 5)
│  ├─ (customer)/         Public `/menu/[restaurantSlug]` (Phase 6)
│  └─ api/
│     └─ health/          Liveness endpoint
│  └─ actions/            Server actions (auth, application review, profile, restaurant workspace)
├─ components/
│  ├─ ui/                 Reusable primitives (button, icons, input, select, textarea, skeleton)
│  ├─ shared/             Header, footer, logo, theme toggle, ConfirmButton
│  ├─ auth/               Sign-in/up forms, profile editor, verification page bits
│  ├─ customer/           Public /menu/[restaurantSlug] (Phase 6)
│  ├─ staff/              Staff feature components
│  ├─ restaurant/         Restaurant workspace shell, profile & staff forms, empty states, skeletons
│  └─ platform/           Platform administration components
├─ lib/
│  ├─ env/                Typed, Zod-validated environment
│  ├─ supabase/           Browser, server, admin, and proxy clients
│  ├─ auth/               requireUser / membershipsWithRole / isPlatformAdmin / isRestaurantAdminOf guards
│  ├─ validation/         Zod schemas (auth, roles, restaurant profile & staff, subscriptions)
│  ├─ security/           Role definitions and authorization helpers
│  ├─ profile-completion.ts  Pure profile-completeness scoring
│  ├─ subscription.ts     Server-only subscription data loaders (restaurant view, platform lists/detail)
│  ├─ subscriptions-shared.ts  Client-safe subscription labels and formatting
│  └─ restaurant.ts       Server-only workspace data + guard (restaurant queries, staff roster)
├─ types/                 Generated database types (see src/types/database.ts)
└─ utils/                 Small shared utilities
supabase/
├─ config.toml            Local Supabase CLI configuration
├─ migrations/            Ordered SQL migrations (090000–160000)
├─ seed.sql               Development subscription plans (no accounts)
└─ README.md              Database workflow and role notes
tests/
├─ unit/                  Unit tests (Vitest)
└─ db/                    PostgreSQL schema and RLS tests (PGlite + Supabase staging)
```

## Database

Phase 2 ships a multi-tenant PostgreSQL schema (21 tables, one public view, one storage bucket with RLS), deny-by-default client grants, and deny-by-default RLS. Authorization for tenant flows lives in Postgres; the proxy only refreshes sessions. Phase 3 adds server-side route guards in `src/lib/auth/guards.ts` — both the layouts and the server actions re-check before touching data. The proxy deliberately stays blind to roles. Phase 4 adds the `restaurant_staff_invitations` table and the `restaurant-logos` storage bucket (migration 14, fixed in 15). Phase 5 hardens table-limit enforcement (FOR UPDATE lock) and adds subscription lifecycle and payment-recording RPCs (migration 17). Phase 6 adds archive semantics + a public published-menu RPC + another storage bucket (`menu-images`) (migration 18).

- **Tenant root:** `restaurants`, keyed by slug, reviewed by a platform admin before it goes live (`pending/approved/rejected`), with `active/suspended` operational state.
- **QR tokens:** `restaurant_tables.qr_token` is 64 hex characters generated from two random UUIDs; it is a bearer secret, never sequential.
- **Table sessions:** one open session per table, enforced by a partial unique index. Guests scan a QR code and join; staff approve and close. Multiple guests may share a pending/active session without individual approvals.
- **Orders:** only while the table session is active; item snapshots are taken server-side at insert time; totals are recomputed from items, never from the current menu price.
- **Payments:** stored separately from order status; schema-ready for Snippe integration, but no payment processing exists yet.
- **Subscriptions:** platform-wide plans with `table_limit` snapshotted onto each restaurant; the table-limit trigger (with a FOR UPDATE row lock) enforces it at insert time. Subscription lifecycle transitions are enforced server-side in RPCs; restaurant admins cannot change plan, status, payment or limit through any client channel; platform-admin actions are audited in `audit_logs`. Payment recording is operator-attested in this phase (Snippe collection is not yet enabled).

See `supabase/README.md` for how to apply migrations and `PROJECT_STATUS.md` for the exact migration list, policy inventory and test evidence.

## Roles

Defined once in `src/lib/security/roles.ts` and validated with Zod in `src/lib/validation/roles.ts`.

| Role               | Scope      | Can do                                                                                                  |
| ------------------ | ---------- | ------------------------------------------------------------------------------------------------------- |
| `platform_admin`   | Platform   | Review, approve, reject, or suspend restaurant applications. Manage plans. No restaurant-tenant access. |
| `restaurant_admin` | Restaurant | Settings, menu, tables and QR codes, staff, orders, reports, and the restaurant subscription.           |
| `waiter`           | Restaurant | Open and close table sessions, approve guests, read and update orders.                                  |
| `kitchen`          | Restaurant | Read orders and move them through preparation.                                                          |

`restaurant_admin` replaces the previous separate `owner` and `manager` roles. The person who registers a restaurant becomes its first `restaurant_admin` once a platform administrator approves the application.

## Authentication & authorization

Server-side guards in `src/lib/auth/guards.ts` implement the checks below. None of them trust client-supplied IDs, tokens, or roles.

| Entry point                          | Allows                                                                                             |
| ------------------------------------ | -------------------------------------------------------------------------------------------------- |
| `getUser()` / `requireUser(next?)`   | Any authenticated session; redirects to `/login?next=…` otherwise.                                 |
| `membershipsWithRole(userId, roles)` | User's memberships scoped to the requested roles. Used by waiter/kitchen/admin consoles.           |
| `requirePlatformAdmin(fallback?)`    | `platform_admins` table check; non-platform users are sent away.                                   |
| `isPlatformAdmin()`                  | Boolean platform-admin predicate (server actions, e.g. application review).                        |
| `isRestaurantAdminOf(userId, id)`    | True only for an active `restaurant_admin` of that restaurant; used by every Phase 4 write action. |

Restaurant workspace pages resolve the active restaurant from the caller's memberships via `requireWorkspace()` in `src/lib/restaurant.ts`; a `?restaurant=<slug>` the caller does not administer renders 404. No server action trusts a restaurant id submitted by the browser — membership is always re-verified server-side, and Postgres (RLS + privileges + triggers) is the final arbiter.

The `/auth/confirm` route verifies the email confirmation/invitation/reset `token_hash` with `verifyOtp()` and redirects by token `type`. The `/login`, `/register` and `/forgot-password` pages redirect already-authenticated users to their dashboard. The proxy refreshes the session cookie only; no authorization decisions happen there.

## Architecture notes

- **Authorization is enforced by Postgres RLS.** Layouts and actions both re-check before touching data; the proxy refreshes sessions only.
- **Guards are server-only and call `server-only`.** They are invisible to the client bundle.
- **Role helpers are a convenience layer.** `hasPermission()` decides what to render and fails fast; it is never the security boundary.
- **The service-role key is server-only.** It lives in `src/lib/supabase/admin.ts` behind `server-only`.
- **Tenant isolation, pricing, table limits, and payment verification are backend concerns.** Table limits are enforced; pricing and tenant isolation are done by RLS. Order-status transitions are trigger-enforced.
- **Secrets are never committed.** `.env.example` contains placeholders only.

## Health check

```bash
curl http://localhost:3000/api/health
```

```json
{
  "status": "ok",
  "service": "mezo",
  "timestamp": "2026-11-11T00:00:00.000Z"
}
```

## Restaurant workspace (Phases 3–6)

Post-approval restaurant administrators get a workspace under `/restaurant/*`: dashboard, profile, staff, subscriptions, onboarding, and `/restaurant/menu` (categories and items with drag-and-drop-equivalent reorder, soft-archive semantics, image uploads, availability labels). The public route `/menu/[restaurantSlug]` renders the published menu to anonymous diners.

- **Multi-restaurant membership is supported**: a selector appears whenever the caller administers more than one restaurant, and every page/action scopes to the chosen membership.
- **Staff invitation flow**: `invite_restaurant_staff()` RPC issues a single-use 64-hex token (stored as a hash); invitations expire after 7 days, are tied to one restaurant, are accepted only by the account whose email matches, and can be revoked by that restaurant's admins. No `restaurant_admin` role can ever be granted by invitation.
- **No fabricated numbers**: orders/revenue/menu show labelled "Coming in a later phase" empty states.

## Subscriptions (Phase 5)

Subscription management is live on both the platform and restaurant sides:

- **Catalogue** — plans are data, not code: `subscription_plans` (Starter/Growth/Business/Enterprise; all prices are development placeholders, 0 = custom arrangement). Only platform admins can create/edit/deactivate plans via RPCs; clients cannot write the catalogue at all.
- **Assignment** — plan changes are made by the platform through `assign_subscription_plan()`: the current term is closed atomically and a new active term opens. Restaurants never self-assign; `table_limit` is re-snapshotted from the new plan; no table is ever deleted by a downgrade.
- **Table-limit enforcement** — `enforce_table_limit()` takes a `FOR UPDATE` lock on the subscription row, so concurrent table creation cannot bypass the limit; lowering a plan never deletes existing tables; over-limit restaurants cannot add further tables.
- **Lifecycle** — `pending → active | expired | cancelled; active → past_due | expired | cancelled; past_due → active | expired | cancelled; expired → active | cancelled`. `cancelled` is terminal. Restaurant admins never transition state; every transition and payment/audit action is logged in `audit_logs`.
- **Billing boundary** — `subscription_payments` records payments (operator-attested in this phase; Snippe integration pending provider-capability verification). No recurring billing is enabled or claimed; payments are idempotent on provider reference.

Restaurant admins see their plan, table usage, status and payment history at `/restaurant/billing` (read-only); the platform manages everything at `/platform/subscriptions` and `/platform/plans`.

## Next phase

**Phase 7 — QR ordering, table sessions, waiter and kitchen flows.** Do not start until Phase 6 is explicitly approved. See `PROJECT_STATUS.md`.
