# ArchPM

A project management app for architecture firms — track projects, tasks, RFIs, and site progress with role-based access for admins and team members.

## Run & Operate

- The managed workflows start the frontend at `/`, the API at `/api`, and the component preview at `/__mockup`.
- `pnpm --filter @workspace/db run push` — initialize or update the development database schema before the first API start
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- Required env: `DATABASE_URL` — Postgres connection string (auto-provisioned by Replit; do not set manually)
- Default login: `admin@archfirm.com` / `admin123` (seeded on first setup)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

_Populate as you build — short repo map plus pointers to the source-of-truth file for DB schema, API contracts, theme files, etc._

## Architecture decisions

_Populate as you build — non-obvious choices a reader couldn't infer from the code (3-5 bullets)._

## Product

_Describe the high-level user-facing capabilities of this app once they exist._

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- **Run schema push before first API start** (and after any rollback): `pnpm --filter @workspace/db run push`. Without it the API boots but silently fails to seed the admin user and returns 500 on login.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
