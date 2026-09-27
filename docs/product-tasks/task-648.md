---
title: NestJS Backend Tests + CI/CD + automatic Deploy
---
# NestJS Backend Tests + CI/CD + Deploy

## What & Why
The NestJS backend in `apps/api/` has no `.spec.ts` file, no Jest setup, and CI has no test job for the API. This prompt adds: a complete Jest setup, unit tests for the critical services (encryption, artists, guards, tenant isolation), a CI update with a minimum coverage of 80%, and two automatic deploy pipelines (staging via Railway + Vercel, production via Git tag).

## Done looks like
- `apps/api/jest.config.ts` created and working
- `test`, `test:watch`, `test:coverage`, `test:e2e` scripts in `apps/api/package.json`
- 4 `.spec.ts` files created and passing: EncryptionService, ArtistsService, ClerkAuthGuard, Tenant Isolation
- `npm run test:coverage` in `apps/api/` reaches ≥ 80% coverage
- `.github/workflows/ci.yml` updated with `test-api` and `test-web` jobs (with a Redis service)
- `.github/workflows/deploy-staging.yml` created (trigger: push to `staging`)
- `.github/workflows/deploy-production.yml` created (trigger: push of a `v*.*.*` tag)

## Out of scope
- E2E tests with a real database (uses mocks)
- Configuration of the Railway/Vercel/Neon secrets in the repository (the operator's responsibility)
- Frontend tests (CI infra only)

## Steps
1. **Install test dependencies** — Add `jest`, `@types/jest`, `ts-jest`, `supertest` and `@types/supertest` as devDependencies in `apps/api/`. Create `apps/api/jest.config.ts` with a 70/75/80/80 coverage threshold. Add the `test`, `test:watch`, `test:coverage`, `test:e2e` scripts to `apps/api/package.json`.

2. **Create the EncryptionService test** — Implement `encryption.service.spec.ts` with 4 cases: encrypt/decrypt roundtrip, `encryptNullable(null)` → null, `decryptNullable(null)` → null, and two ciphertexts of the same value are different (random IV).

3. **Create the ArtistsService test** — Implement `artists.service.spec.ts` with a mock of the Drizzle DB (`DRIZZLE_DB`) and EncryptionService. Verify: CPF/email encrypted on create, the `deleted_at IS NULL` filter in the listing, and soft delete (the `deleted_at` field is a Date, not a physical DELETE).

4. **Create the ClerkAuthGuard test** — Implement `clerk-auth.guard.spec.ts`: routes marked `@Public()` return `true` without checking the token; a missing token throws `UnauthorizedException`.

5. **Create the Tenant Isolation test** — Implement `tenant-isolation.spec.ts` in `modules/artists/`: list only returns artists of the correct tenant; `findById` and `update` of an artist from another tenant throw `NotFoundException`.

6. **Update CI** — Replace `.github/workflows/ci.yml` with the jobs `lint`, `typecheck-api`, `typecheck-web`, `test-api` (with a Redis service on 6379), `test-web`, and `build`, which depends on all the previous ones. The `test-api` job uses an `ENCRYPTION_KEY` of 64 zeros, a `CLERK_SECRET_KEY` with a fictitious test value (not a real key, in a format deliberately different from a valid credential) and `NODE_ENV: test`.

7. **Create deploy-staging.yml** — New workflow triggered on push to the `staging` branch: build the API, deploy to Railway staging (`RAILWAY_TOKEN_STAGING`), run the Drizzle migrations with `NEON_STAGING_DIRECT_URL`, deploy the frontend to a Vercel preview, smoke test `GET /api/v1/health`.

8. **Create deploy-production.yml** — New workflow triggered on push of a `v*.*.*` tag: build the API, deploy to Railway production (`RAILWAY_TOKEN_PRODUCTION`), run the Drizzle migrations with `NEON_PRODUCTION_DIRECT_URL`, deploy to Vercel `--prod`, smoke test, notify Sentry of the release.

## Relevant files
- `apps/api/package.json`
- `apps/api/src/core/security/encryption.service.ts`
- `apps/api/src/modules/artists/artists.service.ts`
- `apps/api/src/core/guards/clerk-auth.guard.ts`
- `apps/api/src/database/database.module.ts`
- `.github/workflows/ci.yml`