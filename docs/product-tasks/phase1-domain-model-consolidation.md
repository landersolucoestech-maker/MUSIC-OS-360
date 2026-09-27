# FASE 1 — Domain Model Consolidation

## What & Why
Consolidar o modelo de domínio do MUSIC OS 360 eliminando inconsistências entre entidades do backend (TypeORM), enums do pacote `types`, interfaces do frontend e o contrato que os serviços assumem. O sistema tem hoje ~35 entidades com `status: string` livre, dois sistemas de roles desalinhados (SystemRole no enum vs Role string no RBAC service), e ausência de TypeORM relations declaradas — tudo acoplamento frágil que bloqueia o crescimento SaaS enterprise.

## Done looks like
- `packages/types/src/enums.ts` tem enums completos e alinhados com todas as entidades: `ReleaseStatus`, `CampaignStatus`, `BriefingStatus`, `PhonogramStatus`, `ShareStatus`, `UploadStatus`, `IntegrationStatus`, `InvoiceStatus`, `EventStatus`, `EmployeeStatus`, `AIJobStatus`, `TakedownStatus`
- `apps/api/src/database/entities.ts` usa os enums do pacote `types` nas colunas `status` (não `string` livre)
- TypeORM `@ManyToOne` / `@OneToMany` relations declaradas nas entidades principais (Artist → Works, Works → Phonograms, Artist → Releases, Artist → Contracts, etc.)
- `apps/api/src/core/rbac/rbac.service.ts` alinhado com `SystemRole` enum (eliminar discrepância OWNER/FINANCIAL/RADIO/TV vs TENANT_OWNER/VIEWER)
- `packages/types/src/index.ts` re-exporta todos os enums; frontend consome do pacote `@musicos/types` (não de ficheiros locais)
- Soft-delete strategy documentada e uniforme: todas as entidades domain têm `deleted_at`; entidades de log (AuditLog, LeadInteraction, Notification) são imutáveis sem soft-delete
- `apps/api/src/database/schema.ts` atualizado com Zod schemas gerados dos enums para validação de DTOs
- Nenhum `any` introduzido; nenhuma relação de domínio quebrada

## Out of scope
- Migrations de base de dados (coberto em fase separada)
- Implementação de workflow engine (FASE 2)
- Mudanças no frontend além de consumir enums do pacote

## Steps
1. **Auditar e completar enums centrais** — Adicionar ao `packages/types/src/enums.ts` os enums em falta: `ReleaseStatus` (planejamento→distribuido→cancelado), `CampaignStatus`, `BriefingStatus`, `PhonogramStatus`, `ShareStatus`, `UploadStatus`, `IntegrationStatus`, `InvoiceStatus`, `EmployeeStatus`, `AIJobStatus`. Alinhar `SystemRole` com os roles reais do RBAC service.
2. **Tipar entidades com enums** — Em `apps/api/src/database/entities.ts`, substituir `status: string` por `status: ReleaseStatus | CampaignStatus | ...` usando os enums. Manter compatibilidade com TypeORM (usar `enum` type ou `varchar` com check constraint via migração).
3. **Declarar TypeORM relations** — Adicionar `@ManyToOne` / `@OneToMany` / `@OneToOne` nas entidades: Artist→Works, Work→Phonograms, Artist→Releases, Artist→Contracts, Release→Shares, Lead→LeadInteractions, Campaign→Briefings, Employee→PayrollEntries. Usar `@JoinColumn` apenas onde necessário; `@Index` já existente mantido.
4. **Alinhar RBAC com SystemRole** — Refatorar `rbac.service.ts` para usar o enum `SystemRole` do pacote `types`. Mapear: OWNER→TENANT_OWNER, manter ADMIN/MANAGER. Resolver discrepância com FINANCIAL/MARKETING/RADIO/TV (são roles funcionais, não SystemRoles — criar `FunctionalRole` enum separado).
5. **Atualizar Zod schemas do backend** — Em `apps/api/src/database/schema.ts`, gerar schemas Zod a partir dos enums para uso nos DTOs de validação.
6. **Propagar para frontend** — Garantir que os módulos frontend que hoje usam strings literais de status passem a importar os enums de `@musicos/types`. Atualizar re-exports em `packages/types/src/index.ts`.

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
