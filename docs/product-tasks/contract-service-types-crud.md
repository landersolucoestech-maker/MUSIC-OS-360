# Dynamic Contract Types — eliminate ARTISTA/EMPRESA_SERVICE_LABELS

## What & Why
`ARTISTA_SERVICE_LABELS` and `EMPRESA_SERVICE_LABELS` are hardcoded inside `ContratoFormModal.tsx` (lines 29-51). Adding a new service type requires a code edit instead of administrative configuration. The form conditions the display of financial fields (royalties, fixed amount, advance) on static strings such as `"agenciamento"`, which makes the system fragile and impossible to scale. This task turns contract types into a configurable dynamic entity with an admin CRUD.

## Done looks like
- New `contract_service_types` table in the mock data with the 14 current types migrated as data rows ("Empresariamento", "Gestão", "Agenciamento", "Edição", "Distribuição", "Marketing", "Produção Musical", "Produção Audiovisual", "Licenciamento", "Publicidade", "Parceria", "Shows", "Suporte Financeiro", "Outros")
- Each type has the configurable financial flags: `requires_royalties`, `requires_fixed_value`, `requires_advance`, `requires_financial_support`, `allow_installments`, `financial_model` (`valor_fixo` / `royalties` / `misto` / `recorrente`)
- Each type has `client_types` (array: `artista` | `pessoa_fisica` | `pessoa_juridica`) for the dynamic filter
- Hook `useContractServiceTypes.ts` created with list, create, edit, archive (no deletion if there are linked contracts)
- `ContratoFormModal.tsx` replaces `ARTISTA_SERVICE_LABELS` / `EMPRESA_SERVICE_LABELS` + `getFilteredServiceTypes()` with the hook; the amount fields (royalties %, fixed amount, advance, financial support) are displayed based on the flags of the selected entity — not on hardcoded strings
- The `TemplatesContratos.tsx` page gains two tabs: **Templates** (current content) and **"Tipos de Contrato"** (Contract Types — new CRUD table)
- The "Tipos de Contrato" tab has: a table with columns Name / Client Type / Financial Model / Status / Order / Actions + a create/edit modal with all the fields in the spec + unique-slug validation
- Existing contracts in localStorage keep working — the `tipo` field is preserved; if there is no entry in `contract_service_types` with that slug, the original label is kept as a fallback

## Out of scope
- Automatic generation of financial clauses in templates based on the type (future task)
- Integration with the Accounting module for automatic posting of payments (depends on tasks #37-#40)
- Backend API endpoint for `contract_service_types` (mock data is sufficient in the current phase)
- Permanent deletion — archiving only (active = false)

## Steps
1. **Mock data** — add `contract_service_types` to `buildSeedData()` with the 14 migrated types; patch in `patchMockData()` to inject it if absent; fields: `id`, `name`, `slug`, `description`, `client_types[]`, `financial_model`, `requires_royalties`, `requires_fixed_value`, `requires_advance`, `requires_financial_support`, `allow_installments`, `default_financial_category`, `active`, `sort_order`, `created_at`, `updated_at`
2. **Service** — add `listContractServiceTypes`, `createContractServiceType`, `updateContractServiceType` to `contracts.service.ts` (CRUD operations via `storage`)
3. **Hook** — create `modules/contracts/hooks/useContractServiceTypes.ts` with TanStack Query: lists active ones, filters by `client_type`, create/edit/archive mutations with a sonner toast
4. **Refactor ContratoFormModal** — replace the two hardcoded maps and `getFilteredServiceTypes()` with the hook; the Service Type select now uses the hook's data filtered by `client_type`; the visibility of the financial fields now uses the entity's flags (`selectedType.requires_royalties` etc.) instead of checking strings; keep backward compatibility via a fallback for old types
5. **"Tipos de Contrato" tab in TemplatesContratos.tsx** — wrap the current content in a "Templates" tab; create a second "Tipos de Contrato" tab with a table (Name, Client Type as badges, Financial Model, Status, Order, edit/archive Actions) + a create/edit modal with all the fields in the spec
6. **Modal validations** — slug generated automatically from the name (slugify), manually editable; validate uniqueness on submit; the "Arquivar" (Archive) button is not available if the slug is used in existing contracts (check the mock data)

## Relevant files
- `apps/web/src/modules/contracts/components/ContratoFormModal.tsx:29-51`
- `apps/web/src/modules/contracts/pages/TemplatesContratos.tsx`
- `apps/web/src/modules/contracts/services/contracts.service.ts`
- `apps/web/src/modules/contracts/hooks/useContratos.ts`
- `apps/web/src/shared/data/mockData.ts`
- `apps/web/src/modules/contracts/constants/contract-types.ts`
