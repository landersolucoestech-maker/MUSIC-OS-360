# Monorepo Fix — Workspaces + Isolated Client

## What & Why
The root `package.json` declares only `"workspaces": ["apps/api"]` — `client/` and the `packages/shared-types` and `packages/shared-zod` packages are not part of the npm/turbo workspace. This means that:
- `turbo run dev` does not orchestrate the frontend correctly
- `packages/shared-types` and `packages/shared-zod` are not installed as real workspaces
- `client/` does not have its own `package.json` (it is in the root), mixing frontend dependencies with root scripts
- There are no `tsconfig references` linking client → shared-types/shared-zod
- Vite potentially has access to Node/NestJS code because everything is in the same dependency scope

## Done looks like
- `"workspaces"` includes `["apps/api", "client", "packages/*"]`
- `client/package.json` exists with isolated frontend dependencies (react, vite, tailwind, shadcn, etc.)
- `packages/shared-types/package.json` and `packages/shared-zod/package.json` export correctly
- The root `tsconfig.json` uses `references` for client, api, shared-types, shared-zod
- `turbo.json` orchestrates `dev`, `build`, `typecheck`, `lint` correctly for all workspaces
- `vite.config.ts` has no access to backend-specific NestJS/Node dependencies
- `turbo run dev` starts the frontend and backend without errors

## Out of scope
- Migrating the existing content of the shared-types/shared-zod packages (structure only)
- CI/CD GitHub Actions (only a working local setup)
- Changing business logic

## Steps
1. **Update workspaces** — add `"client"` and `"packages/*"` to the `"workspaces"` array of the root `package.json`; adjust the `dev:web` and `build:web` scripts to point to the `client` workspace
2. **Create `client/package.json`** — extract the frontend dependencies from the root `package.json` into `client/package.json` with the name `@music-os-360/client`; keep the build devDependencies in the root
3. **Configure packages** — ensure that `packages/shared-types/package.json` and `packages/shared-zod/package.json` have correct `"name"`, `"main"` and `"exports"`; create `index.ts` barrels if missing
4. **Fix tsconfig references** — root `tsconfig.json` references client, api, packages; `client/tsconfig.json` references shared-types and shared-zod; Vite aliases `@shared-types`, `@shared-zod` aligned
5. **Update turbo.json** — ensure a working `dev` and `build` pipeline for all workspaces; test `turbo run typecheck` without errors

## Relevant files
- `package.json`
- `turbo.json`
- `tsconfig.json`
- `tsconfig.app.json`
- `vite.config.ts`
- `packages/shared-types`
- `packages/shared-zod`
- `client`
