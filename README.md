# Mezo

Multi-restaurant QR ordering SaaS for dine-in restaurants in Tanzania.

**SMART DINING. SIMPLE SERVICE.**

> **Status: Phase 2 — database architecture and security.** The schema, RLS, helpers, triggers, migrations and executable tests are in place. There is no application UI for auth, ordering or payments yet; the landing page describes the planned product and is not a live service.

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
│  ├─ (auth)/             Sign-in, invitations, callbacks (Phase 3)
│  ├─ (customer)/         QR menu, cart, order tracking (Phase 5)
│  ├─ (staff)/            Waiter and kitchen views (Phase 6)
│  ├─ (restaurant-admin)/ Menu, tables, staff, settings (Phase 4)
│  ├─ platform/           Platform administrator (Phase 3)
│  └─ api/
│     └─ health/          Liveness endpoint
├─ components/
│  ├─ ui/                 Reusable primitives (button, icons)
│  ├─ shared/             Header, footer, logo, theme toggle
│  ├─ customer/           Customer feature components
│  ├─ staff/              Staff feature components
│  ├─ restaurant/         Restaurant administration components
│  └─ platform/           Platform administration components
├─ lib/
│  ├─ env/                Typed, Zod-validated environment
│  ├─ supabase/           Browser, server, admin, and proxy clients
│  ├─ validation/         Shared Zod schemas (Phase 2)
│  └─ security/           Role definitions and authorization helpers
├─ services/              Domain services (Phase 2+)
├─ types/                 Generated database types (see src/types/database.ts)
└─ utils/                 Small shared utilities
supabase/
├─ config.toml            Local Supabase CLI configuration
├─ migrations/            Ordered SQL migrations (090000–100000)
├─ seed.sql               Development subscription plans (no accounts)
└─ README.md              Database workflow and role notes
tests/
├─ unit/                  Unit tests (Vitest)
└─ db/                    PostgreSQL schema and RLS tests (PGlite)
```

## Database

Phase 2 ships a multi-tenant PostgreSQL schema (21 tables plus one public view), deny-by-default client grants, and deny-by-default RLS. Authorization for tenant flows lives in Postgres; the proxy still only refreshes sessions.

- **Tenant root:** `restaurants`, keyed by slug, reviewed by a platform admin before it goes live (`pending/approved/rejected`), with `active/suspended` operational state.
- **QR tokens:** `restaurant_tables.qr_token` is 64 hex characters generated from two random UUIDs; it is a bearer secret, never sequential.
- **Table sessions:** one open session per table, enforced by a partial unique index. Guests scan a QR code and join; staff approve and close. Multiple guests may share a pending/active session without individual approvals.
- **Orders:** only while the table session is active; item snapshots are taken server-side at insert time; totals are recomputed from items, never from the current menu price.
- **Payments:** stored separately from order status; schema-ready for Snippe integration, but no payment processing exists yet.
- **Subscriptions:** platform-wide plans with `table_limit` snapshotted onto each restaurant; the table-limit trigger enforces it at insert time.

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

## Architecture notes

- **Authorization is enforced by Postgres RLS.** The proxy only refreshes sessions.
- **Role helpers are a convenience layer.** `hasPermission()` decides what to render and fails fast; it is never the security boundary.
- **The service-role key is server-only.** It lives in `src/lib/supabase/admin.ts` behind `server-only`.
- **Tenant isolation, pricing, table limits, and payment verification are backend concerns.** None are implemented yet.
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

## Next phase

Phase 2 will add the Supabase schema, RLS policies, helper functions, plan seed data, pgTAP tests, and generated types. See `PROJECT_STATUS.md`.
