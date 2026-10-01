> Historical record. Kept as recorded; not the current contract.

# Module: `releases` — Zero-Gap Field Traceability Audit

STATUS: COMPLETE

## 0. Central objective — CRITICAL finding up front

**RELEASE_DOMAIN_MEANING**: `releases` is a **music-release-as-distribution-object** entity —
evidenced by its own table name (`releases`), its status vocabulary (`draft → metadata_pending →
assets_pending → review → approved → scheduled → distributed → released → archived/cancelled`, a
distribution-pipeline lifecycle, not a generic project lifecycle), its dedicated DSP/distributor
selector, and the `release-checklist` automation's own text ("Selecionar distribuidora e plataformas
de destino"). It is distinct from — and not fused with — "release as phonogram grouping" (no direct
relation to `phonograms` exists at all, §7) or "release as operational project" (`projects` is a
wholly separate entity, §16).

**CRITICAL, code-evidenced finding, the most severe found in this entire audit series**: the real
create/edit form (`LancamentoFormModal.tsx`) unconditionally injects an `internal_status` field into
every `POST /releases` and `PATCH /releases/:id` payload (lines 943, 948, 958) — but `internal_status`
is **not declared in `CreateReleaseDto` or `UpdateReleaseDto`**, and is **not a physical column** on
`ReleaseEntity`. The global `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })`
(`apps/api/src/create-app.ts:186-188`, confirmed) rejects any request containing an unlisted property
with HTTP 400 **before it reaches the controller**. The releases module's own mapper file
(`apps/web/src/modules/releases/services/form-to-payload.mapper.ts:11-12`) documents this exact rule
in its own header comment — *"NestJS ValidationPipe runs with { whitelist: true,
forbidNonWhitelisted: true } — any snake_case or unknown field causes a 400. Only DTO fields must be
sent"* — and is itself followed correctly (it never emits `internal_status`); the violation is
introduced three lines after the mapper returns, back in `LancamentoFormModal.tsx`'s `handleSubmit()`.
**Net effect: every "Novo Lançamento" (create) and every "Editar" (edit) submission from the real UI
is rejected by the backend and never reaches the database.** A second, compounding bug: even were
`internal_status` removed, the same `handleSubmit()` immediately follows a successful create with a
`PATCH` forcing `status: "distributed"` directly from `DRAFT` — a transition **not present** in the
real workflow graph (§10, only `DRAFT → METADATA_PENDING` is legal from `DRAFT`), so that second call
would also be rejected by `WorkflowService.transitionInTx()`.

## 1. Subdomains

| Subdomain | Frontend entrypoint | Endpoints | Backend controller | Service | DB tables |
|---|---|---|---|---|---|
| RELEASE | `/lancamentos` (`Lancamentos.tsx`, `LancamentoFormModal.tsx`, `LancamentoViewModal.tsx`) | 5 (`/releases` CRUD) | `ReleasesController` | `ReleasesService` | `releases` |
| RELEASE_TRACK ("faixas") | embedded in `LancamentoFormModal.tsx` | none — nested inside `releases.metadata.faixas` jsonb | — | — | none (jsonb only, no table) |
| RELEASE_WORK | schema-only (`@JoinTable`) | none | — | — | `release_works` (never written, §8) |
| RELEASE_DISTRIBUTION | static catalog UI only (`Distribuidora` selector) | none real | — | — | none — `distribuidora`/`plataformas` columns exist but are plain strings/jsonb, no distribution-submission table |
| SHARE (splits, adjacent domain) | `/gestao-shares` (`GestaoShares.tsx`) | `/shares` (separate module) | `SharesController` | `SharesService` | `shares` |

`shares` is functionally adjacent to `releases` (its own page lives under this module's routes,
`shares.lancamento_id` links back to a release) but is a distinct rights/splits domain with its own
43-column table — consistent with `catalog.md`'s own scoping decision, it is registered here only as
a relation (§16), not audited field-by-field.

No `RELEASE_PHONOGRAM`, `RELEASE_METADATA` (as a distinct subdomain — metadata is a single jsonb
catch-all column, not a structured subdomain), `RELEASE_ASSET` (as a table — `assets` is a jsonb
column), or `RELEASE_EXTERNAL_ID` subdomain exists as a real, separate concept — all confirmed absent,
not invented.

## 2. Tables / entities

| Table | Cols | Notes |
|---|---|---|
| `releases` | 27 | `id, tenant_id, artista_id, titulo, tipo, status, distribuidora, upc, data_lancamento, plataformas, capa_url, metadata, isrc_global, notas_internas, observacoes, gravadora, copyright, genero, idioma, assets, cronograma, created_at, updated_at, deleted_at, created_by, updated_by`. All 27 confirmed `DIRECT` in `database-backend-column-mapping.json` — zero CODE_FIELD_ONLY/DATABASE_COLUMN_ONLY drift. `artista_id` real FK → `artists.id` (`ON DELETE SET NULL`). |
| `release_works` | 2 | Pure M:N join (`release_id`, `work_id`, composite PK, both real cascading FKs). **No `ordem`/position column.** Confirmed `RELATION_ONLY` in the mapping JSON — matches the migration exactly. |

**`DEFAULT_MISMATCH` found (currently unreachable/moot given §0)**: physical DDL default for `status`
is `'planejamento'` (`20260719000004_RebuildReleasesInCanonicalFormOrder.ts:40,139`), but the TypeORM
entity metadata declares `default: ReleaseStatus.DRAFT` = `'draft'` (`entities.ts:1298`), and
`ReleasesService.create()` always forces `status: ReleaseStatus.DRAFT` explicitly — so this divergent
DB-level default is dead code today, and moot in practice anyway since (per §0) no `INSERT` ever
successfully reaches this table through the real UI.

**Dead duplicate entity/repository**: `apps/api/src/modules/releases/entities/release.entity.ts` (a
second, 4-line, near-empty `@Entity('releases')` stub) + `repositories/release.repository.ts` — neither
is imported by `ReleasesModule` (which correctly uses the real `ReleaseEntity` from
`database/entities.ts` via manual `DATA_SOURCE` injection); both are referenced only from
`apps/api/src/modules/repositories-tenant-isolation.spec.ts`. Confirmed dead in production code.

No `ReleaseTrackEntity`, `ReleaseDistributionEntity`, or `DistributionSubmissionEntity` exists anywhere
— tracks and distribution submissions are not modeled relationally at all (§8, §11).

## 3. Components

| Component | File | Classification |
|---|---|---|
| `Lancamentos.tsx` | `pages/Lancamentos.tsx` | GRID (card-based, not table) + FILTER + SEARCH + KPI_CARD |
| `LancamentoFormModal.tsx` | `components/LancamentoFormModal.tsx` | WIZARD (5-step: Album Info / Track Upload / Album Art / Distribution Preferences / Preview) — CREATE_MODAL + EDIT_MODAL combined |
| `LancamentoViewModal.tsx` | `components/LancamentoViewModal.tsx` | DETAIL_MODAL |
| Tracklist editor (inside `LancamentoFormModal.tsx`, "Track Upload" step) | same file | TRACKLIST_EDITOR |
| Artwork upload control | same file (`useUploadToR2`) | ARTWORK_UPLOAD — **real** (see §14, contrast with §0/§12's broken persistence) |
| Distributor selector | same file (`Distribuidora` card, ~line 2180) | DISTRIBUTOR_SELECTOR |
| `GestaoShares.tsx` / `SharePendenteFormModal.tsx` / `ShareViewModal.tsx` | `pages/`, `components/` | adjacent `shares` domain, not classified further (§1) |

Dead: `hooks/releases.store.ts` (Zustand, zero importers) and `services/releases.service.ts`
(`releasesService`, zero importers) — same dead-service-layer pattern found in every prior module this
session (`catalog`, `projects`).

## 4. Hooks

| Hook | File | Endpoints | Notes |
|---|---|---|---|
| `useLancamentos` | `hooks/useLancamentos.ts` | `GET/POST/PATCH/DELETE /releases` (via `useDataQuery`+`storage`) | Sends **no filter/pagination query params** (§17 truncation). Emits `DomainEvents.RELEASE_CREATED/UPDATED/DELETED` (internal frontend event bus, unrelated to backend's `DOMAIN_EVENTS`) on mutation success. |
| `useShares` | `hooks/useShares.ts` | `/shares` CRUD | adjacent domain, not audited field-by-field |
| `useDistributionPlatforms` | `hooks/useDistributionPlatforms.ts` | none (pure `localStorage` read) | exposes the static 6-provider catalog + a "connected" flag read from `localStorage["musicos360_distributor_connections"]`, which per `integrations.md §5.20` is **never written anywhere in the codebase** — `hasAnyConnected` is permanently `false` for every tenant |

## 5. Create Release — field mapping

| UI Label | Form field | API field | Backend field | DB column | Persisted |
|---|---|---|---|---|---|
| Título | `titulo` | `title` | `titulo` | `releases.titulo` | **NO — entire request rejected, §0** |
| Tipo | `tipo` | `type` | `tipo` | `releases.tipo` | **NO** |
| Artista | `artista_id` (real selector, `handleSelectArtista`) | `artistId` | `artista_id` | `releases.artista_id` | **NO** |
| UPC/EAN | `codigoUPC`/`upc` | `upc` | `upc` | `releases.upc` | **NO** |
| Distribuidora | `distribuidora` (static 6-provider select) | `distributor` | `distribuidora` | `releases.distribuidora` | **NO** |
| Data de Lançamento | `dataLancamento` | `releasedAt` | `data_lancamento` | `releases.data_lancamento` | **NO** |
| Capa | `assetCapaUrl` (real R2 upload, §14) | `coverUrl` | `capa_url` | `releases.capa_url` | **NO** |
| ISRC Global | `isrcGlobal` | `isrc_global` | `isrc_global` | `releases.isrc_global` | **NO** |
| Notas internas / Notas distribuição / Gravadora / Copyright / Gênero / Idioma | respective fields | same-named DTO fields | same | same columns | **NO** |
| Assets (audio master/vídeo/letra/ficha técnica/press release/EPK URLs) | `assetAudioMasterUrl` etc. | `assets` (nested object) | `assets` | `releases.assets` | **NO** |
| Cronograma (gravação/mix-master/entrega) | `cronGravacao` etc. | `cronograma` | `cronograma` | `releases.cronograma` | **NO** |
| Faixas (tracklist) | `faixas[]` | `metadata.faixas` | `metadata` | `releases.metadata` | **NO** |
| — | — | **`internal_status`** (injected, not in any DTO) | — | — | **N/A — causes the entire request to be rejected (§0)** |

Every field above is otherwise correctly, symmetrically mapped (form-exact DTO fields, "1 form field =
1 column" per the `ReleasesFormFieldColumns20260718000010` migration comment, matching the pattern
established across `projects`/`audiovisual`/`marketing`) — **the only defect is the one extra,
non-whitelisted `internal_status` property**, but its effect is total: `PERSISTED: NÃO` for every field
in the table, for every real create attempt, because the HTTP request never succeeds.

## 6. Edit Release — field mapping

Same component, same field set as Create (`CREATE_SUPPORTED`/`EDIT_SUPPORTED` identical for every
field — Create = Edit confirmed true, not presumed). `IMMUTABLE_AFTER_CREATE`: none declared. Same
`internal_status` defect applies unconditionally to every edit submission too (line 943 — *"platform_status
nunca é editável manualmente — preserva o status existente"* — the comment's intent, preserving the
existing `internal_status`/`status` value, is sound product design; the bug is purely that the field
itself doesn't exist on the backend).

## 7. Details (`LancamentoViewModal.tsx`) & display fields

All display fields trace to real `releases.*` columns 1:1 (titulo, tipo, status, artista via join,
upc, distribuidora, data_lancamento, capa_url, isrc_global, gravadora, copyright, genero, idioma,
assets, cronograma) — no unmapped display field found. `resolveReleaseStatus()`
(`lib/release-status.tsx`) computes a **derived 7-value display status**
(pendente/em_espera/aprovado/distribuido/rejeitado/takedown/incompleto) by reading, in priority order:
`release.platform_status` → `release.internal_status` → `release.status`. **Neither `platform_status`
nor `internal_status` is a real column or DTO field** (`platform_status` doesn't even appear anywhere
in the DTOs/entity — a pure frontend-only concept for a future real distributor-status sync that
doesn't exist yet, §11) — so in practice, since no create/edit ever persists successfully (§0), every
release that could theoretically exist in the DB (e.g. seeded directly) would fall through to the
`status` (workflow) value via `LEGACY_TO_DISPLAY` mapping. Classified `DISPLAY_MAPPING_MISMATCH`
(compounding the §0 finding): the UI's entire distribution-status display model is built on two fields
the backend contract doesn't provide.

## 8. `release_works` — RELEASE_WORKS_TRACEABILITY_COMPLETE

`OWNING_ENTITY`: `Release`. `RELATED_ENTITY`: `Work`. `JOIN_TABLE`: `release_works`. `JOIN_COLUMNS`:
`release_id`, `work_id` (composite PK, both cascading FKs, no extra/order column). `CREATE_UI`: none.
`EDIT_UI`: none. `READ_UI`: none. `API_WRITE`: none — no DTO field (`CreateReleaseDto`/
`UpdateReleaseDto`) references `works`/`workIds`/`obraIds` anywhere. `API_READ`: none — `ReleasesService
.findById()`/`.list()` never join or select `works`. `DELETE_BEHAVIOR`: `ON DELETE CASCADE` on both FKs
(schema-level only, never exercised since never populated).

Confirmed independently from both sides (this audit + `catalog.md §15`, quoted): *"nenhum componente
de catalog cria/edita/lê release_works diretamente — o vínculo obra↔lançamento é gerido inteiramente do
lado releases"* — and the `releases` side (`LancamentoFormModal.tsx:632-684`, `handleSelectObra()`)
confirms the Work-picker exists **only as an autofill convenience** (copies title/genre/ISRC from a
selected `Obra` into the release form fields) — `selectedObraId` is local component state, never sent
in any payload, and there is no DTO field to send it to even if it were.

`RELEASE_WORKS_TRACEABILITY_COMPLETE: SIM` — fully traced; the relation is real at the schema level and
confirmed, on both sides independently, to be permanently unpopulated by any functional flow.
Classified `WORK_MAPPING_GAP`.

## 9. Work ↔ Phonogram ↔ Release structure

```
RELEASE → (release_works, unpopulated) → WORK          [INDIRECT_RELATION, schema-only]
RELEASE → (no relation at all)          → PHONOGRAM     [NO_RELATION]
```

`PhonogramEntity` has no `release_id` and no relation to `ReleaseEntity` in the schema (confirmed by
direct inspection, not presumed). The only phonogram/work connection to a release's actual content is
the **jsonb tracklist** (`releases.metadata.faixas[]`, §11) — a denormalized, disconnected snapshot
that duplicates fields like ISRC and track title rather than referencing real `phonograms`/`works`
rows. Not presumed that every release links directly to `works` — confirmed it does not, in practice.

## 10. Status / Workflow — REAL_WORKFLOW

`ReleaseStatus` enum (`packages/types/src/enums.ts:144-154`): `DRAFT, METADATA_PENDING, ASSETS_PENDING,
REVIEW, APPROVED, SCHEDULED, DISTRIBUTED, RELEASED, ARCHIVED, CANCELLED` — 10 values.

Real state machine (`apps/api/src/core/workflow/definitions/releases.workflow.ts`), enforced via
`WorkflowService.transitionInTx()` inside a DB transaction (`ReleasesService.update()`), with two real
**guard functions** (not found in the `projects` workflow — a step up in rigor here):

| Source | Target | UI Action | Guard |
|---|---|---|---|
| draft | metadata_pending | "Preencher Metadados" | none |
| metadata_pending | assets_pending | "Enviar Assets" | requires `titulo`/`title` present |
| assets_pending | review | "Enviar para Revisão" | requires `capa_url`/`coverUrl` present |
| review | approved | "Aprovar" | none |
| review | assets_pending | "Solicitar Revisão de Assets" | none |
| approved | scheduled | "Agendar Distribuição" | none |
| scheduled | distributed | "Confirmar Distribuição" | none |
| distributed | released | "Publicado nas Plataformas" | none |
| draft\|metadata_pending\|assets_pending\|review\|approved\|scheduled | cancelled | "Cancelar" | none |
| released | archived | "Arquivar" | none |

Classified `REAL_WORKFLOW` (guards are genuinely evaluated server-side, not decorative). Reaching
`APPROVED`/`DISTRIBUTED`/`RELEASED` emits, respectively, `RELEASE_APPROVED`/`RELEASE_DISTRIBUTED`/
`RELEASE_PUBLISHED` — consumed by `ReleaseEventsHandler` (§13). `LancamentoFormModal.tsx`'s
auto-`DRAFT→DISTRIBUTED` jump on creation (§0) is **not a legal transition** in this graph — a second,
independent reason (beyond `internal_status`) that specific call would fail even if the first one
somehow succeeded.

Separately, `Lancamentos.tsx`'s filter/display model (§7) uses an **entirely different, 7-value
"display status"** derived client-side, not the 10-value workflow `status` — the two vocabularies
coexist (workflow status governs real backend transitions; display status governs the card UI/filter)
with a lossy many-to-one mapping (`LEGACY_TO_DISPLAY`) between them, and no round-trip back from
display status to workflow status.

## 11. Distribution — scope, providers, and DELIVERY finding

**No distribution-submission concept is modeled relationally anywhere** — no `DistributionRequest`
table/entity, no per-DSP delivery-status row, no external distributor release ID column. The entirety
of "distribution" on the `releases` side consists of: `releases.distribuidora` (free varchar, one
selected provider name), `releases.plataformas` (jsonb array of platform names), and the static
`DISTRIBUTION_PLATFORMS` catalog (§4, 6 hardcoded entries: ONErpm, DistroKid, Symphonic, SoundOn,
MusicPro, SomVibe).

Cross-checked against `integrations.md §2` (inventory table) and `§5.20` (dedicated section), both
independently confirming, for **all six** providers: `BACKEND_EXISTS: NÃO`, `DATABASE_EXISTS: NÃO`,
`RUNTIME_ACTIVE: NÃO`, `STATUS: STUB`. Verbatim from `integrations.md §5.20`:
> `TENANT_CONNECTION_IMPLEMENTED: NÃO — o "estado de conexão" é lido de localStorage[...] ... não há
> nenhuma escrita real dessa chave em lugar nenhum do código` ... `UI atual: ... mostram apenas um link
> <a target="_blank"> para o portal oficial de cada distribuidora ... "Abrir o portal não conecta a
> conta ao sistema"` ... `STATUS_GERAL: STUB (honesto — placeholder informativo, não uma integração fake)`

This audit's independent revalidation of the **releases-specific interface** (not re-auditing the
adapters themselves, per the prompt's instruction) confirms the assumption exactly: **6 providers
referenced, 0 active, 6 stub**. The parallel, more mature `ExternalDataExchangeService`/
`ExternalDataProviderRegistry` backend framework (`apps/api/src/core/external-data/**`, real REST
endpoints for submit/status-check/webhook) exists but, per `integrations.md §5.21`, has exactly 2
registered providers today — both explicit `Unconfigured*Provider` placeholders — and **zero frontend
consumer** anywhere in `apps/web/src`, including nowhere in `modules/releases/**`. The releases UI and
this backend framework are two independently-built, currently-disconnected stubs.

`DISTRIBUTOR_TENANT_CONNECTION_MODEL: NOT_IMPLEMENTED` — no connection model (tenant-owned or shared)
exists at all; the "connected" flag is pure client-side `localStorage`, never backed by any real
per-tenant credential or OAuth record. No distributor account model should be inferred as shared —
confirmed there simply isn't one yet, in either direction.

`DISTRIBUTION_RELEASE_TRACEABILITY_COMPLETE: SIM` (fully traced; conclusively confirmed stub, not
merely undiscovered). `TAKEDOWN` (distribution-side): **NOT_IMPLEMENTED** — the `"takedown"` value
exists only as one of the 7 client-side display-status labels (§7); no endpoint, provider effect, or
persisted takedown record exists anywhere for releases (distinct from `monitoring`'s unrelated
DMCA-style content-detection takedowns, already audited there, not re-audited here since no direct
relation exists between the two).

## 12. Delivery / Submission button

The only UI action resembling "submit for distribution" is the workflow transition buttons (§10,
`scheduled → distributed`, `distributed → released`) — both are **pure local status changes** (no
provider adapter call, no external effect, no external ID capture). No button anywhere calls out to
ONErpm/DistroKid/Symphonic/SoundOn/MusicPro/SomVibe or the `external-data` framework. Confirmed: no
release is ever actually "delivered" anywhere outside this system — every distribution-lifecycle status
is 100% locally-controlled record-keeping today, consistent with the STUB classification (§11).

## 13. `ReleaseEventsHandler` — SECOND critical, code-evidenced bug

`onReleaseApproved()` (`apps/api/src/modules/releases/handlers/release-events.handler.ts:36-98`)
persists two `NotificationEntity` rows on `RELEASE_APPROVED`: one addressed to the approving user
(correct, `user_id: event.userId`) and a second addressed **"to the artist"**
(line 80: `user_id: artistId`, where `artistId = current.artista_id`, an `artists.id` value). But
`NotificationEntity.user_id` (`entities.ts:1457`, `varchar(255)`) is semantically a **user account id**
— every other notification-consuming query in the codebase filters by the authenticated user's own id.
`artists.id` and `users.id` are different, unrelated ID spaces in this schema (no artist-to-user link
table exists anywhere, confirmed across this entire audit series). **This "artist notification" is
therefore written with a `user_id` that will never match any real authenticated user's session** — it
is permanently unreachable by any notification-list query, a silent, well-evidenced dead write.
Classified `REAL_MAPPING_GAP`, secondary in severity to §0 but structurally identical in nature (a field
holds the wrong kind of ID). `RELEASE_DISTRIBUTED`/`RELEASE_PUBLISHED` handlers are confirmed no-ops
beyond a fail-closed tenant check (lines 100-110) — real, but intentionally minimal.

The `APPROVAL_CHECKLIST` (lines 16-22: cover art dimensions, ISRC, UPC/EAN, distributor+platforms,
metadata) is real, persisted notification content — not a fabricated/mock feature, a genuine (if
narrowly-reachable, given §0) release-readiness checklist automation.

## 14. Artwork — real storage, contrasted with §0

`releases.capa_url` is a **real, working upload path** — `LancamentoFormModal.tsx` uses
`useUploadToR2()` (real Cloudflare R2 client, with an explicit `R2NotConfiguredError` honest-failure
path) to upload the cover image file, then sets `assetCapaUrl` → mapped to `coverUrl` → `capa_url`.
This is a genuine positive contrast to the fake/stub upload patterns found in `projects.md` (hardcoded
`null`-returning stub) and `musicchat.md` (`blob:` URL only) — **artwork upload is real, end-to-end,
tenant-isolated storage**, undermined only by the fact the surrounding create/edit request never
successfully reaches the database (§0). `DIMENSIONS`/`SIZE_LIMIT`: client-side validation only (not
independently re-verified byte-for-byte here, out of scope depth for this pass). `DELETE_BEHAVIOR`: no
explicit delete-from-R2 call found on release deletion — orphaned R2 objects accumulate on release
delete (soft delete anyway, §19), a minor, low-severity `ARTWORK_STORAGE_GAP`.

A second, redundant `capa_url` key exists nested inside the `LancamentoAssets` type
(`types/index.ts:8`, inside the `assets` jsonb column) separate from the top-level `capa_url` column —
`getReleaseArtworkUrl()` (`Lancamentos.tsx:39-49`) reads `capa_url` → `assets.capa_url` →
`metadata.assets.capa_url` in fallback order, meaning three possible sources for one logical value that
can diverge. Classified `DISPLAY_MAPPING_MISMATCH` (minor).

## 15. Tracklist ("Faixas") — no relational model

`Faixa` interface (`LancamentoFormModal.tsx:240-262`): `id, titulo, artista, isrc, [version flags],
artistasAdicionais, produtores, compositores, musicos, [AI-assist metadata], arquivoAudio: File | null`.
**No `ordem`/`position` field** — `ORDER_PERSISTED: NÃO` (order = array index only). Managed as pure
client-side array state (`useState<Faixa[]>`), serialized wholesale into `releases.metadata.faixas`
jsonb on submit (never reaching the DB today, per §0). Per-track audio file is stripped before
persistence (`{ arquivoAudio: _, ...f }`) — never uploaded anywhere (`RELEASE_AUDIO_UPLOAD`: tracks have
no real audio persistence path; distinguished from — and not a duplicate of — `catalog`'s phonogram
audio-upload gap, since this is a structurally separate, disconnected jsonb-only mechanism, not a
re-audit of the same code). Per-track `isrc` lives in `metadata.faixas[].isrc`, entirely disconnected
from `phonograms.isrc` (§9) — classified `TRACKLIST_MAPPING_GAP` + `IDENTIFIER_GAP`.

`MULTI_DISC_SUPPORT: NOT_IMPLEMENTED` — no `disc_number`/`discNumber` field exists anywhere in `Faixa`
or the release schema (confirmed absent, not invented as a missing requirement).

`RELEASE_LEVEL_ISRC: SIM` (`releases.isrc_global`). `TRACK_LEVEL_ISRC: SIM` (`Faixa.isrc`, jsonb-only,
disconnected from `phonograms.isrc`, §9). `SOURCE_TABLE`: none for track-level (jsonb only); `releases`
for release-level.

## 16. Project ↔ Release

`ReleaseEntity` has **no `project_id`/`projeto_id` column** (confirmed absent). The relation runs the
other direction only: `LancamentoFormModal.tsx` imports `useProjetos()` and `projetoToLancamentoSeed()`
(`mappers/`) to let a user **seed** a new release's form fields (title, genre, artist) from an existing
`Projeto`, purely a one-time autofill convenience at form-open time — `projeto.id` is never stored on
the resulting release, and no automation runs in either direction after that point.

`PROJECT_RELEASE_TRACEABILITY_COMPLETE: SIM`. `PROJECT_CREATES_RELEASE`: partially — only as a manual
form-prefill action, no automatic linkage or record kept. `RELEASE_CREATES_PROJECT`: NO.
`MANUAL_LINK`: effectively yes, but unpersisted (no FK exists to record it after the fact).
`NO_AUTOMATION`: confirmed — no `DOMAIN_EVENTS` listener connects the two entity types in either
direction (contrast with `projects.md §8`'s `PROJECT_COMPLETED` → marketing/AI-planning automations,
which have no `releases`-side counterpart).

## 17. Table / Grid, Filters, Search, Sort, Pagination, Truncation

`Lancamentos.tsx` renders a card grid (not a traditional table), but functions identically for
traceability purposes: search (title/artist substring, client-side), 3 filters (type/status/artist, all
client-side over `resolveReleaseStatus()`), no server-side sort control (fixed `data_lancamento DESC`
order from the hook's `orderBy`), pagination via `usePagination` (client-side, page size 12).

**`TRUNCATION_GAP` — confirmed, same pattern as `projects.md`**: `useLancamentos()` sends zero
filter/pagination params to `GET /releases`. `ReleasesService.list()` defaults to `take(q.limit ?? 50)`.
Every filter, every KPI (`distributionKPIs`: total/distributed/pending/waitingAction, computed directly
from the same `lancamentos` array) operates on a silently-truncated dataset for any tenant with more
than 50 releases, with no "showing N of M" indication. `AFFECTS_TOTAL: SIM`, `AFFECTS_FILTER: SIM`,
`AFFECTS_SEARCH: SIM`, `AFFECTS_TRACKLIST: NÃO` (tracklist is per-release, unaffected by list
truncation).

## 18. Import / Export / XLSX

**NOT_PRESENT** — no import, export, or XLSX flow exists for `releases` (confirmed by targeted grep
across `apps/web/src/modules/releases/**`; the only "import" hits are JS `import` statements, no
`importXlsx`/export function found). `XLSX_EXPORTS: 0`, `XLSX_RULE_VIOLATIONS: 0`.

## 19. Delete / Archive / Cancel

| Action | UI | Endpoint | DB behavior | Soft/Hard |
|---|---|---|---|---|
| Delete | `Lancamentos.tsx` row menu / bulk delete | `DELETE /releases/:id` | `deleted_at = NOW()` | SOFT |
| Cancel | Workflow transition "Cancelar" (from draft/metadata_pending/assets_pending/review/approved/scheduled) | `PATCH /releases/:id` | workflow-validated status UPDATE | — |
| Archive | Workflow transition "Arquivar" (from `released` only) | `PATCH /releases/:id` | workflow-validated status UPDATE | — |
| Restore | none exists | — | — | N/A |
| Takedown | not implemented (§11) | — | — | N/A |

`release_works` FKs are `ON DELETE CASCADE` (schema-level, never exercised, §8). No FK-cascade concern
on `shares.lancamento_id` (no `@ManyToOne`/FK constraint declared per Fase 1 — logical-only reference,
consistent with the `works.projeto_id`-style pattern found throughout this session). `DELETE_ALLOWED`
for an already-`distributed`/`released` record: **unrestricted** — no backend validation blocks
soft-deleting a release regardless of its distribution status or any external-provider state (there is
none to protect anyway, §11). `RELEASE_ATOMICITY_GAP`: N/A in practice for the same reason §0 makes it
moot — but if the `internal_status` bug were fixed, the create flow's two sequential mutations (initial
`POST` + follow-up status-forcing `PATCH`, §0) are **not** wrapped in a single transaction — a genuine
latent `RELEASE_ATOMICITY_GAP` for that specific flow once/if §0 is resolved.

## 20. Idempotency

**NOT_APPLICABLE** — no distribution submission, resubmission, or takedown exists to require an
idempotency key (§11/§12 confirm these are unimplemented). Standard create/update operations have no
idempotency mechanism, consistent with every other CRUD module audited this session (not a
releases-specific gap).

## 21. Realtime / Background Jobs / Scheduled Jobs / Notifications

`REALTIME_EVENTS: 0` — `ReleasesService` injects `EventsService` (internal `EventEmitter2` bus only,
for `RELEASE_CREATED`/`WORKFLOW_TRANSITIONED`/`RELEASE_APPROVED`/`RELEASE_DISTRIBUTED`/
`RELEASE_PUBLISHED`) but never `RealtimeService` — no Supabase Realtime broadcast, no frontend
`useWsEvent` subscriber anywhere in `modules/releases/**`. `BACKGROUND_JOBS: 0`, `SCHEDULED_JOBS: 0` —
no queue/cron job exists for release distribution, status sync, or metadata sync (confirmed absent,
consistent with §11's stub-only distribution status). Notifications: covered in §13 (real mechanism,
one confirmed-broken addressee).

## 22. Permissions & Tenant Isolation

All 5 `ReleasesController` endpoints carry `@RequireRole` (viewer/editor/editor/manager tiers, delete
requires `manager`) — confirmed real, non-decorative (same RBAC seed pattern as every prior module).
`AUTHORIZATION_GAPS: 0`. Every `ReleasesService` method includes an explicit `tenant_id` predicate
(`list`, `findById`, `create`, `update`, `remove`) — `TENANT_ISOLATION_GAPS: 0`. `release_works` (no
own `tenant_id`) inherits isolation transitively via both FKs (`releases.tenant_id`/`works.tenant_id`,
always equal by construction, per `catalog.md §17`) — no cross-tenant risk identified, though moot
today since the table is never populated (§8).

## 23. `Auditoria.tsx` — Releases section

`AUDITORIA_TSX_RELEASES_SECTION_COMPLETE: SIM` — section confirmed present, registered as `"lancamentos"`
(`Auditoria.tsx:36,56`: `{ id: "lancamentos", label: "Lançamentos", module: "lancamentos", icon: Rocket }`).
Real completeness rules (`runner.ts:99-113`):

```
table: "lancamentos", entityType: "Lançamento"
fields:
  titulo         — obrigatorio
  tipo           — obrigatorio
  status         — obrigatorio
  artista_id     — obrigatorio
  data_lancamento — recomendado
  distribuidora   — recomendado
  plataformas     — recomendado
```

**Direct consequence of §0**: since no release created via the real UI ever actually persists, this
audit tab's own data source (`storage.list("lancamentos")`) will show **zero rows** for any tenant that
has only ever used the real create flow — the completeness checker has nothing to check, not because
releases are complete, but because none can be created at all. Same `PaginationDto.limit=50`
inheritance as every other `runner.ts` tab (client sends no override).

## 24. Gap taxonomy summary

| Gap type | Count | Detail |
|---|---|---|
| CREATE_MAPPING_MISMATCH | 1 | **CRITICAL** — `internal_status` injected outside the DTO contract breaks every create (§0) |
| EDIT_MAPPING_MISMATCH | 1 | same field breaks every edit (§0, §6) |
| WORKFLOW_GAP | 1 | auto `DRAFT→DISTRIBUTED` jump on creation is not a legal transition (§0, §10) |
| DISPLAY_MAPPING_MISMATCH | 2 | 7-value display status depends on 2 non-existent fields (§7); triple-sourced `capa_url` can diverge (§14) |
| WORK_MAPPING_GAP | 1 | `release_works` schema-only, never populated (§8) |
| TRACKLIST_MAPPING_GAP | 1 | tracklist is jsonb-only, no relation to phonograms/works, no order column (§15) |
| IDENTIFIER_GAP | 1 | track-level ISRC (jsonb) disconnected from `phonograms.isrc` (§9, §15) |
| DEFAULT_MISMATCH | 1 | DB default `'planejamento'` vs entity default `'draft'`, dead/moot code (§2) |
| REAL_MAPPING_GAP | 2 | dead duplicate `ReleaseEntity`/repository stub (§2); artist-notification `user_id` holds an `artists.id`, unreachable by any real user query (§13) |
| ARTWORK_STORAGE_GAP | 1 | no delete-from-R2 on release deletion, minor (§14) |
| DISTRIBUTION_IMPLEMENTATION_GAP | 6 | all 6 distributor providers confirmed STUB, revalidated (§11) |
| DISTRIBUTION_MAPPING_GAP | 0 | N/A — nothing to map, no real distribution submission exists |
| TAKEDOWN_GAP | 1 | NOT_IMPLEMENTED, confirmed absent not invented (§11) |
| TRUNCATION_GAP | 1 | default `limit=50`, no pagination params ever sent (§17) |
| RELEASE_ATOMICITY_GAP | 1 | latent — 2-call create+status-force flow not transactional (§19, only relevant once §0 is fixed) |
| AUTHORIZATION_GAP | 0 | — |
| TENANT_ISOLATION_GAP | 0 | — |
| REALTIME_GAP | 0 | N/A — no realtime surface exists, nothing claims otherwise |

`UNMAPPED_*: 0` across every category (every field's origin/destination was successfully traced, even
though several traces terminate in "never persisted"). `UNKNOWN_FIELD_CLASSIFICATIONS: 0`.

## Contadores finais (Zero-Gap)

```
MODULE_STATUS: COMPLETE
RELEASE_DOMAIN_MEANING: RELEASE_AS_DISTRIBUTION_OBJECT (music single/EP/album pipeline entity; no
  direct relation to phonograms; distinct from projects)
SUBDOMAINS_AUDITED: 5
COMPONENTS_AUDITED: 6
HOOKS_AUDITED: 3
CREATE_FIELDS: 20 (all blocked from persisting, §0)
EDIT_FIELDS: 20 (same)
RELEASE_TYPES: 6 (album, ep, single, compilacao, live, outro)
WORKFLOW_STATUSES: 10 (backend) / 7 (frontend display, lossy many-to-one mapping)
TRACK_FIELDS: 13 (Faixa interface, jsonb-only)
WORK_RELATION_FIELDS: 2 (release_id, work_id — schema-only)
PHONOGRAM_RELATION_FIELDS: 0 (no relation exists)
IDENTIFIER_FIELDS: 3 (upc, isrc_global, track-level isrc in jsonb)
METADATA_FIELDS: 2 jsonb columns (assets: 7 keys, cronograma: 3 keys) + free-form metadata.faixas
DISTRIBUTION_FIELDS: 2 (distribuidora, plataformas) — no submission/status table
DISTRIBUTION_STATUS_VALUES: 7 (frontend display-only, not backed by real provider sync)
EXTERNAL_ID_FIELDS: 0 (none persisted anywhere)
RELATION_FIELDS: 3 (artista_id real FK; release_works schema-only; projeto seed, unpersisted)
FILTERS: 3
SEARCH_FIELDS: 1
XLSX_EXPORTS: 0
XLSX_RULE_VIOLATIONS: 0
STORAGE_FIELDS: 1 (capa_url, real R2 upload)
REALTIME_EVENTS: 0
BACKGROUND_JOBS: 0
SCHEDULED_JOBS: 0
DISTRIBUTOR_PROVIDERS_REFERENCED: 6
ACTIVE_DISTRIBUTOR_INTEGRATIONS: 0
PARTIAL_DISTRIBUTOR_INTEGRATIONS: 0
STUB_OR_NOT_IMPLEMENTED_DISTRIBUTOR_INTEGRATIONS: 6
CREDENTIALS_TO_ADD_NOW: 0
PERMISSIONS_AUDITED: 5
AUTHORIZATION_GAPS: 0
TENANT_ISOLATION_GAPS: 0
CREATE_MAPPING_MISMATCH: 1 (CRITICAL)
EDIT_MAPPING_MISMATCH: 1 (CRITICAL, same root cause)
DISPLAY_MAPPING_MISMATCH: 2
WORKFLOW_GAPS: 1
WORK_MAPPING_GAPS: 1
TRACKLIST_MAPPING_GAPS: 1
IDENTIFIER_GAPS: 1
DEFAULT_MISMATCH: 1
REAL_MAPPING_GAPS: 2
ARTWORK_STORAGE_GAPS: 1
DISTRIBUTION_IMPLEMENTATION_GAPS: 6
TAKEDOWN_GAPS: 1
TRUNCATION_GAPS: 1
RELEASE_ATOMICITY_GAPS: 1
REALTIME_GAPS: 0
MULTI_DISC_SUPPORT: NOT_IMPLEMENTED
RELEASE_LEVEL_ISRC: SIM
TRACK_LEVEL_ISRC: SIM (jsonb-only, disconnected from phonograms.isrc)
RELEASE_COMPLEX_WRITE_TRANSACTIONAL: NÃO (latent, §19)
CATALOG_RELEASE_TRACEABILITY_COMPLETE: SIM
RELEASE_WORKS_TRACEABILITY_COMPLETE: SIM
ARTIST_RELEASE_TRACEABILITY_COMPLETE: SIM
PROJECT_RELEASE_TRACEABILITY_COMPLETE: SIM
MARKETING_RELEASE_TRACEABILITY_COMPLETE: SIM (marketing's "release_id" confirmed synthetic/UI-only, not a real relation)
AUDIOVISUAL_RELEASE_TRACEABILITY_COMPLETE: SIM (real FK column, `audiovisual_projects.release_id`)
ACCOUNTING_RELEASE_TRACEABILITY_COMPLETE: SIM (real FK columns on transaction_allocations + performance_metric_entries)
CONTRACT_RELEASE_TRACEABILITY: NOT_APPLICABLE
DISTRIBUTION_RELEASE_TRACEABILITY_COMPLETE: SIM
DISTRIBUTOR_TENANT_CONNECTION_MODEL: NOT_IMPLEMENTED
AUDITORIA_TSX_RELEASES_SECTION_COMPLETE: SIM
UNMAPPED_FIELDS: 0
UNKNOWN_FIELD_CLASSIFICATIONS: 0
```

NEXT_MODULE: reports
