# PHASE 1 — Domain Model Consolidation

## What & Why
Consolidate the MUSIC OS 360 domain model by eliminating inconsistencies between the backend entities (TypeORM), the enums of the `types` package, the frontend interfaces and the contract the services assume. The system today has ~35 entities with a free-form `status: string`, two misaligned role systems (SystemRole in the enum vs the Role string in the RBAC service), and no declared TypeORM relations — all fragile coupling that blocks enterprise SaaS growth.

## Done looks like
- `packages/types/src/enums.ts` has complete enums aligned with all entities: `ReleaseStatus`, `CampaignStatus`, `BriefingStatus`, `PhonogramStatus`, `ShareStatus`, `UploadStatus`, `IntegrationStatus`, `InvoiceStatus`, `EventStatus`, `EmployeeStatus`, `AIJobStatus`, `TakedownStatus`
- `apps/api/src/database/entities.ts` uses the enums from the `types` package in the `status` columns (not a free-form `string`)
- TypeORM `@ManyToOne` / `@OneToMany` relations declared on the main entities (Artist → Works, Works → Phonograms, Artist → Releases, Artist → Contracts, etc.)
- `apps/api/src/core/rbac/rbac.service.ts` aligned with the `SystemRole` enum (eliminate the OWNER/FINANCIAL/RADIO/TV vs TENANT_OWNER/VIEWER discrepancy)
- `packages/types/src/index.ts` re-exports all enums; the frontend consumes them from the `@musicos/types` package (not from local files)
- Soft-delete strategy documented and uniform: all domain entities have `deleted_at`; log entities (AuditLog, LeadInteraction, Notification) are immutable with no soft-delete
- `apps/api/src/database/schema.ts` updated with Zod schemas generated from the enums for DTO validation
- No `any` introduced; no domain relation broken

## Out of scope
- Database migrations (covered in a separate phase)
- Workflow engine implementation (PHASE 2)
- Frontend changes beyond consuming enums from the package

## Steps
1. **Audit and complete the central enums** — Add the missing enums to `packages/types/src/enums.ts`: `ReleaseStatus` (`planejamento`→`distribuido`→`cancelado`), `CampaignStatus`, `BriefingStatus`, `PhonogramStatus`, `ShareStatus`, `UploadStatus`, `IntegrationStatus`, `InvoiceStatus`, `EmployeeStatus`, `AIJobStatus`. Align `SystemRole` with the real roles of the RBAC service.
2. **Type entities with enums** — In `apps/api/src/database/entities.ts`, replace `status: string` with `status: ReleaseStatus | CampaignStatus | ...` using the enums. Keep compatibility with TypeORM (use the `enum` type or `varchar` with a check constraint via migration).
3. **Declare TypeORM relations** — Add `@ManyToOne` / `@OneToMany` / `@OneToOne` on the entities: Artist→Works, Work→Phonograms, Artist→Releases, Artist→Contracts, Release→Shares, Lead→LeadInteractions, Campaign→Briefings, Employee→PayrollEntries. Use `@JoinColumn` only where necessary; the existing `@Index` is kept.
4. **Align RBAC with SystemRole** — Refactor `rbac.service.ts` to use the `SystemRole` enum from the `types` package. Map: OWNER→TENANT_OWNER, keep ADMIN/MANAGER. Resolve the discrepancy with FINANCIAL/MARKETING/RADIO/TV (they are functional roles, not SystemRoles — create a separate `FunctionalRole` enum).
5. **Update the backend Zod schemas** — In `apps/api/src/database/schema.ts`, generate Zod schemas from the enums for use in the validation DTOs.
6. **Propagate to the frontend** — Ensure that the frontend modules that today use literal status strings import the enums from `@musicos/types` instead. Update the re-exports in `packages/types/src/index.ts`.

## Relevant files
- `packages/types/src/enums.ts`
- `packages/types/src/index.ts`
- `apps/api/src/database/entities.ts`
- `apps/api/src/database/schema.ts`
- `apps/api/src/core/rbac/rbac.service.ts`
- `apps/api/src/core/guards/roles.guard.ts`
- `apps/web/src/shared/types/auth.ts`
- `apps/web/src/modules/releases/types/index.ts`
- `apps/web/src/modules/contracts/types/index.ts`
- `apps/web/src/modules/catalog/types/index.ts`
