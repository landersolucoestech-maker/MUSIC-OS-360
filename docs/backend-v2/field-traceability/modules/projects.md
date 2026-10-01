> Historical record. Kept as recorded; not the current contract.

# Module: `projects` — Zero-Gap Field Traceability Audit

STATUS: COMPLETE

> **ADENDO (correção canônica pós-DEC-001, PROMPT 129):** o `PROJECT_DOMAIN_MEANING` abaixo descreve
> corretamente a **ambiguidade que existia antes da decisão** (evidência histórica preservada,
> inalterada). Essa ambiguidade foi resolvida por autoridade explícita do Product Owner: `projects` é a
> entidade **Projeto Musical/Música** — não um "hub financeiro/operacional universal". `projects.id` é a
> chave de vínculo cross-domain para essa música (`Work`, `Phonogram`, `Release`, `Accounting
> Transaction`, `Audiovisual`, `Marketing`). Definição vigente completa:
> `docs/backend-v2/gap-resolution/decision-register.json` (`DEC-001`) e o ADENDO de correção em
> `docs/backend-v2/gap-resolution/00-canonical-gap-register.md`. O texto original abaixo não foi
> reescrito — permanece como registro fiel do que foi encontrado no código antes da decisão.

## 0. Central objective

**PROJECT_DOMAIN_MEANING**: `projects` is the **universal financial/operational project entity** —
evidenced by migration `20260718000009_FinancialOperationalBridges.ts`'s own docstring: *"`projects` é
o projeto financeiro UNIVERSAL. Projetos de marketing e audiovisual podem apontar OPCIONALMENTE para um
projeto financeiro via `financial_project_id`."* In practice, however, the only reachable frontend
consumer (`Projetos.tsx` / `ProjetoFormModal.tsx`, route `/projetos`) uses it exclusively as a **music
release/track-registration project** (album/EP/single, with a rich per-track sub-form for
composers/performers/producers/lyrics/audio) — not as a generic operational or financial project
workbench. So there are two truths simultaneously, both evidenced, not assumed: the *schema's* intent is
universal-financial-project, but the *only real UI's* intent is music-release-project. Marketing and
Audiovisual model their **own separate, richer project concepts** (`marketing_projects`,
`audiovisual_projects`) that optionally, and in practice never, link back to this universal entity.

## 1. Subdomains

| Subdomain | Frontend entrypoint | Endpoints | Backend controller | Service | DB tables |
|---|---|---|---|---|---|
| PROJECT | `/projetos` (`Projetos.tsx`, `ProjetoFormModal.tsx`, `ProjetoViewModal.tsx`) | 5 (`/projects` CRUD) | `ProjectsController` | `ProjectsService` | `projects` |
| PROJECT_TRACK ("músicas") | embedded in `ProjetoFormModal.tsx` | none direct — nested in project create/update | `ProjectsController` (via `musicas[]` field) | `ProjectsService.hydrateMusicas/replaceMusicas` | `project_tracks` |
| PROJECT_TRACK_PARTICIPANT | embedded (compositores/intérpretes/produtores) | none direct | same | same | `project_track_participants` |
| PROJECT_ASSET | none (no frontend consumer found anywhere) | none (no controller found) | — | — | `project_assets` (orphaned table, see §9) |
| PROJECT_AI_PLANNING | none (invisible/internal, see §8) | N/A (event-driven) | — | `ProjectPlanningAutomation` | writes `projects.metadata.aiPlan` |

No `PROJECT_MEMBER`, `PROJECT_STAGE` (as a distinct concept from `status`), `PROJECT_MILESTONE`,
`PROJECT_DELIVERABLE`, `PROJECT_BUDGET` (as a category breakdown), or `PROJECT_ATTACHMENT` subdomain
exists anywhere in the codebase — none of these were invented; all are genuinely absent, confirmed by
exhaustive grep across `apps/web`, `apps/api`, `packages`.

## 2. Tables / entities

| Table | Cols | Notes |
|---|---|---|
| `projects` | 16 | `id, tenant_id, titulo, tipo, status, artista_id, orcamento, descricao, observacoes, genero, metadata, created_at, updated_at, deleted_at, created_by, updated_by`. Confirmed 1:1 against `database-backend-column-mapping.json` — all `DIRECT`, zero drift, zero CODE_FIELD_ONLY/DATABASE_COLUMN_ONLY. `titulo` was renamed from `nome` by migration `20260718000013`. |
| `project_tracks` | 14 | Real child table, replaces the old `musicas[]` JSON blob previously serialized into `projects.descricao`. FK `project_id → projects.id` (CASCADE), real. |
| `project_track_participants` | 6 | Real grandchild table (compositor/interprete/produtor). FK `project_track_id → project_tracks.id` (CASCADE), real. |
| `project_assets` | 7 | `id, tenant_id, project_id, asset_id, role, source_event, linked_by, created_at`. **No physical FK** on `project_id`/`asset_id` despite the naming (confirmed in mapping JSON). **No controller, service, or frontend consumer found anywhere** — a fully orphaned table (see §9). |

## 3. Components

| Component | File | Classification |
|---|---|---|
| `Projetos.tsx` | `pages/Projetos.tsx` | TABLE + FILTER + SEARCH + SORT + KPI_CARD |
| `ProjetoFormModal.tsx` | `components/ProjetoFormModal.tsx` | CREATE_MODAL + EDIT_MODAL (mode-switched, single component) |
| `ProjetoViewModal.tsx` | `components/ProjetoViewModal.tsx` | DETAIL_MODAL + workflow-transition UI (`WorkflowTransitionPanel`) |
| Audio upload control (inside `ProjetoFormModal.tsx`) | same file | UPLOAD — **STUB** (see §8, `uploadFile` is a hardcoded no-op) |
| `DeleteConfirmModal` (shared, reused) | shared component | OTHER_DATA_CONSUMER |

No Kanban, Gantt, Timeline, Calendar, Wizard, or Drawer component exists for this module.
`hooks/projects.store.ts` (Zustand) and `services/projects.service.ts` — both **DEAD** (grep-confirmed
zero consumers anywhere in `apps/web/src`; the real page uses `useProjetos`/`useDataQuery` instead).

## 4. Hooks

| Hook | File | Endpoints | Read fields | Write fields | Realtime | Auth/Tenant |
|---|---|---|---|---|---|---|
| `useProjetos` | `hooks/useProjetos.ts` | `GET/POST/PATCH/DELETE /projects` (via `useDataQuery`+`storage`) | all `ProjetoWithRelations` fields, plus client-mocked joins (`artistas(*)`, `obras(id,titulo,status)` — `select` string is a legacy Supabase-era param, unused in real HTTP mode, joins never actually happen server-side; `Projetos.tsx` manually re-injects the artist relation client-side, see §11) | `titulo, tipo, status, observacoes, genero, musicas[]` (create); same minus nothing on edit | none | implicit via JWT/tenant middleware, not hook-level |

`useEntityDetail('projetos', id)` (shared hook, used by `ProjetoViewModal`) and
`useWorkflowTransition({table:'projetos', ...})` (shared hook) are the only other data hooks touching
this module — both real, both correctly wired to `GET /projects/:id` and the workflow transition path
respectively.

## 5. Create Project — field mapping

| UI Label | Form field | Required | API field | Backend field | DB column | Persisted |
|---|---|---|---|---|---|---|
| Tipo de Lançamento | `tipoLancamento` | yes | `tipo` | `tipo` | `projects.tipo` | YES |
| Nome do EP/Álbum (conditional) / Nome da Música | `nomeEP` / `musicas[0].nome` | yes | `titulo` | `titulo` | `projects.titulo` | YES |
| Observações | `observacoes` | no | `observacoes` | `observacoes` | `projects.observacoes` | YES |
| Status | `status` (defaults `planejamento`) | — | `status` | forced to `PLANEJAMENTO` server-side on create (`ProjectsService.create()` always overwrites) | `projects.status` | YES |
| (derived) Gênero | first track's `genero` | no | `genero` | `genero` | `projects.genero` | YES |
| Músicas (nested) | `musicas[]` (nome/soloFeat/originalRemix/instrumental/duração/gênero/idioma/letra/audioUrl/compositores/intérpretes/produtores) | partial (per-track required labels shown with `*` but **not enforced** — `projetoSchema` Zod validation only checks `tipoLancamento/nomeEP/status/observacoes`, not track sub-fields) | `musicas[]` | `ProjectsService.replaceMusicas()` | `project_tracks` + `project_track_participants` | YES |
| Arquivo de Áudio | `arquivoAudio` (File metadata only) | no | — | — | — | **NO — UI_ONLY, see §8** |

Fields declared in `CreateProjectDto` but **never sent by the only reachable create form**:
`artista_id`, `orcamento`, `metadata` — classified `UI_ONLY` from the API's perspective / permanently
`NULL` from the DB's perspective for every project ever created through the real UI. Not a
DTO/entity mismatch (both DTO and entity agree these fields exist) — a **REAL_MAPPING_GAP**: the field
exists end-to-end in the contract but has no reachable UI writer.

## 6. Edit Project — field mapping

Same component (`ProjetoFormModal.tsx`, `mode="edit"`), same field set as Create. `CREATE_SUPPORTED` /
`EDIT_SUPPORTED` identical for every field — **Create = Edit is confirmed true** for this module (no
divergence found, unlike the explicit instruction not to presume this — verified, not assumed).
`IMMUTABLE_AFTER_CREATE`: none — every writable field remains editable. One behavioral asymmetry: on
edit, `status` is a **raw, unrestricted 4-option `<Select>`** (`planejamento/em_andamento/concluido/
cancelado` — **missing `revisao`**, the 5th real `ProjectStatus` enum value) sent directly via `PATCH`,
which the backend then runs through the real workflow engine (`WorkflowService.transitionInTx`, see
§7) — an invalid jump (e.g. `planejamento`→`concluido` directly) will be **rejected server-side**, but
the form gives the user no indication of which transitions are actually legal, unlike `ProjetoViewModal`
which correctly renders only `allowed_transitions` via `WorkflowTransitionPanel`. Classified
`WORKFLOW_GAP: PARTIAL` (real backend enforcement exists; frontend edit form doesn't respect it).

## 7. Status & Workflow — REAL_WORKFLOW

`ProjectStatus` enum (`packages/types/src/enums.ts:275-281`): `PLANEJAMENTO, EM_ANDAMENTO, REVISAO,
CONCLUIDO, CANCELADO` — 5 values, all real, all used identically frontend/backend/DB (no enum drift).

Real state machine registered in `apps/api/src/core/workflow/definitions/projects.workflow.ts` and
bootstrapped via `workflow.bootstrap.ts`:

| Source | Target | UI Action | Roles | Backend validation |
|---|---|---|---|---|
| planejamento | em_andamento | "Iniciar Projeto" | super_admin/tenant_owner/owner/admin/manager/produtor | `WorkflowService.transitionInTx` |
| em_andamento | revisao | "Enviar para Revisão" | same + produtor | same |
| revisao | em_andamento | "Solicitar Alterações" | super_admin/tenant_owner/owner/admin/manager | same |
| revisao | concluido | "Concluir Projeto" | same | same |
| planejamento\|em_andamento\|revisao | cancelado | "Cancelar Projeto" | same | same |

Classified `REAL_WORKFLOW` (not `FIELD_ONLY`) — confirmed by `ProjectsService.update()` routing every
status change through `WorkflowService.transitionInTx()` inside a DB transaction, and by
`ProjectsController.findById()`/`.update()` returning real `allowed_transitions` computed server-side
per actor role, correctly consumed by `ProjetoViewModal.tsx`'s `resolveAllowedTransitions()` (server is
authoritative; local mirror is a mock-mode-only fallback). Side effect: reaching `CONCLUIDO` emits
`DOMAIN_EVENTS.PROJECT_COMPLETED`, consumed by **two** real listeners (§8, §17).

## 8. PROJECT_AI_PLANNING — critical broken-automation finding

`ProjectPlanningAutomation` (`apps/api/src/core/automation/project-planning.automation.ts`) listens for
`DOMAIN_EVENTS.PROJECT_COMPLETED` and, for musical-type projects, calls `AIService` to generate an
operational plan (departments/goals/deadline-aware), saved into `projects.metadata.aiPlan`. This is a
**real, non-trivial AI feature** — but its `loadProject()` method (lines 107-121) issues raw SQL:

```sql
SELECT nome, tipo, descricao, artista_id, data_fim, metadata
  FROM projects WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL LIMIT 1
```

**Both `nome` and `data_fim` are stale/non-existent column references.** Migration
`20260718000013_ProjectsFormFieldAlignment.ts:76` executed `ALTER TABLE "projects" RENAME COLUMN "nome"
TO "titulo"` — confirmed the physical column has been `titulo` since that migration; and `data_fim` was
**never** a column on `projects` at any point (absent from the entity, absent from every migration that
created/rebuilt the table). Every real completion of a musical project (`REVISAO`→`CONCLUIDO`, the one
legitimate workflow path) fires this query, which will throw a Postgres "column does not exist" error.
The surrounding `runNativeSkillAutomation` runner is explicitly designed to fail safely (per the file's
own header comment: *"falha da IA nunca reverte project.completed"*) — so the project completion itself
still succeeds — but the AI planning feature is **100% non-functional**, silently, for every single
invocation. Classified a critical `REAL_MAPPING_GAP` (raw SQL never updated after the July 2026 column
rename/rebuild migrations that every other project-related query in the codebase was updated for).

Separately, `ProjetoFormModal.tsx`'s audio-upload control is a **hardcoded stub**:
`const uploadFile = async (_file: File): Promise<{ url: string } | null> => null;` (line 178) — always
returns `null`. `handleAudioUpload()` shows the file's name/size as if attached
(`arquivoAudio: {name, size}`) and displays a "carregado localmente" toast, but the file itself is never
uploaded anywhere, never converted to a blob URL, never persisted — the in-memory `File` object metadata
disappears the moment the modal closes. `musica.audioUrl` remains `undefined` unless the user manually
pastes one or it arrived via a prior import. Classified `FILE_STORAGE_GAP` (more severe than the
`blob:`-URL pattern found in `musicchat.md` — here there isn't even an ephemeral client-side reference,
just decorative UI state that vanishes).

## 9. `project_assets` — orphaned table

`ProjectAssetEntity`/`project_assets` (7 columns: `project_id, asset_id, role, source_event, linked_by`
+ audit) has **zero backend controller, zero service, and zero frontend consumer** anywhere in the
codebase (exhaustive grep across `apps/api/src/modules`, `apps/web/src`). It is pure dead schema — not
wired to anything, not reachable through any endpoint. No physical FK exists on either `project_id` or
`asset_id`, so even direct SQL access wouldn't guarantee referential integrity. Classified
`REAL_MAPPING_GAP` (table exists, contract to use it does not).

## 10. Table / Grid (`Projetos.tsx`)

| Column | Label | API field | DB column | Derived | Sortable | Filterable | Searchable |
|---|---|---|---|---|---|---|---|
| (checkbox) | — | — | — | — | no | no | no |
| Título da Música | title+artist+cover | `titulo`, `artistas.nome_artistico` (client-injected, §11), `capa_url\|foto_url\|cover_url` | `projects.titulo` | cover image field is **dead** — none of `capa_url`/`foto_url`/`cover_url` exist on `ProjectEntity`; defensively coded, always falls back to a static Music icon | client-side only (list sorted by `titulo` always, no column-header sort) | — | yes (client-side substring) |
| Tipo | type badge | `tipo` | `projects.tipo` | no | no | yes (client) | no |
| Compositores/Intérpretes/Produtores | credit summary | derived from `musicas[0]` | `project_tracks`/`project_track_participants` (first track only) | yes — `getFirstMusicaInfo()` | no | no | yes (client) |
| Gênero | genre | `genero` (direct) or first-track fallback | `projects.genero` | partial | no | yes (client) | yes (client) |
| Status | status badge | `status` | `projects.status` | no | no | yes (client) | no |
| Ações | view/edit/delete | — | — | — | — | — | — |

All filtering/searching/sorting is **100% client-side** over whatever the initial unfiltered
`GET /projects` response contains — no query params are ever sent (`useProjetos()` calls `storage.list`
with no `filters`). See §12 truncation finding.

## 11. Artist ↔ Project relation

`PROJECT_FIELD: artista_id` (real uuid FK, nullable) → `ARTIST_RESOURCE: artistas.id`. `CARDINALITY:
many projects : 1 artist (optional)`. **CREATE_USAGE: NONE** — confirmed zero occurrences of
`artista_id`/`artistaId` anywhere in `ProjetoFormModal.tsx` (770 lines, read in full — no artist selector
exists at all). **EDIT_USAGE: NONE** (same form). **DISPLAY_USAGE**: `Projetos.tsx` injects the relation
manually client-side (`artistas ?? (artista_id ? map[artista_id] : undefined)`, lines 36-43) purely to
compensate for the fact the real HTTP API doesn't do the join the legacy `select` string implies — but
since `artista_id` is always `NULL` in practice, this client-side join always resolves to `undefined`.
Two concrete, evidenced downstream breakages:
1. `Projetos.tsx`'s own "Artista" filter dropdown (`artistaFilter`, line 91: `project.artista_id ===
   artistaId`) can never match any real project — filtering by any specific artist always yields zero
   results.
2. `ArtistaVisao360Modal.tsx:372` — `projetosReais = projetos.filter(p => p.artista_id === artistaId)` —
   the Artist 360 profile's "Projetos" count/list (displayed at lines 1036-1038, 2002-2004, 2169-2173)
   is **permanently zero** for every artist in the system, regardless of how many projects a human would
   consider "theirs" via track credits.

`ARTIST_PROJECT_TRACEABILITY_COMPLETE: SIM` (the relation is now fully traced and its brokenness fully
documented — "complete" here means the audit is done, not that the feature works).

## 12. Client / CRM ↔ Project

**NOT_APPLICABLE** — `projects` has no client/customer/contact field at all (no `cliente_id`,
`contact_id`, or equivalent on `ProjectEntity`). Confirmed by direct entity inspection; not invented.

## 13. Tasks ↔ Project

**NOT_APPLICABLE** — no `tasks` module/table exists anywhere in the codebase (confirmed by grep); no
task-count or completion-source field exists on `projects`. Per the prompt's own instruction, not
audited further since `tasks` has not itself been audited.

## 14. Milestones / Deliverables / Stages (as distinct concepts) / Members / Kanban

All **NOT_APPLICABLE** — none of these concepts exist anywhere in the codebase for `projects` (no
tables, no entities, no UI). The only "stage-like" concept is the `status` field itself, already fully
covered as a real workflow in §7 (`STAGE_MAPPING_GAP: N/A`, `KANBAN_PERSISTENCE_GAP: N/A`,
`MEMBER_MAPPING_GAP: N/A`, `MILESTONE_GAP: N/A`, `DELIVERABLE_GAP: N/A`).

## 15. Progress

**PROGRESS_CALCULATION_GAP: NOT_IMPLEMENTED** — no progress percentage, bar, or derived completion
metric exists anywhere for a `project` (no `progress` field on the entity, no formula in any service or
component). The only completion-adjacent signal is the binary `status` field.

## 16. Deadlines

**NOT_PRESENT on the `projects` table itself** — no `start_date`, `end_date`, `deadline`, `due_date`, or
`completed_at` column exists on `ProjectEntity` (confirmed by direct inspection). The only date fields
are `created_at`/`updated_at`/`deleted_at` (standard audit columns) plus the closure timestamp implicitly
recoverable from `updated_at` when `status` transitions to `concluido`/`cancelado` (not a dedicated
column). `ProjectPlanningAutomation`'s reference to `data_fim` (§8) is a **stale reference to a column
that never existed**, not evidence of a real deadline field.

## 17. Project ↔ Accounting (§26-27 of the prompt — mandatory)

`PROJECT_ID_AVAILABLE_FOR_ACCOUNTING: SIM` — `transactions.projeto_id` (real uuid column, confirmed
`DIRECT` in `accounting.md`'s Fase 1 audit, populated by the transaction form's `projetoVinculado` field
via `apps/web/src/modules/accounting/services/form-to-payload.mapper.ts:72`).
`TRANSACTIONS_LINKED_TO_PROJECT: SIM` (logically — the column is real, writable, and written by the real
UI) — but **no physical FK constraint** exists between `transactions.projeto_id` and `projects.id`
(confirmed `foreign_key: false` in the mapping JSON) — a **logical-only reference**, consistent with the
same pattern already found for `works.projeto_id` and `shares.artista_projeto_id`.

`PROJECT_NAME_SOURCE` (as actually consumed today): **NOT** `projects.titulo` — `Contabilidade.tsx`'s
"P&L por Projeto" tab uses `t.descricao` (the transaction's own free-text description) as the displayed
"project name," treating **each individual transaction as its own project**, per `accounting.md §2.5`
(quoted verbatim): *"`plPorProjeto` mapeia cada transação individualmente como se fosse '1 projeto'...
nunca faz GROUP BY/lookup em `projeto_id` nem junta com a tabela `projects`... apesar do rótulo 'P&L por
Projeto' prometer agregação por projeto."* `PROJECT_GROUPING_KEY`: **none is actually used** — the
column that should be the grouping key (`projeto_id`) exists, is populated, and is available, but is
never read by this specific report tab.

`PROJECT_ACCOUNTING_GROUPING_TRACEABILITY_COMPLETE: SIM` — confirmed from the `projects` side: the key
exists, is real, is writable end-to-end, and is simply unused by the one display surface that claims to
group by it. Nothing further to trace on the `projects` side; the gap is entirely in `accounting`'s
display layer (already documented there, not re-corrected here).

`ACCOUNTING_PROJECT_TRACEABILITY_COMPLETE: SIM`.

## 18. Project ↔ Budget

`projects.orcamento` (real `decimal(15,2)`, nullable column, in `CreateProjectDto`) exists but is
**never set by the only reachable create/edit form** — same `REAL_MAPPING_GAP` as `artista_id` (§5, §11).
No budget category breakdown, no "actual"/"committed"/"remaining" computation exists anywhere — the
single `orcamento` field, even if it were populated, has no consumer that reads it back (grep-confirmed
zero reads of `.orcamento` outside the entity/DTO/service pass-through). `BUDGET_ACTUAL_SOURCE: N/A`
(nothing computes an "actual" figure against it).

## 19. Project ↔ Contracts / Events / Inventory

**NOT_APPLICABLE** for all three — confirmed independently this module (not merely cited from prior
audits) by direct inspection of `ContractEntity` (`entities.ts:757-794`, no project field),
`EventEntity` (`entities.ts:1177-1207`, no project field), and `inventory_items`
(`entities.ts:2223-2246`, no project field). Consistent with `contracts.md`, `events.md`, `inventory.md`'s
own findings (cited, not re-audited).

`CONTRACT_PROJECT_TRACEABILITY_COMPLETE: NOT_APPLICABLE`.
`EVENT_PROJECT_TRACEABILITY_COMPLETE: NOT_APPLICABLE`.
`INVENTORY_PROJECT_TRACEABILITY_COMPLETE: NOT_APPLICABLE`.

## 20. Project ↔ Audiovisual

`AudiovisualProjectEntity.financial_project_id` (real composite FK → `(projects.tenant_id,
projects.id)`, added by migration `20260718000009_FinancialOperationalBridges.ts`, re-declared on every
subsequent table rebuild) **does** point to this module's `projects` table — resolved conclusively (not
presumed from the name), cross-checked against `audiovisual.md:161`'s own finding: *"FK real →
projects.id... não setado por nenhum form encontrado — coluna existe e tem integridade referencial real,
mas sem caminho de escrita visível."* Confirmed independently from the `projects` side: zero occurrences
of `financial_project_id` anywhere in `apps/web/src`, and neither `CreateAudiovisualProjectDto` nor any
audiovisual frontend form exposes a field for it. Real, unreachable FK.

`AUDIOVISUAL_PROJECT_TRACEABILITY_COMPLETE: SIM`.

## 21. Project ↔ Marketing

`MarketingProjectEntity` is a **separate concept** from this module's `ProjectEntity` — it has its own
table (`marketing_projects`), own CRUD (`MarketingProjectsController`), and represents a marketing
workspace, not a music-release project. Two real relations exist:
1. `marketing_projects.financial_project_id` — same pattern as audiovisual: real composite FK →
   `projects(tenant_id, id)`, added by the same migration, **never written by any frontend form**
   (confirmed: zero occurrences in `apps/web/src`).
2. `marketing_projects.source_project_id` — nullable uuid, **no physical FK** (logical-only per the
   mapping JSON) — likely intended to reference the same universal `projects` table but unenforced.

Also resolved a genuine ambiguity flagged as unclosed in `marketing.md §13`: `marketing_content_posts
.project_id` — confirmed via `apps/web/src/modules/marketing/services/marketing.service.ts:335,416,609`
that this column is consistently mapped to **`marketing_project_id`** (the marketing module's own
internal workspace concept) in every read path (`contentFromApi`, asset mapping) — it is **not** a
reference to this module's universal `projects` table at all, despite the ambiguous column name. This
closes the pendency: the column belongs entirely to the `marketing` domain's internal model, out of
scope for `projects`.

`MARKETING_PROJECT_TRACEABILITY_COMPLETE: SIM`.

## 22. Filters, Search, Sort, Pagination, Truncation

All covered in §10 — 100% client-side, executed only over the first page of results returned by
`GET /projects` with no filters/limit ever sent by the frontend.

**`TRUNCATION_GAP` — confirmed, significant**: `useProjetos()` → `storage.list("projetos", {filters,
orderBy})` sends **no `limit`/`offset`/pagination parameter at all**. `ProjectsService.list()` defaults
to `take(q['limit'] ?? 50)`, `ORDER BY created_at DESC`. Effect: if a tenant has more than 50 projects,
`Projetos.tsx` will silently only ever see the 50 most-recently-created ones — every client-side filter
(status/artist/type/genre/search), every KPI card (`ativos/concluidos/rascunhos/total`, computed
directly from the same truncated `projetos` array, lines 165-170), and the genre-options dropdown
(derived from the same truncated set) are **all computed over an incomplete dataset** with **no
indication to the user that truncation occurred** (no "showing 50 of N" messaging exists — the visible
`TablePagination` component paginates the *already-truncated* client-side array, not the true total).
`AFFECTS_TOTAL: SIM`, `AFFECTS_FILTER: SIM`, `AFFECTS_PROJECT_PROGRESS: N/A` (no progress feature),
`AFFECTS_FINANCIAL_TOTAL: N/A` (KPIs here are counts, not sums).

Separately, `QueryProjectDto` (backend) declares `type`/`artistId` (camelCase) as its filter fields, but
`ProjectsService.list()` reads `q['tipo']`/`q['artista_id']` (snake_case/Portuguese) — a genuine
DTO-vs-service field-name mismatch on the **query/filter path**. It has **zero observable effect today**
because the real UI never sends any filter query param at all (confirmed above) — recorded as a latent,
currently-dormant `REAL_MAPPING_GAP` for completeness, not as a currently-user-visible bug.

## 23. Import / Export / XLSX

**NOT_PRESENT** — no import, export, or XLSX flow exists for `projects` (confirmed by targeted grep;
`Projetos.metadata-guard.test.ts:32` even contains an explicit regression guard: `expect(SOURCE)
.not.toMatch(/importXlsx/)`, confirming this absence is deliberate, not merely undiscovered).
`XLSX_EXPORTS: 0`, `XLSX_RULE_VIOLATIONS: 0`.

## 24. Delete / Archive / Complete

| Action | UI | Endpoint | DB behavior | Soft/Hard |
|---|---|---|---|---|
| Delete | `Projetos.tsx` row menu / bulk delete | `DELETE /projects/:id` | `deleted_at = NOW()` | SOFT |
| Complete | Workflow transition "Concluir Projeto" (ViewModal) or raw Status select (FormModal, §6) | `PATCH /projects/:id` (`status=concluido`) | workflow-validated status UPDATE | — |
| Cancel | Workflow transition "Cancelar Projeto" | `PATCH /projects/:id` | workflow-validated status UPDATE | — |
| Reopen/Restore | **none exists** | — | — | N/A |

No FK-cascade concern exists on delete: `project_tracks`/`project_track_participants` cascade-delete at
the DB level (real `ON DELETE CASCADE` per the mapping JSON), but the service's soft-delete only ever
sets `deleted_at` on the parent `projects` row — child `project_tracks` rows are **never soft-deleted or
hidden**, they simply become orphaned-but-still-queryable rows under a soft-deleted parent (a minor,
low-severity `REAL_MAPPING_GAP` — `hydrateMusicas()` is only ever called for non-deleted parents found
via `findById`/`list`, so this has no visible effect in the real UI, but direct DB queries on
`project_tracks` would see stale data). `TASK_IMPACT/CONTRACT_IMPACT/EVENT_IMPACT`: N/A (no such
relations exist, §13/§19). `FINANCIAL_IMPACT`: none enforced (no cascade or restriction on
`transactions.projeto_id`, consistent with it being a logical-only, unconstrained reference).

## 25. Duplicidade

**NOT_PRESENT** — no unique constraint, backend duplicate check, or frontend duplicate-prevention UI
exists for `projects` (by title, artist, or any other field). Confirmed absent, not undiscovered.

## 26. Realtime

**NOT_PRESENT** — `ProjectsService`/`ProjectsController` inject neither `EventsService` nor
`RealtimeService`... correction: `ProjectsService` does inject `EventsService` but **only** to emit
`DOMAIN_EVENTS.PROJECT_COMPLETED` (an internal `EventEmitter2` event, §7/§8/§27) — it never calls
`RealtimeService`/`sendToTenant`, and no frontend file in `modules/projects/**` calls `useWsEvent`.
`REALTIME_EVENTS: 0`.

## 27. Notifications

**NOT_PRESENT directly** — `projects` itself triggers no notification. Indirectly, `PROJECT_COMPLETED`
fans out to two real internal listeners: `ProjectPlanningAutomation` (§8, broken) and
`MarketingProjectsService.createFromCompletedProject()` (confirmed real and working in `marketing.md`,
not re-audited here) — neither is a user-facing notification, both are automations. Not re-auditing the
`notifications` module itself per the prompt's instruction.

## 28. Permissions & Tenant Isolation

All 5 `ProjectsController` endpoints carry both `@RequireRole` (viewer/editor/editor/manager tiers,
correctly scoped — delete requires `manager`) and `@RequirePermission('project:read'|'create'|'update'|
'delete')`, confirmed real (non-decorative) RBAC permission strings seeded in
`apps/api/src/database/seeds/04_rbac_seed.ts`. `AUTHORIZATION_GAPS: 0`.

Every `ProjectsService` method that touches `projects`/`project_tracks`/`project_track_participants`
includes an explicit `tenant_id` predicate (`list`, `findById`, `create`, `update`, `softDelete`,
`hydrateMusicas` — scoped implicitly via already-tenant-filtered parent `projects` rows,
`replaceMusicas` — explicit `tenant_id` on delete+insert). `TENANT_ISOLATION_GAPS: 0`.

## 29. `Auditoria.tsx` — Projects section

`AUDITORIA_TSX_PROJECTS_SECTION_COMPLETE: SIM` — section confirmed present. Tab config
(`Auditoria.tsx:53`): `{ id: "projetos", label: "Projetos", module: "projects" }`. Real completeness
rules (`apps/web/src/shared/lib/audit/runner.ts:56-69`):

```
table: "projetos", entityType: "Projeto"
fields:
  titulo      — obrigatorio
  tipo        — obrigatorio
  status      — obrigatorio
  genero      — recomendado
  artista_id  — recomendado
```

**Confirmed consequence of §11's finding**: since `artista_id` is never set by the only reachable
create/edit form, the "Artista vinculado" recommendation is **permanently unresolvable** for every
project in the system through normal use — a direct, evidenced `AUDITORIA_PROJECT_GAPS` finding, not
merely a theoretical one.

`AUDITORIA_PROJECT_FIELDS`: `titulo, tipo, status, genero, artista_id` (5, matches Create §5 exactly for
the 4 always-persisted fields + the 1 permanently-empty one).
`AUDITORIA_PROJECT_DATABASE_SOURCES`: `projetos` (→ `projects` table via standard API resolution).
`AUDITORIA_PROJECT_RULES`: field-presence only, no relation/cross-table checks.

## 30. Gap taxonomy summary

| Gap type | Count | Detail |
|---|---|---|
| CODE_FIELD_ONLY | 0 | — |
| DATABASE_COLUMN_ONLY | 0 | — |
| ENUM_MISMATCH | 0 | `ProjectStatus` identical across layers |
| RELATION_MISMATCH | 0 | — |
| CREATE_MAPPING_MISMATCH | 0 | no DTO/entity/field-name mismatch on create |
| EDIT_MAPPING_MISMATCH | 0 | — |
| DISPLAY_MAPPING_MISMATCH | 1 | `capa_url`/`foto_url`/`cover_url` referenced in table, none exist on entity (§10) |
| WORKFLOW_GAP | 1 | PARTIAL — real backend enforcement, frontend edit form doesn't restrict input to legal transitions (§6) |
| FILE_STORAGE_GAP | 1 | audio upload is a hardcoded no-op stub (§8) |
| PROGRESS_CALCULATION_GAP | 1 | NOT_IMPLEMENTED, confirmed absent not invented (§15) |
| FINANCIAL_INTEGRATION_GAP | 1 | `orcamento` never written, never read back (§18) |
| PROJECT_ACCOUNTING_GROUPING_GAP | 1 | real key exists+populated, unused by the one display that claims to group by it — documented on `accounting` side, re-confirmed from `projects` side (§17) |
| TRUNCATION_GAP | 1 | default `limit=50`, no pagination params ever sent, affects filters+KPIs (§22) |
| REAL_MAPPING_GAP | 5 | `artista_id`/`orcamento` unreachable (§5,§11,§18); `project_assets` fully orphaned (§9); `ProjectPlanningAutomation` raw-SQL stale columns (§8, critical); query DTO field-name mismatch, currently dormant (§22) |
| DUPLICATE_HANDLING_GAP | 0 | N/A, confirmed absent |
| AUTHORIZATION_GAP | 0 | — |
| TENANT_ISOLATION_GAP | 0 | — |
| REALTIME_GAP | 0 | N/A, no realtime surface exists for this module (not a gap — nothing claims to be realtime) |

`UNMAPPED_*: 0` across every category. `UNKNOWN_FIELD_CLASSIFICATIONS: 0`.

## Contadores finais (Zero-Gap)

```
MODULE_STATUS: COMPLETE
PROJECT_DOMAIN_MEANING: UNIVERSAL_FINANCIAL_PROJECT (schema) / MUSIC_RELEASE_PROJECT (only real UI)
SUBDOMAINS_AUDITED: 5
COMPONENTS_AUDITED: 5
HOOKS_AUDITED: 3
CREATE_FIELDS: 8 (5 persisted-reachable + 3 REAL_MAPPING_GAP unreachable)
EDIT_FIELDS: 8 (identical to create)
PROJECT_TYPES: 4 (album, ep, single, turne — UI) vs 7 declared server-side (TYPES const also allows video/tour/podcast/other, unreachable via UI)
STATUS_VALUES: 5
WORKFLOW_TRANSITIONS: 5
TABLE_GRID_FIELDS: 7
DETAIL_DISPLAY_FIELDS: 9
RELATION_FIELDS: 3 (artista_id, financial_project_id x2 via audiovisual/marketing)
KPI_FIELDS: 4
FILTERS: 4
SEARCH_FIELDS: 1
XLSX_EXPORTS: 0
XLSX_RULE_VIOLATIONS: 0
REALTIME_EVENTS: 0
AUTHORIZATION_GAPS: 0
TENANT_ISOLATION_GAPS: 0
DISPLAY_MAPPING_MISMATCH: 1
WORKFLOW_GAPS: 1
FILE_STORAGE_GAPS: 1
PROGRESS_CALCULATION_GAPS: 1
FINANCIAL_INTEGRATION_GAPS: 1
PROJECT_ACCOUNTING_GROUPING_GAPS: 1
TRUNCATION_GAPS: 1
REAL_MAPPING_GAPS: 5
PROJECT_ID_AVAILABLE_FOR_ACCOUNTING: SIM
TRANSACTIONS_LINKED_TO_PROJECT: SIM
PROJECT_ACCOUNTING_GROUPING_TRACEABILITY_COMPLETE: SIM
ACCOUNTING_PROJECT_TRACEABILITY_COMPLETE: SIM
ARTIST_PROJECT_TRACEABILITY_COMPLETE: SIM
CONTRACT_PROJECT_TRACEABILITY_COMPLETE: NOT_APPLICABLE
EVENT_PROJECT_TRACEABILITY_COMPLETE: NOT_APPLICABLE
AUDIOVISUAL_PROJECT_TRACEABILITY_COMPLETE: SIM
MARKETING_PROJECT_TRACEABILITY_COMPLETE: SIM
INVENTORY_PROJECT_TRACEABILITY_COMPLETE: NOT_APPLICABLE
AUDITORIA_TSX_PROJECTS_SECTION_COMPLETE: SIM
UNMAPPED_FIELDS: 0
UNKNOWN_FIELD_CLASSIFICATIONS: 0
```

NEXT_MODULE: releases
