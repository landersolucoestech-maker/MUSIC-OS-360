/**
 * Marketing technical vocabulary (technical = English, UX = PT-BR; the web
 * renders the PT-BR labels).
 *
 * Canonical values are the persisted values: they match the CHECK constraints
 * of `marketing_tasks` (chk_marketing_tasks_status / chk_marketing_tasks_priority).
 * The legacy maps below only translate deprecated INPUT from a web build
 * released before the vocabulary was canonicalized (that build sent its UI
 * vocabulary straight to the API, which the database rejected). They are the
 * only place that knows the Portuguese spellings; responses are canonical only.
 */

/**
 * `backlog` is a distinct persisted state (not an alias of `pending`): the task
 * board has it as its own first column next to "to do" (`pending`), and the
 * dashboard KPI counts both explicitly. Added to the CHECK by migration
 * 20260929000001_AddBacklogToMarketingTaskStatusCheck.
 */
export const MARKETING_TASK_STATUSES = [
  'backlog',
  'pending',
  'in_progress',
  'review',
  'blocked',
  'done',
  'cancelled',
] as const;
export type MarketingTaskStatus = (typeof MARKETING_TASK_STATUSES)[number];

export const MARKETING_TASK_PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;
export type MarketingTaskPriority = (typeof MARKETING_TASK_PRIORITIES)[number];

/** Status that stamps `completed_at`. */
export const MARKETING_TASK_DONE_STATUS: MarketingTaskStatus = 'done';

export const LEGACY_MARKETING_TASK_STATUSES: Readonly<Record<string, MarketingTaskStatus>> = {
  a_fazer: 'pending',
  em_andamento: 'in_progress',
  revisao: 'review',
  bloqueada: 'blocked',
  concluida: 'done',
};

export const LEGACY_MARKETING_TASK_PRIORITIES: Readonly<Record<string, MarketingTaskPriority>> = {
  baixa: 'low',
  media: 'normal',
  alta: 'high',
  urgente: 'urgent',
};

function canonical(map: Readonly<Record<string, string>>, value: unknown): unknown {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(map, value) ? map[value] : value;
}

/** class-transformer @Transform: maps a deprecated Portuguese task status before validation. */
export const canonicalMarketingTaskStatus = ({ value }: { value: unknown }) =>
  canonical(LEGACY_MARKETING_TASK_STATUSES, value);

/** class-transformer @Transform: maps a deprecated Portuguese task priority before validation. */
export const canonicalMarketingTaskPriority = ({ value }: { value: unknown }) =>
  canonical(LEGACY_MARKETING_TASK_PRIORITIES, value);

// ─── Content calendar (marketing_content_posts) ─────────────────────────────

/**
 * Persisted lifecycle of a content post (chk_marketing_content_posts_status).
 * The web pipeline stages idea / production / review were never persistable
 * (the DTO rejected them) and `late` is derived from the schedule, never
 * stored: neither belongs to this list.
 */
export const MARKETING_CONTENT_STATUSES = ['draft', 'scheduled', 'published', 'cancelled', 'failed'] as const;
export type MarketingContentStatus = (typeof MARKETING_CONTENT_STATUSES)[number];

export const MARKETING_CONTENT_STATUS = {
  DRAFT: 'draft',
  SCHEDULED: 'scheduled',
  PUBLISHED: 'published',
  CANCELLED: 'cancelled',
  FAILED: 'failed',
} as const satisfies Record<string, MarketingContentStatus>;

/** Who the content is about (chk_marketing_content_posts_target_type). */
export const MARKETING_CONTENT_TARGET_TYPES = ['music_project', 'artist', 'company'] as const;
export type MarketingContentTargetType = (typeof MARKETING_CONTENT_TARGET_TYPES)[number];

/** Publication format (chk_marketing_content_posts_content_type). */
export const MARKETING_CONTENT_TYPES = [
  'post',
  'feed',
  'stories',
  'reels',
  'shorts',
  'video',
  'carousel',
  'ad',
  'social_media',
  'institutional',
  'commercial',
  'artist',
  'behind_the_scenes',
  'meeting',
  'event',
  'portal',
  'blog',
  'advertising',
] as const;
export type MarketingContentType = (typeof MARKETING_CONTENT_TYPES)[number];

export const LEGACY_MARKETING_CONTENT_STATUSES: Readonly<Record<string, MarketingContentStatus>> = {
  rascunho: 'draft',
  agendado: 'scheduled',
  publicado: 'published',
  cancelado: 'cancelled',
  falhou: 'failed',
};

export const LEGACY_MARKETING_CONTENT_TARGET_TYPES: Readonly<Record<string, MarketingContentTargetType>> = {
  projeto_musical: 'music_project',
  artista: 'artist',
  empresa: 'company',
};

export const LEGACY_MARKETING_CONTENT_TYPES: Readonly<Record<string, MarketingContentType>> = {
  carrossel: 'carousel',
  anuncio: 'ad',
  rede_social: 'social_media',
  institucional: 'institutional',
  comercial: 'commercial',
  artista: 'artist',
  bastidores: 'behind_the_scenes',
  reuniao: 'meeting',
  evento: 'event',
  publicidade: 'advertising',
};

/** class-transformer @Transform: maps a deprecated Portuguese content status before validation. */
export const canonicalMarketingContentStatus = ({ value }: { value: unknown }) =>
  canonical(LEGACY_MARKETING_CONTENT_STATUSES, value);

/** class-transformer @Transform: maps a deprecated Portuguese content target type before validation. */
export const canonicalMarketingContentTargetType = ({ value }: { value: unknown }) =>
  canonical(LEGACY_MARKETING_CONTENT_TARGET_TYPES, value);

/** class-transformer @Transform: maps a deprecated Portuguese content type before validation. */
export const canonicalMarketingContentType = ({ value }: { value: unknown }) =>
  canonical(LEGACY_MARKETING_CONTENT_TYPES, value);

/**
 * Approval state of a content, stored in `marketing_content_posts.metadata.approval`
 * (jsonb, no column) and restricted by chk_marketing_content_posts_metadata_approval.
 * Same words as the asset-approval decisions (marketing-assets.dto.ts).
 */
export const MARKETING_CONTENT_APPROVALS = ['pending', 'approved', 'rejected', 'revision_requested'] as const;
export type MarketingContentApproval = (typeof MARKETING_CONTENT_APPROVALS)[number];

export const LEGACY_MARKETING_CONTENT_APPROVALS: Readonly<Record<string, MarketingContentApproval>> = {
  pendente: 'pending',
  aprovado: 'approved',
  reprovado: 'rejected',
  ajustes_solicitados: 'revision_requested',
};

/**
 * class-transformer @Transform: maps a deprecated Portuguese `metadata.approval`
 * (sent by a web build released before the vocabulary was canonicalized) and
 * the deprecated Portuguese `metadata.channels` entries (MK2) before validation.
 * Anything that is not a plain object, or holds no legacy spelling, passes
 * through untouched for the validator to judge.
 */
export const canonicalMarketingContentMetadata = ({ value }: { value: unknown }) => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return value;
  const record = value as Record<string, unknown>;
  let out: Record<string, unknown> | null = null;
  const approval = record.approval;
  if (typeof approval === 'string' && Object.prototype.hasOwnProperty.call(LEGACY_MARKETING_CONTENT_APPROVALS, approval)) {
    out = { ...record, approval: LEGACY_MARKETING_CONTENT_APPROVALS[approval] };
  }
  if (Array.isArray(record.channels) && record.channels.some((c) => typeof c === 'string' && Object.prototype.hasOwnProperty.call(LEGACY_MARKETING_CHANNELS, c))) {
    out = { ...(out ?? record), channels: record.channels.map((c) => (typeof c === 'string' && Object.prototype.hasOwnProperty.call(LEGACY_MARKETING_CHANNELS, c) ? LEGACY_MARKETING_CHANNELS[c] : c)) };
  }
  return out ?? value;
};

// ─── MK2: marketing machine vocabulary persisted in jsonb / free varchar ──────

/**
 * Vocabulary of the values the marketing module persists OUTSIDE a typed column
 * (tasks.kind, metadata.uiType/uiStatus/targetType/channels/type, the campaign
 * builder payload, AI suggestion blobs). Canonical = English; the Portuguese
 * spellings below are what the web wrote before migration 20260930000026. The
 * API maps them on INPUT (class-transformer @Transform before validation / service
 * canonicalization) and on the reads it reshapes (campaign builder, AI suggestions);
 * the migration backfills the persisted rows; everything written is canonical.
 * Removal condition: the census in findings/marketing-mk2.md returns 0 in every
 * environment and no web build older than the MK2 release is still served.
 */

/** Who a task / campaign / AI suggestion is about (same words as marketing_content_posts.target_type). */
export const MARKETING_TARGETS = ['music_project', 'artist', 'company'] as const;

/** Deprecated Portuguese target. */
export const LEGACY_MARKETING_TARGETS: Readonly<Record<string, string>> = {
  projeto_musical: 'music_project',
  artista: 'artist',
  empresa: 'company',
};

/** marketing_projects.metadata.uiType (web UI project type). */
export const LEGACY_MARKETING_PROJECT_UI_TYPES: Readonly<Record<string, string>> = {
  lancamento_musical: 'music_release',
  videoclipe: 'music_video',
  campanha_institucional: 'institutional_campaign',
  campanha_promocional: 'promotional_campaign',
  evento: 'event',
  conteudo_corporativo: 'corporate_content',
  bastidores: 'behind_the_scenes',
  reuniao: 'meeting',
  divulgacao_produto: 'product_promotion',
  divulgacao_servico: 'service_promotion',
  divulgacao_saas: 'saas_promotion',
  comunicacao_interna: 'internal_communication',
  comunicacao_externa: 'external_communication',
  portal_noticias: 'news_portal',
  projeto_especial: 'special_project',
};

/** marketing_projects.metadata.uiStatus (web UI project status). */
export const LEGACY_MARKETING_PROJECT_UI_STATUSES: Readonly<Record<string, string>> = {
  planejamento: 'planning',
  em_andamento: 'active',
  pausado: 'paused',
  concluido: 'completed',
  cancelado: 'cancelled',
};

/** Campaign builder payload.type (web campaign type). */
export const LEGACY_MARKETING_CAMPAIGN_TYPES: Readonly<Record<string, string>> = {
  institucional: 'institutional',
  comercial: 'commercial',
  artistica: 'artistic',
  promocional: 'promotional',
  lancamento_musical: 'music_release',
  produto: 'product',
  servico: 'service',
  evento: 'event',
  conteudo: 'content',
  trafego_pago: 'paid_traffic',
  organica: 'organic',
};

/** briefings.metadata.type (web briefing type). */
export const LEGACY_MARKETING_BRIEFING_TYPES: Readonly<Record<string, string>> = {
  campanha: 'campaign',
  conteudo: 'content',
  institucional: 'institutional',
  comercial: 'commercial',
  artistico: 'artistic',
  evento: 'event',
  produto: 'product',
  servico: 'service',
  portal_noticias: 'news_portal',
  bastidores: 'behind_the_scenes',
};

/** Content channel values that were Portuguese (metadata.channels / payload.platforms lists). */
export const LEGACY_MARKETING_CHANNELS: Readonly<Record<string, string>> = {
  portal_noticias: 'news_portal',
  campanha: 'campaign',
  material_publicitario: 'advertising_material',
  evento_interno: 'internal_event',
  evento_externo: 'external_event',
  reuniao: 'meeting',
  bastidores: 'behind_the_scenes',
};

/** marketing_tasks.kind and metadata.uiType (web task type). */
export const LEGACY_MARKETING_TASK_KINDS: Readonly<Record<string, string>> = {
  publicacao: 'publishing',
  campanha: 'campaign',
  planejamento: 'planning',
  aprovacao: 'approval',
  revisao: 'review',
  analise: 'analysis',
  reuniao: 'meeting',
  bastidor: 'behind_the_scenes_shot',
  conteudo_institucional: 'institutional_content',
  conteudo_comercial: 'commercial_content',
  conteudo_artistico: 'artistic_content',
  trafego_pago: 'paid_traffic',
  capa: 'cover',
  arte_redes_sociais: 'social_media_art',
  identidade_visual: 'visual_identity',
  material_promocional: 'promotional_material',
  videoclipe: 'music_video',
  video_redes_sociais: 'social_media_video',
  bastidores: 'behind_the_scenes',
  entrevista: 'interview',
  captacao_evento: 'event_coverage',
  prospeccao: 'prospecting',
  negociacao: 'negotiation',
  relacionamento: 'relationship',
  planejamento_lancamento: 'release_planning',
  material_institucional: 'institutional_material',
  apresentacao_comercial: 'commercial_presentation',
  video_institucional: 'institutional_video',
  bastidores_empresa: 'company_behind_the_scenes',
  cobertura_evento_corporativo: 'corporate_event_coverage',
  entrevista_corporativa: 'corporate_interview',
  campanha_institucional: 'institutional_campaign',
  posicionamento_marca: 'brand_positioning',
  comunicados: 'announcements',
  relacionamento_parceiros: 'partner_relationship',
  parcerias: 'partnerships',
  planejamento_carreira: 'career_planning',
  gestao_agenda: 'schedule_management',
  planejamento_estrategico: 'strategic_planning',
  assessoria_imprensa: 'press_relations',
  branding_pessoal: 'personal_branding',
  posicionamento: 'positioning',
  estrategias_crescimento: 'growth_strategies',
  sessao_fotos: 'photo_session',
  conteudo_redes_sociais: 'social_media_content',
  contratacoes: 'contracting',
  arte_divulgacao: 'promotional_art',
  conteudo_lancamento: 'release_content',
  distribuicao: 'distribution',
  campanha_lancamento: 'release_campaign',
  divulgacao: 'promotion',
  influenciadores: 'influencers',
  aprovacao_conteudo: 'content_approval',
};

/** AI suggestion kind (activity_logs.metadata.kind, entity_type marketing_ai). */
export const LEGACY_MARKETING_AI_KINDS: Readonly<Record<string, string>> = {
  analise_fonograma: 'phonogram_analysis',
  analise_letra: 'lyrics_analysis',
  planejamento_campanha: 'campaign_planning',
  sugestao_conteudo: 'content_suggestion',
  legenda: 'caption',
  roteiro: 'script',
  analise_artista: 'artist_analysis',
  analise_marca: 'brand_analysis',
  analise_empresa: 'company_analysis',
  pitch_playlist: 'playlist_pitch',
  pitch_imprensa: 'press_pitch',
  posicionamento: 'positioning',
  calendario_editorial: 'editorial_calendar',
  conteudo_bastidores: 'behind_the_scenes_content',
  conteudo_corporativo: 'corporate_content',
};

type Json = Record<string, unknown>;
const isPlainObject = (value: unknown): value is Json => value !== null && typeof value === 'object' && !Array.isArray(value);
const own = (map: object, key: string): boolean => Object.prototype.hasOwnProperty.call(map, key);

/** Exact-match legacy -> canonical for one string; any other value (canonical, unknown, non-string) is returned untouched. */
export function mapLegacyMarketingValue(map: Readonly<Record<string, string>>, value: unknown): unknown {
  return typeof value === 'string' && own(map, value) ? map[value] : value;
}

function mapLegacyList(map: Readonly<Record<string, string>>, value: unknown): unknown {
  return Array.isArray(value) ? value.map((entry) => mapLegacyMarketingValue(map, entry)) : value;
}

/**
 * Copy of `metadata` with the listed keys mapped; the SAME object when nothing changes
 * (so callers can detect a no-op). Non-objects pass through for the validator to judge.
 */
function mapKeys(metadata: unknown, keys: Readonly<Record<string, (value: unknown) => unknown>>): unknown {
  if (!isPlainObject(metadata)) return metadata;
  let out: Json | null = null;
  for (const [key, fn] of Object.entries(keys)) {
    if (!own(metadata, key)) continue;
    const mapped = fn(metadata[key]);
    if (JSON.stringify(mapped) !== JSON.stringify(metadata[key])) {
      out = out ?? { ...metadata };
      out[key] = mapped;
    }
  }
  return out ?? metadata;
}

/** Campaign `promotedEntityType` is stored upper-case (MUSIC_PROJECT / ARTIST / COMPANY, the campaign-builder entity types): a legacy spelling (PROJETO_MUSICAL / ARTISTA / EMPRESA, or the lower-case slug) maps to the upper-case canonical one. */
const campaignEntityType = (value: unknown): unknown => {
  if (typeof value !== 'string') return value;
  if (own(LEGACY_MARKETING_TARGETS, value)) return LEGACY_MARKETING_TARGETS[value].toUpperCase();
  const lower = value.toLowerCase();
  return value === value.toUpperCase() && own(LEGACY_MARKETING_TARGETS, lower) ? LEGACY_MARKETING_TARGETS[lower].toUpperCase() : value;
};

/** class-transformer @Transform: deprecated Portuguese task kind -> canonical (kind stays free-form: the API itself writes cover_art, strategy_action, ...). */
export const canonicalMarketingTaskKind = ({ value }: { value: unknown }) => mapLegacyMarketingValue(LEGACY_MARKETING_TASK_KINDS, value);

/** @Transform of a task `metadata`: targetType + uiType. */
export const canonicalMarketingTaskMetadata = ({ value }: { value: unknown }) =>
  mapKeys(value, {
    targetType: (v) => mapLegacyMarketingValue(LEGACY_MARKETING_TARGETS, v),
    uiType: (v) => mapLegacyMarketingValue(LEGACY_MARKETING_TASK_KINDS, v),
  });

/** @Transform of a project `metadata`: uiType + uiStatus + channels. */
export const canonicalMarketingProjectMetadata = ({ value }: { value: unknown }) =>
  mapKeys(value, {
    uiType: (v) => mapLegacyMarketingValue(LEGACY_MARKETING_PROJECT_UI_TYPES, v),
    uiStatus: (v) => mapLegacyMarketingValue(LEGACY_MARKETING_PROJECT_UI_STATUSES, v),
    channels: (v) => mapLegacyList(LEGACY_MARKETING_CHANNELS, v),
  });

/** @Transform of a briefing `metadata`: type + channels. */
export const canonicalMarketingBriefingMetadata = ({ value }: { value: unknown }) =>
  mapKeys(value, {
    type: (v) => mapLegacyMarketingValue(LEGACY_MARKETING_BRIEFING_TYPES, v),
    channels: (v) => mapLegacyList(LEGACY_MARKETING_CHANNELS, v),
  });

/** Campaign builder payload (service-level: the controller body is a type alias, not a validated class): promotedEntityType + type + platforms. */
export function canonicalMarketingCampaignPayload<T extends object>(payload: T): T {
  return mapKeys(payload, {
    promotedEntityType: campaignEntityType,
    type: (v) => mapLegacyMarketingValue(LEGACY_MARKETING_CAMPAIGN_TYPES, v),
    platforms: (v) => mapLegacyList(LEGACY_MARKETING_CHANNELS, v),
  }) as T;
}

/** AI suggestion blob (service-level: free-form body): kind + targetType + channels. */
export function canonicalMarketingAiSuggestion<T extends object>(suggestion: T): T {
  return mapKeys(suggestion, {
    kind: (v) => mapLegacyMarketingValue(LEGACY_MARKETING_AI_KINDS, v),
    targetType: (v) => mapLegacyMarketingValue(LEGACY_MARKETING_TARGETS, v),
    channels: (v) => mapLegacyList(LEGACY_MARKETING_CHANNELS, v),
  }) as T;
}

/** class-transformer @Transform for the free-form AI fields `kind` / `targetType` of the marketing suggestion endpoint. */
export const canonicalMarketingAiKind = ({ value }: { value: unknown }) => mapLegacyMarketingValue(LEGACY_MARKETING_AI_KINDS, value);
export const canonicalMarketingTarget = ({ value }: { value: unknown }) => mapLegacyMarketingValue(LEGACY_MARKETING_TARGETS, value);
