# FASE 8 — Estratégia de Testabilidade

## What & Why
O sistema tem zero testes automatizados. Para um ERP enterprise-grade multi-tenant com RBAC, workflows de estado e contratos financeiros, a ausência de testes representa risco operacional severo — qualquer refactoring quebra comportamentos críticos sem alertas. Esta fase implementa a estratégia de testes baseada em prioridade de risco: workflow engine, RBAC, tenant isolation e lifecycles críticos primeiro.

## Done looks like
- Suite de testes executável via `cd apps/api && npm test` (Jest + @nestjs/testing)
- **Workflow Engine Tests** (`workflow.engine.spec.ts`): testa todas as transições válidas e inválidas para cada workflow (releases, contracts, leads, campaigns, tickets), guards de negócio, roles autorizadas, erro em transições ilegais
- **RBAC Tests** (`rbac.service.spec.ts`): matrix completa de permissões por role — cada resource:action testado para cada role (8 roles × 16 resources × 6 actions = cobertura completa); hierarquia de roles; `assertCan` lança `ForbiddenException` corretamente
- **Tenant Isolation Tests** (`tenant-isolation.spec.ts`): garante que queries de um tenant não retornam dados de outro tenant; testa TenantGuard com JWT válido/inválido/ausente; testa soft-delete com tenant scope
- **Auth Tests** (`auth.spec.ts`): validação de JWT Clerk, extração de claims, guard behavior com token expirado/inválido
- **Domain Event Tests** (`events.spec.ts`): cada `DOMAIN_EVENT` tem handler registado, payload correto e side-effects esperados são chamados (com mocks)
- **Release Lifecycle Test** (`release-lifecycle.spec.ts`): teste e2e do ciclo completo: criar release → transitar por todos os estados → verificar audit trail → verificar domain events emitidos → verificar notificações
- **Contract Lifecycle Test** (`contract-lifecycle.spec.ts`): criar → análise → assinatura → vigente → encerrado; verificar invariants em cada etapa
- **Fixtures e Factories** — `apps/api/src/test/factories/`: `tenantFactory`, `artistFactory`, `releaseFactory`, `contractFactory`, `userFactory` com defaults sensatos e override por spread
- **Test Database** — testes usam banco PostgreSQL em memória (ou container Docker isolado) via `TypeORM createConnection` com `dropSchema: true` e seed de fixtures
- Cobertura mínima documentada: workflow engine 90%, RBAC 100%, tenant isolation 85%, lifecycles críticos 80%
- CI-ready: `npm test` retorna código 0 em suite limpa, código 1 com falhas

## Out of scope
- Testes de frontend (React Testing Library)
- Testes de carga/performance
- Testes de UI end-to-end (Playwright/Cypress)
- 100% de cobertura de todos os módulos

## Steps
1. **Configurar Jest + @nestjs/testing** — Instalar dependências de teste: `jest`, `@nestjs/testing`, `supertest`, `@types/jest`. Configurar `jest.config.ts` em `apps/api` com paths, transform, coverage thresholds. Criar `apps/api/src/test/` com `setup.ts` (bootstrap de módulo de teste) e pasta `factories/`.
2. **Criar factories de fixtures** — Implementar factories tipadas: `createTenant()`, `createArtist()`, `createRelease()`, `createContract()`, `createUser()`. Cada factory aceita partial overrides. Criar `TestDatabaseModule` que usa TypeORM com `synchronize: true` e `dropSchema: true` para isolamento de testes.
3. **Implementar RBAC tests** — `rbac.service.spec.ts` com matrix completa: para cada role × resource × action, assertar `can()` retorna o booleano esperado. Tabela de verdade como constante que serve de documentação executável.
4. **Implementar Workflow Engine tests** — `workflow.engine.spec.ts` com testes parametrizados para cada workflow: transições válidas (estado correto + role correta), transições inválidas (estado errado → WorkflowTransitionError), guards de negócio (release sem capa → bloqueada em review).
5. **Implementar Tenant Isolation tests** — `tenant-isolation.spec.ts`: criar dados em tenant A, queries no contexto de tenant B retornam zero resultados. Testar em todos os módulos principais (artists, releases, contracts, transactions).
6. **Implementar lifecycle integration tests** — `release-lifecycle.spec.ts` e `contract-lifecycle.spec.ts`: criar entidade, fazer transições sequenciais via `WorkflowService`, verificar estado final, verificar eventos emitidos (com `EventsService` em modo test/mock), verificar audit logs persistidos.

## Relevant files
- `apps/api/src/core/workflow/` (FASE 2)
- `apps/api/src/core/rbac/rbac.service.ts`
- `apps/api/src/core/events/events.service.ts`
- `apps/api/src/core/guards/tenant.guard.ts`
- `apps/api/src/database/entities.ts`
- `apps/api/package.json`
