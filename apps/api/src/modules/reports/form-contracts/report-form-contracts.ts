/**
 * modules/reports/form-contracts/report-form-contracts.ts
 *
 * FONTE ÚNICA DE VERDADE das colunas de exportação/importação da Central de
 * Relatórios para entidades com formulário real.
 *
 * Consumida simultaneamente por:
 *   - ReportEntityDefinitionService  (exportableColumns / importableColumns)
 *   - ExportQueryBuilderService      (resolução física: coluna | metadata | cifrada)
 *   - ExportEngineService            (descriptografia na exportação)
 *   - ImportCommitService            (persistência: coluna | metadata | cifrada)
 *   - form-contracts.guard.spec      (guarda permanente DTO ↔ contrato)
 *
 * Regras:
 *   - `key` é a chave lógica estável da coluna no arquivo (o cabeçalho exibido
 *     vem da camada i18n central, field-labels.pt-br).
 *   - `storage` define onde o campo vive fisicamente na tabela.
 *   - `importable: false` marca campo somente-leitura no arquivo (exportado,
 *     mas nunca sobrescrito pela importação — ex.: códigos de registro ECAD).
 *   - `excludedFormFields` documenta TODO campo do DTO do formulário que ficou
 *     deliberadamente fora do contrato, com o motivo (o guard exige isso).
 *   - `formFieldAliases` mapeia campos legados/EN do DTO para a chave física
 *     canônica (ex.: `title` → `title`).
 */
import { ACCOUNTING_SUMMARY_TABLE_NAME } from '../report-module-registry';

export type ReportFieldStorage = 'column' | 'metadata' | 'encrypted';

export interface ReportFieldSpec {
  /** Chave lógica estável (coluna do arquivo e do formulário). */
  key: string;
  /** Onde o campo vive fisicamente. */
  storage: ReportFieldStorage;
  /** Coluna física para storage cifrado ou alias de coluna real. */
  physical?: string;
  /** false ⇒ somente exportação (nunca sobrescrito na importação). */
  importable?: boolean;
}

/** Grupo repetível achatado em linhas da mesma aba XLSX. */
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
  /** Ordem oficial e determinística das colunas do arquivo. */
  fields: ReportFieldSpec[];
  /** Campo do DTO → motivo da exclusão (auditável; exigido pelo guard). */
  excludedFormFields: Record<string, string>;
  /** Campo legado/EN do DTO → key canônica do contrato. */
  formFieldAliases?: Record<string, string>;
  /** Overrides opcionais (apenas colunas físicas do contrato). */
  filterableColumns?: string[];
  searchableColumns?: string[];
  /** Campos repetíveis achatados em linhas da mesma aba XLSX. */
  repeatingGroup?: ReportRepeatingGroupSpec;
}

const col = (key: string, physical?: string): ReportFieldSpec => ({ key, storage: 'column', physical });
const ro = (key: string, physical?: string): ReportFieldSpec => ({ key, storage: 'column', physical, importable: false });
/**
 * Campo residente num jsonb. `physical` indica QUAL coluna jsonb (default
 * `'metadata'`, a coluna genérica presente na maioria das tabelas) — use o
 * segundo parâmetro quando o formulário guarda o campo numa coluna jsonb
 * NOMEADA própria (ex.: leads.payload_servico, leads.dados_internos_crm),
 * não na coluna `metadata` genérica.
 */
const meta = (key: string, physical: string = 'metadata'): ReportFieldSpec => ({ key, storage: 'metadata', physical });
const enc = (key: string, physical: string): ReportFieldSpec => ({ key, storage: 'encrypted', physical });
// ─── Artistas (formulário completo — 68 campos) ──────────────────────────────
const ARTISTS_CONTRACT: ReportFormContract = {
  tableName: 'artists',
  identityColumn: 'nome_artistico',
  fields: [
    // Identidade e perfil (colunas diretas)
    col('nome_artistico'), col('nome_civil'), col('status'),
    col('genero_musical'), col('observacoes'), col('especialidades'),
    // Perfil estendido (metadata jsonb)
    meta('slug_artistico'), meta('tipo_perfil'), meta('fase_carreira'),
    meta('genero'), meta('data_nascimento'), meta('rg'), meta('endereco'),
    meta('tags_musicais'),
    // Contato (cifrados)
    enc('email', 'email_encrypted'), enc('telefone', 'telefone_encrypted'),
    enc('cpf_cnpj', 'cpf_cnpj_encrypted'),
    // Mídia e links (colunas diretas)
    col('foto_url'), col('spotify_url'), col('youtube_url'), col('deezer_url'),
    col('apple_music_url'), col('soundcloud_url'), col('galeria_urls'),
    col('documents'),
    // Mídia e links (metadata)
    meta('presskit_url'), meta('documentos_pessoais_url'),
    meta('apple_music_albuns_url'), meta('soundcloud_seguidores_url'),
    meta('instagram_url'), meta('tiktok_url'),
    // Métricas de plataformas (metadata)
    meta('instagram_seguidores'), meta('tiktok_seguidores'),
    meta('spotify_ouvintes'), meta('youtube_inscritos'), meta('deezer_fas'),
    // Equipe e negócios (colunas diretas)
    col('manager_nome'), enc('manager_contato', 'manager_contato_encrypted'),
    col('produtor_executivo'), col('agencia_booking'), col('label_parceira'),
    col('contrato_id'),
    // Equipe e negócios (metadata)
    meta('empresario_id'), meta('empresario_nome'),
    meta('empresario_email'), meta('empresario_telefone'),
    meta('gravadora_id'), meta('gravadora_nome'), meta('gravadora_email'),
    meta('gravadora_telefone'), meta('gravadora_responsavel_id'),
    meta('gravadora_responsavel_nome'), meta('gravadora_responsavel_email'),
    meta('gravadora_responsavel_telefone'),
    // Dados bancários (metadata) — "agencia" aqui é a agência bancária do
    // formulário (Dados Bancários: Banco/Agência/Conta/Chave Pix/Titular),
    // não a agência de booking (col('agencia_booking') acima, campo distinto).
    // Estava incorretamente listada em "Equipe e negócios" (mesma key JSON,
    // categoria errada) — corrigido para casar com a ordem visual do form.
    meta('banco'), meta('agencia'), meta('conta'), meta('chave_pix'), meta('titular_conta'),
    // Distribuição (metadata; arrays serializados em JSON reversível)
    meta('distribuidoras_selecionadas'), meta('distribuidoras_gerais'),
    meta('distribuidoras_emails'), meta('distribuidoras_empresa_selecionadas'),
    meta('distribuidoras_empresa_emails'),
    // Rede (metadata; arrays/objetos serializados em JSON reversível)
    meta('contatos_equipe'), meta('contatos_vinculados'), meta('relacionamentos'),
  ],
  excludedFormFields: {
    metadata: 'objeto jsonb interno bruto — os campos individuais já são colunas do contrato',
    notas_internas: 'anotação interna oculta por política (HIDDEN_INTERNAL_HINT)',
  },
  filterableColumns: ['status', 'genero_musical'],
  searchableColumns: ['nome_artistico', 'nome_civil', 'genero_musical', 'observacoes'],
};

// ─── Funcionários (RH) ────────────────────────────────────────────────────────
const EMPLOYEES_CONTRACT: ReportFormContract = {
  tableName: 'employees',
  identityColumn: 'nome',
  fields: [
    col('nome'), col('cargo'), col('departamento'), col('status'),
    col('tipo_contrato'), col('salario'), col('data_admissao'),
    col('data_demissao'), col('documents'),
    enc('email', 'email_encrypted'), enc('telefone', 'telefone_encrypted'),
    enc('cpf', 'cpf_encrypted'),
  ],
  excludedFormFields: {
    metadata: 'objeto jsonb interno bruto — sem campos de formulário próprios',
  },
};

// ─── Contratos ────────────────────────────────────────────────────────────────
const CONTRACTS_CONTRACT: ReportFormContract = {
  tableName: 'contracts',
  identityColumn: 'title',
  fields: [
    col('title'), col('type'), col('status'), col('valor'),
    col('start_date'), col('end_date'), col('exclusivo'), col('observacoes'),
    col('arquivo_url'), col('signing_platform'),
    col('artist_id'), col('client_id'), col('release_id'),
    col('template_id'), // campo do wizard (regra 2026-07-12: coluna própria)
    ro('autentique_doc_id'), // estado técnico da integração de assinatura
    ro('versoes'),           // histórico de versões (gerado pelo fluxo de assinatura)
    ro('documents'),        // anexos reais do R2 (REM-02), mesmo padrão de versoes
  ],
  excludedFormFields: {
    metadata: 'objeto jsonb interno bruto',
    currency: 'alias legado sem coluna própria (valor é BRL por contrato)',
    signedAt: 'estado gerenciado exclusivamente pela integração de assinatura',
    parties: 'estrutura da integração de assinatura, não coluna tabular',
    signers: 'estrutura da integração de assinatura, não coluna tabular',
  },
  formFieldAliases: {
    titulo: 'title',
    tipo: 'type',
    value: 'valor',
    fileUrl: 'arquivo_url',
    data_inicio: 'start_date',
    startsAt: 'start_date',
    data_fim: 'end_date',
    expiresAt: 'end_date',
    artistId: 'artist_id',
  },
};

// ─── Obras ────────────────────────────────────────────────────────────────────
const WORKS_CONTRACT: ReportFormContract = {
  tableName: 'works',
  identityColumn: 'title',
  fields: [
    col('title'), col('type'), col('status'), col('genero'),
    col('compositor'), col('compositores'), col('editora'),
    col('isrc'), col('iswc'),
    // Campos do formulário de Obra (regra 2026-07-12: 1 coluna por campo, nome exato)
    col('idioma'), col('cod_entidade'), col('cod_ecad'), col('duracao'),
    col('instrumental'), col('criada_por_ia'), col('tipo_ia'),
    col('ia_harmonia'), col('ia_melodia'), col('ia_letra'),
    col('outros_titulos'), col('referencias_conexas'), col('letra_completa'),
    col('letristas'), col('project_id'),
    col('artist_id'), col('tipo_obra'),
    // Somente leitura: registro/sociedades e enriquecimento (não são do form de criação)
    ro('duration_seconds'),
    ro('language'), ro('lyrics'), ro('is_instrumental'), ro('ai_used'),
    ro('registry_status'),
    ro('external_reference'), ro('origem_externa'), ro('origem_externa_sincronizado_em'),
  ],
  excludedFormFields: {
    metadata: 'objeto jsonb interno bruto',
    authors: 'relacionamento (autores/percentuais) gerido na tela própria de shares',
    shares: 'relacionamento em tabela própria (shares), reportável separadamente',
    participantes: 'relacionamento normalizado em work_participants (migration 20260718000011), reportável separadamente',
    co_compositores: 'coluna removida (20260718000011) — sem writer ativo, nenhum dado real perdido',
    detentores: 'coluna removida (20260718000011) — sem writer ativo, nenhum dado real perdido',
    abramus_protocol: 'coluna órfã removida (20260718000016) — nunca escrita por nenhum fluxo real',
  },
};

// ─── Fonogramas ───────────────────────────────────────────────────────────────
const PHONOGRAMS_CONTRACT: ReportFormContract = {
  tableName: 'phonograms',
  identityColumn: 'title',
  fields: [
    col('title'), col('status'), col('genero_musical'), col('isrc'),
    col('duracao'), col('artist_id'), col('work_id'),
    // Campos do formulário de Fonograma (regra 2026-07-12: 1 coluna por campo, nome exato)
    col('cod_entidade'), col('cod_ecad'), col('agregadora'),
    col('isrc_pais'), col('isrc_registrante'), col('isrc_ano'), col('isrc_designacao'),
    col('criada_por_ia'), col('instrumental'), col('nacional'), col('pub_simultanea'),
    col('emissao'), col('gravacao_original'), col('data_lancamento'),
    col('duracao_min'), col('duracao_seg'), col('midia'), col('classificacao'),
    col('pais_origem'), col('pais_publicacao'), col('gravadora'),
    col('observacoes'), col('participacao'), col('arquivo_audio'),
    // Somente leitura: registro/sociedades e metadados de gravação
    ro('type'), ro('version_title'), ro('interpretes'), ro('compositores'),
    ro('produtores'), ro('duration_seconds'),
    ro('recording_date'), ro('release_date'), ro('copyright_year'),
    ro('copyright_owner'), ro('country_of_recording'),
    ro('registry_status'),
    ro('external_reference'), ro('origem_externa'), ro('origem_externa_sincronizado_em'),
  ],
  excludedFormFields: {
    metadata: 'objeto jsonb interno bruto',
    fileUrl: 'arquivo de áudio gerido pelo fluxo de upload (audio_file_id)',
    abramus_protocol: 'coluna órfã removida (20260718000016) — nunca escrita por nenhum fluxo real',
  },
  formFieldAliases: {
    titulo: 'title',
    duration: 'duracao',
    artistId: 'artist_id',
    workId: 'work_id',
  },
};

// ─── Clientes ─────────────────────────────────────────────────────────────────
// Parte 78: sem contrato central, o exportador (heurística genérica) omitia
// email/telefone/cpf_cnpj por completo (colunas *_encrypted nunca aparecem em
// exportableColumns). Uma exportação de "Clientes" sem contato é inútil na
// prática — registra o contrato para que o engine descriptografe esses campos
// como faz para artists/employees.
const CLIENTS_CONTRACT: ReportFormContract = {
  tableName: 'clients',
  identityColumn: 'nome',
  fields: [
    col('tipo_pessoa'), col('categoria'), col('perfil'), col('nome'),
    col('foto'), col('nome_pf'), col('razao_social'), col('nome_fantasia'),
    enc('email', 'email_encrypted'), enc('telefone', 'telefone_encrypted'),
    enc('cpf_cnpj', 'cpf_cnpj_encrypted'),
    col('instagram'), col('funcao'),
    col('logradouro'), col('numero'), col('complemento'), col('bairro'),
    col('cidade'), col('estado'), col('cep'), col('endereco_completo'),
    col('status_contato'), col('prioridade_contato'),
    col('responsavel_nome'), col('responsavel_email'),
    col('responsavel_telefone'), col('responsavel_cargo'),
    col('observacoes'), col('status'),
  ],
  excludedFormFields: {
    metadata: 'objeto jsonb interno bruto — sem campos de formulário próprios',
    avatarUrl: 'aceito pelo CreateClientDto mas descartado pelo service — sem coluna própria mapeada (normalizeClientPayload nunca persiste avatarUrl)',
  },
  formFieldAliases: {
    name: 'nome',
    type: 'tipo_pessoa',
    category: 'categoria',
    phone: 'telefone',
    document: 'cpf_cnpj',
    address: 'endereco_completo',
    // Parte 79: CreateClientDto ganhou estes campos para suportar "Contatos"
    // do CRM (mesma tabela física `clients` — Contato = Cliente).
    city: 'cidade',
    state: 'estado',
    zipCode: 'cep',
    responsible: 'responsavel_nome',
    notes: 'observacoes',
    priority: 'prioridade_contato',
  },
};

// ─── Projetos ─────────────────────────────────────────────────────────────────
// Fonte canônica: ProjetoFormModal.tsx. Uma única aba; uma linha por música.
const PROJECTS_CONTRACT: ReportFormContract = {
  tableName: 'projects',
  identityColumn: 'nome_ep_album',
  fields: [
    col('tipo_lancamento', 'type'),
    col('nome_ep_album', 'title'),
    col('observacoes'),
    col('status_projeto', 'status'),
  ],
  excludedFormFields: {
    metadata: 'objeto jsonb interno bruto',
    artist_id: 'sem campo correspondente no modal Criar/Editar',
    orcamento: 'sem campo correspondente no modal Criar/Editar',
    descricao: 'sem campo correspondente no modal Criar/Editar',
    genero: 'derivado das músicas, não é campo geral do formulário',
    musicas: 'representada pelas colunas individuais do grupo repetível na mesma aba',
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

// ─── Monitoramento (content_detections) ───────────────────────────────────────
// Parte 89, Bloco 11: não existe formulário Criar/Editar real (a tela é uma
// listagem read-only de detecções geradas automaticamente pela plataforma —
// os hooks addDeteccao/updateDeteccao/deleteDeteccao existem mas nunca são
// chamados por nenhuma UI). Contrato export-only, refletindo as colunas
// físicas reais (não os campos "periodo"/"quantidade" que a tela referencia
// mas não existem na entidade — bug de UI pré-existente, não reproduzido aqui).
const CONTENT_DETECTIONS_CONTRACT: ReportFormContract = {
  tableName: 'content_detections',
  identityColumn: 'titulo_detectado',
  fields: [
    ro('titulo_detectado'), ro('plataforma'), ro('type'), ro('status'),
    ro('url'), ro('score'), ro('detectado_em'), ro('work_id'), ro('artist_id'),
  ],
  excludedFormFields: {},
};

// ─── Licenciamento ──────────────────────────────────────────────────────────
// `amount`/`percentage`/`currency` são enviados pelo formulário mas NÃO
// existem no CreateLicenseDto (nem na entidade) — nunca persistem. `valor`/
// `moeda` são as colunas reais correspondentes. `remuneration_type`, embora
// exista fisicamente na entidade, também não está no DTO — excluído.
const LICENSES_CONTRACT: ReportFormContract = {
  tableName: 'licenses',
  identityColumn: 'title',
  fields: [
    col('title'), col('type'), col('work_id'), col('obra_musical'), col('artista'),
    col('client_id'), col('cliente'), col('projeto'), col('tipo_uso'),
    col('midia_destino'), col('territorio'), col('status'),
    col('start_date'), col('end_date'), col('valor'), col('moeda'), col('observacoes'),
  ],
  excludedFormFields: {},
  filterableColumns: ['status', 'type', 'territorio'],
  searchableColumns: ['title', 'obra_musical', 'artista', 'cliente', 'projeto'],
};

// ─── Takedowns ────────────────────────────────────────────────────────────────
// CreateTakedownDto (platform/trackId/reason/requestedAt) diverge por completo
// dos nomes reais de coluna e do formulário real (TakedownFormModal.tsx, que
// usa title/type/obra_afetada/artista/.../observacoes) — bug pré-existente
// de mismatch DTO↔form, fora do escopo desta Parte. O contrato usa as colunas
// físicas reais que o formulário de fato grava; não é checado contra o DTO
// quebrado (ausente de FORM_DTO_BY_TABLE no guard test).
const TAKEDOWNS_CONTRACT: ReportFormContract = {
  tableName: 'takedowns',
  identityColumn: 'title',
  fields: [
    col('title'), col('type'), col('obra_afetada'), col('artista'), col('status'),
    col('prioridade'), col('plataforma'), col('url_infracao'), col('motivo'),
    col('data_identificacao'), col('descricao'), col('evidencias'), col('observacoes'),
  ],
  excludedFormFields: {},
  filterableColumns: ['status', 'type', 'prioridade', 'plataforma'],
  searchableColumns: ['title', 'obra_afetada', 'artista', 'motivo'],
};

// ─── Distribuição (releases) ───────────────────────────────────────────────────
// Fonte canônica: LancamentoFormModal.tsx (wizard de 5 etapas). A maioria dos
// campos avançados (Step 0/3) vive na coluna `metadata` genérica
// (extraFields.* → metadata.*); `faixas[]` (Step 1) vive em
// metadata.faixas — grupo repetível própria (ver releases-faixas.field.ts).
// `platforms`/`assets`/`cronograma` não têm input de UI identificável
// (platforms: sem seletor multi-plataforma no wizard atual; assets: sem
// upload dedicado além da capa; cronograma: sem inputs no modal) — excluídos/
// somente leitura.
const RELEASES_CONTRACT: ReportFormContract = {
  tableName: 'releases',
  identityColumn: 'title',
  fields: [
    col('title'), col('type'), col('artist_id'), col('upc'), col('distribuidora'),
    col('data_lancamento'), col('capa_url'), col('isrc_global'), col('notas_internas'),
    col('observacoes'), col('gravadora'), col('copyright'), col('genero'), col('idioma'),
    ro('status'), ro('cronograma'),
    meta('variosArtistas'), meta('generoSecundario'),
    meta('copyrightDataLancamento'), meta('copyrightDataGravacao'),
    meta('ownUpc'), meta('territory'), meta('releaseTime'), meta('releaseTimezone'),
    meta('preOrder'), meta('noPreviewsDuringPreOrder'), meta('pricing'),
    meta('artistasAdicionaisAlbum'),
  ],
  excludedFormFields: {
    platforms: 'aceito pelo DTO mas sem seletor multi-plataforma identificado no wizard atual',
    metadata: 'objeto jsonb interno bruto — os campos individuais já são colunas do contrato',
    assets: 'sem inputs de upload dedicados além da capa (coverUrl → capa_url, já tem coluna própria)',
    faixas: 'representada em grupo repetível própria ("Faixas do Lançamento", repeatingGroup) — nunca compactada numa única célula',
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
// `historico[]` é uma trilha de auditoria gerada automaticamente pelo sistema
// a cada edição (nunca digitada pelo usuário) — exportada somente leitura como
// coluna direta (mesmo padrão já usado por contracts.versoes), sem virar aba
// filha própria.
const SHARES_CONTRACT: ReportFormContract = {
  tableName: 'shares',
  identityColumn: 'music_title',
  fields: [
    col('share_type'), col('percentage'), col('status'), col('direction'),
    col('release_id'), col('music_title'), col('holder'), col('recipient'),
    col('type'), col('artista_externo'), col('artista_project_id'), col('artist_id'),
    col('pagador'), col('pagador_contato'), col('origem_acordo'), col('data_prevista'),
    col('documents'), col('acordo_notas'), col('acordo_url'), col('observacoes'),
    col('valor_total'), col('valor_liquidado'),
    ro('versao'), ro('historico'),
  ],
  excludedFormFields: {
    holderName: 'alias legado em inglês (registro ABRAMUS/ECAD) mapeado para holder_name — não é a tela real de Shares',
    role: 'alias legado em inglês mapeado para party_role — idem',
    workId: 'alias legado em inglês mapeado para work_id — idem',
    trackId: 'alias legado em inglês mapeado para fonograma_id — idem',
    holderDoc: 'alias legado em inglês mapeado para holder_document — idem',
    metadata: 'objeto jsonb interno bruto',
  },
};

// ─── Projetos Audiovisuais ──────────────────────────────────────────────────────
const AUDIOVISUAL_PROJECTS_CONTRACT: ReportFormContract = {
  tableName: 'audiovisual_projects',
  identityColumn: 'music_title',
  fields: [
    col('music_title'), ro('artist_name'), col('type'), col('format'),
    col('director'), col('videomaker'), col('editor'),
    col('shooting_date'), col('location'),
    col('capture_status'), col('editing_status'), col('approval_status'),
    col('pre_release_date'), col('release_date'),
    col('budget_estimated'), col('budget_actual'),
    col('concept'), col('observations'),
    ro('status'), ro('final_status'), ro('completed_at'),
  ],
  excludedFormFields: {
    title: 'duplicata automática de music_title — mesma coluna do formulário, sem input próprio',
    slug: 'aceito pelo DTO mas sem input no modal Criar/Editar',
    description: 'aceito pelo DTO mas sem input no modal Criar/Editar',
    objective: 'aceito pelo DTO mas sem input no modal Criar/Editar',
    priority: 'aceito pelo DTO mas sem input no modal Criar/Editar',
    stage: 'aceito pelo DTO mas sem input no modal Criar/Editar',
    production_company: 'aceito pelo DTO mas sem input no modal Criar/Editar',
    producer: 'aceito pelo DTO mas sem input no modal Criar/Editar',
    start_date: 'aceito pelo DTO mas sem input no modal Criar/Editar',
    recording_date: 'aceito pelo DTO mas sem input no modal Criar/Editar',
    delivery_date: 'aceito pelo DTO mas sem input no modal Criar/Editar',
    publish_date: 'aceito pelo DTO mas sem input no modal Criar/Editar',
    artist_id: 'relação técnica sem seletor próprio no modal',
    release_id: 'relação técnica sem seletor próprio no modal',
    phonogram_id: 'vínculo automático da busca de música — music_title já representa o mesmo vínculo de forma legível',
    campaign_id: 'relação técnica sem seletor próprio no modal',
    event_id: 'relação técnica sem seletor próprio no modal',
    metadata: 'objeto jsonb interno bruto',
  },
};

// ─── Transações Financeiras ─────────────────────────────────────────────────────
// Colunas de formulário (regra 2026-07-12) — `tipo_transacao`/`data_transacao`
// são a chave lógica do arquivo, mas a tabela NÃO as duplica de `type`/`data`
// (essas são NOT NULL, sem default, e são as únicas lidas por
// TransactionsService — tipo_transacao/data_transacao ficavam sempre NULL).
// `physical` aponta a chave lógica para a coluna real, igual ao import/export
// manual — sem isso, todo INSERT do importador violava NOT NULL. Validação
// real é Zod (transacao.validator.ts), não um DTO class-validator — não
// checado contra FORM_DTO_BY_TABLE.
const TRANSACTIONS_CONTRACT: ReportFormContract = {
  tableName: 'transactions',
  identityColumn: 'descricao',
  fields: [
    col('tipo_transacao', 'type'), col('tipo_cliente'), col('categoria'), col('subcategoria'),
    col('descricao'), col('valor'), col('data_transacao', 'data'), col('status'),
    col('artist_id'), col('project_id'), col('contrato_id'), col('evento_id'),
    col('fornecedor_cliente'), col('orgao_arrecadador'), col('centro_custo'), col('competencia'),
    col('conta_origem'), col('conta_destino'), col('item_investimento'), col('motivo_viagem'),
    col('nome_publicidade'), col('forma_pagamento'), col('tipo_pagamento'),
    col('quantidade_parcelas'), col('intervalo_parcelas'), col('data_primeira_parcela'),
    col('anexo_url'), col('anexo_nome'), col('observacoes'),
  ],
  excludedFormFields: {},
  filterableColumns: ['status', 'tipo_transacao', 'categoria'],
  searchableColumns: ['descricao', 'categoria', 'fornecedor_cliente'],
};

// ─── Nota Fiscal (invoices) ───────────────────────────────────────────────────
// CreateInvoiceDto declara um schema inglês/Stripe (type/amount/number/...)
// totalmente diferente das colunas reais que o formulário NotaFiscalFormModal
// grava — bug pré-existente de mismatch DTO↔form (mesmo padrão de Takedowns),
// fora do escopo desta Parte. O contrato usa as colunas físicas reais; não é
// checado contra o DTO quebrado.
const INVOICES_CONTRACT: ReportFormContract = {
  tableName: 'invoices',
  identityColumn: 'numero',
  fields: [
    col('numero'), col('serie'), col('tipo_nota'), col('data_emissao'), col('status'),
    col('natureza_operacao'), col('cfop'), col('codigo_servico_municipal'), col('codigo_municipio'),
    col('client_id'), col('tomador_cnpj'), col('tomador_razao_social'),
    col('tomador_inscricao_estadual'), col('tomador_inscricao_municipal'), col('tomador_email'),
    col('tomador_endereco'), col('tomador_cidade'), col('tomador_uf'), col('tomador_cep'),
    col('descricao_servicos'), col('valor_servicos'), col('valor_deducoes'), col('base_calculo'),
    col('aliquota_iss'), col('valor_iss'), col('iss_retido'), col('valor_pis'), col('valor_cofins'),
    col('valor_ir'), col('valor_csll'), col('valor_inss'), col('valor_liquido'),
    col('forma_pagamento'), col('condicao_pagamento'), col('vencimento'), col('url_pdf'),
    col('observacoes'),
  ],
  excludedFormFields: {},
  repeatingGroup: {
      key: 'itens',
      fields: [
        { key: 'descricao' }, { key: 'codigo_servico' }, { key: 'quantidade' },
        { key: 'valor_unitario' }, { key: 'valor_total' },
      ],
  },
};

// ─── Agenda (events) ────────────────────────────────────────────────────────────
const EVENTS_CONTRACT: ReportFormContract = {
  tableName: 'events',
  identityColumn: 'title',
  fields: [
    col('title'), col('type'), col('data'), col('end_date'), col('local'),
    col('contato_local'), col('endereco'), col('valor_cache'), col('publico_esperado'),
    col('descricao'), col('observacoes'), col('status'),
  ],
  excludedFormFields: {
    city: 'aceito pelo DTO mas sem coluna física nem input no modal',
    country: 'aceito pelo DTO mas sem coluna física nem input no modal',
    capacity: 'aceito pelo DTO mas descartado no servidor — sem coluna física (ver publico_esperado)',
    ticketUrl: 'aceito pelo DTO mas sem coluna física nem input no modal',
    metadata: 'objeto jsonb interno bruto',
    artistId: 'vínculo técnico preenchido indiretamente pelo primeiro participante do type artista — sem input próprio',
    participantes: 'representada em grupo repetível própria ("Participantes do Evento", repeatingGroup) — nunca compactada numa única célula',
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

// ─── Inventário ───────────────────────────────────────────────────────────────
const INVENTORY_ITEMS_CONTRACT: ReportFormContract = {
  tableName: 'inventory_items',
  identityColumn: 'nome',
  fields: [
    col('nome'), col('categoria'), col('quantidade'), col('valor_unitario'),
    col('localizacao'), col('status'), col('responsavel'), col('setor'),
    col('data_entrada'), col('local_compra'), col('numero_nota_fiscal'), col('observacoes'),
  ],
  excludedFormFields: {},
};

// ─── CRM — Leads ──────────────────────────────────────────────────────────────
// A maioria dos campos "avançados" do formulário (LeadFormModal.tsx) vive em
// duas colunas jsonb NOMEADAS — payload_servico e dados_internos_crm — não na
// coluna `metadata` genérica (por isso `meta(key, physical)` com o segundo
// argumento explícito). Os 4 blocos condicionais aninhados (evento/campanha/
// influenciador/empresario, cada um sob payload_servico.<bloco>.*) e o
// histórico de interações (payload_servico.interacoes[]) ficam FORA desta
// Parte — são objetos aninhados dentro de payload_servico, não suportados
// pelo mecanismo atual de 1 nível (coluna jsonb → chave), documentado como
// divergência no relatório final.
const LEADS_CONTRACT: ReportFormContract = {
  tableName: 'leads',
  identityColumn: 'nome',
  fields: [
    col('nome'), col('empresa'), enc('email', 'email_encrypted'), col('whatsapp'),
    col('instagram'), col('cidade'), col('estado'), col('tipo_cliente'), col('tipo_servico'),
    meta('cargo', 'payload_servico'), meta('website', 'payload_servico'),
    meta('endereco', 'payload_servico'), meta('tipo_lead', 'payload_servico'),
    meta('servico', 'payload_servico'), meta('nome_artista_servico', 'payload_servico'),
    meta('descricao', 'payload_servico'), meta('data_entrada', 'payload_servico'),
    // origemLead é coluna própria (origem_lead), não uma chave dentro de
    // dados_internos_crm — declará-la como meta() fazia o SELECT trazer o
    // jsonb inteiro sob esse alias (descartado na exportação por não ser
    // escalar) em vez do valor real da coluna.
    col('origem_lead'), meta('campanha_marketing', 'dados_internos_crm'),
    meta('responsavel', 'dados_internos_crm'), meta('prioridade', 'dados_internos_crm'),
    meta('proximoFollowUp', 'dados_internos_crm'), meta('valorEstimado', 'dados_internos_crm'),
    meta('temperatura', 'dados_internos_crm'), meta('statusLead', 'dados_internos_crm'),
    ro('uploads'),
    // tags é coluna própria (text[]) do lead, sem input no formulário
    // (gerida fora do DTO) — somente exportação.
    ro('tags'),
  ],
  excludedFormFields: {
    phone: 'campo legado do DTO sem input no formulário real (telefone/WhatsApp usa o campo whatsapp)',
    source: 'campo legado do DTO (pipeline genérico) sem input no formulário real',
    stage: 'campo legado do DTO (pipeline genérico) sem input no formulário real',
    value: 'campo legado do DTO (pipeline genérico) sem input no formulário real',
    assignedTo: 'campo legado do DTO (pipeline genérico) sem input no formulário real',
    notes: 'campo legado do DTO (pipeline genérico) sem input no formulário real',
    metadata: 'objeto jsonb legado (pipeline genérico) sem input no formulário real',
    nomeArtistico: 'aceito pelo DTO mas sem input no formulário real de Leads',
    payloadServico: 'objeto jsonb bruto — os campos individuais já são colunas do contrato',
    dadosInternosCRM: 'objeto jsonb bruto — os campos individuais já são colunas do contrato',
    pais: 'fixado em "Brasil" pelo formulário — não é um input do usuário',
  },
  formFieldAliases: {
    name: 'nome',
    tipoCliente: 'tipo_cliente',
    tipoServico: 'tipo_servico',
  },
};

// ─── Tarefas (marketing_tasks) ───────────────────────────────────────────────
// A única tela real de Criar/Editar/Visualizar de tarefas é Marketing >
// Tarefas — ver nota em report-module-registry.ts sobre por que "Tarefas"
// aponta para marketing_tasks e não operational_tasks (que não tem tela).
const MARKETING_TASKS_CONTRACT: ReportFormContract = {
  tableName: 'marketing_tasks',
  identityColumn: 'title',
  fields: [
    col('title'), col('marketing_project_id'), meta('targetType'), meta('targetName'),
    meta('sector'), col('kind'), col('assigned_to'), col('priority'), col('due_date'),
    col('status'), col('description'),
  ],
  excludedFormFields: {
    dependencies: 'aceito pelo DTO mas sem input no formulário (Tarefas.tsx)',
    metrics: 'aceito pelo DTO mas sem input no formulário',
    metadata: 'objeto jsonb bruto — os campos individuais (targetType/targetName/sector) já são colunas do contrato',
  },
  formFieldAliases: {
    marketingProjectId: 'marketing_project_id',
    assignedTo: 'assigned_to',
    dueDate: 'due_date',
  },
};

// ─── Calendário de Conteúdo (marketing_content_posts) ────────────────────────
const MARKETING_CONTENT_POSTS_CONTRACT: ReportFormContract = {
  tableName: 'marketing_content_posts',
  identityColumn: 'title',
  fields: [
    col('title'), col('target_type'), col('target_name'), col('channel'),
    col('content_type'), col('status'), col('publish_date'), col('publish_time'),
    col('copy'), col('notes'), col('campaign_id'), ro('files'),
  ],
  excludedFormFields: {
    owner: 'valor fixo "Marketing" definido pelo formulário — não é um input do usuário',
    format: 'derivado automaticamente de plataforma+type — não é um input do usuário',
    releaseId: 'aceito pelo DTO mas sem controle de UI nesta tela',
    metadata: 'objeto jsonb interno — hashtags/localização são mescladas em notes pelo próprio formulário, sem colunas próprias',
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

// ─── Briefing (genérico, marketing) ──────────────────────────────────────────
// Correção Parte 89 (briefings.service.ts): o DTO usava nomes em inglês
// (title/content/campaignId/dueAt) que nunca chegavam às colunas físicas reais
// (title/descricao/campaign_id/prazo) — bug de mapeamento corrigido para que
// este contrato seja utilizável. Os campos "avançados" (objetivo, contexto,
// público-alvo etc., presentes só no Editar) vivem na coluna `metadata`
// genérica.
const BRIEFINGS_CONTRACT: ReportFormContract = {
  tableName: 'briefings',
  identityColumn: 'title',
  fields: [
    col('title'), col('descricao'), col('campaign_id'), col('prazo'), col('status'),
    meta('type'), meta('owners'), meta('objective'), meta('context'), meta('audience'),
    meta('positioning'), meta('tone'), meta('requirements'), meta('creativeDirection'),
    meta('references'), meta('visualGuidelines'), meta('textGuidelines'), meta('market'),
    meta('competitors'), meta('trends'), meta('channels'), meta('restrictions'),
    meta('resources'), meta('expectations'), meta('deliverables'), meta('timeline'),
    meta('executionPlan'), meta('aiRecommendations'),
  ],
  excludedFormFields: {
    objectives: 'aceito pelo DTO mas sem input em nenhuma tela do formulário',
    metadata: 'objeto jsonb interno bruto — os campos individuais (objective, context, audience, etc.) já são colunas do contrato',
  },
  formFieldAliases: {
    title: 'title',
    content: 'descricao',
    campaignId: 'campaign_id',
    dueAt: 'prazo',
  },
};

// ─── Contabilidade (relatório computado, sem tabela física — Bloco 19) ────────
// P&L por artista, agregado sobre `transactions` — mesma lógica da aba
// "P&L por Artista" de Contabilidade.tsx. Export-only (nenhum campo
// importável): não é um formulário editável, é um relatório calculado.
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

/** key → coluna jsonb física onde vive (default 'metadata' quando `physical` não foi informado). */
export function contractMetadataFields(contract: ReportFormContract): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of contract.fields) {
    if (f.storage === 'metadata') out[f.key] = f.physical ?? 'metadata';
  }
  return out;
}

