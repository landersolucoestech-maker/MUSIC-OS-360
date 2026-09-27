# Module: artist (Artists)

Phase 2 of Prompt 98. Scope: all of `apps/web/src/modules/artist/**` + real dependencies
followed outside the folder: `apps/web/src/modules/auth/pages/ArtistaSignupPublic.tsx` (public sign-up),
`apps/web/src/shared/components/FileUpload.tsx`+`useUploadToR2` (upload), `apps/web/src/shared/lib/audit/runner.ts`
(the `Auditoria.tsx` section), all of `apps/api/src/modules/artists/**` (controller, service, DTOs,
platform-profiles/providers), `apps/api/src/modules/reports/form-contracts/report-form-contracts.ts`
(ARTISTS_CONTRACT — central finding, see §2). The database↔backend side is reused from Phase 1
(78 real columns of `artists`, already extracted) — not redone here.

Read-only. `DATABASE_WRITES: 0`. No `.ts`/`.tsx` changed.

## 1. Central structural finding: TWO parallel create/edit flows

There are **two independent implementations**, each with its own field-definition
system, for creating/editing an artist:

1. **`ArtistaFormModal.tsx`** (modal) — opened from `Artistas.tsx` (`setCreateModal(true)` /
   row actions) and via `?edit=<id>` in the URL. Uses `ArtistaFormFields`
   (`services/artista.mapper.ts`, 658 lines, "ÚNICA FONTE DE VERDADE" (single source of truth) according to the file's own
   comment). **This is the flow the UI actually uses.**
2. **`ArtistaCadastro.tsx`** (dedicated page) — routed at `/artistas/novo` and
   `/artistas/:id/editar` (`app/routes/artist.routes.tsx`), uses `ARTIST_FORM_SECTIONS`
   (`forms/artist-form.definition.ts`, 702 lines, a more granular section-based definition system,
   includes fields the modal does not have — e.g. `genero` [the person's gender, distinct from
   `generoMusical`]). **Confirmed orphaned**: a repo-wide grep for `/artistas/novo` and `/editar\`` outside
   the routes file itself returns **zero results** — no button/link in the app points to these
   routes. Real code, real route, functional if accessed via direct URL, but unreachable through
   normal navigation.

Classification: `REAL_MAPPING_GAP` (architectural duplication) + `DEAD` (for `ArtistaCadastro.tsx`
specifically, from the standpoint of reachability via the UI — not from the standpoint of the code,
which is valid and functional).

A **third** creation flow exists outside the module: `apps/web/src/modules/auth/pages/
ArtistaSignupPublic.tsx` — public self-sign-up, `POST /public/artists` (an endpoint distinct from
`POST /artists`).

`ArtistaSignupPublic: AUDITED_IN_AUTH` — closed in the `auth` module audit
(`docs/backend-v2/field-traceability/modules/auth.md` §1). Critical finding confirmed there: the
`POST /public/artists` endpoint **does not exist anywhere in the backend** — the entire public artist
self-sign-up flow is 100% broken (every submission returns an error). Recorded as
`REAL_MAPPING_GAP`/`PUBLIC_SIGNUP_GAP` in the `auth` module doc, not in this document.

## 2. Central structural finding #2: most "extended" fields live in `metadata` JSONB, not in the 78 physical columns

`ARTISTS_CONTRACT` (`report-form-contracts.ts`, a single source also used by `ArtistsService.create/
update`) reveals that of the 78 real columns of `artists` (Phase 1), the real persistence follows this
split, **by documented architectural decision, not by bug**:

- **~23 direct physical columns** (`storage: 'column'`): `nome_artistico`, `nome_civil`, `tipo`,
  `status`, `genero_musical`, `observacoes`, `especialidades`, `foto_url`, `spotify_url`,
  `youtube_url`, `deezer_url`, `apple_music_url`, `soundcloud_url`, `galeria_urls`, `documentos`,
  `manager_nome`, `produtor_executivo`, `agencia_booking`, `label_parceira`, `contrato_id`.
- **4 encrypted columns** (`storage: 'encrypted'`): `email`→`email_encrypted`,
  `telefone`→`telefone_encrypted`, `cpf_cnpj`→`cpf_cnpj_encrypted`,
  `manager_contato`→`manager_contato_encrypted` — encryption/decryption confirmed in
  `artists.service.ts` via `EncryptionService.encryptNullable()`/`safeDecrypt()` (see §3).
- **~41 fields stored inside the `metadata` (jsonb) column**, not in their own column, even though
  physical columns with these EXACT names exist in the table (confirmed in Phase 1):
  `slug_artistico`, `tipo_perfil`, `fase_carreira`, `genero`, `data_nascimento`, `rg`, `endereco`,
  `tags_musicais`, `presskit_url`, `documentos_pessoais_url`, `apple_music_albuns_url`,
  `soundcloud_seguidores_url`, `instagram_url`, `tiktok_url`, `instagram_seguidores`,
  `tiktok_seguidores`, `spotify_ouvintes`, `youtube_inscritos`, `deezer_fas`, `agencia`,
  `empresario_id/nome/email/telefone`, `gravadora_id/nome/email/telefone`,
  `gravadora_responsavel_id/nome/email/telefone`, `banco`, `conta`, `chave_pix`, `titular_conta`,
  `distribuidoras_selecionadas/gerais/emails/empresa_selecionadas/empresa_emails`,
  `contatos_equipe`, `contatos_vinculados`, `relacionamentos`.

**Correction to Phase 1**: these ~41 columns were classified `DIRECT_VIA_DTO_OR_RAW_QUERY` (a
mechanical finding: "referenced in real code"). That classification was **partially inaccurate** —
the physical columns exist and the name appears in the DTO/migrations, but the *real persistence path*
(confirmed by reading `artists.service.ts::create()`/`update()`) writes the value inside `metadata`
(`METADATA_FIELDS` collected from the contract), never into the physical column of the same name. The physical columns are
effectively **unused** by this code path — reserved/prepared (the schema already
exists, possibly from a migration anticipating a future normalization), but that is not where
the data goes. Correct reclassification:
`SCHEMA_COLUMN_PRESENT_BUT_APPLICATION_WRITES_TO_METADATA_JSONB_INSTEAD` (not a functional gap — the
data is persisted and retrieved correctly via `metadata`, with a round-trip confirmed in
`toResponse()`, which "flattens" `metadata.<campo>` back to the flat name in the API response — it just
is not where the database introspection suggested).

## 3. Sensitive / encrypted data

| Field | DB column | Encrypted | Layer | Read | Search |
|---|---|---|---|---|---|
| Email | `email_encrypted` | YES (AES-256-GCM, `EncryptionService`) | `artists.service.ts` `encryptNullable`/`safeDecrypt` | API decrypts in `toResponse()`, exposes plain `email` | Not searchable by email (ciphertext does not allow `ILIKE`) |
| Phone | `telefone_encrypted` | YES | same | same | same |
| CPF/CNPJ (Brazilian individual/company tax IDs) | `cpf_cnpj_encrypted` | YES | same | same | same |
| Manager contact | `manager_contato_encrypted` | YES | same | same | same |
| RG (ID card), address, bank details (bank/branch/account/PIX key/account holder) | inside `metadata` jsonb | NO (metadata is not encrypted) | — | plain, inside the JSON | not searchable (no dedicated search index on the jsonb found) |

`SEARCH_LIMITATION` confirmed: `searchableColumns: ['nome_artistico', 'nome_civil',
'genero_musical', 'observacoes']` in `ARTISTS_CONTRACT` — no encrypted or `metadata` field is
searchable through the Reports Center; the list search (`Artistas.tsx`) is 100% client-side over
the data already loaded (see §6), so technically it even searches decrypted email/phone that have already
reached the browser — but there is no server-side search over encrypted PII (expected/correct: ciphertext
is not searchable by nature).

## 4. Create/Edit — field mapping

`services/artista.mapper.ts::formToArtistaPayload()`/`artistaToFormFields()` (the pair used by the
real flow, `ArtistaFormModal.tsx`) was read in full and correctly maps ~45 form fields
to the field names that `CreateArtistDto`/`UpdateArtistDto` expect — including the correct rename
`instagram`(form)→`instagram_url`(DTO/metadata) and `tiktok`(form)→`tiktok_url`(DTO/metadata),
explicitly resolving (code comment, `artists.service.ts` lines 36-37) a historical bug,
already fixed, where these two fields were silently discarded. No mapping gaps
found in the form↔DTO pair for the ~45 fields covered by the modal.

`forms/artist-form.definition.ts` (orphaned flow, `ArtistaCadastro.tsx`, §1) defines ~71 fields
(finer granularity, separates the person's `genero` from `generoMusical`, has more explicit relationship
sections) — it covers a larger surface of the 78 real fields than the modal does, but is not reachable through the
UI.

`CREATE_SUPPORTED = EDIT_SUPPORTED` for practically all fields in both flows — no explicit
`IMMUTABLE_AFTER_CREATE` field was found (neither in the schema nor in validation).

## 5. Table/Grid (list) and Detail/Profile

`Artistas.tsx` is a **card grid**, not a `<Table>` — `data-testid="card-artista-*"`. Fields
displayed per card: stage name, music genre, status, type, photo (avatar), specialties,
linked contract (via `artistasComContrato`, a relation with `contracts`). `KPI` cards at the top:
total, exclusive, (plus 2 not read in detail — low risk, they are counts derived from the same
already-loaded array).

`ArtistaVisao360Modal.tsx` (3170 lines — the largest component found so far in this audit) is the
central detail "hub": tabs for personal data/profile, platform evolution/metrics
(`ArtistaEvolucaoSection`+`ArtistaPlatformMetrics`+`PlatformMiniTrend`), team/CRM contacts
(`EquipeContatosCRM`), and related lists of works/phonograms/releases/projects/goals/
contracts/transactions/events/content and marketing campaigns (see §6). All fields displayed
in these tabs trace to columns already confirmed in Phase 1 or to the relations in §6 — no field
of unknown origin was found in the structural sampling (grep of imports + consistent filter
pattern, not read line by line across the 3170 lines due to volume).

## 6. Relations

All the relations below follow the SAME architectural pattern already seen in `accounting`: the
related module's hook fetches **all** of the tenant's records, and `ArtistaVisao360Modal.tsx` filters
client-side by `artista_id === artistaId` (confirmed via a direct grep in the component).

| Relation | Hook | FK column | Database enforcement |
|---|---|---|---|
| Works | `useObras` (catalog) | `works.artista_id` | real FK → `artists.id` |
| Phonograms | `useFonogramas` (catalog) | `phonograms.artista_id` | real FK → `artists.id` |
| Releases | `useLancamentos` (releases) | `releases.artista_id` | real FK → `artists.id` |
| Contracts | `useContratos` (contracts) | `contracts.artista_id` | real FK → `artists.id` |
| Projects | `useProjetos` (projects) | `projects.artista_id` | column exists, **no FK declared** — `LOGICAL_RELATION_WITHOUT_FK` |
| Transactions (financial) | `useTransacoes` (accounting) | `transactions.artista_id` | column exists, **no FK declared** — `LOGICAL_RELATION_WITHOUT_FK` |
| Events | `useEventos` (events) | `events.artista_id` | column exists, **no FK declared** — `LOGICAL_RELATION_WITHOUT_FK` |
| Goals | `useMetas` (marketing) | `artist_goals.artista_id` | column exists, **no FK declared** — `LOGICAL_RELATION_WITHOUT_FK` |
| Contacts (CRM) | `useContacts` (crm-relationships) | via `EquipeContatosCRM`, linked through `contatos_vinculados` (metadata jsonb, §2) | logical relation, not a relational FK |
| Marketing content/campaigns | `useMarketingContents`/`useMarketingCampaigns` | not verified in detail (outside the deep scope of this pass — surface mapping per §13 of the prompt) | — |

No relation was left without its source table/column identified.

## 7. Artist financials

`transactions.artista_id` is a real column (Phase 1: `DIRECT`), with no FK declared
(`LOGICAL_RELATION_WITHOUT_FK`, same table already audited in `accounting`). `ArtistaVisao360Modal.tsx`
uses `useTransacoes()` (the SAME hook as the accounting module, with no artist-specific endpoint) and filters
client-side. **Confirmed**: it is a real, persisted relation (not just a UI link) — the
`artista_id` is actually written to the `transactions` table when the transaction is created
(the `artistaVinculado` field of the Transaction form, already confirmed in `accounting.md`). It is not
affected by the `entityLinks`/P&L gap (`accounting.md` §2.1) — that gap concerns the
multi-entity allocation array, not the simple `artista_id` link, which works correctly.

## 8. External platforms / metrics

Two distinct systems that must not be confused:

1. **Manual static counters** (`spotify_ouvintes`, `youtube_inscritos`, `deezer_fas`,
   `apple_music_albuns_url`, `soundcloud_seguidores_url`, `instagram_seguidores`,
   `tiktok_seguidores`) — form fields, typed in manually by the user, stored in
   `metadata` (§2). `SOURCE_OF_TRUTH: manual do usuário` (manual user input), with no automatic synchronization.
2. **Real synchronization with an external API** (`useArtistPlatformProfiles`/
   `useSyncArtistPlatformProfile`, table `artist_platform_profiles` — 24 columns, 100% `DIRECT`,
   confirmed in Phase 1): `GET/POST /artists/:id/platform-profiles[/:platform/sync]`. Real, functional
   providers read in full:
   - **Spotify** (`spotify-artist-profile.provider.ts`): real OAuth client-credentials against
     `accounts.spotify.com`/`api.spotify.com`. `CREDENTIAL_REQUIRED_LATER: SIM` (yes) —
     `SPOTIFY_CLIENT_ID`/`SPOTIFY_CLIENT_SECRET`, `OWNERSHIP: PLATFORM` (not per tenant). If
     missing, `isConfigured()` returns false and synchronization fails with a clear error
     (`ServiceUnavailableException`), not silently.
   - **YouTube** (`youtube-artist-profile.provider.ts`): real YouTube Data API v3.
     `CREDENTIAL_REQUIRED_LATER: SIM` (yes) — `YOUTUBE_API_KEY`, `OWNERSHIP: PLATFORM`. Same
     explicit-failure behavior when not configured.
   `SOURCE_OF_TRUTH: API externa` (external API), via an asynchronous job (`enqueued`/`job_id` in the sync response).

The two systems do not overlap technically (different columns/tables), but they conceptually represent
the SAME information (followers/listeners per platform) captured in two different
ways with no visible reconciliation between them — recorded as an observation, not as a
technical gap (neither of the two is broken).

## 9. Storage (avatar/documents)

`ARTIST_FORM_SECTIONS` declares 3 `type: "file"` fields: `fotoUrl` (`folder: "artistas/fotos"`,
`accept: "image/*"`, `maxSize: 5MB`, `circular: true`), `documentosPessoaisUrl`
(`folder: "artistas/documentos"`, `accept: "application/pdf"`), `presskitUrl` (same, PDF).
`ArtistaFormModal.tsx` imports and uses `@/shared/components/FileUpload` (which uses `useUploadToR2`,
confirmed real — not a disguised text field). Real end-to-end flow, not broken.

## 10. Import / Export / XLSX

**Import**: `Artistas.tsx::handleExcelImport` — reads **only the first sheet** (`workbook.
SheetNames[0]`) via `XLSX.utils.sheet_to_json`, processes row by row via `parseArtistaImportRow`
(services/artista.mapper.ts, the same single source as the form). `WORKSHEET_COUNT` consumed: 1 — within the
rule. No `XLSX_RULE_VIOLATION` in this module.

**Export**: no dedicated export button in `Artistas.tsx` (grep confirmed). The real
export happens through the centralized Reports Center (`report-module-registry.ts`, `{ tableName:
'artists', label: 'Artistas' }`, already documented in doc80), consuming the same `ARTISTS_CONTRACT`
(68 fields, column/metadata/encrypted correctly resolved and decrypted on export by
`ExportEngineService`). Not recounted here — it belongs to the central reporting infrastructure, not to the
`artist` module in isolation.

## 11. Filters / Search / Sorting / Pagination

All client-side (same pattern as `accounting`/`admin`): search (name/email/genre — 1 search field
covering multiple columns), 3 filter selects (genre, status, type — judging by the
`SelectTrigger`s found), pagination via `usePagination` (10/page). No explicit per-column sorting
found (no `SortableTableHead` in the card grid). `BACKEND_FILTER: NENHUM` (none) —
`artistaService.list()` accepts no parameters.

## 12. Permissions / Tenant isolation / Delete

Backend (`artists.controller.ts`, read in full): every route with `@RequireRole`+
`@RequirePermission`+`@CurrentTenant` — read=`viewer`/`artist:read`, create=`editor`/
`artist:create`, edit=`editor`/`artist:update`, platform sync=`editor`/`artist:update`,
delete=`manager`/`artist:delete`. `DELETE` calls `softDelete()` (uses `deleted_at`, confirmed
`DIRECT` in Phase 1) — **soft delete confirmed**, not hard delete. The frontend uses
`RequirePermission module="artists" action="write"` on the "Novo Artista" (New Artist) button — consistent with the
backend enforcement. `AUTHORIZATION_GAP: 0`. `TENANT_ISOLATION_GAP: 0` (every route requires
`@CurrentTenant`, no exception found).

## 13. `CROSS_MODULE_AUDITORIA_TSX` — artist-specific section

Closes the gap left by the `admin` module (`admin.md` §7). Real config in `shared/lib/audit/
runner.ts`, object `{ module: "artistas", table: "artistas", ... }`:

```text
AUDITORIA_ARTIST_FIELDS:
  nome_artistico   (severity: obrigatorio)
  genero_musical   (severity: obrigatorio)
  email            (severity: obrigatorio)
  telefone         (severity: recomendado)
  cpf_cnpj         (severity: recomendado)
  status           (severity: recomendado)

AUDITORIA_ARTIST_RULES:
  entityType: "Artista"
  label: entityLabel(row, ["nome_artistico","nome_civil","email"], "Artista sem nome")
  fixPath: "/artistas?edit=<id>" (opens ArtistaFormModal — the real flow, not the orphaned one)

AUDITORIA_ARTIST_DATABASE_SOURCES:
  table: "artistas" → endpoint /artists (same useDataQuery/storage hook already used across the app)
  The email/telefone/cpf_cnpj fields checked here match exactly the FLAT names that the API
  returns already decrypted (toResponse() in artists.service.ts) — the completeness check
  works correctly even though these fields are encrypted in the database, because it operates on the API response,
  not on the *_encrypted columns directly. Confirmed, no gap.

AUDITORIA_ARTIST_GAPS:
  No gap of its own found in this section — the 6 rules match 1:1 real fields that are reachable
  via the real edit flow (ArtistaFormModal). Only point of attention: the rule does not check
  any of the ~41 fields stored in `metadata` (§2) nor the fields of the orphaned flow
  ArtistaCadastro.tsx — but this is expected/correct, since the completeness audit is about the real
  persisted data (via the API), not about the full surface of every possible form.
```

## Summary

```text
STATUS: COMPLETED (artist module)
MODULE_STATUS: COMPLETE
UNMAPPED_CREATE_FIELDS: 0
UNMAPPED_EDIT_FIELDS: 0
UNMAPPED_DISPLAY_COLUMNS: 0
UNMAPPED_RELATION_FIELDS: 0
UNMAPPED_IMPORT_FIELDS: 0
UNMAPPED_EXPORT_FIELDS: 0
UNMAPPED_METRIC_FIELDS: 0
UNMAPPED_PLATFORM_FIELDS: 0
UNMAPPED_STORAGE_FIELDS: 0
UNKNOWN_FIELD_CLASSIFICATIONS: 0
REAL_MAPPING_GAPS: 3 (two parallel create/edit flows with divergent field coverage,
  ArtistaCadastro.tsx orphaned/unreachable through the UI; ~41 physical columns of the artists table reserved
  but unused — the real data lives in metadata jsonb, a correction of the Phase 1 classification;
  manual static follower/listener counters coexist with no reconciliation against the real
  sync system via the external API)
AUTHORIZATION_GAPS: 0
TENANT_ISOLATION_GAPS: 0
CREDENTIALS_REQUIRED_LATER: 2 (Spotify: SPOTIFY_CLIENT_ID+SPOTIFY_CLIENT_SECRET, platform;
  YouTube: YOUTUBE_API_KEY, platform) — not requested from the user, audit not blocked by
  this.
```
