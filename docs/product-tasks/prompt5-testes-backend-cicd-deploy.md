# Testes Backend NestJS + CI/CD + Deploy

## What & Why
O backend NestJS em `apps/api/` não tem nenhum ficheiro `.spec.ts`, nenhum setup de Jest, e o CI não tem job de testes para a API. Este prompt adiciona: setup completo de Jest, testes unitários para os serviços críticos (criptografia, artistas, guards, isolamento de tenant), atualização do CI com cobertura mínima de 80%, e dois pipelines de deploy automático (staging via Railway + Vercel, produção via tag Git).

## Done looks like
- `apps/api/jest.config.ts` criado e funcional
- Scripts `test`, `test:watch`, `test:coverage`, `test:e2e` em `apps/api/package.json`
- 4 ficheiros `.spec.ts` criados e a passar: EncryptionService, ArtistsService, ClerkAuthGuard, Tenant Isolation
- `npm run test:coverage` em `apps/api/` alcança ≥ 80% de cobertura
- `.github/workflows/ci.yml` atualizado com jobs `test-api` e `test-web` (com Redis service)
- `.github/workflows/deploy-staging.yml` criado (trigger: push para `staging`)
- `.github/workflows/deploy-production.yml` criado (trigger: push de tag `v*.*.*`)

## Out of scope
- Testes E2E com banco de dados real (usa mocks)
- Configuração das secrets Railway/Vercel/Neon no repositório (responsabilidade do operador)
- Testes para o frontend (apenas infra de CI)

## Steps
1. **Instalar dependências de teste** — Adicionar `jest`, `@types/jest`, `ts-jest`, `supertest` e `@types/supertest` como devDependencies em `apps/api/`. Criar `apps/api/jest.config.ts` com threshold de cobertura 70/75/80/80. Adicionar scripts `test`, `test:watch`, `test:coverage`, `test:e2e` ao `apps/api/package.json`.

2. **Criar teste EncryptionService** — Implementar `encryption.service.spec.ts` com 4 casos: encrypt/decrypt roundtrip, `encryptNullable(null)` → null, `decryptNullable(null)` → null, e dois cifrados do mesmo valor são diferentes (IV aleatório).

3. **Criar teste ArtistsService** — Implementar `artists.service.spec.ts` com mock do Drizzle DB (`DRIZZLE_DB`) e EncryptionService. Verificar: CPF/email cifrados ao criar, filtro `deleted_at IS NULL` na listagem, e soft delete (campo `deleted_at` é Date, não DELETE físico).

4. **Criar teste ClerkAuthGuard** — Implementar `clerk-auth.guard.spec.ts`: rotas marcadas `@Public()` retornam `true` sem verificar token; ausência de token lança `UnauthorizedException`.

5. **Criar teste Tenant Isolation** — Implementar `tenant-isolation.spec.ts` em `modules/artists/`: list só devolve artistas do tenant correto; `findById` e `update` de artista de outro tenant lançam `NotFoundException`.

6. **Atualizar CI** — Substituir `.github/workflows/ci.yml` com os jobs `lint`, `typecheck-api`, `typecheck-web`, `test-api` (com serviço Redis 6379), `test-web`, e `build` que depende de todos os anteriores. O job `test-api` usa `ENCRYPTION_KEY` de 64 zeros, `CLERK_SECRET_KEY: sk_test_placeholder` e `NODE_ENV: test`.

7. **Criar deploy-staging.yml** — Novo workflow acionado em push para branch `staging`: build API, deploy Railway staging (`RAILWAY_TOKEN_STAGING`), run Drizzle migrations com `NEON_STAGING_DIRECT_URL`, deploy frontend Vercel preview, smoke test `GET /api/v1/health`.

8. **Criar deploy-production.yml** — Novo workflow acionado em push de tag `v*.*.*`: build API, deploy Railway production (`RAILWAY_TOKEN_PRODUCTION`), run Drizzle migrations com `NEON_PRODUCTION_DIRECT_URL`, deploy Vercel `--prod`, smoke test, notificar Sentry release.

## Relevant files
- `apps/api/package.json`
- `apps/api/src/core/security/encryption.service.ts`
- `apps/api/src/modules/artists/artists.service.ts`
- `apps/api/src/core/guards/clerk-auth.guard.ts`
- `apps/api/src/database/database.module.ts`
- `.github/workflows/ci.yml`
