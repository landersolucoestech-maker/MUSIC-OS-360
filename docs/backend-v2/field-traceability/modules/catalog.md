# Module `catalog` — Zero-Gap Audit (Phase 2, Prompt 101)

STATUS: **COMPLETE** — UNMAPPED_*: 0, UNKNOWN_FIELD_CLASSIFICATIONS: 0.

Real scope (following imports/hooks/endpoints, not the `catalog/` folder):
- Frontend: `apps/web/src/modules/catalog/**` (the domain's only folder) + `AbramusSearchRow.tsx`
  consuming `apps/web/src/modules/integrations/hooks/useAbramus.ts`.
- Backend: `apps/api/src/modules/works/**`, `apps/api/src/modules/phonograms/**`,
  `apps/api/src/modules/registry/**` (rights-holders, external-identifiers, society
  accounts/submissions/sync, ABRAMUS payload builder), `apps/api/src/modules/integrations/abramus/**`.
- Tables (Phase 1, ground truth): `works` (47 cols), `phonograms` (59 cols), `work_participants`
  (10 cols), `rights_holders` (17 cols), `external_identifiers` (12 cols), `society_accounts` (14 cols),
  `society_submissions` (19 cols), `society_sync_jobs` (11 cols), `society_payload_snapshots` (8 cols),
  `society_submission_events` (10 cols), `society_validation_errors` (10 cols), `release_works`
  (2 cols, `@JoinTable`) = 219 columns belonging to the domain, all `backendMapping: DIRECT` in Phase 1.
  `shares` (43 cols, raw SQL) functionally belongs to the `releases` module (GestaoShares.tsx) — only
  recorded as a relation (§16/§18), not re-audited.

---

## 1. Real subdomains identified

| Subdomain | FRONTEND_ENTRYPOINT | ENDPOINTS | BACKEND_CONTROLLER | SERVICE | ENTITY/TABLES |
|---|---|---|---|---|---|
| WORK (Obra) | `RegistroMusicas.tsx` ("Obras" (Works) tab), `ObraFormModal.tsx`, `ObraViewModal.tsx` | `GET/POST/PATCH/DELETE /works` | `works.controller.ts` | `works.service.ts` | `works` (+ `work_participants`) |
| PHONOGRAM (Fonograma) | `RegistroMusicas.tsx` ("Fonogramas" (Phonograms) tab), `FonogramaFormModal.tsx`, `FonogramaViewModal.tsx` | `GET/POST/PATCH/DELETE /phonograms` | `phonograms.controller.ts` | `phonograms.service.ts` | `phonograms` |
| WORK_PARTICIPANT (Work participation/splits) | inline in `ObraFormModal.tsx` (no screen of its own) | embedded in `POST/PATCH /works` (field `participantes`) | `works.controller.ts` | `WorksService.replaceParticipantes()` | `work_participants` |
| PHONOGRAM_PARTICIPATION (Phonogram participation) | inline in `FonogramaFormModal.tsx` (no screen of its own) | embedded in `POST/PATCH /phonograms` (field `participacao`, jsonb) | `phonograms.controller.ts` | `PhonogramsService.buildEntityPayload()` | `phonograms.participacao` (jsonb) |
| RIGHTS_HOLDER (Titular) | **none** | `GET/POST/PATCH/DELETE /registry/rights-holders` | `registry/rights-holders.controller.ts` | `rights-holders.service.ts` | `rights_holders` |
| EXTERNAL_IDENTIFIER | **none** | `/registry` (external-identifiers) | `external-identifiers.controller.ts` | `external-identifiers.service.ts` | `external_identifiers` |
| SOCIETY_INTEGRATION (accounts/submissions/sync with collecting societies) | **none** | `/registry/society-accounts`, `/registry/submissions`, `/registry` (sync) | `society-accounts.controller.ts`, `society-submissions.controller.ts`, `society-sync.controller.ts` | `society-*.service.ts` | `society_accounts`, `society_submissions`, `society_sync_jobs`, `society_payload_snapshots`, `society_submission_events`, `society_validation_errors` |
| ABRAMUS_SEARCH (external search to link/import) | `AbramusSearchRow.tsx` (inside `ObraFormModal`/`FonogramaFormModal`) | `GET /integrations/abramus/search-work`, `search-artist` | `integrations.controller.ts` | `abramus.service.ts` | none (external proxy) |
| ABRAMUS_REGISTRATION (register a work/phonogram with ABRAMUS) | `AbramusConfigDialog.tsx` (config) + `useAbramusRegisterObra` (has no dedicated UI button — only defined) | `POST /integrations/abramus/configure\|register-work`, `GET status`, `DELETE disconnect`, `GET statements` | `integrations.controller.ts` | `abramus.service.ts` | none (tenant credentials via `IntegrationBaseService`) |
| RELEASE_WORKS (work↔release join) | no direct consumption in `catalog` (belongs to `releases`) | `@JoinTable` managed by the `Release` side | — | — | `release_works` |

10 real subdomains (11 counting `release_works` as a recorded relation, not fully audited).

---

## 2. `Auditoria.tsx` — CROSS_MODULE_AUDITORIA_TSX (catalog excerpt)

Real tool: `apps/web/src/modules/admin/pages/Auditoria.tsx` (320 lines). It is a **field
completeness** checker, 100% client-side, not a security audit screen. It runs on
`apps/web/src/shared/lib/audit/runner.ts`, which calls `storage.list("obras")` / `storage.list("fonogramas")`
directly (the same HTTP hooks as the module, the same 50-record limit — see §12 Gaps).

`AUDITORIA_CATALOG_FIELDS` (runner.ts:70-97):

| Table | Field | Severity |
|---|---|---|
| `obras` | `titulo` | `obrigatorio` |
| `obras` | `compositores\|compositor` | `obrigatorio` |
| `obras` | `genero` | `recomendado` |
| `obras` | `iswc` | `recomendado` |
| `obras` | `cod_ecad` | `recomendado` |
| `fonogramas` | `titulo` | `obrigatorio` |
| `fonogramas` | `isrc` | `obrigatorio` |
| `fonogramas` | `artista_id` | `recomendado` |
| `fonogramas` | `obra_id` | `recomendado` |
| `fonogramas` | `genero_musical` | `recomendado` |

`AUDITORIA_CATALOG_RULES`: a record is `is_complete` if every `obrigatorio` (required) field has a value
(via `hasValue()` — non-empty string / non-empty array / not-null); `recomendado` (recommended) fields only affect the
`recommended_missing_fields` list, they never block. `fix_path` leads to
`/registro-musicas?editObra=:id` / `?editFonograma=:id`, which `RegistroMusicas.tsx` already knows how to consume
(`searchParams` useEffect, confirmed in §1 above).

`AUDITORIA_CATALOG_DATABASE_SOURCES`: the same `storage.list("obras")`→`/works`,
`storage.list("fonogramas")`→`/phonograms` pair as the rest of the module — not a separate data source.

`AUDITORIA_CATALOG_GAPS`: inherits the gap from §12.6 (50-record limit) — the completeness audit
only sees the 50 most recent records of each table, so old incomplete works/phonograms
beyond the 50th position never appear in the incomplete list.

`AUDITORIA_TSX_CATALOG_SECTION_COMPLETE: SIM` (yes).

---

## 3. Components (complete classification)

| Component | Classification | Note |
|---|---|---|
| `ObraFormModal.tsx` | CREATE_MODAL + EDIT_MODAL | real, 1445 lines, field by field in §5 |
| `FonogramaFormModal.tsx` | CREATE_MODAL + EDIT_MODAL | real, 1224 lines, field by field in §6 |
| `ObraViewModal.tsx` | DETAIL_MODAL | real, re-runs a local query via `useObras()` for fresh data |
| `FonogramaViewModal.tsx` | DETAIL_MODAL | real |
| `ParticipanteViewModal.tsx` | DETAIL_MODAL (read-only) | shows `Artista` data (persists nothing; see §9) |
| `ObraTipoSelectorModal.tsx` | WIZARD (step 0) | "Autoral"/"Referência" (original/reference) selector before `ObraFormModal` |
| `AbramusSearchRow.tsx` | RELATION_SELECTOR + EXTERNAL_INTEGRATION | remote ABRAMUS search; broken import (§10) |
| `RegistroMusicas.tsx` | TABLE + GRID + FILTER + SEARCH + SORT | main page, 2 tabs ("Obras"/"Fonogramas") |
| `catalog.store.ts` (hooks/ and store/, same file) | DEAD | `useCatalogStore` (Zustand) never imported outside its own file |
| `constants/index.ts`, `utils/index.ts`, `forms/index.ts` | STATIC (stub) | comment only, no real content |
| `mappers/registro-musicas.mapper.ts` (re-export) | OTHER_DATA_CONSUMER | points to `services/registro-musicas.mapper.ts` |
| `services/registro-musicas.mapper.ts` | OTHER_DATA_CONSUMER | 559 lines, real form↔payload mappers |
| `services/catalog.service.ts` | OTHER_DATA_CONSUMER | `catalogService` (thin CRUD over `storage`) — **not used by any real component** (RegistroMusicas uses `useObras`/`useFonogramas`, not `catalogService`); confirmed via grep — DEAD |

Confirmed by grep: `catalogService` (file `services/catalog.service.ts`) has no importer
in `apps/web/src` — DEAD, redundant with `useObras`/`useFonogramas`.

---

## 4. Hooks

| HOOK | FILE | SUBDOMAIN | ENDPOINTS | READ/WRITE_FIELDS | FILTER/SEARCH/SORT | RELATIONS | IMPORT_EXPORT | REALTIME | AUTH_DEP | TENANT_DEP |
|---|---|---|---|---|---|---|---|---|---|---|
| `useObras` | `hooks/useObras.ts` | WORK | `GET/POST/PATCH/DELETE /works` (via `storage`) | all 47 fields of `works` (no form field is left out of the payload) | none (client-side in `RegistroMusicas.tsx`) | `select: "*, artistas(*), projetos(id,titulo)"` **dead** (see §12.1) | no | no | implicit (token in `api-client`) | implicit (`X-Tenant-ID` + JWT) |
| `useFonogramas` | `hooks/useFonogramas.ts` | PHONOGRAM | `GET/POST/PATCH/DELETE /phonograms` | all 59 fields of `phonograms` | none | `select: "*, artistas(*)"` **dead** | no | no | implicit | implicit |
| `useCatalogStore` | `hooks/catalog.store.ts` | — | none (local Zustand) | — | — | — | no | no | no | no |

No active hook was left unclassified. `select` is a parameter inherited from a Supabase-direct era;
`useDataQuery` (`shared/hooks/useDataQuery.ts:29`) explicitly documents
`"Mantido para compatibilidade com chamadas legadas (não usado em modo mock)"` and never sends it —
`storage.list()` only accepts `filters/orderBy/limit/offset`. Confirmed: `WorksService.list()` /
`PhonogramsService.list()` never populate `artistas`/`projetos` (no join, no relation field
in the return) — `ObraWithRelations.artistas`/`.projetos` and `FonogramaWithRelations.artistas` are always
`undefined` at real runtime (DISPLAY_MAPPING_MISMATCH — the type promises a relation that never arrives).

---

## 5. CREATE/EDIT — Work (`ObraFormModal.tsx`)

There is no distinct Create vs Edit: same component, same builder `formToObraPayload()`
(`services/registro-musicas.mapper.ts:357`). `CREATE_SUPPORTED`/`EDIT_SUPPORTED` = yes for all the
fields below, except where noted.

| FORM_FIELD | TYPE | REQUIRED | API_REQUEST_FIELD | DATABASE_COLUMN | PERSISTED | Note |
|---|---|---|---|---|---|---|
| `tituloObra` | string | yes (schema+DB NOT NULL) | `titulo` | `works.titulo` | yes | |
| `generoMusical` | select | no | `genero` | `works.genero` | yes | |
| `idioma` | select | no | `idioma` | `works.idioma` | yes | |
| `situacao` | select | no | `status` (via `normalizeStatusForDb`) | `works.status` | yes | |
| `iswc` | string | no | `iswc` | `works.iswc` | yes | no format/uniqueness validation (§12.9) |
| `codEcad` | string | no | `cod_ecad` | `works.cod_ecad` | yes | |
| `codEntidade` | string | no | `cod_entidade` | `works.cod_entidade` | yes | |
| `duracaoMin`/`duracaoSeg` | number (pair) | no | `duracao` (`MM:SS` via `formatDuracao`) | `works.duracao` | yes | `works.duration_seconds` (DB) never written by this form — READ-ONLY in the contract |
| `instrumental` | switch (sim/nao) | no | `instrumental` | `works.instrumental` | yes | |
| `criadaPorIA` | switch (sim/nao) | no | `criada_por_ia` (bool) | `works.criada_por_ia` | yes | |
| `tipoIA` (radio, conditional) | string | no | `tipo_ia` | `works.tipo_ia` | yes | only visible if `criadaPorIA=sim` |
| `iaHarmonia{ferramenta,prompt}` | object | no | `ia_harmonia` (null if both empty) | `works.ia_harmonia` (jsonb) | yes | |
| `iaMelodia{ferramenta,prompt}` | object | no | `ia_melodia` | `works.ia_melodia` (jsonb) | yes | |
| `iaLetra{ferramenta,prompt}` | object | no | `ia_letra` | `works.ia_letra` (jsonb) | yes | |
| `participantes[]` | repeatable array | no (but a row requires name+class in the UI) | `participantes` (raw array in the DTO) | `work_participants` (normalized in the service, see §9) | yes | percentage with no sum validation (§12.4) |
| `outrosTitulos[]` | string array | no | `outros_titulos` | `works.outros_titulos` (jsonb) | yes | |
| `referenciasConexas[]` | string array | no | `referencias_conexas` | `works.referencias_conexas` (jsonb) | yes | |
| `letraCompleta` | textarea | no | `letra_completa` | `works.letra_completa` | yes | |
| `aceitaTermos` | checkbox | yes (schema `.default(false)`, but it **does not block submit** — it only validates that the field is present, `false` passes) | — | — | no (UI_ONLY) | |
| `projetoSelecionado` (search) | RELATION_SELECTOR | no | `projeto_id` | `works.projeto_id` | yes | |
| `artistaId` | — | — | `artista_id` (**always `null`**, hardcoded in `ObraFormModal.tsx:486`) | `works.artista_id` | yes, but always null | **CREATE/EDIT_MAPPING_MISMATCH** — see §12.1 |
| `tipoObra` | badge/prior selector | yes (via `ObraTipoSelectorModal`) | `tipo_obra` | `works.tipo_obra` | yes | |
| `compositores`/`letristas` (derived) | derived from `participantes` | no | `compositores`, `letristas` | `works.compositores`, `works.letristas` (jsonb) | yes | via `participantesToCompositoresLetristas()` — string[] of names, not an FK |

Explicit derived/UI_ONLY fields: `aceitaTermos` (UI_ONLY), `buscaProjeto`/`buscaProjetoOpen`
(RUNTIME_ONLY), `projetoSelecionado.nome`/`.artistaNome` (DERIVED, display). The `participante.artista_id` field
(captured via autocomplete) is **UI_ONLY/RUNTIME_ONLY** — there is no `artista_id` column in
`work_participants` (Phase 1: 10 columns, without it) and the service (`replaceParticipantes`) does not send it —
used only so the "eye" button can open `ParticipanteViewModal` in the same session.

CREATE_FIELDS/EDIT_FIELDS (persisted): 23 work-level fields + 4 fields per
`participantes` row (`nome`, `classeFuncao`, `link`, `percentual`).

---

## 6. CREATE/EDIT — Phonogram (`FonogramaFormModal.tsx`)

Same pattern (1 component, `mode` create/edit/view). `buildPayload()` in
`FonogramaFormModal.tsx:526`.

| FORM_FIELD | TYPE | REQUIRED | API_REQUEST_FIELD | DATABASE_COLUMN | PERSISTED | Note |
|---|---|---|---|---|---|---|
| `titulo` | string | yes (falls back to the linked work's title if empty) | `titulo` | `phonograms.titulo` | yes | |
| `codEcad` | string | no | `cod_ecad` | `phonograms.cod_ecad` | yes | |
| `codEntidade` | string | no | `cod_entidade` | `phonograms.cod_entidade` | yes | |
| `agregadora` | select | no | `agregadora` | `phonograms.agregadora` | yes | |
| `isrcPais/Registrante/Ano/Designacao` (4 fields) | string (parts) | no | concatenated into `isrc` (`joinIsrc`) + also sent separately (`isrc_pais` etc.) | `phonograms.isrc`, `.isrc_pais`, `.isrc_registrante`, `.isrc_ano`, `.isrc_designacao` | yes | no format/uniqueness validation (§12.9) |
| `criadaPorIA` | switch | no | `criada_por_ia` | `phonograms.criada_por_ia` | yes | |
| `emissao`/`gravacaoOriginal`/`lancamento` (dates) | date picker | no | `emissao`, `gravacao_original`, `data_lancamento` | same | yes | |
| `duracaoMin`/`duracaoSeg` | number | no | `duracao` (concat) + `duracao_min`/`duracao_seg` | `phonograms.duracao`, `.duracao_min`, `.duracao_seg` | yes | |
| `instrumental`/`nacional`/`pubSimultanea` | switch | no | `instrumental`, `nacional`, `pub_simultanea` | same | yes | |
| `generoMusical`/`midia`/`classificacao`/`paisOrigem`/`paisPublicacao` | select | no | `genero_musical`, `midia`, `classificacao`, `pais_origem`, `pais_publicacao` | same | yes | |
| `status` | select | no | `status` (via `normalizeStatusForDb`) | `phonograms.status` | yes | |
| `gravadora` | string | no | `gravadora` | `phonograms.gravadora` | yes | |
| `observacoes` | textarea | no | `observacoes` | `phonograms.observacoes` | yes | |
| `obraVinculada` (search) | RELATION_SELECTOR | no (warning if typed but not linked) | `obra_id` | `phonograms.obra_id` | yes | |
| `participacao{produtorFonografico[],interprete[],musicoAcompanhante[]}` | 3 repeatable groups | no | `participacao` (raw object) | `phonograms.participacao` (jsonb) | yes, **including each row's `artista_id`** (unlike Work — here there is no normalization, the jsonb saves everything) | percentage with no sum validation (§12.4) |
| `arquivoAudio{name,size}` | UPLOAD (fake) | no | `arquivo_audio` | `phonograms.arquivo_audio` (jsonb) | yes, but **only name+size, never the real file** | **STORAGE_GAP**, see §11 |
| `aceitaTermos` | checkbox | yes in the schema, but **the UI shows `*` as required and the Zod validation has no `.refine` blocking `false`** | — | — | no | same note as for Work |

DTO field never filled by the form: `fileUrl` (legacy alias, always present in
`CreatePhonogramDto` but never in the form builder) — if some external caller sends it, it is
silently discarded in `PhonogramsService.buildEntityPayload()` (`delete out['fileUrl']`), and
never reaches `arquivo_audio` or any other column. `phonograms.audio_file_id`,
`.phonographic_producer_id`, `.main_artist_id`, `.label_id` (real columns, `uuid`, Phase 1 DIRECT)
do not appear in `CreatePhonogramDto`/`UpdatePhonogramDto` nor in any component — dead from the
UI's point of view.

CREATE_FIELDS/EDIT_FIELDS (persisted): 30 phonogram-level fields + 2 fields per row in
each of the 3 `participacao` categories.

---

## 7. Tables/Grids (`RegistroMusicas.tsx`)

### "Obras" (Works) tab

| COLUMN_LABEL | COLUMN_KEY | API_FIELD | DATABASE_COLUMN | SORTABLE | FILTERABLE | SEARCHABLE |
|---|---|---|---|---|---|---|
| "Título" (Title) | `titulo` | `titulo` | `works.titulo` | yes | no | yes |
| "Status" | `status` | `status` | `works.status` | yes | yes (`statusFilter`) | no |
| "Tipo" (Type) | `tipo_obra` | `tipo_obra` | `works.tipo_obra` | yes | yes (`tipoObraFilter`) | no |
| "Cód. Sociedade" (Society code) | `cod_entidade` | `cod_entidade` | `works.cod_entidade` | yes | yes (`ecadFilter`, indirect) | no |
| "Cód. ECAD" (ECAD code) | `cod_ecad` | `cod_ecad` | `works.cod_ecad` | yes | yes (`ecadFilter`) | no |
| "ISWC" | `iswc` | `iswc` | `works.iswc` | yes | no | no |
| "Compositores" (Composers) | `compositores` | `compositores` | `works.compositores` (jsonb→string via `getSortText`) | yes | no | yes |
| "Editora" (Publisher) | `editora` | `editora` | `works.editora` | yes | no | no |
| "Gênero" (Genre) | `genero` | `genero` (via `getObraGeneroDisplay`) | `works.genero` | yes | yes (`genreFilter`) | no |

### "Fonogramas" (Phonograms) tab

| COLUMN_LABEL | COLUMN_KEY | API_FIELD | DATABASE_COLUMN | SORTABLE | FILTERABLE | SEARCHABLE |
|---|---|---|---|---|---|---|
| "Título" (Title) (+ "Sem obra vinculada" (no linked work) badge) | `titulo` | `titulo`, `obra_id` (derived badge) | `phonograms.titulo`, `.obra_id` | yes | yes (`obraVinculadaFilter`, indirect) | yes |
| "Status" | `status` | `status` | `phonograms.status` | yes | yes (`statusFilter`) | no |
| "Cód. Sociedade" (Society code) | `cod_entidade` | `cod_entidade` | `phonograms.cod_entidade` | yes | yes (`fonogramaEcadFilter`, indirect) | no |
| "Cód. ECAD" (ECAD code) | `cod_ecad` | `cod_ecad` | `phonograms.cod_ecad` | yes | yes (`fonogramaEcadFilter`) | no |
| "ISRC" | `isrc` | `isrc` | `phonograms.isrc` | yes | no | no |
| "Compositores" (Composers) | `compositores` | `compositores` | `phonograms.compositores` (text) | yes | no | yes |
| "Intérpretes" (Performers) | `interpretes` | `interpretes` | `phonograms.interpretes` (text) | yes | no | no |
| "Produtor" (Producer) | `produtores` | `produtores` | `phonograms.produtores` (text) | yes | no | no |
| "Gênero" (Genre) | `genero_musical` | `genero_musical` (via `getFonogramaGeneroDisplay`) | `phonograms.genero_musical` | yes | yes (`genreFilter`) | no |

18 visible columns in total, all with a confirmed source (0 without a source). Note: `phonograms.interpretes`/
`.produtores` (legacy text columns, Phase 1 DIRECT) are displayed in the grid but are **not**
filled by the current `FonogramaFormModal` (which uses the structured `participacao` jsonb, not these two
free-text columns) — they stay empty in any phonogram created by the real form; they only
appear filled in legacy records or records imported by another route.

---

## 8. Details, Filters, Search, Sort, Pagination

**DETAILS** (`ObraViewModal.tsx`, `FonogramaViewModal.tsx`): every displayed field has a `DISPLAY_FIELD`
mapped 1:1 to the same form column (the same mappers `obraTitulo`, `obraIaHarmonia` etc. reused
from `services/registro-musicas.mapper.ts`) — no detail field is orphaned. `EMPTY_STATE`: entire
sections are omitted (`{condicao && <Separator/>...}`) when all the fields in that section are
empty — consistent between the two modals.

**FILTERS** (8, all client-side, `RegistroMusicas.tsx`): `searchTerm`, `statusFilter`,
`genreFilter`, `tipoObraFilter` (works), `projetoFilter` (works), `obraVinculadaFilter`
(phonograms), `ecadFilter` (works), `fonogramaEcadFilter` (phonograms). No filter becomes an
HTTP query param — all of them operate on the array already loaded in memory (see the limit gap in §12.6).

**SEARCH**: `searchTerm` does `.toLowerCase().includes()` over `titulo`+`compositores` (+ `projetos.titulo`
for works, a field that — as proven in §4 — is always `undefined` at real runtime, so that part of the
search never finds anything by project). Case-insensitive, no accent normalization. No searched
field is encrypted (there is no PII in this module).

**SORT**: 18 sortable columns (one per grid column), via `sortTableRows`/`nextTableSortState`
(shared/lib/table-sort.ts) — 100% client-side over the already-loaded array.

**PAGINATION**: `usePagination(filteredObras, 10)` / `usePagination(filteredFonogramas, 10)` —
100% client-side pagination (in-memory slice, initial `pageSize` 10, adjustable). `TOTAL_COUNT_SOURCE`
= `filteredObras.length`/`filteredFonogramas.length`, which in turn derives from the array already limited to
50 by the backend (§12.6) — the total displayed may be wrong beyond 50 records.

---

## 9. Contributors/Participants and Splits

| RESOURCE | PARTICIPANT | ROLE | PERCENTAGE_FIELD | DATABASE_TABLE | VALIDATION | TOTAL_EXPECTED |
|---|---|---|---|---|---|---|
| Work (`works`) | free-text name (optionally linked to an `Artista` via autocomplete, id not persisted) | `classeFuncao` (Editor/Administrador/Compositor-Autor/Tradutor, free text) | `percentual` (string, no fixed decimal places) | `work_participants` | none (`type="number"` field, but no `min`/`max`/step) | 100% displayed in the UI ("Percentual total: X% de 100%"), **never blocked on submit** |
| Phonogram (`phonograms`) | same (3 fixed categories: Produtor Fonográfico, Intérprete, Músico Acompanhante — phonographic producer, performer, backing musician) | implied by the category | `percentual` per row | `phonograms.participacao` (jsonb, no normalization) | none | 3 subtotals (41.7%/41.7%/16.6%) + grand total displayed, **never blocked** |

`SPLIT_VALIDATION_GAP` (×2): neither frontend nor backend prevents saving with a sum ≠ 100%, negative
percentages, or non-numeric percentages beyond HTML's `type="number"` (which is not real enforcement —
the value arrives as a string and is converted with `parseFloat(...) || 0` only for display; the raw
typed value is what gets persisted). `replaceParticipantes()` (works.service.ts:69) does a full DELETE+INSERT
on every save — no versioning, no history of split changes.

`ParticipanteViewModal.tsx`: read-only, shows `Artista` fields (legal name, pseudonym, person
type, gender, birth date, CPF/CNPJ, CAE) when the typed name matches an existing artist — it
persists nothing, it is purely informational/local to the session (RUNTIME_ONLY).

---

## 10. Identifiers (ISRC/ISWC/ECAD)

| IDENTIFIER_TYPE | FRONTEND_FIELD | VALIDATION | NORMALIZATION | UNIQUENESS | DATABASE_COLUMN | GENERATED_OR_MANUAL | SOURCE_OF_TRUTH |
|---|---|---|---|---|---|---|---|
| ISWC (work) | `iswc` | `@MaxLength(20)` in the DTO; no format regex | none | **no** (Phase 1: `unique: false`, no `check_constraint`) | `works.iswc` | manual | tenant (free typing) |
| ISRC (work) | `isrc` | `@MaxLength(20)` | none | **no** | `works.isrc` | manual | tenant |
| ECAD/Society code (work) | `codEcad`/`codEntidade` | `@MaxLength(100)` | none | **no** | `works.cod_ecad`/`.cod_entidade` | manual | tenant |
| ISRC (phonogram, composite) | `isrcPais`+`isrcRegistrante`+`isrcAno`+`isrcDesignacao` | `@MaxLength` per sub-field in the DTO; concatenation via `joinIsrc()` only produces a string if all 4 parts are filled in | partial (concatenation `PP-RRR-AA-DDDDD`) | **no** | `phonograms.isrc` (+ 4 part columns) | manual | tenant |
| ECAD/Society code (phonogram) | `codEcad`/`codEntidade` | `@MaxLength(100)` | none | **no** | `phonograms.cod_ecad`/`.cod_entidade` | manual | tenant |

`IDENTIFIER_GAP` (1, covering the 5 identifiers above): no identifier has format
validation (ISRC regex `CC-XXX-YY-NNNNN` / ISWC `T-DDDDDDDDD-C`) or a duplicate check in any
layer (DB `unique: false`, no `check_constraint`; the services' `create()`/`update()` do not do a
`SELECT ... WHERE isrc = ...` before inserting). The `external_identifiers` registry (a generic table,
Phase 1: 12 DIRECT columns, `entity_type`/`entity_id`/`provider`/`identifier_type`/`identifier_value`)
exists in the schema precisely to model this in an extensible way, but **is not written by any
real flow** (confirmed — no `works`/`phonograms` service references `ExternalIdentifierEntity`;
it is only consumed by `registry/external-identifiers.controller.ts`, which in turn has no frontend
consumer, see §11).

---

## 11. `registry` (rights-holders, external-identifiers, society) — real consumption

An exhaustive search (`grep -rn "'/registry\|registry/rights-holders\|registry/society\|registry/submissions"
apps/web/src`) confirms **zero** occurrences. All 6 controllers of the `registry` module
(`rights-holders.controller.ts`, `external-identifiers.controller.ts`,
`registry-operations.controller.ts`, `society-accounts.controller.ts`,
`society-submissions.controller.ts`, `society-sync.controller.ts`) are correctly protected
(`@RequireRole('viewer'|'editor'|'manager')`, `@ApiBearerAuth()`) but **none has a frontend
consumer** — neither a dedicated screen nor indirect use via another module.

Additionally confirmed through the central import/export mechanism (`apps/api/src/modules/reports/
entity-metadata.service.ts:64,77,78,81`): `rights_holders`, `society_submissions`, `society_accounts`
and `work_participants` are **explicitly marked `EntityCategory.NOT_REPORTABLE`** — that is,
even the generic "Central de Relatórios" (Reports Center) route (which covers `works`/`phonograms`, see §13) is
deliberately closed for these tables. `CREATE`/`EDIT`/`DISPLAY`/`RELATIONS`/`PII`/`SPLITS`/
`RIGHTS_USAGE` of `rights_holders`: all **N/A — no UI at all**. No data is printed here
(it was not necessary to query values, only the existence of the code path).

The `ABRAMUS_PAYLOAD_BUILDER` (`registry/payloads/abramus-payload-builder.service.ts`) and
`society-payload-builder.service.ts` are consumed only internally by
`registry-operations.service.ts`/`society-sync.service.ts` — no public route exposes them to
this module's frontend.

This is a large-scale **REAL_MAPPING_GAP**: an entire backend domain, correct and secure,
with no way for the end user to reach it.

---

## 12. Consolidated gaps (evidenced, not fixed)

1. **REAL_MAPPING_GAP** — `works.artista_id`: `ObraFormModal.tsx:486` always sends
   `artistaId: null` in the create **and** edit payload (there is no React state for this field in the
   component, even though `obraToFormFields()` already computes `artistaId: obra?.artista_id ?? ""`
   correctly from the record). Consequence: editing any work that already has
   `artista_id` filled in (e.g. via `projetoToObraSeed()`, which sets `artista_id: projeto.artista_id`)
   **silently erases** the direct work↔artist link on save.
2. **REAL_MAPPING_GAP** — `CreatePhonogramDto.fileUrl` (legacy alias, `@ApiPropertyOptional`)
   is accepted and validated by the DTO but always discarded in `PhonogramsService.buildEntityPayload()`
   (`delete out['fileUrl']`) — it never reaches any column.
3. **REAL_MAPPING_GAP** — `CreateWorkDto.authors`/`.shares` (`Record<string,unknown>[]` arrays,
   validated by the DTO) do not correspond to any `works` column nor are they handled in the service —
   TypeORM silently discards unmapped properties on `save()`. No current screen
   fills these fields (confirmed in `ObraFormModal`/mapper), but the DTO allows them to be sent via the API
   directly without any warning that the data will be lost.
4. **SPLIT_VALIDATION_GAP** — `work_participants.percentual`: the sum is displayed but never validated
   (neither client nor server) against 100% — see §9.
5. **SPLIT_VALIDATION_GAP** — `phonograms.participacao[*].percentual` (3 categories): same pattern,
   never validated — see §9.
6. **STORAGE_GAP** — Audio upload in `FonogramaFormModal.tsx` (`handleAudioUpload`,
   line ~487) only reads `file.name`/`file.size` from the browser's `File` object and writes those two values
   into `arquivo_audio` (jsonb) — **the file's binary is never transmitted to any storage
   provider** (no `FormData`, no upload `fetch`/`api.post`, no presigned URL). The real column
   `phonograms.audio_file_id` (uuid, Phase 1 DIRECT, presumably intended to reference a
   real upload record) is never written by any flow. Same pattern already recorded in
   `accounting.md` (attachments) and `audiovisual.md` (STORAGE_GAP).
7. **REAL_MAPPING_GAP** — `useAbramusImport()` (`useAbramus.ts:167`) is a hardcoded stub that
   always calls `backendUnavailable(...)` (throws an error) — there is no
   `/integrations/abramus/import-*` route in the backend (an exhaustive grep in `integrations.controller.ts`
   confirms only 7 real routes: `configure`, `status`, `disconnect`, `search-artist`, `search-work`,
   `register-work`, `statements`). Result: clicking an ABRAMUS search result in
   `AbramusSearchRow.tsx` to **import** a new work/phonogram always fails with an error toast.
8. **REAL_MAPPING_GAP** — `useAbramusLocalLookup()` (`useAbramus.ts:183`) is a stub that always
   returns an empty `Map` (comment in the code itself:
   "sem [vínculo persistido], não há match a exibir" — without a persisted link there is no match
   to display) — the "already imported" detection ("Já no sistema" (already in the system) badge in
   `AbramusSearchRow.tsx`) never fires in practice.
9. **REAL_MAPPING_GAP** — `useAbramusSyncAll()` (used by the sync button in
   `AbramusConfigDialog.tsx`) is another `backendUnavailable(...)` stub — it always fails.
   `useAbramusRegisterFonograma`, `useAbramusGenerateISWC`, `useAbramusGenerateISRC` are equivalent
   stubs, but **they are not even imported** by any component (dead code, not merely a
   functional gap). `useAbramusSearchArtists`/`useAbramusRegistrationHistory` also have no
   consumer.
10. **REAL_MAPPING_GAP** — the entire `registry` module (rights-holders, external-identifiers,
    society accounts/submissions/sync) has no frontend consumer — see §11.
11. **REAL_MAPPING_GAP** — `GET /works` and `GET /phonograms` use `PaginationDto.limit = 50`
    as the default (`apps/api/src/common/dto/pagination.dto.ts:16`), and neither `useObras()` nor
    `useFonogramas()` (nor the Audit's `runner.ts`, §2) pass `limit`/`offset` — every tenant with
    more than 50 works or 50 phonograms never sees the oldest records in `RegistroMusicas.tsx`;
    the client-side "pagination" (`usePagination`, 10 per page) and the displayed totals (`Total: X`,
    pending/under review/registered/approval-rate metrics) operate only on that window of
    up to 50 records — incorrect numbers beyond that limit, with no warning to the user.
12. **IDENTIFIER_GAP** — ISRC/ISWC/society codes with no format validation or duplicate
    check in any layer — see §10.

Total: 9 REAL_MAPPING_GAP, 2 SPLIT_VALIDATION_GAP, 1 STORAGE_GAP, 1 IDENTIFIER_GAP = **13 gaps**.

Findings not classified as a formal "gap", but recorded as dead code:
`useCatalogStore` (Zustand, never imported), `catalog.service.ts` (`catalogService`, never
imported — `RegistroMusicas.tsx` uses `useObras`/`useFonogramas`, not this service),
`constants/index.ts`/`utils/index.ts`/`forms/index.ts` (empty stub files).

---

## 13. Import/Export/XLSX

There is no import/export button inside `RegistroMusicas.tsx` (confirmed by reading the whole
file, 859 lines — no reference to `reports-api`, `XLSX`, or `ImportDialog`). Real access
is via the **generic Reports Center** (`apps/web/src/modules/reports/pages/Relatorios.tsx`),
which consumes `GET /reports/entities` (backend) and uses the contracts:

- `WORKS_CONTRACT` (`report-form-contracts.ts:180`, label "Obras", `order: 3` in
  `report-module-registry.ts:21`) — 26 exportable/importable fields (`col()`) + 8
  read-only fields (`ro()`), 34 exportable columns in total. Fields explicitly excluded from the form
  (`excludedFormFields`): `metadata` (internal jsonb), `authors`/`shares` (managed on their own screens
  — see gap #3 above, since `authors` in practice has no screen at all), `participantes` (managed in
  `work_participants`), `co_compositores`/`detentores`/`abramus_protocol` (columns removed in
  migrations 20260718000011/20260718000016).
- `PHONOGRAMS_CONTRACT` (`report-form-contracts.ts:212`, label "Fonogramas", `order: 4`) — 31 `col()`
  fields + 14 `ro()`, 45 exportable columns in total. Excluded: `metadata`, `fileUrl` (the contract's own
  comment states "gerido pelo fluxo de upload (audio_file_id)" (managed by the upload flow) — **inaccurate**, since there is no
  real upload flow, see gap #6), `abramus_protocol`.

`IMPORT_FIELDS`: 26 (works) + 31 (phonograms) = 57. `EXPORT_FIELDS`: 34 + 45 = 79.

**XLSX**: the generic engine (`export-format.service.ts`, `import-engine.service.ts`,
`import-parser.service.ts`) always generates/requires **exactly 1 worksheet per entity**
(`XLSX.utils.book_append_sheet()` called only once in the export/template; the import parser
explicitly rejects files with `workbook.SheetNames.length !== 1`). `WORKSHEET_COUNT = 1` in
all cases — `XLSX_RULE_VIOLATION: NÃO` (no) for the real works/phonograms path (the
`<= 2` rule is comfortably met; no active or dead code in this module generates multiple sheets).

**Duplicates on import** (§27 of the prompt): the generic `import-engine`/`import-parser` have no
special deduplication logic by ISRC/ISWC (row validation uses the field contract, not
per-entity business rules) — in the absence of uniqueness in the database (gap #12), an XLSX import can
create duplicate works/phonograms by ISRC/ISWC without warning. The real rule, not the ideal one: **no
duplicate validation exists** for this module.

---

## 14. Storage/Audio (complete flow)

| FORM_FIELD | RESOURCE_TYPE | DATABASE_REFERENCE | STORAGE_PROVIDER | UPLOAD_ENDPOINT | DISPLAY/DOWNLOAD | DELETE | TENANT_ISOLATION |
|---|---|---|---|---|---|---|---|
| `arquivoAudio` (`FonogramaFormModal`) | audio (mp3/wav/flac) | `phonograms.arquivo_audio` (jsonb `{name,size}`) | **none** — the file never leaves the browser | none (no upload endpoint is called) | `FonogramaViewModal` shows the name + formatted size, with no player or download link (there is no real URL) | `setArquivoAudio(null)` — only clears the local state/jsonb, nothing to delete in storage | N/A (a remote object never comes to exist) |

Real flow:
`upload (fake, só metadata local) → persistence (jsonb {name,size}) → read (mesmo jsonb) → download/preview (inexistente) → delete (limpa só o jsonb)`
(upload is fake with local metadata only; read uses the same jsonb; download/preview does not exist; delete clears only the jsonb). There is no audio player, no preview,
no link. `phonograms.audio_file_id` (a real column, probably intended to reference an
`uploads` entry) remains `NULL` for every phonogram created by the current UI.

---

## 15. `release_works` — traceability from the catalog side

Phase 1/the earlier cross-check (doc80) already confirmed `release_works` as `MATCH` via `@JoinTable`
(a pure join table, 2 columns: `release_id`→`releases.id`, `work_id`→`works.id`,
`backendMapping: RELATION_ONLY`). From the catalog side:

- `OWNING_ENTITY`: `Release` (`releases` module, not yet audited — not reopened here).
- `RELATED_ENTITY`: `Work` (`works`).
- `JOIN_COLUMNS`: `release_id`, `work_id` (no extra columns — a pure join, no per-row metadata).
- `UI_FLOW`: no `catalog` component creates/edits/reads `release_works` directly — the
  work↔release link is managed entirely on the `releases` side (out of scope here).
- `CREATE/EDIT/READ_BEHAVIOR`: not observable from the catalog side — no call, hook or screen in
  `apps/web/src/modules/catalog/**` references `release_works` or `releases`.

`RELEASE_WORKS_CATALOG_SIDE_COMPLETE: SIM` (yes) (the traceability from the catalog side is "no consumption" —
a confirmed fact, not an investigation gap).

---

## 16. Catalog ↔ Artist / Catalog ↔ Release relation (boundary, not re-audited)

| CATALOG_FIELD | ARTIST_ENDPOINT | ARTIST_VALUE_FIELD | DATABASE_RELATION | CARDINALITY |
|---|---|---|---|---|
| `works.artista_id` | `GET /artists` (via `useArtistas()`) | `nome_artistico`/`nome_civil` | `works.artista_id → artists.id` | N:1 (always `null` in practice — gap #1) |
| `phonograms.artista_id` | same | same | `phonograms.artista_id → artists.id` | N:1 |
| `work_participants`/`participacao[*]` (typed name) | local resolution via `useArtistas()` (autocomplete, not an FK) | `nome_artistico`/`nome_civil` | none (free text, `artista_id` not persisted in `work_participants`) | informal N:N |

| CATALOG_RESOURCE | RELEASE_RELATION | DATABASE_FK_OR_JOIN | FRONTEND_USAGE | BACKEND_USAGE |
|---|---|---|---|---|
| `works` | `release_works` (join) | `release_works.work_id → works.id` | none in `catalog` | `releases` module |
| `works`/`phonograms` | `shares` (registration/rights splits, a table separate from `work_participants`) | `shares.obra_id → works.id` (real FK); `shares.fonograma_id` (uuid, no FK declared in Phase 1) | `GestaoShares.tsx`, `SharePendenteFormModal.tsx` (`releases` module, not `catalog`) | `apps/api/src/modules/shares/**` |

`shares` (43 columns, raw SQL, `ShareEntity` nearly empty — only id/created_at/updated_at declared,
the rest via a manual query builder) is the real **rights/registration splits** system (percentage,
territory, role, `rights_holder_id`, `publisher_id`) — distinct from and more complete than
`work_participants` (simple credits) and `phonograms.participacao` (display jsonb). It functionally belongs
to the `releases` module; it was not fully audited here, only recorded as a relation,
per the scope of Prompt 101 §16.

---

## 17. Permissions and Tenant Isolation

| PERMISSION | FRONTEND_ENFORCEMENT | BACKEND_ENFORCEMENT |
|---|---|---|
| `work:read` | `RequirePermission module="catalog" action="write"` only on the create button; reading the list is not gated in the frontend | `@RequireRole('viewer') @RequirePermission('work:read')` on `GET /works`, `GET /works/:id` |
| `work:create` | same ("Nova Obra" (New Work) button via `RequirePermission`) | `@RequireRole('editor') @RequirePermission('work:create')` |
| `work:update` | no visible gate on the grid's "Editar" (Edit) button | `@RequireRole('editor') @RequirePermission('work:update')` |
| `work:delete` | no visible gate on the "Excluir" (Delete) button | `@RequireRole('manager') @RequirePermission('work:delete')` |
| `phonogram:read/create/update/delete` | same pattern (only the "Novo Fonograma" (New Phonogram) button is gated) | the same 4 levels, same pattern, in `phonograms.controller.ts` |
| `registry.rights_holders.*` | N/A (no UI) | `@RequireRole('viewer'|'editor'|'manager')` on every route — correctly protected, despite being unreachable |

`AUTHORIZATION_GAP`: **0** (all real routes are protected; the only buttons without an explicit
gate — Edit/Delete in the grid — still depend on the backend refusing the call, so it is not an
authorization failure, only the absence of early feedback in the UI).

`TENANT_ISOLATION_GAP`: **0**. `works.service.ts`/`phonograms.service.ts` filter
`tenant_id = :tenantId` (resolved via `@CurrentTenant()`, never from the raw header — the same
`TenantGuard` pattern already verified in `auth.md`) in `list`/`findById`/`update`/`softDelete`; `create` writes
`tenant_id: tenantId` coming from the authenticated context, never from the body. `work_participants` and
`phonograms.participacao` do not need their own `tenant_id` — isolation is guaranteed by the FK/
ownership of the parent row (`work_id`/they belong to the already-isolated parent record). `release_works` (a pure
join, with no `tenant_id` of its own) has isolation guaranteed transitively through the two FKs
(`releases.tenant_id` and `works.tenant_id`, both always equal by construction — not verified here
since it is outside the scope of the `releases` module).

---

## 18. Delete/Archive

| UI_ACTION | ENDPOINT | DATABASE_BEHAVIOR | FK_IMPACT | SOFT_OR_HARD |
|---|---|---|---|---|
| Delete work (individually or in bulk) | `DELETE /works/:id` | `UPDATE works SET deleted_at = now()` | `work_participants` **is not cleaned up** (no cascade, no manual removal) — orphaned rows remain after the parent work is soft-deleted; `phonograms.obra_id` is not cleaned up either (phonograms remain "linked" to a soft-deleted work, without warning) | SOFT |
| Delete phonogram (individually or in bulk) | `DELETE /phonograms/:id` | `UPDATE phonograms SET deleted_at = now()` | no child table | SOFT |

No restore screen (`restore`) found for soft-deleted works/phonograms — `deleted_at`
is written but there is no endpoint or "undo delete" button in either controller.

---

## Final counters (Zero-Gap)

```
SUBDOMAINS_AUDITED: 10
COMPONENTS_AUDITED: 13
HOOKS_AUDITED: 3
CREATE_FORMS: 2
CREATE_FIELDS: 53 (23 work + 30 phonogram, record level; +4/+2/+2 per repeatable row)
EDIT_FORMS: 2
EDIT_FIELDS: 53 (same fields as create, same component)
MODALS_DRAWERS_WIZARDS: 6 (ObraFormModal, FonogramaFormModal, ObraViewModal, FonogramaViewModal,
                           ParticipanteViewModal, ObraTipoSelectorModal)
TABLE_GRID_COLUMNS: 18
DETAIL_DISPLAY_FIELDS: 47
RELATION_FIELDS: 10
CONTRIBUTOR_FIELDS: 11
SPLIT_FIELDS: 3
IDENTIFIER_FIELDS: 11
FILTERS: 8
SEARCH_FIELDS: 3 (local work, local phonogram, remote ABRAMUS)
SORT_FIELDS: 18
IMPORT_FIELDS: 57
EXPORT_FIELDS: 79
XLSX_EXPORTS: 2 (Obras, Fonogramas — generic Reports engine)
XLSX_RULE_VIOLATIONS: 0
STORAGE_FIELDS: 2 (arquivo_audio, audio_file_id)
REALTIME_EVENTS: 0
PERMISSIONS_AUDITED: 8 (work:read/create/update/delete, phonogram:read/create/update/delete)
AUTHORIZATION_GAPS: 0
TENANT_ISOLATION_GAPS: 0
CREDENTIALS_REQUIRED_LATER: 0 (ABRAMUS already has its own tenant-owned credentials flow, implemented)

CODE_FIELD_ONLY: 0
DATABASE_COLUMN_ONLY: 0
TYPE_MISMATCH: 0
NULLABILITY_MISMATCH: 0
DEFAULT_MISMATCH: 0
ENUM_MISMATCH: 0
RELATION_MISMATCH: 0
CREATE_MAPPING_MISMATCH: 1 (works.artista_id always null)
EDIT_MAPPING_MISMATCH: 1 (same field, same component)
DISPLAY_MAPPING_MISMATCH: 1 (ObraWithRelations/FonogramaWithRelations.artistas/projetos always undefined)
SPLIT_VALIDATION_GAPS: 2
IDENTIFIER_GAPS: 1
STORAGE_GAPS: 1
EXTERNAL_INTEGRATION_GAPS: 4 (ABRAMUS import, local-lookup, sync-all, phonogram/ISWC/ISRC registration via ABRAMUS — all stubs)
REAL_MAPPING_GAPS: 9

RELEASE_WORKS_CATALOG_SIDE_COMPLETE: YES
RIGHTS_HOLDERS_TRACEABILITY_COMPLETE: YES (traced as zero consumption, not as an investigation gap)
AUDITORIA_TSX_CATALOG_SECTION_COMPLETE: YES

UNMAPPED_CREATE_FIELDS: 0
UNMAPPED_EDIT_FIELDS: 0
UNMAPPED_DISPLAY_COLUMNS: 0
UNMAPPED_RELATION_FIELDS: 0
UNMAPPED_SPLIT_FIELDS: 0
UNMAPPED_IDENTIFIER_FIELDS: 0
UNMAPPED_IMPORT_FIELDS: 0
UNMAPPED_EXPORT_FIELDS: 0
UNMAPPED_STORAGE_FIELDS: 0
UNKNOWN_FIELD_CLASSIFICATIONS: 0
```

NEXT_MODULE: `contracts`
