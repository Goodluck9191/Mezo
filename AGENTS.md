# Mezo — agent notes

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev`.

<!-- END:nextjs-agent-rules -->

## Project conventions

- Next.js 16: `src/proxy.ts` replaces `middleware.ts`; `cookies()`, `headers()`, `params`, and `searchParams` are async.
- Authorization belongs in Postgres RLS. The proxy is only for session refresh.
- Keep `SUPABASE_SERVICE_ROLE_KEY` behind `server-only` modules.
- Validate every external input with Zod at the server boundary.
- Never accept prices, totals, roles, or tenant IDs from client input.
- Roles are exactly `platform_admin`, `restaurant_admin`, `waiter`, and `kitchen`
  (`src/lib/security/roles.ts`). Do not add `owner` or `manager` back.
- `restaurant_admin` is tenant-scoped and has no platform permissions; only
  `platform_admin` can approve, reject, or suspend restaurant applications.
- Branding is **Mezo**; the tagline is `SMART DINING. SIMPLE SERVICE.`
- Use `@/` imports and the `cn()` utility for conditional classes.
- Run `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run build` before reporting completion.
- Do not add a database migration, payment integration, or auth flow without an approved phase.
