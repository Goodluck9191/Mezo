# Mezo — Project Status

**Last updated:** 2026-11-11
**Phase:** 1 — Project Foundation (complete, branding and roles corrected)
**Brand name:** **Mezo** — tagline: **SMART DINING. SIMPLE SERVICE.**

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
  explicit role → permission matrix, and `hasPermission()`.
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
- `supabase/README.md` — explains that Phase 1 intentionally ships no schema and
  what Phase 2 will add.

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
package.json                       name meza → mezo
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

| Package                | Version |
| ---------------------- | ------- |
| typescript             | 5.9.3   |
| @types/node            | 24.19.2 |
| @types/react           | 19.3.0  |
| @types/react-dom       | 19.3.0  |
| tailwindcss            | 4.3.5   |
| @tailwindcss/turbopack | 4.3.5   |
| eslint                 | 10.14.0 |
| eslint-config-next     | 16.4.6  |
| eslint-config-prettier | 10.1.8  |
| prettier               | 3.9.10  |
| vitest                 | 5.1.0   |

Deliberately **not** installed yet: payment SDK, form library, state manager,
component library, ORM/query builder, Playwright. Phase 1 does not need them.

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

---

## 5. Test results

| Check                          | Result                                                                       |
| ------------------------------ | ---------------------------------------------------------------------------- |
| `npm run lint`                 | Pass — no errors or warnings                                                 |
| `npm run typecheck`            | Pass — no errors                                                             |
| `npm run test`                 | Pass — 3 files, 25 tests                                                     |
| `npm run format:check`         | Pass — all files formatted                                                   |
| `npm run build`                | Pass — `/` and `/_not-found` static, `/api/health` dynamic, proxy registered |
| `GET /api/health`              | 200, `{"status":"ok","service":"mezo","timestamp":"..."}`                    |
| Security headers               | All five present on responses; `Cache-Control: no-store` on health           |
| `GET /`                        | 200                                                                          |
| `GET /does-not-exist`          | 404                                                                          |
| Lighthouse (light)             | Accessibility 100, Best Practices 100, SEO 100                               |
| Lighthouse (dark)              | Accessibility 100, Best Practices 100, SEO 100                               |
| Lighthouse (after corrections) | Accessibility 100, Best Practices 100, SEO 100                               |
| Branding check                 | Title, `application-name`, hero, footer, and roles all read "Mezo"           |
| Browser console                | No errors; single `<h1>`, single `<main>`, no horizontal overflow            |
| `npm audit --omit=dev`         | 0 vulnerabilities                                                            |
| Secret scan                    | Only the documented placeholder in `.env.example`; no `.env.local`           |

Unit test coverage: `cn()` merging behaviour (3 tests), environment schema
validation (5 tests), and role definitions, schema validation, and permission
matrix invariants (17 tests). There are no component or end-to-end tests yet —
Phase 1 has no interaction that warrants them beyond the manual checks above.

---

## 6. Known issues

1. **ESLint peer-dependency warnings (non-blocking).** `eslint-plugin-import`,
   `eslint-plugin-jsx-a11y`, and `eslint-plugin-react` (transitive via
   `eslint-config-next@16.4.6`) declare peer ranges capped at ESLint 9. ESLint
   10.14.0 is used because ESLint 9.39.5 is deprecated; install prints
   `npm warn ERESOLVE overriding peer dependency`, and linting passes. Revisit
   when `eslint-config-next` widens its peer range.
2. **Dev-only `npm audit` findings.** The full `npm audit` reports 7 moderate
   advisories from `minimatch` via `typescript-eslint`. They affect the lint
   toolchain only; `npm audit --omit=dev` reports 0. `npm audit fix` does not
   resolve them without breaking changes.
3. **No Supabase project configured.** There is no `.env.local`, so any code
   path that constructs a Supabase client throws a readable configuration error.
   The marketing page and health check intentionally do not touch Supabase.
4. **Supabase local stack unavailable.** Docker Desktop is not installed, so
   `npx supabase start` cannot run yet. Not needed until Phase 2.
5. **No git repository initialized.** All files are untracked. Run
   `git init` before Phase 2 so migrations and policies are reviewable.
6. **Proxy runs on a bare `NextResponse.next()` when unconfigured.** This is
   deliberate and logs a single development-only warning; it will be removed
   once Supabase credentials exist.
7. **Bare marketing layout group.** `(marketing)` currently owns `/`. Future
   route groups will need their own layouts to avoid inheriting marketing
   chrome.
8. **Screenshot capture unavailable in this environment.** Browser pixel
   screenshots require a visible Review pane tab; verification used DOM
   evaluation and Lighthouse instead.
9. **Role permissions are not enforced yet.** `src/lib/security/roles.ts` is the
   single source of truth, but nothing consumes it outside the landing page and
   tests until Phase 2 adds auth and RLS. Treat it as documentation of intent,
   not as a security control.

---

## 7. Security notes

- No secrets are committed; `.env.example` holds placeholders only.
- `SUPABASE_SERVICE_ROLE_KEY` is only read inside a `server-only` module.
- No client input is trusted anywhere — there is no mutation surface yet.
- Role constants and the permission matrix are a UI/guard convenience only.
  Phase 2 must mirror them in RLS policies, which remain the real boundary.
- No database, auth, or payment code exists, so no authorization decisions are
  being enforced anywhere yet.
- Headers above are a baseline; a nonce-based CSP should be added when the first
  dynamic, user-specific pages arrive.

---

## 8. Recommended next phase

**Phase 2 — Database schema, RLS, and tenancy foundation.** Suggested scope:

1. `npx supabase init` plus a committed `config.toml`.
2. Migration 1: core enums and tenant tables (restaurants, branches, staff/
   memberships, roles, tables, menu categories, menu items, orders, order items,
   payments, subscriptions, plans).
3. Migration 2: `SECURITY DEFINER` helpers (current restaurant, role checks,
   table-count plan limits) with `search_path` pinned.
4. Migration 3: RLS policies for every tenant table; deny-by-default.
5. pgTAP tests proving cross-tenant isolation for `platform_admin`,
   `restaurant_admin`, `waiter`, `kitchen`, customer, and anonymous access.
6. Seed data: plan tiers and one demo restaurant.
7. Generate `src/types/database.ts` from the CLI and wire it into the clients.
8. Add a readiness endpoint that verifies database reachability.

Phase 2 must not start until explicitly approved.
