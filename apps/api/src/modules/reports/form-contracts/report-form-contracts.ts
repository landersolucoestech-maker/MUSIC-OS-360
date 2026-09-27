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
  /** false ⇒ export only (never overwritten on import). */
  importable?: boolean;
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
const enc = (key: string, physical: string): ReportFieldSpec => ({ key, storage: 'encrypted', physical });
// ─── Artists (full form — 68 fields) ────────────────────────────────────────
const ARTISTS_CONTRACT: ReportFormContract = {
  tableName: 'artists',
  identityColumn: 'nome_artistico',
  fields: [
    // Identity and profile (direct columns)
    col('nome_artistico'), col('nome_civil'), col('status'),
    col('music_genre'), col('notes'), col('especialidades'),
    // Extended profile (metadata jsonb)
    meta('slug_artistico'), meta('tipo_perfil'), meta('fase_carreira'),
    meta('genero'), meta('data_nascimento'), meta('rg'), meta('endereco'),
    meta('tags_musicais'),
    // Contact (encrypted)
    enc('email', 'email_encrypted'), enc('telefone', 'telefone_encrypted'),
    enc('cpf_cnpj', 'cpf_cnpj_encrypted'),
    // Media and links (direct columns)
    col('foto_url'), col('spotify_url'), col('youtube_url'), col('deezer_url'),
    col('apple_music_url'), col('soundcloud_url'), col('galeria_urls'),
    col('documents'),
    // Media and links (metadata)
    meta('presskit_url'), meta('documentos_pessoais_url'),
    meta('apple_music_albuns_url'), meta('soundcloud_seguidores_url'),
    meta('instagram_url'), meta('tiktok_url'),
    // Platform metrics (metadata)
    meta('instagram_seguidores'), meta('tiktok_seguidores'),
    meta('spotify_ouvintes'), meta('youtube_inscritos'), meta('deezer_fas'),
    // Team and business (direct columns)
    col('manager_nome'), enc('manager_contato', 'manager_contato_encrypted'),
    col('produtor_executivo'), col('agencia_booking'), col('label_parceira'),
    col('contrato_id'),
    // Team and business (metadata)
    meta('empresario_id'), meta('empresario_nome'),
    meta('empresario_email'), meta('empresario_telefone'),
    meta('gravadora_id'), meta('gravadora_nome'), meta('gravadora_email'),
    meta('gravadora_telefone'), meta('gravadora_responsavel_id'),
    meta('gravadora_responsavel_nome'), meta('gravadora_responsavel_email'),
    meta('gravadora_responsavel_telefone'),
    // Bank details (metadata) — "agencia" here is the form's bank branch
    // (bank details section: bank/branch/account/Pix key/holder),
    // not the booking agency (col('agencia_booking') above, a distinct field).
    // It was wrongly listed under "team and business" (same JSON key,
    // wrong category) — fixed to match the form's visual order.
    meta('banco'), meta('agencia'), meta('conta'), meta('chave_pix'), meta('titular_conta'),
    // Distribution (metadata; arrays serialized as reversible JSON)
    meta('distribuidoras_selecionadas'), meta('distribuidoras_gerais'),
    meta('distribuidoras_emails'), meta('distribuidoras_empresa_selecionadas'),
    meta('distribuidoras_empresa_emails'),
    // Network (metadata; arrays/objects serialized as reversible JSON)
    meta('contatos_equipe'), meta('contatos_vinculados'), meta('relacionamentos'),
  ],
  excludedFormFields: {
    metadata: 'raw internal jsonb object — its individual fields are already contract columns',
    notas_internas: 'internal note hidden by policy (HIDDEN_INTERNAL_HINT)',
  },
  filterableColumns: ['status', 'music_genre'],
  searchableColumns: ['nome_artistico', 'nome_civil', 'music_genre', 'notes'],
};

// ─── Employees (HR) ─────────────────────────────────────────────────────────
const EMPLOYEES_CONTRACT: ReportFormContract = {
  tableName: 'employees',
  identityColumn: 'name',
  fields: [
    col('name'), col('cargo'), col('departamento'), col('status'),
    col('tipo_contrato'), col('salario'), col('data_admissao'),
    col('data_demissao'), col('documents'),
    enc('email', 'email_encrypted'), enc('telefone', 'telefone_encrypted'),
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
    col('start_date'), col('end_date'), col('exclusivo'), col('notes'),
    col('arquivo_url'), col('signing_platform'),
    col('artist_id'), col('client_id'), col('release_id'),
    col('template_id'), // wizard field (2026-07-12 rule: its own column)
    ro('autentique_doc_id'), // technical state of the signature integration
    ro('versoes'),           // version history (generated by the signature flow)
    ro('documents'),        // real R2 attachments (REM-02), same pattern as versoes
  ],
  excludedFormFields: {
    metadata: 'raw internal jsonb object',
    currency: 'legacy alias without its own column (amount is BRL by contract)',
    signedAt: 'state managed exclusively by the signature integration',
    parties: 'signature integration structure, not a tabular column',
    signers: 'signature integration structure, not a tabular column',
  },
  formFieldAliases: {
    titulo: 'title',
    tipo: 'type',
    value: 'fixed_value',
    valor: 'fixed_value',
    fileUrl: 'arquivo_url',
    data_inicio: 'start_date',
    startsAt: 'start_date',
    data_fim: 'end_date',
    expiresAt: 'end_date',
    artistId: 'artist_id',
  },
};

// ─── Works ────────────────────────────────────────────────────────────────────
const WORKS_CONTRACT: ReportFormContract = {
  tableName: 'works',
  identityColumn: 'title',
  fields: [
    col('title'), col('type'), col('status'), col('music_genre'),
    col('compositor'), col('compositores'), col('editora'),
    col('isrc'), col('iswc'),
    // Work form fields (2026-07-12 rule: 1 column per field, exact name)
    col('idioma'), col('cod_entidade'), col('cod_ecad'), col('duration_text'),
    col('instrumental'), col('criada_por_ia'), col('tipo_ia'),
    col('ia_harmonia'), col('ia_melodia'), col('ia_letra'),
    col('outros_titulos'), col('referencias_conexas'), col('letra_completa'),
    col('letristas'), col('project_id'),
    col('artist_id'), col('tipo_obra'),
    // Read-only: registration/societies and enrichment (not part of the create form)
    ro('duration_seconds'), ro('alternative_titles'), ro('ai_tools'), ro('ai_prompts'),
    ro('language'), ro('lyrics'), ro('is_instrumental'), ro('ai_used'),
    ro('registry_status'),
    ro('external_reference'), ro('origem_externa'), ro('origem_externa_sincronizado_em'),
  ],
  excludedFormFields: {
    metadata: 'raw internal jsonb object',
    authors: 'relationship (authors/percentages) managed on the dedicated shares screen',
    shares: 'relationship in its own table (shares), reportable separately',
    participantes: 'relationship normalized into work_participants (migration 20260718000011), reportable separately',
    co_compositores: 'column removed (20260718000011) — no active writer, no real data lost',
    detentores: 'column removed (20260718000011) — no active writer, no real data lost',
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
    // Phonogram form fields (2026-07-12 rule: 1 column per field, exact name)
    col('cod_entidade'), col('cod_ecad'), col('agregadora'),
    col('isrc_pais'), col('isrc_registrante'), col('isrc_ano'), col('isrc_designacao'),
    col('criada_por_ia'), col('is_instrumental'), col('nacional'), col('pub_simultanea'),
    col('emissao'), col('gravacao_original'), col('data_lancamento'),
    col('duracao_min'), col('duracao_seg'), col('midia'), col('classificacao'),
    col('pais_origem'), col('pais_publicacao'), col('gravadora'),
    col('notes'), col('participacao'), col('arquivo_audio'),
    // Read-only: registration/societies and recording metadata
    ro('type'), ro('version_title'), ro('duration_seconds'),
    ro('recording_date'), ro('release_date'), ro('copyright_year'),
    ro('copyright_owner'), ro('country_of_recording'),
    ro('registry_status'),
    ro('external_reference'), ro('origem_externa'), ro('origem_externa_sincronizado_em'),
    ro('audio_file_id'),
  ],
  excludedFormFields: {
    metadata: 'raw internal jsonb object',
    fileUrl: 'hypothetical field that does not exist in the DTO — the real upload flow fills audio_file_id (see the read-only entry above) and arquivo_audio',
    abramus_protocol: 'orphan column removed (20260718000016) — never written by any real flow',
    compositores: 'column removed (20260923000002) — no active writer, superseded by participacao (jsonb)',
    interpretes: 'column removed (20260923000002) — no active writer, superseded by participacao (jsonb)',
    produtores: 'column removed (20260923000002) — no active writer, superseded by participacao (jsonb)',
  },
  formFieldAliases: {
    titulo: 'title',
    duration: 'duration_text',
    duracao: 'duration_text',
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
  identityColumn: 'nome',
  fields: [
    col('tipo_pessoa'), col('categoria'), col('perfil'), col('nome'),
    col('foto'), col('individual_name'), col('razao_social'), col('trade_name'),
    enc('email', 'email_encrypted'), enc('telefone', 'telefone_encrypted'),
    enc('cpf_cnpj', 'cpf_cnpj_encrypted'),
    col('instagram'), col('funcao'),
    col('logradouro'), col('numero'), col('complemento'), col('bairro'),
    col('city'), col('state'), col('cep'), col('endereco_completo'),
    col('status_contato'), col('prioridade_contato'),
    col('responsavel_nome'), col('responsavel_email'),
    col('responsavel_telefone'), col('responsavel_cargo'),
    col('notes'), col('status'),
  ],
  excludedFormFields: {
    metadata: 'raw internal jsonb object — no form fields of its own',
    avatarUrl: 'accepted by CreateClientDto but discarded by the service — no mapped column (normalizeClientPayload never persists avatarUrl)',
  },
  formFieldAliases: {
    name: 'nome',
    type: 'tipo_pessoa',
    category: 'categoria',
    phone: 'telefone',
    document: 'cpf_cnpj',
    address: 'endereco_completo',
    // Part 79: CreateClientDto gained these fields to support CRM
    // "Contatos" (same physical `clients` table — contact = client). city/state
    // no longer need an alias — 20260921000003_RenameClientsGeoFieldsToEnglish
    // renamed the physical columns to match the DTO directly.
    zipCode: 'cep',
    responsible: 'responsavel_nome',
    notes: 'notes',
    priority: 'prioridade_contato',
  },
};

// ─── Projects ────────────────────────────────────────────────────────────────
// Canonical source: ProjetoFormModal.tsx. A single sheet; one row per track.
const PROJECTS_CONTRACT: ReportFormContract = {
  tableName: 'projects',
  identityColumn: 'nome_ep_album',
  fields: [
    col('tipo_lancamento', 'type'),
    col('nome_ep_album', 'title'),
    col('notes'),
    col('status_projeto', 'status'),
  ],
  excludedFormFields: {
    metadata: 'raw internal jsonb object',
    artist_id: 'no matching field in the Create/Edit modal',
    budget: 'no matching field in the Create/Edit modal',
    orcamento: 'deprecated alias of budget (deploy-skew window), moved to budget before persistence',
    description: 'no matching field in the Create/Edit modal',
    music_genre: 'derived from the tracks, not a general form field',
    musicas: 'represented by the individual columns of the repeating group on the same sheet',
  },
  repeatingGroup: {
      key: 'musicas',
      fields: [
        { key: 'nome_musica' },
        { key: 'soloFeat' },
        { key: 'originalRemix' },
        { key: 'instrumental' },
        { key: 'duracaoMinutos' },
        { key: 'duracaoSegundos' },
        { key: 'generoMusical' },
        { key: 'idiomaMusica' },
        { key: 'compositores', multi: true },
        { key: 'interpretes', multi: true },
        { key: 'produtores', multi: true },
        { key: 'letra' },
        { key: 'arquivosAudio' },
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
  identityColumn: 'titulo_detectado',
  fields: [
    ro('titulo_detectado'), ro('plataforma'), ro('type'), ro('status'),
    ro('url'), ro('score'), ro('detectado_em'), ro('work_id'), ro('artist_id'),
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
    col('title'), col('type'), col('work_id'), col('obra_musical'), col('artista'),
    col('client_id'), col('cliente'), col('projeto'), col('tipo_uso'),
    col('midia_destino'), col('territorio'), col('status'),
    col('start_date'), col('end_date'), col('valor'), col('moeda'), col('notes'),
  ],
  excludedFormFields: {},
  filterableColumns: ['status', 'type', 'territorio'],
  searchableColumns: ['title', 'obra_musical', 'artista', 'cliente', 'projeto'],
};

// ─── Takedowns ────────────────────────────────────────────────────────────────
// CreateTakedownDto (platform/trackId/reason/requestedAt) diverges completely
// from the real column names and from the real form (TakedownFormModal.tsx, which
// uses title/type/obra_afetada/artista/.../observacoes) — a pre-existing
// DTO↔form mismatch bug, out of scope for this Part. The contract uses the real
// physical columns the form actually writes; it is not checked against the broken
// DTO (absent from FORM_DTO_BY_TABLE in the guard test).
const TAKEDOWNS_CONTRACT: ReportFormContract = {
  tableName: 'takedowns',
  identityColumn: 'title',
  fields: [
    col('title'), col('type'), col('obra_afetada'), col('artista'), col('status'),
    col('prioridade'), col('plataforma'), col('url_infracao'), col('motivo'),
    col('data_identificacao'), col('description'), col('evidencias'), col('notes'),
  ],
  excludedFormFields: {},
  filterableColumns: ['status', 'type', 'prioridade', 'plataforma'],
  searchableColumns: ['title', 'obra_afetada', 'artista', 'motivo'],
};

// ─── Distribution (releases) ─────────────────────────────────────────────────
// Canonical source: LancamentoFormModal.tsx (5-step wizard). Most of the
// advanced fields (Step 0/3) live in the generic `metadata` column
// (extraFields.* → metadata.*); `faixas[]` (Step 1) lives in
// metadata.faixas — its own repeatable group (see release-tracks.field.ts).
// `platforms`/`assets`/`cronograma` have no identifiable UI input
// (platforms: no multi-platform selector in the current wizard; assets: no
// dedicated upload besides the cover; cronograma: no inputs in the modal) — excluded/
// read-only.
const RELEASES_CONTRACT: ReportFormContract = {
  tableName: 'releases',
  identityColumn: 'title',
  fields: [
    col('title'), col('type'), col('artist_id'), col('upc'), col('distribuidora'),
    col('data_lancamento'), col('capa_url'), col('isrc_global'), col('notas_internas'),
    col('notes'), col('gravadora'), col('copyright'), col('music_genre'), col('idioma'),
    ro('status'), ro('cronograma'),
    meta('variosArtistas'), meta('generoSecundario'),
    meta('copyrightDataLancamento'), meta('copyrightDataGravacao'),
    meta('ownUpc'), meta('territory'), meta('releaseTime'), meta('releaseTimezone'),
    meta('preOrder'), meta('noPreviewsDuringPreOrder'), meta('pricing'),
    meta('artistasAdicionaisAlbum'),
  ],
  excludedFormFields: {
    platforms: 'accepted by the DTO but no multi-platform selector exists in the current wizard',
    metadata: 'raw internal jsonb object — its individual fields are already contract columns',
    assets: 'no dedicated upload inputs besides the cover (coverUrl → capa_url, already has its own column)',
    faixas: 'represented by its own repeating group ("Faixas do Lançamento", repeatingGroup) — never packed into a single cell',
  },
  formFieldAliases: {
    title: 'title',
    type: 'type',
    artistId: 'artist_id',
    distributor: 'distribuidora',
    releasedAt: 'data_lancamento',
    coverUrl: 'capa_url',
  },
  repeatingGroup: {
      key: 'faixas',
      fields: [
        { key: 'nome' }, { key: 'isVersionAlternativa' }, { key: 'tipoVersao' },
        { key: 'versionCustomName' }, { key: 'compositores', multi: true },
        { key: 'aiAssistanceLevel' }, { key: 'instrumental' }, { key: 'faixa_idioma' },
        { key: 'letra' }, { key: 'explicit' }, { key: 'isrc' }, { key: 'artista' },
      ],
  },
};

// ─── Shares ───────────────────────────────────────────────────────────────────
// `historico[]` is an audit trail generated automatically by the system
// on every edit (never typed by the user) — exported read-only as a
// direct column (same pattern already used by contracts.versoes), without becoming
// its own child sheet.
const SHARES_CONTRACT: ReportFormContract = {
  tableName: 'shares',
  identityColumn: 'music_title',
  fields: [
    col('share_type'), col('percentage'), col('status'), col('direction'),
    col('release_id'), col('music_title'), col('holder'), col('recipient'),
    col('type'), col('artista_externo'), col('artista_project_id'), col('artist_id'),
    col('pagador'), col('pagador_contato'), col('origem_acordo'), col('data_prevista'),
    col('documents'), col('acordo_notas'), col('acordo_url'), col('notes'),
    col('total_amount'), col('settled_amount'),
    ro('versao'), ro('historico'),
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
    videomaker: 'deprecated alias of videographer (deploy-skew window), moved to videographer before persistence',
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
// Form columns (2026-07-12 rule) — `tipo_transacao`/`data_transacao`
// are the file's logical key, but the table does NOT duplicate them from `type`/`data`
// (those are NOT NULL, without a default, and are the only ones read by
// TransactionsService — tipo_transacao/data_transacao were always NULL).
// `physical` points the logical key to the real column, like the manual
// import/export — without it, every importer INSERT violated NOT NULL. Real
// validation is Zod (transacao.validator.ts), not a class-validator DTO — not
// checked against FORM_DTO_BY_TABLE.
const TRANSACTIONS_CONTRACT: ReportFormContract = {
  tableName: 'transactions',
  identityColumn: 'descricao',
  fields: [
    col('tipo_transacao', 'type'), col('tipo_cliente'), col('categoria'), col('subcategoria'),
    col('descricao'), col('valor'), col('data_transacao', 'data'), col('status'),
    col('artist_id'), col('project_id'), col('contrato_id'), col('evento_id'),
    col('fornecedor_cliente'), col('orgao_arrecadador'), col('centro_custo'), col('competencia'),
    col('conta_origem'), col('conta_destino'), col('item_investimento'), col('motivo_viagem'),
    col('advertising_name'), col('forma_pagamento'), col('tipo_pagamento'),
    col('quantidade_parcelas'), col('intervalo_parcelas'), col('data_primeira_parcela'),
    col('anexo_url'), col('anexo_nome'), col('notes'),
  ],
  excludedFormFields: {},
  filterableColumns: ['status', 'tipo_transacao', 'categoria'],
  searchableColumns: ['descricao', 'categoria', 'fornecedor_cliente'],
};

// ─── Invoice (invoices) ──────────────────────────────────────────────────────
// CreateInvoiceDto declares an English/Stripe schema (type/amount/number/...)
// completely different from the real columns the NotaFiscalFormModal form
// writes — a pre-existing DTO↔form mismatch bug (same pattern as Takedowns),
// out of scope for this Part. The contract uses the real physical columns; it is not
// checked against the broken DTO.
const INVOICES_CONTRACT: ReportFormContract = {
  tableName: 'invoices',
  identityColumn: 'numero',
  fields: [
    col('numero'), col('serie'), col('tipo_nota'), col('data_emissao'), col('status'),
    col('natureza_operacao'), col('cfop'), col('codigo_servico_municipal'), col('codigo_municipio'),
    col('client_id'), col('tomador_cnpj'), col('tomador_razao_social'),
    col('tomador_inscricao_estadual'), col('tomador_inscricao_municipal'), col('tomador_email'),
    col('tomador_address'), col('tomador_city'), col('tomador_uf'), col('tomador_cep'),
    col('service_description'), col('service_amount'), col('deductions_amount'), col('base_calculo'),
    col('aliquota_iss'), col('iss_amount'), col('iss_retido'), col('pis_amount'), col('cofins_amount'),
    col('ir_amount'), col('csll_amount'), col('inss_amount'), col('net_amount'),
    col('forma_pagamento'), col('condicao_pagamento'), col('data_vencimento'), col('url_pdf'),
    col('notes'),
  ],
  excludedFormFields: {},
  // The form/DTO uses "vencimento" (kept as a documented API alias);
  // the canonical physical column is data_vencimento -- see invoices.service.ts's
  // normalizePayload(), which now also deletes the "vencimento" key from the
  // persisted payload so it does not write the `vencimento` column (physical,
  // date type) in parallel with data_vencimento (physical, timestamp type).
  formFieldAliases: {
    vencimento: 'data_vencimento',
  },
  repeatingGroup: {
      key: 'itens',
      fields: [
        { key: 'description' }, { key: 'codigo_servico' }, { key: 'quantidade' },
        { key: 'unit_price' }, { key: 'total_amount' },
      ],
  },
};

// ─── Agenda (events) ────────────────────────────────────────────────────────────
const EVENTS_CONTRACT: ReportFormContract = {
  tableName: 'events',
  identityColumn: 'title',
  fields: [
    col('title'), col('type'), col('data'), col('end_date'), col('local'),
    col('contato_local'), col('endereco'), col('fee_amount'), col('publico_esperado'),
    col('description'), col('notes'), col('status'),
  ],
  excludedFormFields: {
    city: 'accepted by the DTO but has neither a physical column nor an input in the modal',
    country: 'accepted by the DTO but has neither a physical column nor an input in the modal',
    capacity: 'accepted by the DTO but discarded by the server — no physical column (see publico_esperado)',
    ticketUrl: 'accepted by the DTO but has neither a physical column nor an input in the modal',
    metadata: 'raw internal jsonb object',
    artistId: 'technical link filled indirectly by the first participant of type artista — no input of its own',
    participantes: 'represented by its own repeating group ("Participantes do Evento", repeatingGroup) — never packed into a single cell',
  },
  formFieldAliases: {
    title: 'title',
    type: 'type',
    venue: 'local',
    startsAt: 'data',
    endsAt: 'end_date',
  },
  repeatingGroup: {
      key: 'participantes',
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
    col('name'), col('category'), col('quantidade'), col('unit_price'),
    col('localizacao'), col('status'), col('responsavel'), col('setor'),
    col('data_entrada'), col('local_compra'), col('numero_nota_fiscal'), col('notes'),
  ],
  excludedFormFields: {},
};

// ─── CRM — Leads ──────────────────────────────────────────────────────────────
// Most of the form's "advanced" fields (LeadFormModal.tsx) live in
// two NAMED jsonb columns — payload_servico and dados_internos_crm — not in the
// generic `metadata` column (hence `meta(key, physical)` with the explicit second
// argument). The 4 nested conditional blocks (evento/campanha/
// influenciador/empresario, each under payload_servico.<block>.*) and the
// interaction history (payload_servico.interacoes[]) stay OUT of this
// Part — they are objects nested inside payload_servico, not supported
// by the current 1-level mechanism (jsonb column → key), documented as a
// divergence in the final report.
const LEADS_CONTRACT: ReportFormContract = {
  tableName: 'leads',
  identityColumn: 'nome',
  fields: [
    col('nome'), col('empresa'), enc('email', 'email_encrypted'), col('whatsapp'),
    col('instagram'), col('city'), col('state'), col('client_type'), col('service_type'),
    // country: DTO-exposed (renamed from pais by naming-closure Cluster D,
    // 20260921000004_RenameLeadsGeoFieldsToEnglish) but LeadFormModal.tsx has
    // no input for it — every real row is system-normalized to 'BR'.
    // Report-only, not a form field.
    ro('country'),
    meta('cargo', 'payload_servico'), meta('website', 'payload_servico'),
    meta('endereco', 'payload_servico'), meta('tipo_lead', 'payload_servico'),
    meta('servico', 'payload_servico'), meta('nome_artista_servico', 'payload_servico'),
    meta('descricao', 'payload_servico'), meta('data_entrada', 'payload_servico'),
    // `origemLead`/`responsavel`/`prioridade`/`temperatura`/`proximoFollowUp`/
    // `valorEstimado`: naming-closure Cluster E resolved the former dual
    // storage location (a physical `origem_lead`/`responsavel`/`prioridade`/
    // `temperatura`/`estimated_value`/`probabilidade_fechamento`/
    // `proximo_follow_up` column set, 0 non-null rows on all 7, vs. these
    // same concepts inside `dados_internos_crm`, which real usage always
    // wrote) by dropping the dead physical columns
    // (20260921000005_DropDeadLeadsCrmDualStorageColumns) and redirecting
    // the one internal writer (public-artist-application) here too. jsonb
    // was already the only place any of these had live data.
    meta('origemLead', 'dados_internos_crm'), meta('campanha_marketing', 'dados_internos_crm'),
    meta('responsavel', 'dados_internos_crm'), meta('prioridade', 'dados_internos_crm'),
    meta('proximoFollowUp', 'dados_internos_crm'), meta('valorEstimado', 'dados_internos_crm'),
    meta('temperatura', 'dados_internos_crm'), meta('statusLead', 'dados_internos_crm'),
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
    nomeArtistico: 'accepted by the DTO but has no input in the real Leads form',
    payloadServico: 'raw jsonb object — its individual fields are already contract columns',
    dadosInternosCRM: 'raw jsonb object — its individual fields are already contract columns',
  },
  formFieldAliases: {
    name: 'nome',
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
  identityColumn: 'artista',
  fields: [
    ro('artista'), ro('receitas'), ro('despesas'), ro('resultado'), ro('margem'),
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
  return REPORT_FORM_CONTRACTS[tableName] ?? null;
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

/** key → physical jsonb column where it lives (default 'metadata' when `physical` was not given). */
export function contractMetadataFields(contract: ReportFormContract): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of contract.fields) {
    if (f.storage === 'metadata') out[f.key] = f.physical ?? 'metadata';
  }
  return out;
}

