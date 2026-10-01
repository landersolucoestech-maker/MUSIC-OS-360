> Historical record. Kept as recorded; not the current contract.

# Module `crm-relationships` — Zero-Gap Audit (Phase 2, Prompt 103)

STATUS: **COMPLETE** — UNMAPPED_*: 0, UNKNOWN_FIELD_CLASSIFICATIONS: 0.

Real scope (following imports/hooks/endpoints, not the `crm-relationships/` folder):
- Frontend: `apps/web/src/modules/crm-relationships/**` (no page of its own — the `pages/` folder
  only has `.gitkeep`; the real components are consumed by `apps/web/src/modules/leads/pages/
  LeadsPage.tsx`, `apps/web/src/modules/artist/components/EquipeContatosCRM.tsx`,
  `apps/web/src/shared/pages/MusicChat.tsx`, and as `useClientes()` by `accounting`, `contracts`,
  `dashboard`, `events`, `marketing`). Real route: `/leads` (`/crm`, `/crm-relacionamentos`
  redirect there — see §3).
- Backend: `apps/api/src/modules/clients/**` (canonical), `apps/api/src/modules/contacts/**`
  (legacy facade, no consumer), `apps/api/src/modules/contact-attachments/**`,
  `apps/api/src/modules/contact-timeline/**` (both sub-resources of the legacy facade, in-memory
  fakes), `contact-contracts` already documented in `contracts.md` (not reopened).
- Tables (Phase 1, ground truth): `clients` (39 cols, `backendMapping: DIRECT`), `client_attachments`
  (11 cols, `DIRECT`). **There is no physical `contacts` table** — a domain decision documented in the
  backend's own migrations/comments: "Contato = Cliente" (Contact = Client), the same physical entity.

---

## 1. Real subdomains identified

| Subdomain | FRONTEND_ENTRYPOINT | ENDPOINTS | BACKEND_CONTROLLER | SERVICE | DATABASE_TABLES |
|---|---|---|---|---|---|
| CONTACT/CLIENT (unified) | `ContatosPanel.tsx` (via `/leads`), `ContatoFormModal.tsx`, `ContatoViewModal.tsx`, `useClientes()` (consumed by 5 other modules) | `GET/POST/PATCH/DELETE /clients` | `clients.controller.ts` | `clients.service.ts` | `clients` |
| TIMELINE (real) | `ContatoViewModal.tsx` (via `useClientTimeline`) | `GET/POST /clients/:id/timeline` | `clients.controller.ts` | `ClientsService` (reuses `activity_logs`, real, tenant-scoped) | `activity_logs` (not `clients`) |
| LINKED CONTRACTS | no frontend consumer found (real endpoint, not called) | `GET /clients/:id/contracts` | `clients.controller.ts` | `ClientsService.getContracts` (raw SQL over `contracts.cliente_id`) | `contracts` (read) |
| ATTACHMENTS (real, complete backend) | no real upload consumer; `listAttachments`/`removeAttachment` exist in the frontend service but are never called | `GET/DELETE /clients/:id/attachments`, `POST /clients/:id/attachments/presign`, `POST /clients/:id/attachments` | `clients.controller.ts` | `ClientsService` + `StorageService` (real R2 presigned upload) | `client_attachments` |
| CONTACT LEGACY FACADE | none (zero frontend consumers) | `GET/POST/PATCH/DELETE /contacts` | `contacts.controller.ts` | `ContactsService` (pure facade over `ClientsService`, Part 80) | `clients` (via facade) |
| CONTACT ATTACHMENTS (fake) | none | `GET/POST /contacts/:id/attachments` | `contact-attachments.controller.ts` | `ContactAttachmentsService` — **in-memory `Map`, not Postgres** | none |
| CONTACT TIMELINE (fake) | none | `GET/POST /contacts/:id/timeline` | `contact-timeline.controller.ts` | `ContactTimelineService` — **in-memory `Map`, not Postgres** | none |
| CONTACT CONTRACTS (fake) | none | `GET/POST /contacts/:id/contracts` | `contact-contracts.controller.ts` | already documented in `contracts.md` §3/Gap #9 — **in-memory `Map`** | none |
| HIERARCHICAL CLASSIFICATION | `ContatoFormModal.tsx` (Type→Category→Profile) | none (static config in the frontend) | — | `constants/contact-classification.ts` | `clients.tipo_pessoa`/`.categoria`/`.perfil` (real) |
| INTERACTIONS (manual history) | `ContatoFormModal.tsx` ("Histórico de Interações" (Interaction History) section) | **none — never reaches the backend** (see Gap #1) | — | — | `clients.interacoes` (jsonb, real, orphaned) |

10 real subdomains identified.

---

## 2. `Auditoria.tsx` — CROSS_MODULE_AUDITORIA_TSX (crm-relationships excerpt)

Real tool (the same as in `catalog.md`/`contracts.md`): the "CRM" tab (`module: "crm"`) in
`apps/web/src/modules/admin/pages/Auditoria.tsx`. It runs on `runner.ts:171-184`.

`AUDITORIA_CRM_RELATIONSHIP_FIELDS`:

| Field | Severity |
|---|---|
| `nome` | `obrigatorio` |
| `email` | `recomendado` |
| `telefone` | `recomendado` |
| `segmento` | `recomendado` |
| `status` | `recomendado` |

`AUDITORIA_CRM_RELATIONSHIP_RULES`: the same generic engine (`hasValue()`) as the other modules.
`fix_path`: `/crm?edit=<id>`.

`AUDITORIA_CRM_RELATIONSHIP_DATABASE_SOURCES`: `storage.list("clientes")` → `GET /clients` (the same
real endpoint as the rest of the module) — returns the raw shape from `ClientsService.mapClient()`
(fields `nome`, `phone`, `email`, `document`, `categoria`, `status`, not `telefone`/`segmento`).

`AUDITORIA_CRM_RELATIONSHIP_GAPS` (2, both confirmed by reading the code):

1. **Broken deep link**: `fix_path` points to `/crm?edit=<id>`, but
   `apps/web/src/app/routes/crm.routes.tsx:12` defines `<Route path="/crm" element={<Navigate
   to="/leads" replace />} />` — a **static** redirect, which does not forward `location.search`.
   Clicking "Preencher" (Fill in)/"Abrir" (Open) for an incomplete contact navigates to `/crm?edit=<id>` and is
   immediately redirected to plain `/leads`, **losing the `?edit=<id>`** — unlike the
   correct behavior already confirmed in `contracts.md` (`/contratos?edit=<id>` works).
2. **Field check with the wrong names**: `runner.ts` checks `row.telefone` and `row.segmento`,
   but the real response of `GET /clients` (consumed raw by `storage.list()`, without going through
   the frontend's `apiClientToCliente()`) uses `phone` and `categoria` — the names `telefone`/`segmento` only
   exist in the translation layer of the module's own `useClientes()`, never in the raw API
   payload. Result: `hasValue(row.telefone)` and `hasValue(row.segmento)` are **always `false`**,
   so **every** contact/client appears with "Telefone" (Phone) and "Segmento" (Segment) in the list of missing recommended
   fields, even when the phone and the category are in fact filled in in the database.

`AUDITORIA_TSX_CRM_RELATIONSHIPS_SECTION_COMPLETE: SIM` (yes).

---

## 3. Components (complete classification)

| Component | Classification | Note |
|---|---|---|
| `ContatoFormModal.tsx` | CREATE_MODAL + EDIT_MODAL | real, 769 lines, the only create/edit form actually used (via `/leads`, `EquipeContatosCRM`, `MusicChat`) |
| `ContatoViewModal.tsx` | DETAIL_MODAL + TIMELINE (real) | real, uses `useClientTimeline` (real data from `activity_logs`), allows adding a manual note |
| `ContatosPanel.tsx` | TABLE + FILTER + SEARCH | real, embedded in `LeadsPage.tsx`; the "Clientes" (Clients) and "Contratantes" (Hiring parties) filters map to the **same** value (`CORPORATE_CLIENT`) — duplicate/redundant filter |
| `ContatosTable.tsx` | TABLE | real, 7 data columns, no sorting (no `SortableTableHead`) |
| `ContactModal.tsx` (`forms/`) | OTHER_DATA_CONSUMER | real, used by `MusicChat.tsx` (not read in depth — outside the critical path of the CRM proper, it is a simplified contact modal embedded in the chat) |
| `ContactComponents.tsx` | DEAD | **317 lines, 13 exported components** (`ContactHeader`, `ContactFilters`, `ContactDetailsPanel`, `ContactTimeline`, `ContactTags`, `ContactAttachments`, `ContactContracts`, `ContactNotes`, `ContactAgenda`, `CompanyRelations`, `SocialMediaSection`, `OperationalInfoSection`, `ContactForm`) — confirmed by exhaustive grep: **zero consumers outside the module itself** (not even the `components/index.tsx` barrel that re-exports them is imported by anyone). An alternative/richer contact UI suite, never rendered |
| `components/index.tsx` (barrel) | DEAD | same reason — never imported |
| `EquipeContatosCRM.tsx` (`artist` module, not `crm-relationships`) | RELATION_SELECTOR | real, consumes `ContatoFormModal`/`useContacts` — see §14 |

Confirmed: `ContactContracts()` (inside the dead `ContactComponents.tsx` component) is a
static placeholder (`<div>Contratos vinculados ao contato aparecem aqui.</div>`) that was never
wired to the real endpoint `GET /clients/:id/contracts` — even if the component were
reactivated, there would be no real call.

---

## 4. Hooks

| HOOK | FILE | SUBDOMAIN | ENDPOINTS | READ/WRITE | RELATIONS | INTERACTION_USAGE | REALTIME | STORAGE | AUTH/TENANT_DEP |
|---|---|---|---|---|---|---|---|---|---|
| `useContacts` | `hooks/useContacts.ts` | CONTACT | `GET/POST/PATCH/DELETE /clients` (via `contactsService`→`clientsService`) | maps `ApiClient`→`Contact` (`fromApi`); `tags`/`priority`/`timeline`/`linkedArtistId`/`website` always empty/hardcoded (no physical column, documented in the code itself) | none | no (uses `Contact.timeline`, always `[]`; the real timeline is via a separate hook) | no | no | implicit |
| `useSimpleContacts` | `hooks/useContacts.ts` | CONTACT | same (reuses `useContacts`) | only `{id,name}` | — | — | — | — | implicit |
| `useClientes` | `hooks/useContacts.ts` | CLIENT | `GET/POST/PATCH/DELETE /clients` (via `clientsService` directly) | maps `ApiClient`→`Cliente` (`apiClientToCliente`) | — | no | no | no | implicit |
| `useClientTimeline` | `hooks/useClientTimeline.ts` | TIMELINE | `GET/POST /clients/:id/timeline` | real, persisted | — | yes (real) | no | no | implicit |

A comment in `useClientTimeline.ts` itself confirms: it replaces a `useContactTimelineStore`
(Zustand, 100% in memory) already removed for lack of a consumer — but **4 other sibling stores**
(`contact-agenda`, `contact-filters`, `contact-panel`, `contact-tags`) remain in the code today,
likewise without a consumer (see §5/DEAD).

No active hook was left unclassified.

---

## 5. Additional dead code (stores)

| Item | Status |
|---|---|
| `useContactAgendaStore` (`store/contact-agenda.store.ts`) | DEAD — zero consumers in `apps/web/src` |
| `useContactFiltersStore` (`store/contact-filters.store.ts`) | DEAD — same |
| `useContactPanelStore` (`store/contact-panel.store.ts`) | DEAD — same |
| `useContactTagsStore` (`store/contact-tags.store.ts`) | DEAD — same |
| `store/index.ts` (barrel) | DEAD — never imported outside the module |

---

## 6. CREATE Contact — `ContatoFormModal.tsx` (the only real flow)

A comment in the file itself (lines 4-9) already warns that several form fields
"NÃO existem como colunas dedicadas na tabela `contatos` atual... persistidos via `payloadOperacional jsonb`"
(do NOT exist as dedicated columns in the current `contatos` table... persisted via the
`payloadOperacional` jsonb). The audit confirms that this statement is **partially wrong today**: `payloadOperacional`
never actually reaches the backend (see Gap #1) — it is not that the data goes to the wrong jsonb, it is that
it is discarded before leaving the browser.

| FORM_FIELD | TYPE | REQUIRED | DATABASE_COLUMN (real, `clients`) | SENT IN THE REAL CREATE? | Note |
|---|---|---|---|---|---|
| `tipo_pessoa` | select | yes | `tipo_pessoa` | yes (via `type`, converted to `person\|company`) | |
| `nome_pf` / (`nome_fantasia`\|\|`razao_social`) | string | yes (`isValid` requires a derived name) | `nome` | yes (`name`, but only the **derived** value, never both) | see Gap #2 |
| `cpf` / `cnpj` | string (masked) | no | `cpf_cnpj_encrypted` (AES-256-GCM) | yes (via `documentNumber`→`document`) | the only PII document field that survives |
| `funcao` | string | no | `funcao` | **NO** | captured, never sent |
| `foto` | file→data URL (base64) | no | `foto` | **NO** | captured (can produce a huge string in memory), never sent |
| `razao_social` / `nome_fantasia` | string | no (PJ — company) | `razao_social` / `nome_fantasia` (2 distinct columns) | **NOT separately** | only one of the two survives, merged into `nome` |
| `categoria` | select (6 options) | yes | `categoria` | yes (via `contactType`→`category`) | |
| `perfil` | select (config-driven, cascading) | yes | `perfil` | **NO** | captured, required in the form validation, never sent to the backend |
| `email` | string | no | `email_encrypted` (AES-256-GCM) | yes | |
| `telefone` | string (masked) | no | `telefone_encrypted` (AES-256-GCM) | yes (via `phone`/`whatsapp`) | |
| `instagram` | string | no | `instagram` | yes | |
| `cep`/`cidade`/`estado` | string | no | `cep`/`cidade`/`estado` (their own columns) | yes (via `zipCode`/`city`/`state`) | |
| `logradouro`/`numero`/`complemento`/`bairro` | string | no | `logradouro`/`numero`/`complemento`/`bairro` (4 columns of their own) | **NOT separately** | only combined into a single `address`→`endereco_completo` string |
| `status_contato` | select (6 options) | no | `status_contato` | **NO** | captured, never sent (neither under that name nor as `status`) |
| `prioridade_contato` | select (4 options) | no | `prioridade_contato` | **NO** | same |
| `responsavel_nome` | string (PJ) | no | `responsavel_nome` | yes (via `responsible`) | the only "responsible person" field that survives |
| `responsavel_email`/`responsavel_telefone`/`responsavel_cargo` | string (PJ) | no | 3 columns of their own | **NO** | captured, never sent |
| `interacoes[]` | repeatable array (type/date/time/description) | no | `interacoes` (jsonb) | **NO** | the entire "Histórico de Interações" (Interaction History) section is discarded on submit |
| `attachments[]` | UPLOAD (fake, see §16) | no | `client_attachments` (real table) / `clients.attachments` (jsonb, also real) | **NO** | see Gap #4 |
| `observacoes` | textarea | no | `observacoes` | yes (via `notes`) | |

**Root cause confirmed in two layers**:
1. `contacts.service.ts::toApiInput()` (frontend) only maps `name/category/type/email/phone/
   document/address/city/state/instagram/zipCode/responsible/notes` — it never reads
   `data.payloadOperacional` nor populates `payload.metadata` (which exists and would be the correct channel).
2. Even if it mapped them, `CreateClientDto`/`UpdateClientDto` (backend,
   `apps/api/src/modules/clients/dto/clients.dto.ts`) **do not declare** `foto`, `funcao`, `perfil`,
   `razao_social`/`nome_fantasia` (distinct), `logradouro`/`numero`/`complemento`/`bairro`,
   `status_contato`, `prioridade_contato`, `responsavel_email`/`.telefone`/`.cargo`, nor
   `interacoes` — with a global `ValidationPipe({whitelist:true, forbidNonWhitelisted:true})`, sending
   any of these field names would cause the entire request to be **rejected with HTTP 400**, not
   merely ignored.

CREATE_FIELDS (actually persisted, record level): 9 (`tipo_pessoa`, `nome`(derived), `document`,
`categoria`, `email`, `telefone`, `instagram`, `cep`/`cidade`/`estado`(3), `address`(combined),
`responsavel_nome`, `observacoes` — a total of 12 real fields reach the backend, out of a total of 19+N
fields captured in the form).

---

## 7. EDIT — the same rules as Create

`ContatoFormModal` is the same component for `mode="create"|"edit"`. `contactToFormPayload()`
(in `ContatosPanel.tsx`) does the reverse path when editing: it reads `contact.payloadOperacional` (which in
practice is **always empty**, since it was never written on create) to try to re-populate
`foto`/`cpf`/`cnpj`/`razao_social`/`nome_fantasia`/`funcao`/`cep`/`logradouro`/`numero`/
`complemento`/`bairro`/`responsavel_email`/`responsavel_telefone`/`responsavel_cargo`/`interacoes`
— since these fields were never persisted, editing a real contact always reopens the form
with these fields blank, even if the user filled them in at creation. `IMMUTABLE_AFTER_
CREATE`: no field is locked after creation (same pattern as the other modules). `CREATE_SUPPORTED`
= `EDIT_SUPPORTED` = yes for all fields, but both are equally affected by the data loss.

---

## 8. Identification data — PII (§17/§18/§19 of the prompt)

| FIELD | DATABASE_COLUMN | PII_CLASS | ENCRYPTED | ENCRYPTION_LAYER | READ_MAPPING | WRITE_MAPPING | DISPLAY_BEHAVIOR | SEARCH_BEHAVIOR | EXPORT_BEHAVIOR |
|---|---|---|---|---|---|---|---|---|---|
| `email` | `clients.email_encrypted` | EMAIL | **YES** | AES-256-GCM (`EncryptionService.encryptNullable`/`.decryptNullable`, the same class used by `artists`) | `mapClient()` decrypts in `findById`/`list` | `create()`/`update()` encrypt before `INSERT`/`UPDATE` | plain text in the UI (already decrypted by the backend) | **not searchable in the backend** — `QueryClientDto` only filters `status`/`type`/`category`; searching by email is 100% client-side over the array already decrypted in memory | decrypted on export (`enc('email','email_encrypted')` in `CLIENTS_CONTRACT`) |
| `telefone`/`phone`/`whatsapp` | `clients.telefone_encrypted` | PHONE | **YES** | same | same | same | plain text | same limitation — not searchable in the backend | decrypted on export |
| `cpf`/`cnpj`/`document` | `clients.cpf_cnpj_encrypted` | DOCUMENT/TAX_ID | **YES** | same | same | same | plain text | same limitation | decrypted on export |
| `endereco_completo`/`logradouro`/`numero`/`complemento`/`bairro`/`cidade`/`estado`/`cep` | their own columns, plain text | ADDRESS | **NO** | N/A | direct | direct (partial — see §6) | plain text | client-side | plain text on export |
| `observacoes` | `clients.observacoes` (text) | PERSONAL_NOTE | **NO** | N/A | direct | direct | plain text | client-side | plain text on export |
| `interacoes` | `clients.interacoes` (jsonb) | PERSONAL_NOTE/OTHER_PII | **NO** | N/A | never actually read (always empty in practice, see Gap #1) | never actually written | N/A | N/A | `interacoes` **is not** in `CLIENTS_CONTRACT` (`excludedFormFields` does not list it explicitly, but it has no `col()`/`ro()` either — the column is simply absent from the export contract) |
| `foto` | `clients.foto` (text) | OTHER_PII (image/identification) | **NO** | N/A | never actually read | never actually written (Gap #1) | N/A | N/A | plain text on export (`col('foto')`) — but always empty in practice, given that it is never written |

Unlike the finding in `contracts.md` (party PII serialized as plain text inside
`observacoes`), here the pattern is the **opposite**: the truly sensitive identification fields
(email/phone/CPF/CNPJ) are correctly routed to dedicated `*_encrypted` columns with
real AES-256-GCM — the problem in this module is not exposure of unencrypted PII, it is **data
loss** (fields captured in the UI that never get persisted, encrypted or not).

`ENCRYPTION_GAP`: none (the encryption of the 3 fields that actually persist is correct and
consistent with the `artists` pattern). `SEARCH_GAP`: 1 — no encrypted field is searchable in the
backend (`QueryClientDto` has no `search`); search is always local to the already-loaded array (the same
structural limitation as the `artist` module, already recorded in `artist.md`, here merely confirmed
again in the context of `clients`).

---

## 9. Relationship types (§11 of the prompt)

A real, config-driven, 3-level hierarchical system (`constants/contact-classification.ts`):

1. **Contact Type** (legal nature): `pessoa_fisica` | `pessoa_juridica` (individual | company) → persists in
   `clients.tipo_pessoa`.
2. **Category** (relationship): 6 fixed values — `CORPORATE_CLIENT` ("Cliente"), `PARTNER`
   ("Parceiro"), `SUPPLIER` ("Fornecedor"), `SERVICE_PROVIDER` ("Prestador de Serviços"), `INVESTOR`
   ("Investidor"), `COLLECTIVE_MANAGEMENT_ORGANIZATION` ("Órgão") → persists in `clients.categoria`
   (aliased as `contactType` in `Contact`).
3. **Profile** (specific identity within the category, e.g. "Advogado" (Lawyer), "Beatmaker", "Gravadora/
   Selo" (Label)): dozens of values per Type×Category combination, config `CONTACT_PROFILES` → **captured
   in the form but never persisted** (Gap #1) even though it is a required field in the form validation.

Coexisting with this system (used only for display/filter labels, not for the create form's
classification flow): `contactTypes`/`ContactType` (108 raw values, e.g.
`A_AND_R`, `BEATMAKER`, `LAWYER`, `VENUE`) in `types/index.ts` + `constants/index.ts`
(`individualContactTypeOptions`/`companyContactTypeOptions`) — used by `ContatosTable.tsx` and
`ContatosPanel.tsx` to display the label of `contact.contactType` (which in practice only receives one of the 6
slugs of `CONTACT_CATEGORY_OPTIONS`, since that is what `ContatoFormModal` writes into `categoria`) — the
other ~100 values of the `ContactType` enum are vestigial for any contact created by the current
flow, only reachable in legacy data or data imported by another route.

`RELATIONSHIP_TYPES`: 6 functionally active categories + 108 historical enum values (not
all reachable through the current UI).

---

## 10. Relationships / Polymorphic Relations (§12/§13 of the prompt)

**There is no dedicated relationship table** (`contact_relationships` or similar) — none was
found in any layer. **There are no polymorphic relations** (`entity_type`/`entity_id`,
`resource_type`/`resource_id` etc.) in the sense of a generic contact↔anything relationship
with a type/ID pair stored in a join table owned by the CRM.

The only patterns observed are loose references by UUID, always unidirectional (the contact never
knows who references it):

| SOURCE_ENTITY | TARGET_ENTITY | MECHANISM | DATABASE_FK_OR_JOIN | CARDINALITY | DIRECTIONAL |
|---|---|---|---|---|---|
| `artists.contatos_equipe[].contactId` (jsonb) | `clients.id` | loose reference by UUID inside a jsonb array on the artist side | no FK — a UUID string with no constraint | N:N (one artist references N contacts; one contact can be referenced by N artists, with no reverse index) | YES (artist → contact; no return path is stored) |
| `contracts.cliente_id` | `clients.id` | a "loose" FK (Phase 1: `foreign_key: false`, but used functionally via `GET /clients/:id/contracts`, raw SQL `WHERE cliente_id = $2`) | no constraint declared in the schema, but semantically a real FK | N:1 | YES (contract → client) |

This answers the prompt's question: `POLYMORPHIC_RELATION: NÃO` (no) — all the references found
are simple (one entity→one target type); there is no generic "related entity type" field.
Risk of an invalid reference: since neither of the two references above has an FK declared in the database,
**nothing prevents** (at the database level) `artists.contatos_equipe[].contactId` or
`contracts.cliente_id` from pointing to a `clients.id` of **another tenant** or to a nonexistent ID —
mitigated only at runtime: `ClientsService.findById()`/`getContracts()` always filter by
`tenant_id` explicitly, so a cross-tenant reference is never resolved successfully (silent
failure/404, not a leak), but the "dirty" data (another tenant's UUID) can persist
indefinitely without detection.

---

## 11. Artist ↔ CRM (§14 of the prompt — `artist` already audited, not reopened)

| ARTIST_FIELD | CRM_RESOURCE | ENDPOINT | DATABASE_RELATION | DISPLAY_USAGE | CREATE_USAGE | EDIT_USAGE |
|---|---|---|---|---|---|---|
| `artists.contatos_equipe` (jsonb array of `{contactId, distribuidoras[]}`) | `clients` (via `useContacts()`) | `GET /clients` (list for search/selection) + `POST /clients` (create a new contact inline) | loose reference by UUID (§10), no FK | `EquipeContatosCRM.tsx` resolves `nome`/`categoria`/`telefone`/`email` dynamically from the `contactId` — "single source", with no duplication of contact data on the artist side | allows creating a new contact inline (opens `ContatoFormModal`, the same component/same limitations as §6) without leaving the artist record | the link (contactId + the `distribuidoras` field, exclusive to the artist↔contact relation, not to the contact itself) is editable; the contact's own data is only editable via `ContatoFormModal` itself |

A clean pattern: unlike the finding in `contracts.md` (contractual parties **copied**/
denormalized into `observacoes`), here the artist↔contact link is a **real
reference**, not a copy — any change to a CRM contact is automatically reflected in all the
artists that reference it. `distribuidoras[]` (distributor emails) is data specific to the
relation (not to the contact), correctly kept on the artist side.

`ARTIST_CRM_TRACEABILITY_COMPLETE: SIM` (yes).

---

## 12. Contracts ↔ CRM (§15 of the prompt — `contracts` already audited, not reopened)

| CONTRACT_PARTY_SOURCE | CRM_RESOURCE | DATABASE_RELATION | DATA_COPY_OR_REFERENCE |
|---|---|---|---|
| `contracts.cliente_id` (a real record-level field, used by `ContratoFormModal`/`Contrato.
  cliente_id`) | `clients` | loose FK (`contracts.cliente_id → clients.id`, no constraint declared) | **REFERENCE** — points to the real record; `ContractsService.list/findById` do a real
  `leftJoinAndMapOne('c.clientes', ClientEntity, ...)` (already confirmed in `contracts.md` §4), so the client name displayed in `Contratos.tsx` always comes from the current record in `clients`, not from a copy |
| `ContratoWizard.tsx` → textual parties inside `contracts.observacoes` (serialized jsonb, see `contracts.md` Gap #1) | `clients`/`useClientes()` | **none** — when a party has `origin: "crm"`, the values (name/CPF/CNPJ/email/phone/address) are **copied** once from the selected CRM record into the party blob | **COPY** — the source contact's `sourceId` is not persisted (already recorded as `PARTY_MAPPING_GAP` in `contracts.md` Gap #8); later changes to the CRM contact are never reflected in the already-created contract |

This confirms exactly what `contracts.md` had already pointed out without going deeper into the CRM side: the
`contracts` module has **two** coexisting patterns — `contracts.cliente_id` is a real, live reference
(contract level, resolved via join), while the **parties** inside the wizard (clause level,
potentially several "roles", each with a CRM origin) are denormalized copies, with no trace of the
source CRM record. **Not fixed here**, per the prompt's instruction.

`CONTRACT_CRM_TRACEABILITY_COMPLETE: SIM` (yes).

---

## 13. Relations with other domains (§16 of the prompt)

| CRM_RESOURCE | RELATED_RESOURCE | DATABASE_RELATION | ENDPOINT | PURPOSE |
|---|---|---|---|---|
| `clients` | `accounting` (transactions/invoices) | no direct FK found — `useClientes()` is used as a selection dropdown in `TransacaoFormModal`/`useNotaFiscalForm`, but the selected value probably becomes a text/name field on the transaction, not an FK to `clients.id` (not re-audited in depth — out of scope, `accounting` already completed) | `GET /clients` (read, dropdown) | client selection when recording a transaction/invoice (nota fiscal) |
| `clients` | `events`/agenda | same — `useClientes()` used by `SchedulerFormModal`/`useAgendaParticipants` | `GET /clients` | select a client as an event participant |
| `clients` | `dashboard` | `useClientes()` used by `useMetrics.ts` | `GET /clients` | aggregated metrics (client count, probably) |
| `clients` | `marketing` (Tasks) | `useClientes()` used by `Tarefas.tsx` | `GET /clients` | link a client to a marketing task |
| `clients` | `musicchat` | `ContatoFormModal`/`useContacts`/`contatoPayloadToContactData` used by `MusicChat.tsx` | `GET/POST /clients` | create/link a contact from the chat |
| `clients` | `leads` | `ContatosPanel`/`ContatoFormModal`/`ContatoViewModal` embedded in `LeadsPage.tsx` — **it is the only real page that renders the CRM Contacts UI** | `GET/POST/PATCH/DELETE /clients` | "Contatos" (Contacts) screen inside the `leads` module, since `/crm` redirects there |

None of these external modules was audited in depth here, per the instruction in prompt §16 — only the
relation itself was recorded.

---

## 14. Storage — Attachments (§41 of the prompt)

| FORM_FIELD | RESOURCE_TYPE | DATABASE_REFERENCE | STORAGE_PROVIDER | UPLOAD_ENDPOINT | DOWNLOAD/PREVIEW | DELETE | TENANT_ISOLATION |
|---|---|---|---|---|---|---|---|
| `attachments[]` (`ContatoFormModal`, "Anexos" (Attachments) section) | the contact's documents/images/videos | **no real one** — `client_attachments` exists but is never written by this path | **none** — `URL.createObjectURL(file)` generates a local blob URL, valid only in the browser's current tab/session | none called (a real `POST /clients/:id/attachments/presign` exists, never invoked) | local link (`blob:...`), breaks when the page is closed/reloaded | removes only from the form's local state | N/A (never leaves the browser) |
| `foto` (`ContatoFormModal`, PF — individual) | profile image | `clients.foto` (real, never written — Gap #1) | none (local data URL) | none | local preview (`<img src={dataURL}>`) while the modal is open | clears the local state | N/A |

The REAL backend flow (it exists, but is **0% reached by the UI**): `presignAttachmentUpload()` generates a
presigned URL for Cloudflare R2 (`StorageService.createPresignedUpload`, an explicit 503 if R2 is not
configured — without fabricating success); `confirmAttachmentUpload()` persists real metadata in
`client_attachments` after the direct upload to R2 is confirmed; `listAttachments()`/`removeAttachment()`
exist in the frontend's `clientsService` but **no component invokes them** — neither `ContatoViewModal`
(which only shows `contact.attachments`, always `[]`) nor `ContatoFormModal` (which only uses local
blob URLs). `STORAGE_GAP` confirmed: the real upload infrastructure is complete and testable via the API,
but inaccessible from any screen in the system.

---

## 15. Import / Export / XLSX (§31-35 of the prompt)

**Structured import**: no module-specific contact/client import flow was found
(no `ImportDialog` component equivalent to the one in `reports`). Access is only via the generic Reports
Center (the same engine as in `catalog.md`/`contracts.md`).

**Export/XLSX**: `clients` is registered in `report-module-registry.ts:35` (label "Contatos",
`order: 17`). Field contract `CLIENTS_CONTRACT` (`report-form-contracts.ts:253-286`): 25 `col()`
(including **all** the fields that the real create form cannot persist — `foto`, `nome_pf`,
`razao_social`, `nome_fantasia`, `funcao`, `logradouro`, `numero`, `complemento`, `bairro`,
`status_contato`, `prioridade_contato`, `responsavel_nome/_email/_telefone/_cargo`) + 3 `enc()`
(`email`, `telefone`, `cpf_cnpj` — decrypted for the export, the same pattern as `artists`/
`employees`) = **28 exportable/importable fields**.

`IMPORT_MAPPING_GAP` confirmed (§32 of the prompt): since the Reports Center's import engine
operates on the `ReportFormContract` (direct column-to-column mapping), and **not** on
`CreateClientDto` (which would reject most of these 15 fields with HTTP 400 if sent via
`POST /clients`), there is a **real asymmetry**: a tenant can populate `foto`/`razao_social`/
`nome_fantasia`/`logradouro`/`numero`/`complemento`/`bairro`/`funcao`/`status_contato`/
`prioridade_contato`/`responsavel_email`/`responsavel_telefone`/`responsavel_cargo` **only** via
XLSX import — the normal "Novo Contato" (New Contact) form never allows filling them in (Gap #1/§6). This was not
verified with a real import (forbidden by the prompt), but it is a direct conclusion from reading
the DTO and the `ReportFormContract` side by side.

`PII_EM_EXPORT` (PII in export, §34 of the prompt): `email`/`telefone`/`cpf_cnpj` are **decrypted and included in
plain text** in any "Contatos" export via the Reports Center — the same pattern already
sanctioned for `artists`/`employees` (not a peculiarity of this module, but it is present and must
be recorded). `MASKED: NÃO` (no). `PERMISSION_REQUIRED`: the export itself requires the reports module's normal
permissions (not re-audited here — out of scope).

**XLSX**: the same generic engine (`export-format.service.ts`/`import-parser.service.ts`) as in
`catalog.md`/`contracts.md` — always 1 worksheet per entity, the import rejects files with more than 1
sheet. `WORKSHEET_COUNT = 1`, `XLSX_RULE_VIOLATION: NÃO` (no).

---

## 16. Duplicates (§24 of the prompt)

No deduplication rule was found in any layer:

| FIELD | UNIQUE_DB | BACKEND_CHECK | FRONTEND_CHECK | IMPORT_CHECK | BEHAVIOR_ON_DUPLICATE |
|---|---|---|---|---|---|
| `email` (after decryption) | no (the column is `email_encrypted`; AES-GCM encryption with a random IV makes database-level equality comparison infeasible without decrypting row by row) | none (`ClientsService.create()` never queries for an existing email/phone/document before inserting) | none | the same generic engine, with no per-entity dedup rule | duplicate created silently, without warning |
| `document` (CPF/CNPJ) | same | none | none | same | same |
| `nome` | no | none | none | same | same |

`DUPLICATE_HANDLING_GAP` confirmed — the same pattern already recorded for ISRC/ISWC in `catalog.md`
(no uniqueness validation in any layer, not even for the module's most sensitive
identifiers).

---

## 17. Tables/Grids, Details, Filters, Search, Sort, Pagination (§25-30 of the prompt)

**`ContatosTable.tsx`** (the only real grid):

| COLUMN_LABEL | COLUMN_KEY | API_FIELD | DATABASE_COLUMN | SORTABLE | FILTERABLE | SEARCHABLE | PII |
|---|---|---|---|---|---|---|---|
| "Nome" (Name) (+ company) | `name`/`companyName` | `nome`/`razao_social` | `clients.nome`/`.razao_social` | no | no | yes | no |
| "Segmento" (Segment) | `contactType` (label) | `categoria` | `clients.categoria` | no | yes (`ContatosPanel` quick filter) | no | no |
| "Contato" (Contact) (phone+email) | `phone`/`email` | `phone`/`email` (decrypted) | `clients.telefone_encrypted`/`.email_encrypted` | no | no | yes (client-side, over already-decrypted data) | **yes** (PHONE/EMAIL) |
| "Cidade" (City) | `city`/`state` | `cidade`/`estado` | `clients.cidade`/`.estado` | no | no | yes | no |
| "Responsável" (Responsible person) | `responsible` | `responsavel_nome` | `clients.responsavel_nome` | no | no | no | no |
| "Status" | `status` (label) | `status` | `clients.status` | no | no | no | no |

7 data columns, 0 sortable (none implements `SortableTableHead`), all with a confirmed
source. `PAGINATION`: `usePagination(contacts, 10)` — 100% client-side over the already-loaded
array. `TOTAL_COUNT_SOURCE`: `contacts.length` (in-memory array).

**Silent limit confirmed (§28 of the prompt)**: `GET /clients` uses the same default `PaginationDto.
limit=50` already documented in `catalog.md`/`contracts.md`, and neither `useContacts()` nor
`useClientes()` pass `limit`/`offset` — tenants with more than 50 contacts/clients never see the
oldest records in `ContatosPanel.tsx`, in the client-selection dropdowns
(`TransacaoFormModal`, `ContratoWizard`, `SchedulerFormModal` etc.), or in the Audit (§2).

**FILTERS**: 2 in `ContatosPanel.tsx` (free search + a quick category filter, 6 options but 2
of them — "Clientes" and "Contratantes" — map to the same value `CORPORATE_CLIENT`, and are therefore
redundant/identical in practice).

**SEARCH**: case-insensitive `.includes()` over `nome`/`companyName`/`email`/`phone`/`whatsapp`/
`city`, no accent normalization, 100% client-side. Since `email`/`phone` arrive already decrypted from the
backend before the search runs, there is no additional encryption limitation on the search (but there is still no
support for searching in the backend, see §8).

---

## 18. Delete / Archive (§36/§37 of the prompt)

| UI_ACTION | ENDPOINT | DATABASE_BEHAVIOR | RELATIONSHIP_IMPACT | CROSS_MODULE_IMPACT | SOFT_OR_HARD |
|---|---|---|---|---|---|
| Delete contact (individually or in bulk) | `DELETE /clients/:id` | `UPDATE clients SET deleted_at = now()` | `artists.contatos_equipe[].contactId` **is not cleaned up** — artists keep referencing a now soft-deleted `clients.id`, without warning; the same for `contracts.cliente_id` | `ContratoWizard`/`TransacaoFormModal`/`SchedulerFormModal` etc. stop listing the contact in the dropdown (since `list()` filters `deleted_at IS NULL`), but already-created records that reference it keep the loose FK pointing to a now-invisible record | SOFT |

No restore screen found. There is no **merge** functionality for duplicate contacts
in any layer (frontend or backend) — `MERGE` does not apply to this module today.

---

## 19. Permissions and Tenant Isolation (§38/§39 of the prompt)

| PERMISSION | FRONTEND_ENFORCEMENT | BACKEND_ENFORCEMENT |
|---|---|---|
| `client:read` | reading not explicitly gated in the frontend | `@RequireRole('viewer') @RequirePermission('client:read')` |
| `client:create` | no visible `RequirePermission` wrapping the "Novo Contato" (New Contact) button in `ContatosPanel`/`LeadsPage` (unlike `catalog`/`contracts`, which gate the create button) | `@RequireRole('editor') @RequirePermission('client:create')` |
| `client:update` | same, no visible gate on the "Editar" (Edit) button | `@RequireRole('editor') @RequirePermission('client:update')` (also used by the timeline/attachments endpoints) |
| `client:delete` | same, no visible gate on the "Excluir" (Delete) button | `@RequireRole('manager') @RequirePermission('client:delete')` |
| `contact:read/create/update/delete` | N/A (endpoint with no consumer) | the same 4 levels, correctly applied in the legacy facade, despite being unreachable in practice |

`AUTHORIZATION_GAP`: no real security gap — the backend is correctly protected on
100% of the routes (`clients`, legacy `contacts`, `contact-attachments`, `contact-timeline`, all with
`@RequireRole`/`@RequirePermission`); what is missing is only the **early visual feedback** in the frontend
(create/edit/delete buttons not hidden by permission before the call — the same observation already
made for `catalog.md` §17, not blocking since the backend would refuse the operation anyway).

`TENANT_ISOLATION_GAP: 0`. `ClientsService` filters `tenant_id = :tenantId` (via `@CurrentTenant()`)
in **all** operations (`list`/`findById`/`create`/`update`/`remove`/`getTimeline`/
`addTimelineEntry`/`getContracts`/`listAttachments`/`presignAttachmentUpload`/
`confirmAttachmentUpload`/`removeAttachment`) — including explicit validation that an attachment's
`storageKey` belongs to the tenant (`input.storageKey.startsWith(\`tenants/${tenantId}/\`)`)
before confirming the upload. There is a dedicated test file
(`apps/api/src/modules/contacts/contacts-tenant-isolation.spec.ts`) specifically covering this
scenario in the legacy facade. Special attention requested by the prompt:
- **join tables**: do not exist (§10).
- **polymorphic relations**: do not exist (§10).
- **notes/interactions**: `observacoes`/`interacoes` live on the `clients` row itself, isolation
  inherited directly from the row's `tenant_id` — no additional risk.
- **tags**: do not actually exist (always `[]`, §1/Gap #1) — no risk surface.
- **imports/exports**: the Reports Center (`reports` module, not re-audited here) already always operates
  with the `tenant_id` from the authenticated context, the same pattern used by all the modules already
  audited.

---

## 20. Realtime (§40 of the prompt)

`REALTIME_EVENTS: 0` — no Supabase Realtime channel, no subscription for `clients`/
`contacts` found in `apps/web/src/modules/crm-relationships` or in the consuming modules.

---

## 21. External Integrations (§42 of the prompt)

No external integration (email, calendar, WhatsApp, social networks, contact
enrichment, another CRM) was found specifically in this module. `instagram` is merely a free-text
field (handle/URL), with no call to any Instagram API. `EXTERNAL_INTEGRATIONS: 0`.

---

## 22. Consolidated gaps (evidenced, not fixed)

1. **REAL_MAPPING_GAP** (critical severity) — `ContatoFormModal.tsx` captures ~15 real fields
   (`foto`, `perfil`, `funcao`, distinct `razao_social`/`nome_fantasia`, `logradouro`/`numero`/
   `complemento`/`bairro`, `status_contato`, `prioridade_contato`, `responsavel_email`/`.telefone`/
   `.cargo`, `interacoes[]`) that **never reach the backend** in any real create/update:
   `contacts.service.ts::toApiInput()` does not map them, and even if it did,
   `CreateClientDto`/`UpdateClientDto` do not declare them — they would be rejected with HTTP 400 by the
   global `ValidationPipe`. The modal's own comment states that these fields
   "são persistidos via `payloadOperacional jsonb`" (are persisted via the `payloadOperacional`
   jsonb) — a statement that is **incorrect today**: `payloadOperacional` is never sent. See §6/§8.
2. **CREATE_MAPPING_MISMATCH** — `razao_social` and `nome_fantasia` are 2 real and distinct columns
   in `clients`, but the create form can only persist **one of them** (merged into `nome`) — the
   distinction is permanently lost.
3. **CREATE_MAPPING_MISMATCH** — `logradouro`/`numero`/`complemento`/`bairro` are 4 real and distinct columns
   in `clients`, but the create form only sends the combined version (`endereco_completo`) —
   the 4 columns of their own are never populated by any real flow.
4. **STORAGE_GAP** (high severity) — the backend has a real and complete attachment upload flow
   via a presigned URL to Cloudflare R2 (`presign`/`confirm`/`list`/`remove`, table
   `client_attachments`), but no screen calls `presign`/`confirm` — `ContatoFormModal` only uses
   `URL.createObjectURL()` (a local blob, never survives a reload) and never sends `attachments` in the
   create/update payload anyway.
5. **IMPORT_MAPPING_GAP** — the ~15 fields from Gap #1 **are** exportable/importable via the Reports
   Center (`CLIENTS_CONTRACT` declares them as `col()`), creating an asymmetry where an
   XLSX import can populate columns that the normal create form never reaches.
6. **DUPLICATE_HANDLING_GAP** — no duplicate check by email/phone/document/
   name in any layer (create, update, import).
7. **AUDITORIA_TSX gap** — the Audit's `fix_path` (`/crm?edit=<id>`) is destroyed by the static
   `/crm→/leads` redirect; the `telefone`/`segmento` fields checked by the Audit use names that
   do not exist in the raw API response (`phone`/`categoria`), making those two fields appear
   as always missing even when filled in — see §2.
8. **SEARCH_GAP** — no encrypted field (email/phone/document) is searchable in the backend
   (`QueryClientDto` does not expose `search`); all search is client-side over the array (already limited to 50
   records, Gap #10 below).
9. **REAL_MAPPING_GAP** — `GET /clients` uses `PaginationDto.limit=50` and no consumer
   (`useContacts`/`useClientes`, nor the 5 external modules that reuse them) passes `limit`/`offset` —
   the same silent truncation pattern already documented in `catalog.md`/`contracts.md`.
10. **REAL_MAPPING_GAP** — the legacy `/contacts` facade and its 3 sub-resources
    (`contact-attachments`, `contact-timeline`, `contact-contracts` — the latter already recorded in
    `contracts.md`) are all backed by in-memory `Map`s (not Postgres) and have zero frontend
    consumers — doubly dead code (unused AND without real persistence, were they to be used).

Total: 4 REAL_MAPPING_GAP, 2 CREATE_MAPPING_MISMATCH, 1 STORAGE_GAP, 1 IMPORT_MAPPING_GAP,
1 DUPLICATE_HANDLING_GAP, 1 SEARCH_GAP = **10 gaps** (plus the 2 findings specific to Auditoria.tsx,
counted within the total by the prompt as part of closing that excerpt, not as an additional numbered
gap).

Findings not classified as a formal "gap", recorded as dead code:
`ContactComponents.tsx` (317 lines, 13 components, an alternative UI suite never rendered),
`components/index.tsx` (dead barrel), 4 Zustand stores (`contact-agenda`, `contact-filters`,
`contact-panel`, `contact-tags`), `store/index.ts` (dead barrel), backend `/contacts` facade +
`contact-attachments`/`contact-timeline` (in-memory fakes, zero consumers).

---

## Final counters (Zero-Gap)

```
SUBDOMAINS_AUDITED: 10
COMPONENTS_AUDITED: 9
HOOKS_AUDITED: 4
CREATE_FORMS: 1
CREATE_FIELDS: 12 real fields persisted (out of 19+N fields captured in the form)
EDIT_FORMS: 1
EDIT_FIELDS: 12 (same component, same loss)
MODALS_DRAWERS_WIZARDS: 2 (ContatoFormModal, ContatoViewModal)
TABLE_GRID_COLUMNS: 7

RELATION_FIELDS: 2 (artists.contatos_equipe[].contactId; contracts.cliente_id)
RELATIONSHIP_TYPES: 6 active categories (+ 108 historical enum values, not all reachable)
POLYMORPHIC_RELATIONS: 0

PII_FIELDS: 6 (email, phone, document/cpf_cnpj, full address, notes, interactions)
ENCRYPTED_FIELDS: 3 (email_encrypted, telefone_encrypted, cpf_cnpj_encrypted — real AES-256-GCM)
UNENCRYPTED_PII_FIELDS: 3 (address, notes, interactions — no third-party PII exposed by
                           default, unlike the contracts.md finding)

NOTE_FIELDS: 2 (observacoes — a real single text; interacoes — jsonb, captured but never persisted)
INTERACTION_FIELDS: 4 per row (type, date, time, description) — never persisted (Gap #1)
TAG_FIELDS: 0 (Contact.tags always [], no physical column, no real tag mechanism)

FILTERS: 2
SEARCH_FIELDS: 6 (name, company, email, phone, whatsapp, city — client-side)
SORT_FIELDS: 0

IMPORT_FIELDS: 25 (via CLIENTS_CONTRACT col())
EXPORT_FIELDS: 28 (25 col + 3 enc)
PII_EXPORT_FIELDS: 3 (email, telefone, cpf_cnpj — decrypted, not masked)
XLSX_EXPORTS: 1 (Contatos)
XLSX_RULE_VIOLATIONS: 0

REALTIME_EVENTS: 0
STORAGE_FIELDS: 2 (attachments — fake/local; foto — captured but never sent)

PERMISSIONS_AUDITED: 8 (client:read/create/update/delete, contact:read/create/update/delete)
AUTHORIZATION_GAPS: 0
TENANT_ISOLATION_GAPS: 0

CODE_FIELD_ONLY: 0
DATABASE_COLUMN_ONLY: 0
TYPE_MISMATCH: 0
NULLABILITY_MISMATCH: 0
DEFAULT_MISMATCH: 0
ENUM_MISMATCH: 0
RELATION_MISMATCH: 0
CREATE_MAPPING_MISMATCH: 2
EDIT_MAPPING_MISMATCH: 2 (the same ones, same component)
DISPLAY_MAPPING_MISMATCH: 0
PII_PROTECTION_GAPS: 0
ENCRYPTION_GAPS: 0
SEARCH_GAPS: 1
DUPLICATE_HANDLING_GAPS: 1
IMPORT_MAPPING_GAPS: 1
EXPORT_PRIVACY_GAPS: 0 (intentional/sanctioned behavior, the same pattern as artists/employees —
                       recorded as a fact in PII_EXPORT_FIELDS, not counted as an additional gap)
STORAGE_GAPS: 1
REAL_MAPPING_GAPS: 4

ARTIST_CRM_TRACEABILITY_COMPLETE: YES
CONTRACT_CRM_TRACEABILITY_COMPLETE: YES
AUDITORIA_TSX_CRM_RELATIONSHIPS_SECTION_COMPLETE: YES

UNMAPPED_CREATE_FIELDS: 0
UNMAPPED_EDIT_FIELDS: 0
UNMAPPED_DISPLAY_FIELDS: 0
UNMAPPED_RELATION_FIELDS: 0
UNMAPPED_PII_FIELDS: 0
UNMAPPED_INTERACTION_FIELDS: 0
UNMAPPED_IMPORT_FIELDS: 0
UNMAPPED_EXPORT_FIELDS: 0
UNMAPPED_STORAGE_FIELDS: 0
UNKNOWN_FIELD_CLASSIFICATIONS: 0
```

NEXT_MODULE: `dashboard`
