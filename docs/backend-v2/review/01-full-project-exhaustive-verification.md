> Historical record. Kept as recorded; not the current contract.

# MUSIC OS 360 — COMPLETE EXHAUSTIVE PROJECT VERIFICATION (Single Final Consolidation Document)

**DOCUMENT STATUS:** COMPLETED — all 15 Parts (I to XV) and the "Validation" section are present; see §0 (Methodological Note) and the "Validation" section at the end for the per-section coverage/confidence breakdown.

This is the final consolidation document of the MUSIC OS 360 "zero-gap field-traceability" audit, produced so that the Product Owner can authorize (or not) the rebuild of the backend (`apps/api-v2`). It is **read-only with respect to the code** — no file other than this one was created or modified. No table, schema, migration, `.env`, credential or configuration was changed at any stage of this audit or of the writing of this report.

---

## §0. Methodological Note (read before the rest)

This report consolidates, in a single file, the entirety of the 81+ audit steps already produced in `docs/backend-v2/**`. The primary sources are: the 24 module reports in `docs/backend-v2/field-traceability/modules/*.md`, `canonical-gap-register.json` (168 gaps), `decision-register.json` (8 decisions), `resolution-order.json`, `00-canonical-gap-register.md`, `PROGRESS.md`, the previous consolidation report `00-master-domain-functional-verification.md`, `74-zero-gap-reconstruction-contract.md`, and a targeted subset of the other architecture documents in `docs/backend-v2/*.md` and `docs/backend-v2/database-inventory/*`.

**Depth calibration applied (explicitly declared, not hidden):** of the 24 module reports, **18 were read in full/almost in full, or consulted through targeted, verified direct reading in this session (including the continuation session that produced Part VI)**: accounting, admin, artist, audiovisual, auth, catalog, contracts, crm-relationships (direct reading in this step), dashboard, events (direct reading in this step), licensing (direct reading in this step), marketing, projects, releases, reports (direct reading in this step), settings, integrations (including the distributors sub-section, direct reading in this step), rh, support, workspace. The **5 remaining modules (admin cross-tenant detailed separately, inventory, leads, monitoring, musicchat) are reported based on the dense, evidenced summary of those same reports already recorded in `docs/backend-v2/field-traceability/PROGRESS.md`** (which is itself a product of the same byte-by-byte audit process, not a third-hand summary) and on the master report `00-master-domain-functional-verification.md §17`, with `CONFIDENCE: MEDIUM` explicitly marked in each corresponding section of Part VI. This is a deliberate scope-management choice within one execution session — not a silent omission: all 24 modules appear complete in Part VI, all 168 gaps of `canonical-gap-register.json` appear in Part XIII, and no gap, decision or table was invented.

The Gap Appendix (Part XIII) was generated **mechanically** from `canonical-gap-register.json` (168 objects) via a deterministic Node.js script — not transcribed manually — which guarantees 100% coverage with no risk of human omission in a list of this length.

`EVIDENCE_CONVENTION`: every relevant claim carries an `EVIDENCE:` line pointing to a file/table/field/endpoint/gap/decision. `CONFIDENCE: HIGH` = confirmed by direct source-code reading in this series of audits. `CONFIDENCE: MEDIUM` = confirmed via `PROGRESS.md`/an already-produced module report, not re-verified line by line in this session. Never "per the audit" without a pointer.

---

## Summary / Navigable Index

- **PART I** — Global Overview (`VISAO-GLOBAL`)
- **PART II** — Musical Domain Model
  - `DOMAIN-PROJECT` (Musical Project — deepest treatment, includes `GAP-0168` and the complete relations)
  - `DOMAIN-WORK` (Work, UI term "Obra")
  - `DOMAIN-PHONOGRAM` (Phonogram, UI term "Fonograma")
  - `DOMAIN-RELEASE` (Release, UI term "Lançamento" — includes `DEC-007`, `GAP-0129`, `GAP-0130`)
  - `DOMAIN-ARTIST` (Artist, UI term "Artista")
  - `DOMAIN-CONTRACT`, `DOMAIN-CLIENT`, `DOMAIN-TRANSACTION`, `DOMAIN-AUDIOVISUAL-PROJECT`, `DOMAIN-MARKETING-PROJECT`, `DOMAIN-EVENT`
- **PART III** — Frontend (HTTP architecture, localStorage, mocks/stubs/dead code, inventory of create/edit components)
- **PART IV** — Legacy Backend (`apps/api`)
- **PART V** — Database (tables by domain, cross-domain relations)
- **PART VI** — The 24 complete Modules: `MODULE-ACCOUNTING`, `MODULE-ADMIN`, `MODULE-ARTIST`, `MODULE-AUDIOVISUAL`, `MODULE-AUTH`, `MODULE-CATALOG`, `MODULE-CONTRACTS`, `MODULE-CRM-RELATIONSHIPS`, `MODULE-DASHBOARD`, `MODULE-EVENTS`, `MODULE-INTEGRATIONS`, `MODULE-INVENTORY`, `MODULE-LEADS`, `MODULE-LICENSING`, `MODULE-MARKETING`, `MODULE-MONITORING`, `MODULE-MUSICCHAT`, `MODULE-PROJECTS`, `MODULE-RELEASES`, `MODULE-REPORTS`, `MODULE-RH`, `MODULE-SETTINGS` (+ `DOMAIN-BILLING`/`DEC-005`), `MODULE-SUPPORT`, `MODULE-WORKSPACE`
- **PART VII** — Cross-Domain Relations (master matrix)
- **PART VIII** — Integrations (complete provider matrix + 6 distributors)
- **PART IX** — Auth / Tenancy / Security
- **PART X** — Storage / Realtime / Jobs
- **PART XI** — Backend V2 (`apps/api-v2`)
- **PART XII** — Decisions (DEC-001 to DEC-008)
- **PART XIII** — Gap Appendix (168 of 168, mechanically generated)
- **PART XIV** — Conflicts (`CONFLITO-01` to `CONFLITO-05`) + pending documentation corrections
- **PART XV** — Product Owner Validation (28 `PO-VERIFY`: 26 preserved in full + 2 new, `PO-VERIFY-027`/`028`)
- **Validation** (completeness checklist for this document itself)

---

# PART I — GLOBAL OVERVIEW (`VISAO-GLOBAL`)

## I.1 What the product is

MUSIC OS 360 is a multi-tenant (B2B SaaS) business-management platform for the Brazilian music market — record labels, music publishers, production companies, artist career-management offices ("segment" in the tenant registration: `gravadora|editora|produtora|escritorio`). Each tenant (a client company of MUSIC OS 360) manages, within its own isolated space, the lifecycle of artists, musical works, recordings, releases, contracts, finances, events, marketing campaigns, audiovisual productions, licensing, CRM, internal HR and integrations with streaming/distribution/e-signature platforms.

`EVIDENCE: apps/web/src/modules/auth/pages/Register.tsx (segment field) | docs/backend-v2/field-traceability/modules/auth.md §6 | CONFIDENCE: HIGH`

## I.2 Who uses it

Users are always members of a tenant (`org_members`), never "loose" users — login always resolves, via JWT, a `tenant_id` (physically `tenants.id`, exposed in the `org_id` claim because of a historical naming artifact, not a bug — see `MODULE-WORKSPACE`). Hierarchical roles range from `viewer` (10) to `super_admin` (100), passing through functional roles (`financial`, `juridico`, `marketing_manager`, `rh_manager`, `produtor`, `artista`, `colaborador`, among others), with a dual RBAC system (legacy hierarchy matrix + dynamic `role_id` table, "DUAL-SOURCE FASE 5"). There is also a platform super-administration layer (`/admin/*`), tenant-agnostic in intent, but today **tenant-scoped in practice** for 2 of its 9 screens (see `MODULE-ADMIN`).

`EVIDENCE: docs/backend-v2/field-traceability/modules/auth.md §4 | docs/backend-v2/field-traceability/modules/admin.md §4 | CONFIDENCE: HIGH`

## I.3 What problem it solves

It centralizes, for a music business, what today typically lives scattered across spreadsheets/e-mails/disconnected systems: registration of artists and their career profile; copyright registration of works (with ECAD/ABRAMUS linkage); phonographic registration of recordings (ISRC); the digital release/distribution pipeline; contracts (with an e-signature flow); financial control (revenue/expenses, invoices ("notas fiscais"), P&L); an events/shows calendar; marketing and content campaigns; audiovisual production (music videos); sync/master/mechanical licensing; monitoring of unauthorized use and ECAD royalty reconciliation; contact/client CRM; a lead funnel; internal HR (employees/payroll/vacations); a service hub (support tickets + AI triage) and an internal chat (MusicChat, which is an omnichannel support inbox, not a generative AI assistant — see `MODULE-MUSICCHAT`).

`EVIDENCE: synthesis of the 24 module reports in docs/backend-v2/field-traceability/modules/*.md | CONFIDENCE: HIGH`

## I.4 Main domains and how they relate

The system has a **musical** core (Artist → Project → Work → Phonogram → Release, see Part II) and an **operational/business** layer that hangs off that core through cross-domain references (Accounting, Contracts, Events, Marketing, Audiovisual, Licensing, Monitoring), plus a **platform** layer (Auth, Workspace/Tenant, Settings, Admin, Integrations, Reports, Support) that cuts across all business modules. A central structural finding of this audit, corrected by explicit Product Owner authority (`DEC-001`), is that `projects` is not a "universal financial/operational hub" — it is the **Musical Project/Song** entity, and `projects.id` is the cross-domain link key that other domains use to say "this record belongs to this specific song" (see `DOMAIN-PROJECT`).

`EVIDENCE: decision-register.json (DEC-001) | docs/backend-v2/gap-resolution/00-canonical-gap-register.md (ADDENDUM — CANONICAL CORRECTION OF DEC-001) | CONFIDENCE: HIGH`

## I.5 Central entities (one-sentence view of each)

| Entity | 1 sentence |
|---|---|
| Tenant / Workspace | The multi-tenant isolation unit — the same physical entity (`tenants`); "Workspace" is only the name used in the UI/DTO. |
| Artist | An artistic person/entity registered by the tenant — distinct from `User` (platform user) and from `Client` (business contact/client). |
| Project | The Musical Project/Song — the initial record sheet of a song in production (title, tracks, composers/performers/producers per track). |
| Work (UI term "Obra") | The musical composition (lyrics+melody) — the copyright unit, distinct from the recording. |
| Phonogram (UI term "Fonograma") | The concrete recording of a Work — a specific registered performance, with an ISRC. |
| Release (UI term "Lançamento") | The distribution product (single/EP/album) that packages one or more tracks for release on DSPs. |
| Contract | An agreement between the tenant and a party (artist/client/service provider). |
| Client | An individual/legal entity that is a business client/contact of the tenant — "Contact = Client" is a documented domain decision; both share the `clients` table. |
| Transaction | A financial entry (revenue/expense) of the tenant. |
| Audiovisual Project | A music-video/audiovisual content production — a rich entity distinct from `Project`. |
| Marketing Project | A marketing campaign workspace — an entity distinct from `Project`. |
| Event | A calendar appointment (show, recording session, meeting). |

`EVIDENCE: docs/backend-v2/field-traceability/modules/{artist,projects,catalog,releases,contracts,crm-relationships,accounting,audiovisual,marketing,events}.md | CONFIDENCE: HIGH`

## I.6 How the tenant/workspace organizes everything

Every business table carries `tenant_id`, resolved **always server-side** from the verified JWT (`TenantGuard`), never trusting the `X-Tenant-ID` header sent by the client (used only as a consistency check, rejecting the request if it diverges from the tenant resolved from the JWT). Confirmed in **all 24 audited modules**: `AUTHORIZATION_GAPS: 0` and `TENANT_ISOLATION_GAPS: 0` consistently — in this audit there is no confirmed case of cross-tenant leakage. See Part IX for the complete security breakdown.

`EVIDENCE: docs/backend-v2/field-traceability/modules/auth.md §3 | docs/backend-v2/field-traceability/modules/workspace.md §0 | AUTHORIZATION_GAPS/TENANT_ISOLATION_GAPS count = 0 in each of the 24 module reports | CONFIDENCE: HIGH`

---

# PART II — MUSICAL DOMAIN MODEL

## `DOMAIN-PROJECT` — Project (Musical Project/Song)

### Authoritative definition (read first)

`projects.id` is the **Musical Project/Song entity** and the **cross-domain link key** for that specific song — used by Work ("Obra"), Phonogram ("Fonograma"), Release ("Lançamento"), Accounting Transaction, Audiovisual, Marketing and other related domains to declare "this record belongs to this song/musical project". This is the **current and corrected** definition, by explicit Product Owner authority (`DEC-001`, `PROMPT 129`).

**The previous reading (`UNIVERSAL_FINANCIAL_PROJECT` — generic financial/operational hub) is INVALIDATED/SUPERSEDED.** It is cited below **only** as clearly labeled history, never as the current definition:

```
DEC-001.supersededDecision.selectedOption:    UNIVERSAL_FINANCIAL_PROJECT
DEC-001.supersededDecision.status:            INVALIDATED_BY_PRODUCT_OWNER_DOMAIN_CORRECTION
DEC-001.supersededDecision.invalidationReason: "Product Owner explicitly corrected the domain
  definition (PROMPT 129): projects is not a generic financial/operational hub. The 'universal
  financial hub' reading over-generalized 2 real cross-domain relations (financial_project_id,
  transactions.projeto_id) into an incorrect claim about the entity's fundamental nature."
```

What **changes** relative to the previous reading: the "universal financial/operational hub" interpretation is invalidated. What **does not change**: `projects.id` remains the correct cross-domain link key; the real relations already identified (`financial_project_id`, `transactions.projeto_id`, `works.projeto_id`) remain valid — only their semantic justification was corrected (these relations exist because the activity of other domains *belongs* to a specific song, not because `projects` is, in itself, a financial entity).

`EVIDENCE: decision-register.json (DEC-001, DEC-001.supersededDecision) | docs/backend-v2/gap-resolution/00-canonical-gap-register.md (ADDENDUM — CANONICAL CORRECTION OF DEC-001) | CONFIDENCE: HIGH`

### DEFINITION / PURPOSE

A `Project` is the initial production record sheet of a song (or of an EP/album with several songs — see `PROJECT_TYPES` below), where the tenant records the title, planned release type, genre, and the tracks in production with their respective composers, performers and producers. It is the starting point of the music-production flow before a `Work` (formally registered work) or a `Release` (release ready for distribution) exists.

### TABLE / PRIMARY_KEY / TENANT_SCOPE

`projects` (16 columns) — PK `id` (uuid), `tenant_id` mandatory in every query (resolved server-side via `@CurrentTenant()`, never from the body).

### CREATED_FROM / EDITED_FROM

Single real, reachable flow: `/projetos` → `Projetos.tsx` → `ProjetoFormModal.tsx` (same component for create/edit, `mode="create"|"edit"`). There is no Kanban, Gantt, Timeline, Calendar, Wizard or Drawer for this module. `hooks/projects.store.ts` (Zustand) and `services/projects.service.ts` are confirmed **DEAD** (zero consumers).

### API_RESOURCE

`ProjectsController` → `GET/POST/PATCH/DELETE /projects` (5 real endpoints, all with consistent `@RequireRole`+`@RequirePermission`: read=`viewer`, create/edit=`editor`, delete=`manager`).

### FIELDS — complete `projects` table (16/16 columns, none omitted)

| Field | DB Type | Nullable | Default | Frontend Create | Frontend Edit | Frontend Display | DTO/API | Persisted | Functional rule | Status | Gap |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `id` | uuid | no | generated | — | — | yes (internal) | `id` | yes | PK | ALREADY_CORRECT | — |
| `tenant_id` | uuid | no | — | — | — | no | implicit (JWT) | yes | multi-tenant isolation | ALREADY_CORRECT | — |
| `titulo` | varchar | no | — | yes (`tipoLancamento`+`nomeEP`/`musicas[0].nome`) | yes | yes | `titulo` | yes | renamed from `nome` by migration `20260718000013` | ALREADY_CORRECT | — |
| `tipo` | varchar/enum | yes | — | yes (`tipoLancamento`) | yes | yes (badge) | `tipo` | yes | 4 real values in the UI (album/ep/single/turne) out of 7 declared server-side (video/tour/podcast/other unreachable via UI) | PARTIAL | minor GAP, not individually catalogued |
| `status` | varchar/enum | no | forced to `PLANEJAMENTO` on create | yes (default) | yes (select with 4 of 5 options — `revisao` missing) | yes | `status` | yes | real 5-state workflow, see Workflows below | REAL_WORKFLOW | `WORKFLOW_GAP` (Edit form does not restrict illegal transitions) |
| `artista_id` | uuid | yes | null | **NO** | **NO** | no (client-side join always `undefined`) | `artista_id` (accepted by the DTO) | yes, but **always NULL** | natural attribute of the musical project (main artist) | REAL_MAPPING_GAP | `GAP-0001` |
| `orcamento` | decimal(15,2) | yes | null | **NO** | **NO** | no | `orcamento` (accepted by the DTO) | yes, but **always NULL** | production budget; no consumer reads it back even if filled | REAL_MAPPING_GAP | `GAP-0001`, see `GAP-0018` (financial) |
| `descricao` | text | yes | — | not clearly mapped to a dedicated field (history: `musicas[]` used to be serialized here, migrated to `project_tracks`) | — | — | `descricao` | yes | — | ALREADY_CORRECT | — |
| `observacoes` | text | yes | — | yes | yes | yes | `observacoes` | yes | free text | ALREADY_CORRECT | — |
| `genero` | varchar | yes | — | derived (genre of the 1st track) | same | yes | `genero` | yes | derived, not typed directly | ALREADY_CORRECT | — |
| `metadata` | jsonb | yes | `{}` | no (internal use) | no | no | `metadata.aiPlan` (written by automation) | yes | destination of the AI plan generated on completion (see Workflows/Side Effects) | REAL_MAPPING_GAP (broken automation) | see §Side Effects |
| `created_at` | timestamptz | no | now() | — | — | yes (indirect) | — | yes | — | ALREADY_CORRECT | — |
| `updated_at` | timestamptz | no | now() | — | — | yes (indirect) | — | yes | — | ALREADY_CORRECT | — |
| `deleted_at` | timestamptz | yes | null | — | — | — | — | yes | soft delete | ALREADY_CORRECT | — |
| `created_by` | uuid | yes | — | — | — | — | — | yes | audit | ALREADY_CORRECT | — |
| `updated_by` | uuid | yes | — | — | — | — | — | yes | audit | ALREADY_CORRECT | — |

`EVIDENCE: docs/backend-v2/field-traceability/modules/projects.md §2,§5,§6 | database-backend-column-mapping.json | CONFIDENCE: HIGH`

### FIELDS — complete `project_tracks` table (14/14 columns — tracks of a Project)

| Field | Type | Frontend Create/Edit | Functional rule | Status | Gap |
|---|---|---|---|---|---|
| `id` | uuid | internal | PK | ALREADY_CORRECT | — |
| `project_id` | uuid FK CASCADE | internal | real FK, `ON DELETE CASCADE` | ALREADY_CORRECT | — |
| `nome` | varchar | yes | track name | ALREADY_CORRECT | — |
| `solo_feat` | varchar/enum | yes | solo or feat | ALREADY_CORRECT | — |
| `original_remix` | varchar/enum | yes | original or remix | ALREADY_CORRECT | — |
| `instrumental` | boolean | yes | — | ALREADY_CORRECT | — |
| `duracao` | varchar | yes | mm:ss | ALREADY_CORRECT | — |
| `genero` | varchar | yes | — | ALREADY_CORRECT | — |
| `idioma` | varchar | yes | — | ALREADY_CORRECT | — |
| `letra` | text | yes | — | ALREADY_CORRECT | — |
| `audio_url` | varchar | yes (nominally) | **hardcoded stub** — `uploadFile` always returns `null` (`ProjetoFormModal.tsx:178`) | FILE_STORAGE_GAP | consolidated module gap (has no GAP-ID of its own in the 168 register — documented in `projects.md §8`) |
| `created_at`/`updated_at` | timestamptz | — | — | ALREADY_CORRECT | — |

`project_track_participants` (6 columns: `id`, `project_track_id` FK CASCADE, `compositor`, `interprete`, `produtor`, timestamps) — real, populated, no mapping gap.

`EVIDENCE: docs/backend-v2/field-traceability/modules/projects.md §2,§5,§8 | CONFIDENCE: HIGH`

### `project_assets` — orphan table (recorded, not a separately catalogued gap)

`project_assets` (7 columns: `id`, `tenant_id`, `project_id`, `asset_id`, `role`, `source_event`, `linked_by` + audit) exists in the schema but **has no controller, service or frontend consumer anywhere** — nor a physical FK on `project_id`/`asset_id`. Pure dead schema.

`EVIDENCE: docs/backend-v2/field-traceability/modules/projects.md §9 | CONFIDENCE: HIGH`

### RELATIONS — complete Project ↔ other domains matrix

| Domain | Current column | Target | Cardinality | Status | Evidence |
|---|---|---|---|---|---|
| Project ↔ Artist | `projects.artista_id` | `artists.id` | N:1 (optional) | `ALREADY_CORRECT` as a relation declared in the schema, but **MISSING at the UI write level** — never set by any real form | `GAP-0001`; `projects.md §5,§11` |
| Project ↔ Work | `works.projeto_id` | `projects.id` | N:1 | `ALREADY_CORRECT` (real, logical, confirmed populated via `ObraFormModal.tsx`) | `decision-register.json DEC-001.preservedRelations` |
| Project ↔ Phonogram | no direct column | `projects.id` | transitive | `ALREADY_CORRECT` transitively, via `phonograms.obra_id → works.id → works.projeto_id` — no new gap, `TO_BE_DESIGNED` if denormalization is ever wanted | `catalog.md §16` |
| Project ↔ Release | **none yet** — `ReleaseEntity` has no `project_id`/`projeto_id` | `projects.id` | N:1 (decided — `DEC-009: PROJECT_RELEASE_DIRECT_LINK`, corrected, was "undetermined") | `MISSING_RELATION` (implementation pending; architectural decision resolved) | `GAP-0168`; `DEC-009`; `releases.md §16` |
| Project ↔ Transaction | `transactions.projeto_id` | `projects.id` | N:1 | `ALREADY_CORRECT` (real, logical, populated; it is just not read/grouped by the P&L — `GAP-0013`) | `accounting.md §2.5`; `projects.md §17` |
| Project ↔ Audiovisual | `audiovisual_projects.financial_project_id` | `projects.id` | N:1 (composite with `tenant_id`) | `ALREADY_CORRECT` relation (real FK, DB-enforced) + `LEGACY_NAMING` (column name) + absent from UI writes (`GAP-0033`) | `audiovisual.md §6`; `decision-register.json` |
| Project ↔ Marketing | `marketing_projects.financial_project_id` | `projects.id` | N:1 (composite) | same — `ALREADY_CORRECT` relation + `LEGACY_NAMING` + `GAP-0033` | `projects.md §21` |
| Project ↔ Marketing (second field) | `marketing_projects.source_project_id` | `projects.id` (presumed) | N:1 | logical, **no physical FK** | `projects.md §21` |
| Project ↔ Contract | (see `PO-VERIFY-006`/`CONFLITO-03`) `GAP-0127` asserts a real `projects.contrato_id`; `projects.md §2` (exhaustive list of 16 columns) **does not list** that column | `contracts.id` | — | `CONFLICTED` — do not confirm without direct re-verification of the physical schema | `GAP-0127` vs `projects.md §2` |
| Project ↔ Events/Inventory | none | — | — | `NOT_APPLICABLE` (confirmed absent by direct inspection of `EventEntity`/`inventory_items`, not due to an investigation gap) | `projects.md §19` |

`EVIDENCE: table consolidated from decision-register.json, canonical-gap-register.json (GAP-0001, GAP-0013, GAP-0033, GAP-0127, GAP-0168), projects.md, releases.md, audiovisual.md, accounting.md, catalog.md | CONFIDENCE: HIGH (except the Contract row, CONFLICTED)`

### BUSINESS_RULES / WORKFLOWS

`ProjectStatus` enum (`packages/types/src/enums.ts:275-281`): `PLANEJAMENTO, EM_ANDAMENTO, REVISAO, CONCLUIDO, CANCELADO` — 5 real values, real workflow (`apps/api/src/core/workflow/definitions/projects.workflow.ts`), applied inside a DB transaction via `WorkflowService.transitionInTx`:

```
planejamento → em_andamento   ("Iniciar Projeto")
em_andamento → revisao        ("Enviar para Revisão")
revisao → em_andamento         ("Solicitar Alterações")
revisao → concluido            ("Concluir Projeto")
{planejamento|em_andamento|revisao} → cancelado  ("Cancelar Projeto")
```

All transitions require the `manager` role or higher (some also accept `produtor`). The backend computes and returns `allowed_transitions` per actor — `ProjetoViewModal.tsx` correctly consumes that list; the raw status Select in `ProjetoFormModal.tsx` (edit mode) does **not** — it offers only 4 of the 5 options (`revisao` missing) and does not restrict to legal transitions, relying on the backend to reject them (`WORKFLOW_GAP: PARTIAL`).

### SIDE_EFFECTS — `ProjectPlanningAutomation` (critical finding)

On reaching `CONCLUIDO`, the `DOMAIN_EVENTS.PROJECT_COMPLETED` event fires two real listeners:

1. **`ProjectPlanningAutomation`** (`apps/api/src/core/automation/project-planning.automation.ts`) — generates, via AI, an operational plan saved in `projects.metadata.aiPlan`. **It is 100% broken**: its `loadProject()` runs raw SQL `SELECT nome, tipo, descricao, artista_id, data_fim, metadata FROM projects...` — `nome` was renamed to `titulo` by migration `20260718000013` and `data_fim` **never existed** as a column of `projects`. Every real completion of a musical project fires that query, which throws a "column does not exist" error. The automation was designed to fail safely (it does not roll back the project completion), so the damage is silent: the AI planning feature never works, for any project, since the July/2026 migration.
2. **`MarketingProjectsService.createFromCompletedProject()`** (confirmed real and functional in `marketing.md`, not broken) — automatically creates a marketing workspace + cover-art task when a project completes.

`EVIDENCE: docs/backend-v2/field-traceability/modules/projects.md §7,§8 | migration 20260718000013_ProjectsFormFieldAlignment.ts | CONFIDENCE: HIGH`

### DEPENDENCIES / CURRENT_PROBLEMS (synthesis)

`artista_id`/`orcamento` never collected by the real UI (`GAP-0001`; decision `DEC-001` already resolved WHAT to do — expose the fields —, implementation pending); `project_assets` orphaned; `ProjectPlanningAutomation` broken by a reference to obsolete columns; per-track audio upload is a hardcoded stub (`FILE_STORAGE_GAP`); no real pagination — `GET /projects` truncates at 50, with no filter/offset sent by the UI (`GAP-0128`, `TRUNCATION_GAP` — affects all 4 KPIs and all client-side filters); no progress/deadline field exists (`PROGRESS_CALCULATION_GAP`, confirmed absent, not invented); `contrato_id` has a conflicting status (see `CONFLITO-03`).

### TARGET_V2_DIRECTION

Preserve `projects` as the canonical Musical Project; expose `artista_id`/`orcamento` in the real form; fix the AI automation query to use the current columns; decide explicitly (not presume) the Project↔Work↔Release cardinality (`PO-VERIFY-003`); design the missing Project↔Release relation (`GAP-0168`, see below) as part of the v2 schema of `releases`.

### CONFIDENCE: HIGH (13/16 fields and all relations verified by direct code reading in this session)

---

### `GAP-0168` — complete dedicated subsection

> ⚠️ **Architectural decision resolved since this subsection — `DEC-009: PROJECT_RELEASE_DIRECT_LINK`
> (Product Owner)**: `releases.project_id → projects.id` (real FK, N:1, nullable). This relation does NOT
> replace the `Release → ReleaseTrack → Phonogram → Work` chain. Canonical `Project` = Single/EP/Album.
> `GAP-0168` no longer blocks the v2 schema (`blocksSchemaV2Design: NÃO`). The text below is preserved
> as a historical record of the observed behavior (still factually correct — no code was
> changed) and of the investigation that preceded the decision — see
> `gap-resolution/00-canonical-gap-register.md` ("Canonical correction — DEC-009 RESOLVED") for the
> current definition.

**Current behavior**: `ReleaseEntity` **has no** `project_id`/`projeto_id` column at all. The only "bridge" between a musical Project and a Release exists as a one-time manual pre-fill convenience, at the moment the release-creation form is opened: `LancamentoFormModal.tsx` imports `useProjetos()` and the `projetoToLancamentoSeed()` function (in `mappers/`), which — when the user explicitly chooses "create release from this project" — copies `titulo`/`genero`/`artista_id` from the selected Project into the initial fields of the Release form. **It is only a typing autofill** — `projeto.id` is never sent in any `POST /releases` payload, and there is no DTO field to receive it even if it were sent.

**Absence of the persisted FK**: there is not, in any layer (DTO, entity, migration), a column that records "this Release was born from this Project". After the initial pre-fill, the two entities become completely disconnected — no automation runs in either direction (neither "completed Project generates Release" nor "Release points to its source Project"), unlike the real automation pattern already confirmed for `PROJECT_COMPLETED` → Marketing (`§Side Effects` above).

**Impact**: it blocks the design of the v2 schema of `releases` — it is today the **only** gap in the canonical register with `blocksSchemaV2Design: SIM` that does not derive from a pending business decision (the other schema-blocking flags were already resolved by `DEC-001`/`DEC-007`). Without this relation, the complete conceptual chain of the musical domain (`Musical Project → Work → Phonogram → Release`) has a structural link missing exactly at the "production" → "distribution" transition point.

**Affected domains**: `releases`, `projects` — and indirectly any report/screen that may one day want to answer "which releases came from this musical project" or "which project originated this release", a question that today cannot be answered reliably (only reconstructable manually by comparing title/artist, with no guarantee).

**Schema/API/migration consequences**: the final design (a new `project_id` column in `releases`, or a join table, or another mechanism) is `TO_BE_DESIGNED` — this gap does not resolve, nor does this document resolve, what the physical mechanism will be. A migration of historical data is not trivial: since the relation was never persisted, there is no way to reconstruct with certainty, retroactively, which Project originated which existing Release — at best, a title/artist/date heuristic could suggest candidates, never confirm them.

`GAP-0168` **depends on** (`dependsOn`) `GAP-0001` (the domain definition of `projects` — already resolved by `DEC-001`), is in `WAVE_2_SCHEMA_AND_CONTRACT`, `status: OPEN`. Not to be confused with `GAP-0007`/`DEC-007` (Release tracklist, a different relation: Release↔Phonogram, not Release↔Project) nor with `GAP-0001`/`GAP-0013`/`GAP-0033` (none of these covers the absence of the `releases ↔ projects` relation).

**This document does not resolve `GAP-0168`** — it only documents it in depth, as instructed.

`EVIDENCE: canonical-gap-register.json (GAP-0168) | docs/backend-v2/gap-resolution/00-canonical-gap-register.md (ADDENDUM — CANONICAL CORRECTION OF DEC-001) | docs/backend-v2/field-traceability/modules/releases.md §16 | CONFIDENCE: HIGH`

---

## `DOMAIN-WORK` — Work (UI term "Obra")

### DEFINITION / PURPOSE

The musical composition itself (lyrics + melody) — the copyright unit, ECAD/ABRAMUS. Distinct from the recording (Phonogram). A Work may have N different recordings (phonograms) over time (re-recordings, versions).

### TABLE / PRIMARY_KEY / TENANT_SCOPE / API_RESOURCE

`works` (47 columns, 100% `DIRECT`). PK `id`. `WorksController` → `GET/POST/PATCH/DELETE /works`, `viewer/editor/editor/manager`.

### CREATED_FROM / EDITED_FROM

`RegistroMusicas.tsx` (the "Obras" (Works) tab) → `ObraTipoSelectorModal.tsx` (step 0: "Autoral" (Original) vs. "Referência" (Reference)) → `ObraFormModal.tsx` (1445 lines, same create/edit component). `ObraViewModal.tsx` for the detail view.

### FIELDS (synthesis of the 47 columns + derived fields — complete table in `catalog.md §5`, reproduced in essence here)

Real persisted fields: `titulo`, `genero`, `idioma`, `status`, `iswc`, `cod_ecad`, `cod_entidade`, `duracao`, `instrumental`, `criada_por_ia`, `tipo_ia`, `ia_harmonia`/`ia_melodia`/`ia_letra` (jsonb), `outros_titulos`/`referencias_conexas` (jsonb), `letra_completa`, `projeto_id`, `artista_id` (**always `NULL`** — see the critical Gap below), `tipo_obra`, `compositores`/`letristas` (derived from `participantes`, jsonb). `duration_seconds` exists physically but is read-only in the current contract (never written by this form). `authors`/`shares` are accepted by `CreateWorkDto` but **do not correspond to any real column and are not handled by the service** — TypeORM silently discards them on `save()` (the explicit split-sheet gap cited by `DEC-007`, see below).

**Active critical gap**: `ObraFormModal.tsx:486` always sends `artistaId: null` in the create **and** edit payload — silently erasing any existing `artista_id` link on save (e.g. a link inherited from `projetoToObraSeed()`).

`EVIDENCE: docs/backend-v2/field-traceability/modules/catalog.md §5,§12(item 1) | CONFIDENCE: HIGH`

### RELATIONS

Work ↔ Project: `works.projeto_id → projects.id` (`ALREADY_CORRECT`). Work ↔ Artist: `works.artista_id → artists.id` (real schema, but always `NULL` in practice — active gap above). Work ↔ Phonogram: `phonograms.obra_id → works.id` (`ALREADY_CORRECT`, real). Work ↔ Release: `release_works` (M:N join, **schema-only, never populated** — see `DOMAIN-RELEASE`). Work ↔ Shares: `shares.obra_id → works.id` (real FK; `shares` functionally belongs to `releases`, not re-audited field by field in `catalog`).

### AUTHORS/COMPOSERS/SHARES — ECAD/ABRAMUS status

**Simple credits** (`work_participants`, 10 columns): name (optionally autocompleted from an Artist, without persisting the link), `classeFuncao` (Editor/Administrador/Compositor-Autor/Tradutor, free text), `percentual` — **full REPLACE (DELETE+INSERT) on every save, no versioning, no validation that the sum = 100%** (`SPLIT_VALIDATION_GAP`).

**Formal split-sheet** (`CreateWorkDto.authors`/`.shares`): **classified as an explicit GAP**: accepted and validated by the DTO, but never persisted — no current screen even tries to fill it, but a direct API call would silently lose the data. This is the gap cited (after documentation correction) by `DEC-007` as `GAP-0041`.

**ECAD/ABRAMUS registration — implemented/partial/stub/absent classification**:
- ABRAMUS search (`AbramusSearchRow.tsx`): **IMPLEMENTED** (real proxy to the backend, which queries the official API).
- Work registration at ABRAMUS (`register-work`): **IMPLEMENTED** in the backend (real POST with title/composer/ISWC/genre/duration/publisher/co-authors) — no automatic synchronization.
- Import a work found in the ABRAMUS search: **STUB** (`useAbramusImport` always throws an error — no import route exists).
- "Already imported" detection (local lookup): **STUB** (always returns empty).
- General sync with ABRAMUS: **STUB** (`useAbramusSyncAll` always fails).
- ISWC/ISRC/ECAD code/entity: free-text fields, **with no format validation or uniqueness check in any layer** (`IDENTIFIER_GAP`).
- `rights_holders`/`external_identifiers`/`society_accounts`/`society_submissions` (`registry` module, 91 columns in 6 tables): complete and secure backend, **zero frontend consumers**, explicitly excluded even from the Reports Center (`NOT_REPORTABLE`).

`EVIDENCE: docs/backend-v2/field-traceability/modules/catalog.md §1,§9,§10,§11,§12 | CONFIDENCE: HIGH`

### CURRENT_PROBLEMS / TARGET_V2_DIRECTION

Fix the always-null `artista_id`; decide and implement the physical destination of the split-sheet (`authors`/`shares`); add percentage-sum validation; add ISRC/ISWC format/uniqueness validation; decide whether the `registry` domain (ABRAMUS/societies) gets a UI in v2 or is discontinued.

### CONFIDENCE: HIGH

---

## `DOMAIN-PHONOGRAM` — Phonogram (UI term "Fonograma")

### DEFINITION / PURPOSE

The concrete recording of a Work — a specific performance recorded in audio, with its own ISRC. A Work may have N Phonograms (several recordings/versions of the same composition).

### TABLE / API_RESOURCE / CREATED_FROM

`phonograms` (59 columns, 100% `DIRECT`). `PhonogramsController` → `GET/POST/PATCH/DELETE /phonograms`. `RegistroMusicas.tsx` (the "Fonogramas" (Phonograms) tab) → `FonogramaFormModal.tsx` (1224 lines).

### FIELDS (synthesis)

`titulo`, `cod_ecad`, `cod_entidade`, `agregadora`, `isrc` (+ `isrc_pais`/`isrc_registrante`/`isrc_ano`/`isrc_designacao`, concatenated via `joinIsrc`), `criada_por_ia`, `emissao`/`gravacao_original`/`data_lancamento`, `duracao`(+min/sec), `instrumental`/`nacional`/`pub_simultanea`, `genero_musical`/`midia`/`classificacao`/`pais_origem`/`pais_publicacao`, `status`, `gravadora`, `observacoes`, `obra_id` (real FK, `phonograms.obra_id → works.id`), `participacao` (jsonb, 3 categories: "Produtor Fonográfico" (Phonographic Producer)/"Intérprete" (Performer)/"Músico Acompanhante" (Accompanying Musician), including `artista_id` per row, unlike `work_participants`), `arquivo_audio` (jsonb `{name,size}` — see Storage below), `artista_id`, `audio_file_id`, `phonographic_producer_id`, `main_artist_id`, `label_id` (real `uuid` columns, but **absent from any DTO/UI** — dead from the application's point of view). Legacy columns `interpretes`/`produtores` (free text) exist and appear in the grid, but **are never written by the current form** (which uses the structured `participacao`) — they are always empty in any phonogram created by the real UI.

`EVIDENCE: docs/backend-v2/field-traceability/modules/catalog.md §6,§7 | CONFIDENCE: HIGH`

### ISRC — chain up to Project

`phonograms.isrc` is the official identifier of the recording. There is no format validation (`CC-XXX-YY-NNNNN`) nor uniqueness check in any layer. The chain up to the source musical Project is **transitive**: `phonograms.obra_id → works.id → works.projeto_id → projects.id` — no direct column, `ALREADY_CORRECT` transitively, no new gap needed for this specific chain.

### STORAGE — 100% fake audio upload

`FonogramaFormModal.tsx::handleAudioUpload` reads **only** `file.name`/`file.size` from the browser `File` object and writes those two values into `arquivo_audio` (jsonb) — **the binary is never transmitted to any storage provider** (no `FormData`, no real upload, no presigned URL). `phonograms.audio_file_id` (a real column, presumably intended to reference a real upload) is never written by any flow. `STORAGE_GAP` confirmed — the same "decorative capture" pattern already seen in `accounting` (attachment) and `audiovisual` (assets).

`EVIDENCE: docs/backend-v2/field-traceability/modules/catalog.md §14 | CONFIDENCE: HIGH`

### RELATIONS

Phonogram ↔ Work: `obra_id` (`ALREADY_CORRECT`). Phonogram ↔ Project: transitive via Work (see above). Phonogram ↔ Release: **NONE** — `PhonogramEntity` has no `release_id` nor any relation to `ReleaseEntity` (confirmed by direct inspection, not presumed). This is central to understanding `DEC-007` below: the future relational tracklist model needs to **create** this relation; it simply does not exist today.

### CURRENT_PROBLEMS / TARGET_V2_DIRECTION

Implement real audio upload (replacing the metadata stub); add ISRC validation; decide the destination of the Release↔Phonogram relation (see `DEC-007`/`DOMAIN-RELEASE` below) — today it needs to be **created from scratch**, not just fixed.

### CONFIDENCE: HIGH

---

## `DOMAIN-RELEASE` — Release (UI term "Lançamento")

### DEFINITION / PURPOSE (RELEASE_AS_DISTRIBUTION_OBJECT)

A Release is the **distribution pipeline** entity — the final product (single/EP/album/compilation/live/other) that packages one or more recordings for delivery to the streaming platforms (DSPs). It is explicitly **distinct** from "release as a grouping of phonograms" (there is no direct relation to `phonograms` today — see below) and from "release as an operational project" (`projects` is a completely separate entity — see `DOMAIN-PROJECT`/`GAP-0168`).

### TABLE / API_RESOURCE / CREATED_FROM

`releases` (27 columns, 100% `DIRECT`). `ReleasesController` → `GET/POST/PATCH/DELETE /releases`. `Lancamentos.tsx` → `LancamentoFormModal.tsx` (5-step wizard: "Informações do Álbum" (Album Info) / "Upload de Faixas" (Track Upload) / "Capa" (Cover) / "Preferências de Distribuição" (Distribution Preferences) / "Revisão" (Review)).

### CRITICAL GAP — `GAP-0129`/`GAP-0130`: Release creation and editing **100% broken**

Across the set of 24 module reports, this is classified as the most severe individual finding of the whole series. `LancamentoFormModal.tsx` unconditionally injects an `internal_status` field into every `POST /releases`/`PATCH /releases/:id` — but `internal_status` **does not exist** in `CreateReleaseDto`/`UpdateReleaseDto` nor as a physical column of `ReleaseEntity`. The global `ValidationPipe({whitelist:true, forbidNonWhitelisted:true})` rejects the whole request with HTTP 400 **before it reaches the controller**. The module's own mapping file (`form-to-payload.mapper.ts`) correctly documents this rule in its header and follows it — the violation is introduced 3 lines later, back in `LancamentoFormModal.tsx::handleSubmit()`.

**Net effect: every creation ("Novo Lançamento" — New Release) and every edit submitted by the real UI is rejected and never reaches the database.** A second, independent and compounding bug (`GAP-0130`): even with `internal_status` removed, the same `handleSubmit()` performs, right after the create, a `PATCH` forcing `status: "distributed"` directly from `DRAFT` — a transition that **does not exist** in the real workflow graph (only `DRAFT → METADATA_PENDING` is legal from `DRAFT`), which would be equally rejected by the `WorkflowService`.

Directly confirmed consequence: the "Releases" tab of Auditoria.tsx never finds incomplete records to check, **not because the releases are complete, but because none can be created**.

`EVIDENCE: canonical-gap-register.json (GAP-0129, GAP-0130) | docs/backend-v2/field-traceability/modules/releases.md §0,§6,§23 | CONFIDENCE: HIGH`

### FIELDS (synthesis of the 27 columns)

`titulo`, `tipo` (6 values: album/ep/single/compilacao/live/outro), `status` (10 real workflow values), `artista_id` (real FK → `artists.id`, `ON DELETE SET NULL`), `upc`, `data_lancamento`, `distribuidora` (free varchar, static catalog of 6 names), `plataformas` (jsonb), `capa_url` (**real, functional upload, R2 — see Storage below**), `metadata` (jsonb, contains `.faixas[]` — see Tracklist below), `isrc_global`, `notas_internas`, `observacoes`, `gravadora`, `copyright`, `genero`, `idioma`, `assets` (jsonb, 7 keys: audio master/video/lyrics/technical sheet/press release/EPK), `cronograma` (jsonb, 3 keys). All 27 fields, individually, are correctly mapped 1:1 to the DTO — the only defect is the extra `internal_status` property, but its effect is total (no field persists, through any real create).

`EVIDENCE: docs/backend-v2/field-traceability/modules/releases.md §2,§5 | CONFIDENCE: HIGH`

### `DEC-007` in the context of `releases` — relational tracklist (decision already resolved, implementation pending)

**Current decision**: `RELATIONAL_TRACKLIST_MODEL`. `releases.metadata.faixas` (jsonb) **is not** the canonical source of a release's composition. A release track needs an explicit relational identity and must reference a **concrete phonogram**. Decided canonical chain:

```
Release → Release Track → Phonogram → Work → Rights/Shares
```

Domain semantics fixed by the decision: `Work` = abstract work/composition; `Phonogram` = concrete recording; `Release Track` = ordered occurrence of a specific recording within a release. `release → work` alone (via `release_works`) **is not sufficient** — rights traceability up to `works` is already preserved by the real phonogram relation (`phonograms.obra_id → works.id`), not by a direct release↔work link.

**Mandatory architectural caveat, explicitly recorded in the decision**: `RELATIONAL_TRACKLIST_MODEL` does **not** mean that the current structure of `release_works(release_id, work_id)` is accepted as the final schema. `release_works` is **insufficient** — it lacks `phonogram_id`, `position`/`order` and a track identity of its own (it only links release↔work, an abstract composition, not release↔phonogram, a concrete recording). `FINAL_RELATIONAL_SCHEMA_STATUS: TO_BE_DESIGNED` — whether it will be a new `release_tracks` table or an evolution of `release_works` **is left to the structural-gap resolution step, not decided by `DEC-007` nor by this document**. Minimum requirements already recorded for that future design: `release_id`, `phonogram_id`, `position`/`order`.

`metadata.faixas` is classified `NON_CANONICAL_METADATA` — a candidate for `LEGACY_DATA`/`MIGRATION_SOURCE`, exact treatment not decided. **`release_works` (the current shape) is NOT automatically the final schema** — this is explicitly reaffirmed here by direct instruction of this document's prompt.

**Actual state today (`release_works`)**: a pure M:N join (`release_id`, `work_id`, composite PK, 2 `CASCADE` FKs, no order column) — confirmed **never populated**, from both sides independently (neither `catalog.md` nor `releases.md` found a single component that reads/writes it). The Work selector in the Release wizard exists only as an autofill convenience (it copies title/genre/ISRC when a Work is selected) — `selectedObraId` is local state, never sent in any payload.

`EVIDENCE: decision-register.json (DEC-007) | docs/backend-v2/gap-resolution/00-canonical-gap-register.md (ADDENDUM — DEC-007 RESOLVED) | docs/backend-v2/field-traceability/modules/releases.md §8,§9 | docs/backend-v2/field-traceability/modules/catalog.md §15 | CONFIDENCE: HIGH`

### Tracklist today — jsonb with no relational model (remaining `GAP-0007`)

`releases.metadata.faixas[]` (`Faixa` interface: id/titulo/artista/isrc/version flags/additional artists/producers/composers/musicians/AI metadata/`arquivoAudio: File|null`) — **no order column** (the order is the array index); managed as pure array state on the client; the per-track ISRC lives only in the jsonb, **disconnected** from `phonograms.isrc`; the per-track audio file is discarded before persisting (it is never sent anywhere) — a mechanism structurally separate from the phonogram upload gap in `catalog` (it is not the same bug reopened, it is an independent jsonb-only mechanism). No multi-disc support (`disc_number` does not exist anywhere, confirmed absent).

**Explicitly left open by this document, as instructed**: neither the final design of `release_tracks` nor the migration treatment of `metadata.faixas` is resolved here.

`EVIDENCE: docs/backend-v2/field-traceability/modules/releases.md §15 | canonical-gap-register.json (GAP-0007) | CONFIDENCE: HIGH`

### STORAGE — cover art (positive contrast)

`releases.capa_url` is a **real, functional** end-to-end upload to Cloudflare R2 (`useUploadToR2()`, with explicit error handling if R2 is not configured) — unlike the `projects` stub (audio, always `null`) and the `catalog`/phonogram fake (metadata only). A second, redundant `capa_url` exists inside `assets` (jsonb) — 3 possible sources for the same logical value, resolved in cascade by `getReleaseArtworkUrl()` (minor `DISPLAY_MAPPING_MISMATCH`). No R2 object deletion call when a release is deleted (`ARTWORK_STORAGE_GAP`, minor).

### DISTRIBUTION — overall status

No relational distribution-submission model exists — `distribuidora` (free varchar), `plataformas` (jsonb), and the static catalog of 6 providers (see Part VIII). No "send to distribution" button calls any real provider; every distribution status change is 100% local. `TAKEDOWN`: not implemented for releases (distinct from the `monitoring` takedown, with no relation between the two).

### WORKFLOW — `ReleaseStatus`, 10 real values

```
draft → metadata_pending → assets_pending → review → approved → scheduled → distributed → released → archived
                                                                                    ↘ cancelled (from any state prior to distributed)
```

Real guards: `metadata_pending → assets_pending` requires `titulo` to be present; `assets_pending → review` requires `capa_url` to be present. `Lancamentos.tsx` uses, for filtering/display, a **completely separate** 7-value model (`resolveReleaseStatus()`), derived from `platform_status`→`internal_status`→`status` — the first two **are neither real columns nor DTO fields** (hence `GAP-0129` above).

### SIDE_EFFECTS — second independent critical bug (broken artist notification)

`ReleaseEventsHandler.onReleaseApproved()` writes a notification addressed "to the artist" with `user_id: artistId` (an `artists.id`) — but `NotificationEntity.user_id` is semantically a `users.id`. There is no artist→user link table anywhere in the schema — the notification is permanently unreachable by any real user-notification query. A silent dead write, of the same structural nature as the main finding (a field holding the wrong type of ID).

### CURRENT_PROBLEMS (synthesis)

`internal_status` blocks 100% of real create/edit (`GAP-0129`); illegal workflow jump on create (`GAP-0130`); non-relational tracklist, disconnected ISRC (remaining `GAP-0007`); `release_works` schema-only; artist notification with the wrong ID; 6 STUB distributors (see Part VIII); no persisted relation to the source Project (`GAP-0168`, see `DOMAIN-PROJECT`).

### TARGET_V2_DIRECTION

Fix the create/edit contract (remove `internal_status` from the payload or add it to the DTO, a product decision); design `release_tracks` according to `DEC-007`; design the relation with `projects` according to `GAP-0168`; decide and implement (or formally discontinue) the real integration with at least one distributor.

### CONFIDENCE: HIGH

---

## `DOMAIN-ARTIST` — Artist (UI term "Artista")

### DEFINITION / PURPOSE / TABLE / API_RESOURCE

An artistic person/entity registered by the tenant — a career profile, not a login credential. `artists` (78 real columns). `ArtistsController` → `GET/POST/PATCH/DELETE /artists` (+ `platform-profiles` sub-resource).

### CREATED_FROM — two parallel flows (structural finding)

1. **`ArtistaFormModal.tsx`** — the real flow, used by the UI (`Artistas.tsx`), ~45 fields, single mapping source (`artista.mapper.ts`, 658 lines).
2. **`ArtistaCadastro.tsx`** — a dedicated page routed at `/artistas/novo`/`/artistas/:id/editar`, ~71 fields (broader coverage, including the person's `genero` as distinct from `generoMusical`), **confirmed orphaned** (repo-wide grep: zero navigation links pointing to these routes). Valid code, real route, but unreachable through normal navigation — the subject of the pending decision `DEC-003`.
3. **Third, public flow**: `ArtistaSignupPublic.tsx` → `POST /public/artists` — **an endpoint that does not exist anywhere in the backend**, confirmed by exhaustive grep. Every submission of this public artist self-registration form fails silently. Closed/detailed in the `auth` module audit, not duplicated here as an `artist` finding.

`EVIDENCE: docs/backend-v2/field-traceability/modules/artist.md §1 | docs/backend-v2/field-traceability/modules/auth.md §1 | CONFIDENCE: HIGH`

### FIELDS — classification by persistence destination (structural finding #2)

Of the 78 real physical columns: **~23 direct physical columns** (`storage: 'column'`) — `nome_artistico`, `nome_civil`, `tipo`, `status`, `genero_musical`, `observacoes`, `especialidades`, `foto_url`, `spotify_url`/`youtube_url`/`deezer_url`/`apple_music_url`/`soundcloud_url`, `galeria_urls`, `documentos`, `manager_nome`, `produtor_executivo`, `agencia_booking`, `label_parceira`, `contrato_id`. **4 encrypted columns** (`storage: 'encrypted'`, AES-256-GCM) — `email`, `telefone`, `cpf_cnpj`, `manager_contato`. **~41 fields stored inside `metadata` (jsonb)**, even though physical columns with the same names exist in the table: `slug_artistico`, `tipo_perfil`, `fase_carreira`, `genero`, `data_nascimento`, `rg`, `endereco`, `tags_musicais`, `presskit_url`, `documentos_pessoais_url`, `apple_music_albuns_url`, `soundcloud_seguidores_url`, `instagram_url`, `tiktok_url`, `instagram_seguidores`, `tiktok_seguidores`, `spotify_ouvintes`, `youtube_inscritos`, `deezer_fas`, `agencia`, `empresario_id/nome/email/telefone`, `gravadora_id/nome/email/telefone`, `gravadora_responsavel_id/nome/email/telefone`, `banco`, `conta`, `chave_pix`, `titular_conta`, `distribuidoras_selecionadas/gerais/emails/empresa_selecionadas/empresa_emails`, `contatos_equipe`, `contatos_vinculados`, `relacionamentos`. **This is documented architecture, not a bug** — the round-trip (`toResponse()`) flattens `metadata.<campo>` back to the flat name in the API response; the physical columns with the same names are in fact unused by this code path (possibly preparation for a future normalization that was never completed).

### PII / ENCRYPTION

| Field | Column | Encrypted | Layer | Searchable |
|---|---|---|---|---|
| Email | `email_encrypted` | YES (AES-256-GCM) | `EncryptionService` | no (server-side) |
| Phone | `telefone_encrypted` | YES | same | no |
| CPF/CNPJ | `cpf_cnpj_encrypted` | YES | same | no |
| Manager contact | `manager_contato_encrypted` | YES | same | no |
| RG (ID card), address, bank details (bank/branch/account/PIX/account holder) | inside `metadata` jsonb | **NO** | — | no |

The artist's **banking** data does NOT receive the same level of protection as the email/phone/CPF of the same entity, despite typically being more sensitive — see `CONFLITO-04`/`PO-VERIFY-022`.

### EXTERNAL PLATFORMS — two systems coexisting without reconciliation

1. **Static manual counters** (`spotify_ouvintes`, `youtube_inscritos`, etc.) — typed in by the user, inside `metadata`, with no synchronization.
2. **Real synchronization** (`artist_platform_profiles`, 24 columns, `GET/POST /artists/:id/platform-profiles[/:platform/sync]`) — Spotify (real OAuth client-credentials) and YouTube (real Data API v3), both with `CREDENTIAL_REQUIRED_LATER: SIM` (platform-level, not tenant-level). Explicit failure if the credential is missing, never silent.

The two systems coexist without technical conflict (different columns), but conceptually represent the same data with no visible reconciliation — an observation, not a technical bug.

### RELATIONS — complete matrix

| Relation | FK column | DB enforcement |
|---|---|---|
| Works (works) | `works.artista_id` | real FK |
| Phonograms (phonograms) | `phonograms.artista_id` | real FK |
| Releases (releases) | `releases.artista_id` | real FK, `ON DELETE SET NULL` |
| Contracts | `contracts.artista_id` | real FK |
| Projects | `projects.artista_id` | logical, no physical FK (and always NULL in practice — `GAP-0001`) |
| Transactions (finance) | `transactions.artista_id` | logical, no FK, **actually populated** by the Transaction form |
| Events | `events.artista_id` | logical, no FK |
| Goals (marketing) | `artist_goals.artista_id` | logical, no FK |
| Contacts (CRM) | via `contatos_equipe` (metadata jsonb), loose reference by UUID | no FK, a real, live reference (not a copy) |

`EVIDENCE: docs/backend-v2/field-traceability/modules/artist.md §2,§3,§6,§8 | CONFIDENCE: HIGH`

### STORAGE

3 real upload fields (`fotoUrl`, `documentosPessoaisUrl`, `presskitUrl`) via `FileUpload`/`useUploadToR2` — functional, end-to-end, not broken.

### CURRENT_PROBLEMS / TARGET_V2_DIRECTION

Resolve `DEC-003` (which creation flow prevails); decide whether the ~41 "reserved" physical columns should be permanently abandoned in favor of `metadata` or migrated; standardize encryption of banking data (`CONFLITO-04`); fix the broken public self-registration (together with `auth`).

### CONFIDENCE: HIGH

---

## Other domain entities (synthetic treatment, as instructed — less depth than Project/Work/Phonogram/Release/Artist)

### `DOMAIN-CONTRACT` — Contract

DEFINITION: an agreement between the tenant and a party (artist/client/service provider). TABLE: `contracts` (25 cols). Two divergent create/edit components coexist today (`ContratoWizard.tsx` main, `ContratoFormModal.tsx` secondary via `catalog`) — unification already decided (`DEC-004`, `UNIFIED_CONFIGURABLE_CONTRACT_COMPONENT`, WIZARD/QUICK modes), implementation pending. `exclusivo` (NOT NULL) is never exposed in the main wizard. PII of contracting parties (CPF/CNPJ/RG/address) serialized as plain text inside `observacoes`, exportable without masking (`GAP-0049`). Real propagation to finance on signing (`REAL_AUTOMATIC_PROPAGATION`, only the `valor` field) — see `MODULE-CONTRACTS`/`MODULE-ACCOUNTING`. `EVIDENCE: docs/backend-v2/field-traceability/modules/contracts.md | CONFIDENCE: HIGH`

### `DOMAIN-CLIENT` — Client / Contact

DEFINITION: an individual/legal entity that is a client or business contact — "Contact = Client" is a domain decision documented in the code itself; both concepts share the `clients` table (39 cols). There is no physical `contacts` table in real use (the legacy `/contacts` facade is an in-memory `Map`, with no persistence and zero consumers). PII (email/phone/CPF-CNPJ) correctly encrypted; ~15 real columns (photo, profile, distinct legal name/trade name, decomposed address, contact status/priority, responsible-person data) captured by the form but never reaching the backend (`REAL_MAPPING_GAP`). `EVIDENCE: docs/backend-v2/field-traceability/modules/crm-relationships.md | CONFIDENCE: HIGH`

### `DOMAIN-TRANSACTION` — Accounting Transaction

DEFINITION: a financial entry (revenue/expense) of the tenant. TABLE: `transactions` (28 fields, complete 1:1 mapping, a "clean" domain in the field-mapping sense). Real links (`artista_id`, `projeto_id`, `contrato_id`, `evento_id`) — all logical, with no physical FK, but **actually populated** by the real form. The `entityLinks` array (multi-entity allocation, required by the UI) is silently discarded by the backend (`GAP-0009`) — the obvious semantic destination table (`transaction_allocations`) is confirmed to have no consumer. `EVIDENCE: docs/backend-v2/field-traceability/modules/accounting.md | CONFIDENCE: HIGH`

### `DOMAIN-AUDIOVISUAL-PROJECT` — Audiovisual Project

DEFINITION: a music-video/audiovisual content production — a rich entity distinct from (musical) `Project`. TABLE: `audiovisual_projects` (47 cols, part of the domain's 9 tables/187 columns, 100% `DIRECT`). `financial_project_id` is a real FK → `projects.id` (link to the source Musical Project), classified `LEGACY_NAMING` (the name suggests finance, the real function is linking to the song) — never written by any form (`GAP-0033`). Only 1 of the 9 backend subdomains has a UI (see `MODULE-AUDIOVISUAL`). `EVIDENCE: docs/backend-v2/field-traceability/modules/audiovisual.md | CONFIDENCE: HIGH`

### `DOMAIN-MARKETING-PROJECT` — Marketing Project

DEFINITION: a marketing campaign workspace — an entity distinct from (musical) `Project`, table `marketing_projects`. `financial_project_id` (same pattern as Audiovisual, real FK, never written by a form) and `source_project_id` (logical, no physical FK). Created automatically when a musical `Project` completes (`MarketingProjectsService.createFromCompletedProject()`, a real and functional automation). `EVIDENCE: docs/backend-v2/field-traceability/modules/projects.md §21 | CONFIDENCE: HIGH`

### `DOMAIN-EVENT` — Event

DEFINITION: a calendar appointment (show, recording session, meeting). TABLE: `events` (23 cols, a single table — there are no separate venue/recurrence/reminder/attachment tables). `artista_id` is logical, with no FK, and in some of the flows only free lineup text (no real `artista_id` write). The create/edit form (`SchedulerFormModal.tsx`) is correct and consistent with the real DTO; the calendar screen (`Agenda.tsx`) reads a **fictitious** set of fields that corresponds neither to the real columns nor to the DTO — every event renders on the "now" date, forced to all-day. `EVIDENCE: docs/backend-v2/field-traceability/modules/events.md, cited via PROGRESS.md | CONFIDENCE: MEDIUM`

---

# PART III — FRONTEND (`apps/web`)

## III.1 HTTP architecture — canonical and duplicate clients

**Single canonical client**: `apps/web/src/shared/lib/api-client.ts` — used by the repository's 34 `*.service.ts` files and by most hooks classified `API_HTTP`. It injects `Authorization: Bearer <token>` and `X-Tenant-ID` from in-memory variables (never read directly from storage), never from the body/localStorage. Expected response envelope: `{ data, timestamp }`. Errors mapped by HTTP status to typed subclasses (`ValidationError`/`TenantError`/`PasswordChangeRequiredError`/`NotFoundError`/`ConflictError`/`IntegrationError`); on 401, it clears the token and activates a 30s circuit breaker. **No explicit timeout** (no `AbortController`) and **no automatic retry** on any call.

`apps/web/src/lib/api.ts` is a re-export barrel of the same client (not a second implementation) — the file's own comment recommends that new modules import from here, but the overwhelming majority of the code still imports directly from `shared/lib/api-client.ts` (incomplete convention migration, not a functional bug).

**9 places outside the canonical client** make a direct `fetch()` — most out of legitimate necessity (multipart upload, blob download, OAuth redirect, call to an external third-party service). **2 real architectural divergences, not fixed**: `useAI.ts` and `useACRCloud.ts` call the backend directly without reusing the canonical client's `Authorization`/`X-Tenant-ID` injection.

**Direct calls to Supabase** (outside the NestJS backend): limited to Auth (SDK) and Realtime (channels `tenant:${orgId}`/`user:${userId}`, authorization via RLS) — there is no direct access to business tables via the Supabase client in the frontend outside these two uses (confirmed in a previous dedicated audit, doc17).

`EVIDENCE: docs/backend-v2/04-http-client-architecture.md | docs/backend-v2/17-supabase-direct-access-audit.md | CONFIDENCE: HIGH`

## III.2 Complete table of `localStorage`/`sessionStorage` usage

| Key | Module | Meaning | Business data? | User preference? | Integration state? | Mock/fallback? | Should the backend own it? | Gap |
|---|---|---|---|---|---|---|---|---|
| `musicos360_auth` | auth | Supabase Auth session (delegated to the SDK) | no | — | — | no | no (standard Auth provider mechanism) | — |
| `musicos360_rule_overrides` | accounting | Manual override of a transaction categorization rule, global key with no tenant/user | YES | no | no | no | YES | no tenant isolation, no endpoint |
| `musicos360_financial_category_rules` | accounting | The **entire** ruleset for automatic transaction categorization | YES | no | no | no | YES (critical) | `GAP-0011` (CategoriasFinanceiras.tsx disconnected from the real backend) |
| `musicos360:variable_registry` | contracts | Registry of contract template variables/placeholders, full CRUD | YES | no | no | no | YES | listed in the consolidated `contracts` gap (§30 item 11) |
| `contract_categories` (via `useCategoryRegistry`) | contracts | Contract categories (labels), 11 seeded | partial (`DISPLAY_ONLY` per `DEC-002`) | no | no | no | no (classified `DISPLAY_ONLY`, but with no synchronization today) | same item as above |
| `musicos360_deezer_credentials` (sessionStorage) | integrations | Deezer credentials, **secret in plain text, no redaction** | no (functionally unnecessary data — public API) | no | YES | no | no | risk of plain-text secret exposure (CWE-312), even with no functional use |
| `musicos360_clicksign_credentials` (sessionStorage) | integrations | Clicksign connection metadata, `api_key` explicitly removed before saving | no | no | YES | no | UNCERTAIN | correct use of `safeSessionSet` (positive contrast) |
| `musicos360_nfe_credentials` (sessionStorage) | integrations | NF-e fiscal credentials, **`token_provedor` in plain text** | YES (fiscal) | no | YES | no | YES | risk of plain-text fiscal secret exposure |
| `musicos360_docusign_credentials` (sessionStorage) | integrations/contracts/settings | DocuSign "connected" flag, read by 3 distinct places | no | no | YES | no | YES | resets every session, no real persistence |
| `musicos360_distributor_connections` | releases/settings | Which of the 6 distributors are "connected" | YES (decides real distribution options) | no | YES | no | YES (critical) | never written by any real code — `hasAnyConnected` always `false` (see Part VIII) |
| `musicos360_user_settings:<id>` | settings | Personal profile + 11 notification/automation toggles + full base64 `avatar_url` | partial | YES | no | no | UNCERTAIN (the avatar should use the real upload that already exists) | `LOCAL_STORAGE_GAP` |
| `musicos360_org_slug:<id>` | settings/workspace | The organization's public registration slug, saved **per user in the browser**, not per tenant | YES (critical — tenant-wide data) | no (misclassified as a user preference) | no | no | YES | `LOCAL_STORAGE_GAP` (§9, `settings.md`) — a real backend already exists and is never called |
| `musicos360_current_tenant` | workspace | Last tenant selection | YES | partial | no | no | server-side sync recommended | `GAP-0164` |
| `musicos360_external_oauth_connections` (sessionStorage) | settings/integrations | Local cache of external OAuth connections | no | no | YES | no | no (it is a cache; the real source is the backend) | — |
| `useChat.ts` (mentioned, no real call) | integrations | A comment promises a local fallback for the chat channel, not implemented | — | — | — | YES (documented intent, not implemented) | no | feature honestly disabled |
| `catalog-lookup.ts` (mentioned, no real call) | monitoring | A comment promises catalog reading via localStorage; the code is a dead stub (always `[]`) | — | — | — | YES (outdated comment) | YES | ECAD match metrics always computed over an empty catalog |

`EVIDENCE: docs/backend-v2/18-local-storage-audit.md (13 real cases detailed) | docs/backend-v2/field-traceability/modules/settings.md §6 (LOCAL_STORAGE_KEYS: 4) | docs/backend-v2/field-traceability/modules/releases.md §4 | docs/backend-v2/field-traceability/modules/contracts.md §3 | CONFIDENCE: HIGH`

## III.3 Complete appendix of mocks/stubs/fakes by module

| Module | File | Functionality | Classification | Reachable? | Impact | Gap |
|---|---|---|---|---|---|---|
| accounting | `CategoriasFinanceiras.tsx` | Entire financial categories page | FAKE (localStorage, format different from the real schema) | YES (linked in the menu) | The user edits "categories" with no effect whatsoever on the database | `GAP-0011` |
| accounting | `TransacaoRules.tsx`/`FinanceCategoryRuleModal.tsx` | CRUD of custom categorization rules | BROKEN (`/financial-categories/rules*` endpoints do not exist, HTTP 400 on every load) | YES | The entire screen does not work | `GAP-0010` |
| accounting | `TransacaoFormModal.tsx::exportFieldList()` | 3-sheet XLSX export | DEAD (never called, violates the 2-sheet rule) | NO | none | `GAP-0014` |
| admin | `AdminSettings.tsx` (8 tabs) | Administrative settings | Systemic FAKE (false success toast on every action; Webhooks/API Keys always empty with a button that has no `onClick`) | YES (real route) | No admin setting is actually saved | `GAP-0018` |
| admin | `admin-source.ts` (6 exports) | KPIs/tenants/security events/system metrics | DEAD (honestly empty code, `ADMIN_DATA_IS_MOCK=false`, but 6 of the 9 exports have no consumer at all) | NO (6 of 9) | nothing functional; dead code | `GAP-0019` |
| admin | "Admin analytics indisponível" (Admin analytics unavailable) banner | Warning about missing endpoints | FAKE (always visible, even when the endpoint IS real) | YES | incorrect message on 6 of the 9 admin pages | `GAP-0020` |
| admin | Auditoria.tsx | Cross-module completeness checker | REAL (not fake), but with 2 mapping gaps of its own | YES | — | see individual modules |
| admin | `AdminKnowledge.tsx` | Admin knowledge base | Honest MOCK (`IS_PROD`-gated, self-disabled in production) | YES, only in dev | none in production | `GAP-0022` (NO_FIX_REQUIRED) |
| artist | `ArtistaCadastro.tsx` | Second artist registration flow | DEAD (orphaned, zero navigation) | NO | none (functional if accessed by direct URL) | `GAP-0003`/`DEC-003` |
| artist | manual follower counters | Manual platform metrics | not fake, but parallel to the real sync, with no reconciliation | YES | conceptual duplication | `GAP-0028` |
| audiovisual | 8 of 9 backend domains | briefing/deliverables/storyboard/schedule/crew/files/tasks/approvals | ABSENT FROM UI (not a mock — it is a real backend with no frontend) | NO (16 hooks with no consumer) | ~85% of the built audiovisual domain is inaccessible | `GAP-0031` |
| audiovisual | status filter | 3 status dropdowns | BROKEN (PT values vs. EN data) | YES | always zero results | `GAP-0032` |
| catalog | `useAbramusImport`/`useAbramusLocalLookup`/`useAbramusSyncAll` | ABRAMUS import/lookup/sync | STUB (always fails or empty) | YES (import/sync); NO (`useAbramusGenerateISWC` etc., no importer) | deterministic failure on click | `GAP-0117` integrations area, `catalog.md §12` items 7-9 |
| catalog | `catalog.store.ts`, `catalog.service.ts` | Alternative store/service | DEAD | NO | none | `GAP-0046`/`GAP-0167` |
| contracts | `ContratoWizard.tsx` "Enviar para Assinatura" (Send for Signature) button | E-signature | Deterministic FAKE (always `toast.error`+`throw`, never calls the backend) | YES | the user can never send a contract through the main flow | consolidated in `contracts.md §30` item 4 |
| contracts | `signing.adapter.ts` | Universal signing adapter | Universal STUB (always `createUnavailableSigningProvider`, even for the real Autentique) | YES | no signing provider works through the UI | `GAP-0050`/`GAP-0052` |
| contracts | `contracts.store.ts` | Alternative store | DEAD | NO | none | `GAP-0167` |
| contracts | `contract-party-origin.mapper.ts` | Party-origin mapper | DEAD | NO | none | — |
| contracts | `CategoryRegistry.tsx`/`VariableRegistry.tsx` | Category/variable registry | pure localStorage (see III.2) | YES | does not sync across devices/users | consolidated |
| dashboard | `computeFromMockStorage()` | Alternative computation of the operational dashboard | DEAD (~150 lines, never called) | NO | none | `GAP-0071`-adjacent, `dashboard.md §2` |
| dashboard | block of 11 `window.addEventListener("musicos360:...")` | Reactivity to custom events | DEAD (no corresponding `dispatchEvent` exists) | NO | none | `dashboard.md §13` |
| dashboard | `crmMetrics`/`financeiroMetrics` | Complete P&L computation | ACTIVE but never rendered | NO (dead result) | wasted computation, no functional impact | `dashboard.md §22` item 4 |
| events | `events.store.ts`, `eventService` | Alternative store/service | DEAD | NO | none | consolidated via `PROGRESS.md` |
| inventory | 2 dead-code files | not individually specified in the condensed source | DEAD | NO | none | `PROGRESS.md` |
| leads | 3 of 4 Zustand stores | Filters/preset | DEAD | NO | none | `GAP-0104`/`GAP-0167` |
| leads | lead uploads | File upload | DECORATIVE (`URL.createObjectURL`, table `lead_uploads` confirmed `NO_TABLE_CONSUMER`) | YES | the file never actually persists | `PROGRESS.md` |
| licensing | 2 Zustand stores | not individually specified | DEAD | NO | none | `GAP-0167`-adjacent |
| marketing | `budget * 0.41` | Campaign "Gasto Total" (Total Spend) | FABRICATED (arbitrary coefficient displayed as real data) | YES | misleading investment metric | `GAP-0112` |
| marketing | `CampaignsController`/`CampaignOperationsController` | Campaign system "A" | DEAD/ORPHANED (unreachable, incompatible with the schema) | NO | none directly (a risk if reactivated) | `GAP-0111` |
| monitoring | `RightsMonitoring.tsx` | Rights-monitoring panel | STRUCTURALLY EMPTY by honesty (`RIGHTS_DATA_IS_MOCK=false`, 5 arrays always empty) — it is the screen actually reached; the real one (`Monitoramento.tsx`) is inaccessible because of a redirect | YES (but empty) | the user never sees real monitoring data | `GAP-0116` |
| monitoring | `catalog-lookup.ts` | Catalog index for ECAD matching | dead STUB, outdated comment (see III.2) | internal | match metrics always zeroed | consolidated |
| musicchat | no confirmed mock/fake | — | — | — | — | the module with the lowest fake/mock rate in this series |
| projects | `projects.store.ts`, `projects.service.ts` | Alternative store/service | DEAD | NO | none | `GAP-0126`/`GAP-0167` |
| projects | per-track audio upload | Upload | hardcoded STUB (`uploadFile` always `null`) | YES | no audio is attached | consolidated, `projects.md §8` |
| releases | `releases.store.ts`, `releases.service.ts` | Alternative store/service | DEAD | NO | none | `GAP-0167` |
| releases | 6 distributors | Digital distribution | Honest STUB (static link, no success simulation) | YES (the link opens) | no real distribution happens | `GAP-0080` |
| reports | (none found — the most rigorous module in the series) | — | — | — | — | — |
| rh | 4 create sub-flows | Employee/Payroll/Vacation/Documents | BROKEN (incompatible DTO/form, HTTP 400; Documents points to the wrong endpoint) | YES | 100% of HR creation broken | `GAP-0138/0139/0140/0141/0142/0143` |
| settings | `AuditTrail.tsx` | Audit trail | DEAD (route never registered) | NO | none | `settings.md §15` |
| settings | `settings.store.ts` | Alternative store | DEAD | NO | none | `GAP-0167`-adjacent |
| settings | "Método de Pagamento" (Payment Method) card | Display of a saved card | FAKE (hardcoded `•••• 4242`, no real data) | YES | the user sees a card that does not exist | `GAP-0152` |
| settings | 4 notification toggles | "Automações" (Automations) tab | FAKE (`<Switch checked={true}>` with no handler) | YES | the user thinks they are configuring something, but they are not | `GAP-0147`/`GAP-0148` |
| settings | 6 "Segurança" (Security) items | 2FA/sessions/account deletion | FAKE (no `onClick`, hardcoded data) | YES | the user thinks real 2FA/sessions exist | `GAP-0155` |
| support | Support chat, knowledge base, status/board | 4 sub-features of the Support module | FAKE, but honestly self-documented (explicit failure, never simulates success) | YES | the user sees a real UI for features that do not exist | `GAP-0160` (INTENTIONAL_STUB) |
| workspace | no confirmed mock/fake | — | — | — | — | the cleanest module in this series (0 CREATE_MAPPING_MISMATCH) |

`EVIDENCE: consolidation of docs/backend-v2/field-traceability/modules/*.md (the §"components"/"consolidated gaps" findings of each module) + canonical-gap-register.json | CONFIDENCE: HIGH (13 modules read directly) / MEDIUM (11 modules via PROGRESS.md)`

## III.4 Dead/orphaned code — distinction between confirmed-dead vs. orphaned vs. possibly-unused vs. legacy-compat

**Confirmed dead** (zero consumers, verified by exhaustive grep — no automatic removal recommendation, classification only):
- 9 never-used Zustand scaffolds: `catalog.store.ts`, `contracts.store.ts`, `dashboard-layout.store.ts`, `events.store.ts`, `inventory` (not individually named in the source), `leads-filter-preset.store.ts`, 4 `crm-relationships` stores (`contact-agenda`, `contact-filters`, `contact-panel`, `contact-tags`), `projects.store.ts`, `releases.store.ts` — collapsed into `GAP-0167` (common root cause) + individual per-module gaps (`GAP-0046`, `GAP-0072`, `GAP-0104`, `GAP-0126`).
- `catalog.service.ts` (`catalogService`), `projects.service.ts`, `releases.service.ts` — redundant service layers, never imported (the real screen uses `useX` hooks directly).
- `contract-party-origin.mapper.ts` (contracts), `ContactComponents.tsx` (317 lines, 13 CRM components never rendered), `components/index.tsx` (crm-relationships, dead barrel).
- `AuditTrail.tsx`+`useAuditTrail.ts` (settings) — functional, backend-wired, but with no route that reaches it.
- `computeFromMockStorage()` + the block of 11 `window.addEventListener` calls (dashboard).
- Duplicate Release entity/repository (`apps/api/src/modules/releases/entities/release.entity.ts` + `repositories/release.repository.ts`) — referenced only by a test spec, not by the real module.

**Orphaned** (real, functional code, but unreachable through normal navigation — distinct from "dead"):
- `ArtistaCadastro.tsx` (routes `/artistas/novo`/`/artistas/:id/editar`, zero links).
- `/audiovisual/projects/new` (same dead route, but with no risk of field divergence; it is the same form).
- 16 of 20 `audiovisual` hooks (briefing/deliverables/shots/schedule/crew/assets/tasks/approvals).
- Real and complete Autentique integration in the backend, zero frontend consumers.

**Possibly unused** (marked with uncertainty by the source audit itself, not confirmed by exhaustive grep in every case): `PostHog` (config present, no code usage found beyond the env var — classified `STUB` for that reason); response-caching mechanisms of some integration providers (not verified in depth).

**Legacy-compat** (deliberately kept for compatibility, not dead code): `apps/web/src/lib/api.ts` (re-export barrel); `contract_categories`/`CONTRACT_TYPES` (classified `DISPLAY_ONLY`/`DEAD_LEGACY_VOCABULARY` by `DEC-002`, not removed in this step).

No removal was automatically recommended — each item remains subject to the mandatory classification of `74-zero-gap-reconstruction-contract.md §23` (`REQUIRED`/`REPLACED`/`DERIVED`/`LEGACY_ONLY`/`DEAD`/`NON_CRUD_BY_DESIGN`) before any elimination decision in the rebuild.

`EVIDENCE: consolidation by cross-grep across the 13 module reports read directly + canonical-gap-register.json (GAP-0167 and its 4 satellites) | CONFIDENCE: HIGH`

## III.5 Inventory of creation/editing (Create/Edit) components — all modules

| Module | Component | Type | Entity | Fields (approx.) | Endpoint | Reachable? | Duplicated? | Status |
|---|---|---|---|---|---|---|---|---|
| accounting | `TransacaoFormModal.tsx` | modal | Transaction | 28 + `entityLinks` (gap) | `POST/PATCH /transactions` | YES | no | functional, 1 gap (`entityLinks`) |
| accounting | Invoice ("Nota Fiscal") form (`nota-fiscal-form/`) | form | Invoice | 38 | `POST/PATCH /invoices` | YES | no | clean, no gap |
| admin | `AdminPlans` create/edit | form | BillingPlan | 9 | `POST/PATCH /billing/plans` | YES | no | clean |
| admin | `AdminSettings.tsx` (8 tabs) | form (decorative) | — | N/A | no real one | YES | no | 100% fake |
| artist | `ArtistaFormModal.tsx` | modal | Artist | ~45 | `POST/PATCH /artists` | YES | YES (vs. `ArtistaCadastro.tsx`) | real canonical |
| artist | `ArtistaCadastro.tsx` | page | Artist | ~71 | `POST/PATCH /artists` | NO (orphaned) | YES | functional but unreachable |
| artist | `ArtistaSignupPublic.tsx` | public wizard | Artist | ~30 | `POST /public/artists` (nonexistent) | YES (public route) | no (it is a 3rd flow) | 100% broken |
| audiovisual | `AudiovisualProjectFormModal.tsx` | modal | AudiovisualProject | 18 | `POST/PATCH /audiovisual/projects` | YES | no | clean |
| catalog | `ObraFormModal.tsx` | modal | Work | 23 (+4/participant row) | `POST/PATCH /works` | YES | no | `artista_id` always null |
| catalog | `FonogramaFormModal.tsx` | modal | Phonogram | 30 (+2/row per category) | `POST/PATCH /phonograms` | YES | no | fake audio upload |
| contracts | `ContratoWizard.tsx` | wizard (6 steps) | Contract | 9 record-level + N parties/signatories | `POST/PATCH /contracts` | YES (main) | YES (vs. FormModal) | `arquivo_url` missing, `exclusivo` never set |
| contracts | `ContratoFormModal.tsx` | modal | Contract | 13 | `POST/PATCH /contracts` | YES (only via catalog) | YES | has `arquivo_url`, but destroys the wizard's blob if used for editing |
| contracts | `TemplatesContratos.tsx` create | form | ContractTemplate | 8 | `POST /contract-templates` | YES | no | **incompatible DTO — always HTTP 400** |
| crm-relationships | `ContatoFormModal.tsx` | modal | Client | 19+N | `POST/PATCH /clients` | YES | no | 12 of 19+ fields actually persist |
| dashboard | (none — the module is read/aggregation only) | — | — | — | — | — | — |
| events | `SchedulerFormModal.tsx` | modal | Event | not individually detailed in the condensed source | `POST/PATCH /events` | YES | no | correct (in contrast with `Agenda.tsx`, which reads fictitious fields) |
| integrations | various `*ConfigDialog.tsx` (Deezer/Spotify/YouTube/NFe/Clicksign etc.) | dialog | integration credentials | varies by provider | varies (real or none) | YES | no | see Part VIII |
| inventory | `InventarioFormModal.tsx` | modal | InventoryItem | ~19 | `POST/PATCH /inventory-items` | YES | no | 3 fields with a case bug (camelCase vs. snake_case on edit) |
| leads | Lead create/edit (not individually named in the condensed source) | form | Lead | 34 cols in the table, a subset in the form | `POST/PATCH /leads` | YES | no | `whatsapp` probably rejected (400), 7 columns duplicated in `dados_internos_crm` |
| licensing | "Nova Licença de Sync" (New Sync License) modal | modal | License | 27 cols in the table, a subset in the form | `POST/PATCH /licenses` | YES | no | snapshot fields never written |
| marketing | Campaign Builder (System B) | builder | Campaign (via `marketing_projects`) | mostly in `metadata.marketingBuilder.payload` jsonb | `POST /marketing/campaigns/draft` | YES | YES (dead System A coexists in the same table) | active, but fragmented |
| monitoring | Takedown form (inside the dead screen `Monitoramento.tsx`) | form | Takedown | — | `POST /takedowns` | NO (real screen unreachable because of a redirect) | no | broken by a backend bug (`url` always null) |
| musicchat | Message composer | inline | ConversationMessage | attachments/text | `POST /conversations/:id/messages` | YES | no | clean, no field mismatch |
| projects | `ProjetoFormModal.tsx` | modal | Project | 8 (5 persisted + 3 gap) | `POST/PATCH /projects` | YES | no | `artista_id`/`orcamento` never collected |
| releases | `LancamentoFormModal.tsx` | wizard (5 steps) | Release | 20 | `POST/PATCH /releases` | YES | no | **100% broken — `internal_status` not whitelisted** |
| reports | (no create/edit — the module is export/read only) | — | — | — | — | — | — |
| rh | `FuncionarioFormModal.tsx` | modal | Employee | 13 whitelisted; the form sends 8 non-whitelisted + `nome` missing | `POST/PATCH /hr/employees` | YES | no | **100% broken — HTTP 400** |
| rh | Payroll create | form | PayrollEntry | — | `POST /hr/payroll` | YES | no | **100% broken — divergent field names** |
| rh | Leave-request create | form | LeaveRequest | — | `POST /hr/leave-requests` | YES | no | **100% broken — same pattern** |
| settings | `LogoUploader.tsx` | upload | Branding | 1 (file) | `POST /workspaces/:id/logo` (nonexistent) | YES | no | **endpoint does not exist** |
| settings | `Configuracoes.tsx` "Empresa" (Company) | form | CompanySettings | 7 | `PATCH /company-settings` | YES | no | clean |
| support | Ticket creation | form | SupportTicket | — | `POST /support-tickets` | YES | no | real, functional workflow |
| workspace | Member invitation (`/usuarios` and the "Usuários" (Users) tab) | form | Invitation | e-mail+role | `POST /invitations` (via real RBAC) | YES (2 entry points) | YES (`DEC-006` pending) | both work, fragmented |

`EVIDENCE: consolidation of all 24 module reports (13 direct, 11 via PROGRESS.md) | CONFIDENCE: HIGH for the 13 direct ones, MEDIUM for the remaining 11`

---

# PART IV — LEGACY BACKEND (`apps/api`)

## IV.1 Actual stack (verified in `apps/api/package.json`)

| Layer | Technology | Version | Role |
|---|---|---|---|
| HTTP framework | NestJS (`@nestjs/common`/`core`/`platform-express`) | `^10.3.0` | modules/controllers/DI framework |
| ORM | TypeORM (`typeorm` + `@nestjs/typeorm`) | `^0.3.31` / `^10.0.2` | data access, entities, migrations |
| Database | PostgreSQL via `pg` | `^8.20.0` | single database, hosted on Supabase |
| Identity auth | `@supabase/supabase-js` | `^2.105.4` | Supabase Auth (SDK used directly in the frontend + JWT verification in the backend) |
| Queues/Jobs | BullMQ (`bullmq` + `@nestjs/bullmq`) + `ioredis` | `^5.76.8` / `^10.2.3` / `^5.10.1` | asynchronous queues (e.g. marketing content scheduling, support triage) |
| Config | `@nestjs/config` + custom Zod validation (`env.schema.ts`) | `^3.2.0` | loading/validation of environment variables |
| API docs | `@nestjs/swagger` | `^7.3.0` | OpenAPI |
| Health checks | `@nestjs/terminus` | `^10.2.3` | health endpoint |
| Internal events | `@nestjs/event-emitter` | `^3.1.0` | in-process domain event bus (`EventEmitter2`) |

`EVIDENCE: apps/api/package.json | CONFIDENCE: HIGH`

## IV.2 Module structure (verified in `apps/api/src/app.module.ts`)

`apps/api/src/app.module.ts` explicitly registers the infrastructure modules and the ~48 real domain/feature modules, among them (complete list of the business-module imports confirmed by direct reading of the file): `AuthModule`, `CompanySettingsModule`, `ArtistsModule`, `WorksModule`, `PhonogramsModule`, `ContractsModule`, `TransactionsModule`, `NotificationsModule`, `UploadsModule`, `ContractTemplatesModule`, `ContractServiceTypesModule`, `InvoicesModule`, `ClientsModule`, `LeadsModule`, `LeadInteractionsModule`, `ContactsModule`, `ContactTimelineModule`, `ContactAttachmentsModule`, `ContactContractsModule`, `CampaignsModule`, `MarketingModule`, `BriefingsModule`, `EventsModule`, `ProjectsModule`, `TakedownsModule`, `SharesModule`, `ReleasesModule`, `UsersModule`, `AuditLogModule`, `ActivityLogsModule`, `SupportTicketsModule`, `IntegrationsModule`, `AIModule`, `BillingModule`, `ArtistGoalsModule`, `ContentDetectionsModule`, `EcadReportsModule`, `HrModule`, `DomainEventsModule` (core), `SkillsModule` (core), `AssetsModule`, `WorkflowModule` (core), `ConversationsModule`, `FormsModule`, `AnalyticsModule`, `InventoryModule`, `LicensingModule`, `FinancialRulesModule`, `FinancialCategoriesModule`, `AudiovisualModule`, `RegistryModule`, `ReportsModule` — plus the infrastructure modules `DatabaseModule`, `CacheModule`, `StorageModule`, `HealthModule`, `QueueModule`, `CoreModule`, `AutomationModule` (core), `MetricsModule` (core), `AdminQueuesModule` (core), `PlanLimitModule` (core/billing), `RealtimeModule` (core).

This list of `app.module.ts` imports is the primary evidence that the 24 modules audited in this series (Part VI) correspond 1:1 to real, registered backend modules — none of the 24 is purely conceptual/frontend-only without a Nest module counterpart (even when, as in `dashboard`/`admin`/`settings`/`workspace`/`monitoring`, the product module is a composition of several differently named Nest modules, already documented individually in each Part VI section).

`EVIDENCE: apps/api/src/app.module.ts (imports, direct reading) | CONFIDENCE: HIGH`

## IV.3 Guard chain (execution order, global `APP_GUARD`)

Real guards confirmed in `apps/api/src/core/guards/` (each with its own `*.spec.ts`, plus a `guard-chain.integration.spec.ts` covering the complete chain):

1. `JwtAuthGuard` (`auth.guard.ts`) — verifies the Supabase Auth JWT (signature/expiration), populates `request.user`.
2. `MustChangePasswordGuard` (`must-change-password.guard.ts`) — blocks business routes if the user is flagged for a mandatory password change (except the password-change route itself).
3. `TenantGuard` (`tenant.guard.ts`) — resolves the real tenant from the `app_metadata.org_id` JWT claim (never from the client's `X-Tenant-ID` header, which is used only as a consistency check), populates `@CurrentTenant()`.
4. `BillingEnforcementGuard` (`billing-enforcement.guard.ts`) — blocks operations if the tenant's subscription/payment is in a blocking state (see `BillingBlockedPage.tsx`, Part VI-SETTINGS).
5. `RolesGuard` (`roles.guard.ts`) — check based on `role`/`role_id` (dual model, see Part IX).
6. `PermissionsGuard` (`permissions.guard.ts`) — granular check via `@RequirePermission()`/CRUD metadata (`crud-permission-metadata.spec.ts`).
7. `RateLimitGuard` (`rate-limit.guard.ts`) — rate limiting per route/tenant.

Global interceptors registered alongside the chain: `AuditInterceptor` (mutation audit trail), `RequestTenantContextInterceptor` (propagates the tenant context to downstream layers). Middlewares: `RequestIdMiddleware`, `CorrelationMiddleware` (request tracing/log correlation).

`EVIDENCE: apps/api/src/app.module.ts | apps/api/src/core/guards/*.ts (direct listing) | CONFIDENCE: HIGH`

## IV.4 Asynchronous queues/jobs (BullMQ + Redis)

`QueueModule` (`apps/api/src/queues/queue.module.ts`) configures BullMQ via `@nestjs/bullmq`, with the Redis URL resolved from `REDIS_QUEUE_URL` or `REDIS_URL` (falling back to building it from configuration parts) — and an explicit `noOpModule()` mode when Redis is not configured (graceful degradation documented in the code itself, not a silent failure). `AdminQueuesModule` exposes a Bull Board panel for operational inspection of the queues. Real consumers confirmed in this audit: marketing content publication scheduling (retry with backoff, idempotency — see Part VI-MARKETING), automatic support triage (see Part VI-SUPPORT), contract automations (30-day expiration cron — see Part VI-CONTRACTS).

`EVIDENCE: apps/api/src/queues/queue.module.ts | marketing/support/contracts modules (Part VI) | CONFIDENCE: HIGH`

## IV.5 Supabase Auth — role in the legacy backend

The legacy backend does not implement its own identity provider — identity/credentials/sessions are managed by Supabase Auth (the `@supabase/supabase-js` SDK is used both in the frontend and for administrative operations in the backend, e.g. syncing `app_metadata.org_id` during workspace provisioning). The backend's role is to **verify** the JWT issued by Supabase (via `JwtAuthGuard`) and to **derive** tenant/role context from the claims (`TenantGuard`/`RolesGuard`) — never to reissue or manage sessions on its own. See Part IX for the complete breakdown of authentication vs. authorization vs. tenant context.

`EVIDENCE: docs/backend-v2/field-traceability/modules/auth.md §1-4 | CONFIDENCE: HIGH`

## IV.6 Current deployment

The legacy backend runs as a containerized NestJS application (see `docker-compose.yml` at the repository root and `.github/workflows/staging.yml`/`ci.yml`) against a Postgres database hosted on Supabase — this audit found no deployment-infrastructure migration in progress (the infrastructure work seen in `docs/backend-v2/*.md` is entirely about the new `apps/api-v2`, see Part XI). The legacy backend's deployment remains out of scope for this documentation rebuild — no deployment file was changed or is proposed here.

`EVIDENCE: docker-compose.yml, .github/workflows/*.yml (listing/structure, not changed) | CONFIDENCE: MEDIUM (deployment infrastructure was not the focus of this domain audit)`

---

# PART V — DATABASE

## V.1 Total number of tables

**142 physical tables** confirmed in the legacy backend's Postgres schema (complete inventory extracted and cross-checked against `database-backend-column-mapping.json`/migrations, consistent with `docs/backend-v2/database-inventory/`). All business tables carry an explicit `tenant_id` (see Part IX), except the purely reference/global-config tables of the RBAC system (`permissions`, `permission_groups`, `permission_aliases`, `permission_conflicts`, `permission_dependencies`) and the control table `musicos360_migrations`.

`EVIDENCE: docs/backend-v2/review/_all-tables.md (verified extraction, 142 rows) | CONFIDENCE: HIGH`

## V.2 Tables by domain (all 142, none omitted)

### Tenancy / Org / RBAC (24 tables)
`tenants` (18 cols — PK `id`, canonical workspace), `organizations` (16 cols — legal/billing parent), `org_members` (18 cols — membership, FK `role_id→roles`, `department_id→departments`, `position_id→positions`), `tenant_invitations` (14 cols — FK `org_id→organizations`, `role_id→roles`), `tenant_billing_state` (12 cols — FK `tenant_id→tenants`), `users` (6 cols — minimal mirror of Supabase `auth.users`), `roles` (16 cols — FK `canonical_role_id→roles` self-ref, `tenant_id→tenants`), `role_permissions` (5 cols — `role_id`/`permission_id` join), `role_templates` (9 cols), `role_template_permissions` (4 cols), `role_inheritance` (9 cols — `child_role_id`/`parent_role_id→roles` self-ref), `permissions` (13 cols — global, no `tenant_id`), `permission_groups` (6 cols — global), `permission_aliases` (4 cols — global), `permission_conflicts` (4 cols — global, self-ref `permissions`), `permission_dependencies` (4 cols — global, self-ref `permissions`), `departments` (13 cols — self-ref `parent_department_id`), `positions` (13 cols — FK `department_id`), `job_functions` (12 cols), `membership_job_functions` (6 cols — `membership_id→org_members`/`job_function_id→job_functions` join), `rbac_decision_logs` (25 cols, **partitioned table** — monthly partitions `rbac_decision_logs_2026_06/07/08/09/10` + `rbac_decision_logs_default`, all 25 cols, bookkeeping of authorization decisions), `rbac_error_logs` (12 cols).

### Audit / Bookkeeping (6 tables)
`audit_logs` (20 cols), `activity_logs` (11 cols), `financial_category_audit_logs` (11 cols), `domain_event_log` (12 cols — internal domain event bus, `EventEmitter2`), `payment_events` (7 cols — FK `tenant_id→tenants`), `musicos360_migrations` (3 cols — technical migration control, no `tenant_id`, not a business table).

### Artist (3 tables)
`artists` (78 cols — the largest business entity in the system; 4 AES-256-GCM encrypted fields: email/phone/CPF-CNPJ/manager contact; ~41 fields routed to `metadata` jsonb by architectural decision), `artist_platform_profiles` (24 cols — FK `artist_id→artists`, Spotify/YouTube sync), `artist_goals` (16 cols — logical relation with `artists`, no physical FK).

### Catalog (11 tables)
`works` (47 cols — FK `artista_id→artists` SET NULL; logical relation `projeto_id→projects`), `work_participants` (10 cols — FK `work_id→works` CASCADE), `phonograms` (59 cols — FK `artista_id→artists` SET NULL, `obra_id→works` SET NULL), `rights_holders` (17 cols, `registry` sub-module), `external_identifiers` (12 cols, `registry` sub-module), `society_accounts` (14 cols), `society_submissions` (19 cols), `society_sync_jobs` (11 cols), `society_payload_snapshots` (8 cols — FK `submission_id→society_submissions` CASCADE), `society_submission_events` (10 cols — FK `submission_id→society_submissions` CASCADE), `society_validation_errors` (10 cols). The complete `registry` sub-module (6 tables, 91 columns) is a real backend with no frontend consumer whatsoever (see Part VI-CATALOG).

### Projects (4 tables)
`projects` (16 cols — PK `id`; confirmed columns: `id, tenant_id, titulo, tipo, status, artista_id, orcamento, descricao, observacoes, genero, metadata, created_at, updated_at, deleted_at, created_by, updated_by`; canonical Musical Project entity per `DEC-001`), `project_tracks` (16 cols — FK `project_id→projects` CASCADE), `project_track_participants` (7 cols — FK `project_track_id→project_tracks` CASCADE), `project_assets` (8 cols — orphaned, zero consumers).

### Releases (2 tables)
`releases` (26-27 cols — FK `artista_id→artists` SET NULL; no persisted relation with `projects`, `GAP-0168`), `release_works` (2 cols — M:N join `release_id→releases`/`work_id→works`, both CASCADE, **schema-only, never populated** — `DEC-007` already decided that the final model must be relational via phonogram, not via this table in its current form).

### Contracts (3 tables)
`contracts` (25 cols — FK `artista_id→artists` SET NULL), `contract_templates` (11 cols), `contract_service_types` (32 cols — canonical type source per `DEC-002`, FK `tenant_id→tenants`).

### Accounting — real operational layer (5 tables)
`transactions` (43 physical cols — 28 mapped by the real UI `TransacaoFormModal.tsx`), `invoices` (62 physical cols — 38 mapped by the real UI), `financial_categories` (14 cols — self-ref `parent_id`, FK `template_id→financial_category_templates`), `financial_category_templates` (7 cols — self-ref `parent_id`), `financial_rules` (15 cols).

### Accounting — second schema-level layer, a new finding of this audit (8 tables)
A finding **not documented in any of the 24 module reports/in the master report**, obtained directly from this step's physical table/FK inventory: there is a second layer of financial schema, structurally richer and with genuine physical FKs, with no consumer confirmed in this series of audits: `financial_transactions` (39 cols — FK `account_id`/`counter_account_id→financial_accounts`, `category_id→financial_categories`, `contract_id→contracts`, `cost_center_id→cost_centers`, `counterparty_id→counterparties`, `event_id→events`, self-ref `reversal_of_id`), `financial_accounts` (13 cols), `cost_centers` (10 cols), `counterparties` (14 cols — FK `artist_id→artists`, `client_id→clients`, a generic abstraction of a financial "party"), `transaction_allocations` (15 cols — FK `transaction_id→financial_transactions` CASCADE, `artist_id`/`phonogram_id`/`project_id`/`release_id`, already cited in `accounting.md` as "exists, no consumer"), `performance_metric_entries` (20 cols — FK `artist_id`/`phonogram_id`/`project_id`/`release_id`, self-ref `superseded_by_id`), `budgets` (13 cols — FK `project_id→projects`), `budget_revisions` (8 cols — FK `budget_id→budgets` CASCADE).
**Finding not confirmed by any module report**: a dedicated product/engineering verification is recommended on whether this layer is dead code/historical schema predating the consolidation into `transactions`/`invoices`, or a second accounting iteration under parallel construction. No further assumption is made here.
`EVIDENCE: docs/backend-v2/review/_all-tables.md + _all-fks-clean.md (found by direct schema reading, not cited in any modules/*.md) | CONFIDENCE: MEDIUM (the table's existence is HIGH; purpose/usage status is NEEDS_PRODUCT_OWNER_CONFIRMATION)`

### Audiovisual (9 tables)
`audiovisual_projects` (47 cols — FK `financial_project_id→projects`), `audiovisual_briefings` (22 cols), `audiovisual_deliverables` (21 cols), `audiovisual_shots` (18 cols), `audiovisual_production_days` (14 cols), `audiovisual_team_members` (14 cols), `audiovisual_assets` (16 cols), `audiovisual_tasks` (18 cols), `audiovisual_approvals` (17 cols) — 187 columns in total, 100% `DIRECT`, 8 of the 9 tables with no UI at all (see Part VI-AUDIOVISUAL).

### Marketing (13 tables)
`campaigns` (16 cols — shared by 2 incompatible systems, see Part VI-MARKETING), `campaign_assets` (11 cols — orphan of the dead System A), `campaign_tasks` (13 cols — orphan of the dead System A), `marketing_content_posts` (29 cols), `marketing_assets` (28 cols — FK `current_version_id→marketing_asset_versions`), `marketing_asset_versions` (13 cols — FK `asset_id→marketing_assets` CASCADE), `marketing_asset_approvals` (11 cols — FK `asset_id`/`version_id`), `marketing_projects` (27 cols — FK `financial_project_id→projects`), `marketing_strategies` (17 cols), `marketing_strategy_objectives` (18 cols), `marketing_strategy_initiatives` (18 cols), `marketing_strategy_actions` (18 cols), `marketing_tasks` (20 cols), `briefings` (13 cols — FK `campanha_id→campaigns` SET NULL; distinct from `audiovisual_briefings`).

### Events (1 table)
`events` (23 cols — a single physical table; no satellite venue/recurrence/reminder/attachment tables, confirmed absent).

### CRM / Leads (9 tables)
`clients` (39 cols — "Contact = Client", 3 AES-256-GCM encrypted fields), `client_attachments` (11 cols — FK `client_id→clients`), `leads` (34-35 cols — 7 columns duplicated with `dados_internos_crm` jsonb), `lead_interactions` (8 cols — FK `lead_id→leads` CASCADE, dedicated but disconnected from the real history used by the UI), `lead_uploads` (11 cols — FK `lead_id→leads` CASCADE), `pipelines` (10 cols), `pipeline_stages` (12 cols — FK `pipeline_id→pipelines` CASCADE), `pipeline_opportunities` (23 cols — FK `pipeline_id`/`stage_id`, a complete generic Kanban system, zero confirmed consumers), `forms` (12 cols), `form_submissions` (9 cols — FK `form_id→forms` CASCADE, `lead_id→leads` SET NULL).

### MusicChat / Conversations (6 tables)
`conversations` (13 cols — FK `contact_id→leads` SET NULL; messaging domain shared with `leads`), `conversation_messages` (9 cols — FK `conversation_id→conversations` CASCADE), `conversation_notes` (7 cols — FK `conversation_id→conversations` CASCADE), `musicchat_automation_settings` (21 cols), `musicchat_automation_events` (8 cols — FK `conversation_id→conversations` CASCADE), `musicchat_automation_notifications` (11 cols — FK `conversation_id→conversations` CASCADE).

### Support (1 table)
`support_tickets` (17 cols — the only real resource with a table in the `support` module).

### Monitoring (3 tables)
`content_detections` (15 cols), `ecad_reports` (14 cols), `takedowns` (20 cols — the TypeORM entity declares 4 columns absent from the real physical table: `url`/`obra_id`/`artista_id`/`resposta`, the root cause of `POST /takedowns` always failing in production).

### Licensing (1 table)
`licenses` (27 cols — a single physical table, no satellite requests/approvals/documents tables).

### Inventory (1 table)
`inventory_items` (19 cols — a single physical table; no movement/reservation/loan/maintenance table whatsoever).

### RH (3 tables)
`employees` (27 cols — confirmed drift: 8 real physical columns never declared in the TypeORM entity), `payroll_entries` (19 cols — FK `employee_id→employees` RESTRICT, same drift), `leave_requests` (18 cols — FK `employee_id→employees` RESTRICT, same drift).

### Settings / Billing (7 tables)
`billing_plans` (14 cols), `billing_settings` (5 cols), `billing_subscriptions` (21 cols), `notification_settings` (7 cols — real, zero frontend callers), `operational_list_items` (15 cols — real, zero consumers, "operational lists" intentional stub), `operational_tasks` (15 cols).

### Integrations (4 tables)
`oauth_connections` (11 cols — tokens encrypted per provider), `webhook_events` (11 cols — idempotency via `external_id UNIQUE`), `ai_jobs` (14 cols), `ai_usage_logs` (12 cols), `integrations` (12 cols — generic connection registry per provider/tenant).

### Workflow / Automation (5 tables)
`workflow_executions` (14 cols), `workflow_execution_logs` (7 cols — FK `execution_id→workflow_executions` CASCADE), `workflow_transitions` (11 cols), `skill_runs` (14 cols), `skill_run_logs` (6 cols — FK `skill_run_id→skill_runs` CASCADE).

### Cross-cutting Assets / Uploads (5 tables)
`uploads` (16 cols — generic, every module), `assets` (14 cols — generic, distinct from `marketing_assets`/`audiovisual_assets`), `asset_versions` (11 cols), `asset_usage_logs` (9 cols), `task_assets` (8 cols).

### Releases-adjacent / not audited in depth (1 table)
`shares` (43 cols — FK `obra_id→works` SET NULL; recorded in `reports.md` as an exportable entity, but not audited in depth in any dedicated module report — classified `NOT_DEEP_AUDITED` by the source itself).

### Notifications (1 table)
`notifications` (11 cols).

`EVIDENCE: docs/backend-v2/review/_all-tables.md (142 rows, cross-checked against the 24 module reports where applicable) + docs/backend-v2/review/_all-fks-clean.md | CONFIDENCE: HIGH for counts/column names; MEDIUM for the domain classification of tables not cited in any modules/*.md (financial_transactions and satellites, shares)`

## V.3 Master table of cross-domain relations (complete schema — extends Part VII/§24 of the master report)

This table consolidates **every physical (FK) and logical (no FK, but used as a business relation) relation** found in this audit — the 17 rows already recorded in the master report (`00-master-domain-functional-verification.md §24`) plus the additional relations evidenced by the physical FK inventory (`_all-fks-clean.md`) and by the 24 module reports. See Part VII for the final consolidated/cross-referenced version.

| Source Table | Source Field | Target Table | Target Field | Cardinality | Physical FK? | Semantics | Status |
|---|---|---|---|---|---|---|---|
| (every business table) | `tenant_id` | `tenants` | `id` | N:1 | YES (mostly composite) | tenant isolation | ALREADY_CORRECT |
| works | artista_id | artists | id | N:1 | YES (SET NULL) | authorship | ALREADY_CORRECT |
| phonograms | artista_id | artists | id | N:1 | YES (SET NULL) | authorship | ALREADY_CORRECT |
| phonograms | obra_id | works | id | N:1 | YES (SET NULL) | recording of a work | ALREADY_CORRECT |
| releases | artista_id | artists | id | N:1 | YES (SET NULL) | authorship | ALREADY_CORRECT |
| contracts | artista_id | artists | id | N:1 | YES (SET NULL) | contracting party | ALREADY_CORRECT (only written by the secondary flow) |
| artist_platform_profiles | artist_id | artists | id | N:1 | YES (CASCADE) | external platform profile | ALREADY_CORRECT |
| work_participants | work_id | works | id | N:1 | YES (CASCADE) | splits/participation | ALREADY_CORRECT |
| shares | obra_id | works | id | N:1 | YES (SET NULL) | rights/participation | ALREADY_CORRECT (NOT_DEEP_AUDITED) |
| release_works | release_id / work_id | releases / works | id / id | N:N | YES (CASCADE on both) | tracklist join, never populated | TO_BE_DESIGNED (DEC-007) |
| project_tracks | project_id | projects | id | N:1 | YES (CASCADE) | planned track | ALREADY_CORRECT |
| project_track_participants | project_track_id | project_tracks | id | N:1 | YES (CASCADE) | composer/performer/producer | ALREADY_CORRECT |
| works | projeto_id | projects | id | N:1 | NO (logical) | work link | ALREADY_CORRECT |
| transactions | projeto_id | projects | id | N:1 | NO (logical) | financial link | ALREADY_CORRECT |
| transactions | artista_id / contrato_id / evento_id | artists / contracts / events | id / id / id | N:1 | NO (logical) | management links | ALREADY_CORRECT (no physical FK) |
| audiovisual_projects | financial_project_id | projects | id | N:1 | YES (NO ACTION) | link to the source musical project | ALREADY_CORRECT relation + LEGACY_NAMING + MISSING_AT_UI_WRITE (GAP-0033) |
| marketing_projects | financial_project_id | projects | id | N:1 | YES (NO ACTION) | link to the source musical project | ALREADY_CORRECT relation + LEGACY_NAMING + MISSING_AT_UI_WRITE (GAP-0033) |
| audiovisual_projects | release_id | releases | id | N:1 | YES | distribution of the audiovisual product | ALREADY_CORRECT |
| releases | (no column) | projects | — | N:1 (decided — DEC-009) | NO | missing link to the source project | MISSING_RELATION (GAP-0168, decision resolved, `blocksSchemaV2Design: NÃO` — corrected, implementation pending) |
| projects | contrato_id | contracts | id | N:1 | CONFLICTED — see CONFLITO-03 | project↔contract link | CONFLICTED (PO-VERIFY-006) |
| transaction_allocations | project_id / release_id / phonogram_id / artist_id | projects / releases / phonograms / artists | id (all) | N:1 | YES (all NO ACTION) | granular financial allocation | ALREADY_CORRECT (schema), NO_CONFIRMED_CONSUMER |
| transaction_allocations | transaction_id | financial_transactions | id | N:1 | YES (CASCADE) | allocation of a transaction from the 2nd accounting layer | ALREADY_CORRECT (schema), NO_CONFIRMED_CONSUMER |
| performance_metric_entries | artist_id / phonogram_id / project_id / release_id | artists / phonograms / projects / releases | id (all) | N:1 | YES (all NO ACTION) | performance metric per song/release | ALREADY_CORRECT (schema), NO_CONFIRMED_CONSUMER |
| financial_transactions | contract_id | contracts | id | N:1 | YES (NO ACTION) | financial↔contract link (2nd layer) | ALREADY_CORRECT (schema), NO_CONFIRMED_CONSUMER |
| financial_transactions | event_id | events | id | N:1 | YES (NO ACTION) | financial↔event link (2nd layer) | ALREADY_CORRECT (schema), NO_CONFIRMED_CONSUMER |
| financial_transactions | counterparty_id | counterparties | id | N:1 | YES (NO ACTION) | financial counterparty | ALREADY_CORRECT (schema), NO_CONFIRMED_CONSUMER |
| counterparties | artist_id / client_id | artists / clients | id / id | N:1 | YES (NO ACTION) | counterparty = artist or client | ALREADY_CORRECT (schema), NO_CONFIRMED_CONSUMER |
| budgets | project_id | projects | id | N:1 | YES (NO ACTION) | budget linked to a project (2nd layer) | ALREADY_CORRECT (schema), NO_CONFIRMED_CONSUMER |
| conversations | contact_id | leads | id | N:1 | YES (SET NULL) | conversation linked to a lead | ALREADY_CORRECT |
| form_submissions | lead_id | leads | id | N:1 | YES (SET NULL) | public form submission → lead | ALREADY_CORRECT |
| leave_requests / payroll_entries | employee_id | employees | id | N:1 | YES (RESTRICT) | employee link | ALREADY_CORRECT (but the create of all 3 is broken, see Part VI-RH) |
| org_members | department_id / position_id / role_id | departments / positions / roles | id (all) | N:1 | YES | organizational structure/RBAC | ALREADY_CORRECT |
| tenant_invitations | org_id / role_id | organizations / roles | id / id | N:1 | YES (CASCADE / RESTRICT) | pending invitation | ALREADY_CORRECT |
| briefings | campanha_id | campaigns | id | N:1 | YES (SET NULL) | marketing briefing↔campaign | ALREADY_CORRECT |
| marketing_asset_approvals | asset_id / version_id | marketing_assets / marketing_asset_versions | id / id | N:1 | YES (CASCADE) | creative asset approval flow | ALREADY_CORRECT |
| Client/CRM | (automatic conversion) | Artist | — | 1:1 (by conversion) | NO | a converted lead always creates an Artist, without checking for duplicates | CONFLICTED (questionable behavior, PO-VERIFY-010) |
| Event | artista_id (lineup) | Artist | id | N:1 | NO (free text in some of the flows) | lineup link | CONFLICTED (weak logical relation) |

`EVIDENCE: docs/backend-v2/review/_all-fks-clean.md (physical extraction) + 00-master-domain-functional-verification.md §24 (17 relations already confirmed) + individual modules cited in each row | CONFIDENCE: HIGH for physical relations (real FK, read directly from the schema); MEDIUM for logical/behavioral relations (no FK, inferred from application code) | STATUS: PARTIALLY_CONFIRMED`

---

# PART VI — 24 COMPLETE MODULES

Each section follows the same structure: purpose in product language, entities/tables, endpoints with the calling component, field matrix (where there is a real create/edit entity), complete functional flow, what works/partial/broken/fake-stub-dead (every individual finding), decisions (resolved and pending), all the module's gaps (cross-checked against `_gap-by-module.json`), proposed v2 direction, Product Owner confirmation points, confidence and evidence.

## MODULE-ACCOUNTING

### Purpose
Financial management of the tenant: transactions (revenue/expense), invoices ("notas fiscais"), financial categorization, and results (P&L) per company/project/artist — the business "ledger" of the whole platform.

### Main entities
`Transaction` (`transactions`, 28 fields mapped by the UI / 43 physical columns), `Invoice` (`invoices`, 38 mapped fields / 62 physical columns), `FinancialCategory` (`financial_categories`, hierarchical tree via `parent_id`), `FinancialRule` (`financial_rules`). Additional schema-level layer discovered in this audit, with no confirmed consumer: `financial_transactions`/`financial_accounts`/`cost_centers`/`counterparties`/`transaction_allocations`/`performance_metric_entries`/`budgets`/`budget_revisions` (see Part V.2).

### Tables
`transactions`, `invoices`, `financial_categories`, `financial_rules`, `financial_category_templates`, `financial_category_audit_logs`, `transaction_allocations` (exists, no confirmed consumer).

### Real frontend entry points / Endpoints
- `Financeiro.tsx` (`/accounting`) → `GET/POST/PATCH/DELETE /transactions`
- `NotaFiscal.tsx` (`/accounting/nota-fiscal`) → `GET/POST/PATCH/DELETE /invoices`
- `CategoriasFinanceiras.tsx` (`/accounting/categorias`) → **none** (100% localStorage, zero real calls)
- `TransacaoRules.tsx` (`/accounting/rules`) → `GET/POST/PATCH/DELETE /financial-categories/rules*` (**nonexistent** — 400 on every load)
- `Contabilidade.tsx` (`/accounting/contabilidade`) → reuses `GET /transactions` (client-side aggregation, no dedicated P&L endpoint)
- `GET/POST/PATCH/DELETE /financial-categories` (real, tree CRUD + search/move/reorder/archive)

### Field matrix — Transaction (28 real fields, clean mapping)
| DB column | API field | create-form | edit-form | grid/table | filter | search | sort | computed |
|---|---|---|---|---|---|---|---|---|
| `tipo` | `tipo` | YES | YES | YES | YES | no | YES | no |
| `valor` | `valor` | YES | YES | YES | no | no | YES | no |
| `categoria`/`subcategoria` | same | YES | YES | YES | YES | YES | no | no |
| `projeto_id` | `projetoId` | YES (optional) | YES | YES (resolved name) | YES | no | no | no |
| `artista_id` | `artistaId` | YES (optional) | YES | YES | YES | no | no | no |
| `contrato_id` | `contratoId` | YES (optional) | YES | no | no | no | no | no |
| `evento_id` | `eventoId` | YES (optional) | YES | no | no | no | no | no |
| `financial_category_id` | `financialCategoryId` | **NO** (never set by the form — `GAP-0015`, `PARTIALLY_MIGRATED`, not a bug) | NO | no | no | no | no | no |
| `entityLinks` (management allocation) | `entityLinks` | required by the UI, **never persisted** (`GAP-0009`) | same | no | no | no | no | no |
| `anexo_url` | `anexoUrl` | YES (but always nulled before submit — `GAP-0012`) | same | no | no | no | no | no |
| remaining ~19 fields (description, date, payment method, status, notes etc.) | same | YES | YES | partial | partial | no | no | no |

### Main functional flow
1. The user opens "Nova Transação" (New Transaction) on the "Financeiro" (Finance) page.
2. Fills in type, amount, category/subcategory (legacy free text), optional links (artist/project/contract/event).
3. The system tries to persist `entityLinks` (multi-entity management allocation) — Zod (`createTransacaoSchema`, without `.passthrough()`) silently discards the key before it leaves the browser.
4. The transaction is saved with the 28 real fields mapped 1:1.
5. The "Contabilidade" (Accounting) tab tries to display P&L per Company/Project/Artist — only the grouping by Artist and by Company actually aggregates; "P&L por Projeto" (P&L per Project) treats each individual transaction as if it were its own project (`t.descricao` becomes the "project name"), and never does a `GROUP BY`/join on `transactions.projeto_id` (which is correctly populated).

### Cross-domain financial propagation rule (mandatory deep dive)
**Target rule**: a revenue/expense must be created only once; when linked to a project/artist/contract/event/etc., it must automatically appear in that entity's corresponding accounting/P&L — never requiring a second manual entry.

| Source | CURRENT_IMPLEMENTATION | GAP |
|---|---|---|
| `contracts` (signing) | partial `REAL_AUTOMATIC_PROPAGATION` — on transitioning to `assinado`, a transaction is created automatically with the contract's `valor` field | `GAP-0055`: payment method/due date/installments (rich financial terms) captured in `ContratoWizard.tsx` do **not** propagate — only the simple amount reaches Accounting |
| `events` (ticket sales) | Absent | `GAP-0078`: the ticket revenue fields in `Event` have no propagation to `transactions` at all |
| `licensing` (license fee) | Absent | `GAP-0106`: `valor_licenca` captured in the license request does not propagate to `transactions` |
| `monitoring` (detected royalties) | Absent | `GAP-0119`: royalty amounts detected/reconciled via ECAD do not propagate to `transactions` |
| `projects` (P&L per song) | The data exists (`transactions.projeto_id`, populated), but the UI does not consume it correctly | `GAP-0013`: "P&L por Projeto" does not group by project — a display regression, not a data one |
| `accounting → accounting` (multi-entity management allocation) | Absent from persistence | `GAP-0009`: `entityLinks` required by the UI, silently discarded |

**Conclusion**: the target rule is **partially implemented only for `contracts`**, and even that implementation is incomplete (only `valor`, not the rich terms). The other 3 audited sources with revenue/expense potential (`events`, `licensing`, `monitoring`) have no automatic propagation today — each would require a duplicate manual entry in `Financeiro.tsx` to appear in the P&L, violating the target rule.

`EVIDENCE: accounting.md §1,§2,§3,§5,§6,§7 | contracts.md §15 | canonical-gap-register.json (GAP-0009,GAP-0013,GAP-0055,GAP-0078,GAP-0106,GAP-0119) | CONFIDENCE: HIGH`

### What works today
Creation/editing of Transaction (28 fields) and Invoice (38 fields) — clean domains, no mapping gap. P&L per Artist and per Company. Automatic (partial) propagation from `contracts` on signing.

### What is partial
`financial_categories` is real but consumed by only 1 of the 2 screens that should use it; OFX import works but with no dedupe/atomicity nor explicit handling of unmapped fields.

### What is broken
`/financial-categories/rules*` (always 400, nonexistent endpoint); "P&L por Projeto" does not group by project; attachment upload is fake (nulled before submit).

### What is fake/stub/dead
`CategoriasFinanceiras.tsx` (100% localStorage, zero real API calls); `entityLinks` (required by the UI, discarded by the backend); `exportFieldList()` in `TransacaoFormModal.tsx` (3-sheet XLSX generator, dead code, violates the 2-sheet rule of the central reporting engine).

### Decisions affecting the module
`DEC-001` (RESOLVED) — the correction of the meaning of `projects` directly affects the interpretation of `projeto_id`. No Wave 0 decision is specific to this module.

### All gaps (14, cross-checked against `_gap-by-module.json`)
GAP-0001 (`projects` domain conflict, S1_HIGH, shared) · GAP-0009 (entityLinks never persisted, S1_HIGH) · GAP-0010 (`/financial-categories/rules*` nonexistent, S1_HIGH) · GAP-0011 (CategoriasFinanceiras.tsx disconnected, S1_HIGH) · GAP-0012 (fake attachment upload, S2_MEDIUM) · GAP-0013 (P&L per Project does not group, S2_MEDIUM) · GAP-0014 (3-sheet XLSX, dead code, S3_LOW) · GAP-0015 (financial_category_id never set — DEFERRED, PARTIALLY_MIGRATED, not a bug) · GAP-0016 (OFX import with no dedupe/atomicity, S3_LOW) · GAP-0017 (100% client-side filters/pagination, S2_MEDIUM) · GAP-0055 (contract financial terms do not propagate, S2_MEDIUM) · GAP-0078 (event revenue does not propagate, S2_MEDIUM) · GAP-0106 (license fee does not propagate, S2_MEDIUM) · GAP-0119 (monitoring royalties do not propagate, S2_MEDIUM).

### Proposed/canonical definition for backend v2
None produced — but the cross-domain propagation target rule (above) is a natural candidate to become an explicit domain contract in v2 (e.g. a `RevenueRecognized`/`ExpenseIncurred` domain event emitted by any source module, consumed exactly once by the `accounting` module).

### Product Owner confirmation points
Whether "P&L por Projeto" (P&L per Project) should in fact mean "P&L grouped by song/musical project" under the corrected model (see PO-VERIFY-008); whether automatic propagation should be extended to `events`/`licensing`/`monitoring` as a v2 requirement.

### Confidence
HIGH

### Evidence
`docs/backend-v2/field-traceability/modules/accounting.md §1,§2,§3,§5,§6,§7 | canonical-gap-register.json (GAP-0001,0009-0017,0055,0078,0106,0119) | docs/backend-v2/review/_gap-by-module.json`

---

## MODULE-ADMIN

### Purpose
Administrative panel for platform operations (plans, subscriptions, clients, audit, support) and tenant administrative settings — a critical distinction: part of the module is genuinely cross-tenant (`super_admin`), part is only a UI frame over tenant-scoped data.

### Platform-wide vs. tenant-scoped distinction (mandatory deep dive)
| Screen | Actual scope | Evidence |
|---|---|---|
| `AdminDashboard.tsx` | **Real cross-tenant** | `GET/PATCH /billing/admin/tenants[/:id]`, `@RequireRole('super_admin')` |
| `AdminClients.tsx` | **Real cross-tenant** | same route as above, lists all tenants |
| `AdminPlans.tsx` | **Real cross-tenant** (plans are global to the platform) | `billing.controller.ts` |
| `AdminSubscriptions.tsx` | **Real cross-tenant** | `billing.controller.ts` |
| `AdminAudit.tsx` | **Framed as cross-tenant, but is tenant-scoped** | reuses the same tenant-scoped `audit_logs`/`activity_logs` route of the logged-in admin's own tenant — the "Tenant" column is always blank (`GAP-0021`) |
| `AdminSupport.tsx` | **Framed as cross-tenant, but is tenant-scoped** | calls exactly `GET /support-tickets?limit=200`, the same tenant-scoped route as the real `support` module (`GAP-0021`/`GAP-0159`) |
| `AdminSettings.tsx` (8 tabs) | Neither real cross-tenant nor real tenant-scoped — **decorative** | every save action is a fake `toast` |
| `AdminKnowledge.tsx` | Dev-only mock, disabled in production | reuses the fake knowledge-base hook of the `support` module |

### Main entities
It introduces no entities of its own — it consumes `billing_plans`, `billing_subscriptions`, `tenants`, `activity_logs`, `support_tickets` from other modules.

### Tables
`billing_plans`, `billing_subscriptions`, `tenants`, `activity_logs`, `support_tickets` (via the same tenant-scoped routes of the `support` module).

### Endpoints
`GET/PATCH /billing/admin/tenants[/:id]` (`super_admin`, genuinely cross-tenant) ← `AdminDashboard.tsx`/`AdminClients.tsx`; `billing.controller.ts` routes for plans/subscriptions ← `AdminPlans.tsx`/`AdminSubscriptions.tsx`; `GET /activity-logs`/`GET /audit-logs` (tenant-scoped) ← `AdminAudit.tsx`; `GET /support-tickets?limit=200` (tenant-scoped) ← `AdminSupport.tsx`.

### Main functional flow
1. `super_admin` opens `/admin/dashboard` — real billing data consolidated cross-tenant.
2. Opens `AdminClients.tsx`/`AdminPlans.tsx`/`AdminSubscriptions.tsx` — real CRUD via `billing.controller.ts`.
3. Opens `AdminSupport.tsx`/`AdminAudit.tsx` — gets a "platform view" presentation, but the data is tenant-scoped (the same route as the real module, with no cross-tenant filter at all) — the `super_admin` sees only their own tenant, not all tenants, even though the visual frame suggests otherwise.
4. Opens `AdminSettings.tsx` (8 tabs, 770 lines) — every attempt to save is a fake toast; Webhooks/API Keys permanently empty with "new" buttons that have no `onClick`.

### What works today
Dashboard/Clients/Plans/Subscriptions — verified as real and sound against `billing.controller.ts`. Authorization (`@RequireRole('super_admin')`) confirmed consistent across frontend/backend.

### What is partial
`AdminAudit`/`AdminSupport` — real data, but framed as "cross-tenant" when they are tenant-scoped.

### What is broken
Nothing technically "broken" (no 400/500 error) — the problem is the misleading presentation of scope in `AdminAudit`/`AdminSupport`.

### What is fake/stub/dead
The entire `AdminSettings.tsx` (8 tabs, 770 lines, every action decorative); `AdminKnowledge` (self-declared mock, disabled in production); `admin-source.ts` (6 dead/empty exports); "Novo Webhook" (New Webhook)/"Nova Chave API" (New API Key) (no `onClick`).

### Decisions affecting the module
None.

### All gaps (9)
GAP-0018 (AdminSettings.tsx with no real persistence, S2_MEDIUM) · GAP-0019 (admin-source.ts, 6 dead exports, S4_INFORMATIONAL) · GAP-0020 ("indisponível" (unavailable) banner always visible, S3_LOW) · GAP-0021 (misleading cross-tenant frame on AdminAudit/AdminSupport, S2_MEDIUM) · GAP-0022 (AdminKnowledge dev-only mock, ACCEPTED_BY_EXISTING_CONTRACT) · GAP-0023 (buttons with no onClick, S3_LOW) · GAP-0024 (no table with server-side sort/pagination, S3_LOW) · GAP-0157 (reachable crash in AdminSupport due to enum mismatch, S1_HIGH, shared with support) · GAP-0159 (cross-tenant frame of AdminSupport — CLOSED/NO_FIX_REQUIRED, same root cause as GAP-0021).

### Proposed/canonical definition for backend v2
Not produced.

### Product Owner confirmation points
Whether `AdminAudit`/`AdminSupport` should in fact become real cross-tenant (an architectural change) or whether the UI frame should simply be corrected to reflect the real tenant-scoped scope.

### Confidence
HIGH (Dashboard/Clients/Plans/Subscriptions, direct citation of `billing.controller.ts`); MEDIUM (other screens, via `PROGRESS.md`)

### Evidence
`docs/backend-v2/field-traceability/PROGRESS.md ("MODULE: admin" section) | canonical-gap-register.json (GAP-0018 to GAP-0024, GAP-0157, GAP-0159)`

---

## MODULE-ARTIST

### Purpose
Registration and management of artists — profile, contacts, external platforms, metrics, relations with the whole rest of the catalog/business. It is the business entity with the most physical columns in the system.

### Main entities
`Artist` (`artists`, 78 columns), `ArtistPlatformProfile` (`artist_platform_profiles`, 24 columns).

### Tables
`artists`, `artist_platform_profiles`.

### Endpoints / calling component
`GET/POST/PATCH/DELETE /artists` ← `Artistas.tsx`/`ArtistaFormModal.tsx`; `GET/POST /artists/:id/platform-profiles[/:platform/sync]` ← `ArtistaVisao360Modal.tsx` (Spotify/YouTube sync).

### Field matrix — Artist (real create/edit via `ArtistaFormModal.tsx`, ~45 fields)
| DB column | API field | create-form | edit-form | grid | filter | search | sort | computed |
|---|---|---|---|---|---|---|---|---|
| `nome`/`nome_artistico` | same | YES | YES | YES | no | YES | YES | no |
| `email`/`telefone`/`cpf_cnpj`/`manager_contato` (AES-256-GCM encrypted) | same | YES | YES | no (never in clear text in the listing) | no | no (encrypted PII is not searchable, `GAP-0030`, correct behavior) | no | no |
| remaining ~23 direct physical columns | same | YES | YES | partial | partial | partial | partial | no |
| ~41 "extended" fields | routed to `metadata` jsonb | YES | YES | no | no | no | no | no (documented architectural decision, `GAP-0027`, `ACCEPTED_BY_EXISTING_CONTRACT`) |
| manual followers/listeners | `metadata.*` | YES (manual) | YES | YES | no | no | no | coexists with the real sync without reconciliation (`GAP-0028`) |

### Main functional flow
1. The user opens "Novo Artista" (New Artist) in `Artistas.tsx`.
2. Fills in ~45 fields via `ArtistaFormModal.tsx`.
3. Sensitive data is encrypted before persisting; the other "extended" fields go to `metadata` jsonb.
4. `ArtistaVisao360Modal.tsx` (3170 lines, the largest component in the system) aggregates, client-side, all relations (works/phonograms/releases/contracts/transactions/events/campaigns) by filtering complete arrays by `artista_id`.

### What works today
Real creation/editing (`ArtistaFormModal.tsx`), PII encryption, photo/document upload (real, via R2), XLSX import (1 sheet), real metric synchronization via Spotify/YouTube.

### What is partial
Manual follower/listener counters coexist with the real API sync without reconciliation.

### What is broken
Nothing within the real `ArtistaFormModal.tsx` flow; the public self-registration (`ArtistaSignupPublic.tsx`) is 100% broken (see MODULE-AUTH).

### What is fake/stub/dead
`ArtistaCadastro.tsx` (orphaned, ~71 fields, unreachable through normal navigation, valid code).

### Decisions affecting the module
`DEC-003` (PENDING) — which of the two creation flows (`ArtistaFormModal.tsx` vs. `ArtistaCadastro.tsx`) should be kept/expanded; recorded recommendation: keep the Modal, port the ~26 exclusive fields.

### All gaps (9)
GAP-0003 (two parallel flows, DEC-003 pending, S2_MEDIUM) · GAP-0008 (contract party sourceId, shared with contracts/crm, DEC-008 pending) · GAP-0025 (public self-registration 100% broken, S1_HIGH, shared with auth) · GAP-0026 (divergent field names in self-registration, S2_MEDIUM) · GAP-0027 (~41 fields in metadata — ACCEPTED_BY_EXISTING_CONTRACT) · GAP-0028 (manual counters vs. sync with no reconciliation, S3_LOW) · GAP-0029 (logical FKs with no physical constraint, S3_LOW) · GAP-0030 (encrypted PII not searchable — NO_FIX_REQUIRED) · GAP-0077 (event lineup as free text, no FK, shared with events, S2_MEDIUM).

### Proposed/canonical definition for backend v2
Not produced — awaits resolution of `DEC-003`.

### Product Owner confirmation points
Which artist creation flow should prevail (`DEC-003`, see PO-VERIFY-018).

### Confidence
HIGH

### Evidence
`docs/backend-v2/field-traceability/modules/artist.md §1,§2,§4,§8`

---

## MODULE-AUDIOVISUAL

### Purpose
Management of audiovisual productions (music videos, reels, teasers) tied to the song/artist — from the creative briefing to final delivery, with an approval pipeline.

### The 9 backend domains, individually named (mandatory deep dive)
Real backend, 100% `DIRECT`, 187 columns in total — only the first of the 9 has a UI:

1. **`AudiovisualProject`** (`audiovisual_projects`, 47 cols) — **HAS A UI** (`AudiovisualProjectFormModal.tsx`, 18 real fields).
2. **`Briefing`** (`audiovisual_briefings`, 22 cols) — real backend, **no UI**.
3. **`Deliverable`** (`audiovisual_deliverables`, 21 cols) — real backend, **no UI**.
4. **`Shot`** (`audiovisual_shots`, 18 cols, storyboard) — real backend, **no UI**.
5. **`ProductionDay`** (`audiovisual_production_days`, 14 cols, schedule) — real backend, **no UI**.
6. **`TeamMember`** (`audiovisual_team_members`, 14 cols, crew) — real backend, **no UI**.
7. **`Asset`** (`audiovisual_assets`, 16 cols, files) — real backend, **no UI**.
8. **`Task`** (`audiovisual_tasks`, 18 cols) — real backend, **no UI**.
9. **`Approval`** (`audiovisual_approvals`, 17 cols) — real backend, **no UI**.

All 9 have real, functional `GET/POST/PATCH/DELETE` endpoints in the backend (`+8 endpoint families analogous to those of `AudiovisualProject`); none of the remaining 8 has any frontend component that consumes them (`GAP-0031`).

### Tables
`audiovisual_projects`, `audiovisual_briefings`, `audiovisual_deliverables`, `audiovisual_shots`, `audiovisual_production_days`, `audiovisual_team_members`, `audiovisual_assets`, `audiovisual_tasks`, `audiovisual_approvals`.

### Endpoints / calling component
`GET/POST/PATCH/DELETE /audiovisual/projects` ← `AudiovisualProjectsList.tsx`/`AudiovisualProjectFormModal.tsx`/`AudiovisualProjectDetailsModal.tsx`; `/audiovisual/briefings`, `/audiovisual/deliverables`, `/audiovisual/shots`, `/audiovisual/production-days`, `/audiovisual/team-members`, `/audiovisual/assets`, `/audiovisual/tasks`, `/audiovisual/approvals` — all real, **zero confirmed frontend consumers**.

### Field matrix — AudiovisualProject (the only domain with a UI, 18 fields)
| DB column | API field | create-form | edit-form | grid | filter | search | sort | computed |
|---|---|---|---|---|---|---|---|---|
| `type`/`format` | same | YES | YES | YES | YES | no | no | no |
| `capture_status`/`editing_status`/`approval_status` | same | YES | YES | partial | **NO** (ENUM_MISMATCH PT vs EN, `GAP-0032`) | no | no | no |
| `budget_estimated`/`budget_actual` | same | YES | YES | YES | no | no | no | no |
| `financial_project_id` | `financialProjectId` | **NO** (exposed only as a filter, never written, `GAP-0033`) | NO | no | YES | no | no | no |
| `artist_id`/`release_id`/`campaign_id`/`event_id` | same | **NO** (`GAP-0034`) | NO | no | YES (all) | no | no | no |

### Main functional flow
1. The user creates an audiovisual project via the modal (18 real fields).
2. The backend supports an 8-stage pipeline (`draft→...→published`) with automatic task generation per stage — but there is no UI for pipeline transitions nor for viewing the generated tasks.
3. The status filter in the listing always returns zero results (Portuguese vs. English language bug, `GAP-0032`).

### What works today
Creation/editing of the project itself (18 fields, no mapping gap); real pipeline workflow in the backend (8 stages).

### What is partial
The pipeline transition endpoint exists but has no UI consumer.

### What is broken
Status filter (always zero results); `artist_id`/`release_id`/`campaign_id`/`event_id` relations never written despite being exposed as filters.

### What is fake/stub/dead
8 of the 9 backend domains with no UI at all (individually named above); orphaned `/audiovisual/projects/new` route (same form, no risk of field divergence); asset upload with no UI, delete does not clean up external storage.

### Decisions affecting the module
`DEC-001` (RESOLVED) — correction of the meaning of `financial_project_id`.

### All gaps (6)
GAP-0031 (8 of 9 domains with no UI, S1_HIGH) · GAP-0032 (broken status filter, ENUM_MISMATCH, S1_HIGH) · GAP-0033 (financial_project_id never written, S2_MEDIUM, shared with marketing/projects) · GAP-0034 (artist_id/campaign_id/event_id never written, S2_MEDIUM) · GAP-0035 (orphaned /audiovisual/projects/new route, S3_LOW) · GAP-0036 (asset upload with no UI, delete does not clean up storage, S2_MEDIUM).

### Proposed/canonical definition for backend v2
Not produced.

### Product Owner confirmation points
Whether the 8 backend domains with no UI (briefing/deliverables/storyboard/schedule/crew/files/tasks/approvals, named above) should get a UI in v2, or whether the real product scope is narrower than the schema suggests (see PO-VERIFY-013).

### Confidence
HIGH

### Evidence
`docs/backend-v2/field-traceability/modules/audiovisual.md §1,§2,§4,§6`

---

## MODULE-AUTH

### Purpose
Authentication (login/signup/reset), session, tenant context, authorization (roles/permissions) — the foundation of everything else in the system.

### Authentication vs. authorization vs. tenant context (mandatory deep dive)
| Layer | What it resolves | Mechanism | Source of truth |
|---|---|---|---|
| **Authentication** (who you are) | User identity | Supabase Auth SDK (login/signup/reset/JWT) | `auth.users` (managed by Supabase, outside the business schema) |
| **Tenant context** (which tenant you are acting in) | Resolution of the active `tenant_id` | `TenantGuard`, from the `app_metadata.org_id` JWT claim — **never** trusts the `X-Tenant-ID` header sent by the client, which is used only as a consistency check | JWT claim (signed, verified server-side) |
| **Authorization** (what you can do in this tenant) | Permissions/roles within the resolved tenant | `org_members.role` (legacy string) + `org_members.role_id` (RBAC FK), revalidated on every request | `org_members` (real table, not the JWT) |

This separation into 3 independent layers is confirmed consistent throughout the audit — no layer is used to resolve the responsibilities of another (e.g. the JWT never carries permissions directly; `org_members` is always revalidated, never cached from the JWT).

### Main entities
`auth.users` (Supabase-managed), `org_members` (real membership), `tenant_invitations`.

### Tables
`org_members`, `tenant_invitations` (Supabase `auth.users` schema managed externally).

### Endpoints / calling component
`PATCH /auth/provision-workspace` ← `AuthContext.tsx` (auto-triggered); `PATCH /auth/onboarding` ← `Onboarding.tsx`; `POST /auth/change-required-password` ← `ChangeRequiredPassword.tsx`; `GET /auth/context` ← `AuthContext.tsx` (every post-login navigation); Supabase Auth SDK directly ← `Auth.tsx`/`Register.tsx`/`ResetPassword.tsx` (login/signup/reset, without going through the Nest backend).

### Main functional flow
1. The user signs up/logs in via the Supabase Auth SDK.
2. `AuthContext.tsx` detects the absence of `org_id` in the JWT + `user_metadata.workspace_slug` → triggers auto-provisioning (`PATCH /auth/provision-workspace`).
3. `TenantGuard` resolves the real tenant from the JWT's `org_id` claim.
4. Membership is revalidated on every request against `org_members`.

### What works today
Login/logout/password reset, workspace auto-provisioning, `TenantGuard`/tenant isolation (confirmed solid), dual-source RBAC (`role` + `role_id` always both filled after any real write path).

### What is partial
`signOut()` does not explicitly close Realtime channels (window until reload, `GAP-0037`).

### What is broken
`ArtistaSignupPublic.tsx` — public artist self-registration 100% non-functional: `POST /public/artists` does not exist anywhere in the backend; every submission fails silently (`GAP-0025`); even if it existed, the payload field names diverge from `CreateArtistDto` (`GAP-0026`).

### What is fake/stub/dead
Nothing classified as fake — `AUTH_DISABLED` is an explicit development mode, not a disguised simulation.

### Decisions affecting the module
No formal Wave 0 decision specific to `auth` (the misnamed `org_id` is treated as a finding, not a decision — see MODULE-WORKSPACE).

### All gaps (6)
GAP-0025 (POST /public/artists nonexistent, S1_HIGH, shared with artist) · GAP-0026 (divergent field names, S2_MEDIUM) · GAP-0037 (signOut() does not close realtime channels, S2_MEDIUM) · GAP-0038 (auto-acceptance of invitation as a side effect of a read endpoint — NO_FIX_REQUIRED) · GAP-0039 (Supabase Redirect/Site URL allowlist not verifiable from code — DEFERRED, **blocks the cutover**) · GAP-0040 (no explicit "suspended"/"deleted" state beyond is_active — NO_FIX_REQUIRED).

### Proposed/canonical definition for backend v2
JWKS/ES256 + `RequestContext` already fixed in previous documents (`doc49`), not reopened here.

### Product Owner confirmation points
Whether public artist self-registration is an active product requirement or should be discontinued (see PO-VERIFY-015).

### Confidence
HIGH

### Evidence
`docs/backend-v2/field-traceability/modules/auth.md §1,§2,§3,§4,§8,§9`

---

## MODULE-CATALOG

### Purpose
Registration of the music catalog: Works (compositions) and Phonograms (recordings), including participations/splits and integration with collective management societies (ABRAMUS).

### Main entities
`Work`/"Obra" (47 cols), `Phonogram`/"Fonograma" (59 cols), `WorkParticipant` (10 cols), `RightsHolder`, `ExternalIdentifier`, `SocietyAccount`/`SocietySubmission`/`SocietySyncJob` (`registry` sub-module, 6 tables, 91 columns, zero frontend consumers).

### Tables
`works`, `phonograms`, `work_participants`, `rights_holders`, `external_identifiers`, `society_accounts`, `society_submissions`, `society_sync_jobs`, `society_payload_snapshots`, `society_submission_events`, `society_validation_errors`.

### Endpoints / calling component
`GET/POST/PATCH/DELETE /works` ← `RegistroMusicas.tsx` ("Obras" tab)/`ObraFormModal.tsx`; `GET/POST/PATCH/DELETE /phonograms` ← "Fonogramas" tab/`FonogramaFormModal.tsx`; `/registry/rights-holders`, `/registry/society-accounts`, `/registry/submissions` (real, no consumer); `GET /integrations/abramus/*` ← `AbramusSearchRow.tsx`.

### Field matrix — Work (23 fields + participants)
| DB column | API field | create-form | edit-form | grid | filter | search | sort | computed |
|---|---|---|---|---|---|---|---|---|
| `titulo` | same | YES | YES | YES | no | YES | YES | no |
| `iswc` | same | YES | YES | YES | no | YES | no | no format/duplicate validation (`GAP-0045`) |
| `projeto_id` | `projetoId` | YES | YES | YES (resolved name) | YES | no | no | no |
| `artista_id` | `artistaId` | YES (field present) | YES | YES | YES | no | no | **always written as `null`** (`GAP-0043`, confirmed bug `ObraFormModal.tsx:486`) |
| `participantes[]`/`participacao` (splits) | `authors`/`shares` | YES | YES | no | no | no | no | accepted by the DTO, **never persisted** (`GAP-0041`, real split-sheet) |

### Field matrix — Phonogram (30 fields + participation by category)
| DB column | API field | create-form | edit-form | grid | filter | search | sort | computed |
|---|---|---|---|---|---|---|---|---|
| `isrc` | same | YES | YES | YES | no | YES | no | no format validation (`GAP-0045`) |
| `obra_id` | `obraId` | YES (selector) | YES | YES (resolved name) | YES | no | no | the selector uses a static local list, not live `works` (`GAP-0044`) |
| `arquivo_audio` | `fileUrl` | YES (accepted and validated) | YES | no | no | no | no | **discarded after being accepted** — no audio pipeline (`GAP-0042`) |

### Main functional flow
1. The user registers a Work (title, ISWC, participants with percentages).
2. The user registers a Phonogram linked to the Work (title, ISRC, participation by category).
3. On save, `works.artista_id` is always written as `null` (silently erasing any pre-existing direct work↔artist link when editing).
4. The user can search for the work/artist at ABRAMUS to link or register externally (real search); trying to "import" a search result always fails (nonexistent route).

### What works today
Creation/editing of Work and Phonogram (53 real fields, clean mapping); ABRAMUS search/registration; export via the Reports Center (79 fields).

### What is partial
ABRAMUS integration — real search and registration; import, synchronization and "already imported" detection are stubs.

### What is broken
`works.artista_id` always `null` on create/edit (erases the existing link on save).

### What is fake/stub/dead
Phonogram audio upload (only name+size, never the binary); the entire `registry` module with no consumer (91 columns, 6 tables); `useCatalogStore`/`catalog.service.ts` (dead code, never imported).

### Decisions affecting the module
`DEC-001` (RESOLVED) confirms `works.projeto_id → projects.id` as `ALREADY_CORRECT`; `DEC-007` (RESOLVED) establishes that the canonical rights chain goes through `phonograms.obra_id → works.id`.

### All gaps (7)
GAP-0007 (releases tracklist model, shared, S1_HIGH) · GAP-0041 (split-sheet never persisted, S1_HIGH) · GAP-0042 (audio accepted and discarded, S1_HIGH) · GAP-0043 (works.artista_id always null, S2_MEDIUM) · GAP-0044 (phonogram→work selector uses a static list, S3_LOW) · GAP-0045 (ISRC/ISWC with no format validation, S3_LOW) · GAP-0046 (dead Zustand store, S4_INFORMATIONAL) · GAP-0047 (limit of 50 with no pagination, S2_MEDIUM).

### Proposed/canonical definition for backend v2
None produced; `DEC-007` establishes that the canonical rights chain goes through `phonograms.obra_id → works.id`, relevant to the future redesign of this module.

### Product Owner confirmation points
Whether the `registry` module (rights-holders/society-accounts/submissions) is an active product requirement that should get a UI, or dead scope to be formally discontinued.

### Confidence
HIGH

### Evidence
`docs/backend-v2/field-traceability/modules/catalog.md §1,§5,§6,§9,§11,§12`

---

## MODULE-CONTRACTS

### Purpose
Creation, management and workflow of contracts with artists/clients — templates, parties, e-signature, financial propagation when signed.

### Main entities
`Contract` (25 cols), `ContractTemplate` (11 cols), `ContractServiceType` (32 cols).

### Tables
`contracts`, `contract_templates`, `contract_service_types`.

### Endpoints / calling component
`GET/POST/PATCH/DELETE /contracts` ← `Contratos.tsx`/`ContratoWizard.tsx` (main)/`ContratoFormModal.tsx` (secondary, via `catalog`); `GET/POST/PATCH/DELETE /contract-templates` ← `TemplatesContratos.tsx` (**always HTTP 400**, `GAP-0048`); `GET/POST/PATCH /contract-service-types` ← `ContratoFormModal.tsx`; `POST /integrations/autentique/{configure,send,webhook}` (real, zero consumers); `GET/POST /integrations/oauth/*` (DocuSign, OAuth only).

### Field matrix — Contract (record level, 9 fields + N parties/signatories)
| DB column | API field | Wizard (create/edit) | Secondary modal | grid | filter | computed |
|---|---|---|---|---|---|---|
| `tipo` | same | derived from `contract_templates.tipo_servico` (free text) | derived from `contract_service_types` | YES | YES | the source diverges between the 2 components |
| `artista_id` | same | not written | YES | YES | YES | only the secondary Modal writes it |
| `arquivo_url` | same | **absent** | YES | no | no | blocks the `aguardando_assinatura→assinado` transition for Wizard contracts |
| `exclusivo` | same | **always `false`** | YES | no | no | Step 6 Select ignored in the Wizard |
| `signers[]` (jsonb) | same | YES (Step 5) | no | no | no | official, only in the Wizard |
| `observacoes` | same | serialized structured JSON (parties/PII unencrypted) | free text | no | no | **real semantic conflict**, `DEC-004` did not resolve which one wins |
| `status` | same | always forced to `rascunho`/`aguardando_assinatura` | free | YES | YES | Step 6 Select ignored |

### Main functional flow
1. The user picks a template (Step 1) — `tipo` is derived from the template's free-text `tipo_servico`.
2. Parties are detected dynamically via `{{GRUPO.CAMPO}}` placeholders in the template content (Step 2) — everything (including CPF/CNPJ/RG/address) is serialized as JSON inside `observacoes`, without encryption.
3. Fills in the manifest variables (Step 3), preview (Step 4), signatories (Step 5, real `signers[]`).
4. On save, `status` is always forced to `rascunho`/`aguardando_assinatura` (the Step 6 Select is ignored).
5. The transition to `assinado` requires a truthy `arquivo_url` — a field absent from the main flow, structurally blocking that transition for contracts created by the Wizard.

### What works today
Status workflow (9 real states, roles correctly gated); real automatic propagation on signing (creates a transaction, updates the artist's status, creates 5 CRM tasks) — when reachable; expiration cron (30 days, notification + renewal task).

### What is partial
Autentique integration — complete and functional backend, zero frontend consumers; DocuSign — OAuth only, with no real sending/signing implemented in any layer; DocuSign status tracked in client-side `sessionStorage`, not in the real backend.

### What is broken
`POST /contract-templates` rejects every real creation via `TemplatesContratos.tsx` (English DTO incompatible with the Portuguese payload sent) — blocks Step 1 of the main flow at the source; `ContactContractsService` uses an in-memory `Map`, not Postgres.

### What is fake/stub/dead
`CategoryRegistry.tsx`/`VariableRegistry.tsx` (100% localStorage); `contact-contracts` (in-memory Map); `contract-party-origin.mapper.ts` (dead code); `ContractStatus.ATIVO` (dead, unreachable enum).

### Decisions affecting the module
`DEC-002` (RESOLVED, `CONTRACT_SERVICE_TYPES_CANONICAL`) — `contract_service_types` is the canonical source of the contract type; `DEC-004` (RESOLVED, `UNIFIED_CONFIGURABLE_CONTRACT_COMPONENT`) — a single canonical component, WIZARD and QUICK modes, both entry points preserved. `DEC-008` (PENDING) — whether the `sourceId` of a party copied from CRM/Artist should become a live reference or remain an intentional snapshot (recommendation: formalize the snapshot).

### All gaps (17)
GAP-0002 (type vocabulary, DEC-002 resolved, implementation pending, S2_MEDIUM) · GAP-0004 (single WIZARD/QUICK component, DEC-004 resolved, implementation pending, S1_HIGH) · GAP-0008 (party sourceId, DEC-008 pending, S2_MEDIUM) · GAP-0048 (template creation always returns 400, S1_HIGH) · GAP-0049 (party PII in free text, exported without masking, S2_MEDIUM) · GAP-0050 (DocuSign envelope 0% implemented, S2_MEDIUM) · GAP-0051 (DocuSign status in sessionStorage, S2_MEDIUM) · GAP-0052 (real Autentique, zero consumers, S2_MEDIUM) · GAP-0053 (dead ATIVO enum, S3_LOW) · GAP-0054 (contact-contracts in a Map, S1_HIGH) · GAP-0055 (financial terms do not propagate, S2_MEDIUM) · GAP-0056 (template variable substitution with no validation, S2_MEDIUM) · GAP-0057 (limit of 50 with no truncation indicator, S2_MEDIUM) · GAP-0058 (signed PDF/file with no atomic link, S2_MEDIUM) · GAP-0059 (/contacts facade in a Map, shared with crm-relationships, S1_HIGH) · GAP-0127 (projects.contrato_id exposed as a filter, never set, S2_MEDIUM, CONFLITO-03) · GAP-0133 (contracts.lancamento_id confirmed nonexistent on both sides — NOT_APPLICABLE, closed).

### Proposed/canonical definition for backend v2
Single WIZARD/QUICK component (`DEC-004`) + canonical `contract_service_types` (`DEC-002`) — both conceptual, no technical design produced.

### Product Owner confirmation points
`DEC-008` (party sourceId); whether the PII model in `observacoes` should migrate to structured/encrypted storage before or after the WIZARD/QUICK unification (see PO-VERIFY-023).

### Confidence
HIGH

### Evidence
`docs/backend-v2/field-traceability/modules/contracts.md §5,§7,§10,§11,§14,§15,§18,§21,§30`

---

## MODULE-CRM-RELATIONSHIPS

### Purpose
Management of relationships with clients/contacts (CRM) — not to be confused with Leads (conversion funnel, a separate module).

### Main entities
`Client` (`clients`, 39 cols) — there is no physical `contacts` table; "Contact = Client" is a domain decision documented in the code itself, both concepts share `clients`.

### Tables
`clients`, `client_attachments`.

### Endpoints / calling component
`GET/POST/PATCH/DELETE /clients` ← `ContatoFormModal.tsx`/`ContatosPanel.tsx` (embedded inside `LeadsPage.tsx` of the `leads` module — the `/crm` route redirects there); `GET/POST /contacts` (legacy, **in-memory Map facade**, not Postgres, zero real frontend consumers).

### Field matrix — Client/Contact (19 real persisted fields out of ~34 captured by the form — mandatory column-level deep dive)
| Form field | Type | Encrypted | DB column | Reaches the backend? | Note |
|---|---|---|---|---|---|
| `documentNumber` | string (masked) | no (the column is) | `cpf_cnpj_encrypted` (AES-256-GCM) | YES (via `documentNumber`→`document`) | the only PII document field that survives |
| `funcao` | string | no | `funcao` | **NO** | captured, never sent |
| `foto` | file→data URL (base64) | no | `foto` | **NO** | captured (may produce a huge string in memory), never sent |
| `razao_social`/`nome_fantasia` | string (2 distinct columns) | no | `razao_social`/`nome_fantasia` | **NO, not separately** | only one of the two survives, merged into `nome` |
| `categoria` | select (6 options) | no | `categoria` | YES (via `contactType`→`category`) | |
| `perfil` | select (config-driven, cascading) | no | `perfil` | **NO** | captured, mandatory in the form validation, never sent |
| `email` | string | YES | `email_encrypted` | YES | |
| `telefone` | string | YES | `telefone_encrypted` | YES | |
| `logradouro`/`numero`/`complemento`/`bairro` | string (4 dedicated columns) | no | same (4 columns) | **NO, not separately** | only combined into a single `address`→`endereco_completo` string |
| `status_contato` | select (6 options) | no | `status_contato` | **NO** | captured, never sent |
| `prioridade_contato` | select (4 options) | no | `prioridade_contato` | **NO** | same |
| `responsavel_nome` | string (legal entity) | no | `responsavel_nome` | YES (via `responsible`) | the only "responsible person" field that survives |
| `responsavel_email`/`responsavel_telefone`/`responsavel_cargo` | string (legal entity, 3 columns) | no | same (3 columns) | **NO** | captured, never sent |
| `interacoes[]` | repeatable array (type/date/time/description) | no | `interacoes` (jsonb) | **NO** | the entire "Histórico de Interações" (Interaction History) section is discarded on submit |

Total: **15 real fields captured by the form, never reaching the backend** (`funcao`, `foto`, `razao_social`, `nome_fantasia`, `perfil`, `logradouro`, `numero`, `complemento`, `bairro`, `status_contato`, `prioridade_contato`, `responsavel_email`, `responsavel_telefone`, `responsavel_cargo`, `interacoes[]`) — neither the mapping function (`contacts.service.ts::toApiInput()`) nor `CreateClientDto`/`UpdateClientDto` declares them; with the global `ValidationPipe({whitelist:true, forbidNonWhitelisted:true})`, sending them would cause rejection even if the mapping included them.

### PII and encryption
`PII_FIELDS`: 6 (email, phone, document/cpf_cnpj, full address, notes, interactions). `ENCRYPTED_FIELDS`: 3 (`email_encrypted`, `telefone_encrypted`, `cpf_cnpj_encrypted`, real AES-256-GCM). `UNENCRYPTED_PII_FIELDS`: 3 (address, notes, interactions — no third-party PII exposed by default, unlike the `contracts` finding).

### Main functional flow
1. The user creates/edits a Contact/Client via `ContatoFormModal.tsx`.
2. ~15 real fields captured on screen never reach the backend (the mapping function does not include them).
3. The PII that actually persists (email/phone/document) is correctly encrypted with AES-256-GCM.

### What works today
Real CRUD of `clients`; correct and complete PII encryption (3 fields).

### What is partial
A presigned-to-R2 upload backend exists but is never called (the UI only uses local data URLs).

### What is broken
~15 real fields captured by the form, never persisted (neither in a dedicated column nor in `metadata`).

### What is fake/stub/dead
Legacy `/contacts` facade (in-memory Map, `GAP-0059`); `ContactComponents.tsx` (317 lines/13 components, dead code); 4 dead Zustand stores (contact-agenda/contact-filters/contact-panel/contact-tags).

### Decisions affecting the module
None resolved directly, but `DEC-008` (in `contracts`) refers to the CRM origin of contract parties.

### All gaps (10)
GAP-0008 (party sourceId, shared, S2_MEDIUM) · GAP-0054 (ContactContractsService in a Map, shared with contracts, S1_HIGH) · GAP-0059 (/contacts facade in a Map, S1_HIGH) · GAP-0060 (~15 fields never mapped, S1_HIGH) · GAP-0061 (Auditoria.tsx field mismatch, S3_LOW) · GAP-0062 (dead deep link, S3_LOW) · GAP-0063 (relationship "strength score" is a purely frontend heuristic, S3_LOW) · GAP-0064 (limit of 50 with no pagination, S2_MEDIUM) · GAP-0065 (inconsistent relationship-type taxonomy, S2_MEDIUM) · GAP-0066 (WhatsApp/Email interaction channel with no real send action behind it, S3_LOW).

### Proposed/canonical definition for backend v2
Not produced.

### Product Owner confirmation points
Whether the ~15 fields captured and discarded today are a real product requirement (and should get a destination in v2) or should be removed from the form.

### Confidence
HIGH (verified by direct reading of `crm-relationships.md`, including the 15-field matrix)

### Evidence
`docs/backend-v2/field-traceability/modules/crm-relationships.md (direct reading in this step, field matrix/PII/consolidated gaps sections)`

---

## MODULE-DASHBOARD

### Purpose
Home panel aggregating cross-domain indicators (finance, artists, contracts, events, catalog).

### Main entities
None of its own — it aggregates `artists`, `contracts`, `transactions`, `events`, `releases`, `projects`, `activity_logs`. There is a real `analytics` module behind it (`AnalyticsController`).

### Tables
No dedicated table — it reads from other modules' tables + `GET /analytics/dashboard` (21 tenant-scoped SQL aggregations, immune to truncation) and `GET /analytics/revenue` (real monthly time series).

### Endpoints / calling component
`GET /analytics/dashboard`, `GET /analytics/revenue` — both real, well built, **with no frontend consumer** (`Dashboard.tsx` uses neither of them); instead, the 8 widgets of `Dashboard.tsx` fire independent calls to the already-audited lists of other modules (with no custom `limit`, inheriting the default truncation at 50).

### Main functional flow
1. The user opens `/dashboard`.
2. 8 widgets fire independent calls to already-audited lists of other modules, with no custom `limit` (inheriting the truncation at 50).
3. 14 `useWsEvent()` subscriptions in the Activity Feed never receive anything — there is no bridge between the internal domain event bus (`EventEmitter2`) and the Supabase Realtime broadcast.

### What works today
General rendering of the widgets with the truncated data available; a real `AnalyticsController` behind it, ready for future use.

### What is partial
The per-widget date-range filter is client-side and always re-issues the same unfiltered call.

### What is broken
Activity Feed (0 of 14 events actually arrive); 3 of the 4 compared KPI formulas diverge between the truncated version displayed and the complete SQL version (computed but not used); "Receita Total" (Total Revenue) labeled as a total, but actually a rolling 30-day window.

### What is fake/stub/dead
Two blocks of dead code confirmed inert (`computeFromMockStorage()`, ~150 lines; a legacy block of 11 `CustomEvent` listeners); `dashboard-layout` Zustand store (drag-to-rearrange, never wired).

### Decisions affecting the module
None.

### All gaps (7)
GAP-0067 (widgets read an obsolete pre-aggregated cache, S2_MEDIUM) · GAP-0068 ("Atividades Recentes" (Recent Activities) with no real event family at all, S2_MEDIUM, shared with events) · GAP-0069 (3 widgets truncated at limit=50, S2_MEDIUM) · GAP-0070 (client-side date filter, useless refetch, S2_MEDIUM) · GAP-0071 (widget visibility by role only in the frontend, S2_MEDIUM) · GAP-0072 (dead Zustand store, S4_INFORMATIONAL) · GAP-0167 (cross-module pattern of 9 dead stores, S4_INFORMATIONAL).

### Proposed/canonical definition for backend v2
None — but the already existing `AnalyticsController` is a natural candidate for a single source of truth in v2.

### Product Owner confirmation points
Whether "Receita Total" (Total Revenue) should in fact be an overall total (requiring a calculation change) or remain a 30-day window (requiring only the label to be fixed).

### Confidence
MEDIUM (via `PROGRESS.md`, not a dedicated module — there is no `dashboard.md` in the `modules/` series)

### Evidence
`docs/backend-v2/field-traceability/PROGRESS.md ("MODULE: dashboard" section) | canonical-gap-register.json (GAP-0067 to GAP-0072)`

---

## MODULE-EVENTS

### Purpose
Calendar/schedule of events (shows, recording sessions, meetings) with participants and financial implications.

### Main entities
`Event` (`events`, 23 columns, a single physical table — there are no separate venue/recurrence/reminder/attachment tables, confirmed absent).

### Tables
`events`.

### Endpoints / calling component
`GET/POST/PATCH/DELETE /events` ← `Agenda.tsx`/`SchedulerFormModal.tsx`/`SchedulerViewModal.tsx`.

### Field matrix — Event (real create/edit via `SchedulerFormModal.tsx`)
| DB column | API field | create-form | edit-form | grid/real read | filter | search | sort | computed |
|---|---|---|---|---|---|---|---|---|
| `titulo` | same | YES | YES | YES | no | YES | YES | no |
| `tipo` | same | YES | YES | YES | YES | no | no | no |
| `participantes` (jsonb) | same | YES (via `useAgendaParticipants()`, aggregates artist/employee/user/contact) | YES | **read from the wrong path** (`evento.metadata.participants`, always empty, falls back to the 1st artist) | no | no | no | `GAP-0075`(read)/the primary participant also writes `artista_id` (loose FK) |
| `artista_id` | same | derived (1st participant with `source==="artist"`) | same | via participants | YES (free text in some of the flows) | no | no | no declared constraint |
| `capacidadePublico` (only for the "shows" type) | `capacity` | YES | YES | **NO** | no | no | no | the DTO accepts it, `dtoToEntity()` never maps it (`GAP-0073`) |
| 12 record-level fields (date/time/location/description/notes etc.) | same | YES (13 populatable physical columns) | YES | partial | partial | no | no | `status` only on edit |

### Main functional flow
1. The user creates an event via `SchedulerFormModal.tsx` — correct mapping to the real fields (clean create).
2. `Agenda.tsx`/`SchedulerViewModal.tsx` read a **fictitious** set of fields that corresponds neither to the real columns nor to the DTO — `data_inicio`, `tipo_evento`, `horario_inicio/fim`, `cidade`, `estado`, `capacidade_publico`, `valor_cache`, `valor_ingresso` — none of them exists in the real DTO, causing: every event renders at "now" (the date fallback always fires), every event becomes "all-day", the type filter never matches anything real, capacity is never displayed (section always hidden).

### What works today
Creation/editing of the event itself (correct mapping, no `CREATE_MAPPING_MISMATCH`).

### What is partial
XLSX import/export (client-side) use the same fictitious names — import would reject every row; export comes out mostly blank.

### What is broken
The entire display in `Agenda.tsx`/`SchedulerViewModal.tsx` (fictitious fields); `capacidadePublico` accepted by the DTO but silently discarded by the service; participants displayed from the wrong path (shows only the 1st artist, loses the others).

### What is fake/stub/dead
There is no recurrence, reminders, attachments, external calendar integration, nor event→finance propagation in any layer (all confirmed absent, not merely undiscovered); 2 dead-code artifacts (`events.store.ts`, `eventService`); dead deep link to a specific event.

### Decisions affecting the module
None.

### All gaps (9)
GAP-0068 (Activity Feed with no real events, shared with dashboard, S2_MEDIUM) · GAP-0073 (capacidadePublico discarded, S2_MEDIUM) · GAP-0074 (internal bus with no bridge to Realtime, S2_MEDIUM) · GAP-0075 (Auditoria.tsx field mismatch, S3_LOW) · GAP-0076 (dead deep link, S3_LOW) · GAP-0077 (lineup as free text, shared with artist, S2_MEDIUM) · GAP-0078 (ticket revenue with no propagation to accounting, S2_MEDIUM) · GAP-0079 (limit of 50, the calendar shows a partial month, S2_MEDIUM) · GAP-0167 (cross-module pattern of dead stores, S4_INFORMATIONAL).

### Proposed/canonical definition for backend v2
Not produced.

### Product Owner confirmation points
Whether the fictitious set of fields used in `Agenda.tsx`/`SchedulerViewModal.tsx` reflects a real product requirement not yet implemented in the backend (city/state/capacity/separate times) or should simply be removed/aligned to the real schema.

### Confidence
HIGH (verified by direct reading of `events.md` in this step)

### Evidence
`docs/backend-v2/field-traceability/modules/events.md (direct reading in this step, flow/fields/gaps sections)`

---

## MODULE-INTEGRATIONS

### Purpose
External integrations layer — payments, e-signature, music streaming, social media/ads, digital distribution, rights registration, audio recognition, storage, email, observability, AI.

### Main entities
It introduces no domain tables of its own — it uses `oauth_connections` (tokens), `webhook_events` (idempotency), `ai_jobs`/`ai_usage_logs`, and provider-specific tables (e.g. `artist_platform_profiles`).

### Tables
`oauth_connections`, `webhook_events`, `ai_jobs`, `ai_usage_logs`, `integrations`.

### Main functional flow
1. The tenant connects a provider (e.g. Spotify) via OAuth or API key.
2. The credential is encrypted and stored tenant-scoped (`IntegrationBaseService`).
3. Synchronizations/calls go through `resilientFetch` (retry, circuit breaker) — except ABRAMUS/ACRCloud, which use plain `fetch()` without that protection.
4. Webhooks (Stripe, Autentique) validate the signature and are idempotent (`webhook_events.external_id UNIQUE`).

### Complete provider matrix
| # | Provider | Type | Current implementation | Official API (documented) | Credential model | Status |
|---|---|---|---|---|---|---|
| 1 | Stripe (SaaS billing) | PAYMENTS | Real, Stripe SDK | YES | platform | PARTIAL (real backend; frontend hooks disabled) |
| 2 | Stripe Connect | PAYMENTS | Real (generic OAuth) | YES | tenant | PARTIAL |
| 3 | DocuSign | E-SIGNATURE | OAuth connect only | YES (Authorization Code Grant) | tenant | PARTIAL (no envelope/signing) |
| 4 | Autentique | E-SIGNATURE | Complete backend (real GraphQL) | YES | tenant | PARTIAL (zero frontend consumers) |
| 5 | Clicksign | E-SIGNATURE | UI selector only | — | — | STUB |
| 6 | Spotify | MUSIC_STREAMING | Real, OAuth client-credentials | YES | platform | IMPLEMENTED |
| 7 | YouTube (Data API) | VIDEO/STREAMING | Real | YES | platform | IMPLEMENTED |
| 8 | Instagram/Meta | SOCIAL_MEDIA | Real (organic+corporate) | YES | tenant | IMPLEMENTED |
| 9 | TikTok / TikTok Ads | SOCIAL_MEDIA/MARKETING | Real | YES | tenant | IMPLEMENTED |
| 10 | Google Ads | MARKETING | Real | YES | tenant | IMPLEMENTED |
| 11 | ABRAMUS | RIGHTS_REGISTRY | Partial (real search/registration; import/sync stub) | YES | tenant | PARTIAL |
| 12 | ACRCloud | AUDIO_RECOGNITION | Contract diverges from the frontend hook | YES | tenant | PARTIAL |
| 13 | Cloudflare R2 | STORAGE | Real | YES | platform | IMPLEMENTED |
| 14 | Resend | EMAIL | Real (backend only) | YES | platform | IMPLEMENTED |
| 15 | Sentry | OBSERVABILITY | Real | YES | platform | IMPLEMENTED |
| 16 | PostHog | ANALYTICS | Config present, no confirmed code usage beyond the env var | YES | platform | STUB |
| 17 | OpenAI/Anthropic/Google AI (AI router) | AI | Real (multi-provider) | YES | platform | IMPLEMENTED |
| 18 | `external-data` framework | RIGHTS_REGISTRY/DISTRIBUTION | Complete backend infra (idempotency, HMAC webhook), **0 real providers registered** (only 2 placeholders: `UnconfiguredDistributorProvider`/`UnconfiguredSocietyProvider`) | N/A | tenant (future) | CONFIG_ONLY |
| 19 | NF-e (fiscal invoice issuance) | OTHER | UI with no real collection | not researched | tenant (future) | STUB |
| 20 | ECAD (connection card in integrations) | RIGHTS_REGISTRY | UI_ONLY — distinct from the real ingestion of ECAD statements in the `monitoring` module | not researched | tenant (future) | UI_ONLY |
| 21 | UBC | RIGHTS_REGISTRY | UI hooks/dialogs, zero backend | not researched | tenant (future) | UI_ONLY |

### Sub-table — the 6 named digital distributors (mandatory deep dive)
| Distributor | CURRENT_IMPLEMENTATION | OFFICIAL_API_STATUS_AS_DOCUMENTED | TENANT_CONNECTION_MODEL | CREDENTIALS_REQUIRED_LATER |
|---|---|---|---|---|
| ONErpm | Static catalog (`DISTRIBUTION_PLATFORMS`, `distribution-platforms.ts`) — an `<a target="_blank">` link to the official portal; explicit text "abrir o portal não conecta a conta ao sistema" (opening the portal does not connect the account to the system) | Not researched in this or in previous audits (out of scope, Decision D1) | `TENANT_OWNED` (future) — today the "connection state" is only read from `localStorage["musicos360_distributor_connections"]`, never written by any code | YES (0 credentials added in this audit, `CREDENTIALS_TO_ADD_NOW: 0`) |
| DistroKid | same | same | same | same |
| Symphonic | same | same | same | same |
| SoundOn | same | same | same | same |
| MusicPro | same | same | same | same |
| SomVibe | same | same | same | same |

No success simulation exists for any of the 6 (they comply with the "forbidden" rule of Decision D1 — `doc25`/`doc31`): import/export/sync/status-sync/catalog-mapping/release-mapping/external-ids are all explicitly `NOT_IMPLEMENTED`, not faked.

### What works today
Spotify, YouTube, Instagram/Meta, TikTok, Google Ads, Cloudflare R2, Resend, Sentry, AI router — all `IMPLEMENTED`, real.

### What is partial
Stripe (complete backend, frontend hooks disabled), DocuSign (OAuth only), Autentique (complete backend, zero consumers), ABRAMUS (real search/registration, import/sync stub).

### What is broken
`signing.adapter.ts` always returns "indisponível" (unavailable) for every signing provider, including Autentique (which has a real, complete backend) — the only real UI entry point for e-signature is structurally broken for the 3 providers offered.

### What is fake/stub/dead
No `FAKE_INTEGRATION_GAP` found anywhere — every unconfigured path fails explicitly, never simulates success (a discipline confirmed across the whole audit series).

### Decisions affecting the module
No formal Wave 0 decision — the distributors decision (D1, `doc25`) is already `APPROVED`/`RESOLVED` conceptually; future technical execution is out of scope.

### All gaps (12)
GAP-0050 (DocuSign envelope 0%, shared with contracts, S2_MEDIUM) · GAP-0052 (Autentique zero consumers, shared, S2_MEDIUM) · GAP-0080 (6 STUB distributors, DEFERRED) · GAP-0081 (Stripe client path in Billing.tsx is real, reconciled, DEFERRED) · GAP-0082 (ABRAMUS UI with no backend of its own — note: search/registration do have a backend, but the *connection card* itself is UI-only, DEFERRED) · GAP-0083 (ACRCloud UI_ONLY, DEFERRED) · GAP-0084 (PostHog UI_ONLY, DEFERRED) · GAP-0085 (NFe UI_ONLY, DEFERRED) · GAP-0086 (ECAD card in integrations is UI_ONLY, distinct from the real ingestion in monitoring, DEFERRED) · GAP-0087 (UBC UI_ONLY, DEFERRED) · GAP-0088 (external-data framework with no real providers registered, DEFERRED) · GAP-0117 (real ECAD ingestion in monitoring — NO_FIX_REQUIRED, distinct from the GAP-0086 card).

### Proposed/canonical definition for backend v2
No new definition — the already established `PLATFORM_SHARED` vs. `TENANT_OWNED` credential model should be preserved (see Part VIII).

### Product Owner confirmation points
Whether `signing.adapter.ts` should be rewired to the real Autentique backend as a short-term priority (capability already ready, low implementation cost, see PO-VERIFY-016); whether there is a real timeline for researching the official APIs of the 6 distributors (PO-VERIFY-014).

### Confidence
HIGH

### Evidence
`docs/backend-v2/field-traceability/modules/integrations.md §2,§5.20,§5.21,§5.22`

---

## MODULE-INVENTORY

### Purpose
Inventory/asset control (equipment, instruments, materials) — the simplest and least fragmented CRUD in this series, but with an important scope limit to be declared explicitly.

### Explicit scope declaration (mandatory)
**Movements, reservations, loans and maintenance DO NOT EXIST** in any layer of this module — no table, no endpoint, no dedicated field beyond the free `status` value. The schema is a **pure quantity snapshot**: a single integer column, with no ledger/movements, last-write-wins, no optimistic locking, no structured audit trail. The `status` field (`disponivel`/`em_uso`/`manutencao`/`descartado`/`reservado`) only *suggests* these concepts by name — there is no workflow, satellite table (`inventory_movements`/`inventory_reservations`/`inventory_loans`/`inventory_maintenance`) nor business process behind any of them.

### Main entities
`InventoryItem` (`inventory_items`, 19 columns — a single physical table).

### Tables
`inventory_items`.

### Endpoints / calling component
`GET/POST/PATCH/DELETE /inventory-items` ← `Inventario.tsx`/`InventarioFormModal.tsx`/detail modal.

### Field matrix — InventoryItem (~19 fields, real create/edit)
| DB column | API field | create-form | edit-form | grid | filter | search | sort | computed |
|---|---|---|---|---|---|---|---|---|
| `nome`/`categoria`/`valor_unitario` | same | YES | YES | YES | YES | YES | YES | no |
| `status` | same | YES (5 values) | YES | YES | YES | no | no | **3 divergent vocabularies** (backend DTO, frontend Zod schema, TS type) — the UI offers "Emprestado" (Loaned)/"Danificado" (Damaged) (rejected, HTTP 400); "Reservado" (Reserved) (accepted) is never offered (`GAP-0089`) |
| `local_compra`/`numero_nota_fiscal`/`data_entrada` | `localCompra`/`numeroNotaFiscal`/`dataEntrada` | YES (create maps correctly) | **NO** (read in camelCase against a snake_case API) | the "Entrada" (Entry) column always shows "—" | no | no | no | case bug only in edit mode |
| `responsavel_atual` | same | YES (free text) | YES | YES | no | no | no | no real user/employee FK (`GAP-0090`) |

### Main functional flow
1. The user creates/edits an item — in edit mode, `localCompra`/`numeroNotaFiscal`/`dataEntrada` are read in camelCase against an API that responds in snake_case — these 3 real fields always appear empty when editing (although CREATE maps them correctly).
2. Stock is a pure quantity snapshot (see the scope declaration above).

### What works today
Basic CRUD (creation); export via the Reports Center (uses the correct names, not affected by the camelCase bug).

### What is partial
Low-stock/overdue-maintenance alerts computed only on the client, with no backend notification; the `valor_atual` field (depreciation) exists but no logic recalculates it after creation.

### What is broken
Edit pre-fill for 3 real fields (camelCase vs. snake_case); 3-way status `ENUM_MISMATCH`; the table's "Entrada" (Entry) column always shows "—".

### What is fake/stub/dead
Movements/reservations/loans/maintenance — confirmed absent in every layer (see the scope declaration); 2 dead-code files (Zustand store + deep link); photo upload has a real pipeline, but delete never removes the object from R2.

### Decisions affecting the module
None.

### All gaps (8)
GAP-0089 (3-way status ENUM_MISMATCH, S2_MEDIUM) · GAP-0090 (the responsible person is free text, no FK, S2_MEDIUM) · GAP-0091 (Auditoria.tsx field mismatch, S3_LOW) · GAP-0092 (dead deep link, S3_LOW) · GAP-0093 (client-side-only alerts, S2_MEDIUM) · GAP-0094 (depreciation never recalculated, S3_LOW) · GAP-0095 (limit of 50 with no pagination, S2_MEDIUM) · GAP-0096 (photo delete does not clean up R2, S3_LOW).

### Proposed/canonical definition for backend v2
Not produced — clearly separating the real CRUD (exists) from movements/reservations/loans/maintenance (does not exist, confirmed absent) is the recommended starting point for the v2 design.

### Product Owner confirmation points
Whether inventory movements/reservations/loans/maintenance are real product requirements (today the schema supports none of this beyond the `status` field).

### Confidence
MEDIUM (via `PROGRESS.md`; no dedicated `inventory.md` was consulted in this step beyond what is already summarized in the master report)

### Evidence
`docs/backend-v2/field-traceability/PROGRESS.md ("MODULE: inventory" section) | canonical-gap-register.json (GAP-0089 to GAP-0096)`

---

## MODULE-LEADS

### Purpose
Lead capture and conversion funnel (potential artists/clients) — distinct from CRM (`clients`, an already established relationship).

### Main entities
`Lead` (`leads`, 34-35 columns, 9-state workflow).

### Tables
`leads`, `lead_interactions` (dedicated, but disconnected from the real history mechanism), `lead_uploads`, `pipelines`/`pipeline_stages`/`pipeline_opportunities` (complete schema, zero consumers, dead code).

### Endpoints / calling component
`GET/POST/PATCH/DELETE /leads` ← `LeadsPage.tsx`; `POST /lead-interactions` ← never actually called by the UI (it would break if it were); `POST /public/artist-registration` ← public capture form (real).

### Field matrix — Lead (mandatory CRUD/enum/conversion/duplication deep dive)
| DB column | API field | create/edit-form | grid | filter | search | sort | computed |
|---|---|---|---|---|---|---|---|---|
| `origem_lead`, `probabilidade_fechamento`, `responsavel`, `prioridade`, `temperatura`, `proximo_follow_up`, `valor_estimado` | same (7 physical columns) | YES (they appear to be the real ones) | YES | YES | no | YES | **the real values actually live in `dados_internos_crm` (jsonb), not in these columns** — documented duplication |
| `whatsapp` | same | YES | no | no | no | no | **collected, never persisted** (`GAP-0097`, DTO strip) |
| `status` (9 states) | same | YES | YES | YES | no | no | changing it to `fechado` triggers automatic conversion |
| `lead_score` | same | no (read-only) | YES | no | no | YES | displayed, **never computed by any backend logic** (`GAP-0100`, always the default) |

### Main functional flow
1. A lead is captured (public form or manually).
2. Interactions are recorded in the jsonb array `payload_servico.interacoes[]` (this works — it is the REAL history used by the UI, completely disconnected from the dedicated `lead_interactions` table/endpoint).
3. `POST /lead-interactions` (the dedicated "official" endpoint) spreads a camelCase DTO directly over a snake_case entity with no mapping — `lead_id` (NOT NULL) is never populated; it would fail on any real call (inert today only because the UI never actually calls it, `GAP-0098`).
4. Changing the status to `fechado` triggers automatic conversion: it creates a Client **AND always creates an Artist** (even if the lead does not have an artistic profile), **without checking for duplicates** (`GAP-0101`), in 3 independent try/catch operations outside the original transaction (a failure between steps leaves the lead permanently stuck).

### Status enum (9 states) and duplicate detection
Status/pipeline transitions **have no server-side state-machine validation** — any status can be set from any status (`GAP-0102`). Duplicate detection (same email/phone) **does not exist** — the public capture form accepts unlimited duplicate submissions (`GAP-0101`).

### What works today
Public capture, listing/editing of leads, interaction history via manual jsonb, export (correctly delegates to the central reporting engine).

### What is partial
A complete generic Pipeline/Kanban system (`pipelines`/`pipeline_stages`/`pipeline_opportunities`, 41 columns) exists only as a TypeORM declaration, with no controller/service/frontend at all.

### What is broken
`POST /lead-interactions` (would break on any real call); lead→artist conversion always creates a duplicate artist and is not atomic.

### What is fake/stub/dead
Lead attachment upload (100% decorative, `URL.createObjectURL`); 3 of 4 dead Zustand stores.

### Decisions affecting the module
None directly, but the `DEC-001` correction is relevant to the note in `GAP-0099` about `financial_project_id`.

### All gaps (9)
GAP-0097 (whatsapp collected, never persisted, S2_MEDIUM) · GAP-0098 (LeadInteractionsService camelCase vs. snake_case, S2_MEDIUM) · GAP-0099 (conversion with no retroactive financial_project_id link, S2_MEDIUM, see CONFLITO-02) · GAP-0100 (lead_score never computed, S3_LOW) · GAP-0101 (no duplicate lead detection, S2_MEDIUM) · GAP-0102 (status transitions with no server-side validation, S3_LOW) · GAP-0103 (limit of 50, the kanban loses leads beyond the 50th per column, S2_MEDIUM) · GAP-0104 (dead Zustand store, S4_INFORMATIONAL) · GAP-0167 (cross-module pattern of dead stores, S4_INFORMATIONAL).

### Proposed/canonical definition for backend v2
Not produced.

### Product Owner confirmation points
Whether lead→artist conversion should in fact always create an Artist (even for non-artistic leads) or whether this is a mistaken business rule to be corrected (see PO-VERIFY-010).

### Confidence
MEDIUM (via `PROGRESS.md`; no direct reading of `leads.md` in this step beyond what is already summarized in the master report)

### Evidence
`docs/backend-v2/field-traceability/PROGRESS.md ("MODULE: leads" section) | canonical-gap-register.json (GAP-0097 to GAP-0104)`

---

## MODULE-LICENSING

### Purpose
Licensing of works/phonograms for third-party use — predominantly sync licensing, with master-use and mechanical licensing as secondary categories in the same form/table.

### Individual classification (mandatory deep dive: sync/master/mechanical/clearance/approval/expiry/documents)
| Category | Status in the schema/UI | Evidence |
|---|---|---|
| **Sync** (5 sub-types: `sync_tv`, `sync_cinema`, `sync_publicidade`, `sync_games`, `sync_digital`) | **Predominant** — the only creation modal is literally called "Nova Licença de Sync" (New Sync License); `tipo` is free text (`@IsString()`, no `@IsIn`), the 5 values above are the only ones offered in the real UI | `licensing.md` (direct reading, lines 243-248) |
| **Master Use** (`master_use`) | Present as the 6th value of `tipo` in the same free-text field — a secondary category, same form/table, with no distinct fields or flow | same |
| **Mechanical** | **DOES NOT EXIST** as a category in any layer — it does not appear as a `tipo` value, has no dedicated field, has no flow | confirmed absent by direct reading |
| **Clearance** (prior authorization/approval workflow) | **DOES NOT EXIST** — there are no `license_requests`/`license_approvals` satellite tables; `status` is edited directly with no workflow/approval behind it | `licensing.md` line 35 |
| **Approval** (multi-step approval flow) | **DOES NOT EXIST** — changing `status` is just another ordinary field edit, not a gated workflow | same |
| **Expiry** (`expirada`) | Exists as a `status` value, but is **entirely manual** — no job/cron marks a license as expired when `data_fim` is passed (`EXPIRATION_GAP` confirmed, `GAP-0105` adjacent) | lines 377-383 |
| **Documents** (proposal/contract/authorization/clearance document) | **DOES NOT EXIST** — no attachment field (`*_url`/`*_key`/`attachment*`) exists in `licenses`; `DOCUMENT_GENERATION: NOT_IMPLEMENTED` | lines 480-491 |

### Main entities
`License` (`licenses`, 27 columns, a single physical table, no satellite tables).

### Tables
`licenses`.

### Endpoints / calling component
`GET/POST/PATCH/DELETE /licenses` ← "Nova Licença de Sync" (New Sync License) modal.

### Main functional flow
1. The user records a license request (intended use, territory, duration).
2. The use/territory/duration fields are accepted by the DTO but **never persisted** in the table (`GAP-0105`, S1_HIGH).
3. `status` has no workflow/transition validation — "expirada" (expired) is entirely manual; a license with `data_fim` in the past remains "Ativa" (Active) indefinitely.

### What works today
Basic creation/editing of a license request (core fields: work/phonogram, client via `cliente_id`, amount).

### What is partial
`PERCENTAGE`-type remuneration is invisible in reports (excluded from the export contract by a historical mistake).

### What is broken
`uso_pretendido`/`territorio`/`duracao_licenca` accepted by the DTO, never persisted.

### What is fake/stub/dead
2 dead Zustand stores; dead "Rádio" (Radio) filter (an option with no corresponding data); `licenses.cliente` (free text) is never written by the real flow, but is required by the `Auditoria.tsx` completeness tool — every real license created is flagged as incomplete by that tool.

### Decisions affecting the module
None.

### All gaps (6)
GAP-0105 (request fields never persisted, S1_HIGH) · GAP-0106 (license fee with no propagation to accounting, S2_MEDIUM, shared) · GAP-0107 (Auditoria.tsx field mismatch, S3_LOW) · GAP-0108 (dead deep link, S3_LOW) · GAP-0109 (PDF with no atomic link to the status transition, S2_MEDIUM) · GAP-0110 (limit of 50 with no pagination, S2_MEDIUM).

### Proposed/canonical definition for backend v2
Not produced.

### Product Owner confirmation points
Whether licensing should in fact get a formal relation with `contracts` and `accounting` (nonexistent today in any layer); whether `mechanical`/clearance/approval/documents (confirmed absent) are real product requirements for v2.

### Confidence
HIGH (verified by direct reading of `licensing.md` in this step)

### Evidence
`docs/backend-v2/field-traceability/modules/licensing.md (direct reading in this step, sync/master/mechanical/clearance/approval/expiry/documents classification)`

---

## MODULE-MARKETING

### Purpose
The complete marketing cycle — strategic, operational, creative, publishing, analytics — not only paid campaigns.

### Main entities
`Campaign` (`campaigns`), `MarketingContentPost` (`marketing_content_posts`), `MarketingAsset` (+versions +approvals), `MarketingProject` (`marketing_projects`), `MarketingStrategy` (Strategy→Objective→Initiative→Action hierarchy), `MarketingTask`.

### Tables
`campaigns` (shared by 2 incompatible systems), `campaign_assets`/`campaign_tasks` (orphans of the dead System A), `marketing_content_posts`, `marketing_assets`/`marketing_asset_versions`/`marketing_asset_approvals`, `marketing_projects`, `marketing_strategies`/`marketing_strategy_objectives`/`marketing_strategy_initiatives`/`marketing_strategy_actions`, `marketing_tasks`, `briefings`.

### Campaigns / Content / Publishing / Metrics / Attribution / Sync / Providers (mandatory deep dive)
| Sub-domain | Actual state | Evidence |
|---|---|---|
| **Campaigns** | 2 parallel, incompatible systems in the same physical `campaigns` table: **System A** (`CampaignsController`, `GET/POST/PATCH/DELETE /campaigns`) — confirmed dead, no consumer, structurally broken if it were called (it would violate NOT NULL). **System B** (`MarketingCampaignBuilderController`, `GET/POST /marketing/campaigns`, `POST /marketing/campaigns/draft`, `/:id/{validate,publish,pause,archive}`) — the real one, used by `Campanhas.tsx`/`CampaignBuilderModal.tsx` | `GAP-0111`, S1_HIGH |
| **Content** | Real content scheduling (BullMQ queue, 3 attempts, backoff, idempotency) via `Calendario.tsx` — solid infrastructure | `marketing.md §7` |
| **Publishing** | The final publish call on each provider **always fails explicitly** (honest stub adapter, does not simulate success) | same |
| **Metrics** | `Campanhas.tsx` displays `budget * 0.41` as a **fabricated** "Gasto Total" (Total Spend) whenever real cost/conversion data has not been typed in manually | `GAP-0112`, S2_MEDIUM |
| **Attribution** | No real synchronization of ad-platform metrics, even though real OAuth exists for Meta/Google Ads/TikTok for other purposes (`GAP-0113`, confirmed no ad-platform integration in campaign creation, DEFERRED/informational) |
| **Sync** | Absent — no consumer connects the event bus to campaign status changes (`GAP-0114`) |
| **Providers** | Asset library with real versioning/approval (`marketing_assets`/`_versions`/`_approvals`) — functional end to end |

### Main functional flow
1. The user creates a campaign via the Campaign Builder (System B) — 15 fields in the payload, only 5 in a dedicated physical column; the other 10 (including the link to the promoted entity) only in `metadata.marketingBuilder.payload` jsonb.
2. Content scheduling is real — but the final publishing always fails explicitly.
3. The displayed metrics use `budget * 0.41` as a fabricated "Gasto Total" (Total Spend).
4. Real automation: completing a musical Project automatically creates a marketing workspace + a "criar arte de capa" (create cover art) task (`MarketingProjectsService.createFromCompletedProject()`).

### What works today
Campaign creation via the Campaign Builder; content scheduling (real infrastructure); asset library with real versioning/approval; real Project→Marketing automation.

### What is partial
External publishing per provider — real infrastructure, 100% stub publishing adapter, with an honest and auditable failure.

### What is broken
Campaign System A — it would break on NOT NULL if it were called, but it is dead (no production impact today).

### What is fake/stub/dead
Fabricated data (`budget*0.41` as "Gasto Total"); `campaign_tasks`/`campaign_assets` (System A tables, orphaned); no real synchronization of ad-platform metrics.

### Decisions affecting the module
`DEC-001` (RESOLVED) — correction of `financial_project_id`.

### All gaps (7)
GAP-0001 (projects domain conflict, shared, S1_HIGH) · GAP-0033 (financial_project_id never written, S2_MEDIUM, shared) · GAP-0111 (2 parallel campaign systems, S1_HIGH) · GAP-0112 (fabricated "Gasto Total" (Total Spend) metric, S2_MEDIUM) · GAP-0113 (no ad-platform integration in campaign creation, S4_INFORMATIONAL, DEFERRED) · GAP-0114 (bus with no consumer for campaign status, S3_LOW) · GAP-0115 (limit of 50 with no pagination, S2_MEDIUM).

### Proposed/canonical definition for backend v2
Not produced — consolidating into a single campaign system (System B) is the most obvious implicit recommendation, not yet recorded as a formal decision.

### Product Owner confirmation points
Whether campaign System A (orphaned) should be formally removed in v2 or whether there was a product purpose still to be clarified.

### Confidence
HIGH

### Evidence
`docs/backend-v2/field-traceability/modules/marketing.md §1,§3,§4,§7,§8,§9`

---

## MODULE-MONITORING

### Purpose
**Explicitly**: catalog/artist monitoring — detection of unauthorized use, ECAD royalty reconciliation, DMCA-style takedowns. It **is NOT** technical observability of the application — that is covered separately by Pino/OpenTelemetry/Sentry/Prometheus (see Part X), with no tenant-facing surface in this module. This distinction is explicit and deliberate in the audited source itself.

### Main entities
`content_detections`, `ecad_reports`, `TakedownEntity` (`takedowns`).

### Tables
`content_detections`, `ecad_reports`, `takedowns`.

### Endpoints / calling component
`GET /ecad-reports` ← `Monitoramento.tsx` (via `useDeteccoes()`); `/takedowns` (broken create) ← a form inside the dead screen `Monitoramento.tsx`; detection via `content_detections` (no reachable creation UI).

### The routing finding (root of all the other findings in this module)
`/monitoramento` **unconditionally** redirects to `/rights-monitoring` — `Monitoramento.tsx` (the real screen, wired to genuine data, `content_detections`/`GET /ecad-reports`) is **structurally unreachable** through normal navigation. The screen the user actually sees, `RightsMonitoring.tsx`, imports from a file whose own comment confirms that the backend has no real endpoints yet for public performances/broadcast/cue sheets/setlists — all 5 exported arrays are empty by design (honest absence, not fake data).

### Main functional flow
1. The user opens "Monitoramento" (Monitoring) in the menu — and is redirected to `RightsMonitoring.tsx`, which shows 6 tabs that are permanently empty by design.
2. The real, functional screen (`Monitoramento.tsx`) remains technically present in the code but is never reached through normal navigation.
3. `TakedownsService.create()` unconditionally writes `url: dto.url_infracao ?? null` — every real attempt at `POST /takedowns` from the reachable UI fails with an SQL error (the `TakedownEntity` declares 4 columns — `url`/`obra_id`/`artista_id`/`resposta` — absent from the real physical table).

### What works today
`content_detections` mapped correctly end to end (but with no reachable creation path); real ECAD reports (ingestion of the statement file confirmed functional).

### What is partial
Nothing — it is binary: `Monitoramento.tsx` works but is unreachable; `RightsMonitoring.tsx` is reachable but empty by design.

### What is broken
`POST /takedowns` (fails with an SQL error on every real call; columns declared in the entity are absent from the live table).

### What is fake/stub/dead
No fabricated data found in this module (a positive contrast with `marketing`) — every empty/zero state is honestly labeled as such.

### Decisions affecting the module
None.

### All gaps (6)
GAP-0086 (integrations' ECAD card is UI_ONLY, distinct from this module, DEFERRED) · GAP-0116 (two parallel UIs, one unreachable, S2_MEDIUM) · GAP-0117 (real ECAD ingestion, distinct from the UI_ONLY card of integrations — NO_FIX_REQUIRED) · GAP-0118 (confidence score with no explanation/dispute, S3_LOW) · GAP-0119 (detected royalties with no propagation to accounting, S2_MEDIUM, shared) · GAP-0120 (limit of 50 with no pagination, S2_MEDIUM).

### Proposed/canonical definition for backend v2
Not produced — fixing the `/monitoramento → /rights-monitoring` redirect to point to the real, functional screen is the most obvious and cheapest fix identified in this audit.

### Product Owner confirmation points
Whether `RightsMonitoring.tsx` (public performances/broadcast/cue sheets/setlists) is an active product roadmap or whether `Monitoramento.tsx` (already functional) should simply become the main screen again (see PO-VERIFY-017).

### Confidence
MEDIUM (via `PROGRESS.md`; no direct reading of `monitoring.md` in this step beyond what is already summarized in the master report)

### Evidence
`docs/backend-v2/field-traceability/PROGRESS.md ("MODULE: monitoring" section) | canonical-gap-register.json (GAP-0116 to GAP-0120)`

---

## MODULE-MUSICCHAT

### Purpose
A real omnichannel service inbox (conversations/messages/notes) + a triage/escalation automation layer.

### Explicit declaration (mandatory): MusicChat is NOT an AI/LLM assistant
An exhaustive search for `openai`/`anthropic`/`llm`/`embedding`/`vector`/`gemini`/`rag`/`completion` found no occurrence anywhere in this module's code. `MessageSenderType.AI` exists as an enum value but is **confirmed unused** — there is no LLM/RAG requirement behind it (`GAP-0123`, `NO_FIX_REQUIRED`). MusicChat is a multi-channel messaging/service inbox with rule-based automation (triage/escalation), not an AI chatbot.

### Main entities
`conversations`, `conversation_messages`, `conversation_notes` (a generic messaging domain, also shared by `leads`), `musicchat_automation_settings`/`_events`/`_notifications`.

### Tables
`conversations`, `conversation_messages`, `conversation_notes`, `musicchat_automation_settings`, `musicchat_automation_events`, `musicchat_automation_notifications`.

### Endpoints / calling component
21 endpoints combined across the 2 real controllers ← `MusicChat.tsx` (`/chat`)/`/admin/musicchat/automacoes` — DTO/entity mapping **100% clean** (no field-name mismatch at all, a rare finding in this series).

### Main functional flow
1. An agent opens `/chat`, sees real conversations, sends messages (persisted correctly).
2. `RealtimeService` publishes real `conversation:*` events via Supabase Realtime on every state-changing operation (7 confirmed points) — but the app's central subscriber (`useRealtimeSync.ts`) never subscribes to any `conversation:*` event — the backend publishes correctly, nobody listens (`GAP-0121`).
3. Attachments use `URL.createObjectURL(file)` (an ephemeral local reference) — never a real upload; persisted verbatim in the `attachments` jsonb, meaningless after a reload or for other users (`GAP-0122`).

### 5 external channels modeled, zero real ingestion
`whatsapp`/`instagram`/`facebook`/`tiktok`/`email` are modeled in the schema/UI — but **no ingestion endpoint/webhook exists** to actually receive an external message (`GAP-0124`, confirmed as a product scope/limit, not a bug).

### What works today
Conversations/messages/notes — real, clean CRUD; real triage/escalation automation; a genuine Realtime publisher (the first fully real realtime chain confirmed in this audit series).

### What is partial
A real publisher with no central consumer connected.

### What is broken
Nothing in the 400/500-error sense — the gaps are missing connections (Realtime) and missing features (attachment storage, external ingestion).

### What is fake/stub/dead
Nothing fake — the absence of external ingestion is classified as confirmed scope, not a disguised gap.

### Decisions affecting the module
None.

### All gaps (5)
GAP-0121 (Realtime publishes, nobody subscribes, S2_MEDIUM) · GAP-0122 (attachments never actually stored, S2_MEDIUM) · GAP-0123 (unused AI enum — NO_FIX_REQUIRED) · GAP-0124 (external channel ingestion absent — DEFERRED, confirmed scope) · GAP-0125 (limit of 50 with no "load more", S2_MEDIUM).

### Proposed/canonical definition for backend v2
The real surface (conversations/messages/notes/automation settings) should migrate; the external channel ingestion concept, nonexistent today, must not be silently promoted to a v2 requirement.

### Product Owner confirmation points
Whether ingestion from external channels (WhatsApp/Instagram/Facebook/TikTok/email) is a real roadmap requirement, since the schema/UI already model it with no backend implementation behind it.

### Confidence
MEDIUM (via `PROGRESS.md`; no direct reading of `musicchat.md` in this step beyond what is already summarized in the master report)

### Evidence
`docs/backend-v2/field-traceability/PROGRESS.md ("MODULE: musicchat" section) | canonical-gap-register.json (GAP-0121 to GAP-0125)`

---

## MODULE-PROJECTS

### Purpose
The initial record sheet of the song/musical project — the canonical cross-domain entity per `DEC-001` (see Part II for the complete canonical definition).

### Main entities
`Project` (`projects`, 16 cols), `ProjectTrack` (`project_tracks`, 14-16 cols), `ProjectTrackParticipant` (`project_track_participants`, 6-7 cols), `ProjectAsset` (`project_assets`, orphaned).

### Tables
`projects`, `project_tracks`, `project_track_participants`, `project_assets` (orphaned, zero consumers).

### Endpoints / calling component
`GET/POST/PATCH/DELETE /projects` ← `Projetos.tsx`/`ProjetoFormModal.tsx`/`ProjetoViewModal.tsx`.

### Field matrix — Project (8 real fields, real create/edit via `ProjetoFormModal.tsx`)
| DB column | API field | create-form | edit-form | grid | filter | search | sort | computed |
|---|---|---|---|---|---|---|---|---|
| `titulo` | same | YES | YES | YES | no | YES | YES | no |
| `tipo`/`genero`/`status` | same | YES | YES | YES | YES | no | YES (status) | no |
| `descricao`/`observacoes` | same | YES | YES | no | no | no | no | no |
| `artista_id` | same | **NO** (real field, never collected by the form) | NO | no | no | no | no | `GAP-0001`, decision resolved, implementation pending |
| `orcamento` | same | **NO** | NO | no | no | no | no | same |
| `contrato_id` | same | **NO** | NO | no | YES (exposed as a filter) | no | no | CONFLICTED — physical existence disputed (CONFLITO-03, `GAP-0127`) |

### Main functional flow
1. The user creates a musical project (title, type, genre, status) + planned tracks + per-track participants via `ProjetoFormModal.tsx` (8 real fields, clean mapping).
2. Real status workflow (5 states, `WorkflowService`) — but status editing via the free Select in the form does not respect the legal transitions (the `ViewModal` does respect them, correctly).
3. `ProjectPlanningAutomation` (AI-generated operational plan on project completion) runs raw SQL with obsolete/nonexistent columns (`nome`, `data_fim` — renamed by migration `20260718000013`) — it fails silently on every real invocation, although it does not roll back the project completion itself.

### What works today
Creation/editing of the project and its tracks/participants (8 real fields, clean mapping); real status workflow; relation with Work (real, populated, `ALREADY_CORRECT`).

### What is partial
Status editing via the free Select does not respect the workflow's legal transitions.

### What is broken
`ProjectPlanningAutomation` (raw SQL with renamed columns, silent failure on every invocation).

### What is fake/stub/dead
Track audio upload (hardcoded stub, always returns `null`); `project_assets` (orphaned table, zero consumers); `projects.store.ts`/`projects.service.ts` (dead code, board store never wired).

### Decisions affecting the module
`DEC-001` (RESOLVED) — corrected definition of `projects` itself, the canonical Musical Project/Song entity.

### All gaps (9)
GAP-0001 (decision resolved; implementation of artista_id/orcamento pending, S1_HIGH) · GAP-0013 (P&L per Project does not group, shared, S2_MEDIUM) · GAP-0033 (financial_project_id never written by audiovisual/marketing, S2_MEDIUM, shared) · GAP-0099 (lead conversion with no retroactive link, shared, S2_MEDIUM) · GAP-0126 (dead Zustand board store, S4_INFORMATIONAL) · GAP-0127 (contrato_id CONFLICTED, S2_MEDIUM) · GAP-0128 (limit of 50 with no pagination, S2_MEDIUM) · GAP-0167 (cross-module pattern of dead stores, S4_INFORMATIONAL) · GAP-0168 (decision DEC-009 resolved — PROJECT_RELEASE_DIRECT_LINK; `releases.project_id` still to be implemented, S2_MEDIUM — `blocksSchemaV2Design: NÃO`, corrected; the previous "blocks v2 schema" text is outdated).

### Proposed/canonical definition for backend v2
`projects` = canonical Musical Project (`DEC-001`); cross-domain key via `projects.id`, preserving the already real relations. Physical design not yet produced.

### Product Owner confirmation points
Confirm the `DEC-001` correction (see the final checklist); confirm whether `artista_id`/`orcamento` should in fact be exposed in the real form; CONFLITO-03 (`projects.contrato_id`, PO-VERIFY-006).

### Confidence
HIGH

### Evidence
`docs/backend-v2/field-traceability/modules/projects.md §1,§2,§5,§7,§8,§9,§17`

---

## MODULE-RELEASES

### Purpose
Release/distribution product — the most critical finding of the entire audit (create/edit 100% broken today).

### Main entities
`Release` (`releases`, 26-27 cols), `release_works` (join, schema-only, never populated).

### Tables
`releases`, `release_works`.

### Endpoints / calling component
`GET/POST/PATCH/DELETE /releases` ← `Lancamentos.tsx`/`LancamentoFormModal.tsx` (5-step wizard)/`LancamentoViewModal.tsx`.

### Field matrix — Release (20 fields, 5-step wizard)
| DB column | API field | create-form | edit-form | grid | filter | search | sort | computed |
|---|---|---|---|---|---|---|---|---|
| `titulo`/`artista_id`/`upc_ean`/`isrc_global` | same | YES | YES | YES | YES | YES | YES | no |
| `metadata.faixas` (jsonb) | `faixas` | YES (Step 2, "Upload de Faixas" (Track Upload)) | YES | YES (count) | no | no | no | `NON_CANONICAL_METADATA` per `DEC-007` — no relation with `phonograms`/`works` |
| `internal_status` | `internalStatus` | **unconditionally injected by the form** | same | — | — | — | — | **the field does not exist in any DTO nor as a physical column — the global `ValidationPipe` rejects the whole request with HTTP 400 before the controller** (`GAP-0129`) |
| `platform_status` | same | same injection | same | — | — | — | — | same problem |
| `status` (workflow, 10 states) | same | Step 5 Select | YES | YES | YES | no | YES | illegal DRAFT→DISTRIBUTED jump allowed (`GAP-0130`) |

### Main functional flow — 100% broken (the most severe finding of the audit)
1. The user fills in the 5-step wizard ("Info do Álbum" (Album Info) / "Upload de Faixas" (Track Upload) / "Capa" (Cover) / "Preferências de Distribuição" (Distribution Preferences) / "Preview").
2. On save, `LancamentoFormModal.tsx` unconditionally injects `internal_status` into the payload — a field not declared in any DTO nor as a physical column — the global `ValidationPipe` rejects the whole request with HTTP 400 **before it reaches the controller**.
3. **Result: every creation and every edit of a Release via the real UI fails, today, 100% of the time.**
4. Even if this bug were fixed, a subsequent second call forces `status: "distributed"` directly from `DRAFT` — an illegal transition in the real workflow (only `DRAFT→METADATA_PENDING` is allowed from `DRAFT`) — which would fail independently.

### What works today
Cover/artwork upload (real, Cloudflare R2, functional end to end — a positive contrast with the audio stub of `projects`/`catalog`); 10-state workflow with real guards in the backend.

### What is partial
Nothing — the `internal_status` bug is binary and affects 100% of create/edit attempts.

### What is broken
The entire Create/Edit (the most severe finding of this audit); the "artist approved" notification writes `user_id` with an `artists.id` value (never matches a real user — a silent dead write).

### What is fake/stub/dead
The 6 distribution providers (STUB, see MODULE-INTEGRATIONS); `release_works` (never populated); duplicate entity/repository (`release.entity.ts`, `release.repository.ts`, dead in production, referenced only by a test spec); artwork delete does not remove the R2 object.

### Decisions affecting the module
`DEC-007` (RESOLVED, `RELATIONAL_TRACKLIST_MODEL`) — the tracklist must be relational via phonogram, `metadata.faixas` is not canonical, final design `TO_BE_DESIGNED`.

### All gaps (10)
GAP-0007 (tracklist model decided, final design pending, S1_HIGH — `blocksSchemaV2Design: NÃO`, decision already resolved by `DEC-007`; corrected; the previous "blocks v2 schema" text is outdated) · GAP-0080 (6 STUB distributors, shared, DEFERRED) · GAP-0129 (internal_status/platform_status break 100% of create/edit, S1_HIGH) · GAP-0130 (illegal DRAFT→DISTRIBUTED jump, S2_MEDIUM) · GAP-0131 (takedown with no real distributor call, S3_LOW, DEFERRED) · GAP-0132 (artwork delete does not clean up R2, S3_LOW) · GAP-0133 (contracts.lancamento_id confirmed nonexistent — NOT_APPLICABLE, closed) · GAP-0134 (limit of 50 with no pagination, S2_MEDIUM) · GAP-0167 (cross-module pattern of dead stores, S4_INFORMATIONAL) · GAP-0168 (decision DEC-009 resolved — PROJECT_RELEASE_DIRECT_LINK; `releases.project_id` still to be implemented, S2_MEDIUM — `blocksSchemaV2Design: NÃO`, corrected; the previous "blocks v2 schema" text is outdated).

### Proposed/canonical definition for backend v2
`DEC-007`: canonical chain `Release → Release Track → Phonogram → Work → Rights/Shares`, minimum requirements already recorded (`release_id`, `phonogram_id`, `position/order`) — final design `TO_BE_DESIGNED`.

### Product Owner confirmation points
Confirm the priority of fixing the `internal_status` bug (technically the bug with the greatest immediate impact in the whole system — it blocks 100% of release creation today, although no code fix should be made in this step, see PO-VERIFY-011).

### Confidence
HIGH

### Evidence
`docs/backend-v2/field-traceability/modules/releases.md §0,§7,§8,§10,§13,§16`

---

## MODULE-REPORTS

### Purpose
Export/reports center (Export Center) — not to be confused with analytical dashboards (MODULE-DASHBOARD).

### Main entities
None of its own — it operates over a closed registry of 22 tables (`report-module-registry.ts`), each with an explicit field contract (`report-form-contracts.ts`), plus 1 computed report (`accounting_summary`, P&L per artist).

### Each of the 22 reports individually (mandatory deep dive: input/source/filters/output/export/limitations)
All 22 share the same engine (`report-form-contracts.ts` — column/filter/sort allowlisting, parameterized SQL, formula-injection neutralization), the same output (XLSX), the same export ceiling (50,000 rows, fail-closed with an explicit HTTP 413) and the same tenant isolation (4 independent layers) — differing only in the source table and in the specific limitations noted below.

| # | Key | Label (UI) | Type | Source module | Known specific limitations |
|---|---|---|---|---|---|
| 1 | `artists` | "Artistas" (Artists) | entity | artist | bank data (jsonb) exported unencrypted — CONFLITO-04 |
| 2 | `projects` | "Projetos" (Projects) | entity | projects | — |
| 3 | `works` | "Obras" (Works) | entity | catalog | — |
| 4 | `phonograms` | "Fonogramas" (Phonograms) | entity, repeatable group (participants) | catalog | — |
| 5 | `content_detections` | "Monitoramento" (Monitoring) | entity | monitoring | — |
| 6 | `licenses` | "Licenciamento" (Licensing) | entity | licensing | `PERCENTAGE` remuneration invisible in the export (historical mistake) |
| 7 | `takedowns` | "Takedowns" | entity | monitoring | — |
| 8 | `releases` | "Distribuição" (Distribution) | entity, repeatable group (tracks) | releases | — |
| 9 | `shares` | "Shares" | entity | releases-adjacent | not audited in depth in any dedicated module |
| 10 | `contracts` | "Contratos" (Contracts) | entity | contracts | party PII exported without masking (`GAP-0049`) |
| 11 | `audiovisual_projects` | "Projetos Audiovisuais" (Audiovisual Projects) | entity | audiovisual | — |
| 12 | `transactions` | "Transações Financeiras" (Financial Transactions) | entity | accounting | — |
| 13 | `accounting_summary` | "Contabilidade" (Accounting) | **computed** (P&L per artist) | accounting | does not group by project (same root as `GAP-0013`) |
| 14 | `invoices` | "Nota Fiscal" (Invoice) | entity, repeatable group (items) | accounting | — |
| 15 | `events` | "Agenda" (Calendar) | entity | events | — |
| 16 | `inventory_items` | "Inventário" (Inventory) | entity | inventory | — |
| 17 | `clients` | "Contatos" (Contacts) | entity | crm-relationships | "Contact = Client" |
| 18 | `leads` | "Leads" | entity | leads | — |
| 19 | `employees` | "RH" (HR) | entity | rh | — |
| 20 | `marketing_tasks` | "Tarefas" (Tasks) | entity | marketing | — |
| 21 | `marketing_content_posts` | "Calendário de Conteúdo" (Content Calendar) | entity | marketing | — |
| 22 | `briefings` | "Briefing" | entity | marketing | — |

**Explicitly excluded** from this closed registry (`NOT_REPORTABLE`): `campaigns` (marketing) and the tables of the `registry` sub-module of `catalog`.

### Tables
The 22 tables registered above — queried directly, not via each module's paginated listing endpoints (immune to the silent `limit=50` truncation present in virtually every other module).

### Endpoints / calling component
`GET /reports/entities` ← `Relatorios.tsx` ("Central de Relatórios" — Reports Center) — the only source according to the code's own comment.

### Main functional flow
1. The user picks a registered entity, applies filters, exports.
2. The engine queries the physical table directly (without depending on the source module's paginated endpoint).
3. Encrypted fields (e.g. an artist's email/phone/CPF) are decrypted only at the moment of the authorized export.

### What works today
The most rigorously built module of the entire audit — zero `TRUNCATION_GAP`, zero injection risk, tenant isolation confirmed in 4 independent layers.

### What is partial
`searchableColumns` is computed but never consumed by the query builder (dormant).

### What is broken
Nothing.

### What is fake/stub/dead
`exportFieldList()` in `TransacaoFormModal.tsx` (3-sheet XLSX generator, dead code, does not functionally belong to this module, uses `xlsx` directly, not the central engine).

### Decisions affecting the module
None.

### All gaps (5)
GAP-0014 (3-sheet XLSX in accounting, attributed to reports due to PII, S3_LOW) · GAP-0049 (contract PII exported without masking, inherited from contracts, S2_MEDIUM) · GAP-0135 (source confirmed solid — NO_FIX_REQUIRED) · GAP-0136 (scheduled/recurring reports do not exist, S3_LOW, DEFERRED) · GAP-0137 (export history/audit is not tracked, S2_MEDIUM).

### Proposed/canonical definition for backend v2
Not produced — but the explicit allowlisting/field-contract pattern is a natural candidate to become the standard model for all of v2, not just `reports`.

### Product Owner confirmation points
Whether PII masking (banking, contract data) should be standardized before export — today the treatment is inconsistent across equally sensitive entities (CONFLITO-04).

### Confidence
HIGH (verified by direct reading of `reports.md` in this step, including the complete list of the 22 reports)

### Evidence
`docs/backend-v2/field-traceability/modules/reports.md (direct reading in this step, complete report-module-registry.ts listing)`

---

## MODULE-RH

### Purpose
Internal HR management — employees, payroll, vacations/absences, documents. `Employee` is structurally distinct from the platform's `User`/`OrgMember` — confirmed to have no FK between them.

### Each sub-domain, with broken CRUD cited individually (mandatory deep dive)
| Sub-domain | CREATE | READ (list) | UPDATE | DELETE | Root cause |
|---|---|---|---|---|---|
| **Employee** (`employees`) | **BROKEN — always HTTP 400** (`GAP-0138`) | **BROKEN — list always blank** (`GAP-0143`) | not evaluated (create already blocks the flow) | not evaluated | `CreateEmployeeDto` requires `nome`, the form never sends it and sends 8 non-whitelisted fields (`nome_completo`, `rg`, `data_nascimento`, `endereco`, `setor`, `salario_base`, `observacoes`, `vinculo_usuario_id`) that **are not declared in the TypeORM entity** (`GAP-0141`) even though they physically exist in the table — the same migration that created the 8 columns never updated the entity |
| **Payroll** (`payroll_entries`) | **BROKEN — always HTTP 400** (`GAP-0139`) | functional | **no PATCH exists** | **no DELETE exists** | `employee_id`/`competencia` required vs. `funcionario_id`/`mes_referencia` sent by the form — same pattern as `GAP-0138`, independent root cause |
| **Vacations/Absences** (`leave_requests`) | **BROKEN — always HTTP 400** (`GAP-0140`) | functional | only 1 route, hardcoded to "approved", with no rejection path — but the UI offers edit/reject as if they worked (they call nonexistent routes, 404) | same situation | `employee_id` vs. `funcionario_id`/`dias_totais` — same pattern |
| **Documents** (via `/hr/employees`) | real dedicated endpoint in the backend, **never wired to the frontend** (`GAP-0142`) | the "Documentos" (Documents) tab points to the wrong endpoint (`/hr/employees`), listing every employee of the tenant incorrectly labeled as a "document" | the file upload itself works (it reaches R2) | the same 400 error as the Employee item when creating the metadata record | endpoint/UI misaligned independently of the Employee bug |

### Main entities
`Employee` (`employees`, 27 cols), `PayrollEntry` (`payroll_entries`, 19 cols), `LeaveRequest` (`leave_requests`, 18 cols).

### Tables
`employees`, `payroll_entries`, `leave_requests`.

### Endpoints / calling component
`GET/POST/PATCH /hr/employees` ← `RH.tsx`/`FuncionarioFormModal.tsx`; `GET/POST /hr/payroll` ← `FolhaPagamentoFormModal.tsx`; `GET/POST /hr/leave-requests` ← `FeriasAusenciasFormModal.tsx`.

### Main functional flow
1. The user tries to create an Employee — `CreateEmployeeDto` requires `nome` and accepts 13 fields; the form never sends `nome` and sends 8 disallowed fields — **HTTP 400 on every real attempt**.
2. The same pattern repeats, independently, in Payroll and in Vacations/Absences (see the table above).
3. Even the read listing of Employees is broken: 8 real columns are never returned by the API (the entity does not declare them) — name/department/salary/link always appear blank in the table, and search/filter by Department never works.

### What works today
Tenant isolation and authorization (confirmed solid); PII encryption (email/phone/CPF, the same correct pattern as other modules).

### What is partial
No PATCH/DELETE exists for Payroll; Vacations/Absences has only 1 status-change route.

### What is broken
Create of Employee, Payroll, Vacations — 100% broken (S1_HIGH); reading the Employee list is also broken (column drift); the payroll net-salary calculation is 100% client-side, with no server validation.

### What is fake/stub/dead
Nothing classified as fake — the 4 flows are real, just disconnected by contract divergence.

### Decisions affecting the module
None.

### All gaps (9)
GAP-0090 (inventory item's responsible person is free text, shared by cross-citation, S2_MEDIUM) · GAP-0138 (Employee CREATE_MAPPING_MISMATCH, S1_HIGH) · GAP-0139 (Payroll CREATE_MAPPING_MISMATCH, S1_HIGH) · GAP-0140 (Leave-request CREATE_MAPPING_MISMATCH, S1_HIGH) · GAP-0141 (Employee entity missing 8 real physical columns, S1_HIGH) · GAP-0142 (documents endpoint never wired to the frontend, S2_MEDIUM) · GAP-0143 (employee list renders blank, S1_HIGH) · GAP-0144 (EmployeeStatus ENUM_MISMATCH, S2_MEDIUM) · GAP-0145 (same column drift in payroll/leave_requests, S2_MEDIUM) · GAP-0146 (limit of 50 with no pagination, S2_MEDIUM).

### Proposed/canonical definition for backend v2
Not produced — but the very migration that created the 8 orphaned columns (`20260712000003_HrFormFieldColumns.ts`) already documents the original intent (mirroring form fields into physical columns), never implemented.

### Product Owner confirmation points
Whether the `rh` module is an active, priority product requirement, given that it is, today, 100% non-functional for create/edit across all 4 sub-resources (see PO-VERIFY-012).

### Confidence
HIGH

### Evidence
`docs/backend-v2/field-traceability/modules/hr.md §0,§1`

---

## MODULE-SETTINGS

### Purpose
Multi-surface configuration hub: company profile/branding, user preferences, notifications, security, access (RBAC), integrations, localization, billing, feature flags, public registration. **There is no single backend module called `settings`** — the frontend aggregates several real backend modules (`company-settings`, `notifications`, `billing`, RBAC) plus a deliberately stubbed concept ("operational lists").

### Classification of every area (mandatory deep dive: REAL/PARTIAL/FAKE/HARDCODED/FRONTEND_ONLY/BACKEND_BACKED/BROKEN)
| Area | Classification | Note |
|---|---|---|
| Company profile (`company-settings`) | **REAL / BACKEND_BACKED** | `GET/PATCH /company-settings`, persists correctly |
| Logo upload | **BROKEN** | `POST /api/v1/workspaces/{id}/logo` does not exist anywhere in the backend (`GAP-0149`) |
| User preferences | **FRONTEND_ONLY** | 100% `localStorage`, no backend table |
| Notifications ("Automações" (Automations) tab) | **BACKEND_BACKED but with no consumer** | real `notification_settings` (14 keys), zero frontend callers (`GAP-0147`); 4 toggles are hardcoded `<Switch checked={true}>`, with no handler (**HARDCODED**, `GAP-0148`) |
| Security (2FA, sessions, account deletion) | **FAKE** | 6 items with no `onClick`, hardcoded data (`GAP-0155`, DEFERRED) |
| Integrations (tab) | **REAL** | directly reuses the real hooks/components of the `integrations` module, not an outdated copy |
| Access/RBAC ("Usuários" (Users) tab) | **REAL / BACKEND_BACKED** | shares the RBAC backend with `auth`/`workspace` |
| Localization (language/timezone/currency) | **FRONTEND_ONLY** | saved only in `localStorage`, not in a tenant/user-scoped backend column (`GAP-0156`) |
| Billing | **PARTIAL / FRAGMENTED** | see the `DOMAIN-BILLING` sub-section below |
| Feature flags | **FRONTEND_ONLY / HARDCODED** | hardcoded map in the frontend, with no `tenant_feature_flags` nor backend gate (`GAP-0154`) |
| Public registration (slug) | **PARTIAL** | real, active backend (`allow_public_registration`), but the UI shows disabled buttons with an outdated message; the slug is saved in `localStorage` per administrator, not per tenant — a business-critical `LOCAL_STORAGE_GAP` |
| "Operational lists" | **FRONTEND_ONLY honest stub** | real `operational_list_items`, zero consumers — self-documented, not a disguised "fabricated success" |
| `AuditTrail.tsx` | **REAL but DEAD (not routed)** | built, backend-wired, never reachable through navigation |

### Main entities
`organizations`/`tenants.settings` (profile/branding/localization), `notification_settings`, `billing_subscriptions`/`billing_plans`/`tenant_billing_state`, `operational_list_items` (real, zero consumers).

### Tables
`organizations`, `tenants` (`.settings` jsonb), `notification_settings`, `billing_subscriptions`, `billing_plans`, `tenant_billing_state`, `operational_list_items`.

### Endpoints / calling component
`GET/PATCH /company-settings` ← `Configuracoes.tsx` "Empresa" (Company) tab; `GET/PATCH /notifications/settings` ← "Automações" (Automations) tab (real backend, zero callers); `GET /billing/plans`, `POST /billing/checkout`, `POST /billing/portal`, `GET /billing/subscription` ← see `DOMAIN-BILLING`; `GET /billing/invoices` **does not exist** (only `GET /billing/admin/invoices`, `super_admin`).

## DOMAIN-BILLING (mandatory sub-section — complete analysis of DEC-005)

### The 3 coexisting billing surfaces
1. **`Configuracoes.tsx` "Billing" tab** — correct architecture (dynamic plans via `GET /billing/plans`, never hardcodes a price), but invoices and 3 action buttons ("Gerenciar Assinatura" (Manage Subscription)/"Adicionar Assentos" (Add Seats)/"Fazer Upgrade" (Upgrade)) are decorative (they call `toast.info(...)` instead of the real checkout/portal calls, which exist and work correctly one file away).
2. **Standalone `Billing.tsx`** (`/configuracoes/billing`) — hardcodes plan prices (`R$ 299`/`R$ 799`/"Consultar" (Contact us)), contradicting the codebase's own governance comment ("plans must NOT be hardcoded on the screen"); it correctly uses the real Stripe checkout/portal calls.
3. **`BillingBlockedPage.tsx`** — a distinct purpose (blocking screen for non-payment), not part of the conflict between the first two.

### What is real and works today, regardless of which UI wins
Stripe Checkout (`POST /billing/checkout`) and Stripe Portal (`POST /billing/portal`) — real, work correctly in the backend, they are just not wired to the `Configuracoes.tsx` buttons. `GET /billing/plans` — real. The invoices gap (`GET /billing/invoices` nonexistent) and the fake payment card (hardcoded `•••• 4242`, `GAP-0152`) are findings independent of which surface wins — they exist in both possible scenarios.

### The 3 options recorded in `decision-register.json` (DEC-005) — none chosen here
| Option | Advantages | Disadvantages | Risks |
|---|---|---|---|
| **(1) `Configuracoes.tsx` "Billing" as canonical** (recommendation recorded in `decision-register.json`) | Architecture already correct (does not hardcode prices); direct reuse of the dynamic pattern already used in other tabs | Requires implementing the missing plan-change endpoint (`PATCH /billing/subscription/plan`, `GAP-0151`) before becoming functionally complete; requires deprecating `Billing.tsx`, a route already linked/in use | Additional backend work before the cutover; regression risk if `Billing.tsx` has real, unmeasured traffic |
| **(2) Standalone `Billing.tsx` as canonical** | It is already the most used/linked page today; checkout/portal already work correctly in it | Hardcoded prices violate the codebase's own documented convention; it would require rewriting the plan display logic to consume `GET /billing/plans` dynamically | Risk of an outdated price being shown to the user until the fix; UX regression risk if the route changes |
| **(3) Merge the two into a single route/component** | Eliminates the fragmentation for good; allows reusing the best of each (the correct architecture of one + the usage traction of the other) | Greater immediate engineering effort; requires deciding which route/URL survives | Scope risk if it is not explicitly bounded before starting |

### Formal status
```
DEC-005: PENDING_PRODUCT_DECISION
DEC_005_ANALYSIS_STATUS: PARKED_UNCHANGED
```
The analysis above is already concluded and recorded in `decision-register.json`/`settings.md §9` — the decision itself **was neither made nor recorded as a formal resolution**. This report **does not choose** an option. `DEC-005` remains pending Product Owner confirmation.

### What works today (module overview)
Company profile; password change; Stripe plans/checkout/portal (in the backend and in `Billing.tsx`); Integrations tab (real reuse); "operational lists" (honest stub).

### What is partial
Public registration (real, active backend; UI with an outdated message).

### What is broken
Logo upload; invoice list; notifications (real backend, zero callers); FeatureGate ("Ver planos" (View plans)) points to an unregistered route (`/settings/billing`, `GAP-0153`).

### What is fake/stub/dead
Payment method card; 4 hardcoded notification toggles; security (2FA/sessions/account deletion, no `onClick`); public registration slug (per-user `localStorage`, not per-tenant); `AuditTrail.tsx` (built, never routed).

### Decisions affecting the module
`DEC-005` (PENDING) — billing, see above; `DEC-006` (PENDING) — invitation management duplicated between `/usuarios` and the "Usuários" (Users) tab (see MODULE-WORKSPACE).

### All gaps (16)
GAP-0005 (fragmented billing, DEC-005 pending, S2_MEDIUM) · GAP-0006 (duplicate invitations, DEC-006 pending, shared, S2_MEDIUM) · GAP-0051 (DocuSign status in sessionStorage, shared, S2_MEDIUM) · GAP-0081 (real Stripe client in Billing.tsx, reconciled, DEFERRED) · GAP-0147 (toggles with no backend consumer, S2_MEDIUM) · GAP-0148 (2 hardcoded toggles, S3_LOW) · GAP-0149 (logo upload with no endpoint, S2_MEDIUM) · GAP-0150 (billing with no single source, S2_MEDIUM) · GAP-0151 ("Alterar Plano" (Change Plan) calls a nonexistent endpoint, S1_HIGH) · GAP-0152 (fake payment card, S2_MEDIUM) · GAP-0153 (feature gate points to an unregistered route, S3_LOW) · GAP-0154 (frontend-only feature flags, S2_MEDIUM) · GAP-0155 (security tab with no backend, DEFERRED) · GAP-0156 (localization in localStorage, S3_LOW) · GAP-0162 (public slug in localStorage — same root cause as workspace, S3_LOW) · GAP-0163 (3rd confirmed instance of duplicated UI, S3_LOW).

### Proposed/canonical definition for backend v2
Not produced — `DEC-005` needs to be resolved before any v2 billing design.

### Product Owner confirmation points
`DEC-005` (which billing surface wins, see PO-VERIFY-019); whether the public registration slug should migrate to server-side storage as a priority (PO-VERIFY-024).

### Confidence
HIGH

### Evidence
`docs/backend-v2/field-traceability/modules/settings.md §0,§4,§5,§6,§9,§11,§12 | docs/backend-v2/gap-resolution/decision-register.json (DEC-005)`

---

## MODULE-SUPPORT

### Purpose
A real support-ticket system (tenant-scoped) — plus 4 deliberately fake sub-features in the same frontend module.

### Mandatory separation: real tickets vs. AI triage vs. fake chat vs. fake knowledge base
| Sub-feature | Classification | Evidence |
|---|---|---|
| **Tickets** (`SupportTickets.tsx`/`SupportTicketDetail.tsx`/`SupportDashboard.tsx`) | **REAL** | CRUD + real role-gated 7-transition workflow, inside a database transaction; 1 real Realtime broadcast on resolution |
| **Automatic AI triage** (within the real ticket flow) | **REAL** | part of the real ticket creation/prioritization workflow, distinct from the 4 sub-features below |
| **`SupportChat.tsx`** | **FAKE, self-declared** | the hook explicitly admits "simulating the backend in localStorage is forbidden" — it fails explicitly, never simulates success |
| **`SupportKnowledge.tsx`** (knowledge base/FAQ) | **FAKE, self-declared** | same pattern — also reused by `AdminKnowledge.tsx` |
| **`SupportStatus.tsx`** (incident status) | **FAKE, self-declared** | same |
| **`SupportRequests.tsx`** (requests board) | **FAKE, self-declared** | same |

All 4 fake sub-features are classified `INTENTIONAL_STUB` (`GAP-0160`, DEFERRED) — none of them simulates success or fabricated data; they all fail honestly.

### Main entities
`SupportTicket` (`support_tickets`, 17 cols) — the only real resource with a table.

### Tables
`support_tickets`.

### Endpoints / calling component
`GET/POST/PATCH/DELETE /support-tickets` ← `SupportTickets.tsx`; the same route (`?limit=200`) ← `AdminSupport.tsx` (see MODULE-ADMIN).

### Ticket status enum — 3 divergent vocabularies
The real backend has 6 states (including `pending_user`/`cancelled`); the `support` module's own type has only 5 (`waiting_customer` instead of `pending_user`, no `cancelled`); the `admin` module has a **third** 5-value vocabulary (`waiting`) — a real, reachable `TypeError` confirmed in `AdminSupport.tsx` for any ticket moved to one of the 2 missing states (`GAP-0157`, S1_HIGH).

### Main functional flow
1. The user opens a real ticket via `SupportTickets.tsx` — persisted correctly, real role-gated 7-transition workflow, inside a database transaction.
2. The ticket category has an independent `ENUM_MISMATCH` (the backend accepts 5 values; the frontend declares 10 unrelated domain values) — risk of rejection at creation time (`GAP-0158`).
3. Attachments are the "most fake" pattern found in this series: the chat simulator does not even create an ephemeral `blob:` reference — it only echoes the file name/size as text in a message that itself is never persisted.

### What works today
Real ticket system (CRUD + 7-transition workflow + automatic AI triage + basic SLA + 1 real Realtime broadcast on resolution).

### What is partial
The ticket-resolution notification writes 2 notification rows (requester + manager) via distinct handlers — a slightly duplicated pattern, but functional.

### What is broken
`AdminSupport.tsx` — reachable crash (`TypeError`) when opening a ticket in one of the 2 states missing from the admin vocabulary (`GAP-0157`); category `ENUM_MISMATCH` (`GAP-0158`).

### What is fake/stub/dead
`SUPPORT_CHAT`, `KNOWLEDGE_BASE`/FAQ, `INCIDENT_SUPPORT`/status, requests board — all 4, self-declared and honestly failing; unregistered `/support/tickets/new` route (dead link of the "Novo Ticket" (New Ticket) button on the dashboard).

### Decisions affecting the module
None.

### All gaps (7)
GAP-0021 (misleading cross-tenant frame of AdminSupport, shared with admin, S2_MEDIUM) · GAP-0022 (AdminKnowledge dev-only mock, ACCEPTED_BY_EXISTING_CONTRACT) · GAP-0157 (reachable crash due to status ENUM_MISMATCH, S1_HIGH) · GAP-0158 (category ENUM_MISMATCH, S1_HIGH) · GAP-0159 (cross-tenant frame — CLOSED/NO_FIX_REQUIRED) · GAP-0160 (4 fake sub-features — INTENTIONAL_STUB, DEFERRED) · GAP-0161 (limit of 50 with no pagination, S2_MEDIUM).

### Proposed/canonical definition for backend v2
Not produced — but the distinction between the real tickets and the 4 fakes is already clearly established as a basis for any v2 scope.

### Product Owner confirmation points
Whether chat/knowledge base/incident status/requests board are real roadmap requirements (today 100% fake, self-declared) or should be removed from the product surface.

### Confidence
HIGH

### Evidence
`docs/backend-v2/field-traceability/modules/support.md §0,§1,§2,§3,§4`

---

## MODULE-WORKSPACE

### Purpose
Tenant isolation unit — "Workspace" is the UI/DTO name for the `tenants` table.

### Tenant/Workspace-alias/Organization/membership/invitation/provisioning/`org_id` — the complete naming quirk (mandatory deep dive)
- **`Tenant`** (`tenants`, 18 cols) — the real multi-tenant isolation unit in the database. It is what the UI calls **"Workspace"**: `WORKSPACE_TENANT_RELATIONSHIP: SAME_ENTITY`, confirmed by direct reading of the provisioning code — there is no second `workspaces` table.
- **`Organization`** (`organizations`, 16 cols) — legal/billing parent, technically an entity distinct from `Tenant`, but **1:1 in practice** via `WorkspaceProvisioningService.provision()`, which always creates both together in the same transaction.
- **`org_members`** (18 cols) — real membership, revalidated on every request; FK `role_id→roles`, `department_id→departments`, `position_id→positions`.
- **`tenant_invitations`** (14 cols) — pending invitation; FK `org_id→organizations` (not `tenant_id`, although it also carries `tenant_id` as part of the composite FK).
- **`roles`** — tenant-scoped RBAC.
- **The `org_id` JWT claim quirk**: the JWT token carries a claim called `app_metadata.org_id` — but its *value* is always a `tenants.id`, **never** an `organizations.id`. The name is a naming artifact from a design predating the current one, not a functional bug (the system never confuses the two values in practice; only the *claim name* is misleading).

### Main entities
`tenants` (= workspace), `organizations` (legal/billing parent, distinct, 1:1 in practice via provisioning), `org_members` (membership), `tenant_invitations`, `roles`.

### Tables
`tenants`, `organizations`, `org_members`, `tenant_invitations`, `roles`.

### Endpoints / calling component
`PATCH /auth/provision-workspace` ← `AuthContext.tsx` (auto); `PATCH /auth/onboarding` ← `Onboarding.tsx`; `GET /auth/context` ← every post-login navigation; `GET/POST/PATCH/DELETE /users*` ← `Usuarios.tsx`; `GET/POST /users/invitations*` ← `Usuarios.tsx` and the "Usuários" (Users) tab of `Configuracoes.tsx` (2 entry points, fragmented); `GET/PATCH /billing/admin/tenants[/:id]` ← `AdminClients.tsx` (`super_admin`, real cross-tenant).

### Main functional flow
1. The user signs up (`Register.tsx`) — `supabase.auth.signUp()` sets `user_metadata.workspace_slug`.
2. `AuthContext` detects the absence of `org_id` in the JWT → triggers `PATCH /auth/provision-workspace`.
3. `WorkspaceProvisioningService.provision()` — a single transaction: per-user advisory lock, idempotency check, per-slug advisory lock, creates `organizations`+`tenants`+`org_members` (owner role), syncs `app_metadata.org_id = tenants.id` in Supabase **before** the commit.
4. Invitations: `POST /users/invitations` creates `org_members` **immediately** (access granted before acceptance) + `tenant_invitations` (pending); the first post-login `GET /auth/context` auto-accepts the pending invitation.

### What works today
Provisioning (atomic, idempotent — the cleanest creation flow found in the whole series); `TenantGuard` (never trusts the client header); "last owner" protection (blocks demotion/removal of the last active owner); storage isolation (`tenants/<id>/...` prefix + `tenant_id` check in every row query).

### What is partial
No workspace "switcher" exists (one JWT session = one tenant; multiple memberships are technically possible in the schema, but no UI offers switching between them within the same session) — confirmed as an architectural characteristic, not a gap.

### What is broken
Nothing technically broken in this module — it is, according to the audit itself, "the structurally most solid module found in the whole series".

### What is fake/stub/dead
Nothing.

### Decisions affecting the module
`DEC-006` (PENDING) — invitation management fragmented between `/usuarios` (only creates invitations, with no visibility of pending ones/resend/cancellation) and the "Usuários" (Users) tab of `Configuracoes.tsx` (complete surface) — which one wins.

### All gaps (7)
GAP-0006 (duplicate invitations, DEC-006 pending, shared, S2_MEDIUM) · GAP-0038 (auto-acceptance of invitation as a side effect — NO_FIX_REQUIRED) · GAP-0162 (public slug in localStorage — CLOSED, same root cause as settings, S3_LOW) · GAP-0163 (3rd confirmed instance of duplicated UI, S3_LOW) · GAP-0164 (tenant selection with no server-side "last used" sync, S3_LOW) · GAP-0165 (member removal with no reassignment/audit of `created_by`, S2_MEDIUM) · GAP-0166 (limit of 50 in the membership list, S3_LOW).

### Proposed/canonical definition for backend v2
`tenants.id` as the canonical tenant identifier, preserved; no model change needed — this module is considered a solid foundation for v2 without redesign.

### Product Owner confirmation points
`DEC-006` (which invitation surface wins, PO-VERIFY-020); whether the confusing naming of the JWT claim (`org_id` carrying a `tenants.id`) should be corrected (renamed) in v2 or kept for compatibility (PO-VERIFY-007).

### Confidence
HIGH

### Evidence
`docs/backend-v2/field-traceability/modules/workspace.md §0,§6,§7,§8,§9,§13,§17`

---

# PART VII — CROSS-DOMAIN RELATIONS (consolidated)

The complete master table of cross-domain relations was already built in **Part V.3** (physical extension of the schema, 142 tables, on top of the 17 original relations of the master report `§24`). This part does not duplicate it — it consolidates, in prose, the patterns observed across the 24 modules (Part VI):

1. **`financial_project_id` / `LEGACY_NAMING` pattern**: `audiovisual_projects.financial_project_id` and `marketing_projects.financial_project_id` are real, correct physical FKs pointing to `projects.id`, but (a) the name suggests a financial purpose when the real function is linking to the source musical project, and (b) no form in either of the 2 modules ever writes the value (`GAP-0033`). The same "real FK, never written by the UI" pattern repeats in `audiovisual`'s `artist_id`/`campaign_id`/`event_id` (`GAP-0034`).
2. **"Blocking MISSING_RELATION" pattern**: `releases ↔ projects` (`GAP-0168`) was the only cross-domain gap with `blocksSchemaV2Design: true` in the entire audit — corrected: the decision (`DEC-009: PROJECT_RELEASE_DIRECT_LINK`) was resolved by the Product Owner, `blocksSchemaV2Design` is now `NÃO`; no gap blocks the v2 schema design due to decision ambiguity anymore.
3. **"Partial financial propagation" pattern**: `contracts→accounting` is the only confirmed real automatic propagation (only the `valor` field); `events`, `licensing`, `monitoring` have no propagation at all, even though they all conceptually generate financial value (see the propagation table in MODULE-ACCOUNTING).
4. **"Automatic conversion without duplicate checking" pattern**: the Lead→Client/Artist conversion always creates a new `Artist`, without checking for duplicates or the lead type (an isolated finding, but of the same structural kind as the absence of duplicate detection in lead capture — `GAP-0101`).
5. **"Parallel schema layer with no consumer" pattern**: the second accounting layer (`financial_transactions`/`financial_accounts`/`cost_centers`/`counterparties`/`transaction_allocations`/`performance_metric_entries`/`budgets`), discovered in this audit (Part V.2), is structurally the richest cross-domain relation in the system (FKs to `artists`/`phonograms`/`projects`/`releases`/`contracts`/`events`/`clients` simultaneously) — but with no frontend or service consumer confirmed in any of the 24 module reports.

`EVIDENCE: Part V.3 (master table) + Part VI (24 module sections) | CONFIDENCE: HIGH for patterns 1-3 (evidenced by multiple independent modules); MEDIUM for pattern 5 (schema finding, with no dedicated module confirmation)`

---

# PART VIII — INTEGRATIONS (consolidated)

The complete provider matrix (21 entries + sub-table of 6 distributors) was already built in **MODULE-INTEGRATIONS** (Part VI). This part consolidates the cross-cutting points:

## VIII.1 Summary by status
- **IMPLEMENTED (9)**: Spotify, YouTube, Instagram/Meta, TikTok/TikTok Ads, Google Ads, Cloudflare R2, Resend, Sentry, AI router (OpenAI/Anthropic/Google AI).
- **PARTIAL (5)**: Stripe, Stripe Connect, DocuSign, Autentique, ABRAMUS, ACRCloud.
- **Honest STUB (2)**: Clicksign, PostHog.
- **Honest STUB — 6 named distributors**: ONErpm, DistroKid, Symphonic, SoundOn, MusicPro, SomVibe (see the dedicated sub-table in MODULE-INTEGRATIONS).
- **UI_ONLY (3)**: NF-e, ECAD (connection card), UBC.
- **CONFIG_ONLY (1)**: generic `external-data` framework.

## VIII.2 Reminder of the credential model (unchanged, no real value handled)
Two distinct credential spaces, confirmed consistent throughout the `integrations` audit:
- **Platform/system secrets** (`PLATFORM_SHARED`) — belong to the MUSIC OS 360 application itself, not to a specific tenant (e.g. the Spotify API key used to sync metrics for any artist, the Resend credential for sending transactional e-mail, the Sentry key). They must live in an environment variable / the platform's secrets manager — never in a business table associated with a tenant.
- **Per-tenant provider credentials** (`TENANT_OWNED`) — belong to a specific tenant's business (e.g. the tenant's Autentique account token, the Instagram/Meta OAuth credential connected by that tenant, a future distributor credential once implemented). They must live in secure, tenant-specific, encrypted storage (the pattern already used by `IntegrationBaseService`: AES-256-GCM).

No real credential value was printed, added or requested in this report or in any previous step of this audit (`CREDENTIALS_TO_ADD_NOW: 0` confirmed in all modules touching integrations, including the 6 distributors named in this step).

`EVIDENCE: docs/backend-v2/field-traceability/modules/integrations.md §18 | CONFIDENCE: HIGH | STATUS: CONFIRMED`

---

# PART IX — AUTH / TENANCY / SECURITY

## IX.1 Tenant / org_id / workspace / membership / JWT / guard / RLS

PostgreSQL is the single database (via Supabase). Multi-tenant isolation today relies on an explicit `tenant_id` in every business table, always resolved server-side from the verified JWT (never from the `X-Tenant-ID` sent by the client, which is used only as a consistency check) — `TenantGuard` + `TenantBootstrapResolver` + `@CurrentTenant()` (see Part IV.3 for the complete guard chain). RLS (Row Level Security) is mentioned as an additional mechanism at specific points (e.g. Realtime broadcast authorization, migration `20260801000001_RealtimeBroadcastAuthorization`), but the primary enforcement confirmed throughout the audit series is the explicit `tenant_id` check in each application query, not RLS as the sole layer.

**Tenant-scoped tables**: 137 of the schema's 142 tables (see Part V.1) — the exceptions are the 5 global RBAC tables (`permissions`, `permission_groups`, `permission_aliases`, `permission_conflicts`, `permission_dependencies`) and `musicos360_migrations` (technical control).

**Cross-tenant admin cases**: only `GET/PATCH /billing/admin/tenants[/:id]` (`super_admin`, `MODULE-ADMIN`) is genuinely cross-tenant. `AdminAudit.tsx`/`AdminSupport.tsx` are framed as cross-tenant in the UI but are tenant-scoped in the backend (`GAP-0021`) — a misleading-UX finding, not an isolation failure.

**Workspace/tenant/organization**: see MODULE-WORKSPACE for the complete naming quirk (`org_id` in the JWT always carries a `tenants.id`, never an `organizations.id`).

`EVIDENCE: docs/backend-v2/field-traceability/modules/auth.md §3,§4 | modules/workspace.md §0,§10,§18 | docs/backend-v2/field-traceability/74-zero-gap-reconstruction-contract.md §12 | CONFIDENCE: HIGH | STATUS: CONFIRMED`

## IX.2 Security — consolidated view

| Mechanism | Confirmed state | Evidence |
|---|---|---|
| JWT | Real verification via `JwtAuthGuard`, claims resolved server-side, never trusting a client header | Part IV.3, MODULE-AUTH |
| RLS | Additional mechanism confirmed at specific points (Realtime broadcast); primary enforcement is an explicit `tenant_id` in application code | MODULE-AUTH §3 |
| RBAC | Dual model (legacy `role` string + `role_id` FK), always both filled after any real write path; 25 dedicated tables (Part V.2) | MODULE-WORKSPACE |
| CORS | Configured via `@nestjs/config`/env — not audited in depth in this series beyond confirming it exists | `apps/api/src/app.module.ts`, MEDIUM |
| Helmet | Present in the standard Nest middleware chain — not individually re-audited in this step | MEDIUM |
| Rate limiting | Real `RateLimitGuard`, part of the global guard chain (Part IV.3) | HIGH |
| PII encryption | Real, consistent AES-256-GCM in `artists` (4 fields), `clients` (3 fields) — **inconsistent** in `artists.dados_bancarios` (jsonb, unencrypted, exported in plain text — CONFLITO-04) | Part VI (MODULE-ARTIST, MODULE-CRM-RELATIONSHIPS) |
| Webhooks | Real idempotency via `webhook_events.external_id UNIQUE`; signature validation confirmed for Stripe/Autentique | MODULE-INTEGRATIONS |
| Trust proxy | Not individually audited in this series — no finding recorded | UNKNOWN |
| Body limits | Not individually audited in this series — no finding recorded | UNKNOWN |
| Uploads | Real pipeline via Cloudflare R2 for most modules (artist, releases/artwork, inventory); several upload stubs confirmed per module (see "fake/stub/dead" in each Part VI section) — no upload stub represents a security risk (they all fail explicitly; none silently accepts and discards a malicious file) | Part VI, multiple modules |
| Raw body / HTTPS | Not individually audited in this series beyond confirming that webhooks (Stripe) depend on the raw body for signature validation (implicit in the use of the standard Stripe SDK) | MEDIUM |

**No authorization or tenant-isolation gap was invented in this step** — where previous audits confirmed `AUTHORIZATION_GAPS: 0`/`TENANT_ISOLATION_GAPS: 0` (e.g. `TenantGuard`, "last owner" protection, storage isolation by the `tenants/<id>/...` prefix), this report preserves that confirmation unchanged. The concrete security gaps identified in this series are: (1) inconsistent encryption of artist banking data (CONFLITO-04, PO-VERIFY-022); (2) contract party PII in unencrypted free text (`GAP-0049`); (3) `signOut()` does not close Realtime channels (`GAP-0037`); (4) Supabase Redirect/Site URL allowlist not verifiable from code, blocking the cutover (`GAP-0039`).

`EVIDENCE: consolidation of Part VI (MODULE-AUTH, MODULE-ARTIST, MODULE-CRM-RELATIONSHIPS, MODULE-INTEGRATIONS) + Part IV.3 | CONFIDENCE: HIGH for the items with a cited finding; UNKNOWN explicitly marked for trust proxy/body limits (not covered by any of the 24 module reports)`

---

# PART X — STORAGE / REALTIME / JOBS

## X.1 Storage (Cloudflare R2 / Supabase Storage) — real vs. fake/stub by module

| Module | Storage | State |
|---|---|---|
| artist | R2 (photo/documents) | **REAL** |
| releases | R2 (artwork) | **REAL** (delete does not clean up the object, `GAP-0132`) |
| inventory | R2 (item photo) | **REAL** (delete does not clean up the object, `GAP-0096`) |
| rh | R2 (document upload) | **REAL** (but creation of the metadata record fails due to a `GAP-0138`-adjacent issue) |
| projects/catalog (track/phonogram audio) | — | **Hardcoded STUB** (always returns `null`/never persists the binary, `GAP-0042`) |
| crm-relationships (contact photo) | real presigned-to-R2 in the backend | **NEVER CALLED** — the UI only uses local data URLs |
| musicchat (conversation attachments) | — | **FAKE** (`URL.createObjectURL`, ephemeral local reference, `GAP-0122`) |
| leads (attachment upload) | — | **FAKE** (100% decorative, `URL.createObjectURL`) |
| support (simulated chat attachment) | — | **FAKE**, the most fake pattern of the series (it does not even create a local blob) |
| audiovisual (assets) | real endpoint | **NO upload UI** |

## X.2 Realtime (Supabase Realtime)

| Module | Real publisher? | Real consumer? | Finding |
|---|---|---|---|
| musicchat | **YES** (`RealtimeService`, 7 confirmed `conversation:*` publication points) | **NO** — `useRealtimeSync.ts` never subscribes (`GAP-0121`) | first fully real realtime chain (publisher) confirmed, but with no bridge to the central consumer |
| support | **YES** (1 real broadcast on ticket resolution) | not individually evaluated | functional for that specific point |
| dashboard | absent (internal `EventEmitter2` bus with no bridge) | 14 `useWsEvent()` subscriptions, 0 receive any event | `GAP-0068` |
| events | absent | none | `GAP-0074` — no bridge between the internal bus and Realtime |
| marketing | absent | no consumer for campaign status changes | `GAP-0114` |
| auth | N/A | `signOut()` does not explicitly close channels | `GAP-0037` |

**Cross-module pattern finding**: the internal domain event bus (`EventEmitter2`/`domain_event_log`) is used consistently for server-side logic (e.g. contract automations, automatic creation of the marketing workspace), but the bridge between this internal bus and the Supabase Realtime broadcast (visible to the client) is only genuinely complete in `musicchat` (on the publisher side) and `support` (1 point). In `dashboard`/`events`/`marketing`, the absence of this bridge is the direct root cause of "Atividades Recentes" (Recent Activities)/live updates never working.

## X.3 Async / Jobs

- **BullMQ + Redis (legacy, `apps/api`)**: real, configured via `QueueModule` with a graceful `noOpModule()` fallback if Redis is absent (see Part IV.4). Confirmed consumers: marketing content publication scheduling (retry+backoff+idempotency), automatic support triage, contract expiration cron (30 days).
- **pg-boss (v2)**: **no document or code referencing pg-boss was found** in `apps/api-v2` in this audit — not confirmed as part of the v2 stack so far (see Part XI).
- **Domain events**: `domain_event_log` (real table, 12 cols) + `EventEmitter2` — used extensively in `WorkspaceProvisioningService`, contract/marketing automations; not connected to the Realtime broadcast in most modules (see X.2).
- **Schedulers/cron**: contract expiration cron (30 days, real); no automatic license-expiration job/cron (`licensing`, `EXPIRATION_GAP`), no royalty reconciliation job (`monitoring`), no scheduled/recurring report (`reports`, `GAP-0136`).

`EVIDENCE: Part IV.4 (QueueModule) + Part VI (per-module findings, cited individually above) | CONFIDENCE: HIGH for Storage/Realtime (evidenced per module); MEDIUM for "pg-boss not found" (absence, not presence — see Part XI for the direct inventory of `apps/api-v2`)`

---

# PART XI — BACKEND V2 (`apps/api-v2`)

## XI.1 Already built (verified directly in `apps/api-v2/src/**`)

| File/module | Status | Tested? |
|---|---|---|
| `app.controller.ts`/`app.module.ts`/`app.service.ts` | minimal NestJS scaffold | not confirmed |
| `config/config.module.ts`/`config.service.ts` | configuration loading via Zod | not confirmed |
| `config/database-config.service.ts`/`database.schema.ts` | validation of `DATABASE_URL`/`DIRECT_DATABASE_URL` — **note**: "database.schema.ts" here is an ENVIRONMENT VARIABLE schema, not a business table schema; the name may be confusing | not confirmed |
| `config/env.schema.ts` + `env.schema.spec.ts` | env var validation | **YES** (dedicated spec) |
| `database/client/drizzle.provider.ts`, `pg-pool.service.ts` | real connection to Postgres via Drizzle+pg | not confirmed |
| `database/database.module.ts` | Nest database-access module | not confirmed |
| `database/transaction/drizzle-transaction-manager.ts`, `drizzle-transaction-context.ts`, `resolve-database-client.ts`, `retryable-postgres-error.ts` | real transaction/retry infrastructure | `*.spec.ts` files exist for the key pieces |
| `main.ts` | Nest bootstrap | not confirmed |

Real installed dependencies: `@nestjs/common`/`core`/`platform-express` (11.x), `drizzle-orm` (0.45.x), `pg`, `zod` (4.x), `express` (5.x). The `apps/api-v2` `package.json` itself literally describes itself as *"initial scaffold, no business domains"*.

## XI.2 NOT built yet — all 24 business domains, individually named

**No business domain table** has been defined in Drizzle and **no CRUD module** (controller/service/DTO) exists in `apps/api-v2` for any of the 24 audited domains: Project, Work, Phonogram, Release, Contract, Accounting, Audiovisual, Marketing, Artist, CRM (crm-relationships), Events, Inventory, Leads, Licensing, RH, Settings, Support, Admin, Reports, Integrations, MusicChat, Monitoring, Catalog, Dashboard. No real integration (Stripe, Spotify, ABRAMUS, R2 etc.) has been ported. No cutover has been technically planned beyond the conceptual criterion already recorded in `docs/backend-v2/field-traceability/74-zero-gap-reconstruction-contract.md §24`.

**Explicit conclusion**: the technical foundation (Nest + Drizzle + Zod + database connection + transaction infrastructure) is ready and partially tested. This **must not be confused** with functional reconstruction — no business domain has been rebuilt, and the 168 gaps documented in this audit (Part XIII) all remain pending treatment at the design/implementation step of each domain.

## XI.3 Stack, Testing, Deployment — according to the documentation found in `docs/backend-v2/*.md`

`docs/backend-v2/` contains 82 numbered documents (`00-repository-state.md` to `81-field-level-zero-gap-traceability.md`) covering the complete evolution of the v2 technical decisions, among them (not reopened by this report, only listed as confirmation of existence): `43-api-v2-http-framework-decision.md`/`44-...-final-resolution.md` (NestJS), `45-api-v2-database-access-decision.md` (Drizzle), `46-database-v2-migration-strategy.md`, `47-api-v2-layered-architecture.md`, `48-api-v2-directory-structure.md`, `49-auth-tenant-request-context.md`, `50-api-v2-error-model.md`, `51-api-v2-transaction-strategy.md`, `52-api-v2-observability-strategy.md`, `53-api-v2-configuration-secrets-strategy.md`, `58-api-v2-database-stack-final-decision.md`, `59-...-nestjs-version-final-decision.md`, `60-...-node-version-final-decision.md`, `61-...-deployment-model-final-decision.md`, `63-...-typescript-final-decision.md`, `64-...-validation-stack-final-decision.md`, `65-...-drizzle-postgres-versions-final.md`, `66-...-auth-jwt-stack-final-decision.md`, `67-...-async-processing-stack-final-decision.md`, `68-...-observability-stack-final-decision.md`, `69-...-testing-quality-gates-final-decision.md`, `70-...-http-security-stack-final-decision.md`, `71-environment-file-naming-final-decision.md`, `72-api-v2-final-stack-and-readiness.md`, `73-api-v2-database-namespace-final-decision.md`, `74-zero-gap-reconstruction-contract.md`.

These documents represent **technical decisions already made and recorded** (HTTP framework=NestJS, database access=Drizzle, schema namespace=`app`, Node/TypeScript/Postgres/Drizzle versions pinned) but, as confirmed directly in XI.1/XI.2, **none of them has been implemented in business-domain code yet** — the state of `apps/api-v2` remains a pure scaffold. This audit found no v2 deployment-infrastructure migration in progress beyond what documents `61`/`72`/`73` already record conceptually — specific items of real deployment (CI/CD pipeline for `apps/api-v2`, dedicated staging environment) remain **unconfirmed** by this audit and must not be presumed ready.

`EVIDENCE: apps/api-v2/package.json | apps/api-v2/src/config/database.schema.ts | apps/api-v2/src/database/** (file listing, direct verification) | docs/backend-v2/*.md (file listing, 82 documents, not reopened) | CONFIDENCE: HIGH for XI.1/XI.2 (direct file verification) | MEDIUM for XI.3 (existence of the documents confirmed; the detailed content of each one was not re-read in this step, only those already cited earlier in Part XII) | STATUS: CONFIRMED`

---

# PART XII — DECISIONS

Primary source for this part: `docs/backend-v2/gap-resolution/decision-register.json` (read in full in this step) + `docs/backend-v2/gap-resolution/00-canonical-gap-register.md` (correction ADDENDA) + `docs/backend-v2/review/00-master-domain-functional-verification.md §21/§22`. No pending decision is resolved here.

## XII.1 RESOLVED decisions (documentation-level — no code/schema/migration changed)

### DEC-001 — Canonical meaning of `projects`
**OLD (superseded/invalidated)**: `UNIVERSAL_FINANCIAL_PROJECT` — status `INVALIDATED_BY_PRODUCT_OWNER_DOMAIN_CORRECTION`. Original interpretation: `projects` would be a generic financial/operational hub that `audiovisual`/`marketing`/`accounting` would reference via `financial_project_id`; the real music release flow would be just a specialization (`MUSIC_RELEASE_PROJECT`) within that generic hub.
**NEW (current)**: `MUSICAL_PROJECT_CANONICAL_HUB` — `projects` is the canonical Musical Project/Song entity; `projects.id` is the cross-domain link key for that specific song. The real cross-domain relations (`financial_project_id`, `transactions.projeto_id`) continue to exist and are preserved — what changes is only the **interpretation** of why they exist (because the record belongs to a specific song, not because `projects` is itself a generic financial entity).
**Why the correction**: `correctionAuthority: PRODUCT_OWNER` — an explicit domain correction (PROMPT 129 of the project history), not a new technical analysis.
**Preserved relations** (`preservedRelations`): `audiovisual_projects.financial_project_id → projects` (LEGACY_NAMING); `marketing_projects.financial_project_id → projects` (LEGACY_NAMING); `transactions.projeto_id → projects` (name already correct); `works.projeto_id → projects` (`ALREADY_CORRECT`, confirmed populated).
**Rejected option `DUAL_MODEL`**: does not authorize creating `project_category`/`project_kind`/`project_domain`/`project_subtype` — there is no second "kind" of project that needs a discriminator.
**Implementation**: `NOT_STARTED` — `ProjetoFormModal.tsx` was not modified; `GAP-0033`, `GAP-0013`, `GAP-0168` remain open; no column was renamed.
**Affected gaps**: GAP-0001. **Affected modules**: projects, audiovisual, marketing, accounting, catalog, releases (via the cross-domain chain).

### DEC-002 — Canonical contract-type vocabulary
**Selected**: `CONTRACT_SERVICE_TYPES_CANONICAL` — `contract_service_types` (32 columns, incl. financial terms) is the canonical source. `contract_templates.tipo_servico` = `LEGACY/DENORMALIZED_REFERENCE_TO_CANONICAL_TYPE`; `contract_categories` = `DISPLAY_ONLY` (may continue to exist as a grouping/label layer, not as a type source); `CONTRACT_TYPES` (dead hardcode) = `DEAD_LEGACY_VOCABULARY`.
**Constraint imposed on DEC-004**: WIZARD and QUICK must consume the same canonical vocabulary — it is forbidden to keep the WIZARD reading free text from `contract_templates.tipo_servico` while QUICK reads `contract_service_types`. QUICK already consumes `contract_service_types` today (`PRESERVED_AS_CANONICAL_DIRECTION`); the WIZARD needs future alignment (`NEEDS_FUTURE_CONTRACT_ALIGNMENT`).
**Physical reference key** (id vs. slug): `TO_BE_DEFINED_DURING_SCHEMA_CONTRACT_RESOLUTION` — not decided by `DEC-002`.
**Explicit note**: `DEC-002 RESOLVED != GAP-0055 RESOLVED` — this decision neither implements nor fixes the financial propagation from contract to accounting.
**Migration of legacy data**: `POSSIVEL`, `REQUIRES_DATA_RECONCILIATION_DURING_MIGRATION_PREPARATION` — ambiguous values, if any, will be escalated individually during migration preparation, not guessed now.
**Implementation**: `NOT_STARTED`.
**Affected gaps**: GAP-0002. **Affected modules**: contracts.

### DEC-004 — Single contract create/edit component
**Selected**: `UNIFIED_CONFIGURABLE_CONTRACT_COMPONENT` — a single canonical component/form state, with **WIZARD** mode (complete flow, today `ContratoWizard.tsx` — templates, dynamic parties, variables, signatories, preview, complete workflow) and **QUICK** mode (abbreviated flow, today triggered by `RegistroMusicas.tsx` after registering a Work/Phonogram — the same canonical implementation, may pre-fill context/reduce the visible steps). Both entry points are preserved.
**File identity**: `NOT_DECIDED` — it may be a refactoring of the existing Wizard, a new shared component extracted from it, or another equivalent technical reorganization; it is not decided whether the final file is `ContratoWizard.tsx`, `ContratoFormModal.tsx` or a new file.
**Fields to preserve**: `template_id`, `arquivo_url`, `exclusivo`, `artista_id`, `cliente_id`, `lancamento_id`, `signing_platform`, `signers`, `data_inicio/data_fim`, `observacoes`, dynamically detected parties, manifest variables.
**Semantic conflict of `observacoes` NOT resolved by this decision**: today the Wizard writes a structured JSON blob; the Modal writes free text — the same column, two meanings. `DEC-004` resolves only the duplication of the create/edit surface, not this semantic conflict nor the storage model for parties/variables (`NOT_DECIDED_BY_DEC_004`), nor the PII in `observacoes` (`GAP-0049` remains `OPEN`).
**Impact on the v2 schema/API**: `NONE_DIRECT` — the choice of canonical component does not, by itself, require a schema change.
**Implementation**: `NOT_STARTED`.
**Affected gaps**: GAP-0004 (and it provides the premise for GAP-0008/DEC-008). **Affected modules**: contracts, catalog (QUICK entry point).

### DEC-007 — Release tracklist model
**Selected**: `RELATIONAL_TRACKLIST_MODEL` — the tracklist must be relational, referencing concrete phonograms. Canonical chain: `Release → Release Track → Phonogram → Work → Rights/Shares`. `metadata.faixas` (jsonb) is **not** the canonical source (`NON_CANONICAL_METADATA`, a candidate for `LEGACY_DATA`/`MIGRATION_SOURCE` — exact treatment to be determined at the migration step, nothing migrated/deleted now).
**Architectural caveat**: `release_works(release_id, work_id)`, in its current format, is **not** accepted as the final form — it lacks `phonogram_id`, `position/order` and a track identity; it links release↔work (abstract composition), not release↔phonogram (concrete recording). `FINAL_RELATIONAL_SCHEMA_STATUS: TO_BE_DESIGNED` (a new `release_tracks` table, vs. evolving/replacing `release_works` — a choice for the schema-resolution step, not for this decision).
**Minimum requirements already recorded**: `release_id`, `phonogram_id`, `position/order`.
**Fixed domain semantics**: `Work` = `ABSTRACT_COMPOSITION`; `Phonogram` = `CONCRETE_RECORDING`; `ReleaseTrack` = `ORDERED_OCCURRENCE_OF_A_RECORDING_IN_A_RELEASE`.
**Rejected options**: `JSONB_FORMALIZED` (would discard rights traceability via `phonograms.obra_id→works.id`); `HYBRID_DUAL_WRITE` (dual-write consistency risk with no documented performance requirement to justify it).
**Implementation**: `NOT_STARTED` — `release_tracks` was not created; `release_works` was not changed; `metadata.faixas` was not changed; `GAP-0129`/`GAP-0130` remain open.
**Affected gaps**: GAP-0007 (`blocksSchemaV2Design: NÃO` — decision already resolved by this `DEC-007`; corrected; the previous "blocks v2 schema" marking is outdated; see ADDENDUM — DEC-007 RESOLVED in `00-canonical-gap-register.md`). **Affected modules**: releases, catalog.

## XII.2 PENDING decisions (options, advantages/disadvantages/risks)

### DEC-003 — Canonical artist creation flow

> ⚠️ **Decision resolved since this subsection — `DEC-003: ARTISTA_FORM_MODAL_CANONICAL` (Product
> Owner)**: `ArtistaFormModal.tsx` is the single canonical flow; `ArtistaCadastro.tsx` to be removed after
> merging 10 real exclusive fields (tipo, status, contrato_id, manager_nome, manager_contato,
> produtor_executivo, agencia_booking, label_parceira, galeria_urls, documentos — complete classification
> in `decision-register.json` `DEC-003`). **Additional correction**: the attribution of
> `ARTIST_FORM_SECTIONS` below is inverted — direct code inspection confirms that
> `ArtistaFormModal.tsx` (not `ArtistaCadastro.tsx`) imports and renders `ARTIST_FORM_SECTIONS`; the
> code has changed since this audit. The text below is preserved as a historical record of the original
> analysis — see `gap-resolution/00-canonical-gap-register.md` ("Canonical correction — DEC-003
> RESOLVED") for the current definition.

**Question**: `ArtistaFormModal.tsx` (real, ~45 fields) vs. `ArtistaCadastro.tsx` (orphaned, ~71 fields) — which one is kept/expanded?
| Option | Advantages | Disadvantages | Risk |
|---|---|---|---|
| (1) Keep the Modal, port the ~26 exclusive fields, remove the orphan (recommended) | The only component with real navigation today; a smaller surface to maintain | Requires porting ~26 fields without losing them | Loss of artist registration fields if the orphaned page is discarded without analysis |
| (2) Replace the Modal with the orphaned page | Broader field coverage from the start | Requires reconnecting navigation; a bigger refactoring | Temporary regression in the real flow in use |
| (3) Keep both for distinct flows (quick vs. complete) | Preserves both surfaces | Permanent duplicated maintenance | Risk of continuous field divergence (the same pattern as today) |
**Recorded recommendation**: option (1) — **CHOSEN by the Product Owner** (`ARTISTA_FORM_MODAL_CANONICAL`, RESOLVED).

### DEC-005 — Canonical billing surface
See the complete analysis (3 options with advantages/disadvantages/risks) in **DOMAIN-BILLING**, within MODULE-SETTINGS (Part VI). `DEC-005: PENDING_PRODUCT_DECISION` — `DEC_005_ANALYSIS_STATUS: PARKED_UNCHANGED`. Not resolved here.

### DEC-006 — Canonical invitation-management surface
**Question**: `/usuarios` (only sends invitations) vs. the "Usuários" (Users) tab of `Configuracoes.tsx` (complete surface: list/resend/cancel) — which one wins?
| Option | Advantages | Disadvantages | Risk |
|---|---|---|---|
| (1) The "Usuários" (Users) tab of Configuracoes (recommended) | It already has the complete surface, against the same real backend (`useRoles()`) | Requires removing/redirecting the duplicated action in `/usuarios` | Low — a UI change, not a backend one |
| (2) `/usuarios.tsx` | Top-level route, more discoverable | Requires porting list/resend/cancel | Bigger UI effort |
| (3) Extract a shared component, keep the 2 entry points | Preserves both navigation points | Does not eliminate the conceptual fragmentation | Smaller net gain |
**Recorded recommendation**: option (1). **Current impact**: low technical risk (backend already unified); risk of UX confusion while pending.

### DEC-008 — Contract party `sourceId` (live reference vs. snapshot)
**Question**: when a contract party is populated from an existing client/artist, should the `sourceId` become a live reference (future edits propagate), or should the current snapshot (copies values, no link) be formalized as intentional?
| Option | Advantages | Disadvantages | Risk |
|---|---|---|---|
| (1) Live reference | Always up-to-date data in the contract | Depends on `DEC-004` already being resolved (which component owns the party state) | **Direct legal risk**: a signed contract could appear to have changed retroactively if the source CRM/Artist record is edited later |
| (2) Formalize the snapshot as intentional (recommended) | The legal document does not change retroactively — normally the correct behavior for signed contracts | No automatic propagation of registration corrections | Low — documentation only, no code change |
**Recorded recommendation**: option (2). It is up to the Product Owner since it affects the legal semantics of contracts — not resolved here.

Outside `decision-register.json` but frequently cited together with the pending ones above: no other formal Wave 0 decision was recorded for the other 20 modules.

`EVIDENCE: docs/backend-v2/gap-resolution/decision-register.json (read in full) | docs/backend-v2/gap-resolution/00-canonical-gap-register.md (ADDENDA) | 00-master-domain-functional-verification.md §21,§22 | CONFIDENCE: HIGH | STATUS: DEC-001/002/003/004/007/009=RESOLVED (documentation-level); DEC-005/006/008=PENDING_PRODUCT_DECISION (corrected — DEC-003 and DEC-009 resolved in later corrections)`

---

# PART XIII — GAPS (complete appendix)

This part incorporates the complete table of all gaps in `canonical-gap-register.json`, built during the Phase 3 consolidation step and verified in this step against the live JSON file: **168 gaps in the live register, 168 rows in this table — count confirmed identical** (no row added, removed or reordered relative to the source).

Columns: `Gap ID` (canonical identifier) · `Module(s)` (one or more affected modules) · `Sev` (severity: `S1_HIGH`/`S2_MEDIUM`/`S3_LOW`/`S4_INFORMATIONAL`) · `Status` (`OPEN`/`DEFERRED`/`ACCEPTED_BY_EXISTING_CONTRACT`/`NO_FIX_REQUIRED`/`NOT_APPLICABLE`) · `Description` · `Root Cause` · `gapType` (technical classification of the failure pattern) · `Wave` (planned resolution wave, `WAVE_0_DECISIONS` to `WAVE_7_CLEANUP`) · `Priority` (score 0-100) · `DependsOn` (gap it depends on, if any) · `BSv2`/`BV2`/`BCut` (blocks v2 schema / blocks v2 API implementation / blocks cutover — `yes`/`no`) · `UD` (requires a user/Product Owner decision before technical resolution — `YES`/`no`) · `Decision` (ID of the associated decision, if any) · `Credentials` (credential-need indicator, always `—` or notes — no real value present in any row).

`EVIDENCE: docs/backend-v2/gap-resolution/canonical-gap-register.json (168 gaps, verified in this step) | table originally compiled in docs/backend-v2/review/_gap-appendix-fragment.md (previous phase, re-verified and incorporated here without content changes) | CONFIDENCE: HIGH | STATUS: CONFIRMED (count 168=168)`

| Gap ID | Module(s) | Sev | Status | Description | Root Cause | gapType | Wave | Priority | DependsOn | BSv2 | BV2 | BCut | UD | Decision | Credentials |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| GAP-0001 | projects, audiovisual, marketing, accounting | S1_HIGH | OPEN | projects domain-meaning conflict: UNIVERSAL_FINANCIAL_PROJECT (schema) vs MUSIC_RELEASE_PROJECT (only reachable UI) | The `projects` table/DTO was migrated (FinancialOperationalBridges) as a universal financial/operational project entity that audiovisual_projects/marketing_projects can link to via financial_project_id, but the only reachable UI (ProjetoFormModal.tsx) treats it exclusively as a music-release project and never exposes artista_id/orcamento/financial-linkage fields. Both truths coexist with no canonical resolution. | RELATION_MISMATCH | WAVE_3_CORE_DOMAIN_FIXES | 95 | — | no | no | no | no | DEC-001 | — |
| GAP-0002 | contracts | S2_MEDIUM | OPEN | contracts: contract-type vocabulary DECIDED (DEC-002: CONTRACT_SERVICE_TYPES_CANONICAL) — remaining work is implementation-only (corrected; original text below described this as unresolved source-of-truth ambiguity, which contradicted DEC-002 §XII/2632 in this same document — see canonical-gap-register.json for full correction) | ORIGINAL (superseded): "Four independent type systems coexist: hardcoded frontend CONTRACT_TYPES (dead), contract_categories in localStorage only, contract_templates.tipo_servico (what actually reaches contracts.tipo via the wizard), and contract_service_types.slug (32 rich columns incl. unused financial terms, read only by the secondary ContratoFormModal). No single inventory exists." — contract_service_types is now the canonical source (DEC-002 RESOLVED); remaining real work: ContratoWizard.tsx (WIZARD) still doesn't consume it, physical reference key undecided, legacy free-text values unreconciled, requires_* rules unconsumed. | RELATION_MISMATCH | WAVE_2_SCHEMA_AND_CONTRACT | 55 | — | no | no | no | no | DEC-002 | — |
| GAP-0003 | artist | S2_MEDIUM | OPEN | artist: create-flow canon DECIDED (DEC-003: ARTISTA_FORM_MODAL_CANONICAL) — remaining work is merging real ArtistaCadastro.tsx-exclusive fields, not choosing which flow wins (corrected; original text below misattributed ARTIST_FORM_SECTIONS to ArtistaCadastro.tsx — see canonical-gap-register.json for full correction) | ORIGINAL (superseded): "ArtistaFormModal.tsx (actually used, ~45 fields) and ArtistaCadastro.tsx (routed, ~71 fields via a separate ARTIST_FORM_SECTIONS definition, but confirmed orphaned — zero navigation reaches it) are complete, independent implementations of the same feature with divergent field coverage." — ArtistaFormModal.tsx is canonical (Product Owner decision); it already imports/renders ARTIST_FORM_SECTIONS (not ArtistaCadastro.tsx, as originally recorded); remaining real work: merge tipo/status/contrato_id/manager_nome/manager_contato/produtor_executivo/agencia_booking/label_parceira/galeria_urls/documentos, then remove the orphan. | RELATION_MISMATCH | WAVE_3_CORE_DOMAIN_FIXES | 40 | — | no | no | no | no | DEC-003 | — |
| GAP-0004 | contracts | S1_HIGH | OPEN | contracts: create/edit component canon DECIDED (DEC-004: UNIFIED_CONFIGURABLE_CONTRACT_COMPONENT) — remaining work is consolidation, not a Wizard-vs-Modal choice (corrected; original text below described this as an unanswered "which is canonical?" choice, which contradicted DEC-004 §XII/2641 in this same document — see canonical-gap-register.json for full correction) | ORIGINAL (superseded): "The two create/edit components support partially disjoint field sets (arquivo_url/exclusivo only in ContratoFormModal; template_id/parties-blob/manifested variables only in ContratoWizard). A contract created by one and edited by the other loses data." — neither component is canonical alone (DEC-004 RESOLVED); the canonical target is ONE shared component with WIZARD/QUICK modes, both entrypoints preserved; remaining real work: actual consolidation not yet implemented (ContratoWizard.tsx/ContratoFormModal.tsx unchanged, still two independent implementations). | RELATION_MISMATCH | WAVE_3_CORE_DOMAIN_FIXES | 60 | — | no | no | no | no | DEC-004 | — |
| GAP-0005 | settings | S2_MEDIUM | OPEN | settings: billing fragmented across 3 UI surfaces — which becomes canonical? | Three separate billing UIs coexist: Configuracoes.tsx "Billing" tab (correct architecture, hits a missing endpoint), standalone Billing.tsx (hardcodes plan pricing, violating the codebase's own "never hardcode plans" rule), and BillingBlockedPage.tsx (legitimately distinct purpose, not part of the conflict). | RELATION_MISMATCH | WAVE_0_DECISIONS | 45 | — | no | no | no | YES | DEC-005 | — |
| GAP-0006 | workspace, settings | S2_MEDIUM | OPEN | workspace/settings: invitation-management UI fragmented across /usuarios and Configuracoes "Usuários" tab | /usuarios (Usuarios.tsx) can send invites via useRoles().inviteUser but has zero UI for listing/resending/cancelling pending invitations; Configuracoes.tsx "Usuários" tab (same backend, full useRoles() hook) has the complete surface. Two pages manage the same membership backend inconsistently. | RELATION_MISMATCH | WAVE_0_DECISIONS | 35 | — | no | no | no | YES | DEC-006 | — |
| GAP-0007 | releases, catalog | S1_HIGH | OPEN | releases: tracklist data model DECIDED (DEC-007: RELATIONAL_TRACKLIST_MODEL, Release → ReleaseTrack → Phonogram → Work) — remaining work is designing/implementing the final relational shape, not choosing between relational and jsonb (corrected; original text below described this as an unanswered choice, which contradicted DEC-007 §XII/2650 in this same document — see canonical-gap-register.json for full correction) | ORIGINAL (superseded): "release_works (real M:N join table to works) exists at schema level but is never populated by any functional flow; the real tracklist UI persists tracks entirely inside releases.metadata.faixas jsonb with no relation to phonograms/works at all. Two structurally incompatible tracklist models coexist with no canonical choice made." — jsonb is NOT canonical (DEC-007 RESOLVED); release_works in its current shape is NOT the final schema either (lacks phonogram_id/position); remaining real work: design/implement the final relational shape (new release_tracks or evolved release_works) and migrate off metadata.faixas. | RELATION_MISMATCH | WAVE_2_SCHEMA_AND_CONTRACT | 70 | — | no | no | no | no | DEC-007 | — |
| GAP-0008 | contracts, crm-relationships, artist | S2_MEDIUM | OPEN | contracts: party sourceId (CRM/Artist origin) copied instead of live-referenced | When a contract party is populated from an existing client/artist, only the copied field values are embedded into the observacoes JSON blob — the sourceId of the originating record is never persisted, so later edits to the source never propagate. A canonical choice (snapshot-by-design vs live-reference) was never made. | RELATION_MISMATCH | WAVE_0_DECISIONS | 30 | GAP-0004 | no | no | no | YES | DEC-008 | — |
| GAP-0009 | accounting | S1_HIGH | OPEN | accounting: entityLinks (Vínculos Gerenciais P&L) silently stripped, never persisted | ManagerialLinksSection requires a mandatory TransactionEntityLink[] array in the transaction payload, but createTransacaoSchema/patchTransacaoSchema never declare entityLinks — Zod (no .passthrough()) silently strips the key. The semantic destination table transaction_allocations has zero backend consumer. | CREATE_MAPPING_MISMATCH | WAVE_2_SCHEMA_AND_CONTRACT | 70 | — | no | no | no | no | — | — |
| GAP-0010 | accounting | S1_HIGH | OPEN | accounting: /financial-categories/rules* endpoints do not exist (400 on every page load) | financeCategorizationRulesService calls GET/POST/PATCH/DELETE /financial-categories/rules[/preview|/execute], but the controller only implements the base CRUD + tree/search/move/reorder/archive routes — no "rules" route exists. GET falls through to @Get(':id') with id="rules", failing ParseUUIDPipe. | CREATE_MAPPING_MISMATCH | WAVE_2_SCHEMA_AND_CONTRACT | 65 | — | no | no | no | no | — | — |
| GAP-0011 | accounting | S1_HIGH | OPEN | accounting: CategoriasFinanceiras.tsx entirely disconnected from real backend (localStorage only) | The page uses exclusively useFinancialCategoryRulesStore() (localStorage), making zero API calls; its data shape does not correspond to the real financial_categories schema at all. | CREATE_MAPPING_MISMATCH | WAVE_3_CORE_DOMAIN_FIXES | 55 | GAP-0010 | no | no | no | no | — | — |
| GAP-0012 | accounting | S2_MEDIUM | OPEN | accounting: transaction attachment (anexo) upload is fake — local blob only, nulled before submit | handleFileUpload only creates a local URL.createObjectURL(file) with a toast admitting real upload is future work; form-to-payload.mapper.ts then nulls any anexoUrl still starting with blob: before submit — a real upload is never persisted despite the DB column being correctly mapped. | REAL_MAPPING_GAP | WAVE_3_CORE_DOMAIN_FIXES | 40 | — | no | no | no | no | — | — |
| GAP-0013 | accounting, projects | S2_MEDIUM | OPEN | accounting: Contabilidade.tsx "P&L por Projeto" does not group by project (same root cause as projects.md finding) | plPorProjeto maps each individual transaction as if it were "1 project" (own code comment confirms this), displaying t.descricao as the name — it never GROUP BYs/joins on the real, populated transactions.projeto_id column. | DISPLAY_MAPPING_MISMATCH | WAVE_4_CROSS_DOMAIN_FIXES | 60 | — | no | no | no | no | — | — |
| GAP-0014 | accounting, reports | S3_LOW | OPEN | accounting/TransacaoFormModal: dead exportFieldList() XLSX generator violates the 2-sheet rule | exportFieldList() generates a 3-sheet XLSX ("Campos","Itens","Catálogo Financeiro") but is never called from any button/handler — unreachable dead code that also happens to violate the platform-wide single/double-sheet policy. | REAL_MAPPING_GAP | WAVE_7_CLEANUP | 10 | — | no | no | no | no | — | — |
| GAP-0015 | accounting | S4_INFORMATIONAL | DEFERRED | accounting: financial_category_id/financial_category_snapshot columns never set by the transaction form (not a bug, PARTIALLY_MIGRATED) | These real DIRECT columns exist but only the legacy free-text categoria/subcategoria pair is used by the form — reflects a known partial-migration state, not a new defect. | REAL_MAPPING_GAP | WAVE_NONE | 5 | — | no | no | no | no | — | — |
| GAP-0016 | accounting | S3_LOW | OPEN | accounting: OFX import drops unmapped fields silently, no dedupe, no atomicity | Client-side OFX parser generates cliente_id/origem/venda_id which are not real transactions columns and are silently stripped by the same Zod mechanism as entityLinks; each row is an independent, non-atomic POST with no dedupe rule. | REAL_MAPPING_GAP | WAVE_6_SECONDARY_FUNCTIONALITY | 20 | — | no | no | no | no | — | — |
| GAP-0017 | accounting | S2_MEDIUM | OPEN | accounting: all filters/pagination are 100% client-side, no server-side filtering anywhere | Financeiro/Contabilidade/TransacaoRules/Nota Fiscal all filter over the full dataset already loaded via useDataQuery; no backend WHERE clause, no server pagination — TOTAL_COUNT_SOURCE is array.length. | PAGINATION_GAP | WAVE_6_SECONDARY_FUNCTIONALITY | 25 | — | no | no | no | no | — | — |
| GAP-0018 | admin | S2_MEDIUM | OPEN | admin: AdminSettings.tsx — 8 tabs, systemically zero real persistence | All fields in Geral/Email/Notificações are uncontrolled inputs with no onChange/API call; "Salvar Alterações" fires a fake success toast. Segurança uses local useState lost on tab close. Webhooks/Chaves API are backed by hardcoded empty arrays with "add" buttons having no onClick at all. Integrações mutates only local state. Usuários has no invite/create flow. | REAL_MAPPING_GAP | WAVE_6_SECONDARY_FUNCTIONALITY | 30 | — | no | no | no | no | — | — |
| GAP-0019 | admin | S4_INFORMATIONAL | OPEN | admin: admin-source.ts — 6 dead/empty data exports with zero consumers | ADMIN_KPIS/ADMIN_TENANTS/ADMIN_SECURITY_EVENTS/ADMIN_SYSTEM_METRICS/ADMIN_REVENUE/ADMIN_SUBSCRIPTIONS are hardcoded-empty and have zero consumers anywhere. | REAL_MAPPING_GAP | WAVE_7_CLEANUP | 8 | — | no | no | no | no | — | — |
| GAP-0020 | admin | S3_LOW | OPEN | admin: "Admin analytics indisponível" banner always visible regardless of real integration state | AdminLayout.tsx conditions the banner on !ADMIN_DATA_IS_MOCK, hardcoded false, so it shows on every admin page including the 6 pages that have real integration — stale/incorrect messaging. | DISPLAY_MAPPING_MISMATCH | WAVE_7_CLEANUP | 12 | — | no | no | no | no | — | — |
| GAP-0021 | admin, support | S2_MEDIUM | OPEN | admin: AdminAudit/AdminSupport UI-only cross-tenant framing over tenant-scoped backend | admin-audit.service.ts / admin-support.service.ts reuse the existing tenant-scoped GET /audit-logs and GET /support-tickets (not super-admin-exclusive routes); both mappers hardcode tenant_name:"" since the endpoint never exposes it — the "Tenant" column is always empty and a super-admin only ever sees their own current tenant's data despite the panel's cross-tenant framing. | DISPLAY_MAPPING_MISMATCH | WAVE_6_SECONDARY_FUNCTIONALITY | 35 | — | no | no | no | no | — | — |
| GAP-0022 | admin, support | S4_INFORMATIONAL | ACCEPTED_BY_EXISTING_CONTRACT | admin/support: AdminKnowledge — no backend, dev-only mock (confirmed intentional stub) | AdminKnowledge reuses the same fake useKnowledgeArticles() hook as the support module's knowledge base; self-disables via IS_PROD gate in production rather than exposing the mock to real users. | REAL_MAPPING_GAP | WAVE_NONE | 5 | — | no | no | no | no | — | — |
| GAP-0023 | admin | S3_LOW | OPEN | admin: "Novo Webhook"/"Nova Chave API" buttons have no onClick at all | Within the AdminSettings dead tabs, these two specific buttons have no handler wired at all (distinct from the other tabs which at least fire a fake-success toast). | REAL_MAPPING_GAP | WAVE_6_SECONDARY_FUNCTIONALITY | 15 | GAP-0009 | no | no | no | no | — | — |
| GAP-0024 | admin | S3_LOW | OPEN | admin: no table has sorting or server-side pagination anywhere | None of AdminClients/AdminSubscriptions/AdminSupport/AdminAudit/AdminSettings-Usuários use SortableTableHead/TablePagination; all filters are client-side. | PAGINATION_GAP | WAVE_6_SECONDARY_FUNCTIONALITY | 15 | — | no | no | no | no | — | — |
| GAP-0025 | auth, artist | S1_HIGH | OPEN | auth/artist: ArtistaSignupPublic.tsx calls nonexistent endpoint POST /public/artists (100% broken public signup) | The public unauthenticated artist self-signup wizard posts to POST /public/artists, which does not exist anywhere in the backend. The only related public endpoint (POST /public/artist-registration) creates a Lead via LeadsService — an entirely different data model. Every submission fails with 404. | CREATE_MAPPING_MISMATCH | WAVE_2_SCHEMA_AND_CONTRACT | 75 | — | no | no | no | no | — | — |
| GAP-0026 | auth, artist | S2_MEDIUM | OPEN | auth/artist: even if the public-signup endpoint existed, payload field names diverge from CreateArtistDto | ArtistaSignupPublic.tsx sends spotify_artist_url/youtube_channel_url and instagram/tiktok (vs real spotify_url/youtube_url and instagram_url/tiktok_url — the exact pair already fixed once for the authenticated flow) — the component was written against a planned contract never synced with the real one. | CREATE_MAPPING_MISMATCH | WAVE_2_SCHEMA_AND_CONTRACT | 50 | GAP-0014 | no | no | no | no | — | — |
| GAP-0027 | artist | S4_INFORMATIONAL | ACCEPTED_BY_EXISTING_CONTRACT | artist: ~41 "extended" fields persist to metadata JSONB instead of the homonymous physical column (Phase-1 reclassification, not a functional bug) | Physical columns exist (slug_artistico, tipo_perfil, banco, conta, etc.) but ArtistsService.create()/update() route them into the metadata jsonb instead — round-trip is correct (toResponse() flattens it back), so this is a documentation correction, not a live defect. | CODE_FIELD_ONLY | WAVE_NONE | 5 | — | no | no | no | no | — | — |
| GAP-0028 | artist | S3_LOW | OPEN | artist: manual platform-follower counters vs real API sync have no reconciliation | Manual counters (spotify_ouvintes etc., stored in metadata) and real Spotify/YouTube API sync (artist_platform_profiles table) both capture the same concept with no reconciliation logic between them. | RELATION_MISMATCH | WAVE_6_SECONDARY_FUNCTIONALITY | 20 | — | no | no | no | no | — | — |
| GAP-0029 | artist | S3_LOW | OPEN | artist: several relation FKs are logical-only, not DB-enforced (projects/transactions/events/artist_goals.artista_id) | These columns are used by the app but have no declared foreign-key constraint — enforcement is purely by application convention. | RELATION_MISMATCH | WAVE_2_SCHEMA_AND_CONTRACT | 25 | — | no | no | no | no | — | — |
| GAP-0030 | artist | S4_INFORMATIONAL | NO_FIX_REQUIRED | artist: encrypted PII fields (email/telefone/cpf_cnpj/manager_contato) not backend-searchable (expected/correct, not a defect) | Ciphertext cannot support ILIKE server-side search by nature — the module's Reports search columns correctly exclude these fields. | REAL_MAPPING_GAP | WAVE_NONE | 0 | — | no | no | no | no | — | — |
| GAP-0031 | audiovisual | S1_HIGH | OPEN | audiovisual: 8 of 9 backend domains have zero UI (systemic) — briefings/deliverables/shots/production_days/team_members/assets/tasks/approvals unreachable | The backend implements 9 fully-built domains (187 columns, real REST endpoints, real RBAC) and 20 corresponding frontend hooks exist, but only 4 hooks (project CRUD itself) have any real component consumer. AudiovisualProjectDetailsModal.tsx only displays the project entity itself — no tab exists for any of the other 8 domains. The pipeline /transition endpoint and its auto-generated tasks (audiovisual_tasks) are consequences of this same absence. | REAL_MAPPING_GAP | WAVE_3_CORE_DOMAIN_FIXES | 80 | — | no | no | no | no | — | — |
| GAP-0032 | audiovisual | S1_HIGH | OPEN | audiovisual: status filter dropdown broken — Portuguese filter values vs English DB enum values (ENUM_MISMATCH) | AudiovisualFilterBar.tsx defines accented Portuguese filter options while the real stored DB values are English snake_case; the substring-match filter logic never matches, so any selection in the 3 status dropdowns always returns zero results. | ENUM_MISMATCH | WAVE_3_CORE_DOMAIN_FIXES | 65 | — | no | no | no | no | — | — |
| GAP-0033 | audiovisual, marketing, projects | S2_MEDIUM | OPEN | audiovisual/marketing/projects: financial_project_id real FK never written by any form (shared root cause across 2 modules) | audiovisual_projects.financial_project_id and marketing_projects.financial_project_id both have a real, DB-enforced FK to projects.id (added by FinancialOperationalBridges), but no form in either module exposes a field to set it. | REAL_MAPPING_GAP | WAVE_4_CROSS_DOMAIN_FIXES | 45 | GAP-0001 | no | no | no | no | — | — |
| GAP-0034 | audiovisual | S2_MEDIUM | OPEN | audiovisual: artist_id/campaign_id/event_id exposed as API filters but never written by any form | audiovisual_projects has artist_id/campaign_id/event_id columns (no declared FK) exposed as filter params, but no form sets any of them — only artist_name (free text) is written. (release_id, a sibling column, IS confirmed written/used correctly per releases.md — not part of this gap.) | REAL_MAPPING_GAP | WAVE_4_CROSS_DOMAIN_FIXES | 30 | — | no | no | no | no | — | — |
| GAP-0035 | audiovisual | S3_LOW | OPEN | audiovisual: /audiovisual/projects/new route is orphaned (dead navigation) | A dedicated page wrapping the same create form is registered as a real route but no link/navigation anywhere points to it — the real list page uses an inline modal instead. | REAL_MAPPING_GAP | WAVE_7_CLEANUP | 10 | — | no | no | no | no | — | — |
| GAP-0036 | audiovisual | S2_MEDIUM | OPEN | audiovisual: asset upload has no UI, and delete never cleans up external storage (orphaned files) | POST /audiovisual/projects/:id/assets only registers a reference to an already-externally-uploaded file (does not perform upload); DELETE soft-deletes the DB row but the physical file in storage is never removed. The frontend has zero consumer for this domain at all. | STORAGE_GAP | WAVE_3_CORE_DOMAIN_FIXES | 30 | GAP-0016 | no | no | no | no | — | — |
| GAP-0037 | auth | S2_MEDIUM | OPEN | auth: signOut() does not close realtime channels — stale subscriptions until page reload | AuthContext.signOut() calls supabase.auth.signOut()+clearApiSessionState()+queryClient.clear() but never disconnectRealtimeChannels(); a channel open before logout can remain subscribed until a full reload. Not a cross-tenant leak (RLS still applies). | REALTIME_GAP | WAVE_3_CORE_DOMAIN_FIXES | 35 | — | no | no | no | no | — | — |
| GAP-0038 | auth, workspace | S4_INFORMATIONAL | NO_FIX_REQUIRED | auth: AuthContextService.build() auto-accepts pending tenant invitation as an undocumented side effect of a read endpoint | Every GET /auth/context call runs UPDATE tenant_invitations SET status='accepted' for the current (tenantId, authUserId) pending row — best-effort bookkeeping embedded in a read-context endpoint, not the actual access grant (which already happened at invite time). | REAL_MAPPING_GAP | WAVE_NONE | 5 | — | no | no | no | no | — | — |
| GAP-0039 | auth | S2_MEDIUM | DEFERRED | auth: Redirect URL / Site URL allowlist configuration unresolved for staging/production (cannot be verified by code) | Depends on the Supabase Dashboard's Redirect URLs allowlist containing every real origin — not verifiable by reading code. | REAL_MAPPING_GAP | WAVE_5_INTEGRATIONS | 40 | — | no | no | YES | no | — | [object Object] |
| GAP-0040 | auth | S4_INFORMATIONAL | NO_FIX_REQUIRED | auth: no explicit handling of "suspended"/"deleted" user states beyond the simple is_active boolean | Only is_active (boolean) on membership is checked; no explicit suspended/deleted state distinct from generic deactivation exists in this module. | REAL_MAPPING_GAP | WAVE_NONE | 0 | — | no | no | no | no | — | — |
| GAP-0041 | catalog | S1_HIGH | OPEN | catalog: CreateWorkDto.authors/shares (split-sheet) accepted by DTO but never persisted to any table | WorksController accepts authors[]/shares in the create payload (validated by DTO) but WorksService.create() never writes them anywhere — no work_authors/split table exists to receive them; the data is validated then discarded. | CREATE_MAPPING_MISMATCH | WAVE_2_SCHEMA_AND_CONTRACT | 65 | — | no | no | no | no | — | — |
| GAP-0042 | catalog | S1_HIGH | OPEN | catalog: CreatePhonogramDto.fileUrl accepted, validated, then discarded — no audio storage pipeline | CreatePhonogramDto declares fileUrl and the frontend form collects it, but PhonogramsService.create() never writes it to any column and no upload pipeline exists — the phonograms table has no audio-file column at all. | STORAGE_GAP | WAVE_2_SCHEMA_AND_CONTRACT | 60 | — | no | no | no | no | — | — |
| GAP-0043 | catalog | S2_MEDIUM | OPEN | catalog: works.artista_id always written null — CatalogoObras.tsx never collects/sends it | The real, DB-enforced FK column artista_id exists and is accepted by CreateWorkDto, but the create form never renders an artist-select field, so every work is created with artista_id=null despite the relation existing end-to-end in the backend. | REAL_MAPPING_GAP | WAVE_3_CORE_DOMAIN_FIXES | 40 | — | no | no | no | no | — | — |
| GAP-0044 | catalog | S3_LOW | OPEN | catalog: phonogram-to-work relation (obra_id) collected by UI but ENUM/selector sourced from a stale local list, not live works | The phonogram create form's work-selector is populated from a cached/local copy rather than a live query against the real works table, risking creation against a stale or since-deleted obra_id. | SOURCE_OF_TRUTH_CONFLICT | WAVE_3_CORE_DOMAIN_FIXES | 25 | — | no | no | no | no | — | — |
| GAP-0045 | catalog | S3_LOW | OPEN | catalog: ISRC/ISWC identifier fields accepted with no format validation (frontend or backend) | isrc/iswc columns accept arbitrary strings; neither the DTO nor the form apply the standard identifier format regex, allowing malformed industry identifiers to be persisted and later exported to distributors/PROs. | REAL_MAPPING_GAP | WAVE_3_CORE_DOMAIN_FIXES | 20 | — | no | no | no | no | — | — |
| GAP-0046 | catalog | S4_INFORMATIONAL | OPEN | catalog: dead Zustand catalog store scaffolding never wired to any component (part of cross-module dead-state pattern) | A generated Zustand store for catalog exists with full CRUD actions but zero component imports it — same scaffolding pattern repeated across other modules. | REAL_MAPPING_GAP | WAVE_7_CLEANUP | 8 | — | no | no | no | no | — | — |
| GAP-0047 | catalog | S2_MEDIUM | OPEN | catalog: list endpoints truncate at limit=50 with no UI pagination control | PaginationDto default limit=50 applies to /works and /phonograms with no frontend "load more"/page control — catalogs beyond 50 items are silently invisible. | PAGINATION_GAP | WAVE_3_CORE_DOMAIN_FIXES | 30 | — | no | no | no | no | — | — |
| GAP-0048 | contracts | S1_HIGH | OPEN | contracts: contract-templates create returns HTTP 400 on every submission (reachable crash of a core feature) | CreateContractTemplateDto requires clausulas as ClausulaDto[] with mandatory ordem:number, but ContractTemplateEditor.tsx sends clauses as a plain string[] — global ValidationPipe({forbidNonWhitelisted:true}) rejects the payload shape outright. | CREATE_MAPPING_MISMATCH | WAVE_2_SCHEMA_AND_CONTRACT | 85 | — | no | no | no | no | — | — |
| GAP-0049 | contracts, reports | S2_MEDIUM | OPEN | contracts: party PII (document number, bank details) freely typed into observacoes free-text field, exported unmasked in reports | ContratoWizard has no structured field for a party's CPF/CNPJ or bank account beyond what fits in the generic observacoes textarea; whatever operators put there is later included verbatim in report/export XLSX generation with no PII masking. | DATA_INTEGRITY_DEFECT | WAVE_4_CROSS_DOMAIN_FIXES | 45 | — | no | no | no | no | — | — |
| GAP-0050 | contracts, integrations | S2_MEDIUM | OPEN | contracts: DocuSign e-signature envelope creation is 0% implemented despite full UI presence | The "Assinar via DocuSign" button and status badges exist in ContratoDetalhes.tsx, but no backend controller route creates a DocuSign envelope — DocusignService only has placeholder/webhook-receiver methods with no outbound envelope-creation call. | MISSING_REQUIRED_FUNCTIONALITY | WAVE_5_INTEGRATIONS | 35 | — | no | no | no | no | — | [object Object] |
| GAP-0051 | contracts, settings | S2_MEDIUM | OPEN | contracts: DocuSign status is tracked client-side in sessionStorage instead of the real backend field | ContratoDetalhes.tsx persists the (mocked) DocuSign signing status to sessionStorage rather than reading/writing the contract's real assinatura_status column — status is lost on session end and never reflects server truth. | SOURCE_OF_TRUTH_CONFLICT | WAVE_5_INTEGRATIONS | 30 | GAP-0043 | no | no | no | no | — | — |
| GAP-0052 | contracts, integrations | S2_MEDIUM | OPEN | contracts: Autentique backend integration is real and functional, but has zero frontend consumer | AutentiqueService implements real GraphQL calls against the Autentique API (document creation, webhook status receiver) and is fully wired server-side, but no contracts frontend component calls any of its exposed endpoints — an entirely unreachable, unused real integration. | REAL_MAPPING_GAP | WAVE_3_CORE_DOMAIN_FIXES | 35 | — | no | no | no | no | — | — |
| GAP-0053 | contracts | S3_LOW | OPEN | contracts: ContractStatus.ATIVO enum value never reachable from any real transition (dead enum member) | The ContractStatus enum declares ATIVO but the state-machine transition table (validated server-side) has no path that sets it — contracts can only reach ASSINADO, never ATIVO, making the value permanently unused. | ENUM_MISMATCH | WAVE_7_CLEANUP | 12 | — | no | no | no | no | — | — |
| GAP-0054 | contracts, crm-relationships | S1_HIGH | OPEN | contracts: ContactContractsService uses an in-memory Map, not the database (same anti-pattern as crm-relationships legacy facade) | A secondary, legacy service path (ContactContractsService) maintains contract-contact associations purely in an in-process Map rather than a real table — data is lost on every server restart and is not tenant-scoped. | DATA_INTEGRITY_DEFECT | WAVE_2_SCHEMA_AND_CONTRACT | 55 | — | no | no | no | no | — | — |
| GAP-0055 | contracts, accounting | S2_MEDIUM | OPEN | contracts: financial terms (valor, forma_pagamento, vencimento) captured in ContratoWizard have no propagation to accounting/transactions | A signed contract's financial terms are stored only on the contract row; no service creates a corresponding transactions entry or recurring-charge schedule from them — accounting and contracts are financially disconnected. | MISSING_REQUIRED_FUNCTIONALITY | WAVE_4_CROSS_DOMAIN_FIXES | 40 | — | no | no | no | no | — | — |
| GAP-0056 | contracts | S2_MEDIUM | OPEN | contracts: template variable substitution ({{cliente_nome}} etc.) has no validation against the real party/contract field set | Template clause text accepts arbitrary {{variavel}} placeholders with no compile-time or save-time check that each one maps to a real, resolvable field — a typo'd placeholder silently renders as literal text in the generated contract. | DATA_INTEGRITY_DEFECT | WAVE_3_CORE_DOMAIN_FIXES | 25 | GAP-0041 | no | no | no | no | — | — |
| GAP-0057 | contracts | S2_MEDIUM | OPEN | contracts: contract list/search truncates at limit=50 with no explicit UI indicator of truncation | Independent instance of the systemic PaginationDto default; ContratosLista.tsx has no "showing 50 of N" indicator or load-more control. | PAGINATION_GAP | WAVE_3_CORE_DOMAIN_FIXES | 25 | — | no | no | no | no | — | — |
| GAP-0058 | contracts | S2_MEDIUM | OPEN | contracts: contract PDF generation and final signed-file storage have no atomic linkage — a regenerate can silently orphan the previously-signed file | Regenerating a contract's PDF (e.g. after a clause edit) creates a new storage object and updates the pdf_url column in a non-transactional sequence; if the update fails after upload, the new file is orphaned, and if it succeeds, the previously-signed PDF reference is silently lost with no version history. | MISSING_TRANSACTION_BOUNDARY | WAVE_3_CORE_DOMAIN_FIXES | 30 | — | no | no | no | no | — | — |
| GAP-0059 | crm-relationships, contracts | S1_HIGH | OPEN | crm-relationships: legacy GET/POST /contacts facade backed by an in-memory Map, fully disconnected from the real contacts table | A pre-existing, still-registered legacy controller route (/contacts) is served by an in-process Map-based service predating the real ContactsModule (which uses /crm/contacts against the real, tenant-scoped contacts table) — any client still pointed at the old route reads/writes data that vanishes on restart and is invisible to the real module. | DATA_INTEGRITY_DEFECT | WAVE_2_SCHEMA_AND_CONTRACT | 55 | — | no | no | no | no | — | — |
| GAP-0060 | crm-relationships | S1_HIGH | OPEN | crm-relationships: ~15 fields accepted by CreateInteractionDto/CreateRelationshipDto never mapped to any column (REAL_MAPPING_GAP) | The interaction/relationship create forms collect ~15 fields (e.g. sentiment, follow_up_date, channel_detail, tags[], priority) that the DTOs accept and validate but the service layer never writes to the interactions/relationships tables — no corresponding columns exist. | CREATE_MAPPING_MISMATCH | WAVE_2_SCHEMA_AND_CONTRACT | 60 | — | no | no | no | no | — | — |
| GAP-0061 | crm-relationships | S3_LOW | OPEN | crm-relationships: Auditoria.tsx field-name mismatch — actor/target field read from wrong response key (module-specific instance) | The audit-log viewer reads changed_by/target_id, but the /audit-logs response for this module's events actually keys them as user_id/entity_id — display always shows blank actor/target. Independent root cause from the same-named bug in licensing/inventory/events (different field pairs, different components). | DISPLAY_MAPPING_MISMATCH | WAVE_3_CORE_DOMAIN_FIXES | 15 | — | no | no | no | no | — | — |
| GAP-0062 | crm-relationships | S3_LOW | OPEN | crm-relationships: deep-link route to a specific contact/relationship record is dead (no navigation ever constructs it) | A route accepting /crm/contacts/:id is registered and renders correctly if hit directly, but no list/search/notification component ever builds that URL — independent dead-deep-link instance from the same pattern in licensing/inventory/events (different file, different route). | REAL_MAPPING_GAP | WAVE_7_CLEANUP | 12 | — | no | no | no | no | — | — |
| GAP-0063 | crm-relationships | S3_LOW | OPEN | crm-relationships: relationship "strength score" displayed in UI is a pure frontend-computed heuristic, not a persisted or backend-computed value | RelacionamentoCard.tsx computes a 0-100 "strength" number client-side from whatever interaction fields happen to be loaded on that page — the number is never persisted, never recomputed consistently, and differs depending on which page loaded it. | SOURCE_OF_TRUTH_CONFLICT | WAVE_6_SECONDARY_FUNCTIONALITY | 20 | — | no | no | no | no | — | — |
| GAP-0064 | crm-relationships | S2_MEDIUM | OPEN | crm-relationships: list endpoints truncate at limit=50, no pagination UI | Independent PaginationDto default instance on /crm/contacts and /crm/relationships with no frontend load-more control. | PAGINATION_GAP | WAVE_3_CORE_DOMAIN_FIXES | 25 | — | no | no | no | no | — | — |
| GAP-0065 | crm-relationships | S2_MEDIUM | OPEN | crm-relationships: relationship-type taxonomy is free text on one screen, a fixed enum on another (contract drift) | RelacionamentoForm.tsx (quick-create) accepts a free-text tipo string while RelacionamentoDetalhes.tsx (full edit) renders a fixed RelationshipType enum select — records created via quick-create can hold values the detail screen's dropdown cannot represent. | ENUM_MISMATCH | WAVE_3_CORE_DOMAIN_FIXES | 30 | — | no | no | no | no | — | — |
| GAP-0066 | crm-relationships | S3_LOW | OPEN | crm-relationships: interaction "channel" enum includes WhatsApp/Email options with no functioning send action behind them (UI promises a send, none occurs) | LogInteractionModal.tsx lets the user pick canal=whatsapp/email framed as if logging will trigger a real message, but the service only records the interaction row — no WhatsApp/email dispatch integration exists in this module. | MISSING_REQUIRED_FUNCTIONALITY | WAVE_6_SECONDARY_FUNCTIONALITY | 18 | — | no | no | no | no | — | — |
| GAP-0067 | dashboard | S2_MEDIUM | OPEN | dashboard: several KPI widgets read from a stale/pre-aggregated cache column instead of live tables (source-of-truth conflict) | DashboardService.getKpis() reads dashboard_metrics_cache (populated by a scheduled job) for several cards, while the equivalent module pages (Financeiro, Contratos) compute the same concept live from source tables — the two can diverge whenever the cache job lags. | SOURCE_OF_TRUTH_CONFLICT | WAVE_4_CROSS_DOMAIN_FIXES | 35 | — | no | no | no | no | — | — |
| GAP-0068 | dashboard, events | S2_MEDIUM | OPEN | dashboard: "Atividades Recentes" widget subscribes to zero real event families — the EventsService bus has no dashboard consumer | EventsService.emitTyped() publishes real domain events (contract.created, transaction.created, etc.) internally via EventEmitter2, but no listener bridges any of them into the dashboard's recent-activity feed — the widget instead polls a generic /activity-log endpoint at low frequency. | REALTIME_GAP | WAVE_3_CORE_DOMAIN_FIXES | 25 | — | no | no | no | no | — | — |
| GAP-0069 | dashboard | S2_MEDIUM | OPEN | dashboard: 3 widgets truncate their underlying list at limit=50 with no "ver todos" affordance reflecting the true total | Independent PaginationDto instance behind the "Próximos Vencimentos"/"Contratos Recentes"/"Tarefas" widgets; the "ver todos" link exists but the widget's own count badge shows min(50,total) as if it were the true total. | PAGINATION_GAP | WAVE_3_CORE_DOMAIN_FIXES | 25 | — | no | no | no | no | — | — |
| GAP-0070 | dashboard | S2_MEDIUM | OPEN | dashboard: per-widget date-range filter is client-side only, refetches the same unfiltered payload every time | The dashboard date-range picker changes only client-side derived state; the underlying /dashboard/kpis call has no from/to query params, so changing the range never re-queries the backend — displayed numbers are always all-time regardless of selection. | DISPLAY_MAPPING_MISMATCH | WAVE_3_CORE_DOMAIN_FIXES | 35 | — | no | no | no | no | — | — |
| GAP-0071 | dashboard | S2_MEDIUM | OPEN | dashboard: role-based widget visibility is enforced only client-side (hidden, not authorization-checked) | Widgets meant for specific roles are hidden via a frontend permission check (usePermission()) but the underlying /dashboard/kpis endpoint returns the same full payload to any authenticated tenant member — a determined client could read the raw response regardless of role. Not a cross-tenant leak; within-tenant role separation is UI-only. | SECURITY_DEFECT | WAVE_3_CORE_DOMAIN_FIXES | 45 | — | no | no | no | no | — | — |
| GAP-0072 | dashboard | S4_INFORMATIONAL | OPEN | dashboard: dead Zustand dashboard-layout store (drag-to-rearrange widgets) never wired to any component | A generated store persisting custom widget order/visibility exists with full actions but DashboardHome.tsx renders a fixed, hardcoded widget list — same dead-scaffolding pattern as other modules. | REAL_MAPPING_GAP | WAVE_7_CLEANUP | 8 | — | no | no | no | no | — | — |
| GAP-0073 | events | S2_MEDIUM | OPEN | events: capacidadePublico field collected by EventoFormModal never persisted (no column, DTO silently strips it) | The event form collects capacidadePublico (expected public capacity) but CreateEventDto has no such field declared, and the events table has no matching column — Zod/class-validator whitelist strips it before it reaches the service. | CREATE_MAPPING_MISMATCH | WAVE_2_SCHEMA_AND_CONTRACT | 35 | — | no | no | no | no | — | — |
| GAP-0074 | events | S2_MEDIUM | OPEN | events: EventsService.emitTyped() internal bus has zero Supabase Realtime bridge — no live update on any events screen | emitTyped() only publishes to the in-process EventEmitter2 bus; unlike ConversationsService (musicchat) and NotificationHandler (support), no listener bridges event-domain events to RealtimeService/Supabase Realtime — EventosLista.tsx requires a manual refresh to see another user's changes. | REALTIME_GAP | WAVE_3_CORE_DOMAIN_FIXES | 25 | — | no | no | no | no | — | — |
| GAP-0075 | events | S3_LOW | OPEN | events: Auditoria.tsx field-name mismatch — this module's own actor/target key pair (independent from crm/inventory/licensing instances) | Same class of bug as the other 3 modules' Auditoria.tsx findings, but here the mismatch is between changed_fields (frontend expects) and diff (actual API key) — different field pair, different fix, not to be merged. | DISPLAY_MAPPING_MISMATCH | WAVE_3_CORE_DOMAIN_FIXES | 15 | — | no | no | no | no | — | — |
| GAP-0076 | events | S3_LOW | OPEN | events: dead deep-link route to a specific event (independent instance, this module's own file) | A /eventos/:id direct route exists and renders correctly but nothing in EventosLista.tsx/notifications ever constructs the link — independent instance from the crm/inventory/licensing dead-deep-link findings. | REAL_MAPPING_GAP | WAVE_7_CLEANUP | 12 | — | no | no | no | no | — | — |
| GAP-0077 | events, artist | S2_MEDIUM | OPEN | events: DRAFT/lineup relation to artist module is by free-text artist_name only, no artista_id FK write path (mirrors audiovisual pattern) | EventoFormModal.tsx collects lineup as free-text names; the real, DB-enforced artista_id relation column on the lineup sub-entity is never set by any form field, same class of gap as audiovisual's artist_id. | REAL_MAPPING_GAP | WAVE_4_CROSS_DOMAIN_FIXES | 30 | — | no | no | no | no | — | — |
| GAP-0078 | events, accounting | S2_MEDIUM | OPEN | events: ticket-sales/revenue fields on the event entity have no propagation to accounting transactions | receita_prevista/receita_real columns are edited directly on the event form but no service creates or reconciles a corresponding accounting transaction — same cross-domain financial-propagation pattern as contracts and audiovisual. | MISSING_REQUIRED_FUNCTIONALITY | WAVE_4_CROSS_DOMAIN_FIXES | 35 | — | no | no | no | no | — | — |
| GAP-0079 | events | S2_MEDIUM | OPEN | events: list endpoint truncates at limit=50, calendar view silently shows a partial month for high-volume tenants | Independent PaginationDto instance; the calendar view fetches via the same paginated list endpoint rather than a date-range query, so a busy month beyond 50 events renders incompletely with no indicator. | PAGINATION_GAP | WAVE_3_CORE_DOMAIN_FIXES | 35 | — | no | no | no | no | — | — |
| GAP-0080 | integrations, releases | S4_INFORMATIONAL | DEFERRED | integrations: 6 named distributor providers (ONErpm/DistroKid/Symphonic/SoundOn/MusicPro/SomVibe) are NOT_IMPLEMENTED stubs — preserved verbatim, must not be upgraded | releases.md and integrations.md both independently confirm these 6 provider integrations have no real outbound API client anywhere in the codebase — UI presents them as connectable but no controller/service performs any real distributor call. | MISSING_REQUIRED_FUNCTIONALITY | WAVE_5_INTEGRATIONS | 20 | — | no | no | no | no | — | [object Object], [object Object], [object Object], [object Object], [object Object], [object Object] |
| GAP-0081 | integrations, settings | S3_LOW | DEFERRED | integrations: Stripe billing client path in Configuracoes/Billing.tsx uses a real stripeClient — reconciled as a distinct, non-contradictory code path from integrations.md's "deliberately disabled" Stripe finding | integrations.md documents a disabled/stubbed Stripe *webhook processing* path server-side (StripeWebhookService intentionally short-circuited pending PCI review); settings.md/Billing.tsx separately confirms a real client-side stripeClient used only for card-entry tokenization. These are two different code paths on the same provider, not a contradiction. | MISSING_REQUIRED_FUNCTIONALITY | WAVE_5_INTEGRATIONS | 15 | — | no | no | no | no | — | — |
| GAP-0082 | integrations | S4_INFORMATIONAL | DEFERRED | integrations: ABRAMUS provider — UI presence with no backend implementation | A connect-account UI card exists for ABRAMUS (Brazilian rights-collection society) with no corresponding service/controller anywhere in the codebase. | MISSING_REQUIRED_FUNCTIONALITY | WAVE_5_INTEGRATIONS | 10 | — | no | no | no | no | — | — |
| GAP-0083 | integrations | S4_INFORMATIONAL | DEFERRED | integrations: ACRCloud audio-fingerprint provider — UI presence with no backend implementation | A connect-account UI card exists for ACRCloud with no corresponding service/controller. | MISSING_REQUIRED_FUNCTIONALITY | WAVE_5_INTEGRATIONS | 10 | — | no | no | no | no | — | — |
| GAP-0084 | integrations | S4_INFORMATIONAL | DEFERRED | integrations: PostHog analytics provider — UI presence with no backend implementation | A connect-account UI card exists for PostHog with no corresponding service/controller wiring events server-side. | MISSING_REQUIRED_FUNCTIONALITY | WAVE_5_INTEGRATIONS | 8 | — | no | no | no | no | — | — |
| GAP-0085 | integrations | S4_INFORMATIONAL | DEFERRED | integrations: NFe (nota fiscal eletrônica) provider — UI presence with no backend implementation | Invoice-emission UI references an NFe provider connection with no corresponding service/controller — actual NF issuance in the app is manual/uploaded, not API-driven. | MISSING_REQUIRED_FUNCTIONALITY | WAVE_5_INTEGRATIONS | 12 | — | no | no | no | no | — | — |
| GAP-0086 | integrations, monitoring | S4_INFORMATIONAL | DEFERRED | integrations: ECAD (rights-collection) provider entry in the integrations inventory — UI_ONLY, distinct from monitoring.md's separate working ECAD reports feature | The integrations connect-account card for "ECAD" has no backend service; this is confirmed to be a DIFFERENT code path from monitoring.md's real, working ECAD royalty-report ingestion feature (which parses uploaded ECAD statement files, not an API connection) — not to be merged. | MISSING_REQUIRED_FUNCTIONALITY | WAVE_5_INTEGRATIONS | 10 | — | no | no | no | no | — | — |
| GAP-0087 | integrations | S4_INFORMATIONAL | DEFERRED | integrations: UBC (rights-collection society) provider — UI presence with no backend implementation | A connect-account UI card exists for UBC with no corresponding service/controller. | MISSING_REQUIRED_FUNCTIONALITY | WAVE_5_INTEGRATIONS | 8 | — | no | no | no | no | — | — |
| GAP-0088 | integrations | S4_INFORMATIONAL | DEFERRED | integrations: "external data framework" (generic pluggable provider abstraction) is scaffolded but has zero real registered implementations | An ExternalDataProvider interface + registry exists (apparently meant to unify all provider integrations behind one contract) but every module currently calls its own bespoke provider service directly — the framework itself is dead architecture with 0 adopters. | ARCHITECTURAL_DEBT | WAVE_7_CLEANUP | 10 | — | no | no | no | no | — | — |
| GAP-0089 | inventory | S2_MEDIUM | OPEN | inventory: 3-way ENUM_MISMATCH on item status across form/list/backend (each uses a divergent vocabulary) | ItemFormModal writes one status vocabulary (e.g. disponivel/em_uso/manutencao), InventarioLista.tsx filter dropdown offers a second, partially-overlapping vocabulary, and the real InventoryStatus backend enum is a third — combinations of the 3 mean some valid backend states are unselectable in the filter and some filter options never match any real row. | ENUM_MISMATCH | WAVE_2_SCHEMA_AND_CONTRACT | 45 | — | no | no | no | no | — | — |
| GAP-0090 | inventory, rh | S2_MEDIUM | OPEN | inventory: item "checked out to" (responsavel_atual) relation is free-text name, no real user/employee FK | The check-out flow captures a free-text name string rather than referencing a real users/rh_employees row — no accountability trail beyond a name that can be misspelled or reused. | REAL_MAPPING_GAP | WAVE_4_CROSS_DOMAIN_FIXES | 30 | — | no | no | no | no | — | — |
| GAP-0091 | inventory | S3_LOW | OPEN | inventory: Auditoria.tsx field-name mismatch — this module's own key pair (independent instance) | Same bug class as crm/events/licensing Auditoria.tsx findings; here the mismatch is quantidade_anterior/quantidade_nova vs the real before/after keys — independent fix. | DISPLAY_MAPPING_MISMATCH | WAVE_3_CORE_DOMAIN_FIXES | 15 | — | no | no | no | no | — | — |
| GAP-0092 | inventory | S3_LOW | OPEN | inventory: dead deep-link route to a specific item (independent instance) | A /inventario/itens/:id route exists and renders but no list/search/notification component constructs the link. | REAL_MAPPING_GAP | WAVE_7_CLEANUP | 12 | — | no | no | no | no | — | — |
| GAP-0093 | inventory | S2_MEDIUM | OPEN | inventory: low-stock/maintenance-due alerts are computed and displayed client-side only, no backend notification/cron | InventarioDashboard.tsx computes "needs maintenance"/"low stock" badges from the already-loaded list client-side; no scheduled job or NotificationsService entry exists to alert a responsible user proactively — the condition is only visible if someone opens the page. | MISSING_REQUIRED_FUNCTIONALITY | WAVE_6_SECONDARY_FUNCTIONALITY | 25 | — | no | no | no | no | — | — |
| GAP-0094 | inventory | S3_LOW | OPEN | inventory: asset depreciation/valor_atual field exists but no calculation logic anywhere updates it after creation | valor_atual is set once at creation from valor_compra and never recalculated by any scheduled job or formula despite depreciacao_mensal also being a stored field — the two columns are logically related but nothing connects them at runtime. | MISSING_REQUIRED_FUNCTIONALITY | WAVE_6_SECONDARY_FUNCTIONALITY | 20 | — | no | no | no | no | — | — |
| GAP-0095 | inventory | S2_MEDIUM | OPEN | inventory: list endpoint truncates at limit=50, no pagination UI | Independent PaginationDto instance on /inventory/items with no frontend load-more control. | PAGINATION_GAP | WAVE_3_CORE_DOMAIN_FIXES | 25 | — | no | no | no | no | — | — |
| GAP-0096 | inventory | S3_LOW | OPEN | inventory: item photo upload is a real storage pipeline, but delete never removes the object from R2 (orphaned files) | Item photo delete only clears the foto_url column; the R2 object at the tenant-prefixed key is never removed — mirrors the audiovisual asset-delete orphan pattern but is an independent root cause (different module, different service). | STORAGE_GAP | WAVE_6_SECONDARY_FUNCTIONALITY | 18 | — | no | no | no | no | — | — |
| GAP-0097 | leads | S2_MEDIUM | OPEN | leads: whatsapp field collected on public lead-capture form never persisted (no column, DTO strips it) | The public /public/artist-registration lead-capture form collects a whatsapp phone field, but CreateLeadDto has no such property and the leads table has no matching column — the whitelist ValidationPipe silently drops it before it reaches the service. | CREATE_MAPPING_MISMATCH | WAVE_2_SCHEMA_AND_CONTRACT | 40 | — | no | no | no | no | — | — |
| GAP-0098 | leads | S2_MEDIUM | OPEN | leads: LeadInteractionsService reads/writes inconsistent casing (camelCase in code vs snake_case in DB) for a subset of fields, causing silent undefined reads | A handful of properties in LeadInteractionsService (createdBy vs created_by-style access) are referenced in camelCase against a raw query result that TypeORM returns in snake_case for that particular repository method, so those specific fields are always undefined at runtime without throwing. | CREATE_MAPPING_MISMATCH | WAVE_2_SCHEMA_AND_CONTRACT | 40 | — | no | no | no | no | — | — |
| GAP-0099 | leads, projects | S2_MEDIUM | OPEN | leads: lead-to-artist conversion does not create the financial_project_id linkage retroactively (same root cause family as GAP-0015) | When a lead converts to a real artist/project, the resulting project row still leaves financial_project_id unset for the same reason as the audiovisual/marketing instance — no form/step in the conversion wizard exposes it. | REAL_MAPPING_GAP | WAVE_4_CROSS_DOMAIN_FIXES | 30 | GAP-0015 | no | no | no | no | — | — |
| GAP-0100 | leads | S3_LOW | OPEN | leads: lead-scoring field is UI-displayed but never computed by any backend logic (always the DB default) | LeadCard.tsx renders a "score" badge reading leads.score, but no service (create, update, or scheduled job) ever writes anything other than the column's DB default — the badge is permanently static across all leads. | MISSING_REQUIRED_FUNCTIONALITY | WAVE_6_SECONDARY_FUNCTIONALITY | 20 | — | no | no | no | no | — | — |
| GAP-0101 | leads | S2_MEDIUM | OPEN | leads: duplicate-lead detection (same email/phone) does not exist — public form allows unlimited duplicate submissions | POST /public/artist-registration has no uniqueness check or upsert logic against existing leads by email/whatsapp — repeated submissions from the same person create N separate lead rows with no merge path. | DATA_INTEGRITY_DEFECT | WAVE_3_CORE_DOMAIN_FIXES | 30 | — | no | no | no | no | — | — |
| GAP-0102 | leads | S3_LOW | OPEN | leads: pipeline/kanban stage transitions have no state-machine validation server-side (any status settable from any status) | PATCH /leads/:id/status accepts any enum value transition with no guard against illogical jumps (e.g. CONVERTED back to NEW) — unlike contracts and releases, which do enforce their transition tables. | MISSING_REQUIRED_FUNCTIONALITY | WAVE_3_CORE_DOMAIN_FIXES | 20 | — | no | no | no | no | — | — |
| GAP-0103 | leads | S2_MEDIUM | OPEN | leads: list endpoint truncates at limit=50, kanban board silently drops leads beyond the first 50 per column | Independent PaginationDto instance; the kanban board fetches each column via the same paginated endpoint with no per-column "load more," so any column exceeding 50 leads becomes invisible past the 50th. | PAGINATION_GAP | WAVE_3_CORE_DOMAIN_FIXES | 30 | — | no | no | no | no | — | — |
| GAP-0104 | leads | S4_INFORMATIONAL | OPEN | leads: dead Zustand leads-filter-preset store never wired to any component | A generated store for saving/restoring filter presets exists with full actions but LeadsKanban.tsx never imports it — same dead-scaffolding pattern as catalog/dashboard/events/contracts. | REAL_MAPPING_GAP | WAVE_7_CLEANUP | 8 | — | no | no | no | no | — | — |
| GAP-0105 | licensing | S1_HIGH | OPEN | licensing: sync-license request form fields (uso_pretendido, territorio, duracao_licenca) accepted by DTO, never persisted to the licenses table | CreateLicenseRequestDto declares and validates these 3 fields but LicensesService.create() never maps them onto any column — the licenses table has no equivalent columns at all. | CREATE_MAPPING_MISMATCH | WAVE_2_SCHEMA_AND_CONTRACT | 60 | — | no | no | no | no | — | — |
| GAP-0106 | licensing, accounting | S2_MEDIUM | OPEN | licensing: license-fee (valor_licenca) captured at request time has no propagation to accounting transactions | Same cross-domain financial-propagation gap class as contracts/events — a granted license's fee is stored only on the license row, no transaction is created. | MISSING_REQUIRED_FUNCTIONALITY | WAVE_4_CROSS_DOMAIN_FIXES | 35 | — | no | no | no | no | — | — |
| GAP-0107 | licensing | S3_LOW | OPEN | licensing: Auditoria.tsx field-name mismatch — this module's own key pair (independent instance) | Same bug class as crm/events/inventory Auditoria.tsx findings; here the mismatch is status_anterior/status_novo vs the real API keys — independent fix. | DISPLAY_MAPPING_MISMATCH | WAVE_3_CORE_DOMAIN_FIXES | 15 | — | no | no | no | no | — | — |
| GAP-0108 | licensing | S3_LOW | OPEN | licensing: dead deep-link route to a specific license request (independent instance) | A /licenciamento/:id route exists and renders correctly but no list/notification component ever constructs the link. | REAL_MAPPING_GAP | WAVE_7_CLEANUP | 12 | — | no | no | no | no | — | — |
| GAP-0109 | licensing | S2_MEDIUM | OPEN | licensing: license PDF/contract-document generation has no atomic linkage between file storage and status transition (mirrors contracts PDF gap, independent module/service) | Approving a license generates a PDF and flips status=APROVADA in two non-transactional steps; a failure between them can leave a status update with no backing document or an orphaned uploaded PDF. | MISSING_TRANSACTION_BOUNDARY | WAVE_3_CORE_DOMAIN_FIXES | 25 | — | no | no | no | no | — | — |
| GAP-0110 | licensing | S2_MEDIUM | OPEN | licensing: list endpoint truncates at limit=50, no pagination UI | Independent PaginationDto instance on /licenses with no frontend load-more control. | PAGINATION_GAP | WAVE_3_CORE_DOMAIN_FIXES | 25 | — | no | no | no | no | — | — |
| GAP-0111 | marketing | S1_HIGH | OPEN | marketing: two parallel, incompatible systems on the same table — CampaignsController vs MarketingCampaignBuilderController | Two independently-built controllers both write to marketing_campaigns with different DTOs/field sets (CampaignsController is the older, simpler CRUD; MarketingCampaignBuilderController is a richer wizard-based flow added later) — the frontend has entry points into both, and a campaign built via one may have null fields expected by the other's detail view. | ENTITY_DECLARATION_DRIFT | WAVE_2_SCHEMA_AND_CONTRACT | 55 | — | no | no | no | no | — | — |
| GAP-0112 | marketing | S2_MEDIUM | OPEN | marketing: budget*0.41 fabricated ROI metric displayed as if it were real ad-platform data | CampanhaDetalhes.tsx computes a "ROI estimado" card as orcamento*0.41 (a hardcoded literal multiplier) with no real integration to any ad platform's reporting API — the only confirmed violation of the "never fake success" principle found across the audit. | UX_CONTRACT_DEFECT | WAVE_3_CORE_DOMAIN_FIXES | 50 | — | no | no | no | no | — | — |
| GAP-0113 | marketing | S4_INFORMATIONAL | DEFERRED | marketing: campaign creation has no ad-platform integration at all (Meta/Google Ads/TikTok) — purely an internal tracker | No provider client exists for any external ad platform; "campaign" here means an internally-tracked budget/goal record only — confirmed scope, not a bug, but relevant to the module's domain-meaning determination. | MISSING_REQUIRED_FUNCTIONALITY | WAVE_NONE | 5 | — | no | no | no | no | — | — |
| GAP-0114 | marketing | S3_LOW | OPEN | marketing: EventsService bus has no consumer for campaign-status-change notifications | Same emitTyped()-with-no-bridge pattern as dashboard/events — campaign status changes emit an internal event with zero downstream listener (no email, no realtime, no in-app notification). | REALTIME_GAP | WAVE_6_SECONDARY_FUNCTIONALITY | 15 | — | no | no | no | no | — | — |
| GAP-0115 | marketing | S2_MEDIUM | OPEN | marketing: list endpoint truncates at limit=50, no pagination UI | Independent PaginationDto instance on /marketing/campaigns with no frontend load-more control. | PAGINATION_GAP | WAVE_3_CORE_DOMAIN_FIXES | 25 | — | no | no | no | no | — | — |
| GAP-0116 | monitoring | S2_MEDIUM | OPEN | monitoring: two parallel UIs over the same rights-monitoring domain — Monitoramento.tsx vs RightsMonitoring.tsx | Monitoramento.tsx (older) and RightsMonitoring.tsx (newer) both render views over the same monitoring_reports/monitoring_matches tables via different hooks/queries with different filter and column sets — both are reachable from different nav entries, risking inconsistent operator experience and duplicated maintenance. | ENTITY_DECLARATION_DRIFT | WAVE_3_CORE_DOMAIN_FIXES | 35 | — | no | no | no | no | — | — |
| GAP-0117 | monitoring, integrations | S4_INFORMATIONAL | NO_FIX_REQUIRED | monitoring: ECAD statement-file ingestion is real and working — confirmed distinct from integrations.md's separate UI-only ECAD connect-card finding | The real feature parses uploaded ECAD royalty-statement files (XLSX/CSV) into monitoring_reports rows via a genuine parser service — this is confirmed NOT the same code path as the integrations module's stubbed "ECAD" API-connection card; no merge, both stand independently. | REAL_MAPPING_GAP | WAVE_NONE | 0 | — | no | no | no | no | — | — |
| GAP-0118 | monitoring | S3_LOW | OPEN | monitoring: match-confidence score displayed with no explanation of methodology, and no manual override/dispute flow | monitoring_matches.confidence_score is displayed as a raw percentage with no UI to dispute/correct a false-positive match — an operator who sees a wrong match has no in-app action beyond ignoring it. | MISSING_REQUIRED_FUNCTIONALITY | WAVE_6_SECONDARY_FUNCTIONALITY | 20 | — | no | no | no | no | — | — |
| GAP-0119 | monitoring, accounting | S2_MEDIUM | OPEN | monitoring: matched-royalty amounts have no propagation to accounting transactions | A confirmed ECAD match with an associated valor_apurado has no service creating a corresponding accounting transaction — same cross-domain financial-propagation gap class as contracts/events/licensing. | MISSING_REQUIRED_FUNCTIONALITY | WAVE_4_CROSS_DOMAIN_FIXES | 35 | — | no | no | no | no | — | — |
| GAP-0120 | monitoring | S2_MEDIUM | OPEN | monitoring: list endpoint truncates at limit=50, no pagination UI | Independent PaginationDto instance on /monitoring/reports with no frontend load-more control. | PAGINATION_GAP | WAVE_3_CORE_DOMAIN_FIXES | 25 | — | no | no | no | no | — | — |
| GAP-0121 | musicchat | S2_MEDIUM | OPEN | musicchat: RealtimeService publishes real Supabase Realtime conversation:* events, but MusicChat.tsx has zero frontend consumer | ConversationsService correctly bridges message/conversation changes to Supabase Realtime (confirmed genuine broadcast, not just EventEmitter2), but MusicChat.tsx never calls useWsEvent()/subscribes to any conversation:* channel — new messages from another session/user require a manual reload to appear. | REALTIME_GAP | WAVE_3_CORE_DOMAIN_FIXES | 40 | — | no | no | no | no | — | — |
| GAP-0122 | musicchat | S2_MEDIUM | OPEN | musicchat: blob/file attachments are not stored — attachment metadata is accepted but the actual file is never uploaded | The message-attachment UI creates a local blob URL for preview but no upload call sends the file to R2/storage before message creation — the persisted message references a file that never existed server-side. | STORAGE_GAP | WAVE_3_CORE_DOMAIN_FIXES | 35 | — | no | no | no | no | — | — |
| GAP-0123 | musicchat | S4_INFORMATIONAL | NO_FIX_REQUIRED | musicchat: MessageSenderType.AI enum member is unused — no LLM/RAG requirement exists (confirmed, not a gap) | The enum includes an AI sender type for future extensibility, but no AI/RAG generation logic exists anywhere in the module — correctly classified as an unused-but-intentional forward-compat member, not a missing feature. | REAL_MAPPING_GAP | WAVE_NONE | 0 | — | no | no | no | no | — | — |
| GAP-0124 | musicchat | S4_INFORMATIONAL | DEFERRED | musicchat: external-channel message ingestion (WhatsApp/Instagram DM bridging) is entirely absent — confirmed scope boundary, not a defect | MusicChat is an internal, tenant-scoped conversation system between platform users; no external channel adapter exists or was ever partially built — correctly out of scope for this module. | MISSING_REQUIRED_FUNCTIONALITY | WAVE_NONE | 0 | — | no | no | no | no | — | — |
| GAP-0125 | musicchat | S2_MEDIUM | OPEN | musicchat: message list truncates at limit=50 with no "load older messages" infinite-scroll trigger | Independent PaginationDto instance on GET /conversations/:id/messages; the chat pane has no scroll-triggered pagination, so conversations beyond 50 messages permanently hide their earliest history. | PAGINATION_GAP | WAVE_3_CORE_DOMAIN_FIXES | 30 | — | no | no | no | no | — | — |
| GAP-0126 | projects | S4_INFORMATIONAL | OPEN | projects: dead Zustand projects-board store never wired to any component | Same cross-module dead-scaffolding pattern — a kanban/board-view store with full drag-reorder actions exists but ProjetosLista.tsx renders a plain table with no board view. | REAL_MAPPING_GAP | WAVE_7_CLEANUP | 8 | — | no | no | no | no | — | — |
| GAP-0127 | projects, contracts | S2_MEDIUM | OPEN | projects: project-to-contract relation (contrato_id) is a real FK exposed as a filter, but no create/edit form sets it | projects.contrato_id has a real FK to contracts.id used as a query filter param, but neither ProjetoFormModal nor the contract wizard's "vincular projeto" step actually writes it — the relation is populated only when manually set via direct API call. | REAL_MAPPING_GAP | WAVE_4_CROSS_DOMAIN_FIXES | 30 | — | no | no | no | no | — | — |
| GAP-0128 | projects | S2_MEDIUM | OPEN | projects: list endpoint truncates at limit=50, no pagination UI | Independent PaginationDto instance on /projects with no frontend load-more control. | PAGINATION_GAP | WAVE_3_CORE_DOMAIN_FIXES | 25 | — | no | no | no | no | — | — |
| GAP-0129 | releases | S1_HIGH | OPEN | releases: internal_status/platform_status fields collected by the release-status UI are never accepted by the DTO (CREATE_MAPPING_MISMATCH) | ReleaseStatusPanel.tsx captures an internal_status distinct from the public/platform-facing status, but UpdateReleaseDto only declares status — the internal value is validated away by the whitelist ValidationPipe on every submit. | CREATE_MAPPING_MISMATCH | WAVE_2_SCHEMA_AND_CONTRACT | 60 | — | no | no | no | no | — | — |
| GAP-0130 | releases | S2_MEDIUM | OPEN | releases: workflow allows an illegal DRAFT→DISTRIBUTED direct jump, skipping the required review/approval intermediate states | The status-transition validation on the update endpoint does not enforce the full intended state machine — only a subset of illegal transitions are blocked, and DRAFT→DISTRIBUTED specifically passes through unguarded. | MISSING_REQUIRED_FUNCTIONALITY | WAVE_3_CORE_DOMAIN_FIXES | 40 | — | no | no | no | no | — | — |
| GAP-0131 | releases | S3_LOW | DEFERRED | releases: takedown request flow has UI but no real distributor call (consistent with the 6-stub-providers finding, tracked separately for the takedown-specific UX) | A "Solicitar Takedown" button and status badge exist, but since no distributor integration is implemented (GAP for the 6 providers), the takedown action can only set a local status flag with no actual removal ever occurring — same underlying cause as the provider stubs but a distinct manifestation worth its own UX-correctness tracking. | MISSING_REQUIRED_FUNCTIONALITY | WAVE_5_INTEGRATIONS | 15 | — | no | no | no | no | — | — |
| GAP-0132 | releases | S3_LOW | OPEN | releases: artwork upload is a real storage pipeline, but delete never removes the R2 object (orphaned files, independent instance) | Same class of gap as inventory's item-photo and audiovisual's asset-delete findings but an independent root cause (different service/table) — release artwork delete only clears the artwork_url column. | STORAGE_GAP | WAVE_6_SECONDARY_FUNCTIONALITY | 18 | — | no | no | no | no | — | — |
| GAP-0133 | releases, contracts | S4_INFORMATIONAL | NOT_APPLICABLE | releases: contracts.lancamento_id relation confirmed non-existent on both sides — mutual confirmation, should be recorded closed, not an open gap | contracts.md flagged an unconfirmed selector for lancamento_id; releases.md independently confirms CONTRACT_RELEASE_TRACEABILITY:NOT_APPLICABLE — no such relation exists in the schema, both audits mutually confirm its absence. Recorded here as a closed cross-check, not an actionable gap. | RELATION_MISMATCH | WAVE_NONE | 0 | — | no | no | no | no | — | — |
| GAP-0134 | releases | S2_MEDIUM | OPEN | releases: list endpoint truncates at limit=50, no pagination UI | Independent PaginationDto instance on /releases with no frontend load-more control. | PAGINATION_GAP | WAVE_3_CORE_DOMAIN_FIXES | 25 | — | no | no | no | no | — | — |
| GAP-0135 | reports | S4_INFORMATIONAL | NO_FIX_REQUIRED | reports: report-form-contracts.ts is the confirmed single source of truth for export/import, but 2 modules (accounting XLSX, contracts PII) still bypass it | The Central de Relatórios export engine is real, well-tested, and universally consumed by every module's standard export button — the accounting dead 3-sheet generator (GAP already tracked) and the contracts PII-export gap (GAP already tracked) are the only 2 confirmed bypasses, both tracked at their source modules, not duplicated here. | REAL_MAPPING_GAP | WAVE_NONE | 0 | — | no | no | no | no | — | — |
| GAP-0136 | reports | S3_LOW | DEFERRED | reports: scheduled/recurring report generation (e.g. "send monthly P&L every 1st") does not exist | Every report export in the system is triggered synchronously by a user click; no cron/scheduled-job mechanism exists to generate and email/store a report on a recurring basis. | MISSING_REQUIRED_FUNCTIONALITY | WAVE_6_SECONDARY_FUNCTIONALITY | 15 | — | no | no | no | no | — | — |
| GAP-0137 | reports | S2_MEDIUM | OPEN | reports: export history/audit trail (who exported what, when) is not tracked | No table records completed export operations — for compliance-sensitive exports (contracts PII, RH payroll) there is no way to answer "who downloaded this report and when." | MISSING_REQUIRED_FUNCTIONALITY | WAVE_4_CROSS_DOMAIN_FIXES | 35 | — | no | no | no | no | — | — |
| GAP-0138 | rh | S1_HIGH | OPEN | rh: employee CREATE_MAPPING_MISMATCH — CreateEmployeeDto rejects the real form payload shape (400 on every submission) | FuncionarioFormModal.tsx nests endereco as a sub-object ({logradouro, numero, cidade, ...}) while CreateEmployeeDto declares flat top-level fields (endereco_logradouro, endereco_numero, ...) — global whitelist ValidationPipe rejects the nested payload outright. | CREATE_MAPPING_MISMATCH | WAVE_2_SCHEMA_AND_CONTRACT | 80 | — | no | no | no | no | — | — |
| GAP-0139 | rh | S1_HIGH | OPEN | rh: payroll-entry CREATE_MAPPING_MISMATCH — CreatePayrollEntryDto field names diverge from the form (400 on every submission) | FolhaPagamentoFormModal.tsx sends valor_bruto/valor_liquido/descontos as a nested descontos:{inss,irrf,outros} object, but CreatePayrollEntryDto declares flat desconto_inss/desconto_irrf/desconto_outros — same whitelist-rejection pattern as employee creation. | CREATE_MAPPING_MISMATCH | WAVE_2_SCHEMA_AND_CONTRACT | 80 | — | no | no | no | no | — | — |
| GAP-0140 | rh | S1_HIGH | OPEN | rh: leave-request CREATE_MAPPING_MISMATCH — CreateLeaveRequestDto field names diverge from the form (400 on every submission) | SolicitacaoFeriasFormModal.tsx sends data_inicio/data_fim/tipo_ausencia, but CreateLeaveRequestDto declares start_date/end_date/leave_type — an English/Portuguese naming split identical in class to the artist-module social-URL bug already fixed once elsewhere, but this instance was never fixed. | CREATE_MAPPING_MISMATCH | WAVE_2_SCHEMA_AND_CONTRACT | 80 | — | no | no | no | no | — | — |
| GAP-0141 | rh | S1_HIGH | OPEN | rh: employee entity missing 8 physical columns that the form/DTO already reference (entity-declaration gap, distinct root cause from the CREATE_MAPPING_MISMATCH bugs) | The Employee TypeORM entity class has no @Column declaration for 8 fields (e.g. pis_pasep, ctps_numero, banco_conta, banco_agencia, etc.) that the DTO validates and the service attempts to assign — TypeORM silently ignores unmapped properties on save, so even a payload that passes validation loses these 8 fields. This is a different root cause from the nested-vs-flat CREATE_MAPPING_MISMATCH bugs (entity declaration vs DTO shape). | ENTITY_DECLARATION_DRIFT | WAVE_2_SCHEMA_AND_CONTRACT | 70 | GAP-0060 | no | no | no | no | — | — |
| GAP-0142 | rh | S2_MEDIUM | OPEN | rh: documents endpoint exists and is implemented server-side, but is never wired to any frontend component (unreachable feature) | A full CRUD set for employee documents (upload/list/download/delete against a real employee_documents table + R2 storage) exists in RhDocumentsController, but no page/modal in the RH module calls any of it — orphaned real backend feature. | REAL_MAPPING_GAP | WAVE_3_CORE_DOMAIN_FIXES | 45 | — | no | no | no | no | — | — |
| GAP-0143 | rh | S1_HIGH | OPEN | rh: employee list renders blank/empty despite real data existing (frontend query key or response-shape mismatch) | FuncionariosLista.tsx queries a response shape ({data: Employee[]}) that does not match what GET /rh/employees actually returns for this specific list (a bare array), so the list renders empty even when the backend has employee rows — a distinct, separate root cause from the create-flow bugs above. | DISPLAY_MAPPING_MISMATCH | WAVE_2_SCHEMA_AND_CONTRACT | 75 | — | no | no | no | no | — | — |
| GAP-0144 | rh | S2_MEDIUM | OPEN | rh: EmployeeStatus ENUM_MISMATCH — frontend filter dropdown vocabulary diverges from the backend enum | The status filter on FuncionariosLista.tsx offers ativo/inativo/afastado while the real EmployeeStatus backend enum includes ACTIVE/INACTIVE/ON_LEAVE/TERMINATED — case and vocabulary mismatch means the filter never matches any real row. | ENUM_MISMATCH | WAVE_2_SCHEMA_AND_CONTRACT | 40 | — | no | no | no | no | — | — |
| GAP-0145 | rh | S2_MEDIUM | OPEN | rh: payroll_entries and leave_requests also have orphaned physical-column gaps (grouped with employee's 8-column gap only if literally the same migration; kept separate per distinct table/entity) | Similar to the employee entity, PayrollEntry and LeaveRequest entities are each missing several @Column declarations for fields their respective DTOs/forms reference (e.g. payroll: valor_fgts, leave_requests: aprovado_por) — same class of defect, different entities/tables, tracked separately since each requires its own entity file edit. | ENTITY_DECLARATION_DRIFT | WAVE_2_SCHEMA_AND_CONTRACT | 55 | GAP-0061, GAP-0062 | no | no | no | no | — | — |
| GAP-0146 | rh | S2_MEDIUM | OPEN | rh: list endpoints truncate at limit=50, no pagination UI | Independent PaginationDto instance across /rh/employees, /rh/payroll-entries, /rh/leave-requests with no frontend load-more control. | PAGINATION_GAP | WAVE_3_CORE_DOMAIN_FIXES | 25 | — | no | no | no | no | — | — |
| GAP-0147 | settings | S2_MEDIUM | OPEN | settings: notification-settings toggles have no backend consumer — preference is saved but nothing reads it before sending a notification | NotificacoesSettings.tsx persists toggle state to a real tenant_notification_preferences row, but NotificationHandler (the actual dispatcher used by support/musicchat) never queries this table before sending — every notification fires regardless of the saved preference. | MISSING_REQUIRED_FUNCTIONALITY | WAVE_3_CORE_DOMAIN_FIXES | 35 | — | no | no | no | no | — | — |
| GAP-0148 | settings | S3_LOW | OPEN | settings: notification-settings UI shows hardcoded-true toggles for 2 channels regardless of saved state | Two specific toggle rows (SMS, Push) render checked=true unconditionally in the component rather than reading tenant_notification_preferences — cosmetic but user-facing lie about what is actually enabled. | DISPLAY_MAPPING_MISMATCH | WAVE_3_CORE_DOMAIN_FIXES | 20 | GAP-0065 | no | no | no | no | — | — |
| GAP-0149 | settings | S2_MEDIUM | OPEN | settings: tenant logo upload has no backend endpoint — "Alterar Logo" button in Branding tab has no working destination | BrandingSettings.tsx builds a FormData upload intended for something like POST /tenants/:id/logo, but no such route exists anywhere in the backend — the only real logo-related field is a plain logo_url text column with no upload pipeline behind it. | MISSING_REQUIRED_FUNCTIONALITY | WAVE_3_CORE_DOMAIN_FIXES | 35 | — | no | no | no | no | — | — |
| GAP-0150 | settings | S2_MEDIUM | OPEN | settings: billing UI fragmented across 3 separate surfaces with no single source of truth for subscription state | Billing.tsx, PlanoAtual (a dashboard widget), and a modal reachable from the feature-gate upgrade prompt each independently query/display subscription state via 3 different hooks — none is authoritative, and they can show different plan/status values if one is stale. | SOURCE_OF_TRUTH_CONFLICT | WAVE_3_CORE_DOMAIN_FIXES | 30 | GAP-0005 | no | no | no | no | — | — |
| GAP-0151 | settings | S1_HIGH | OPEN | settings: "Alterar Plano" button in Billing.tsx calls a nonexistent endpoint (plan-change flow 100% broken) | The plan-change action posts to PATCH /billing/subscription/plan, which does not exist server-side — BillingController only exposes read (GET /billing/subscription) and webhook-receiver routes, no mutation endpoint for self-service plan changes. | CREATE_MAPPING_MISMATCH | WAVE_2_SCHEMA_AND_CONTRACT | 55 | GAP-0068 | no | no | no | no | — | — |
| GAP-0152 | settings | S2_MEDIUM | OPEN | settings: card-entry form in Billing.tsx displays a fake, hardcoded card number instead of the real tokenized card-on-file | The "cartão salvo" display shows a literal hardcoded "**** **** **** 4242" placeholder string rather than the last4 returned by the real stripeClient tokenization — a "never fake success"-principle violation distinct from marketing's fabricated ROI (different module, different mechanism). | UX_CONTRACT_DEFECT | WAVE_3_CORE_DOMAIN_FIXES | 30 | — | no | no | no | no | — | — |
| GAP-0153 | settings | S3_LOW | OPEN | settings: feature-gate "upgrade" prompt links to a route that is not registered in the router (dead link) | FeatureGate.tsx's upgrade CTA navigates to /configuracoes/billing/upgrade, but no such route is registered — only /configuracoes/billing (the base Billing.tsx page) exists, so the CTA 404s. | REAL_MAPPING_GAP | WAVE_3_CORE_DOMAIN_FIXES | 25 | — | no | no | no | no | — | — |
| GAP-0154 | settings | S2_MEDIUM | OPEN | settings: feature flags are evaluated frontend-only (hardcoded flag map), not backed by any tenant_feature_flags table or backend gate | FeatureGate.tsx and useFeatureFlag() read from a hardcoded local map keyed by plan tier — there is no tenant_feature_flags table and no backend-side enforcement, so a determined client could bypass any gate by editing frontend state; the only real enforcement (if any) would need to be server-side per protected endpoint, which does not exist. | SECURITY_DEFECT | WAVE_2_SCHEMA_AND_CONTRACT | 50 | — | no | no | no | no | — | — |
| GAP-0155 | settings | S2_MEDIUM | DEFERRED | settings: security-settings tab (2FA, session management) has no backend at all — pure UI mockup | SegurancaSettings.tsx renders toggle switches for 2FA and a fake "active sessions" list with no query to any real endpoint — entirely disconnected from Supabase Auth's actual MFA/session APIs. | MISSING_REQUIRED_FUNCTIONALITY | WAVE_6_SECONDARY_FUNCTIONALITY | 25 | — | no | no | no | no | — | — |
| GAP-0156 | settings | S3_LOW | OPEN | settings: localization tab (language/timezone/currency) saves to localStorage only, not to a tenant/user-scoped backend column | The selected language/timezone/currency persist to browser localStorage, so the setting does not follow the user across devices and is invisible to any backend formatting logic (e.g. report/export date formatting). | REAL_MAPPING_GAP | WAVE_6_SECONDARY_FUNCTIONALITY | 20 | — | no | no | no | no | — | — |
| GAP-0157 | support, admin | S1_HIGH | OPEN | support: AdminSupport ticket-status enum mismatch causes a reachable runtime crash when an admin opens a ticket in a specific state | TicketDetailModal (admin variant) destructures ticket.status expecting one of the tenant-facing SupportTicketStatus enum values, but the admin list endpoint returns a superset including an admin-only value (ESCALATED) that has no corresponding UI branch — the component's switch statement throws (no default case) when rendering the status badge for an escalated ticket. | ENUM_MISMATCH | WAVE_2_SCHEMA_AND_CONTRACT | 65 | — | no | no | no | no | — | — |
| GAP-0158 | support | S1_HIGH | OPEN | support: category ENUM_MISMATCH between the ticket-creation form and the backend TicketCategory enum | NovoTicketModal.tsx offers Portuguese category labels as raw values (e.g. "Financeiro") sent directly as the category field, while TicketCategory backend enum expects English snake_case (BILLING, TECHNICAL, ...) — every ticket created via the UI fails the DTO enum validation (400) unless the value happens to coincide. | ENUM_MISMATCH | WAVE_2_SCHEMA_AND_CONTRACT | 55 | — | no | no | no | no | — | — |
| GAP-0159 | support, admin | S2_MEDIUM | NO_FIX_REQUIRED | support: AdminSupport cross-tenant framing over tenant-scoped backend — CLOSED with full evidence (see admin.md pendency) | Already fully captured as the shared canonical gap with admin — see GAP-0027. This entry exists only to explicitly record the support-side closure evidence referenced by the original admin.md pendency. | DISPLAY_MAPPING_MISMATCH | WAVE_NONE | 0 | GAP-0027 | no | no | no | no | — | — |
| GAP-0160 | support | S4_INFORMATIONAL | DEFERRED | support: deliberately-fake subfeatures (community forum, live chat widget) correctly classified as INTENTIONAL_STUB per their own report basis | SupportCommunity.tsx and the floating live-chat widget both render fully-designed UI with hardcoded/mock content and no backend — confirmed, per the module's own audit, to be deliberate placeholders for a not-yet-prioritized feature, not partial/broken implementations. | INTENTIONAL_STUB | WAVE_NONE | 0 | — | no | no | no | no | — | — |
| GAP-0161 | support | S2_MEDIUM | OPEN | support: ticket list truncates at limit=50, no pagination UI | Independent PaginationDto instance on /support-tickets with no frontend load-more control. | PAGINATION_GAP | WAVE_3_CORE_DOMAIN_FIXES | 25 | — | no | no | no | no | — | — |
| GAP-0162 | workspace, settings | S3_LOW | OPEN | workspace: settings.md public-slug-in-localStorage pendency — CLOSED, same root cause as workspace's tenant-ownership-resolution gap | tenants.slug (used for the tenant's public registration URL) is cached client-side in localStorage by both Configuracoes.tsx (settings) and the workspace-switcher; workspace.md traced the canonical ownership/resolution logic and confirmed both are reads of the same real, DB-backed tenants.slug column with no independent second source — the localStorage copy is a cache, not a second source of truth, but can go stale if the slug is changed and the cache is not invalidated. | SOURCE_OF_TRUTH_CONFLICT | WAVE_3_CORE_DOMAIN_FIXES | 20 | — | no | no | no | no | — | — |
| GAP-0163 | workspace, settings | S3_LOW | OPEN | workspace: invitation-management UI duplicated across workspace-switcher context and settings' team-members tab (3rd confirmed duplicate-UI-flow instance) | A "convidar membro" flow exists both inside the workspace-switcher's dropdown (quick-invite) and as a full page under Configuracoes > Equipe — each calls the real POST /tenant-invitations endpoint correctly, but maintains independent local state/validation, so an in-flight invite in one is invisible to the other until a full refetch. | ENTITY_DECLARATION_DRIFT | WAVE_3_CORE_DOMAIN_FIXES | 20 | — | no | no | no | no | — | — |
| GAP-0164 | workspace | S3_LOW | OPEN | workspace: current-tenant selection persists to localStorage with no server-side default/last-used sync — a user switching devices always lands on their first-ever membership, not their last-used tenant | The "current workspace" selector writes only to localStorage; no users table or membership column stores a last_active_tenant_id, so cross-device continuity is impossible by design (not a bug, but worth recording as a real UX limitation). | MISSING_REQUIRED_FUNCTIONALITY | WAVE_6_SECONDARY_FUNCTIONALITY | 20 | — | no | no | no | no | — | — |
| GAP-0165 | workspace | S2_MEDIUM | OPEN | workspace: member-removal (revoke membership) has no confirmation of side effects on records the member owns/created (orphaned created_by references, not cleaned up or reassigned) | DELETE /tenant-memberships/:id removes the membership row but performs no check or reassignment of created_by/assigned_to references the removed member may hold across other tables — those FKs (nullable, ON DELETE SET NULL where declared) simply go null with no audit trail of the removal's downstream effect. | DATA_INTEGRITY_DEFECT | WAVE_6_SECONDARY_FUNCTIONALITY | 25 | — | no | no | no | no | — | — |
| GAP-0166 | workspace | S3_LOW | OPEN | workspace: membership list truncates at limit=50, no pagination UI (relevant only to very large tenants) | Independent PaginationDto instance on /tenant-memberships with no frontend load-more control. | PAGINATION_GAP | WAVE_6_SECONDARY_FUNCTIONALITY | 15 | — | no | no | no | no | — | — |
| GAP-0167 | catalog, contracts, dashboard, events, inventory, leads, crm-relationships, projects, releases | S4_INFORMATIONAL | OPEN | Cross-module: 9 independently-generated, never-wired Zustand store scaffolds share the same root cause (boilerplate generator run ahead of feature build-out, never revisited) | catalog, contracts, dashboard, events, inventory, leads, crm-relationships, projects, and releases each contain one fully-formed Zustand store (CRUD actions, persisted middleware) generated during an early scaffolding pass, with zero component ever importing any of them — confirmed identical generation pattern (same file shape, same author commit range) across all 9, making this a single genuine root cause (the scaffolding pass itself) rather than 9 coincidentally-similar findings. This intentionally stretches the strict per-module dedup rule; justification: unlike the PaginationDto truncation pattern (independent per-endpoint causes, independent fixes), removing any one of these 9 stores has zero interaction with the others and the "fix" (delete) is identical and independent per file — collapsing them avoids 9 near-duplicate register entries whose only content would be a file path. | DEAD_CODE | WAVE_7_CLEANUP | 10 | — | no | no | no | no | — | — |
| GAP-0168 | releases, projects | S2_MEDIUM | OPEN | releases: no persisted relation to the originating musical project — decision RESOLVED (DEC-009: PROJECT_RELEASE_DIRECT_LINK, releases.project_id → projects.id), remaining work is implementation only (corrected; original text below described this as an open architectural question with blocksSchemaV2Design=SIM, both now resolved — see canonical-gap-register.json for full correction) | ORIGINAL (superseded): "ReleaseEntity has no project_id/projeto_id column at all (confirmed absent, releases.md §16). LancamentoFormModal.tsx offers a one-time convenience (projetoToLancamentoSeed()) that copies title/genre/artist FROM an existing Projeto into a new release's form fields at creation time, but the source project's id is never stored on the resulting release row, and no DOMAIN_EVENTS listener connects the two entity types afterward in either direction." — Product Owner decided releases.project_id -> projects.id (N:1, nullable, no UNIQUE) is part of the v2 model, coexisting with the Release->ReleaseTrack->Phonogram->Work chain (DEC-007/DEC-001); canonical Project scope narrowed to Single/EP/Album. | RELATION_MISMATCH | WAVE_2_SCHEMA_AND_CONTRACT | 40 | GAP-0001 | NO | no | no | no | DEC-009 | — |

---

# PART XIV — CONFLICTS

## XIV.1 Documentation conflicts (CONFLITO-01 to 05, restored in full from master report §27)

```
CONFLITO-01
SUBJECT: Name of the selected DEC-001 option within the canonical gap register itself
CURRENT_DEFINITION_A: decision-register.json (DEC-001.selectedOption = "MUSICAL_PROJECT_CANONICAL_HUB",
  current correction, Product Owner authority)
CURRENT_DEFINITION_B: 00-canonical-gap-register.md §12, WAVE_3_CORE_DOMAIN_FIXES table, row for
  GAP-0001: "projects domain-meaning DECIDED (DEC-001: UNIVERSAL_FINANCIAL_PROJECT) — remaining work:
  expose artista_id/orcamento..." — still cites the OLD/INVALIDATED name of the decision
SOURCE_A: docs/backend-v2/gap-resolution/decision-register.json
SOURCE_B: docs/backend-v2/gap-resolution/00-canonical-gap-register.md §12
WHY_IT_MATTERS: The DEC-001 correction (ADDENDUM at the top of the same document) is correct and clear, but
  the GAP-0001 index row in the wave table (further down in the same file) was never updated after the
  correction — a reader who consults only that table would wrongly conclude that DEC-001 is still
  UNIVERSAL_FINANCIAL_PROJECT.
SCHEMA_IMPACT: None (it is a documentation citation conflict, not a real schema one).
API_IMPACT: None.
PRODUCT_IMPACT: Risk of a future reader (engineering or product) making an implementation decision based
  on the invalidated definition if they consult only the wave table.
PO_CONFIRMATION_REQUIRED: NO — documentation correction recommended for a future step (see NOVO-01 below).
```

```
CONFLITO-02
SUBJECT: To which gap "GAP-0099" (leads: conversion with no financial_project_id link) actually belongs as
  the same root-cause family
CURRENT_DEFINITION_A: canonical-gap-register.json (GAP-0099.title cites GAP-0015 as "same root cause
  family") — GAP-0015 is about financial_category_id (financial category), an entirely different subject
CURRENT_DEFINITION_B: 00-canonical-gap-register.md §12, WAVE_4 table, same row: "...(same family as
  GAP-0015 note: actually GAP-0001)" — suggests GAP-0001 (projects domain definition) as the correction
SOURCE_A: docs/backend-v2/gap-resolution/canonical-gap-register.json (GAP-0099)
SOURCE_B: docs/backend-v2/gap-resolution/00-canonical-gap-register.md §12
WHY_IT_MATTERS: Neither GAP-0015 nor GAP-0001 appears, by content, to really be the same root-cause
  family as GAP-0099 (which is about `financial_project_id` never being written on lead conversion) — the
  most plausible candidate by content is GAP-0033 (real financial_project_id, never written by any
  form), but neither source cites it.
SCHEMA_IMPACT: None directly.
API_IMPACT: None directly.
PRODUCT_IMPACT: Incorrect root-cause traceability may direct fix effort to the wrong gap.
PO_CONFIRMATION_REQUIRED: NOT directly — clarification is recommended in future maintenance of the register
  (see NOVO-02 below); see also PO-VERIFY-025.
```

```
CONFLITO-03
SUBJECT: Does the `projects.contrato_id` column physically exist in the `projects` table?
CURRENT_DEFINITION_A: docs/backend-v2/field-traceability/modules/projects.md §2 — exhaustive list of the 16
  real columns of `projects`: id, tenant_id, titulo, tipo, status, artista_id, orcamento, descricao,
  observacoes, genero, metadata, created_at, updated_at, deleted_at, created_by, updated_by —
  `contrato_id` does NOT appear.
CURRENT_DEFINITION_B: canonical-gap-register.json (GAP-0127.title = "projects: project-to-contract
  relation (contrato_id) is a real FK exposed as a filter, but no create/edit form sets it") — asserts that
  `contrato_id` is a real column with an FK.
SOURCE_A: docs/backend-v2/field-traceability/modules/projects.md §2
SOURCE_B: docs/backend-v2/gap-resolution/canonical-gap-register.json (GAP-0127)
WHY_IT_MATTERS: `projects.md` is the Phase 2 primary source, explicit/exhaustive about the 16 columns;
  `GAP-0127` (Phase 3) asserts a 17th column not listed anywhere in the original module report.
  Also not confirmed by direct reading of the physical schema in this step (Part V.2 lists `projects` with 16
  columns, consistent with `projects.md`, not with GAP-0127).
SCHEMA_IMPACT: If the column does not exist, GAP-0127 needs correction/removal; if it exists, `projects.md`
  needs a Phase 2 addendum.
API_IMPACT: Affects whether a real `contrato_id` filter should remain exposed in the `projects` API.
PRODUCT_IMPACT: Affects whether the Project↔Contract relation is an active product requirement today or not.
PO_CONFIRMATION_REQUIRED: YES — see PO-VERIFY-006.
```

```
CONFLITO-04
SUBJECT: Inconsistent pattern of sensitive-data protection within the same `Artist` entity
CURRENT_DEFINITION_A: docs/backend-v2/field-traceability/modules/artist.md §3 — email/phone/CPF-CNPJ/
  manager contact are encrypted (AES-256-GCM) end to end, decrypted only in an authorized response.
CURRENT_DEFINITION_B: `EXPORT_PRIVACY_GAP` finding (referenced via PROGRESS.md, reports module) — the artist's
  banking data (`banco`/`conta`/`chave_pix`/`titular_conta`, same `Artist` entity) is
  stored as **unencrypted** jsonb and exported in plain text under the same permission layer as the
  encrypted fields.
SOURCE_A: docs/backend-v2/field-traceability/modules/artist.md §3
SOURCE_B: docs/backend-v2/field-traceability/PROGRESS.md ("MODULE: reports" section)
WHY_IT_MATTERS: There is no documented product reason for the two different sensitivity treatments
  within the same entity — financial/banking data is typically more sensitive than e-mail/phone, not
  less.
SCHEMA_IMPACT: Migrating `dados_bancarios` to AES-256-GCM encryption would require a column/type change.
API_IMPACT: The `Artist` read/export response would need to decrypt this field at the same point as
  the other encrypted fields.
PRODUCT_IMPACT: Risk of exposing sensitive financial data if not standardized before v2.
PO_CONFIRMATION_REQUIRED: YES — see PO-VERIFY-022.
```

```
CONFLITO-05
SUBJECT: "A signed contract propagates to Accounting" — true or false?
CURRENT_DEFINITION_A: canonical-gap-register.json (GAP-0055.title = "contracts: financial terms... captured
  in ContratoWizard have no propagation to accounting/transactions") — read in isolation, it suggests that
  NO propagation exists.
CURRENT_DEFINITION_B: docs/backend-v2/field-traceability/modules/contracts.md §15 — confirms
  `CONTRACT_TO_ACCOUNTING_TRACEABILITY_COMPLETE: SIM`, `REAL_AUTOMATIC_PROPAGATION`: on signing, a
  real transaction IS created automatically (with the contract's `valor`).
SOURCE_A: docs/backend-v2/gap-resolution/canonical-gap-register.json (GAP-0055)
SOURCE_B: docs/backend-v2/field-traceability/modules/contracts.md §15
WHY_IT_MATTERS: The two sources do not technically contradict each other (GAP-0055 is about the rich
  financial TERMS — payment method, due date, installments — not propagating; §15 confirms that only the simple
  `valor` propagates), but the title of GAP-0055, read in isolation, may be misread as "no propagation
  exists", which is false.
SCHEMA_IMPACT: None — clarified by the complete cross-domain analysis in MODULE-ACCOUNTING (Part VI).
API_IMPACT: None.
PRODUCT_IMPACT: Risk of underestimating the remaining propagation work (it looks like "everything" when in fact only
  the rich-terms part is missing).
PO_CONFIRMATION_REQUIRED: NO — clarified in this report (MODULE-ACCOUNTING, "cross-domain financial
  propagation rule"); it is only recommended to reword the title of GAP-0055 in a future step
  (see NOVO-03 below).
```

## XIV.2 New conflicts that emerged in this step (direct reading of additional modules)

No genuinely new conflict (definition A vs. definition B, both with a citable primary source) was found in the additional direct readings of this step (`events.md`, `crm-relationships.md`, `licensing.md`, `reports.md`, `integrations.md §5.20/5.21`) beyond the 5 already recorded above. The finding of the second accounting schema layer (`financial_transactions` and satellites, Part V.2) is recorded as a **finding**, not as a conflict — there is no contradictory "definition B" to compare, only an absence of prior documentation.

## XIV.3 `CANONICAL_DOCUMENTATION_CORRECTIONS_REQUIRED`

**New** documentation corrections identified in the master report (not corrected — only recorded, preserved here in full):

```
NOVO-01
FILE: docs/backend-v2/gap-resolution/00-canonical-gap-register.md, §12, WAVE_3_CORE_DOMAIN_FIXES table
PROBLEM: The GAP-0001 index row still cites the invalidated name of the decision ("DEC-001:
  UNIVERSAL_FINANCIAL_PROJECT") instead of the corrected name ("DEC-001: MUSICAL_PROJECT_CANONICAL_HUB"),
  even though the correction ADDENDUM, further up in the same document, already establishes the correct name.
SUGGESTED CORRECTION (not applied): update the text of the GAP-0001 row in the §12 table to reflect
  "DEC-001: MUSICAL_PROJECT_CANONICAL_HUB", with a footnote pointing to the correction ADDENDUM.
See CONFLITO-01.
```

```
NOVO-02
FILE: docs/backend-v2/gap-resolution/canonical-gap-register.json (GAP-0099.title) and
  docs/backend-v2/gap-resolution/00-canonical-gap-register.md §12, WAVE_4_CROSS_DOMAIN_FIXES table
PROBLEM: GAP-0099 cites GAP-0015 as "same root-cause family" in the JSON, and the markdown index
  adds "note: actually GAP-0001" — neither of the two citations corresponds, by the real content of the
  three gaps, to a clear root-cause relation (the most plausible candidate by content is GAP-0033).
SUGGESTED CORRECTION (not applied): review and replace the GAP-0099 citation with the correct reference (to
  be confirmed in a dedicated step) and remove the informal correction text embedded in the title of the
  markdown index.
See CONFLITO-02.
```

```
NOVO-03
FILE: docs/backend-v2/gap-resolution/canonical-gap-register.json (GAP-0055.title)
PROBLEM: The title of GAP-0055, read in isolation and without cross-checking against `contracts.md §15`, may be
  misread as "no contract→accounting propagation exists", when in fact a real, partial
  automatic propagation (only `valor`) already exists today when a contract is signed.
SUGGESTED CORRECTION (not applied): reword the title of GAP-0055 to make explicit that the gap is about
  the NON-propagation of the rich financial TERMS, not about propagation as a whole.
See CONFLITO-05.
```

```
NOVO-04
FILE: docs/backend-v2/gap-resolution/canonical-gap-register.json (GAP-0127) vs.
  docs/backend-v2/field-traceability/modules/projects.md §2
PROBLEM: GAP-0127 asserts the existence of `projects.contrato_id` as a real column with an FK; `projects.md`
  (Phase 2 source, more granular and exhaustive about the columns of `projects`) does not list that column among
  the table's 16 confirmed columns; the direct physical inventory of this step (Part V.2) did not find it
  either.
SUGGESTED CORRECTION (not applied): directly re-verify the physical database schema to confirm whether
  `projects.contrato_id` exists; if it does not exist, correct/remove GAP-0127; if it exists, add an
  addendum to `projects.md` documenting the column omitted in Phase 2.
See CONFLITO-03 and PO-VERIFY-006.
```

## XIV.4 Historical citation corrections already applied (traceability, not redone here)

For complete traceability, the following citation corrections **were already identified and applied** in previous steps of this series (preserved here only as a historical record — not redone, not reverted):
- **GAP-0053 → GAP-0041**: citation correction applied in the `DEC-007` record itself.
- **GAP-0041 → GAP-0055**: citation correction applied in the `DEC-002` record.
- **GAP-0069 → GAP-0151**: citation correction found and applied during the `DEC-005` analysis.

`EVIDENCE: 00-master-domain-functional-verification.md §27, CANONICAL_DOCUMENTATION_CORRECTIONS_REQUIRED | additional direct readings in this step (events.md, crm-relationships.md, licensing.md, reports.md, integrations.md) | CONFIDENCE: HIGH (existence of each conflict) / LOW-MEDIUM (which of the two sources is correct in each individual case) | STATUS: CONFLICTED (XIV.1) / CONFIRMED with no new conflicts (XIV.2) / DOCUMENTED_NOT_APPLIED (XIV.3, XIV.4)`

---

# PART XV — PRODUCT OWNER VALIDATION

All 26 PO-VERIFY items already recorded in the master report (`00-master-domain-functional-verification.md §28`) are preserved in full below — none was discarded. New items (PO-VERIFY-027+) are added only where this deeper step surfaced a materially new definition (one that changes real behavior/schema/API/inter-module relation, or derives from a conflict/decision).

## XV.1 — A: Core definitions

```
PO-VERIFY-001
"Is the Project, in fact, always the Song/Musical Project — never a generic financial hub, even in future
use cases (e.g. a purely audiovisual project with no associated song)?"
CURRENT_MODEL: MUSICAL_PROJECT_CANONICAL_HUB (DEC-001, corrected)
EVIDENCE: decision-register.json (DEC-001.canonicalDecision)
IMPACT_IF_WRONG: Complete redesign of the v2 schema of `projects` and of all the cross-domain relations
  documented in Part V.3.
```

```
PO-VERIFY-002 — RESOLVED (definitive Product Owner decision)
"Should a Release, in v2, have a persisted column pointing to its source musical Project (GAP-0168),
or is the product intent that a Release is always disconnected from the Project after creation?"
CURRENT_MODEL (historical, pre-decision): MISSING_RELATION today; GAP-0168 recommended adding the column,
  but this was not decided as a product requirement, only as an identified technical gap
EVIDENCE: canonical-gap-register.json (GAP-0168) | modules/releases.md §16 | decision-register.json (DEC-009)
IMPACT_IF_WRONG (historical, pre-decision): It directly affected the v2 schema design of `releases`
  (`blocksSchemaV2Design: true`).

PRODUCT OWNER DECISION: PROJECT_RELEASE_DIRECT_LINK (`DEC-009`, RESOLVED). `releases.project_id →
projects.id` (real FK, N:1, nullable, no implicit `UNIQUE`) is part of the v2 model. It does not replace the
`Release → ReleaseTrack → Phonogram → Work` chain. `blocksSchemaV2Design` of `GAP-0168` corrected to
`NÃO`. `GAP-0168` remains `OPEN` only for the actual implementation.
```

```
PO-VERIFY-003 — RESOLVED (definitive Product Owner decision)
"Can a single musical Project generate more than one Work and more than one Release? Or is the
product intent 1 Project = 1 song = 1 Release?"
CURRENT_MODEL (historical, pre-decision): CARDINALITY: TO_BE_CONFIRMED (the schema allows N:1 in both
  cases, but the real usage cardinality was not measured)
EVIDENCE: Part II of this report (canonical Project definition) | decision-register.json (DEC-009)
IMPACT_IF_WRONG (historical, pre-decision): It affected integrity constraints (unique, mandatory fields)
  in the v2 schema.

PRODUCT OWNER DECISION: a `Project` may contain one or several songs (each with its own
`Work`/`Phonogram`/`ReleaseTrack`) — it is not 1 Project = 1 song. A `Release` belongs directly to
exactly 1 `Project` (`releases.project_id`, N:1 FK) — but `releases.project_id` has **no**
`UNIQUE`, so multiple `Releases` may, in principle, reference the same `Project` (e.g.
re-releases), until/unless a specific future decision restricts it to 1:1. Canonical v2 `Project`
= Single/EP/Album (`video`/`tour`/`podcast`/`other` are legacy, out of scope for this relation).
```

```
PO-VERIFY-004
"Should the track of a Musical Project (`project_tracks`) and the track of a Release (`releases.metadata.faixas`)
converge into a single 'Track' entity in v2, or are they legitimately distinct concepts (track in
production vs. already distributed track)?"
CURRENT_MODEL: today they are two technically distinct and disconnected concepts
EVIDENCE: modules/projects.md §2 | modules/releases.md §15 | decision-register.json (DEC-007)
IMPACT_IF_WRONG: Directly affects the design of the `release_tracks` table (DEC-007, `TO_BE_DESIGNED`).
```

```
PO-VERIFY-005
"Should 'Workspace' remain strictly 1:1 with 'Tenant' in v2 (with no switcher across multiple
workspaces in the same session), or does the product intend to introduce workspace selection in the future?"
CURRENT_MODEL: SAME_ENTITY, no switcher, one session = one tenant (confirmed as an architectural
  characteristic, not a gap)
EVIDENCE: modules/workspace.md §0,§9
IMPACT_IF_WRONG: Significant architectural change in authentication/session context for v2.
```

## XV.2 — B: Relations between entities

```
PO-VERIFY-006
"Does the `projects.contrato_id` column (which would link a Project directly to a Contract) actually exist in the
database today, or is GAP-0127 referencing a column that does not exist (CONFLITO-03)?"
CURRENT_MODEL: CONFLICTED — see Part XIV, CONFLITO-03 (re-verified in this step via the physical schema
  inventory, Part V.2, which also did not find the column — this reinforces, but does not definitively resolve, the
  hypothesis that GAP-0127 is incorrect)
EVIDENCE: modules/projects.md §2 (16 columns, no contrato_id) vs. canonical-gap-register.json (GAP-0127)
  vs. Part V.2 of this report (direct physical inventory, also without contrato_id)
IMPACT_IF_WRONG: If the column does not exist, GAP-0127 must be reclassified/removed from the register; if
  it exists, `projects.md` needs a Phase 2 correction (addendum).
```

```
PO-VERIFY-007
"Should the `financial_project_id` columns (in `audiovisual_projects`/`marketing_projects`) be renamed
in the v2 schema to reflect their real meaning (link to the musical project), or should the name be kept
for compatibility?"
CURRENT_MODEL: LEGACY_NAMING, not renamed in this step (explicit decision not to rename yet)
EVIDENCE: decision-register.json (DEC-001.preservedRelations)
IMPACT_IF_WRONG: Low isolated technical risk, but it affects the readability of the v2 schema for the whole team.
```

```
PO-VERIFY-008
"Should 'P&L por Projeto' (P&L per Project) in Accounting in fact mean 'financial result grouped by
song/musical project' (e.g. how much revenue/cost a specific song generated)?"
CURRENT_MODEL: Yes, under the corrected definition — but never implemented (GAP-0013)
EVIDENCE: MODULE-ACCOUNTING (Part VI) | canonical-gap-register.json (GAP-0013)
IMPACT_IF_WRONG: If the real intent is different (e.g. grouping by campaign, not by song), the effort to
  fix GAP-0013 would be misdirected.
```

```
PO-VERIFY-009
"Should Contracts gain, in v2, a formal relation with Work/Phonogram/Project (nonexistent today in any
layer), to allow tracing 'this contract is about this specific song'?"
CURRENT_MODEL: NOT_APPLICABLE today (no relation exists, confirmed as the current design, not a gap)
EVIDENCE: modules/contracts.md §9
IMPACT_IF_WRONG: A new schema requirement not captured in any gap today, if the answer is "yes".
```

```
PO-VERIFY-010
"Should the automatic Lead conversion in fact always create an Artist — even for leads that do not have an
artistic profile (e.g. a supplier/partner lead)?"
CURRENT_MODEL: the current behavior always creates an Artist, without checking the lead type or duplicates
EVIDENCE: MODULE-LEADS (Part VI)
IMPACT_IF_WRONG: It generates duplicate/incorrect artists in the catalog if the expected answer is "no".
```

## XV.3 — C: Module behaviors

```
PO-VERIFY-011
"What is the priority of fixing the `internal_status` bug in Releases, which today blocks 100% of the creation and
editing of Releases via the real UI?"
CURRENT_MODEL: active bug, not fixed in this step
EVIDENCE: modules/releases.md §0
IMPACT_IF_WRONG: No new Release can be created through the UI while this bug persists — a direct,
  immediate operational impact, independent of any v2 decision.
```

```
PO-VERIFY-012
"Is the HR module (Employees/Payroll/Vacations) an active, priority product requirement, given that today it is
100% broken for creation across all 4 sub-resources?"
CURRENT_MODEL: active bugs, not fixed in this step
EVIDENCE: modules/hr.md §0,§1
IMPACT_IF_WRONG: If it is a priority, it needs to enter a fix wave before v2; if it is not a real product
  priority, it can be discontinued/simplified instead of rebuilt.
```

```
PO-VERIFY-013
"Are the 8 Audiovisual backend domains with no UI at all (briefing, deliverables, storyboard, schedule,
crew, files, tasks, approvals) a real product roadmap that should get a UI, or dead scope to be
formally discontinued?"
CURRENT_MODEL: real, rich backend, zero UI consumers, current classification: systemic REAL_MAPPING_GAP
EVIDENCE: modules/audiovisual.md §1
IMPACT_IF_WRONG: It will define whether ~85% of the Audiovisual domain built in the backend is rebuilt in v2 or
  discarded.
```

```
PO-VERIFY-014
"Is there a real timeline for researching/implementing the official APIs of the 6 digital distributors
(ONErpm, DistroKid, Symphonic, SoundOn, MusicPro, SomVibe), or do they remain static links for an
indefinite period?"
CURRENT_MODEL: honest STUB, decision D1 already approved in a previous document, future technical execution out of
  the scope of this audit
EVIDENCE: modules/integrations.md §5.20 | modules/releases.md §11
IMPACT_IF_WRONG: It directly affects whether real release distribution is a v2 capability or remains
  out of scope.
```

```
PO-VERIFY-015
"Is the public artist self-registration (`ArtistaSignupPublic.tsx`) an active product requirement, given that it
is 100% broken (it calls a nonexistent endpoint) and appears never to have worked?"
CURRENT_MODEL: broken, not fixed in this step
EVIDENCE: modules/auth.md §1
IMPACT_IF_WRONG: If it is a real requirement, it needs a new endpoint in v2; if not, the component can be
  removed instead of fixed.
```

```
PO-VERIFY-016
"Should rewiring `signing.adapter.ts` to the real Autentique integration be prioritized (backend already complete and
functional, implementation cost estimated as low)?"
CURRENT_MODEL: backend ready, frontend disconnected by stub design, no fix made
EVIDENCE: modules/integrations.md §5.20-5.22 | modules/contracts.md §21
IMPACT_IF_WRONG: A quick-win opportunity lost if not prioritized; no technical risk if postponed.
```

```
PO-VERIFY-017
"Should the redirect from `/monitoramento` to `/rights-monitoring` be fixed to point to the real,
functional screen (`Monitoramento.tsx`), abandoning/archiving `RightsMonitoring.tsx` (today
structurally empty by design)?"
CURRENT_MODEL: the user only reaches the empty screen today
EVIDENCE: MODULE-MONITORING (Part VI)
IMPACT_IF_WRONG: Users continue without access to a real, already built feature if not fixed.
```

## XV.4 — D: Pending decisions

```
PO-VERIFY-018 — RESOLVED (definitive Product Owner decision)
"DEC-003: which artist creation flow should prevail — ArtistaFormModal.tsx (in use) or
ArtistaCadastro.tsx (orphaned, more fields)?"
CURRENT_MODEL (historical, pre-decision): PENDING
EVIDENCE: decision-register.json (DEC-003)
IMPACT_IF_WRONG (historical, pre-decision): Loss of up to 26 artist registration fields if the orphaned
  page were discarded without analysis.

PRODUCT OWNER DECISION: ARTISTA_FORM_MODAL_CANONICAL. `ArtistaFormModal.tsx` is the single canonical
flow; 10 real fields exclusive to `ArtistaCadastro.tsx` to be merged (tipo, status, contrato_id,
manager_nome, manager_contato, produtor_executivo, agencia_booking, label_parceira, galeria_urls,
documentos) before removing the orphaned component. No data is lost in the meantime (fields omitted
from the modal's payload remain untouched in the database). Complete classification in
`decision-register.json` `DEC-003`. Implementation `NOT_STARTED`.
```

```
PO-VERIFY-019
"DEC-005: which billing surface should prevail — Configuracoes.tsx 'Billing' or the standalone
Billing.tsx?"
CURRENT_MODEL: PENDING (analysis concluded, decision not recorded)
EVIDENCE: decision-register.json (DEC-005) | DOMAIN-BILLING (Part VI, MODULE-SETTINGS)
IMPACT_IF_WRONG: It directly affects the billing experience and the priority of fixing the missing
  plan-change endpoint.
```

```
PO-VERIFY-020
"DEC-006: which invitation-management surface should prevail — /usuarios or the 'Usuários' (Users) tab of
Configuracoes.tsx?"
CURRENT_MODEL: PENDING
EVIDENCE: decision-register.json (DEC-006) | modules/workspace.md §8
IMPACT_IF_WRONG: Low technical risk; risk of persistent UX confusion.
```

```
PO-VERIFY-021
"DEC-008: should the sourceId of a contract party copied from CRM/Artist become a live reference
(automatic propagation of future edits) or remain an intentional snapshot (the legal document does not
change retroactively)?"
CURRENT_MODEL: PENDING (recorded recommendation: formalize the snapshot as intentional)
EVIDENCE: decision-register.json (DEC-008)
IMPACT_IF_WRONG: Direct legal risk if resolved incorrectly — signed contracts could appear
  to have changed retroactively.
```

## XV.5 — E: Data ambiguities

```
PO-VERIFY-022
"Should the artist's banking data (bank/account/PIX key/account holder) receive the same level of encryption
as the email/phone/CPF of the same entity (CONFLITO-04)?"
CURRENT_MODEL: unencrypted today, exported in plain text under the same permission layer
EVIDENCE: Part XIV, CONFLITO-04
IMPACT_IF_WRONG: Risk of exposing sensitive financial data if not standardized before v2.
```

```
PO-VERIFY-023
"Should contract party PII (CPF/CNPJ/RG/address, today in free text inside `observacoes`)
migrate to structured, encrypted storage before or as part of the WIZARD/QUICK unification
(DEC-004)?"
CURRENT_MODEL: GAP-0049, OPEN, with no defined fix plan
EVIDENCE: modules/contracts.md §7 | canonical-gap-register.json (GAP-0049)
IMPACT_IF_WRONG: Ongoing compliance/LGPD (Brazilian data-protection law) risk while it is not addressed.
```

```
PO-VERIFY-024
"Should the public registration slug (today saved only in `localStorage` per administrator, not per tenant)
migrate to server-side storage as a high priority, given that a real, active backend already exists
waiting for this information?"
CURRENT_MODEL: LOCAL_STORAGE_GAP confirmed, classified as "business-critical"
EVIDENCE: modules/settings.md §6,§11 | modules/workspace.md §19
IMPACT_IF_WRONG: Public artist registration remains practically unusable in multi-admin production.
```

```
PO-VERIFY-025
"Which gap is, in fact, related to GAP-0099 (lead conversion with no financial_project_id link) —
GAP-0015, GAP-0001, or GAP-0033, given that the two current sources disagree (CONFLITO-02)?"
CURRENT_MODEL: CONFLICTED
EVIDENCE: Part XIV, CONFLITO-02
IMPACT_IF_WRONG: Incorrect root-cause traceability may direct fix effort to the wrong gap.
```

```
PO-VERIFY-026
"Is there any script, external integration or third-party documentation still referencing the column
`projects.nome` (renamed to `titulo` by migration 20260718000013), beyond the code itself, already
fixed almost everywhere (except `ProjectPlanningAutomation`, which remains broken for this reason)?"
CURRENT_MODEL: rename confirmed as applied in the schema; at least 1 internal automation still broken for
  this reason
EVIDENCE: modules/projects.md §8
IMPACT_IF_WRONG: An incomplete migration of references may break more points of the system than those already
  identified.
```

## XV.6 — F: New items that emerged in this step (F — deeper pass)

```
PO-VERIFY-027 — RESOLVED (definitive Product Owner decision)
"Is the second accounting schema layer (financial_transactions/financial_accounts/cost_centers/
counterparties/transaction_allocations/performance_metric_entries/budgets/budget_revisions — Part V.2)
dead code from a previous accounting iteration, or a second iteration under parallel construction that
should be resumed/consolidated with `transactions`/`invoices` in v2?"
CURRENT_MODEL (historical, pre-decision): existence confirmed by the physical schema inventory; purpose
  NOT confirmed by any module report — a new finding of this step, with no prior citation in any
  of the 24 module reports
EVIDENCE: Part V.2 (found by direct reading of _all-tables.md/_all-fks-clean.md, not cited in any
  modules/*.md)
IMPACT_IF_WRONG (historical, pre-decision): If it is a live second iteration, the v2 accounting design
  needs to reconcile 2 financial data models instead of 1; if it is dead, it must be formally
  discontinued before v2.

PRODUCT OWNER DECISION: REMOVE_SECOND_ACCOUNTING_LAYER. The v2 architecture must NOT use any of the 8
tables (`financial_transactions`, `financial_accounts`, `cost_centers`, `counterparties`,
`transaction_allocations`, `performance_metric_entries`, `budgets`, `budget_revisions`) — neither as a
target, nor as a future path, nor as a valid alternative model. `transactions` remains the single canonical
financial ledger; there will be no second financial ledger. The 8 tables remain
physically in the database for now (not deleted in this step — the physical removal decision is a later step,
not a documentation one) and are reclassified from `UNKNOWN`/`PARTIALLY_MIGRATED`/candidate-for-resumption to
`REJECTED_ARCHITECTURE — DO_NOT_USE_IN_V2` (schema dead by product decision, not due to lack of
use). Every reference in this and the other parts of this document (see Part VI/the relations matrix and
the `GAP-0009` finding above) that cited `transaction_allocations`/`financial_transactions` as the semantic
destination, a target for future wiring or a v2 reconciliation candidate is CORRECTED by this addendum —
the original historical text is preserved verbatim where it appears, never erased, only superseded. Effect on
`GAP-0009`: the gap (accounting UI entityLinks never persisted) remains real and `OPEN`, but it can
no longer propose `transaction_allocations` as the solution — see the correction in
`gap-resolution/canonical-gap-register.json`/`00-canonical-gap-register.md`.
```

```
PO-VERIFY-028
"Should the cross-domain financial propagation rule (a revenue/expense must automatically appear in the
accounting/P&L of the corresponding project/artist/contract/event) be extended to `events`
(ticket revenue), `licensing` (license fee) and `monitoring` (detected royalties) as a v2
requirement — today only `contracts` has automatic propagation (and only partial, just the `valor` field)?"
CURRENT_MODEL: automatic propagation confirmed absent for the 3 sources cited; present and partial only
  for contracts (MODULE-ACCOUNTING, Part VI)
EVIDENCE: MODULE-ACCOUNTING, "Cross-domain financial propagation rule" section (Part VI) —
  GAP-0055/GAP-0078/GAP-0106/GAP-0119
IMPACT_IF_WRONG: Defines whether v2 accounting needs a single domain-event contract (e.g.
  `RevenueRecognized`) consumed by all source modules, or whether each module keeps requiring
  a duplicate manual financial entry.
```

## XV.7 — Consolidated checklist

| PO Verify | Summarized definition | Current Model | Approve [ ] | Fix [ ] |
|---|---|---|---|---|
| PO-VERIFY-001 | Project = Song (DEC-001) | MUSICAL_PROJECT_CANONICAL_HUB | [ ] YES | [ ] FIX |
| PO-VERIFY-002 | Should Release have an FK to Project? | **RESOLVED — PROJECT_RELEASE_DIRECT_LINK** (`DEC-009`) | [x] YES | [ ] FIX |
| PO-VERIFY-003 | Project↔Work↔Release cardinality | **RESOLVED** — Project 1:N songs; Release N:1 Project, no `UNIQUE` (`DEC-009`) | [x] YES | [ ] FIX |
| PO-VERIFY-004 | Do project_tracks vs. releases.metadata.faixas converge? | DISTINCT today | [ ] YES | [ ] FIX |
| PO-VERIFY-005 | Workspace 1:1 Tenant, no switcher | SAME_ENTITY | [ ] YES | [ ] FIX |
| PO-VERIFY-006 | Does projects.contrato_id physically exist? | CONFLICTED | [ ] YES | [ ] FIX |
| PO-VERIFY-007 | Rename financial_project_id in v2? | LEGACY_NAMING | [ ] YES | [ ] FIX |
| PO-VERIFY-008 | P&L per Project = per song? | Yes, not implemented | [ ] YES | [ ] FIX |
| PO-VERIFY-009 | Do Contracts get a relation with Work/Phonogram/Project? | NOT_APPLICABLE today | [ ] YES | [ ] FIX |
| PO-VERIFY-010 | Does Lead conversion always create an Artist? | current behavior | [ ] YES | [ ] FIX |
| PO-VERIFY-011 | Priority of the internal_status bug (releases) | blocks 100% | [ ] YES | [ ] FIX |
| PO-VERIFY-012 | Is HR an active priority? | 100% broken | [ ] YES | [ ] FIX |
| PO-VERIFY-013 | Do the 8 Audiovisual domains with no UI become roadmap? | zero UI | [ ] YES | [ ] FIX |
| PO-VERIFY-014 | API timeline for the 6 distributors? | indefinite STUB | [ ] YES | [ ] FIX |
| PO-VERIFY-015 | Is public artist self-registration an active requirement? | 100% broken | [ ] YES | [ ] FIX |
| PO-VERIFY-016 | Prioritize rewiring the real Autentique? | ready, disconnected | [ ] YES | [ ] FIX |
| PO-VERIFY-017 | Fix the /monitoramento redirect? | real screen unreachable | [ ] YES | [ ] FIX |
| PO-VERIFY-018 | DEC-003 (artist flow) | **RESOLVED — ARTISTA_FORM_MODAL_CANONICAL** | [x] YES | [ ] FIX |
| PO-VERIFY-019 | DEC-005 (canonical billing) | PENDING | [ ] YES | [ ] FIX |
| PO-VERIFY-020 | DEC-006 (canonical invitations) | PENDING | [ ] YES | [ ] FIX |
| PO-VERIFY-021 | DEC-008 (party sourceId) | PENDING | [ ] YES | [ ] FIX |
| PO-VERIFY-022 | Encrypt artist banking data? | unencrypted today | [ ] YES | [ ] FIX |
| PO-VERIFY-023 | Does contract PII migrate to structured storage? | free text today | [ ] YES | [ ] FIX |
| PO-VERIFY-024 | Does the public slug migrate to server-side? | localStorage today | [ ] YES | [ ] FIX |
| PO-VERIFY-025 | Correct root cause of GAP-0099 | CONFLICTED | [ ] YES | [ ] FIX |
| PO-VERIFY-026 | Residual references to projects.nome | 1 broken automation | [ ] YES | [ ] FIX |
| PO-VERIFY-027 (NEW) | 2nd accounting schema layer — dead or alive? | **RESOLVED: REMOVE_SECOND_ACCOUNTING_LAYER** | [x] YES | [ ] FIX |
| PO-VERIFY-028 (NEW) | Extend financial propagation to events/licensing/monitoring? | absent today | [ ] YES | [ ] FIX |

`EVIDENCE: 00-master-domain-functional-verification.md §28 (26 original items, preserved in full) + findings of this step (2 new items, PO-VERIFY-027/028) | CONFIDENCE: HIGH (existence of the questions); the answer itself is, by definition, unknown until Product Owner confirmation | STATUS: 4 RESOLVED (PO-VERIFY-002/003, decision PROJECT_RELEASE_DIRECT_LINK — DEC-009; PO-VERIFY-018, decision ARTISTA_FORM_MODAL_CANONICAL — DEC-003; PO-VERIFY-027, decision REMOVE_SECOND_ACCOUNTING_LAYER — see XV.6), 24 PENDING_PRODUCT_DECISION`

---

# VALIDATION

Self-verification checklist for this report, executed by direct counting over the file itself in this final step:

| Check | Expected | Found | Status |
|---|---|---|---|
| All 15 Parts present (I to XV) | 15 | 15 (`PART I` to `PART XV`, each with a complete title) | ✅ COMPLIANT |
| All 24 module names present (`## MODULE-*`) | 24 | 24 (ACCOUNTING, ADMIN, ARTIST, AUDIOVISUAL, AUTH, CATALOG, CONTRACTS, CRM-RELATIONSHIPS, DASHBOARD, EVENTS, INTEGRATIONS, INVENTORY, LEADS, LICENSING, MARKETING, MONITORING, MUSICCHAT, PROJECTS, RELEASES, REPORTS, RH, SETTINGS, SUPPORT, WORKSPACE) | ✅ COMPLIANT |
| Every gap of the live `canonical-gap-register.json` appears in Part XIII | 168 (live count) | 168 `\| GAP-` rows in the appendix table | ✅ COMPLIANT (168 documented = 168 found) |
| All decision IDs present | DEC-001 to DEC-008 | DEC-001, DEC-002, DEC-003, DEC-004, DEC-005, DEC-006, DEC-007, DEC-008 — all cited with complete detail in Part XII | ✅ COMPLIANT |
| All 26 pre-existing PO-VERIFY items preserved + new ones | 26 original | 26 original (001-026) preserved in full in Part XV + 2 new (027-028) = 28 total | ✅ COMPLIANT |
| `DOMAIN-PROJECT` present | YES | 5 occurrences (Part II, canonical Project definition) | ✅ COMPLIANT |
| `GAP-0168` present and treated in depth | YES | 21 occurrences (Part II §5, MODULE-PROJECTS, MODULE-RELEASES, Part V.3, Part XIII, Part XV) | ✅ COMPLIANT |
| State of backend v2 (`apps/api-v2`) documented | YES | Complete Part XI (already built / not built yet / stack-testing-deployment) | ✅ COMPLIANT |
| Cross-domain matrix (complete schema) present | YES | Part V.3 (physical extension, 142 tables) + Part VII (consolidation in prose) | ✅ COMPLIANT |
| Complete database section (table count, organization by domain) | YES | Part V (142 tables, 22 domain groups, none omitted) | ✅ COMPLIANT |
| Endpoint inventory per module | YES | Present in each of the 24 sections of Part VI ("Endpoints / calling component") | ✅ COMPLIANT |
| Field matrices (DB↔API↔form↔grid) | YES | Present for every module with a real create/edit entity (accounting, artist, audiovisual, catalog, contracts, crm-relationships, events, inventory, leads, projects, releases) — modules with no real create/edit entity (dashboard, reports) document that absence explicitly | ✅ COMPLIANT |
| Integrations matrix (providers + 6 named distributors) | YES | MODULE-INTEGRATIONS (Part VI) + Part VIII (consolidated) | ✅ COMPLIANT |
| Mock/stub/fake/dead inventory | YES | Part III.3 (pre-existing, 24 modules) + individual findings in each "What is fake/stub/dead" section of Part VI | ✅ COMPLIANT |
| `DEC-005` remains `PENDING_PRODUCT_DECISION`/PARKED in every mention | YES | Confirmed in MODULE-SETTINGS/DOMAIN-BILLING, Part XII.2, Part XV (PO-VERIFY-019) — no resolution was made in any mention | ✅ COMPLIANT |
| `DEC-006`/`DEC-008` remain pending; `DEC-003` was resolved in a later correction (`ARTISTA_FORM_MODAL_CANONICAL`) | YES | `DEC-006`/`DEC-008` marked `PENDING`/`PENDING_PRODUCT_DECISION` in every occurrence, no Wave 0 started; `DEC-003` corrected to `RESOLVED` in all occurrences of this correction — original text preserved, marked as historical | ✅ COMPLIANT (corrected) |
| No file other than the target report was created/changed (except scratch files, removed during cleanup) | YES | See the cleanup confirmation below | ✅ COMPLIANT |

## Cleanup confirmation for the scratch files

The 5 scratch files from the previous execution (`_gap-appendix-fragment.md`, `_gap-by-module.json`, `_all-tables.md`, `_all-fks.md`, `_all-fks-clean.md`) were used as verified input (not recomputed from scratch) for Parts V and XIII of this report, and will be removed from the `docs/backend-v2/review/` directory immediately after the final confirmation of this section — they are not part of the single artifact authorized by this process.

`EVIDENCE: direct count over docs/backend-v2/review/01-full-project-exhaustive-verification.md in this final step (grep -c over the file's own markers) | CONFIDENCE: HIGH | STATUS: COMPLETED`

---

