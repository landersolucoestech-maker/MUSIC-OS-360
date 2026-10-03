# Release status census (BLK-RELEASES-STATUS-CHECK / D3)

Date: 2026-10-03. Mode: read-only analysis. Owner decision `deci-ed83c974`: D3 stays a GENUINE_BUSINESS_DECISION. This document does not implement `rejected`/`taken_down` as Release states and does not convert those rows to `cancelled`. Paths are relative to the repository root; line numbers refer to `dev` on 2026-10-03.

## 1. Current valid `ReleaseStatus` set

The canonical enum (`packages/types/src/enums.ts:172-183`) has 10 values: `draft`, `metadata_pending`, `assets_pending`, `review`, `approved`, `scheduled`, `distributed`, `released`, `archived`, `cancelled`.

| Layer | Evidence |
|---|---|
| PT-BR labels | `packages/types/src/status-labels.pt-br.ts:81-92` is a `Record<ReleaseStatus,string>`: a new enum value without a label is a compile error |
| API entity | `apps/api/src/database/entities.ts:1486`, `varchar(50)`, default `draft` |
| API DTO and filter | `apps/api/src/modules/releases/dto/releases.dto.ts:51-54` (`@IsEnum`), `:60-65` (filter list from `Object.values(ReleaseStatus)`); `release-contract.spec.ts:74-78` rejects PT values |
| Workflow | `apps/api/src/core/workflow/definitions/releases.workflow.ts:15-16` (`states: Object.values(ReleaseStatus)`), transitions `:19-96` |
| Web types | `apps/web/src/shared/types/enums.ts:21,147-148`; `apps/web/src/modules/releases/types/index.ts:58` (deliberately loose) |
| Web display taxonomy (a different type with the same name) | `apps/web/src/modules/releases/lib/release-status.tsx:14-21` has 7 display values (`pending`, `on_hold`, `rejected`, `distributed`, `approved`, `takedown`, `incomplete`); it is not the backend enum |
| AI skills (homonym) | `packages/ai-skills/src/release-checklist/contracts.ts:20-24` is a readiness score, unrelated to `releases.status` |
| Migrations | `20260928000019_CanonicalizeLegacyReleaseStatuses.ts:25-28,38-46` maps 18 legacy values and leaves `rejeitado`, `takedown`, `take_down`, `remocao` untouched; `20260930000014_BackfillReleaseStatusDefaultToDraft.ts:29-31,41-42,51,59` changes the default to `draft`, adds no CHECK |
| CHECK constraint | none: `chk_releases_status` only appears in comments (`20260928000019:27`, `20260930000014:31`); `takedowns` has `chk_takedowns_status` (`20260910000020_BackfillAndRestrictTakedownStatusToEnglish.ts:66-67`) as a precedent |

Migration 19 folds case and trims (`:62`); migration 14 matches exactly (`:59`).

## 2. Legacy values with no equivalent (`rejeitado`, `takedown`, `take_down`, `remocao`)

- Tolerated by the web display map only: `release-status.tsx:84-89` (`rejeitado` -> display `rejected`; the other three -> display `takedown`; anything else -> `incomplete`, `:107-108`); compat test `release-status.legacy-compat.test.tsx:7-18`; ledger rows in `docs/naming/canonical-naming-map.json`.
- Origin documented by the repository: only the pre-API web app (`20260928000019:15-17`).
- Current writers: none. The release form does not write status (`form-to-payload.mapper.ts:70`, test `:79-93`); the API accepts only enum values (`releases.dto.ts:51-54`) and creates releases as `draft` (`releases.service.ts:104`), changes go through the workflow (`:203-209`); the report contract has `status` read-only (`report-form-contracts.ts:425,431`); no import path writes it (`import-value-canonicalizers.ts:85` canonicalizes only `releases.type`); no migration writes them (only comments and negative assertions); no distributor flow writes `releases.status` (`domain-events.types.ts:243-251` is keyed by `submissionId`; `external-data-exchange.service.ts:526` only reads).
- Not evidenced: raw SQL or seeds outside the repository.

## 3. Quantity per value

Production and staging are not reachable from this environment and no credential was read: counts there are NOT_MEASURED. Exact read-only census (runbook `docs/runbooks/staging-to-production.md`, "Release status residue census"):

```sql
SELECT tenant_id, status, count(*) AS rows FROM releases
WHERE status IN ('rejeitado', 'takedown', 'take_down', 'remocao')
GROUP BY tenant_id, status ORDER BY tenant_id, status;

SELECT status, count(*) AS rows FROM releases GROUP BY status ORDER BY status;
```

The first query is an exact, case-sensitive match: it misses `Rejeitado`, `REJEITADO`, `rejeitado ` or `Take_Down` (migration 19 folds case and trims). The second query lists everything. Recommended variant for the owner pack: `WHERE lower(trim(status)) IN ('rejeitado','takedown','take_down','remocao')`.

| Value | Production | Staging | Disposable database |
|---|---|---|---|
| `rejeitado` | NOT_MEASURED | NOT_MEASURED | 0 |
| `takedown` | NOT_MEASURED | NOT_MEASURED | 0 |
| `take_down` | NOT_MEASURED | NOT_MEASURED | 0 |
| `remocao` | NOT_MEASURED | NOT_MEASURED | 0 |
| each canonical value | NOT_MEASURED | NOT_MEASURED | 0 |

The disposable database has 0 releases and 0 CHECK constraints on `releases`; the column default is `'draft'`. This proves the schema state only.

## 4. Relation with Distribution and Takedown

A Release is not a Distribution (runbook, same section). In the API they are separate; they are blurred only in the web display layer.

- `TakedownEntity` (`entities.ts:1587-1611`) has its own `status: TakedownStatus` (`pending|sent|processing|in_progress|completed|rejected|failed`, `packages/types/src/enums.ts:297-305`) and no `release_id`; the takedown flow is event-driven (`events.service.ts:138,233`, `notification.handler.ts:103,140,167`) and never touches `releases.status`. A takedown rejection is already modeled in `takedowns`.
- There is no distribution module; `releases.distributor` is a column and `DISTRIBUTED` is a Release state (`releases.workflow.ts:69-72`, event at `releases.service.ts:248-263`). `platform_status` and `internal_status` are not columns of `releases` (`release-status.tsx:113`).
- Confusion points: `release-status.tsx:14-21,30-31,56-58,91-95` (display values `rejected`/`takedown` exist only from the platform mapping and the 4 legacy values, and are not filterable); `:121-127` (`platform_status` overrides `status`: dead for current API data); `useReleasesPaginated.ts:81` (KPI `waitingAction` counts them); `notifications.service.ts:42,90-105` (`release.rejected` event, no caller); `Releases.tsx:263,360`, `ReleaseViewModal.tsx:218`; `report-module-registry.ts:26` (labels the table "Distribuição").

## 5. Consumers of release status

- API: entity `entities.ts:1486`; create `releases.service.ts:104`; filter `:37`; stats `GROUP BY` `:60-76`; workflow update `:~190-230` with events at `:213,233,248,264` and no event for cancelled/rejected/taken down; allowed transitions `:88`; workflow `releases.workflow.ts:12-96` and specs `releases.workflow.spec.ts`, `workflow-role-matrix.spec.ts:116-147`; external-data export `external-data-exchange.service.ts:526` (raw pass-through); report contract `report-form-contracts.ts:425-431`. The release-checklist, launch-strategy, marketing-calendar-builder and audiovisual-briefing automations do not select `status`. Queues carry no release status. Generic report-engine filters over `releases.status` were NOT_VERIFIED.
- Types: `enums.ts:172`, `status-labels.pt-br.ts:81-92,329`.
- Web: `lib/release-status.tsx` (`:67-78`, `:84-89`, `:96-100`, `:103-105`), `hooks/useReleasesPaginated.ts:77-81`, `ReleaseFormModal.tsx:56,1481`, `ReleaseViewModal.tsx:34,267`, `ArtistVision360Modal.tsx:107,2049`; tests `release-status.test.ts:16-26`, `release-status.legacy-compat.test.tsx`.
- AI skills: the homonym `ReleaseStatus` (readiness score) is unrelated; it is a separate naming finding, not part of D3.

## 6. Consequences of each option (neither is implemented)

### Option A: add `rejected` and `taken_down` to `ReleaseStatus`

- Types: 2 enum values (`enums.ts:172-183`) and 2 labels (`status-labels.pt-br.ts:81-92`, compile error otherwise); the web type follows; `packages/types/dist` needs a rebuild.
- API: the DTO and filter accept them automatically (`releases.dto.ts:53,60`); new workflow transitions, roles and events are needed (`releases.workflow.ts`, `workflow-role-matrix.spec.ts`, `releases.service.ts:233-278`); `states: Object.values(ReleaseStatus)` makes them valid states at once; terminal and cancellation rules must be restated (today `cancelled` is reachable only from pre-`scheduled` states, `:81-90`).
- Web: map them in `release-status.tsx:67-78`; `release-status.test.ts:16-26` requires every backend status to map; `rejected`/`takedown` would become filterable; revise the legacy test (line 11); the KPI bucket then counts real states.
- Data: migration `rejeitado` -> `rejected`; `takedown`/`take_down`/`remocao` -> `taken_down`, keeping `metadata.legacy_status` (pattern of `20260928000019:59-63`), whitelisted `down()`, then `chk_releases_status` with 12 values, only after a census shows 0 rows outside the set and after the code that knows the values is deployed; case and whitespace variants must be handled.
- Compatibility window: the old web build maps canonical `rejected`/`taken_down` to `incomplete`; an app rollback after the data migration mislabels those rows.
- External contract: `external-data-exchange.service.ts:526` would emit the new values.
- Risks: asserts as business fact that a Release can be rejected or taken down, which can duplicate Distribution/Takedown state (`takedowns` already has `rejected`): two sources of truth is a naming-canonical finding; new edges need RBAC and audit decisions.
- Reversibility: while `metadata.legacy_status` is kept and no user moved rows to the new states; after that, `down()` only reverts rows still holding the canonical value; removing enum values after production use is a destructive data change (L5).
- Tests to change: `release-status.test.ts`, `release-status.legacy-compat.test.tsx`, `releases.workflow.spec.ts`, `workflow-role-matrix.spec.ts`, `release-contract.spec.ts`; new migration spec and a verify script (precedent `verify-cz042-cz043-migrations.ts`); negative tests for the new transitions.

### Option B: move those rows to `cancelled`

- Data-only migration: `UPDATE releases SET status='cancelled', metadata = metadata || jsonb_build_object('legacy_status', status) WHERE status IN (...)`, then `chk_releases_status` with the 10 current values. No change to types, DTOs, workflow or labels; the web alias block and the `rejected`/`takedown` display values can be removed once the census is 0.
- Loss of distinction: `cancelled` means cancelled before launch (the workflow allows it only from pre-launch states, `releases.workflow.ts:81-90`); a rejected release and a taken-down release (already live) are not cancelled. The `taken_down` case is the more serious one, because the music was live.
- Reversibility: only through `metadata.legacy_status`, restored only while the row still holds the canonical value and only for whitelisted spellings; anything edited afterwards is not reverted; a non-object `metadata` cannot hold the marker (guard at `20260930000014:59`).
- Display and reports: the web shows "Em Espera" instead of "Rejeitado"/"Takedown"; the KPI count stays the same (`on_hold` is in the same bucket); reports and the external-data export emit `cancelled`; Distribution and Takedown are not affected.
- Risks: silent semantic loss; a data rewrite with business meaning (L5); a downstream consumer that treated the row as a takedown loses it.
- Tests: one migration spec and a verify script; adapt or remove the web legacy tests when the aliases go.

### Option C (noted for completeness): keep the status quo

The 4 values stay as unmapped residue with the display fallback and no CHECK; nothing enforces the vocabulary at the database level.

## 7. Non-binding recommendation

Preserve Obra != Fonograma != Música lançada and Projeto != Lançamento != Distribuição.

1. Do not decide before the census: run the section 3 queries (with the `lower(trim(...))` variant) in staging and production and attach the per-tenant result. If every environment returns 0, the question disappears: add `chk_releases_status` with the 10 current values, remove the web aliases and close the blocker.
2. If rows exist, prefer the middle path: keep `ReleaseStatus` as the release lifecycle only, treat "rejected by the distributor" and "taken down" as facts about Distribution and Takedown (the `takedowns` table already has `rejected`), keep the original value in `metadata.legacy_status`, and decide a per-tenant mapping only after the owner reads the counts. Option B loses the distinction for rows already live, so it is the riskier reading if live rows exist.
3. Option A is justified only if the business needs a Release to carry its own terminal "rejected"/"taken down" state; the owner must then define transitions, roles and events before any code.
4. Independently of D3, open a naming finding for the `ReleaseStatus` homonyms (`packages/ai-skills/src/release-checklist/contracts.ts:20` and the web display type `release-status.tsx:14`).

### Exact decision wording needed from the owner

"Decision D3 (BLK-RELEASES-STATUS-CHECK), after reviewing the per-tenant census attached to this decision: I choose exactly one of:
(A) Add `rejected` and `taken_down` to `ReleaseStatus`, with these transitions [from -> to, roles] and these PT-BR labels [labels]; authorize the backfill of `rejeitado` to `rejected` and of `takedown`/`take_down`/`remocao` to `taken_down` and the addition of `chk_releases_status`, in staging first and then production.
(B) Move the rows with `rejeitado`, `takedown`, `take_down` and `remocao` to `cancelled`, keeping the original value in `metadata.legacy_status`, accepting the loss of the rejected/taken-down distinction in `releases.status`; authorize the migration and `chk_releases_status` with the 10 current values, in staging first and then production.
(C) Keep the 4 values as unmapped residue for now, with no CHECK, until [date/condition].
(D) The census shows 0 rows in [environments]; authorize adding `chk_releases_status` with the 10 current values without any data change.
Distribution and Takedown records remain independent of Release status in all cases. Authorization covers [staging | production] and names the executor."

## Limits

NOT_MEASURED: all production and staging counts (the disposable database is empty). NOT_VERIFIED: generic report-engine filters over `releases.status`, and seeds or external scripts outside the repository.
