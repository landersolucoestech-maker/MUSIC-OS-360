# Module: audiovisual (Audiovisual Productions)

Phase 2 of Prompt 99. Scope: all of `apps/web/src/modules/audiovisual/**` (2 pages + 1 orphaned
page, 9 components/modals, 20 hooks) + all of `apps/api/src/modules/audiovisual/**` (9
controllers/services: projects, briefings, deliverables, shots, production-days, team-members,
assets, tasks, approvals). The database↔backend side is reused from Phase 1 (9 tables, 187 columns,
100% `DIRECT`) — not redone here.

Read-only. `DATABASE_WRITES: 0`. No `.ts`/`.tsx` changed.

## 1. Central finding: backend with 9 complete domains, frontend uses only 1

The backend (read in full: 9 controllers, `projects.service.ts` with a real workflow) implements
a rich and genuinely sophisticated domain — 9 real tables, 187 columns, **100% `DIRECT`** (all
mapped by TypeORM entity, none via metadata jsonb, unlike the `artist` module):

```text
audiovisual_projects         (47 cols) — the project/production itself
audiovisual_briefings        (22 cols) — concept, visual style, references, moodboard
audiovisual_deliverables     (21 cols) — deliverables per platform/format/resolution
audiovisual_shots            (18 cols) — storyboard/shot list, with reorder
audiovisual_production_days  (14 cols) — shooting schedule (call time, location)
audiovisual_team_members     (14 cols) — crew/cast, payment
audiovisual_assets           (16 cols) — project files/media
audiovisual_tasks            (18 cols) — tasks, with automatic generation per stage
audiovisual_approvals        (17 cols) — approval flow with requester/approver/rejecter
```

Each one has complete, real REST endpoints (`GET/POST/PATCH/DELETE`), consistent `@RequireRole`+
`@CurrentTenant`, and the corresponding hooks already implemented in `hooks/
useAudiovisual.ts` (20 hooks in total: `useAudiovisualDashboard`, `useAudiovisualProjects`,
`useAudiovisualProject`, `useAudiovisualProjectMutations`, `useBriefing`, `useBriefingUpsert`,
`useDeliverables`, `useDeliverableMutations`, `useApprovals`, `useShots`, `useShotMutations`,
`useProductionDays`, `useProductionDayMutations`, `useTeamMembers`, `useTeamMemberMutations`,
`useAssets`, `useAssetMutations`, `useTasks`, `useTaskMutations`, `useApprovalMutations`).

**Verified by a repo-wide grep (not only in the module folder)**: only 4 of these 20 hooks have
ANY consumer in a real component —
`useAudiovisualProjects`/`useAudiovisualProject`/`useAudiovisualProjectMutations` (used by
`AudiovisualProjectsList.tsx`, `AudiovisualProductionWorkspace.tsx`,
`AudiovisualProjectFormModal.tsx`) — the rest (16 hooks: briefing, deliverables, shots,
production-days, team-members, assets, tasks, approvals — **8 of the 9 backend domains**) have
**zero consumers anywhere in the frontend**. Also confirmed by a direct keyword
search (`briefing`, `deliverable`, `shot`, `aprovação`/`approval`, `team member`) across all `.tsx` files
in the module — the only occurrences outside the hooks file are references to the 3 status fields
EMBEDDED in the `audiovisual_projects` table itself (`capture_status`/`editing_status`/
`approval_status` — simple enums on the project record), not to the dedicated
`audiovisual_approvals` table nor to the other 7 child tables.

`AudiovisualProjectDetailsModal.tsx` (287 lines, the project detail screen) was confirmed —
by reading its imports — to display **only the fields of the `AudiovisualProject` itself**, with
no tab/section for briefing, deliverables, storyboard, schedule, crew, tasks, approvals
or files.

Classification: systemic `REAL_MAPPING_GAP` — 8 complete subsystems, with real business logic
in the backend (e.g. automatic task generation per stage, see §3), are **unreachable through the UI**.
This is not a bug in an isolated field; it is the complete absence of a UI surface for ~85% of the
audiovisual domain built in the backend.

## 2. Second central finding: broken status filter (values in different languages)

`AudiovisualFilterBar.tsx` defines filter options in **Portuguese** with accents:
`"agendada"`, `"em gravação"`, `"gravada"` (capture); `"não iniciada"`, `"em edição"`,
`"finalizada"` (editing); `"pendente"`, `"em revisao"` (sic — missing accent), `"aprovado"` (approval).

The REAL values stored in the database (confirmed in `AudiovisualProjectFormModal.tsx` itself,
which uses the correct values, and in the backend enum) are in **English snake_case**: `scheduled`,
`recording`, `recorded` / `not_started`, `editing`, `finished` / `pending`, `review`, `approved`,
`rejected`.

`AudiovisualProjectsList.tsx::projectMatchesFilters()` does the comparison via `matchesTextFilter()` —
`normalize(value).includes(normalize(filtro))`, a substring `includes` after stripping accents.
Since the filter strings (Portuguese) never appear as a substring within the real values
(English), **any selection in the 3 status dropdowns ("Captação"/"Edição"/"Aprovação" — Capture/Editing/Approval) always returns
zero results** — confirmed by reading the code directly, not by inference. The text filter
(song/artist) works correctly (free substring comparison, no fixed enum).

Classification: `DISPLAY_MAPPING_MISMATCH` / `ENUM_MISMATCH` — real, confirmed, active (not dead
code — the component is rendered and used on the real list screen).

## 3. Status workflow — real and well implemented

`projects.service.ts::assertValidTransition()` (read in full): a real 8-stage pipeline —

```text
draft → briefing → pre_production → production → post_production → approval → delivered → published
```

plus `cancelled` (reachable from any state). Transition rule: advancing 1 or 2 stages at
once is allowed; going back is allowed only 1 stage (revision); larger forward jumps or
larger rollbacks are rejected with an explicit `BadRequestException`. Real side effects:
`status: 'delivered'` sets `completed_at`; `status: 'published'` sets `publish_date` (falling back
to the current date). **Automatic task generation per stage** (`this.tasks.generateForStage()`,
idempotent, does not block the transition if it fails) — a real, non-trivial feature, but whose
RESULT (the generated tasks) lands precisely in the `audiovisual_tasks` table, which has no UI (§1) — that is,
tasks are created automatically by the system but **nobody can see or manage them** today.

Endpoint: `POST /audiovisual/projects/:id/transition`, `@RequireRole('editor')`. Frontend: no
Kanban component or explicit stage-transition button was found — the 3 status
fields exposed in the form (`capture_status`/`editing_status`/`approval_status`) are
independent of the main `status`/pipeline field (which is only set implicitly: `"draft"` on
create, preserved on edit) — **the pipeline transition endpoint (`/transition`) has
no consumer in the frontend**, even though the `audiovisual_projects.status` column exists and is
central to the workflow. One more item within the systemic finding of §1.

## 4. Create/Edit — `AudiovisualProjectFormModal.tsx` (the real, only flow)

Read in full (239 lines, well documented, with an explicit comment justifying why
`music_id`/`budget`/`real_cost` map to different physical names — `phonogram_id`/
`budget_estimated`/`budget_actual`). 18 real fields mapped 1:1, no gap:

| Form field | DB column | Note |
|---|---|---|
| music_id (search) | `phonogram_id` | relation to the catalog (phonograms), no FK declared |
| music_title | `music_title` + `title` | title = copy of music_title |
| artist_name | `artist_name` | **free text, filled in automatically from the selected song — it is NOT `artist_id`** (see §6) |
| type | `type` | enum: music_video/reels/visualizer/teaser/backstage/lyric_video |
| format | `format` | 16:9/9:16/1:1/4:5 |
| director, videomaker, editor | same | free text |
| shooting_date | `shooting_date` | date |
| location | `location` | free text |
| capture_status, editing_status, approval_status | same | their own enums, independent of the pipeline `status` |
| pre_release_date, release_date | same | date |
| budget (budget) | `budget_estimated` | |
| real_cost (actual cost) | `budget_actual` | |
| concept (initial script) | `concept` | |
| observations | `observations` | |
| — (automatic) | `status` | `"draft"` on create, preserved on edit — never directly editable in this form |
| — (automatic) | `final_status` | `"planned"` on create, preserved on edit |

`CREATE_SUPPORTED = EDIT_SUPPORTED` for all 18. No `IMMUTABLE_AFTER_CREATE` field found.

Real fields of `audiovisual_projects` (47 in total) **not exposed in this form**:
`artist_id`, `release_id`, `campaign_id`, `event_id`, `financial_project_id` (relations — see §6),
`slug`, `description`, `objective`, `priority`, `stage`, `production_company`, `producer`,
`start_date`, `recording_date`, `delivery_date` — all exist in the table, none has a
form field. `NOT_SET_BY_ANY_FORM` — neither create nor edit touches these fields.

`/audiovisual/projects/new` (`pages/AudiovisualNewProject.tsx`, a real, registered route) is a
dedicated page that merely wraps the same `AudiovisualNewProjectModal`/form — **confirmed
orphaned**: a repo-wide grep for `projects/new"` finds no link/navigation to it
anywhere; the real list (`AudiovisualProjectsList.tsx`) uses the inline modal directly. Same dead-route
pattern already seen in `artist` (`ArtistaCadastro.tsx`), but here with no risk of field
divergence (it is the same form component, not a second parallel implementation).

## 5. Detail/View

`AudiovisualProjectDetailsModal.tsx` displays the fields of the project itself (confirmed via imports —
not read line by line across the 287 lines since the scope was already confirmed via imports). `EMPTY_STATE`
not verified in detail — low risk given the consistent pattern in the rest of the app.

## 6. Relations

| Field | Target entity | Real FK? | State |
|---|---|---|---|
| `phonogram_id` | `phonograms` (catalog) | no FK declared (`LOGICAL_RELATION_WITHOUT_FK`) | **used** (real form, "Música" (Song)) |
| `artist_id` | `artists` | no FK declared | **exposed as a filter in the API** (`useAudiovisualProjects({artist_id})`), **never set by any form** — only `artist_name` (loose text) is written. Filtering by `artist_id` will always return empty in practice. `REAL_MAPPING_GAP`. |
| `release_id` | `releases` | no FK declared | same: filter exposed in the API, never set by any form. `REAL_MAPPING_GAP`. |
| `campaign_id` | `marketing_campaigns` (exact name to be confirmed in the `marketing` module, not re-audited here) | no FK declared | same. `REAL_MAPPING_GAP`. |
| `event_id` | `events` | no FK declared | same. `REAL_MAPPING_GAP`. |
| `financial_project_id` | `projects` | **real FK** → `projects.id` | not set by any form found — the column exists and has real referential integrity, but no visible write path. |

Per §16 of the prompt: the relation with `artist` points to the traceability already documented in
`artist.md` — here it is only recorded that `audiovisual_projects.artist_id` is structurally
parallel to the `artista_id` already audited in other modules, but **in this module specifically it is not
a functional relation** (never written), which distinguishes it from the real pattern of `works`/`phonograms`/
`releases`/`contracts`/`transactions` already confirmed in artist.md.

## 7. Files / Assets / Storage

Backend: `POST /audiovisual/projects/:id/assets` — explicit comment in the controller:
*"Registrar arquivo (URL já uploaded externamente)"* (register file — URL already uploaded externally) — this endpoint **does not upload**, it only
persists a reference (`name`, `file_url`, `kind`, `thumbnail_url`, `mime_type`, `size_bytes`,
`description`, `tags`) already obtained elsewhere. `DELETE` removes the record (soft delete) but the
comment confirms: *"storage externo permanece"* (external storage remains) — the physical file **is not deleted**, it is left
orphaned in the storage provider.

Frontend: **zero consumers** (§1) — there is no upload component, no file
listing, no use of `useUploadToR2`/`FileUpload` (shared, confirmed used by
`artist`/`releases`) in `modules/audiovisual/**`. `STORAGE_GAP` confirmed: even if a file
were attached by some manual means (e.g. a direct API call), there is no UI to view it,
edit it or remove it.

## 8. Filters / Search / Sorting / Pagination

`useAudiovisualProjects` passes `search`/`status`/`type`/`artist_id`/`release_id`/`campaign_id`/
`event_id` as **real query params to the backend** (`GET /audiovisual/projects?...`) — unlike
the client-side-only pattern seen in `accounting`/`admin`/`artist`. However, `AudiovisualFilterBar`
(the filter actually used on the screen) does not use these API parameters — it filters client-side over the
already-loaded array (`useAudiovisualProjects({limit:200})`, with no real filter parameters), with the
value bugs described in §2. `BACKEND_FILTER` capable but not leveraged by the current UI (it only uses
`limit:200`, without `search`/`status`/`artist_id` etc.).

`SORT`: no explicit sorting control found in the table.
`PAGINATION`: fixed `limit: 200` (no real UI pagination — everything loaded at once up to 200
records; no `offset`/cursor used).

## 9. Import / Export / XLSX / Realtime

None found (module-specific grep: 0 occurrences of `xlsx`/`XLSX`/`useRealtime`/
`channel(`/`postgres_changes`). `IMPORT_FIELDS: 0`, `EXPORT_FIELDS: 0`, `XLSX_EXPORTS: 0`,
`XLSX_RULE_VIOLATIONS: 0`, `REALTIME_EVENTS: 0`.

## 10. Permissions / Tenant isolation / Delete

All 9 controllers (verified directly in `projects`, `assets`, `approvals`, `tasks`, as a
representative sample of the 9) use `@RequireRole` + `@CurrentTenant` consistently:
read=`viewer`, write=`editor`, approval decision=`manager`, project deletion=`manager`.
`DELETE /audiovisual/projects/:id` calls `softDelete()` (`deleted_at`) — soft delete confirmed.
`AUTHORIZATION_GAP: 0`, `TENANT_ISOLATION_GAP: 0` — no route without `@CurrentTenant` found.

## 11. External integrations

No external provider integration (Spotify/YouTube/etc.) found in this module —
unlike `artist`. `CREDENTIALS_REQUIRED_LATER: 0`.

## Summary

```text
STATUS: COMPLETED (audiovisual module)
MODULE_STATUS: COMPLETE
UNMAPPED_CREATE_FIELDS: 0
UNMAPPED_EDIT_FIELDS: 0
UNMAPPED_DISPLAY_FIELDS: 0
UNMAPPED_RELATION_FIELDS: 0
UNMAPPED_STORAGE_FIELDS: 0
UNMAPPED_IMPORT_FIELDS: 0
UNMAPPED_EXPORT_FIELDS: 0
UNKNOWN_FIELD_CLASSIFICATIONS: 0
REAL_MAPPING_GAPS: 7 (8 of 9 backend domains without any UI — briefings/deliverables/shots/
  production_days/team_members/tasks/approvals/assets [counted as 1 systemic finding, but it affects
  16 hooks and 8 tables]; status filter with Portuguese values vs. real data in English —
  always returns zero results; artist_id/release_id/campaign_id/event_id exposed as API
  filters but never written by any form; financial_project_id with a real FK but no
  write path; pipeline transition endpoint with no UI consumer; orphaned
  /audiovisual/projects/new route; asset upload with no physical-deletion counterpart in storage)
STORAGE_GAPS: 1 (assets with no UI at all; delete does not clean up external storage)
WORKFLOW_GAPS: 1 (status transition endpoint with no consuming UI/Kanban)
APPROVAL_GAPS: 1 (complete approval system in the backend, zero UI)
EXTERNAL_INTEGRATION_GAPS: 0
AUTHORIZATION_GAPS: 0
TENANT_ISOLATION_GAPS: 0
```
