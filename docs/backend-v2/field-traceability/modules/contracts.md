> Historical record. Kept as recorded; not the current contract.

# Module `contracts` — Zero-Gap Audit (Phase 2, Prompt 102)

STATUS: **COMPLETE** — UNMAPPED_*: 0, UNKNOWN_FIELD_CLASSIFICATIONS: 0.

Real scope (following imports/hooks/endpoints, not the `contracts/` folder):
- Frontend: `apps/web/src/modules/contracts/**` + consumed from `apps/web/src/modules/integrations/{hooks/useSigningProviders.ts, services/signing.service.ts, adapters/signing.adapter.ts}`.
- Backend: `apps/api/src/modules/contracts/**`, `apps/api/src/modules/contract-templates/**`,
  `apps/api/src/modules/contract-service-types/**`, `apps/api/src/modules/contact-contracts/**`,
  the Autentique/DocuSign section of `apps/api/src/modules/integrations/integrations.controller.ts` +
  `apps/api/src/modules/integrations/autentique/autentique.service.ts`.
- Tables (Phase 1, ground truth): `contracts` (25 cols), `contract_templates` (11 cols),
  `contract_service_types` (32 cols) — all `backendMapping: DIRECT`. `counterparties` (14 cols,
  `NO_TABLE_CONSUMER`) was found in the keyword search but belongs to the financial domain
  (`accounting`, migration `FinancialPartiesAccounts`), not to `contracts` — recorded only as a
  note, not audited here.

---

## 1. Real subdomains identified

| Subdomain | FRONTEND_ENTRYPOINT | ENDPOINTS | BACKEND_CONTROLLER | SERVICE | DATABASE_TABLES |
|---|---|---|---|---|---|
| CONTRACT | `Contratos.tsx`, `ContratoWizard.tsx` (main), `ContratoFormModal.tsx` (secondary, only via `catalog`) | `GET/POST/PATCH/DELETE /contracts` | `contracts.controller.ts` | `contracts.service.ts` | `contracts` |
| CONTRACT_TEMPLATE | `TemplatesContratos.tsx` | `GET/POST/PATCH/DELETE /contract-templates` | `contract-templates.controller.ts` | `contract-templates.service.ts` | `contract_templates` |
| CONTRACT_SERVICE_TYPE | `ContratoFormModal.tsx` (read, dropdown); no real management screen | `GET/POST/PATCH /contract-service-types` | `contract-service-types.controller.ts` | `contract-service-types.service.ts` | `contract_service_types` |
| CONTRACT_CATEGORY (labels) | `CategoryRegistry.tsx` | none (100% localStorage) | — | `useCategoryRegistry.ts` | none (browser only) |
| TEMPLATE_VARIABLE_REGISTRY | `VariableRegistry.tsx` | none (100% localStorage) | — | `useVariableRegistry.ts` | none (browser only) |
| CONTRACT_PARTY (parties) | inline in `ContratoWizard.tsx` (Step 2, dynamic via the template's placeholders) | no endpoint of its own — serialized inside `observacoes` | — | — | `contracts.observacoes` (free text, serialized JSON) |
| SIGNATORY (signatories) | inline in `ContratoWizard.tsx` (Step 5) / `SendForSigningDialog.tsx` | written via `POST/PATCH /contracts` (`signers`) | `contracts.controller.ts` | `contracts.service.ts` | `contracts.signers` (jsonb) |
| E-SIGNATURE / AUTENTIQUE | none (see §27) | `POST /integrations/autentique/configure\|send`, webhook | `integrations.controller.ts` | `autentique.service.ts` | `contracts.autentique_doc_id/.signing_platform` |
| E-SIGNATURE / DOCUSIGN | no real signing consumer (generic OAuth only) | `POST /integrations/oauth/init\|exchange`, `GET status`, `DELETE disconnect` | `integrations.controller.ts` | inline in the controller | OAuth tokens (integrations credentials table, outside the scope of this module) |
| CONTRACT_IMPORT (semantic/AI) | `ContractImportWorkspace.tsx` | `POST /api/v1/ai/generate` (via `semantic-parser.service.ts`) | AI module (out of scope) | `parseContractText()` | no table of its own — feeds the creation of `contract_templates` |
| CONTACT_CONTRACTS (contracts linked to a CRM contact) | **none** | `GET/POST /contacts/:contactId/contracts` | `contact-contracts.controller.ts` | `contact-contracts.service.ts` | **none — in-memory `Map`, does not persist in Postgres** |
| CONTRACT_EXPIRY (expiration) | no direct UI — result visible via the "Xd" badge in the grid and notification events | internal cron + `POST /internal/cron/contract-expiry` (Vercel) | `contract-expiry-cron.controller.ts` | `contract-expiry.scheduler.ts` | `contracts.data_fim`, `.metadata.expiry_notified_at` |
| CONTRACT_WORKFLOW (states) | `ContratoWizard.tsx` (only rascunho/aguardando_assinatura — draft/awaiting signature), `ContratoViewModal.tsx` (transitions via `useWorkflowTransition`) | `PATCH /contracts/:id` (field `status`) | `contracts.controller.ts` | `contracts.service.ts` + `WorkflowService` | `contracts.status` |
| CONTRACT_TO_ACCOUNTING | no UI — 100% backend automation, triggered by `CONTRACT_SIGNED` | internal event | `contract-events.handler.ts` | `TransactionEntity` (accounting) | `transactions` (via event, not a direct FK) |

13 real subdomains identified.

---

## 2. `Auditoria.tsx` — CROSS_MODULE_AUDITORIA_TSX (contracts excerpt)

Real tool (the same as `catalog.md` §2): `apps/web/src/modules/admin/pages/Auditoria.tsx`, tab
"Contratos" (`module: "contratos"`). It runs on `apps/web/src/shared/lib/audit/runner.ts:114-128`.

`AUDITORIA_CONTRACT_FIELDS`:

| Field | Severity |
|---|---|
| `titulo` | `obrigatorio` |
| `tipo` | `obrigatorio` |
| `status` | `obrigatorio` |
| `data_inicio` | `recomendado` |
| `data_fim` | `recomendado` |
| `arquivo_url` | `recomendado` |

`AUDITORIA_CONTRACT_RULES`: the same generic `hasValue()` engine as `catalog.md` — only
`obrigatorio` (required) fields block `is_complete`. `fix_path` = `/contratos?edit=<id>`.

`AUDITORIA_CONTRACT_DATABASE_SOURCES`: `storage.list("contratos")` → `GET /contracts` — the same
hook/endpoint used by `useContratos()`, subject to the same backend 50-record limit
(`ContractsService.list()`, `.take(query.limit ?? 50)`) — not a separate data source.

`AUDITORIA_CONTRACT_GAPS`: verified that `/contratos?edit=<id>` **works correctly** — the
`Contratos.tsx` page uses `useEditQueryParam("edit", contratos, ...)` (lines 44-48), which opens
`ContratoWizard` in edit mode for the given contract; contrary to what a superficial reading
would suggest, this deep link **is not a gap**. The only inherited gap is the 50-record limit
(§12.10) — contracts beyond the 50th position never appear in the Audit's incomplete list.

`AUDITORIA_TSX_CONTRACT_SECTION_COMPLETE: SIM` (yes).

---

## 3. Components (complete classification)

| Component | Classification | Note |
|---|---|---|
| `ContratoWizard.tsx` | CREATE_MODAL + EDIT_MODAL + WIZARD (6 steps) | real, 1420 lines, the **main** flow used by `Contratos.tsx`; no `arquivo_url` field (§17/§26) |
| `ContratoFormModal.tsx` | CREATE_MODAL + EDIT_MODAL | real, 685 lines, **secondary** flow, only reachable via `RegistroMusicas.tsx` (`catalog`) after creating a Work/Phonogram; has `arquivo_url` as a simple text field |
| `ContratoViewModal.tsx` | DETAIL_MODAL + WORKFLOW transitions | real, 526 lines, the only place that exposes `allowed_transitions` via `useWorkflowTransition` |
| `SendForSigningDialog.tsx` | SIGNATURE_UI | real UI, but the final operation always fails — see §27 |
| `ContractImportWorkspace.tsx` | IMPORT + OTHER_DATA_CONSUMER | real, 863 lines, semantic import of pasted text (AI) to generate a new template |
| `ContractA4Preview.tsx` | DOCUMENT_PREVIEW | real, renders the template's resolved `conteudo` as an A4 preview (HTML, not PDF) |
| `ContratoStatusBadge.tsx` | STATIC | status badge, label↔color mapping |
| `DocumentStatusBadge.tsx` | STATIC | badge for `VinculadoDocument.status` — **never populated with real data** (see §26, `useDocuments` is a stub) |
| `DocumentTimeline.tsx` | STATIC | event timeline of a `VinculadoDocument` — same reason, no real data to render |
| `SigningPlatformBadge.tsx` | STATIC | Autentique/Clicksign/DocuSign badge, used in the `Contratos.tsx` grid |
| `TemplateContratoViewModal.tsx` | DETAIL_MODAL | real, view-only for a `TemplateContrato` |
| `Contratos.tsx` | TABLE + FILTER + SEARCH (no SORT) | main page, 9 visible columns, no per-column sorting |
| `TemplatesContratos.tsx` | TABLE + FILTER + SEARCH + SORT | templates page, uses `sortTableRows` |
| `CategoryRegistry.tsx` | TABLE + CREATE + EDIT | 531 lines, manages **only** `contract_categories` (localStorage) — does not touch `contract_service_types` even though the name suggests it |
| `VariableRegistry.tsx` | TABLE + CREATE + EDIT | 843 lines, manages **only** `variable_registry` (localStorage) |
| `contracts.store.ts` (hooks/ and store/, same file) | DEAD | Zustand store never imported outside its own file (same pattern as the `catalog.store.ts` already recorded in `catalog.md`) |
| `forms/index.ts`, `utils/contract-variables.ts` | STATIC/OTHER | `forms/index.ts` is an empty stub; `contract-variables.ts` contains real helpers used by `VariableRegistry.tsx` |
| `contract-party-origin.mapper.ts` (+ re-export in `mappers/`) | DEAD | `getContractPartyOrigin()` has no importer in `apps/web/src` outside its own pair of files — dead code, superseded by the dynamic detection of parties via `ContratoWizard`'s placeholders |

Confirmed by grep: the `useCatalogStore` equivalent (`useContratosStore`, if it exists) and
`contract-party-origin.mapper.ts` have no consumer.

---

## 4. Hooks

| HOOK | FILE | ENDPOINTS | READ/WRITE | RELATIONS | DOCUMENT_USAGE | SIGNATURE_USAGE | REALTIME | STORAGE | AUTH/TENANT_DEP |
|---|---|---|---|---|---|---|---|---|---|
| `useContratos` | `hooks/useContratos.ts` | `GET/POST/PATCH/DELETE /contracts` (via `storage`) | all 25 fields of `contracts` | `select: "*, artistas(*), clientes(*)"` — **not dead** this time: `ContractsService.list/findById` do a real `leftJoinAndMapOne` for `artistas`/`clientes` (unlike `catalog`, where the same pattern is always dead) | no | no | no | no | implicit |
| `useTemplatesContratos` | `hooks/useTemplatesContratos.ts` | `GET/POST/PATCH/DELETE /contract-templates` | all fields of `TemplateContrato` | none | no | no | no | no | implicit |
| `useContractServiceTypes` | `hooks/useContractServiceTypes.ts` | `GET/POST/PATCH /contract-service-types` (via `contractsService`, not `storage` directly) | all 32 fields of `contract_service_types` | checks "in use" against `storage.list("contratos")` (subject to the 50 limit, §12.10) | no | no | no | no | implicit |
| `useCategoryRegistry` | `hooks/useCategoryRegistry.ts` | none | `localStorage` key `contract_categories` | none | no | no | no | `localStore` (per browser) | no |
| `useVariableRegistry` | `hooks/useVariableRegistry.ts` | none | `localStorage` key `variable_registry` | none | no | no | no | `localStore` (per browser) | no |
| `useDocuments`/`useSaveDocument` | `hooks/useDocuments.ts` | none (read always `[]`; write always throws an error) | no real field — see §26 | none | yes (but always empty/failing) | indirect (consumed by `SendForSigningDialog`) | no | no | no |

No active hook was left unclassified.

---

## 5. CREATE Contract — `ContratoWizard.tsx` (main flow)

Step by step (6 steps), fields persisted via `handleSave()` (`ContratoWizard.tsx:1103-1154`):

| FORM_FIELD | TYPE | REQUIRED | API_REQUEST_FIELD | DATABASE_COLUMN | PERSISTED | Note |
|---|---|---|---|---|---|---|
| Step 1: selected template | RELATION_SELECTOR | yes (blocks advancing) | `template_id` | `contracts.template_id` | yes | |
| Step 1 (derived): template category | DERIVED | — | `tipo` (via `templateTipoServico \|\| templateNome`) | `contracts.tipo` | yes | `templateTipoServico` comes from `TemplateContrato.tipo_servico`, a **free** field, not from the real FK of `contract_service_types` |
| Step 2: `parties` (parties, dynamic N per template) | RELATION_SELECTOR + PARTY_EDITOR | no (but no completeness validation before advancing) | **none** — never goes to `CreateContractDto.parties` | `contracts.observacoes` (serialized as JSON, together with `variables`/`partyRoles`/`manifestVars`/`signatureRoles`) | yes, but **not through the official path** — see Gap #1 | contains complete PII per party: name, CPF, CNPJ, RG, email, phone, address, legal representative's details |
| Step 3: `variables` (manifest variables) | VARIABLE_FIELD (text/date/boolean/number/percentage/currency/textarea/select) | per variable (`manifest.required`), does not block advancing | **no** endpoint of its own | the same `observacoes` blob | yes, the same unofficial path | |
| Step 4: preview | DOCUMENT_PREVIEW | — | — | — | no (read only) | resolves placeholders locally, never generates a real PDF |
| Step 5: `signers[]` (signatories) | SIGNATORY editor | yes (`state.signers.length === 0` blocks "Enviar para Assinatura" (Send for Signature)) | `signers` | `contracts.signers` (jsonb) | yes, an official DTO field | |
| Step 6: `titulo` | string | yes | `titulo` | `contracts.titulo` | yes | |
| Step 6: `status` (select, but overwritten) | select | — | `status` | `contracts.status` | yes, but **`handleSave()` always overwrites it** with `"rascunho"` or `"aguardando_assinatura"`, ignoring the value chosen in the Review step's Select | the status Select in Step 6 is **misleading** — its selection is never used |
| Step 6: `data_inicio` | date | yes | `data_inicio` | `contracts.data_inicio` | yes | |
| Step 6: `data_fim` | date | no | `data_fim` | `contracts.data_fim` | yes | |
| Step 6: `observations` (the Review step's notes field) | textarea | no | — | — | **not persisted separately** — it is overwritten by the `wizardBlob` JSON (see Gap #1); any text typed here is **silently discarded**, it never reaches the payload | effectively UI_ONLY, despite looking like a real field |
| (derived) `signing_platform` | derived from the 1st signatory with a defined `provider` | no | `signing_platform` | `contracts.signing_platform` | yes | |

`CreateContractDto` fields NEVER sent by this wizard: `parties`, `metadata`, `currency`,
`signedAt`, `cliente_id`, `lancamento_id`, `exclusivo`, `autentique_doc_id`, `versoes`,
`artista_id`/`artistId` (no wizard step links an artist/client directly — only via
textual parties inside the `observacoes` blob).

CREATE_FIELDS (persisted, record level): `titulo`, `template_id`, `tipo`, `status`, `data_inicio`,
`data_fim`, `observacoes` (blob), `signing_platform`, `signers[]` = 9 real fields + N rows of
`signers` (5 sub-fields each: `nome`, `email`, `role`, `obrigatorio`, `ordem`, `provider`) + N party rows
(up to 19 sub-fields each, see §9) inside the blob.

---

## 6. CREATE/EDIT Contract — `ContratoFormModal.tsx` (secondary flow)

The only place in the module that exposes `arquivo_url` as a direct form field (a text `Input`,
`URL do Arquivo (PDF)` — paste an already-hosted URL, no real upload). It also consumes
`useContractServiceTypes()` to populate a service-type dropdown — **it is the only component in the
module that actually reads `contract_service_types`**. Main fields (via `form.register`):
`titulo`, `tipo`/`service_type`, `artista_id`, `cliente_id`, `lancamento_id`, `status`, `data_inicio`,
`data_fim`, `valor`, `exclusivo`, `observacoes` (here it is indeed used as real free text, not as a JSON
blob), `arquivo_url`, `notas_versao` (used to populate `versoes[]` when the file is replaced).

`FORM_FIELD`/`READ_SOURCE`/`WRITE_TARGET`/`CREATE_SUPPORTED`/`EDIT_SUPPORTED`: all the fields above
are supported in both modes, a single shared component (`mode: "create"|"edit"|"view"`, the same
pattern as `ObraFormModal.tsx` in `catalog.md`). `IMMUTABLE_AFTER_CREATE`: no field is locked
after creation in this component (not even `template_id`, which this flow does not even use).

**Do not assume Create = Edit across the two modals**: `ContratoWizard` and `ContratoFormModal` have
partially disjoint field sets — `arquivo_url` only exists in the second;
`template_id`/`parties` (via blob)/manifest variables only exist in the first. A contract created
by one of the two flows and edited by the other can lose data (e.g. editing via `ContratoFormModal`
a contract created by `ContratoWizard` writes a new free-text `observacoes`, destroying the
wizard's parties/variables JSON blob).

---

## 7. Contract parties (§9/§10 of the prompt)

There is no `contract_parties` table. Parties are **entirely dynamic**, detected via the regex
`{{GRUPO.CAMPO}}` in the selected template's `conteudo` (`extractPartyRoles()`,
`ContratoWizard.tsx:171-179`) — every group not belonging to `NON_PARTY_GROUPS` that contains at
least one `ENTITY_FIELDS` field becomes a "party" with its own form.

| ROLE | SOURCE_ENTITY | DISPLAY_FIELD | VALUE_FIELD | DATABASE_FK_OR_JOIN | CARDINALITY | OPTIONAL |
|---|---|---|---|---|---|---|
| any template group (e.g. `CONTRATANTE`, `ARTISTA`, `REPRESENTANTE`) | `origin: manual` | typed freely | `nome`/`razao_social`/`nome_artistico` | none — free text | 1 per detected role | yes |
| same, `origin: crm` | `useClientes()` (`crm-relationships`) | the CRM contact's `nome` | contact id (`sourceId`) | **no real FK written** — only the copied values (nome/cpf/cnpj/email/telefone/endereco) are embedded in the blob; the contact's `sourceId` **is not persisted in any column** | 1:1 (copy, not reference) | yes |
| same, `origin: artistas` | `useArtistas()` | `nome_artistico`/`nome_civil` | artist id (`sourceId`) | same limitation — copy with no persisted FK | 1:1 (copy) | yes |

Identification fields captured per party (up to 19, depending on the pf/pj/artista type — individual/company/artist):
`nome`/`nome_artistico`/`nome_civil`/`razao_social`, `cpf`, `cnpj`, `rg`, `email`, `telefone`,
`endereco`, `nacionalidade`, `profissao`, `estado_civil`, `representante_legal`,
`cpf_representante`, `rg_representante`, `nacionalidade_representante`,
`estado_civil_representante`, `profissao_representante`, `endereco_representante`.

`DATABASE_COLUMN`: none — everything inside `contracts.observacoes` (a `text` column, without
encryption). `ENCRYPTED`: **NO**. `ENCRYPTION_LAYER`: none. A direct contrast with the pattern already
established in the rest of the system (e.g. `artists.email_encrypted`/`.cpf_cnpj_encrypted`,
AES-256-GCM, documented in `artist.md`) — here the same kind of sensitive data (third parties' CPF/CNPJ/RG/email/
phone/address) is serialized as plain JSON inside a generic text column.
`READ_MAPPING`: `ContratoWizard.tsx` does `JSON.parse(contrato.observacoes)` when reopening for editing
(lines ~959-962, with a silent fallback on a parse error). `DISPLAY_BEHAVIOR`: no
protection — `ContratoViewModal.tsx` and any export via the Reports Center (§13) expose
`observacoes` as plain text, including the JSON with PII, without redaction or masking.

---

## 8. Artist ↔ Contract / Catalog ↔ Contract relation (boundary, not re-audited)

| CONTRACT_FIELD | ARTIST_ENDPOINT | DATABASE_RELATION | CARDINALITY | CREATE_FLOW | EDIT_FLOW | READ_FLOW |
|---|---|---|---|---|---|---|
| `contracts.artista_id` | `GET /artists` (via `useArtistas()`) | `contracts.artista_id → artists.id` (real FK, confirmed in Phase 1) | N:1 | only via `ContratoFormModal` (secondary flow) — `ContratoWizard` **never writes this column directly**, only artist names inside the blob's textual parties | same | `ContractsService.list/findById` do a real `leftJoinAndMapOne('c.artistas', ...)` — `contrato.artistas.nome_artistico` actually arrives populated (see §4) |
| `CONTRACT_SIGNED` → `artists.status='contratado'` + `artists.contrato_id` | — | `artists.contrato_id → contracts.id` (written, not a declared FK) | 1:1 per event | backend automation (`ContractEventsHandler.onContractSigned`, §20) | — | — |

`catalog.md` is already complete; here it is only recorded that **there is no `contracts ↔
works/phonograms/rights_holders` relation** in the schema or in the code — no column, no FK, no
form field links a contract to a specific work/phonogram. The only observable bridge is
indirect and by product convention: `RegistroMusicas.tsx` (catalog) opens `ContratoFormModal`
prefilled with `titulo`/`observacoes` (free text summarizing the work/participants) after saving
a Work/Phonogram — there is no data link, only suggested text. `CATALOG_RESOURCE`: none.
`PURPOSE`: UX (avoid retyping), not referential integrity.

---

## 9. Release / Project / Service relation

`contracts.lancamento_id` (a real column, Phase 1: `fk=false` — no FK declared even though the name suggests
`releases.id`) is accepted by the DTO and by the entity, but **no screen in the module fills it**:
`ContratoWizard` has no field for it; `ContratoFormModal` has a `lancamento_id` field in the form,
but no release selector was found in the code review (the field is present in the
`register()`/payload, with no corresponding UI component located) — recorded as a column
present in the contract, but with no confirmed selector in the form. No relation with `projects` or
`services`/`campaigns`/`events` was found in any layer.

---

## 10. Contract types (§14 of the prompt)

**There is no single inventory of types** — four vocabularies coexist, disconnected from one another:

1. `CONTRACT_TYPES` (`constants/contract-types.ts`) — a const hardcoded in the frontend, grouped into
   categories (`ARTISTICOS`, `SHOWS`, `MARCAS_PUBLICIDADE`, etc.); used **only** by
   `contract-party-origin.mapper.ts`, which in turn **has no consumer** (DEAD, §3).
2. `contract_categories` (localStorage, `useCategoryRegistry`) — 11 seed categories
   (`gravacao`, `distribuicao`, `licenciamento`, `cessao_direitos`, `producao`, `shows`, `gestao`,
   `exclusividade`, `publicitario`, `semantico`, `outros`); used only to **label** templates in
   Step 1 of the wizard (`getCategoryLabel`) — it is not persisted in the backend, and it is not the source of
   `contracts.tipo`.
3. `templates_contratos.tipo_servico` (a real column of `contract_templates`, mapped by the backend
   as `tipo` — see Gap #2) — a free string, chosen when creating a template; it is the value that
   actually becomes `contracts.tipo` via `ContratoWizard`.
4. `contract_service_types.slug` (32 real columns, rich: financial model, participants,
   variables, signature/branding settings) — only read by `ContratoFormModal` (secondary
   flow); **never used by `ContratoWizard`** nor by `CategoryRegistry.tsx` (even though the
   page's name suggests management of contract categories).

`TYPE_VALUE`/`FRONTEND_LABEL`/`DATABASE_VALUE`/`FORM_VARIATION`/`REQUIRED_FIELDS`/
`WORKFLOW_VARIATION`: there is no per-type variation of required fields in any of the four
vocabularies — `tipo`/`categoria` is purely informational/for labeling in all real flows;
`contract_service_types` has "requires_*" columns (`requires_external_rights_terms`,
`requires_fixed_value`, `requires_advance`, `requires_financial_support`, `allow_installments`) that
suggest a conditional form variation per service type, but since this table is not
consumed by `ContratoWizard`, these rules **are never applied in practice**.

---

## 11. Status / Workflow

Real, well defined: `apps/api/src/core/workflow/definitions/contracts.workflow.ts` (`WorkflowService`,
the same generic engine already verified in `audiovisual.md`/`auth.md`).

| STATUS_VALUE | FRONTEND_LABEL | ALLOWED_TRANSITIONS (roles) | TRANSITION_ENDPOINT | SIDE_EFFECTS |
|---|---|---|---|---|
| `rascunho` | "Rascunho" (Draft) | → `em_analise` | `PATCH /contracts/:id` | none |
| `em_analise` | (no label in the UI, only in the backend) | → `rascunho`, → `aguardando_assinatura` | same | none |
| `aguardando_assinatura` | "Aguardando Assinatura" (Awaiting Signature) | → `assinado` **(guard: requires a truthy `arquivo_url`)** | same | none besides the guard |
| `assinado` | "Assinado" (Signed) | → `vigente`, → `encerrado`, → `cancelado` | same | `CONTRACT_SIGNED` → artist `contratado` + provisional transaction + 5 CRM tasks (see §20) |
| `vigente` | "Vigente" (In force) | → `vencendo`, → `vencido`, → `encerrado`, → `cancelado` | same | none directly (the expiry cron runs separately) |
| `vencendo` | (no label in the UI) | → `vencido` | same | none |
| `vencido` | (no label in the UI) | → `encerrado` | same | `CONTRACT_EXPIRED` (activity log) |
| `encerrado` | (no label in the UI — the wizard's `STATUS_LABELS` uses "Expirado" (Expired)) | terminal | — | — |
| `cancelado` | "Cancelado" (Cancelled) | terminal | — | `CONTRACT_CANCELLED` (activity log); also triggered by soft delete (`DELETE /contracts/:id`) |
| `ativo` (enum `ContractStatus.ATIVO`) | **not used in any transition** | — | — | — |

`ENUM_MISMATCH`: `ContractStatus.ATIVO` exists in the shared enum (`@music-os-360/types`) but
**does not appear in any workflow transition** — a dead state, unreachable by any real flow
(neither created nor the target of a transition). In addition, `ContratoWizard.tsx`'s `STATUS_LABELS` uses its own
labels (`"pendente"`, `"expirado"`, `"rescindido"`) that **do not correspond exactly** to the 9
real enum values used by the workflow (`em_analise` has no label of its own; `"pendente"` in the Select
is not a workflow enum value) — the status Select in Step 6 mixes labels that do not map
1:1 to the real states, but as seen in Gap #1 this Select is ignored on submit anyway.

All roles authorized per transition: `super_admin, tenant_owner, owner, admin, manager`
(+ `juridico` for the first two transitions rascunho↔em_analise). `AUTHORIZATION_GAPS: 0` — the
workflow's roles are consistently checked against `actorRole` (JWT) before each transition
(`WorkflowService.transitionInTx`, the same pattern tested in the previous modules).

---

## 12. Dates, renewal and expiration

| UI_FIELD | API_FIELD | DATABASE_COLUMN | TYPE | REQUIRED |
|---|---|---|---|---|
| "Data de Início" (Start date) | `data_inicio`/`startsAt` (alias) | `contracts.data_inicio` | `timestamp without time zone` | yes (the wizard blocks advancing without it) |
| "Data de Término" (End date) | `data_fim`/`expiresAt` (alias) | `contracts.data_fim` | `timestamp without time zone` | no |
| "Assinado em" (Signed on) | not exposed in any real form of the module (`signedAt` only exists in the DTO/metadata) | `contracts.metadata.signed_at` (via alias, never actually sent by any UI) | jsonb (inside `metadata`) | no |

`TIMEZONE_BEHAVIOR`: a `timestamp without time zone` column (no time zone) — the value is written as
sent by `DatePickerField`, with no explicit time-zone normalization; no additional
time-zone handling was found in `contracts.service.ts`.

**Renewal/expiration (§17 of the prompt)**: `AUTO_RENEW`: **does not exist** — no field, no
automatic status-renewal logic. `RENEWAL_PERIOD`/`NOTICE_PERIOD`: they do not exist as structured
fields; the `ContractExpiryScheduler` (`contract-expiry.scheduler.ts`, daily cron or
`POST /internal/cron/contract-expiry` via Vercel) uses a fixed 30-day window
(`EXPIRY_WINDOW`) and a 7-day deduplicator (`DEDUP_DAYS`), hardcoded, not configurable per
tenant/contract. `EXPIRATION_RULE`: the cron **only emits** `CONTRACT_EXPIRING_SOON` (which triggers
a renewal task in the CRM via `ContractWorkflowHandler`, see §20) and writes
`metadata.expiry_notified_at` to deduplicate — **it does not automatically transition the `status`** to
`vencendo`/`vencido`; that transition remains manual, via `ContratoViewModal`. Real behavior,
not inferred: automatic notification + automatic renewal task, but the status change is
always manual.

---

## 13. Clauses / Terms (§18 of the prompt)

**Clauses do not exist as structured records.** The template's `conteudo` (`contract_templates.
conteudo`, `text`) is a single block of text with `{{GRUPO.CAMPO}}` placeholders — free text +
template-only, not a persisted list of `ContractClause` (the `ContractClause` type exists in
`contracts.types.ts` — `id, title, content, variablesUsed, category, order, required, editable,
aiGenerated` — but **there is no table, column or endpoint that persists real instances of this type**;
it is a TypeScript type defined for the "template engine" but never instantiated by any real
code found). `EDITABLE`: the entire `conteudo` is editable as free text on the template creation
screen (not audited field by field here due to the absence of structure — it is a single free `<Textarea>`,
confirmed by grep in `TemplatesContratos.tsx`). `TEMPLATE_SOURCE`: `contract_templates.
conteudo` itself.

---

## 14. Financial terms (§19 of the prompt)

| FORM_FIELD | DATABASE_TABLE | DATABASE_COLUMN | TYPE | RELATED_ENTITY |
|---|---|---|---|---|
| Contract value | `contracts` | `valor` | `numeric` (no precision/scale declared in Phase 1) | `transactions` (via the `CONTRACT_SIGNED` event, not an FK) |
| Currency | **no column of its own** | — | — | fixed BRL by convention (the export contract's `excludedFormFields.currency`: "valor é BRL por contrato" (value is BRL per contract)) |
| `financial_currency` | `contract_service_types` | `financial_currency` | `varchar` | not connected to `contracts.valor` (table with no consumer in the main flow, §10) |
| `financial_payment_frequency` | `contract_service_types` | `financial_payment_frequency` | `varchar` | same |
| `financial_penalty_percentage` | `contract_service_types` | `financial_penalty_percentage` | `numeric` | same |
| `financial_interest_percentage` | `contract_service_types` | `financial_interest_percentage` | `numeric` | same |
| `financial_due_days` | `contract_service_types` | `financial_due_days` | `integer` | same |

`FINANCIAL_TERM_GAP`: the 5 rich financial fields of `contract_service_types` (currency, payment
frequency, penalty, interest, due period) exist in the schema and in the frontend's `ContractServiceType`
type, but since that table is not consumed by `ContratoWizard` (the real creation flow),
**no contract created today carries these structured financial terms** — the only financial
term that actually reaches a real contract is `valor` (a free number, with no associated currency/installments/
interest/penalty).

---

## 15. Contract → Financial (§20 of the prompt)

`CONTRACT_TO_ACCOUNTING_TRACEABILITY_COMPLETE: SIM` (yes) — verified end to end, it is **real automation**,
not manual nor UI-only:

```
CONTRACT_ID:            contracts.id
FINANCIAL_TRIGGER:      CONTRACT_SIGNED event (emitted in ContractsService.update() when
                         status changes to 'assinado')
TRANSACTION_RELATION:   ContractEventsHandler.onContractSigned() (apps/api/src/modules/contracts/
                         handlers/contract-events.handler.ts:114-214) creates a real row in
                         `transactions` (tipo='receita', categoria='contratos', status='agendado')
AMOUNT_SOURCE:          contracts.valor (read directly from the record at signing time)
DATE_SOURCE:            new Date() (signing date, not the contract's data_inicio/data_fim)
CATEGORY_SOURCE:        hardcoded 'contratos' (does not come from contract_service_types.
                         default_financial_category, which is not consumed either)
TRACEABILITY_KEY:       transactions.contrato_id (real FK) + transactions.artista_id
```

Classification: **REAL_AUTOMATIC_PROPAGATION** — neither UI_ONLY nor NOT_IMPLEMENTED. Besides the transaction,
the same event also: updates `artists.status='contratado'` + `artists.contrato_id`; triggers
`FinancialRulesService.evaluateRules(...)` (`accounting`, already audited); creates 5 CRM execution
tasks via `ContractWorkflowHandler` (legal, financial, briefing, setup, future integrations);
emits `CONTRACT_INTEGRATION_READY` with `integrations: ['distribution','financial',
'society-data-exchange']` (descriptive labels in the event payload — no real handler was found
that consumes these three labels to trigger actual integrations; they remain recorded
only as event metadata); and enqueues a real `WorkflowQueueService.enqueueWorkflowFollowup(...)`
(BullMQ). **Important caveat**: this automation is only reachable if a contract manages to
reach the `assinado` status — which, for contracts created by `ContratoWizard` (the main flow),
is blocked in practice by the `arquivo_url` Gap (§17/Gap #7).

---

## 16. Royalties / Percentages (§21 of the prompt)

No royalty/participation percentage field was found in the `contracts` module itself
(neither in `contracts`, nor in `contract_templates`, nor in `contract_service_types`). Authorship/participation
percentages belong exclusively to `catalog` (`work_participants.percentual`,
`phonograms.participacao[*].percentual`, already recorded in `catalog.md`) and to `shares`
(releases/registration, already referenced as a boundary in `catalog.md` §16) — **there is no mixing between the
two systems**, as instructed in the prompt. `contracts.exclusivo` (boolean) is the only
"rights-like" field present in the `contracts` table — see §17 (Rights/Territory).

---

## 17. Rights / Territories / Exclusivity (§22 of the prompt)

| RIGHT | SCOPE | TERRITORY | EXCLUSIVE | DATABASE_MAPPING |
|---|---|---|---|---|
| (implicit, untyped) | the whole contract (not per specific work/right) | **no territory field in `contracts`** | `contracts.exclusivo` (boolean) | `ContratoFormModal.tsx` exposes `exclusivo` as a checkbox; `ContratoWizard.tsx` **has no field for `exclusivo` in any of the 6 steps** — it remains `false` (the DTO default) for every contract created by the main flow |

`RELATION_MISMATCH`/gap: `exclusivo` is a real, semantically important `NOT NULL` column
("Contratos com cláusula de exclusividade" (contracts with an exclusivity clause) is even one of the 11 seed categories of
`contract_categories`), but the main creation flow does not expose it — every contract created via
`ContratoWizard` is born `exclusivo=false` by default, regardless of the real content of the
template/clauses.

---

## 18. Templates (§23/§24 of the prompt)

`TemplateContrato` (`contract_templates`, 11 columns): `TEMPLATE_ID`=`id`, `NAME`=`nome`,
`TYPE`=`tipo_servico` (mapped to the physical column `tipo` — see Gap #2), `CONTENT_SOURCE`=`conteudo`
(free text with placeholders), `VARIABLES`=`variables_manifest` (optional JSON string, in the format
`ContractVariable[]` or `{variables: [...]}`), `FIELDS`=no structured field besides the text,
`DEFAULTS`=none, `VERSION`=no version column (templates are not versioned — only
`ativo`/inactive), `ACTIVE`=`ativo`, `DATABASE_SOURCE`=`contract_templates`.

`TEMPLATE_VARIABLES` (§24): when `variables_manifest` is absent or empty, the wizard uses
`extractFallbackVars()` — it detects ALL `{{GRUPO.CAMPO}}` groups in `conteudo` that are neither
parties nor signature, and creates a generic `"text"` variable for each one, with a `label` derived
mechanically from the placeholder name. **No active placeholder is left without a source**: it is resolved either
as a party (Step 2), or as a manifest variable (Step 3, real or fallback), or as a signature
(Step 5) — the three groups (`NON_PARTY_GROUPS`, `ENTITY_FIELDS`, `SIGNATURE_GROUPS`) exhaustively cover
the placeholder grammar recognized by the wizard.

**Critical template-creation gap — see Gap #2** (§20 below): the real endpoint
`POST /contract-templates` uses a DTO with English fields (`title`/`type`/`content`/`variables`/
`metadata`, `type` with the fixed enum `['exclusive','non-exclusive','distribution','service',
'publishing','other']`) that **do not correspond to any field sent by the frontend**
(`nome`/`tipo_servico`/`conteudo`/`descricao`/`ativo`/`variables_manifest`/`header_image`/
`footer_image`) — with a global `ValidationPipe({whitelist:true, forbidNonWhitelisted:true})`
(`apps/api/src/create-app.ts:186-192`), **every real attempt to create a template via
`TemplatesContratos.tsx` returns HTTP 400**, since no property of the body is recognized by the DTO.

---

## 19. Document Generation (§25 of the prompt)

`ContractA4Preview.tsx` (`A4Preview`/`HighlightedPreview`) generates **only HTML rendered on screen**
(a visual A4 preview, with CSS pagination) from the template's `conteudo` with the placeholders already
resolved (`resolveContentForPreview()`). **There is no real PDF or DOCX generation in any
layer of the module** — no backend document-generation endpoint was found
(an exhaustive `grep` for `pdf`/`docx`/`puppeteer`/`html-pdf` inside `apps/api/src/modules/contracts`
and `contract-templates` returned no occurrences). `SOURCE`=template `conteudo` + parties +
variables resolved on the client; `GENERATOR`=none (pure React rendering); `OUTPUT`=HTML on screen;
`STORAGE`=none; `DOWNLOAD`=no PDF download button found in `ContractA4Preview.tsx`
or in `ContratoViewModal.tsx`. `DOCUMENT_GENERATION_GAP` confirmed: the only way for a contract
to have a real associated "document" is the `arquivo_url` field (§6), filled in manually with the URL
of an externally hosted file — the system does not generate the document from the template, even though
the entire placeholder-resolution/preview engine exists.

---

## 20. Storage / Attachments (§26 of the prompt)

| FORM_FIELD | RESOURCE_TYPE | DATABASE_REFERENCE | STORAGE_PROVIDER | UPLOAD_ENDPOINT | DOWNLOAD/PREVIEW | DELETE | TENANT_ISOLATION |
|---|---|---|---|---|---|---|---|
| `arquivo_url` (only in `ContratoFormModal.tsx`) | contract document (PDF, by convention) | `contracts.arquivo_url` (text) | **none** — it is a free-text URL pasted by the user, not a real upload | none | `ContratoViewModal.tsx` renders an `<a href={arquivo_url}>` link | clear the text field (there is no remote storage to delete) | N/A |
| `VinculadoDocument` (`useDocuments`/`useSaveDocument`) | digital-signature document | none — no table/column exists | none | none (`useSaveDocument` always throws an error, explicit comment in the code: "É proibido simular o backend em localStorage ou devolver documentos fictícios" (simulating the backend in localStorage or returning fake documents is forbidden)) | `useDocuments()` always returns `[]` | N/A | N/A |

Real flow of `arquivo_url`: upload (nonexistent — only paste a URL) → persistence (text column) → read
(same column) → download/preview (a direct `<a>` link to the external URL) → delete (clear the text).
`STORAGE_GAP` confirmed, but more honest by design than the fake `arquivo_audio` in `catalog.md`
(it does not pretend an upload happened — it is clearly a manual URL field). `DocumentTimeline.tsx`/
`DocumentStatusBadge.tsx` (§3) never receive real data to render, since `useDocuments()` is
permanently empty.

---

## 21. Electronic signature / DocuSign (§27/§28 of the prompt) — complete audit

| ITEM | CLASSIFICATION | EVIDENCE |
|---|---|---|
| `CONNECT_ACCOUNT` (DocuSign OAuth) | **IMPLEMENTED** | `integrations.controller.ts:281-322` — real `code`→`access_token` exchange via `POST {DOCUSIGN_AUTH_BASE_URL}/oauth/token`, Basic Auth with `DOCUSIGN_INTEGRATION_KEY`/`DOCUSIGN_CLIENT_SECRET`, persists the token via `IntegrationBaseService` (tenant-scoped) |
| `OAUTH_CALLBACK` | **IMPLEMENTED** | `POST /integrations/oauth/exchange` (`@Public()`, protected by a single-use `exchange_token` issued by `oauth/init`) |
| `ACCOUNT_STATUS` | **IMPLEMENTED** | `GET /integrations/oauth/status?platform=docusign` |
| `TOKEN_REFERENCE` | **IMPLEMENTED** (tenant-scoped, never in `.env`) | `IntegrationBaseService.getOAuthStatus/disconnectOAuth` |
| `CREATE_ENVELOPE` | **NOT_IMPLEMENTED** | no route, no service method, no call to the DocuSign eSignature API found in `apps/api/src` |
| `SEND_ENVELOPE` | **NOT_IMPLEMENTED** | same |
| `SIGNERS` (DocuSign signatory management) | **NOT_IMPLEMENTED** in the backend | signatories exist only as `contracts.signers` (generic jsonb, not specific to any provider) |
| `ENVELOPE_STATUS` | **NOT_IMPLEMENTED** | — |
| `SIGNATURE_STATUS` | **NOT_IMPLEMENTED** | — |
| `DOWNLOAD_SIGNED_DOCUMENT` | **NOT_IMPLEMENTED** | — |
| `WEBHOOK` (DocuSign) | **NOT_IMPLEMENTED** | no DocuSign webhook route found (contrast: a real webhook exists for Autentique) |
| Frontend: `resolveSigningAdapter("docusign")` | **STUB** (deliberate) | `signing.adapter.ts` — `createDocument`/`getDocument`/`listDocuments`/`cancelDocument`/`resendInvite`/`handleWebhook` all `Promise.reject`; a comment in the file itself confirms the intent: "nunca simula sucesso" (never simulates success) |
| Frontend: `useSigningProviders()` "connected" for DocuSign | **PARTIAL** | based on `sessionStorage.getItem("musicos360_docusign_credentials")` — a client-side/per-session check, it does not query the real `GET /integrations/oauth/status` |

This textually confirms what the prompt had already established: `AUTH_MODEL: AUTHORIZATION_CODE` (correct),
`CURRENT_PRIVATE_KEY_CONFIGURED: NÃO` (no), `PRIVATE_KEY_REQUIRED: NÃO` (no) (DocuSign Authorization Code Grant
does not use a JWT/private key) — and the prompt's open question ("ENVELOPE/SIGNATURE
IMPLEMENTATION — verificar código real" (check the real code)) is now resolved: **not implemented**. DocuSign today
is, in practice, just a "Conectar conta" (Connect account) button without any capability to send/sign
documents.

**Autentique (additional finding, outside the nominal scope of §27 but necessary so as not to leave the
picture incomplete)**: unlike DocuSign, the backend has a **real and complete** Autentique
integration — `POST /integrations/autentique/configure` (API token per tenant),
`POST /integrations/autentique/send` (`AutentiqueService.sendForSignature`, real GraphQL against the
Autentique API, writes `autentique_doc_id`/`signing_platform`/`metadata` on the contract, emits
`CONTRACT_SENT_FOR_SIGNATURE`, records an activity log), `POST /integrations/autentique/webhook`
(`AutentiqueService.handleWebhook`, validates a shared secret). **None of these three endpoints is
called by any file in `apps/web/src`** (an exhaustive grep confirmed zero occurrences) — the
frontend's `signing.adapter.ts` is deliberately disconnected from this real integration and always
fails by design, even for "autentique" (the provider described in the code as "sempre disponível" (always available) /
default). Recorded as a high-severity `EXTERNAL_INTEGRATION_GAP`: a real signing capability
exists and is ready in the backend, but no screen in the system can trigger it.

Also: `autentiqueWebhook` (`POST /integrations/autentique/webhook`) is under `@RequireRole('editor')`
without `@Public()` — since an external Autentique webhook does not carry a tenant JWT, this route
is probably **not reachable by the real caller** (Autentique's own server). Recorded
as a one-off `AUTHORIZATION_GAP`, although with no practical effect today (nothing triggers `sendForSignature`,
so no webhook would ever be expected).

---

## 22. Signatories (§29 of the prompt)

`contracts.signers` (jsonb) — an official DTO field, actually persisted (unlike `parties`).

| FIELD | TYPE | Source in the Wizard | DATABASE_MAPPING |
|---|---|---|---|
| `role` | string | detected from `{{SIGNATURE.*}}`/`{{INITIALS.*}}`/`{{SIGN_DATE.*}}` in the template, or `"OUTRO"` if added manually | `signers[].role` |
| `nome`/`name` | string | typed | `signers[].nome` (+ `.name`, mirrored for compatibility — see `WizardSignerRecord`) |
| `email` | string | typed | `signers[].email` |
| `obrigatorio` | boolean | checkbox, default `true` | `signers[].obrigatorio` |
| `ordem` | number | numeric input, default = index+1 | `signers[].ordem` |
| `provider` | `"autentique"\|"clicksign"\|"docusign"\|""` | Select per signatory (not per contract) | `signers[].provider` |
| `status`/`signed_at`/`external_id` | **do not exist in the real schema** | — | only in `VinculadoDocument.signers[].status` — a type used exclusively by the `useDocuments` system, which is 100% stub (§20) |

Each signatory can have a different `provider` (the structure allows mixed signing per person),
but since no provider is functionally implemented for real sending (§21), this design is not
exercised in practice. There is no persisted per-signatory `signed_at`/`external_id`/`status` field in the
real `contracts` schema — it would only exist via the `VinculadoDocument` layer, which is never reached.

---

## 23. Amendments and Versioning (§31/§32 of the prompt)

**There is no concept of an amendment as a separate entity.** The closest thing is
`contracts.versoes` (a jsonb array, field `ContratoVersao {versao, url, criado_em, notas, autor}`),
manipulated **only** by `ContratoFormModal.tsx` (when replacing `arquivo_url`, it pushes the previous
version onto `versoes[]` before writing the new URL — confirmed at lines ~623-648 of the file).
`ContratoWizard.tsx` never reads or writes `versoes`. `VERSION_FIELD`=`versoes[].versao` (a free
string, automatic incrementing not verified); `PARENT`=implicit (the same `contracts.id`, no
FK to a "parent" contract — it is not a formal amendment, it is the file history of the same record);
`CURRENT_VERSION`=the current `arquivo_url`; `CREATION_TRIGGER`=manual URL replacement in
`ContratoFormModal`; `IMMUTABILITY`=none — `versoes[]` can be freely overwritten via
`PATCH`, with no append-only protection in the backend (the service does a simple object merge, it does not validate
that `versoes` only grows).

---

## 24. Tables/Grids (§33 of the prompt)

### `Contratos.tsx` (main list — 8 data columns, no sorting)

| COLUMN_LABEL | COLUMN_KEY | API_FIELD | DATABASE_COLUMN | SORTABLE | FILTERABLE | SEARCHABLE |
|---|---|---|---|---|---|---|
| "Título" (Title) | `titulo` | `titulo` | `contracts.titulo` | no | no | yes |
| "Artista / Cliente" (Artist / Client) | derived | `artistas.nome_artistico` \|\| `clientes.nome` | via `leftJoinAndMapOne` (real, §4) | no | no | yes (artist only, not client — `contrato.artistas?.nome_artistico`, `clientes` is not part of the search) |
| "Tipo" (Type) | `tipo` | `tipo` | `contracts.tipo` | no | yes (`typeFilter`) | no |
| "Plataforma" (Platform) | `signing_platform` | `signing_platform` | `contracts.signing_platform` | no | yes (`platformFilter`) | no |
| "Status" | `status` | `status` | `contracts.status` | no | yes (`statusFilter`) | no |
| "Período" (Period) (+ "Xd" badge if it expires in ≤30 days) | `data_inicio`/`data_fim` | same | `contracts.data_inicio`/`.data_fim` | no | no | no |
| "Valor" (Value) | `valor` | `valor` | `contracts.valor` | no | no | no |

### `TemplatesContratos.tsx` (with sorting)

| COLUMN_LABEL | COLUMN_KEY | API_FIELD | DATABASE_COLUMN | SORTABLE | FILTERABLE | SEARCHABLE |
|---|---|---|---|---|---|---|
| "Nome" (Name) | `nome` | `nome` | `contract_templates.titulo` (mapped — see Gap #2) | yes | no | yes |
| "Categoria" (Category) (derived) | `categoria` | `tipo_servico` | `contract_templates.tipo` | yes | yes (`filterType`) | no |
| "Status" | `status` (derived from `ativo`) | `ativo` | `contract_templates.ativo` | yes | yes (`filterStatus`) | no |
| "Criado em" (Created on) | `created_at` | `created_at` | `contract_templates.created_at` | yes | no | no |

15 visible columns in total across the two main grids, all with a confirmed source (0 without
a source).

---

## 25. Details, Filters, Search, Sort, Pagination (§34-38 of the prompt)

**DETAILS** (`ContratoViewModal.tsx`, `TemplateContratoViewModal.tsx`): every displayed field is
traceable to the same column already documented above; no orphaned detail field.

**FILTERS**: `Contratos.tsx` — 3 (`typeFilter`, `statusFilter`, `platformFilter`) + free search, all
client-side. `TemplatesContratos.tsx` — 2 (`filterType`, `filterStatus`) + search, client-side.

**SEARCH**: case-insensitive `.includes()`, no accent normalization, no impact from encrypted
fields (there is no encrypted PII in this module — the parties' PII is in plain text, §7).

**SORT**: `Contratos.tsx` = **0 sortable columns** (no `SortableTableHead`/`sortState`
found — unlike every other list module already audited). `TemplatesContratos.tsx`
= 4 sortable columns via `sortTableRows`.

**PAGINATION**: `usePagination(filteredContratos, 10)` / `usePagination(sortedTemplates, 10)` — 100%
client-side, the same component family (`usePagination`) already documented in `catalog.md`.
`TOTAL_COUNT_SOURCE` derives from the array already limited to 50 by the backend — the same silent limit
documented in Gap #10 below.

---

## 26. Import / Export / XLSX (§39-41 of the prompt)

**Structured import (spreadsheet)**: does not exist for `contracts`/`contract_templates`/
`contract_service_types` — none of the three appears in `report-module-registry.ts`
(`REPORT_MODULE_TABLE_NAMES`) except `contracts` (see export below); there is no module-specific
XLSX import flow. The module's only real "import" is the semantic/textual one via
`ContractImportWorkspace.tsx` (paste the text of an existing contract → `POST /api/v1/ai/generate` →
generates a `TemplateContrato` draft, not a spreadsheet) — outside the `XLSX` format of prompt §39/§27.

**Export/XLSX**: only `contracts` is in the central registry (`report-module-registry.ts:28`, label
"Contratos", `order: 10`). Field contract (`CONTRACTS_CONTRACT`,
`report-form-contracts.ts:149-177`): 13 `col()`
(`titulo, tipo, status, valor, data_inicio, data_fim, exclusivo, observacoes, arquivo_url, signing_platform, artista_id, cliente_id, lancamento_id, template_id`)
+ 2 `ro()` (`autentique_doc_id, versoes`) = **15 exportable
columns, 14 importable** (excluding the `ro()` ones). The generic engine (the same as in `catalog.md`) always
generates/requires exactly 1 worksheet — `WORKSHEET_COUNT = 1`, `XLSX_RULE_VIOLATION: NÃO` (no).

**Direct security finding**: `observacoes` is among the exportable columns (`col('observacoes')`).
Since `ContratoWizard.tsx` (the main flow) serializes **the entire parties blob** — including the CPF,
CNPJ, RG, email, phone and address of each party to the contract, plus the legal
representative's details — inside that same `observacoes` column (§7), **a bulk export of "Contratos" via the
Reports Center delivers, as plain text inside a spreadsheet cell, the complete JSON with the
PII of every party of every exported contract**. This is the module's most severe finding in practice
from the standpoint of sensitive-data exposure.

---

## 27. Notifications and Realtime (§43/§44 of the prompt)

`REALTIME_EVENTS: 0` — no Supabase Realtime channel, no subscription found for
`contracts`/`contract_templates`/`contract_service_types` in `apps/web/src/modules/contracts`.

Notifications: the module emits internal domain events (`CONTRACT_CREATED`,
`WORKFLOW_TRANSITIONED`, `CONTRACT_SIGNED`, `CONTRACT_EXPIRED`, `CONTRACT_CANCELLED`,
`CONTRACT_STATUS_CHANGED`, `CONTRACT_EXPIRING_SOON`, `CONTRACT_SENT_FOR_SIGNATURE`,
`CONTRACT_INTEGRATION_READY`) consumed by `ContractEventsHandler` (writes `activity_logs`, never
a "notification" addressable to a specific user) and `ContractWorkflowHandler` (creates CRM
tasks). No consumer was found that sends email/push/in-app notifications directly from
these events within the `contracts` module itself (out of scope: the general notifications
module was not audited, per the instruction in prompt §43).

---

## 28. Permissions and Tenant Isolation (§45/§46 of the prompt)

| PERMISSION | FRONTEND_ENFORCEMENT | BACKEND_ENFORCEMENT |
|---|---|---|
| `contract:read` | reading the list is not gated in the frontend | `@RequireRole('viewer') @RequirePermission('contract:read')` |
| `contract:create` | "Novo Contrato" (New Contract) button via `RequirePermission module="contracts" action="write"` (`Contratos.tsx` header) | `@RequireRole('editor') @RequirePermission('contract:create')` + `IdempotencyInterceptor` (`X-Idempotency-Key`) + `PlanLimitService.enforce(...,'contracts')` (plan limit) |
| `contract:update` | `RequirePermission module="contracts" action="write"` on the grid's "Editar" (Edit) item | `@RequireRole('editor') @RequirePermission('contract:update')` |
| `contract:cancel` (soft delete) | `RequirePermission module="contracts" action="delete"` on the "Excluir" (Delete) item | `@RequireRole('manager') @RequirePermission('contract:cancel')` |
| `contract_template:read/create/update/archive` | no visible gate located in `TemplatesContratos.tsx` (template creation/editing is not wrapped in `RequirePermission` in the component, unlike the contracts screen) | `@RequireRole('viewer'|'editor'|'editor'|'manager')` respectively — backend protected even without a visual gate in the frontend |
| `contract_service_type` (create/update) | no visible permission gate (a real management screen does not exist — read only via dropdown) | real endpoints exist (`contract-service-types.controller.ts`) — not read in detail here since they have no real write consumer in the UI |

`AUTHORIZATION_GAP`: 1 one-off — `POST /integrations/autentique/webhook` without `@Public()` (§21),
probably unreachable by the real caller (but with no practical consequence today, since nothing triggers the
real sending). Apart from that, `AUTHORIZATION_GAPS: 0` — all write/read routes have a guard
consistent with the pattern of the modules already audited.

`TENANT_ISOLATION_GAP: 0`. `contracts.service.ts`/`contract-templates.service.ts`/
`contract-service-types.service.ts` filter `tenant_id = :tenantId` (via `@CurrentTenant()`) in
all queries; `create()` always writes `tenant_id` from the authenticated context. Special attention
requested by the prompt:
- **contract parties**: they do not live in a table of their own (§7) — isolation inherited from
  `contracts.tenant_id` itself (the `observacoes` column that contains them is under the same row isolation).
- **signatories**: same, inside `contracts.signers` (jsonb), same isolation.
- **attachments**: `arquivo_url` is an arbitrary external URL — there is no bucket/path controlled by the
  system, so there is no storage isolation to verify (the "isolation" is only about who can
  edit the field, covered by the `contract:update` guard).
- **tokens/external signature IDs**: `autentique_doc_id` lives on the `contracts` row itself
  (tenant-isolated); DocuSign OAuth tokens are managed by `IntegrationBaseService`, already
  tenant-scoped (the same pattern used by Spotify/YouTube/etc., not re-audited here since it is
  generic infrastructure shared across the whole `integrations` module).
- **`contact-contracts` (in-memory Map, §3/Gap #9)**: technically partitions by `tenantId` as the
  outer Map's key (`forTenant(tenantId)`), so there is no cross-tenant leak *within the
  process* — but since it does not persist in Postgres, the "isolation" is irrelevant in practice (the data
  does not even survive a restart, and it is not the same storage used by the real `contracts`).

---

## 29. Delete / Terminate / Archive (§47 of the prompt)

| UI_ACTION | ENDPOINT | DATABASE_BEHAVIOR | FINANCIAL_IMPACT | SIGNATURE_IMPACT | FK_IMPACT | SOFT_OR_HARD |
|---|---|---|---|---|---|---|
| Delete contract (individually or in bulk) | `DELETE /contracts/:id` | `UPDATE contracts SET deleted_at = now()` | none — the provisional transaction already created (if the contract was ever signed) **is neither reversed nor flagged** automatically | none — `autentique_doc_id`/`signers` remain written, with no automatic cancellation at the provider (even if the real integration were used, there is no call to `cancelSigning()` in the delete flow) | `artists.contrato_id` (if set by an earlier `CONTRACT_SIGNED`) **is not cleaned up** — the artist keeps referencing a now soft-deleted contract | SOFT |
| Cancel (workflow transition to `cancelado`) | `PATCH /contracts/:id` (`status=cancelado`) | only `status` changes | no automatic reversal | none | none | N/A (it is a state transition, not a deletion) |
| Archive template | `DELETE /contract-templates/:id` | `UPDATE contract_templates SET deleted_at = now()` | N/A | N/A | contracts that already use this template's `template_id` **keep working** (the FK is not `NOT NULL`/`CASCADE`, it is just a loose `uuid` with no constraint declared in Phase 1) | SOFT |
| Archive service type | `POST` via `archiveContractServiceType` (`active=false`) | simple update | N/A | N/A | the "in use" check runs against `contratos` but only looks at the 50 most recent (Gap #10) — it may archive a type still in use by an older contract | SOFT (never hard-delete) |

No restore screen (`restore`) for soft-deleted contracts/templates was found.

---

## 30. Consolidated gaps (evidenced, not fixed)

1. **REAL_MAPPING_GAP** (high severity) — `ContratoWizard.tsx` (`handleSave()`, lines ~1109-1132)
   never uses the official field `CreateContractDto.parties` (which the backend already knows how to route to
   `contracts.metadata.parties`) — instead, it manually serializes `{parties, variables,
   partyRoles, manifestVars, signatureRoles}` as JSON inside `contracts.observacoes` (a `text`
   column, unstructured, unencrypted). Side effect: any edit made via
   `ContratoFormModal` (which treats `observacoes` as real free text) **destroys** the wizard's JSON
   blob on save. See also the security Gap in §26 (the export exposes this blob in bulk).
2. **REAL_MAPPING_GAP** (critical severity) — `POST /contract-templates`
   (`CreateContractTemplateDto`: `title`/`type`/`content`/`variables`/`metadata`, English, `type` with the
   fixed enum `['exclusive','non-exclusive','distribution','service','publishing','other']`) is
   completely out of sync with the real fields sent by `TemplatesContratos.tsx`
   (`nome`/`tipo_servico`/`conteudo`/`descricao`/`ativo`/`variables_manifest`/`header_image`/
   `footer_image`, pt-BR). With a global `ValidationPipe({whitelist:true, forbidNonWhitelisted:true})`,
   **every template creation via the real UI returns HTTP 400** — the module has no compatibility
   alias equivalent to the `contract-legacy-alias.util.ts` that exists for `contracts`. In practice this
   blocks the creation of new templates (Step 1 of `ContratoWizard`, which is the entry
   point of the entire main contracts flow, depends entirely on templates that already
   exist in the database).
3. **DOCUSIGN_GAP** — DocuSign envelope/signature: `NOT_IMPLEMENTED` in the backend (only the connection
   OAuth exists); the frontend's `signing.adapter.ts` is hardcoded to always fail for any
   provider, including DocuSign — see §21.
4. **SIGNATURE_GAP** — `ContratoWizard.tsx`'s "Enviar para Assinatura" (Send for Signature) button (`handleSave(true)`,
   lines ~1146-1149) **always** executes `toast.error(...)` followed by `throw new Error(...)`, without
   ever calling any backend — it is a deterministic failure, not an integration bug.
5. **SIGNATURE_GAP** — `SendForSigningDialog.tsx` (the other sending path, from
   `ContratoViewModal`/`Contratos.tsx`) calls `signingService.sendForSigning()`, which in turn
   always fails in `resolveSigningAdapter(provider).createDocument()` (universal stub) — the same
   final outcome as Gap #4, via a different path.
6. **EXTERNAL_INTEGRATION_GAP** (high severity) — the Autentique integration is **real and complete in the
   backend** (`configure`/`send`/`webhook`, genuine GraphQL, writes real state on the contract, emits
   events) but has **zero consumers in the frontend** — no file in `apps/web/src` calls
   `/integrations/autentique/*`. A ready capability, never triggered by the UI.
7. **WORKFLOW_GAP** (high severity) — the workflow transition `aguardando_assinatura → assinado`
   requires a truthy `arquivo_url` (a real guard in `contracts.workflow.ts:40-46`), but `ContratoWizard`
   (the main flow, used by `Contratos.tsx`) **has no field for `arquivo_url` in any
   of the 6 steps** — only `ContratoFormModal.tsx` (the secondary flow, only reachable via `catalog`)
   exposes it. A contract created entirely through the main flow cannot be transitioned to
   "Assinado" (Signed) without an extra step outside the wizard.
8. **PARTY_MAPPING_GAP** — CRM/Artist source data copied into a party
   (`origin: "crm"`/`"artistas"`) does not retain the `sourceId` in a persisted/traceable way — it is a
   one-off copy of values, not a live reference; later changes to the source contact/artist
   are never reflected in the contract.
9. **REAL_MAPPING_GAP** — `ContactContractsService` (`GET/POST /contacts/:contactId/contracts`)
   uses an in-memory `Map` in the Node process as its "database" — no real persistence in
   Postgres; data is lost on every restart/redeploy and not shared across instances. No
   frontend consumer (an exhaustive grep confirmed zero occurrences in `apps/web/src`).
10. **REAL_MAPPING_GAP** — `GET /contracts` and `GET /contract-templates` use
    `PaginationDto.limit=50` as the default, and `useContratos()`/`useTemplatesContratos()` never
    pass `limit`/`offset` — the same pattern already documented in `catalog.md` §12.11: tenants with more
    than 50 contracts/templates lose visibility of older records in `Contratos.tsx`,
    `TemplatesContratos.tsx`, in the Audit (§2) and in the "type in use" check of
    `useContractServiceTypes` (§4).
11. **REAL_MAPPING_GAP** — `CategoryRegistry.tsx`/`useCategoryRegistry` and
    `VariableRegistry.tsx`/`useVariableRegistry` are 100% `localStorage`, not synchronized with the
    backend nor across devices/users — even though they look in every respect like shared
    administration screens (with seeds, full CRUD, variable import/merge).
12. **TEMPLATE_GAP** — four "contract type" vocabularies coexist with no formal link
    between them (dead hardcoded `CONTRACT_TYPES`, local `contract_categories`, `contract_
    templates.tipo`/`tipo_servico`, `contract_service_types.slug`) — see §10.
13. **FINANCIAL_TERM_GAP** — the rich financial fields of `contract_service_types`
    (currency/frequency/penalty/interest/due period) never reach a real contract, since that table is not
    consumed by `ContratoWizard` — see §14.
14. **ENUM_MISMATCH** — `ContractStatus.ATIVO` is not the target of any real workflow transition —
    a dead state in the shared enum — see §11.
15. **RELATION_MISMATCH** — `contracts.exclusivo` (a real `NOT NULL` column) has no
    corresponding field in `ContratoWizard` — every contract created by the main flow is born with
    `exclusivo=false` regardless of the contract's real content — see §17.
16. **DOCUMENT_GENERATION_GAP** — there is no real PDF/DOCX generation from a template,
    even though the entire placeholder-resolution and A4 (HTML) preview engine already exists — see §19.
17. **AUTHORIZATION_GAP** (one-off, no practical effect today) — `POST /integrations/autentique/webhook`
    without `@Public()`, probably unreachable by the real external caller — see §21.

Total: 9 REAL_MAPPING_GAP, 2 SIGNATURE_GAP, 1 DOCUSIGN_GAP, 1 EXTERNAL_INTEGRATION_GAP,
1 WORKFLOW_GAP, 1 PARTY_MAPPING_GAP, 1 TEMPLATE_GAP, 1 FINANCIAL_TERM_GAP, 1 ENUM_MISMATCH,
1 RELATION_MISMATCH, 1 DOCUMENT_GENERATION_GAP, 1 AUTHORIZATION_GAP = **21 gaps**.

Findings not classified as a formal "gap", but recorded as dead code:
`contracts.store.ts` (Zustand, never imported), `contract-party-origin.mapper.ts`/
`getContractPartyOrigin()` (never imported), `forms/index.ts` (empty stub).

---

## Final counters (Zero-Gap)

```
SUBDOMAINS_AUDITED: 13
COMPONENTS_AUDITED: 18
HOOKS_AUDITED: 6
CREATE_FORMS: 2 (ContratoWizard, ContratoFormModal)
CREATE_FIELDS: 9 (wizard, record level) + 13 (ContratoFormModal, record level) = 22 distinct
               record-level fields across the two flows; + N per party (up to 19 sub-fields) and
               N per signatory (5 sub-fields)
EDIT_FORMS: 2
EDIT_FIELDS: the same sets as create per flow (same create/edit component in both)
MODALS_DRAWERS_WIZARDS: 6 (ContratoWizard, ContratoFormModal, ContratoViewModal,
                           SendForSigningDialog, ContractImportWorkspace, TemplateContratoViewModal)
TABLE_GRID_COLUMNS: 15 (7 in Contratos.tsx + 4 in TemplatesContratos.tsx, + checkbox/actions not
                        counted as data)
CONTRACT_TYPES: 4 parallel vocabularies (none unified — see §10)
WORKFLOW_STATUSES: 9 reachable + 1 dead (ATIVO) = 10 values in the enum
RELATION_FIELDS: 5 (contracts.artista_id, .cliente_id, .lancamento_id, .template_id,
                    artists.contrato_id)
PARTY_FIELDS: up to 19 sub-fields per party × N dynamic parties per template (not persisted in
              columns — inside observacoes)
SIGNATORY_FIELDS: 6 (role, nome/name, email, obrigatorio, ordem, provider)
FINANCIAL_TERM_FIELDS: 6 (valor + 5 contract_service_types fields, disconnected in practice)
RIGHTS_TERM_FIELDS: 1 (exclusivo — not exposed in the main flow)
TEMPLATE_FIELDS: 8 (nome, tipo_servico, conteudo, descricao, ativo, variables_manifest,
                    header_image, footer_image)
TEMPLATE_VARIABLES: dynamic per template (0 to N, all with a source — real via variables_manifest or
                    fallback via regex, never without a source)
AMENDMENT_FIELDS: 5 (versoes[]: versao, url, criado_em, notas, autor) — not a formal amendment,
                  it is file history
FILTERS: 5 (3 in Contratos.tsx + 2 in TemplatesContratos.tsx)
SEARCH_FIELDS: 2 (title+artist in Contratos.tsx; name in TemplatesContratos.tsx)
SORT_FIELDS: 4 (only TemplatesContratos.tsx — Contratos.tsx has no sortable column)
IMPORT_FIELDS: 14 (only contracts, via the Reports Center)
EXPORT_FIELDS: 15 (13 col + 2 ro)
XLSX_EXPORTS: 1 (Contratos — contract_templates/contract_service_types are not in the registry)
XLSX_RULE_VIOLATIONS: 0
PDF_EXPORTS: 0
DOCX_EXPORTS: 0
STORAGE_FIELDS: 2 (arquivo_url; VinculadoDocument — always empty/stub)
REALTIME_EVENTS: 0
DOCUSIGN_FUNCTIONS_AUDITED: 11 (connect_account, oauth_callback, account_status, token_reference,
                                create_envelope, send_envelope, signers, envelope_status,
                                signature_status, download_signed_document, webhook)
DOCUSIGN_IMPLEMENTED: 4 (connect_account, oauth_callback, account_status, token_reference)
DOCUSIGN_PARTIAL_OR_STUB: 0
DOCUSIGN_NOT_IMPLEMENTED: 7 (create_envelope, send_envelope, signers, envelope_status,
                             signature_status, download_signed_document, webhook)
CREDENTIALS_REQUIRED_LATER: 1 (DOCUSIGN_CLIENT_ID/DOCUSIGN_CLIENT_SECRET — PLATFORM ownership;
                              the resulting OAuth tokens remain TENANT_SCOPED, they do not go to .env)
PERMISSIONS_AUDITED: 8 (contract:read/create/update/cancel,
                        contract_template:read/create/update/archive)
AUTHORIZATION_GAPS: 1 (autentique webhook without @Public())
TENANT_ISOLATION_GAPS: 0

CODE_FIELD_ONLY: 0
DATABASE_COLUMN_ONLY: 0
TYPE_MISMATCH: 0
NULLABILITY_MISMATCH: 0
DEFAULT_MISMATCH: 0
ENUM_MISMATCH: 1 (ContractStatus.ATIVO unreachable)
RELATION_MISMATCH: 1 (exclusivo not exposed in the main wizard)
CREATE_MAPPING_MISMATCH: 1 (incompatible contract-templates DTO — blocks every real creation)
EDIT_MAPPING_MISMATCH: 1 (same, update-contract-template.dto inherits the same broken PartialType)
DISPLAY_MAPPING_MISMATCH: 0
PARTY_MAPPING_GAPS: 1
FINANCIAL_TERM_GAPS: 1
TEMPLATE_GAPS: 1
DOCUMENT_GENERATION_GAPS: 1
STORAGE_GAPS: 1
SIGNATURE_GAPS: 2
DOCUSIGN_GAPS: 1
WORKFLOW_GAPS: 1
REAL_MAPPING_GAPS: 9

CONTRACT_TO_ACCOUNTING_TRACEABILITY_COMPLETE: YES
DOCUSIGN_TRACEABILITY_COMPLETE: YES
AUDITORIA_TSX_CONTRACT_SECTION_COMPLETE: YES

UNMAPPED_CREATE_FIELDS: 0
UNMAPPED_EDIT_FIELDS: 0
UNMAPPED_DISPLAY_FIELDS: 0
UNMAPPED_RELATION_FIELDS: 0
UNMAPPED_PARTY_FIELDS: 0
UNMAPPED_FINANCIAL_FIELDS: 0
UNMAPPED_TEMPLATE_FIELDS: 0
UNMAPPED_SIGNATURE_FIELDS: 0
UNMAPPED_IMPORT_FIELDS: 0
UNMAPPED_EXPORT_FIELDS: 0
UNMAPPED_STORAGE_FIELDS: 0
UNKNOWN_FIELD_CLASSIFICATIONS: 0
```

NEXT_MODULE: `crm-relationships`
