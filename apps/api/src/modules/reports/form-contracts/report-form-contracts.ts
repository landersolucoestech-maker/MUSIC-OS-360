/**
 * modules/reports/form-contracts/report-form-contracts.ts
 *
 * SINGLE SOURCE OF TRUTH for the Reports Center's export/import columns
 * for entities with a real form.
 *
 * Consumed simultaneously by:
 *   - ReportEntityDefinitionService  (exportableColumns / importableColumns)
 *   - ExportQueryBuilderService      (physical resolution: column | metadata | encrypted)
 *   - ExportEngineService            (decryption on export)
 *   - ImportCommitService            (persistence: column | metadata | encrypted)
 *   - form-contracts.guard.spec      (permanent DTO ↔ contract guard)
 *
 * Rules:
 *   - `key` is the column's stable logical key in the file (the displayed header
 *     comes from the central i18n layer, field-labels.pt-br).
 *   - `storage` defines where the field physically lives in the table.
 *   - `importable: false` marks a read-only field in the file (exported,
 *     but never overwritten by import — e.g. ECAD registration codes).
 *   - `excludedFormFields` documents EVERY form DTO field that was
 *     deliberately left out of the contract, with the reason (the guard requires it).
 *   - `formFieldAliases` maps legacy/EN DTO fields to the canonical physical
 *     key (e.g. `title` → `title`).
 */
import { ACCOUNTING_SUMMARY_TABLE_NAME } from '../report-module-registry';

export type ReportFieldStorage = 'column' | 'metadata' | 'encrypted';

export interface ReportFieldSpec {
  /** Stable logical key (file and form column). */
  key: string;
  /** Where the field physically lives. */
  storage: ReportFieldStorage;
  /** Physical column for encrypted storage or alias of a real column. */
  physical?: string;
  /** metadata fields only: previous (Portuguese) jsonb key, still read by the export until the backfill has run everywhere. */
  legacyKey?: string;
  /** false ⇒ export only (never overwritten on import). */
  importable?: boolean;
  /**
   * encrypted fields only: the PLAINTEXT column the value used to live in (dual-read window of
   * BLK-CRM-PII-PLAINTEXT). The export reads `COALESCE(<physical>, <legacyPlaintextColumn>)` and passes a value
   * without the ciphertext prefix through unchanged; writes and imports only ever touch `physical`.
   */
  legacyPlaintextColumn?: string;
}

/** Repeatable group flattened into rows of the same XLSX sheet. */
export interface ReportRepeatingGroupFieldSpec {
  key: string;
  multi?: boolean;
}

export interface ReportRepeatingGroupSpec {
  key: string;
  fields: ReportRepeatingGroupFieldSpec[];
}

export interface ReportFormContract {
  tableName: string;
  identityColumn: string;
  /** Official, deterministic order of the file's columns. */
  fields: ReportFieldSpec[];
  /** DTO field → exclusion reason (auditable; required by the guard). */
  excludedFormFields: Record<string, string>;
  /** Legacy/EN DTO field → the contract's canonical key. */
  formFieldAliases?: Record<string, string>;
  /** Optional overrides (physical contract columns only). */
  filterableColumns?: string[];
  searchableColumns?: string[];
  /** Repeatable fields flattened into rows of the same XLSX sheet. */
  repeatingGroup?: ReportRepeatingGroupSpec;
  /**
   * Deprecated logical column ids -> canonical contract key. Only for external
   * scripts that still send an id from before the English rename (`columns=`,
   * `sort=` and filter keys of the export). Canonical wins; removed after one
   * release. See `canonicalizeDeprecatedColumnId`.
   */
  deprecatedColumnAliases?: Record<string, string>;
  /** Contract keys that stay sortable although their DB column name is not a contract key. */
  extraSortableColumns?: string[];
  /** Contract keys that stay filterable although their DB column name is not a contract key. */
  extraFilterableColumns?: string[];
}

const col = (key: string, physical?: string): ReportFieldSpec => ({ key, storage: 'column', physical });
const ro = (key: string, physical?: string): ReportFieldSpec => ({ key, storage: 'column', physical, importable: false });
/**
 * Field residing in a jsonb column. `physical` says WHICH jsonb column (default
 * `'metadata'`, the generic column present in most tables) — use the
 * second parameter when the form stores the field in its own NAMED jsonb
 * column (e.g. leads.payload_servico, leads.dados_internos_crm),
 * not in the generic `metadata` column.
 */
const meta = (key: string, physical: string = 'metadata'): ReportFieldSpec => ({ key, storage: 'metadata', physical });
/**
 * `meta()` field whose jsonb key was renamed from a Portuguese spelling (expand/contract, migration
 * 20260930000019): writes use the canonical key, the export also reads `legacyKey` (canonical wins) until
 * every row is backfilled.
 */
const metaRenamed = (key: string, legacyKey: string): ReportFieldSpec => ({ key, storage: 'metadata', physical: 'metadata', legacyKey });
const enc = (key: string, physical: string): ReportFieldSpec => ({ key, storage: 'encrypted', physical });
/**
 * `enc()` field that was a plaintext column before BLK-CRM-PII-PLAINTEXT: ciphertext in `<key>_encrypted`, the
 * plaintext column of the same name stays readable (never written) until the gated backfill has run everywhere.
 */
const encFromPlaintext = (key: string): ReportFieldSpec => ({
  key, storage: 'encrypted', physical: `${key}_encrypted`, legacyPlaintextColumn: key,
});
// ─── Artists (full form — 68 fields) ────────────────────────────────────────
// CZ-042: every form field has its own physical column (col()); meta() only for
// the metadata-only fields (gender, instagram/tiktok URLs, platform metrics).
// Same file order and PT-BR headers as before the rename.
const ARTISTS_CONTRACT: ReportFormContract = {
  tableName: 'artists',
  identityColumn: 'stage_name',
  fields: [
    // Identity and profile
    col('stage_name'), col('full_name'), col('status'),
    col('music_genre'), col('notes'), col('specialties'),
    // Extended profile
    col('artist_slug'), col('profile_type'), col('career_stage'),
    meta('gender'), encFromPlaintext('birth_date'), encFromPlaintext('rg'), encFromPlaintext('address'),
    col('music_tags'),
    // Contact (encrypted)
    enc('email', 'email_encrypted'), enc('phone', 'phone_encrypted'),
    enc('cpf_cnpj', 'cpf_cnpj_encrypted'),
    // Media and links
    col('photo_url'), col('spotify_url'), col('youtube_url'), col('deezer_url'),
    col('apple_music_url'), col('soundcloud_url'), col('gallery_urls'),
    col('documents'),
    col('press_kit_url'), col('personal_documents_url'),
    meta('apple_music_albums'), meta('soundcloud_followers'),
    meta('instagram_url'), meta('tiktok_url'),
    // Platform metrics (metadata)
    meta('instagram_followers'), meta('tiktok_followers'),
    meta('spotify_listeners'), meta('youtube_subscribers'), meta('deezer_fans'),
    // Team and business — manager_* is the team "Manager"; agent_* is the
    // "Empresário" (distinct fields).
    col('manager_name'), enc('manager_contact', 'manager_contact_encrypted'),
    col('executive_producer'), col('booking_agency'), col('partner_label'),
    col('contract_id'),
    col('agent_id'), col('agent_name'),
    col('agent_email'), col('agent_phone'),
    col('record_label_id'), col('record_label_name'), col('record_label_email'),
    col('record_label_phone'), col('record_label_contact_id'),
    col('record_label_contact_name'), col('record_label_contact_email'),
    col('record_label_contact_phone'),
    // Bank details — "bank_branch" is the form's bank branch, not the booking
    // agency (col('booking_agency') above, a distinct field). Kept consecutive,
    // in the form's visual order (guard spec).
    encFromPlaintext('bank_name'), encFromPlaintext('bank_branch'), encFromPlaintext('bank_account'),
    encFromPlaintext('pix_key'), encFromPlaintext('account_holder'),
    // Distribution (jsonb; arrays/objects serialized as reversible JSON)
    col('selected_distributors'), col('general_distributors'),
    col('distributor_emails'), col('company_selected_distributors'),
    col('company_distributor_emails'),
    // Network (jsonb; arrays/objects serialized as reversible JSON)
    col('team_contacts'), col('linked_contacts'), col('relationships'),
  ],
  excludedFormFields: {
    metadata: 'raw internal jsonb object — its individual fields are already contract columns',
    internal_notes: 'internal note hidden by policy (HIDDEN_INTERNAL_HINT)',
  },
  filterableColumns: ['status', 'music_genre'],
  searchableColumns: ['stage_name', 'full_name', 'music_genre', 'notes'],
};

// ─── Employees (HR) ─────────────────────────────────────────────────────────
const EMPLOYEES_CONTRACT: ReportFormContract = {
  tableName: 'employees',
  identityColumn: 'name',
  fields: [
    col('name'), col('job_title'), col('department'), col('status'),
    col('contract_type'), col('salary'), col('hired_at'),
    col('terminated_at'), col('notes'), col('linked_user_id'), col('documents'),
    enc('email', 'email_encrypted'), enc('phone', 'phone_encrypted'),
    enc('cpf', 'cpf_encrypted'),
  ],
  excludedFormFields: {
    metadata: 'raw internal jsonb object — no form fields of its own',
  },
};

// ─── Contracts ────────────────────────────────────────────────────────────────
const CONTRACTS_CONTRACT: ReportFormContract = {
  tableName: 'contracts',
  identityColumn: 'title',
  fields: [
    col('title'), col('type'), col('status'), col('fixed_value'),
    col('start_date'), col('end_date'), col('exclusive'), col('notes'),
    col('file_url'), col('signing_platform'),
    col('artist_id'), col('client_id'), col('release_id'),
    col('template_id'), // wizard field (2026-07-12 rule: its own column)
    ro('autentique_doc_id'), // technical state of the signature integration
    ro('versions'),          // version history (generated by the signature flow)
    ro('documents'),        // real R2 attachments (REM-02), same pattern as versions
  ],
  excludedFormFields: {
    metadata: 'raw internal jsonb object',
    currency: 'legacy alias without its own column (amount is BRL by contract)',
    signedAt: 'state managed exclusively by the signature integration',
    parties: 'signature integration structure, not a tabular column',
    signers: 'signature integration structure, not a tabular column',
  },
  // Deprecated DTO aliases are resolved by contract-legacy-alias.util.ts /
  // ContractsService and need no contract entry (the guard skips them).
};

// ─── Works ────────────────────────────────────────────────────────────────────
const WORKS_CONTRACT: ReportFormContract = {
  tableName: 'works',
  identityColumn: 'title',
  fields: [
    col('title'), col('type'), col('status'), col('music_genre'),
    col('composer_name'), col('composer_names'), col('publisher_name'),
    col('isrc'), col('iswc'),
    // Work form fields (CZ-039: English; the registry columns language/
    // is_instrumental/ai_used/alternative_titles/lyrics are the single source)
    col('language'), col('society_code'), col('ecad_code'), col('duration_text'),
    col('is_instrumental'), col('ai_used'), col('ai_usage_level'),
    col('ai_harmony'), col('ai_melody'), col('ai_lyrics'),
    col('alternative_titles'), col('related_references'), col('lyrics'),
    col('translator_names'), col('project_id'),
    col('artist_id'), col('work_origin'),
    // Read-only: derived registry fields and enrichment (not part of the create form)
    ro('duration_seconds'), ro('ai_tools'), ro('ai_prompts'),
    ro('registry_status'),
    ro('external_reference'), ro('external_source'), ro('external_source_synced_at'),
  ],
  excludedFormFields: {
    metadata: 'raw internal jsonb object',
    authors: 'relationship (authors/percentages) managed on the dedicated shares screen',
    shares: 'relationship in its own table (shares), reportable separately',
    participants: 'relationship normalized into work_participants (migration 20260718000011), reportable separately',
    abramus_protocol: 'orphan column removed (20260718000016) — never written by any real flow',
  },
};

// ─── Phonograms ───────────────────────────────────────────────────────────────
const PHONOGRAMS_CONTRACT: ReportFormContract = {
  tableName: 'phonograms',
  identityColumn: 'title',
  fields: [
    col('title'), col('status'), col('music_genre'), col('isrc'),
    col('duration_text'), col('artist_id'), col('work_id'),
    // Phonogram form fields (CZ-040: English; the registry columns
    // recording_date/release_date/duration_seconds/country_of_recording are
    // the single source of truth)
    col('society_code'), col('ecad_code'), col('aggregator'),
    col('isrc_country_code'), col('isrc_registrant_code'), col('isrc_year'), col('isrc_designation_code'),
    col('ai_used'), col('is_instrumental'), col('is_national'), col('is_simultaneous_publication'),
    col('issue_date'), col('recording_date'), col('release_date'),
    col('duration_seconds'), col('media_type'), col('recording_classification'),
    col('country_of_recording'), col('publication_country'), col('record_label_name'),
    col('notes'), col('participation'), col('audio_file'),
    // Read-only: registration/societies and recording metadata
    ro('type'), ro('version_title'), ro('copyright_year'),
    ro('copyright_owner'),
    ro('registry_status'),
    ro('external_reference'), ro('external_source'), ro('external_source_synced_at'),
    ro('audio_file_id'),
  ],
  excludedFormFields: {
    metadata: 'raw internal jsonb object',
    fileUrl: 'hypothetical field that does not exist in the DTO — the real upload flow fills audio_file_id (see the read-only entry above) and audio_file',
    abramus_protocol: 'orphan column removed (20260718000016) — never written by any real flow',
  },
  formFieldAliases: {
    duration: 'duration_text',
    artistId: 'artist_id',
    workId: 'work_id',
  },
};

// ─── Clients ─────────────────────────────────────────────────────────────────
// Part 78: without a central contract, the exporter (generic heuristic) omitted
// email/phone/cpf_cnpj entirely (*_encrypted columns never appear in
// exportableColumns). A "Clientes" export without contact data is useless in
// practice — registers the contract so the engine decrypts these fields
// as it does for artists/employees.
const CLIENTS_CONTRACT: ReportFormContract = {
  tableName: 'clients',
  identityColumn: 'name',
  // CZ-043: canonical columns = DTO keys (the form fields the web kept only in
  // metadata now have their own column).
  fields: [
    col('person_type'), col('category'), col('profile'), col('name'),
    col('photo_url'), col('individual_name'), col('legal_name'), col('trade_name'),
    enc('email', 'email_encrypted'), enc('phone', 'phone_encrypted'),
    enc('cpf_cnpj', 'cpf_cnpj_encrypted'),
    col('instagram'), col('job_title'),
    col('street'), col('street_number'), col('address_complement'), col('neighborhood'),
    col('city'), col('state'), col('zip_code'), col('address'),
    col('priority'),
    col('responsible_name'), col('responsible_email'),
    col('responsible_phone'), col('responsible_job_title'),
    col('notes'), col('status'),
  ],
  excludedFormFields: {
    metadata: 'raw internal jsonb object — historical pre-CZ-043 copies only',
    interactions: 'CRM interaction list (jsonb array of objects) — not a spreadsheet cell',
  },
  formFieldAliases: {
    // Deprecated pre-CZ-043 DTO keys (client-legacy-fields.ts).
    type: 'person_type',
    document: 'cpf_cnpj',
    avatarUrl: 'photo_url',
    zipCode: 'zip_code',
    responsible: 'responsible_name',
  },
};

// ─── Projects ────────────────────────────────────────────────────────────────
// Canonical source: the project form modal. A single sheet; one row per track.
// Logical ids are English but NOT the bare physical names (`type`, `title`,
// `status`): the pt-BR header comes from the single global label dictionary, where
// `type`/`title`/`status` carry other labels ("Tipo", "Título", "Situação"), and
// the exported XLSX headers of this sheet must stay identical.
const PROJECTS_CONTRACT: ReportFormContract = {
  tableName: 'projects',
  identityColumn: 'projectTitle',
  fields: [
    col('projectType', 'type'),
    col('projectTitle', 'title'),
    col('notes'),
    col('projectStatus', 'status'),
  ],
  deprecatedColumnAliases: {
    tipo_lancamento: 'projectType',
    nome_ep_album: 'projectTitle',
    status_projeto: 'projectStatus',
  },
  excludedFormFields: {
    metadata: 'raw internal jsonb object',
    artist_id: 'no matching field in the Create/Edit modal',
    budget: 'no matching field in the Create/Edit modal',
    description: 'no matching field in the Create/Edit modal',
    music_genre: 'derived from the tracks, not a general form field',
    tracks: 'represented by the individual columns of the repeating group on the same sheet',
  },
  repeatingGroup: {
      key: 'tracks',
      fields: [
        { key: 'trackName' },
        { key: 'soloFeat' },
        { key: 'originalRemix' },
        { key: 'instrumental' },
        { key: 'trackDurationMinutes' },
        { key: 'trackDurationSeconds' },
        { key: 'musicGenre' },
        { key: 'trackLanguage' },
        { key: 'composers', multi: true },
        { key: 'performers', multi: true },
        { key: 'producers', multi: true },
        { key: 'lyrics' },
        { key: 'audioFiles' },
        { key: 'sort_order' },
      ],
  },
};

// ─── Monitoring (content_detections) ─────────────────────────────────────────
// Part 89, Block 11: there is no real Create/Edit form (the screen is a
// read-only list of detections generated automatically by the platform —
// the addDeteccao/updateDeteccao/deleteDeteccao hooks exist but are never
// called by any UI). Export-only contract, reflecting the real physical
// columns (not the "periodo"/"quantidade" fields the screen references
// but that do not exist on the entity — a pre-existing UI bug, not reproduced here).
const CONTENT_DETECTIONS_CONTRACT: ReportFormContract = {
  tableName: 'content_detections',
  identityColumn: 'detected_title',
  fields: [
    ro('detected_title'), ro('platform'), ro('type'), ro('status'),
    ro('url'), ro('score'), ro('detected_at'), ro('work_id'), ro('artist_id'),
  ],
  excludedFormFields: {},
};

// ─── Licensing ───────────────────────────────────────────────────────────────
// `amount`/`percentage`/`currency` are sent by the form but do NOT
// exist in CreateLicenseDto (or on the entity) — they are never persisted. `valor`/
// `moeda` are the corresponding real columns. `remuneration_type`, although it
// physically exists on the entity, is not in the DTO either — excluded.
const LICENSES_CONTRACT: ReportFormContract = {
  tableName: 'licenses',
  identityColumn: 'title',
  fields: [
    col('title'), col('type'), col('work_id'), col('workTitle', 'work_title'), col('artist', 'artist_name'),
    col('client_id'), col('clientName', 'client_name'), col('projectName', 'project_name'), col('usageType', 'usage_type'),
    col('targetMedia', 'target_media'), col('territory'), col('status'),
    col('start_date'), col('end_date'), col('amount'), col('currency'), col('notes'),
  ],
  excludedFormFields: {},
  filterableColumns: ['status', 'type', 'territory'],
  searchableColumns: ['title', 'work_title', 'artist_name', 'client_name', 'project_name'],
};

// ─── Takedowns ────────────────────────────────────────────────────────────────
// Canonical source: TakedownFormModal.tsx / CreateTakedownDto (English since
// CZ-034). Report keys keep the pre-rename PT-BR headers.
const TAKEDOWNS_CONTRACT: ReportFormContract = {
  tableName: 'takedowns',
  identityColumn: 'title',
  fields: [
    col('title'), col('type'), col('affectedWork', 'affected_work'), col('artist', 'artist_name'), col('status'),
    col('priority'), col('platform'), col('infringingUrl', 'infringing_url'), col('reason'),
    col('identifiedAt', 'identified_at'), col('description'), col('evidence'), col('notes'),
  ],
  excludedFormFields: {},
  filterableColumns: ['status', 'type', 'priority', 'platform'],
  searchableColumns: ['title', 'affected_work', 'artist_name', 'reason'],
};

// ─── Distribution (releases) ─────────────────────────────────────────────────
// Canonical source: ReleaseFormModal.tsx (5-step wizard). Most of the
// advanced fields (Step 0/3) live in the generic `metadata` column
// (extraFields.* → metadata.*); the tracks (Step 1) live in
// metadata.tracks (legacy key `faixas`) — its own repeatable group (see release-tracks.field.ts).
// `platforms`/`assets`/`schedule` have no identifiable UI input
// (platforms: no multi-platform selector in the current wizard; assets: no
// dedicated upload besides the cover; schedule: no inputs in the modal) — excluded/
// read-only.
const RELEASES_CONTRACT: ReportFormContract = {
  tableName: 'releases',
  identityColumn: 'title',
  fields: [
    col('title'), col('type'), col('artist_id'), col('upc'), col('distributor'),
    col('release_date'), col('cover_url'), col('isrc_global'), col('internal_notes'),
    col('notes'), col('record_label'), col('copyright'), col('music_genre'), col('language'),
    ro('status'), ro('schedule'),
    metaRenamed('variousArtists', 'variosArtistas'), metaRenamed('secondaryGenre', 'generoSecundario'),
    metaRenamed('copyrightReleaseYear', 'copyrightDataLancamento'), metaRenamed('copyrightRecordingYear', 'copyrightDataGravacao'),
    meta('ownUpc'), meta('territory'), meta('releaseTime'), meta('releaseTimezone'),
    meta('preOrder'), meta('noPreviewsDuringPreOrder'), meta('pricing'),
    metaRenamed('additionalAlbumArtists', 'artistasAdicionaisAlbum'),
  ],
  excludedFormFields: {
    platforms: 'accepted by the DTO but no multi-platform selector exists in the current wizard',
    metadata: 'raw internal jsonb object — its individual fields are already contract columns',
    assets: 'no dedicated upload inputs besides the cover (coverUrl → cover_url, already has its own column)',
    tracks: 'represented by its own repeating group ("Faixas do Lançamento", repeatingGroup) — never packed into a single cell',
  },
  formFieldAliases: {
    title: 'title',
    type: 'type',
    artistId: 'artist_id',
    distributor: 'distributor',
    releasedAt: 'release_date',
    coverUrl: 'cover_url',
  },
  // Portuguese logical ids (saved column selections / external scripts) -> canonical ids.
  deprecatedColumnAliases: {
    variosArtistas: 'variousArtists',
    generoSecundario: 'secondaryGenre',
    copyrightDataLancamento: 'copyrightReleaseYear',
    copyrightDataGravacao: 'copyrightRecordingYear',
    artistasAdicionaisAlbum: 'additionalAlbumArtists',
    nome: 'trackTitle',
    isVersionAlternativa: 'isAlternateVersion',
    tipoVersao: 'versionType',
    compositores: 'composers',
    faixa_idioma: 'releaseTrackLanguage',
    letra: 'lyrics',
    artista: 'trackArtist',
  },
  repeatingGroup: {
      key: 'tracks',
      fields: [
        { key: 'trackTitle' }, { key: 'isAlternateVersion' }, { key: 'versionType' },
        { key: 'versionCustomName' }, { key: 'composers', multi: true },
        { key: 'aiAssistanceLevel' }, { key: 'instrumental' }, { key: 'releaseTrackLanguage' },
        { key: 'lyrics' }, { key: 'explicit' }, { key: 'isrc' }, { key: 'trackArtist' },
      ],
  },
};

// ─── Shares ───────────────────────────────────────────────────────────────────
// `history[]` is an audit trail generated automatically by the system
// on every edit (never typed by the user) — exported read-only as a
// direct column (same pattern already used by contracts.versions), without becoming
// its own child sheet.
const SHARES_CONTRACT: ReportFormContract = {
  tableName: 'shares',
  identityColumn: 'music_title',
  fields: [
    col('share_type'), col('percentage'), col('status'), col('direction'),
    col('release_id'), col('music_title'), col('holder'), col('recipient'),
    col('type'), col('external_artist_name'), col('artist_id'),
    col('payer'), col('payer_contact'), col('agreement_source'), col('expected_at'),
    col('documents'), col('agreement_notes'), col('agreement_url'), col('notes'),
    col('total_amount'), col('settled_amount'),
    ro('version'), ro('history'),
  ],
  excludedFormFields: {
    holderName: 'legacy English alias (ABRAMUS/ECAD registration) mapped to holder_name — not the real Shares screen',
    role: 'legacy English alias mapped to party_role — same as above',
    workId: 'legacy English alias mapped to work_id — same as above',
    trackId: 'legacy English alias mapped to phonogram_id — same as above',
    holderDoc: 'legacy English alias mapped to holder_document — same as above',
    metadata: 'raw internal jsonb object',
  },
};

// ─── Audiovisual Projects ─────────────────────────────────────────────────────
const AUDIOVISUAL_PROJECTS_CONTRACT: ReportFormContract = {
  tableName: 'audiovisual_projects',
  identityColumn: 'music_title',
  fields: [
    col('music_title'), ro('artist_name'), col('type'), col('format'),
    col('director'), col('videographer'), col('editor'),
    col('shooting_date'), col('location'),
    col('capture_status'), col('editing_status'), col('approval_status'),
    col('pre_release_date'), col('release_date'),
    col('budget_estimated'), col('budget_actual'),
    col('concept'), col('observations'),
    ro('status'), ro('final_status'), ro('completed_at'),
  ],
  excludedFormFields: {
    title: 'automatic duplicate of music_title — same form column, no input of its own',
    slug: 'accepted by the DTO but has no input in the Create/Edit modal',
    description: 'accepted by the DTO but has no input in the Create/Edit modal',
    objective: 'accepted by the DTO but has no input in the Create/Edit modal',
    priority: 'accepted by the DTO but has no input in the Create/Edit modal',
    stage: 'accepted by the DTO but has no input in the Create/Edit modal',
    production_company: 'accepted by the DTO but has no input in the Create/Edit modal',
    producer: 'accepted by the DTO but has no input in the Create/Edit modal',
    start_date: 'accepted by the DTO but has no input in the Create/Edit modal',
    recording_date: 'accepted by the DTO but has no input in the Create/Edit modal',
    delivery_date: 'accepted by the DTO but has no input in the Create/Edit modal',
    publish_date: 'accepted by the DTO but has no input in the Create/Edit modal',
    artist_id: 'technical relation without its own selector in the modal',
    release_id: 'technical relation without its own selector in the modal',
    phonogram_id: 'automatic link from the track search — music_title already represents the same link in readable form',
    campaign_id: 'technical relation without its own selector in the modal',
    event_id: 'technical relation without its own selector in the modal',
    metadata: 'raw internal jsonb object',
  },
};

// ─── Financial transactions ─────────────────────────────────────────────────
// CZ-041: every form field is a canonical physical column (the API reads and
// writes the columns; metadata is historical only). The pre-CZ-041 duplicates
// tipo_transacao/data_transacao/anexo_url are legacy_* columns with no writer.
// `transaction_type` is the file's logical key for the `type` column (keeps the
// "Tipo de transação" header of exported spreadsheets).
// Real validation is Zod (transaction.validator.ts), not a class-validator
// DTO — not checked against FORM_DTO_BY_TABLE.
const TRANSACTIONS_CONTRACT: ReportFormContract = {
  tableName: 'transactions',
  identityColumn: 'description',
  fields: [
    col('transaction_type', 'type'), col('counterparty_type'), col('category'), col('subcategory'),
    col('description'), col('amount'), col('transaction_date'), col('status'),
    col('artist_id'), col('project_id'), col('contract_id'), col('event_id'),
    col('counterparty_name'), col('tax_authority'), col('cost_center'), col('reference_month'),
    col('source_bank_account'), col('destination_bank_account'), col('investment_item'), col('travel_reason'),
    col('advertising_name'), col('payment_method'), col('payment_type'),
    col('installment_count'), col('installment_interval'), col('first_installment_date'),
    col('attachment_url'), col('attachment_name'), col('notes'),
  ],
  excludedFormFields: {},
  filterableColumns: ['status', 'transaction_type', 'category'],
  searchableColumns: ['description', 'category', 'counterparty_name'],
};

// ─── Invoice (invoices) ──────────────────────────────────────────────────────
// CreateInvoiceDto declares an English/Stripe schema (type/amount/number/...)
// completely different from the real columns the NotaFiscalFormModal form
// writes — a pre-existing DTO↔form mismatch bug (same pattern as Takedowns),
// out of scope for this Part. The contract uses the real physical columns; it is not
// checked against the broken DTO.
const INVOICES_CONTRACT: ReportFormContract = {
  tableName: 'invoices',
  identityColumn: 'invoice_number',
  fields: [
    col('invoice_number'), col('serie'), col('tipo_nota'), col('issued_at'), col('status'),
    col('natureza_operacao'), col('cfop'), col('codigo_servico_municipal'), col('codigo_municipio'),
    col('client_id'), col('tomador_cnpj'), col('tomador_legal_name'),
    col('tomador_inscricao_estadual'), col('tomador_inscricao_municipal'), col('tomador_email'),
    col('tomador_address'), col('tomador_city'), col('tomador_uf'), col('tomador_cep'),
    col('service_description'), col('service_amount'), col('deductions_amount'), col('base_calculo'),
    col('aliquota_iss'), col('iss_amount'), col('iss_retido'), col('pis_amount'), col('cofins_amount'),
    col('ir_amount'), col('csll_amount'), col('inss_amount'), col('net_amount'),
    col('payment_method'), col('payment_terms'), col('invoiceDueAt', 'due_at'), col('invoiceFileUrl', 'file_url'),
    col('notes'),
  ],
  excludedFormFields: {},
  // `due_at` (NFS-e due date) is exported under its own key so its PT-BR
  // header stays "Data de vencimento" (the generic dueAt label is "Prazo").
  formFieldAliases: {
    due_at: 'invoiceDueAt',
    file_url: 'invoiceFileUrl',
  },
  // `url_pdf` (pre-file_url export/import id, one deploy window) -> canonical contract key.
  // `invoiceFileUrl` (not `file_url`) keeps the header "PDF da nota"; the generic fileUrl label is "Arquivo".
  deprecatedColumnAliases: {
    url_pdf: 'invoiceFileUrl',
  },
  repeatingGroup: {
      key: 'items',
      fields: [
        { key: 'description' }, { key: 'service_code' }, { key: 'quantity' },
        { key: 'unit_price' }, { key: 'total_amount' },
      ],
  },
};

// ─── Agenda (events) ────────────────────────────────────────────────────────────
const EVENTS_CONTRACT: ReportFormContract = {
  tableName: 'events',
  identityColumn: 'title',
  fields: [
    col('title'), col('type'), col('eventDate', 'starts_at'), col('end_date'), col('venue'),
    col('venue_contact'), col('address'), col('fee_amount'), col('expected_attendance'),
    col('description'), col('notes'), col('status'),
  ],
  excludedFormFields: {
    city: 'accepted by the DTO but has neither a physical column nor an input in the modal',
    country: 'accepted by the DTO but has neither a physical column nor an input in the modal',
    capacity: 'accepted by the DTO but discarded by the server — no physical column (see expected_attendance)',
    ticketUrl: 'accepted by the DTO but has neither a physical column nor an input in the modal',
    metadata: 'raw internal jsonb object',
    artistId: 'technical link filled indirectly by the first participant of type artista — no input of its own',
    participants: 'represented by its own repeating group ("Participantes do Evento", repeatingGroup) — never packed into a single cell',
  },
  formFieldAliases: {
    title: 'title',
    type: 'type',
    startsAt: 'eventDate',
    endsAt: 'end_date',
  },
  // `data` is the legacy start column (kept equal to `starts_at` by the DB trigger);
  // the contract reads/writes the canonical `starts_at`. `eventDate` (not `starts_at`)
  // because the header must stay "Data" and `startsAt` is labelled "Início".
  deprecatedColumnAliases: {
    data: 'eventDate',
    starts_at: 'eventDate',
  },
  extraSortableColumns: ['eventDate'],
  extraFilterableColumns: ['eventDate'],
  repeatingGroup: {
      key: 'participants',
      fields: [
        { key: 'source' }, { key: 'label' }, { key: 'email' }, { key: 'phone' }, { key: 'category' },
      ],
  },
};

// ─── Inventory ───────────────────────────────────────────────────────────────
const INVENTORY_ITEMS_CONTRACT: ReportFormContract = {
  tableName: 'inventory_items',
  identityColumn: 'name',
  fields: [
    col('name'), col('category'), col('quantity'), col('unit_price'),
    col('storageLocation', 'storage_location'), col('status'),
    col('responsiblePerson', 'responsible_person'), col('sector'),
    col('entryDate', 'entry_date'), col('purchaseLocation', 'purchase_location'),
    col('numero_nota_fiscal'), col('notes'),
  ],
  excludedFormFields: {},
};

// ─── CRM — Leads ──────────────────────────────────────────────────────────────
// Most of the form's "advanced" fields (LeadFormModal.tsx) live in
// two NAMED jsonb columns — service_payload and crm_internal_data — not in the
// generic `metadata` column (hence `meta(key, physical)` with the explicit second
// argument; keys are the canonical jsonb keys of modules/leads/lead-vocabulary.ts).
// The conditional event/campaign/influencer/manager fields and the
// interaction history (service_payload.interactions[]) stay OUT of this
// Part — the history is an array, not supported by the current 1-level
// mechanism (jsonb column → key), documented as a divergence in the final report.
const LEADS_CONTRACT: ReportFormContract = {
  tableName: 'leads',
  identityColumn: 'name',
  fields: [
    col('name'), col('company'), enc('email', 'email_encrypted'), col('whatsapp'),
    col('instagram'), col('city'), col('state'), col('client_type'), col('service_type'),
    // country: DTO-exposed (renamed from pais by naming-closure Cluster D,
    // 20260921000004_RenameLeadsGeoFieldsToEnglish) but LeadFormModal.tsx has
    // no input for it — every real row is system-normalized to 'BR'.
    // Report-only, not a form field.
    ro('country'),
    meta('jobTitle', 'service_payload'), meta('website', 'service_payload'),
    meta('address', 'service_payload'), meta('leadType', 'service_payload'),
    meta('service', 'service_payload'), meta('serviceArtistName', 'service_payload'),
    meta('description', 'service_payload'), meta('entryDate', 'service_payload'),
    // Lead origin/owner/priority/temperature/next follow-up/estimated value:
    // naming-closure Cluster E dropped their dead physical columns
    // (20260921000005_DropDeadLeadsCrmDualStorageColumns); crm_internal_data
    // was already the only place any of these had live data.
    meta('leadSource', 'crm_internal_data'), meta('marketingCampaign', 'crm_internal_data'),
    meta('responsiblePerson', 'crm_internal_data'), meta('priority', 'crm_internal_data'),
    meta('nextFollowUpAt', 'crm_internal_data'), meta('estimatedValue', 'crm_internal_data'),
    meta('temperature', 'crm_internal_data'),
    // The lead status is the `status` column (workflow-managed; export only).
    // crm_internal_data.statusLead was a stale copy nothing reads (CZ-033).
    ro('status'),
    ro('uploads'),
    // tags is the lead's own column (text[]), with no input in the form
    // (managed outside the DTO) — export only.
    ro('tags'),
  ],
  excludedFormFields: {
    phone: 'legacy DTO field with no input in the real form (phone/WhatsApp uses the whatsapp field)',
    source: 'legacy DTO field (generic pipeline) with no input in the real form',
    stage: 'legacy DTO field (generic pipeline) with no input in the real form',
    value: 'legacy DTO field (generic pipeline) with no input in the real form',
    assignedTo: 'legacy DTO field (generic pipeline) with no input in the real form',
    notes: 'legacy DTO field (generic pipeline) with no input in the real form',
    metadata: 'legacy jsonb object (generic pipeline) with no input in the real form',
    stageName: 'accepted by the DTO but has no input in the real Leads form',
    servicePayload: 'raw jsonb object — its individual fields are already contract columns',
    crmInternalData: 'raw jsonb object — its individual fields are already contract columns',
  },
  formFieldAliases: {
    clientType: 'client_type',
    serviceType: 'service_type',
  },
};

// ─── Tasks (marketing_tasks) ─────────────────────────────────────────────────
// The only real Create/Edit/View task screen is Marketing >
// Tarefas — see the note in report-module-registry.ts on why "Tarefas"
// points to marketing_tasks and not operational_tasks (which has no screen).
const MARKETING_TASKS_CONTRACT: ReportFormContract = {
  tableName: 'marketing_tasks',
  identityColumn: 'title',
  fields: [
    col('title'), col('marketing_project_id'), meta('targetType'), meta('targetName'),
    meta('sector'), col('kind'), col('assigned_to'), col('priority'), col('due_date'),
    col('status'), col('description'),
  ],
  excludedFormFields: {
    dependencies: 'accepted by the DTO but has no input in the form (Tarefas.tsx)',
    metrics: 'accepted by the DTO but has no input in the form',
    metadata: 'raw jsonb object — its individual fields (targetType/targetName/sector) are already contract columns',
  },
  formFieldAliases: {
    marketingProjectId: 'marketing_project_id',
    assignedTo: 'assigned_to',
    dueDate: 'due_date',
  },
};

// ─── Content calendar (marketing_content_posts) ──────────────────────────────
const MARKETING_CONTENT_POSTS_CONTRACT: ReportFormContract = {
  tableName: 'marketing_content_posts',
  identityColumn: 'title',
  fields: [
    col('title'), col('target_type'), col('target_name'), col('channel'),
    col('content_type'), col('status'), col('publish_date'), col('publish_time'),
    col('copy'), col('notes'), col('campaign_id'), ro('files'),
  ],
  excludedFormFields: {
    owner: 'fixed value "Marketing" set by the form — not a user input',
    format: 'derived automatically from platform+type — not a user input',
    releaseId: 'accepted by the DTO but has no UI control on this screen',
    metadata: 'internal jsonb object — hashtags/location are merged into notes by the form itself, no columns of their own',
  },
  formFieldAliases: {
    targetType: 'target_type',
    targetName: 'target_name',
    type: 'content_type',
    publishDate: 'publish_date',
    publishTime: 'publish_time',
    campaignId: 'campaign_id',
  },
};

// ─── Briefing (generic, marketing) ───────────────────────────────────────────
// Part 89 fix (briefings.service.ts): the DTO used English names
// (title/content/campaignId/dueAt) that never reached the real physical columns
// (title/descricao/campaign_id/due_at, then named prazo) — a mapping bug fixed so that
// this contract is usable. Cluster E (naming-normalization): the physical
// column descricao was renamed to content, eliminating the alias. The
// "advanced" fields (objective, context, target audience etc., present only in
// Edit) live in the generic `metadata` column.
const BRIEFINGS_CONTRACT: ReportFormContract = {
  tableName: 'briefings',
  identityColumn: 'title',
  fields: [
    col('title'), col('content'), col('campaign_id'), col('due_at'), col('status'),
    meta('type'), meta('owners'), meta('objective'), meta('context'), meta('audience'),
    meta('positioning'), meta('tone'), meta('requirements'), meta('creativeDirection'),
    meta('references'), meta('visualGuidelines'), meta('textGuidelines'), meta('market'),
    meta('competitors'), meta('trends'), meta('channels'), meta('restrictions'),
    meta('resources'), meta('expectations'), meta('deliverables'), meta('timeline'),
    meta('executionPlan'), meta('aiRecommendations'),
  ],
  excludedFormFields: {
    objectives: 'accepted by the DTO but has no input on any form screen',
    metadata: 'raw internal jsonb object — its individual fields (objective, context, audience, etc.) are already contract columns',
  },
  formFieldAliases: {
    title: 'title',
    content: 'content',
    campaignId: 'campaign_id',
    dueAt: 'due_at',
  },
};

// ─── Accounting (computed report, no physical table — Block 19) ──────────────
// P&L per artist, aggregated over `transactions` — same logic as the
// "P&L por Artista" tab of Contabilidade.tsx. Export-only (no importable
// field): it is not an editable form, it is a calculated report.
const ACCOUNTING_SUMMARY_CONTRACT: ReportFormContract = {
  tableName: ACCOUNTING_SUMMARY_TABLE_NAME,
  identityColumn: 'artist',
  fields: [
    ro('artist'), ro('revenue'), ro('expenses'), ro('result'), ro('margin'),
  ],
  excludedFormFields: {},
};

export const REPORT_FORM_CONTRACTS: Record<string, ReportFormContract> = {
  artists: ARTISTS_CONTRACT,
  employees: EMPLOYEES_CONTRACT,
  contracts: CONTRACTS_CONTRACT,
  works: WORKS_CONTRACT,
  phonograms: PHONOGRAMS_CONTRACT,
  clients: CLIENTS_CONTRACT,
  projects: PROJECTS_CONTRACT,
  content_detections: CONTENT_DETECTIONS_CONTRACT,
  licenses: LICENSES_CONTRACT,
  takedowns: TAKEDOWNS_CONTRACT,
  releases: RELEASES_CONTRACT,
  shares: SHARES_CONTRACT,
  audiovisual_projects: AUDIOVISUAL_PROJECTS_CONTRACT,
  transactions: TRANSACTIONS_CONTRACT,
  invoices: INVOICES_CONTRACT,
  events: EVENTS_CONTRACT,
  inventory_items: INVENTORY_ITEMS_CONTRACT,
  leads: LEADS_CONTRACT,
  marketing_tasks: MARKETING_TASKS_CONTRACT,
  marketing_content_posts: MARKETING_CONTENT_POSTS_CONTRACT,
  briefings: BRIEFINGS_CONTRACT,
  [ACCOUNTING_SUMMARY_TABLE_NAME]: ACCOUNTING_SUMMARY_CONTRACT,
};

export function getReportFormContract(tableName: string): ReportFormContract | null {
  return Object.prototype.hasOwnProperty.call(REPORT_FORM_CONTRACTS, tableName) ? REPORT_FORM_CONTRACTS[tableName] : null;
}

export function contractFieldByKey(
  contract: ReportFormContract,
): Map<string, ReportFieldSpec> {
  return new Map(contract.fields.map((f) => [f.key, f]));
}

export function contractExportableColumns(contract: ReportFormContract): string[] {
  return [
    ...contract.fields.map((field) => field.key),
    ...(contract.repeatingGroup?.fields.map((field) => field.key) ?? []),
  ];
}

export function contractImportableColumns(contract: ReportFormContract): string[] {
  return [
    ...contract.fields.filter((field) => field.importable !== false).map((field) => field.key),
    ...(contract.repeatingGroup?.fields.map((field) => field.key) ?? []),
  ];
}

export function contractDirectColumns(contract: ReportFormContract): Set<string> {
  return new Set(contract.fields.filter((f) => f.storage === 'column').map((f) => f.key));
}

export function contractEncryptedFields(contract: ReportFormContract): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of contract.fields) {
    if (f.storage === 'encrypted' && f.physical) out[f.key] = f.physical;
  }
  return out;
}

/** encrypted key → plaintext column it is dual-read from (BLK-CRM-PII-PLAINTEXT window). */
export function contractLegacyPlaintextColumns(contract: ReportFormContract): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of contract.fields) {
    if (f.storage === 'encrypted' && f.legacyPlaintextColumn) out[f.key] = f.legacyPlaintextColumn;
  }
  return out;
}

/** key → previous (Portuguese) jsonb key of the same field, for the dual-read window. */
export function contractMetadataLegacyKeys(contract: ReportFormContract): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of contract.fields) {
    if (f.storage === 'metadata' && f.legacyKey) out[f.key] = f.legacyKey;
  }
  return out;
}

/** key → physical jsonb column where it lives (default 'metadata' when `physical` was not given). */
export function contractMetadataFields(contract: ReportFormContract): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of contract.fields) {
    if (f.storage === 'metadata') out[f.key] = f.physical ?? 'metadata';
  }
  return out;
}


/**
 * Maps a deprecated logical column id of `tableName` to its canonical contract key.
 * Unknown ids and ids of contracts without aliases are returned unchanged (they are
 * validated downstream exactly as before).
 */
export function canonicalizeDeprecatedColumnId(tableName: string, id: string): string {
  const aliases = Object.prototype.hasOwnProperty.call(REPORT_FORM_CONTRACTS, tableName)
    ? REPORT_FORM_CONTRACTS[tableName]?.deprecatedColumnAliases
    : undefined;
  if (!aliases || !Object.prototype.hasOwnProperty.call(aliases, id)) return id;
  return aliases[id]!;
}
