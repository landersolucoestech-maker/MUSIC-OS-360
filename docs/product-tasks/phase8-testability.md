# PHASE 8 — Testability Strategy

## What & Why
The system has zero automated tests. For an enterprise-grade multi-tenant ERP with RBAC, state workflows and financial contracts, the absence of tests represents a severe operational risk — any refactoring breaks critical behaviors without warning. This phase implements a test strategy based on risk priority: workflow engine, RBAC, tenant isolation and critical lifecycles first.

## Done looks like
- Test suite runnable via `cd apps/api && npm test` (Jest + @nestjs/testing)
- **Workflow Engine Tests** (`workflow.engine.spec.ts`): tests all valid and invalid transitions for each workflow (releases, contracts, leads, campaigns, tickets), business guards, authorized roles, error on illegal transitions
- **RBAC Tests** (`rbac.service.spec.ts`): complete permission matrix per role — each resource:action tested for each role (8 roles × 16 resources × 6 actions = full coverage); role hierarchy; `assertCan` throws `ForbiddenException` correctly
- **Tenant Isolation Tests** (`tenant-isolation.spec.ts`): guarantees that one tenant's queries do not return another tenant's data; tests TenantGuard with a valid/invalid/missing JWT; tests soft-delete with tenant scope
- **Auth Tests** (`auth.spec.ts`): Clerk JWT validation, claims extraction, guard behavior with an expired/invalid token
- **Domain Event Tests** (`events.spec.ts`): each `DOMAIN_EVENT` has a registered handler, a correct payload, and the expected side effects are called (with mocks)
- **Release Lifecycle Test** (`release-lifecycle.spec.ts`): e2e test of the complete cycle: create a release → transition through all states → verify the audit trail → verify the emitted domain events → verify the notifications
- **Contract Lifecycle Test** (`contract-lifecycle.spec.ts`): create → analysis → signature → in force → terminated; verify invariants at each stage
- **Fixtures and Factories** — `apps/api/src/test/factories/`: `tenantFactory`, `artistFactory`, `releaseFactory`, `contractFactory`, `userFactory` with sensible defaults and override by spread
- **Test Database** — tests use an in-memory PostgreSQL database (or an isolated Docker container) via `TypeORM createConnection` with `dropSchema: true` and a fixture seed
- Minimum coverage documented: workflow engine 90%, RBAC 100%, tenant isolation 85%, critical lifecycles 80%
- CI-ready: `npm test` returns exit code 0 on a clean suite, exit code 1 with failures

## Out of scope
- Frontend tests (React Testing Library)
- Load/performance tests
- End-to-end UI tests (Playwright/Cypress)
- 100% coverage of all modules

## Steps
1. **Configure Jest + @nestjs/testing** — Install the test dependencies: `jest`, `@nestjs/testing`, `supertest`, `@types/jest`. Configure `jest.config.ts` in `apps/api` with paths, transform, coverage thresholds. Create `apps/api/src/test/` with `setup.ts` (test module bootstrap) and a `factories/` folder.
2. **Create fixture factories** — Implement typed factories: `createTenant()`, `createArtist()`, `createRelease()`, `createContract()`, `createUser()`. Each factory accepts partial overrides. Create a `TestDatabaseModule` that uses TypeORM with `synchronize: true` and `dropSchema: true` for test isolation.
3. **Implement RBAC tests** — `rbac.service.spec.ts` with the complete matrix: for each role × resource × action, assert that `can()` returns the expected boolean. A truth table as a constant that serves as executable documentation.
4. **Implement Workflow Engine tests** — `workflow.engine.spec.ts` with parameterized tests for each workflow: valid transitions (correct state + correct role), invalid transitions (wrong state → WorkflowTransitionError), business guards (release without a cover → blocked at review).
5. **Implement Tenant Isolation tests** — `tenant-isolation.spec.ts`: create data in tenant A; queries in the context of tenant B return zero results. Test in all the main modules (artists, releases, contracts, transactions).
6. **Implement lifecycle integration tests** — `release-lifecycle.spec.ts` and `contract-lifecycle.spec.ts`: create an entity, make sequential transitions via `WorkflowService`, verify the final state, verify the emitted events (with `EventsService` in test/mock mode), verify the persisted audit logs.

## Relevant files
- `apps/api/src/core/workflow/` (PHASE 2)
- `apps/api/src/core/rbac/rbac.service.ts`
- `apps/api/src/core/events/events.service.ts`
- `apps/api/src/core/guards/tenant.guard.ts`
- `apps/api/src/database/entities.ts`
- `apps/api/package.json`
