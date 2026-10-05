/**
 * Deprecated Portuguese marketing vocabulary (READ side only).
 *
 * Before the technical-language canonicalization the web stored its UI
 * vocabulary as-is: marketing PROJECT rows persisted `priority` as
 * baixa/media/alta/urgente (and kept the same word again in
 * `metadata.uiPriority`). Those rows are still in the database, so the
 * projects reader must translate them to the canonical English `Priority`.
 * This is the only place in the web that knows the Portuguese spellings;
 * nothing ever writes them.
 *
 * Content approval follows the same rule: `marketing_content_posts.metadata.approval`
 * held pendente/aprovado/reprovado/ajustes_solicitados; migration
 * 20260930000003 backfills and restricts it, but a web/API build released
 * before that migration can still write the old spellings until it is drained,
 * so the reader accepts them.
 *
 * MK2 (marketing vocabulary): the rest of the marketing machine vocabulary (target,
 * project type/status, campaign type/status, briefing type, content channel, task
 * kind, AI kind, automation flow, creative status) is canonical English too. Rows
 * persisted before migration 20260930000026 (metadata.uiType/uiStatus/targetType,
 * tasks.kind, campaign payload type/promotedEntityType/platforms, briefing
 * metadata.type/channels, AI suggestion kind/targetType/channels) and responses of
 * a not yet migrated API still carry the Portuguese spelling, so EVERY reader goes
 * through the canonical* functions below; nothing ever writes a Portuguese value.
 *
 * Removal: delete once marketing_projects.priority / metadata.uiPriority are
 * backfilled to the canonical values, and once no pre-20260930000003 build
 * can write metadata.approval (tracked in the naming ledger).
 */
import type {
  AiTaskKind,
  ApprovalStatus,
  AssetCategory,
  BriefingType,
  CampaignStatus,
  CampaignType,
  ContentChannel,
  MarketingTarget,
  Priority,
  ProjectStatus,
  ProjectType,
  TaskType,
} from "../types/marketing.types";

export const LEGACY_PRIORITY_TO_CANONICAL: Readonly<Record<string, Priority>> = {
  baixa: "low",
  media: "normal",
  alta: "high",
  urgente: "urgent",
};

const CANONICAL_PRIORITIES: ReadonlySet<string> = new Set<Priority>(["low", "normal", "high", "urgent"]);

/**
 * Canonical priority for a persisted/legacy value. An unknown value is a
 * contract violation, not something to guess: it throws instead of silently
 * becoming "normal".
 */
export function canonicalPriority(value: unknown): Priority {
  if (typeof value === "string") {
    if (CANONICAL_PRIORITIES.has(value)) return value as Priority;
    if (Object.prototype.hasOwnProperty.call(LEGACY_PRIORITY_TO_CANONICAL, value)) return LEGACY_PRIORITY_TO_CANONICAL[value];
  }
  throw new Error(`[marketing] unknown priority received from the API: ${String(value)}`);
}

export const LEGACY_APPROVAL_TO_CANONICAL: Readonly<Record<string, ApprovalStatus>> = {
  aprovado: "approved",
  reprovado: "rejected",
  ajustes_solicitados: "revision_requested",
};

const CANONICAL_APPROVALS: ReadonlySet<string> = new Set<ApprovalStatus>(["pending", "approved", "rejected", "revision_requested"]);

/**
 * Canonical approval for a persisted/legacy value. Degrades per row: an
 * unknown, empty or non-string value reads as "pending" (the same reading as a
 * missing key) so one bad row cannot break a whole list. The raw value is never
 * surfaced; the API/CHECK constraint is what keeps such values from existing.
 */
export function canonicalApproval(value: unknown): ApprovalStatus {
  if (typeof value === "string") {
    if (CANONICAL_APPROVALS.has(value)) return value as ApprovalStatus;
    if (Object.prototype.hasOwnProperty.call(LEGACY_APPROVAL_TO_CANONICAL, value)) return LEGACY_APPROVAL_TO_CANONICAL[value];
  }
  return "pending";
}

/**
 * Campaign status. The campaign-builder API returns the upper-case English
 * lifecycle (DRAFT/ACTIVE/...); the web used to compare Portuguese slugs
 * (ativa/rascunho/...), so counts read 0 (R2-01). The canonical web value is the
 * lower-cased API value; the Portuguese spellings are accepted on read only.
 */
export const LEGACY_CAMPAIGN_STATUS_TO_CANONICAL: Readonly<Record<string, CampaignStatus>> = {
  agendada: "scheduled",
  ativa: "active",
  pausada: "paused",
  concluida: "completed",
  cancelada: "cancelled",
};

const CANONICAL_CAMPAIGN_STATUSES: ReadonlySet<string> = new Set<CampaignStatus>([
  "draft", "ready", "pending_review", "scheduled", "active", "paused", "rejected", "completed", "failed", "archived", "cancelled",
]);

/** Canonical campaign status; an absent/unknown value reads as "draft" (the creation state). */
export function canonicalCampaignStatus(value: unknown): CampaignStatus {
  if (typeof value === "string") {
    const key = value.trim().toLowerCase();
    if (CANONICAL_CAMPAIGN_STATUSES.has(key)) return key as CampaignStatus;
    if (Object.prototype.hasOwnProperty.call(LEGACY_CAMPAIGN_STATUS_TO_CANONICAL, key)) return LEGACY_CAMPAIGN_STATUS_TO_CANONICAL[key];
  }
  return "draft";
}

// ---------------------------------------------------------------------------
// MK2: marketing machine vocabulary (legacy Portuguese -> canonical English)
// ---------------------------------------------------------------------------

const hasOwn = (map: object, key: string): boolean => Object.prototype.hasOwnProperty.call(map, key);

/** Canonical value of `value`: already canonical, or exact-match legacy; anything else is `undefined` (never guessed). */
function resolve<T extends string>(
  value: unknown,
  canonical: ReadonlySet<string>,
  legacy: Readonly<Record<string, T>>,
): T | undefined {
  if (typeof value !== "string") return undefined;
  if (canonical.has(value)) return value as T;
  return hasOwn(legacy, value) ? legacy[value] : undefined;
}

/** `MarketingTarget` (tasks metadata.targetType, campaign promotedEntityType, AI suggestion targetType). */
export const LEGACY_MARKETING_TARGET_TO_CANONICAL: Readonly<Record<string, MarketingTarget>> = {
  projeto_musical: "music_project",
  artista: "artist",
  empresa: "company",
};

const CANONICAL_TARGETS: ReadonlySet<string> = new Set<MarketingTarget>(["music_project", "artist", "company"]);

/** Canonical target; upper-case wire spellings (campaign promotedEntityType MUSIC_PROJECT/ARTIST/COMPANY) are accepted. */
export function canonicalMarketingTarget(value: unknown): MarketingTarget | undefined {
  if (typeof value !== "string") return undefined;
  const exact = resolve(value, CANONICAL_TARGETS, LEGACY_MARKETING_TARGET_TO_CANONICAL);
  if (exact || value !== value.toUpperCase()) return exact;
  return resolve(value.toLowerCase(), CANONICAL_TARGETS, LEGACY_MARKETING_TARGET_TO_CANONICAL);
}

/** `ProjectType` (marketing_projects.metadata.uiType). */
export const LEGACY_PROJECT_TYPE_TO_CANONICAL: Readonly<Record<string, ProjectType>> = {
  lancamento_musical: "music_release",
  videoclipe: "music_video",
  campanha_institucional: "institutional_campaign",
  campanha_promocional: "promotional_campaign",
  evento: "event",
  conteudo_corporativo: "corporate_content",
  bastidores: "behind_the_scenes",
  reuniao: "meeting",
  divulgacao_produto: "product_promotion",
  divulgacao_servico: "service_promotion",
  divulgacao_saas: "saas_promotion",
  comunicacao_interna: "internal_communication",
  comunicacao_externa: "external_communication",
  portal_noticias: "news_portal",
  projeto_especial: "special_project",
};

const CANONICAL_PROJECT_TYPES: ReadonlySet<string> = new Set<ProjectType>([
  "music_release", "music_video", "audiovisual", "institutional_campaign", "promotional_campaign", "event", "corporate_content", "behind_the_scenes", "meeting", "product_promotion", "service_promotion", "saas_promotion", "internal_communication", "external_communication", "news_portal", "special_project",
]);
export const canonicalProjectType = (value: unknown): ProjectType | undefined =>
  resolve(value, CANONICAL_PROJECT_TYPES, LEGACY_PROJECT_TYPE_TO_CANONICAL);

/** `ProjectStatus` (marketing_projects.metadata.uiStatus). */
export const LEGACY_PROJECT_STATUS_TO_CANONICAL: Readonly<Record<string, ProjectStatus>> = {
  planejamento: "planning",
  em_andamento: "active",
  pausado: "paused",
  concluido: "completed",
  cancelado: "cancelled",
};

const CANONICAL_PROJECT_STATUSES: ReadonlySet<string> = new Set<ProjectStatus>(["draft", "planning", "active", "paused", "completed", "cancelled", "archived"]);
export const canonicalProjectStatus = (value: unknown): ProjectStatus | undefined =>
  resolve(value, CANONICAL_PROJECT_STATUSES, LEGACY_PROJECT_STATUS_TO_CANONICAL);

/** `CampaignType` (campaign builder payload.type). */
export const LEGACY_CAMPAIGN_TYPE_TO_CANONICAL: Readonly<Record<string, CampaignType>> = {
  institucional: "institutional",
  comercial: "commercial",
  artistica: "artistic",
  promocional: "promotional",
  lancamento_musical: "music_release",
  produto: "product",
  servico: "service",
  evento: "event",
  conteudo: "content",
  trafego_pago: "paid_traffic",
  organica: "organic",
};

const CANONICAL_CAMPAIGN_TYPES: ReadonlySet<string> = new Set<CampaignType>([
  "institutional", "commercial", "artistic", "promotional", "music_release", "product", "service", "saas", "event", "content", "branding", "paid_traffic", "organic",
]);
export const canonicalCampaignType = (value: unknown): CampaignType | undefined =>
  resolve(value, CANONICAL_CAMPAIGN_TYPES, LEGACY_CAMPAIGN_TYPE_TO_CANONICAL);

/** `BriefingType` (briefings.metadata.type). */
export const LEGACY_BRIEFING_TYPE_TO_CANONICAL: Readonly<Record<string, BriefingType>> = {
  campanha: "campaign",
  conteudo: "content",
  institucional: "institutional",
  comercial: "commercial",
  artistico: "artistic",
  evento: "event",
  produto: "product",
  servico: "service",
  portal_noticias: "news_portal",
  bastidores: "behind_the_scenes",
};

const CANONICAL_BRIEFING_TYPES: ReadonlySet<string> = new Set<BriefingType>([
  "campaign", "content", "design", "audiovisual", "institutional", "commercial", "artistic", "event", "product", "service", "saas", "news_portal", "behind_the_scenes",
]);
export const canonicalBriefingType = (value: unknown): BriefingType | undefined =>
  resolve(value, CANONICAL_BRIEFING_TYPES, LEGACY_BRIEFING_TYPE_TO_CANONICAL);

/** `ContentChannel` values that were Portuguese (metadata.channels / campaign platforms / briefing channels). */
export const LEGACY_CONTENT_CHANNEL_TO_CANONICAL: Readonly<Record<string, ContentChannel>> = {
  portal_noticias: "news_portal",
  campanha: "campaign",
  material_publicitario: "advertising_material",
  evento_interno: "internal_event",
  evento_externo: "external_event",
  reuniao: "meeting",
  bastidores: "behind_the_scenes",
};

const CANONICAL_CONTENT_CHANNELS: ReadonlySet<string> = new Set<ContentChannel>([
  "instagram", "facebook", "tiktok", "youtube", "twitter", "threads", "linkedin", "shorts", "reels", "stories", "blog", "news_portal",
  "podcast", "campaign", "advertising_material", "internal_event", "external_event", "meeting", "behind_the_scenes",
]);
export const canonicalContentChannel = (value: unknown): ContentChannel | undefined =>
  resolve(value, CANONICAL_CONTENT_CHANNELS, LEGACY_CONTENT_CHANNEL_TO_CANONICAL);
/** Canonical channel list; an entry that is neither canonical nor an exact legacy spelling is kept as received (never dropped). */
export function canonicalContentChannels(value: unknown): ContentChannel[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.map((entry) => canonicalContentChannel(entry) ?? (entry as ContentChannel));
}

/** `TaskType` (marketing_tasks.kind and metadata.uiType). */
export const LEGACY_TASK_TYPE_TO_CANONICAL: Readonly<Record<string, TaskType>> = {
  publicacao: "publishing",
  campanha: "campaign",
  planejamento: "planning",
  aprovacao: "approval",
  revisao: "review",
  analise: "analysis",
  reuniao: "meeting",
  bastidor: "behind_the_scenes_shot",
  conteudo_institucional: "institutional_content",
  conteudo_comercial: "commercial_content",
  conteudo_artistico: "artistic_content",
  trafego_pago: "paid_traffic",
  capa: "cover",
  arte_redes_sociais: "social_media_art",
  identidade_visual: "visual_identity",
  material_promocional: "promotional_material",
  videoclipe: "music_video",
  video_redes_sociais: "social_media_video",
  bastidores: "behind_the_scenes",
  entrevista: "interview",
  captacao_evento: "event_coverage",
  prospeccao: "prospecting",
  negociacao: "negotiation",
  relacionamento: "relationship",
  planejamento_lancamento: "release_planning",
  material_institucional: "institutional_material",
  apresentacao_comercial: "commercial_presentation",
  video_institucional: "institutional_video",
  bastidores_empresa: "company_behind_the_scenes",
  cobertura_evento_corporativo: "corporate_event_coverage",
  entrevista_corporativa: "corporate_interview",
  campanha_institucional: "institutional_campaign",
  posicionamento_marca: "brand_positioning",
  comunicados: "announcements",
  relacionamento_parceiros: "partner_relationship",
  parcerias: "partnerships",
  planejamento_carreira: "career_planning",
  gestao_agenda: "schedule_management",
  planejamento_estrategico: "strategic_planning",
  assessoria_imprensa: "press_relations",
  branding_pessoal: "personal_branding",
  posicionamento: "positioning",
  estrategias_crescimento: "growth_strategies",
  sessao_fotos: "photo_session",
  conteudo_redes_sociais: "social_media_content",
  contratacoes: "contracting",
  arte_divulgacao: "promotional_art",
  conteudo_lancamento: "release_content",
  distribuicao: "distribution",
  campanha_lancamento: "release_campaign",
  divulgacao: "promotion",
  influenciadores: "influencers",
  aprovacao_conteudo: "content_approval",
};

/** A task kind outside the web catalog (created by the API itself, e.g. cover_art, strategy_action, or by a tenant) is kept as received. */
export const canonicalTaskType = (value: unknown): TaskType | string =>
  typeof value === "string" && hasOwn(LEGACY_TASK_TYPE_TO_CANONICAL, value) ? LEGACY_TASK_TYPE_TO_CANONICAL[value] : (value as string);

/** `AiTaskKind` (activity_logs.metadata.kind of marketing_ai suggestions). */
export const LEGACY_AI_TASK_KIND_TO_CANONICAL: Readonly<Record<string, AiTaskKind>> = {
  analise_fonograma: "phonogram_analysis",
  analise_letra: "lyrics_analysis",
  planejamento_campanha: "campaign_planning",
  sugestao_conteudo: "content_suggestion",
  legenda: "caption",
  roteiro: "script",
  analise_artista: "artist_analysis",
  analise_marca: "brand_analysis",
  analise_empresa: "company_analysis",
  pitch_playlist: "playlist_pitch",
  pitch_imprensa: "press_pitch",
  posicionamento: "positioning",
  calendario_editorial: "editorial_calendar",
  conteudo_bastidores: "behind_the_scenes_content",
  conteudo_corporativo: "corporate_content",
};

export const canonicalAiTaskKind = (value: unknown): AiTaskKind | string =>
  typeof value === "string" && hasOwn(LEGACY_AI_TASK_KIND_TO_CANONICAL, value) ? LEGACY_AI_TASK_KIND_TO_CANONICAL[value] : (value as string);


/** `AssetCategory` (UI category of a marketing asset; round-tripped in marketing_assets.metadata.category). */
export const LEGACY_ASSET_CATEGORY_TO_CANONICAL: Readonly<Record<string, AssetCategory>> = {
  capa: "cover",
  arte_promocional: "promotional_art",
  identidade_visual: "visual_identity",
  fotografia: "photography",
  documento_estrategico: "strategic_document",
  material_institucional: "institutional_material",
  material_comercial: "commercial_material",
  material_bastidores: "behind_the_scenes_material",
  material_reuniao: "meeting_material",
  arquivo_portal: "portal_file",
  asset_campanha: "campaign_asset",
};

const CANONICAL_ASSET_CATEGORIES: ReadonlySet<string> = new Set<AssetCategory>([
  "cover", "promotional_art", "banner", "logo", "visual_identity", "photography", "reels", "video", "teaser", "shorts", "press_kit", "template", "strategic_document", "institutional_material", "commercial_material", "behind_the_scenes_material", "meeting_material", "portal_file", "campaign_asset",
]);
export const canonicalAssetCategory = (value: unknown): AssetCategory | undefined =>
  resolve(value, CANONICAL_ASSET_CATEGORIES, LEGACY_ASSET_CATEGORY_TO_CANONICAL);

// ── AP3 (R3-02): campaign builder state persisted as JSON in the campaign payload `notes` ────────────
// phase, creatives[].type and budget.strategy (and audience.gender in the in-memory state) were stored
// as Portuguese words. Canonical English now; migration 20260930000028 rewrites stored rows, the readers
// below accept both spellings (canonical wins) until the census is 0.

export type CampaignPhaseValue = "pre_launch" | "launch" | "sustain" | "catalog";
export type CreativeTypeValue = "image" | "video" | "carousel" | "audio" | "text";
export type BudgetStrategyValue = "lowest_cost" | "cost_cap" | "target_cost";
export type AudienceGenderValue = "all" | "female" | "male" | "non_binary" | "not_informed";

export const LEGACY_CAMPAIGN_PHASE_TO_CANONICAL: Readonly<Record<string, CampaignPhaseValue>> = {
  pre_lancamento: "pre_launch",
  lancamento: "launch",
  sustentacao: "sustain",
  catalogo: "catalog",
};
export const LEGACY_CREATIVE_TYPE_TO_CANONICAL: Readonly<Record<string, CreativeTypeValue>> = {
  imagem: "image",
  carrossel: "carousel",
  texto: "text",
};
export const LEGACY_BUDGET_STRATEGY_TO_CANONICAL: Readonly<Record<string, BudgetStrategyValue>> = {
  menor_custo: "lowest_cost",
  limite_custo: "cost_cap",
  custo_alvo: "target_cost",
};
export const LEGACY_AUDIENCE_GENDER_TO_CANONICAL: Readonly<Record<string, AudienceGenderValue>> = {
  todos: "all",
  feminino: "female",
  masculino: "male",
  nao_binario: "non_binary",
  nao_informado: "not_informed",
};

const CANONICAL_CAMPAIGN_PHASES: ReadonlySet<string> = new Set(["pre_launch", "launch", "sustain", "catalog"]);
const CANONICAL_CREATIVE_TYPES: ReadonlySet<string> = new Set(["image", "video", "carousel", "audio", "text"]);
const CANONICAL_BUDGET_STRATEGIES: ReadonlySet<string> = new Set(["lowest_cost", "cost_cap", "target_cost"]);
const CANONICAL_AUDIENCE_GENDERS: ReadonlySet<string> = new Set(["all", "female", "male", "non_binary", "not_informed"]);

export const canonicalCampaignPhase = (value: unknown): CampaignPhaseValue | undefined =>
  resolve(value, CANONICAL_CAMPAIGN_PHASES, LEGACY_CAMPAIGN_PHASE_TO_CANONICAL);
export const canonicalCreativeType = (value: unknown): CreativeTypeValue | undefined =>
  resolve(value, CANONICAL_CREATIVE_TYPES, LEGACY_CREATIVE_TYPE_TO_CANONICAL);
export const canonicalBudgetStrategy = (value: unknown): BudgetStrategyValue | undefined =>
  resolve(value, CANONICAL_BUDGET_STRATEGIES, LEGACY_BUDGET_STRATEGY_TO_CANONICAL);
export const canonicalAudienceGender = (value: unknown): AudienceGenderValue | undefined =>
  resolve(value, CANONICAL_AUDIENCE_GENDERS, LEGACY_AUDIENCE_GENDER_TO_CANONICAL);

/**
 * The campaign payload `notes` is `JSON.stringify` of the builder state (phase, creatives, budget...).
 * Returns the parsed object with phase / creatives[].type / budget.strategy canonical, or null when `notes`
 * is not such a JSON object (free text typed by a user is never touched).
 */
export function parseCampaignBuilderNotes(notes: unknown): Record<string, unknown> | null {
  if (typeof notes !== "string" || !notes.trim().startsWith("{")) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(notes);
  } catch {
    return null;
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const out: Record<string, unknown> = { ...(parsed as Record<string, unknown>) };
  if (typeof out.phase === "string") out.phase = canonicalCampaignPhase(out.phase) ?? out.phase;
  if (Array.isArray(out.creatives)) {
    out.creatives = out.creatives.map((c) =>
      c && typeof c === "object" && typeof (c as { type?: unknown }).type === "string"
        ? { ...(c as object), type: canonicalCreativeType((c as { type: string }).type) ?? (c as { type: string }).type }
        : c,
    );
  }
  const budget = out.budget;
  if (budget && typeof budget === "object" && !Array.isArray(budget) && typeof (budget as { strategy?: unknown }).strategy === "string") {
    out.budget = { ...(budget as object), strategy: canonicalBudgetStrategy((budget as { strategy: string }).strategy) ?? (budget as { strategy: string }).strategy };
  }
  return out;
}

// ── AP3 (R3-03): platform sector + automation flow id ────────────────────────────────────────────────
// `marketing_tasks.metadata.sector` stored the PT-BR LABEL of the platform sector; `metadata.automationFlowId`
// the Portuguese flow id. Migration 20260930000029 rewrites them; readers accept both (canonical wins).
// A sector a tenant typed (any text outside the map) is user content and is returned unchanged.
export const LEGACY_MARKETING_SECTOR_TO_CANONICAL: Readonly<Record<string, string>> = {
  Design: "design",
  Audiovisual: "audiovisual",
  Marketing: "marketing",
  "Comunicação": "communication",
  Comercial: "commercial",
  "Administração Musical": "music_administration",
  "Distribuição Digital": "digital_distribution",
  CRM: "crm",
};
export function canonicalMarketingSector(value: unknown): string {
  if (typeof value !== "string") return "";
  return hasOwn(LEGACY_MARKETING_SECTOR_TO_CANONICAL, value) ? LEGACY_MARKETING_SECTOR_TO_CANONICAL[value] : value;
}

export const LEGACY_AUTOMATION_FLOW_ID_TO_CANONICAL: Readonly<Record<string, string>> = {
  "flow-lancamento": "flow-music-release",
  "flow-conteudo-corporativo": "flow-corporate-content",
  "flow-bastidores": "flow-behind-the-scenes",
  "flow-evento": "flow-event",
  "flow-produto-saas": "flow-product-saas",
};
export function canonicalAutomationFlowId(value: unknown): string | undefined {
  if (typeof value !== "string" || value === "") return undefined;
  return hasOwn(LEGACY_AUTOMATION_FLOW_ID_TO_CANONICAL, value) ? LEGACY_AUTOMATION_FLOW_ID_TO_CANONICAL[value] : value;
}

/** `MarketingAsset.sourceDepartment` (asset metadata.sourceDepartment): open string, two known Portuguese spellings. */
export const LEGACY_SOURCE_DEPARTMENT_TO_CANONICAL: Readonly<Record<string, string>> = {
  conteudo: "content",
  operacoes: "operations",
};

/** Canonical source department; any other value (the field is an open string) is returned untouched. */
export function canonicalSourceDepartment(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  return Object.prototype.hasOwnProperty.call(LEGACY_SOURCE_DEPARTMENT_TO_CANONICAL, value) ? LEGACY_SOURCE_DEPARTMENT_TO_CANONICAL[value] : value;
}
