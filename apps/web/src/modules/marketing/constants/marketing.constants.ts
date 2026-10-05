/**
 * Marketing Module — Constants & Vocabulary
 *
 * Option lists (value/label), human labels and badge color maps for every
 * enumeration in marketing.types. UI components and forms read from here so
 * vocabulary stays centralized and consistent.
 */

import type { BadgeVariant } from "@/shared/ui/badge";
import type {
  ApprovalStatus,
  AssetCategory,
  AutomationFlowType,
  BriefingStatus,
  BriefingType,
  CampaignStatus,
  CampaignType,
  ContentChannel,
  ContentDisplayStatus,
  ContentStatus,
  ContentType,
  DeliverableApproval,
  DeliverableType,
  MarketingTarget,
  Priority,
  ProjectStatus,
  ProjectType,
  TaskStatus,
  TaskType,
} from "../types/marketing.types";

export interface Option<T extends string> {
  value: T;
  label: string;
}

/** Semantic tone used to derive Tailwind classes for badges. */
export type Tone =
  | "neutral"
  | "info"
  | "success"
  | "warning"
  | "danger"
  | "purple"
  | "pending";

/**
 * Semantic tone → canonical variant of the global Badge (5 variants).
 * `purple` and `pending` collapse into info/neutral (no extra variants).
 */
export const TONE_VARIANT: Record<Tone, BadgeVariant> = {
  neutral: "neutral",
  info: "info",
  success: "success",
  warning: "warning",
  danger: "danger",
  purple: "info",
  pending: "neutral",
};

/**
 * Default palette classes per tone — used by chips outside the Badge component
 * (e.g. the calendar). Keeps the same contrast (light background → dark text).
 */
export const TONE_CLASS: Record<Tone, string> = {
  neutral: "bg-muted text-muted-foreground",
  info: "bg-info-soft text-info",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-destructive-soft text-destructive",
  purple: "bg-info-soft text-info",
  pending: "bg-muted text-muted-foreground",
};

// ---------------------------------------------------------------------------
// Context target
// ---------------------------------------------------------------------------

export const MARKETING_TARGET_OPTIONS: Option<MarketingTarget>[] = [
  { value: "music_project", label: "Projeto Musical" },
  { value: "artist", label: "Artista" },
  { value: "company", label: "Empresa" },
];

export const MARKETING_TARGET_LABEL = optionLabels(MARKETING_TARGET_OPTIONS);

// ---------------------------------------------------------------------------
// Priority
// ---------------------------------------------------------------------------

export const PRIORITY_OPTIONS: Option<Priority>[] = [
  { value: "low", label: "Baixa" },
  { value: "normal", label: "Média" },
  { value: "high", label: "Alta" },
  { value: "urgent", label: "Urgente" },
];

export const PRIORITY_LABEL: Record<Priority, string> = optionLabels(PRIORITY_OPTIONS);

export const PRIORITY_TONE: Record<Priority, Tone> = {
  low: "neutral",
  normal: "info",
  high: "warning",
  urgent: "danger",
};

// ---------------------------------------------------------------------------
// Project
// ---------------------------------------------------------------------------

export const PROJECT_TYPE_OPTIONS: Option<ProjectType>[] = [
  { value: "music_release", label: "Lançamento Musical" },
  { value: "music_video", label: "Videoclipe" },
  { value: "audiovisual", label: "Projeto Audiovisual" },
  { value: "institutional_campaign", label: "Campanha Institucional" },
  { value: "promotional_campaign", label: "Campanha Promocional" },
  { value: "event", label: "Evento" },
  { value: "corporate_content", label: "Conteúdo Corporativo" },
  { value: "behind_the_scenes", label: "Bastidores" },
  { value: "meeting", label: "Reunião" },
  { value: "product_promotion", label: "Divulgação de Produto" },
  { value: "service_promotion", label: "Divulgação de Serviço" },
  { value: "saas_promotion", label: "Divulgação de SaaS" },
  { value: "internal_communication", label: "Comunicação Interna" },
  { value: "external_communication", label: "Comunicação Externa" },
  { value: "news_portal", label: "Portal de Notícias" },
  { value: "special_project", label: "Projeto Especial" },
];

export const PROJECT_TYPE_LABEL = optionLabels(PROJECT_TYPE_OPTIONS);

export const PROJECT_STATUS_OPTIONS: Option<ProjectStatus>[] = [
  { value: "draft", label: "Rascunho" },
  { value: "planning", label: "Planejamento" },
  { value: "active", label: "Em Andamento" },
  { value: "paused", label: "Pausado" },
  { value: "completed", label: "Concluído" },
  { value: "cancelled", label: "Cancelado" },
  { value: "archived", label: "Arquivado" },
];

export const PROJECT_STATUS_LABEL = optionLabels(PROJECT_STATUS_OPTIONS);

export const PROJECT_STATUS_TONE: Record<ProjectStatus, Tone> = {
  draft: "neutral",
  planning: "info",
  active: "success",
  paused: "warning",
  completed: "neutral",
  cancelled: "danger",
  archived: "neutral",
};

// ---------------------------------------------------------------------------
// Campaign
// ---------------------------------------------------------------------------

export const CAMPAIGN_TYPE_OPTIONS: Option<CampaignType>[] = [
  { value: "institutional", label: "Institucional" },
  { value: "commercial", label: "Comercial" },
  { value: "artistic", label: "Artística" },
  { value: "promotional", label: "Promocional" },
  { value: "music_release", label: "Lançamento Musical" },
  { value: "product", label: "Produto" },
  { value: "service", label: "Serviço" },
  { value: "saas", label: "SaaS" },
  { value: "event", label: "Evento" },
  { value: "content", label: "Conteúdo" },
  { value: "branding", label: "Branding" },
  { value: "paid_traffic", label: "Tráfego Pago" },
  { value: "organic", label: "Orgânica" },
];

export const CAMPAIGN_TYPE_LABEL = optionLabels(CAMPAIGN_TYPE_OPTIONS);

export const CAMPAIGN_STATUS_OPTIONS: Option<CampaignStatus>[] = [
  { value: "draft", label: "Rascunho" },
  { value: "ready", label: "Pronta" },
  { value: "pending_review", label: "Em revisão" },
  { value: "scheduled", label: "Agendada" },
  { value: "active", label: "Ativa" },
  { value: "paused", label: "Pausada" },
  { value: "rejected", label: "Rejeitada" },
  { value: "completed", label: "Concluída" },
  { value: "failed", label: "Falhou" },
  { value: "archived", label: "Arquivada" },
  { value: "cancelled", label: "Cancelada" },
];

export const CAMPAIGN_STATUS_LABEL = optionLabels(CAMPAIGN_STATUS_OPTIONS);

export const CAMPAIGN_STATUS_TONE: Record<CampaignStatus, Tone> = {
  draft: "neutral",
  ready: "info",
  pending_review: "warning",
  scheduled: "info",
  active: "success",
  paused: "warning",
  rejected: "danger",
  completed: "neutral",
  failed: "danger",
  archived: "neutral",
  cancelled: "danger",
};

// ---------------------------------------------------------------------------
// Content
// ---------------------------------------------------------------------------

export const CONTENT_TYPE_OPTIONS: Option<ContentType>[] = [
  { value: "post", label: "Post" },
  { value: "feed", label: "Feed" },
  { value: "stories", label: "Stories" },
  { value: "reels", label: "Reels" },
  { value: "shorts", label: "Shorts" },
  { value: "video", label: "Vídeo" },
  { value: "carousel", label: "Carrossel" },
  { value: "ad", label: "Anúncio" },
  { value: "social_media", label: "Rede Social" },
  { value: "institutional", label: "Institucional" },
  { value: "commercial", label: "Comercial" },
  { value: "artist", label: "Artista" },
  { value: "behind_the_scenes", label: "Bastidores" },
  { value: "meeting", label: "Reunião" },
  { value: "event", label: "Evento" },
  { value: "portal", label: "Portal de Notícias" },
  { value: "blog", label: "Blog" },
  { value: "advertising", label: "Material Publicitário" },
];

export const CONTENT_TYPE_LABEL = optionLabels(CONTENT_TYPE_OPTIONS);

export const CONTENT_CHANNEL_OPTIONS: Option<ContentChannel>[] = [
  { value: "instagram", label: "Instagram" },
  { value: "facebook", label: "Facebook" },
  { value: "tiktok", label: "TikTok" },
  { value: "youtube", label: "YouTube" },
  { value: "twitter", label: "X/Twitter" },
  { value: "threads", label: "Threads" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "shorts", label: "Shorts" },
  { value: "reels", label: "Reels" },
  { value: "stories", label: "Stories" },
  { value: "blog", label: "Blog" },
  { value: "news_portal", label: "Portal de Notícias" },
  { value: "podcast", label: "Podcast" },
  { value: "campaign", label: "Campanha" },
  { value: "advertising_material", label: "Material Publicitário" },
  { value: "internal_event", label: "Evento Interno" },
  { value: "external_event", label: "Evento Externo" },
  { value: "meeting", label: "Reunião" },
  { value: "behind_the_scenes", label: "Bastidores" },
];

export const CONTENT_CHANNEL_LABEL = optionLabels(CONTENT_CHANNEL_OPTIONS);

/** Selectable (persisted) statuses -- exactly chk_marketing_content_posts_status. */
export const CONTENT_STATUS_OPTIONS: Option<ContentStatus>[] = [
  { value: "draft", label: "Rascunho" },
  { value: "scheduled", label: "Agendado" },
  { value: "published", label: "Publicado" },
  { value: "cancelled", label: "Cancelado" },
  { value: "failed", label: "Falhou" },
];

/** Labels for everything the UI can display, including the derived `overdue`. */
export const CONTENT_STATUS_LABEL: Record<ContentDisplayStatus, string> = {
  ...optionLabels(CONTENT_STATUS_OPTIONS),
  overdue: "Atrasado",
};

export const CONTENT_STATUS_TONE: Record<ContentDisplayStatus, Tone> = {
  draft: "neutral",
  scheduled: "warning",
  published: "success",
  cancelled: "neutral",
  failed: "danger",
  overdue: "danger",
};

// ---------------------------------------------------------------------------
// Approval
// ---------------------------------------------------------------------------

export const APPROVAL_STATUS_OPTIONS: Option<ApprovalStatus>[] = [
  { value: "pending", label: "Pendente" },
  { value: "approved", label: "Aprovado" },
  { value: "rejected", label: "Reprovado" },
  { value: "revision_requested", label: "Ajustes Solicitados" },
];

export const APPROVAL_STATUS_LABEL = optionLabels(APPROVAL_STATUS_OPTIONS);

export const APPROVAL_STATUS_TONE: Record<ApprovalStatus, Tone> = {
  pending: "pending",
  approved: "success",
  rejected: "danger",
  revision_requested: "warning",
};

// ---------------------------------------------------------------------------
// Briefing
// ---------------------------------------------------------------------------

export const BRIEFING_TYPE_OPTIONS: Option<BriefingType>[] = [
  { value: "campaign", label: "Campanha" },
  { value: "content", label: "Conteúdo" },
  { value: "design", label: "Design" },
  { value: "audiovisual", label: "Audiovisual" },
  { value: "institutional", label: "Institucional" },
  { value: "commercial", label: "Comercial" },
  { value: "artistic", label: "Artístico" },
  { value: "event", label: "Evento" },
  { value: "product", label: "Produto" },
  { value: "service", label: "Serviço" },
  { value: "saas", label: "SaaS" },
  { value: "news_portal", label: "Portal de Notícias" },
  { value: "behind_the_scenes", label: "Bastidores" },
];

export const BRIEFING_TYPE_LABEL = optionLabels(BRIEFING_TYPE_OPTIONS);

export const BRIEFING_STATUS_OPTIONS: Option<BriefingStatus>[] = [
  { value: "draft", label: "Rascunho" },
  { value: "in_progress", label: "Em Andamento" },
  { value: "review", label: "Em Revisão" },
  { value: "approved", label: "Aprovado" },
  { value: "completed", label: "Concluído" },
  { value: "cancelled", label: "Cancelado" },
];

export const BRIEFING_STATUS_LABEL = optionLabels(BRIEFING_STATUS_OPTIONS);

export const BRIEFING_STATUS_TONE: Record<BriefingStatus, Tone> = {
  draft: "neutral",
  in_progress: "info",
  review: "warning",
  approved: "success",
  completed: "success",
  cancelled: "pending",
};

// ---------------------------------------------------------------------------
// Task
// ---------------------------------------------------------------------------

export const TASK_TYPE_OPTIONS: Option<TaskType>[] = [
  { value: "design", label: "Design" },
  { value: "audiovisual", label: "Audiovisual" },
  { value: "copywriting", label: "Copywriting" },
  { value: "publishing", label: "Publicação" },
  { value: "campaign", label: "Campanha" },
  { value: "planning", label: "Planejamento" },
  { value: "approval", label: "Aprovação" },
  { value: "review", label: "Revisão" },
  { value: "analysis", label: "Análise" },
  { value: "meeting", label: "Reunião" },
  { value: "behind_the_scenes_shot", label: "Bastidor" },
  { value: "institutional_content", label: "Conteúdo Institucional" },
  { value: "commercial_content", label: "Conteúdo Comercial" },
  { value: "artistic_content", label: "Conteúdo Artístico" },
  { value: "portal", label: "Portal" },
  { value: "crm", label: "CRM" },
  { value: "paid_traffic", label: "Tráfego Pago" },
  // Design
  { value: "cover", label: "Capa" },
  { value: "banner", label: "Banner" },
  { value: "press_kit", label: "Press Kit" },
  { value: "flyer", label: "Flyer" },
  { value: "social_media_art", label: "Arte para Redes Sociais" },
  { value: "visual_identity", label: "Identidade Visual" },
  { value: "thumbnail", label: "Thumbnail" },
  { value: "promotional_material", label: "Material Promocional" },
  // Audiovisual
  { value: "music_video", label: "Videoclipe" },
  { value: "social_media_video", label: "Vídeo para Redes Sociais" },
  { value: "making_of", label: "Making Of" },
  { value: "behind_the_scenes", label: "Bastidores" },
  { value: "lyric_video", label: "Lyric Video" },
  { value: "visualizer", label: "Visualizer" },
  { value: "interview", label: "Entrevista" },
  { value: "podcast_video", label: "Podcast em Vídeo" },
  { value: "event_coverage", label: "Captação de Evento" },
  // Sales / CRM
  { value: "prospecting", label: "Prospecção" },
  { value: "negotiation", label: "Negociação" },
  { value: "follow_up", label: "Follow-up" },
  { value: "relationship", label: "Relacionamento" },
  // Digital distribution
  { value: "release_planning", label: "Planejamento de Lançamento" },
  // Company (corporate)
  { value: "institutional_material", label: "Material Institucional" },
  { value: "commercial_presentation", label: "Apresentação Comercial" },
  { value: "folder", label: "Folder" },
  { value: "institutional_video", label: "Vídeo Institucional" },
  { value: "company_behind_the_scenes", label: "Bastidores da Empresa" },
  { value: "corporate_event_coverage", label: "Cobertura de Evento Corporativo" },
  { value: "corporate_interview", label: "Entrevista Corporativa" },
  { value: "institutional_campaign", label: "Campanha Institucional" },
  { value: "branding", label: "Branding" },
  { value: "brand_positioning", label: "Posicionamento de Marca" },
  { value: "announcements", label: "Comunicados" },
  { value: "partner_relationship", label: "Relacionamento com Parceiros" },
  { value: "partnerships", label: "Parcerias" },
  // Artist (career management)
  { value: "career_planning", label: "Planejamento de Carreira" },
  { value: "schedule_management", label: "Gestão de Agenda" },
  { value: "strategic_planning", label: "Planejamento Estratégico" },
  { value: "press_relations", label: "Assessoria de Imprensa" },
  { value: "release", label: "Release" },
  { value: "personal_branding", label: "Branding Pessoal" },
  { value: "positioning", label: "Posicionamento" },
  { value: "growth_strategies", label: "Estratégias de Crescimento" },
  { value: "photo_session", label: "Sessão de Fotos" },
  { value: "social_media_content", label: "Conteúdo para Redes Sociais" },
  { value: "contracting", label: "Contratações" },
  { value: "shows", label: "Shows" },
  // Music project (release/work)
  { value: "motion_cover", label: "Motion Cover" },
  { value: "promotional_art", label: "Arte de Divulgação" },
  { value: "teaser", label: "Teaser" },
  { value: "release_content", label: "Conteúdo de Lançamento" },
  { value: "distribution", label: "Distribuição" },
  { value: "metadata", label: "Metadados" },
  { value: "pitching", label: "Pitching" },
  { value: "pre_save", label: "Pré-save" },
  { value: "release_campaign", label: "Campanha de Lançamento" },
  { value: "promotion", label: "Divulgação" },
  { value: "influencers", label: "Influenciadores" },
  { value: "content_approval", label: "Aprovação de Conteúdo" },
];

export const TASK_TYPE_LABEL = optionLabels(TASK_TYPE_OPTIONS);

/**
 * Operational departments (canonical values) and the catalog
 * of Types allowed per department. The "Tipo" field in the task modal is filtered by
 * this map: it only shows options compatible with the chosen department.
 */
export const SECTOR_OPTIONS: Option<string>[] = [
  { value: "design", label: "Design" },
  { value: "audiovisual", label: "Audiovisual" },
  { value: "marketing", label: "Marketing" },
  { value: "communication", label: "Comunicação" },
  { value: "commercial", label: "Comercial" },
  { value: "music_administration", label: "Administração Musical" },
  { value: "digital_distribution", label: "Distribuição Digital" },
  { value: "crm", label: "CRM" },
];

/** PT-BR label of a platform sector; a sector a tenant typed (not in the catalog) is shown as typed. */
export const SECTOR_LABEL: Record<string, string> = Object.fromEntries(SECTOR_OPTIONS.map((o) => [o.value, o.label]));
export const marketingSectorLabel = (value: string | undefined | null): string => (value ? SECTOR_LABEL[value] ?? value : "");

const taskType = (value: TaskType): Option<TaskType> => ({ value, label: TASK_TYPE_LABEL[value] });

export const SECTOR_TYPE_OPTIONS: Record<string, Option<TaskType>[]> = {
  design: (["cover", "banner", "press_kit", "flyer", "social_media_art", "visual_identity", "thumbnail", "promotional_material"] as TaskType[]).map(taskType),
  audiovisual: (["music_video", "social_media_video", "making_of", "behind_the_scenes", "lyric_video", "visualizer", "interview", "podcast_video", "event_coverage"] as TaskType[]).map(taskType),
  marketing: (["campaign", "paid_traffic", "planning", "analysis", "commercial_content", "institutional_content", "artistic_content"] as TaskType[]).map(taskType),
  communication: (["copywriting", "publishing", "review", "approval", "institutional_content", "commercial_content", "meeting"] as TaskType[]).map(taskType),
  commercial: (["crm", "meeting", "planning", "prospecting", "negotiation", "follow_up"] as TaskType[]).map(taskType),
  music_administration: (["planning", "approval", "meeting", "analysis", "behind_the_scenes"] as TaskType[]).map(taskType),
  digital_distribution: (["publishing", "release_planning", "approval", "review", "analysis"] as TaskType[]).map(taskType),
  crm: (["crm", "campaign", "follow_up", "relationship", "analysis"] as TaskType[]).map(taskType),
};

const sectorOpt = (value: string): Option<string> => ({ value, label: SECTOR_LABEL[value] ?? value });

/**
 * Departments available per context. Operations are separate: company
 * (corporate), artist (career management) and music project (release/work) activities
 * have distinct department and type catalogs. The department field is filtered by context
 * and the type field by context + department.
 */
export const CONTEXT_SECTOR_OPTIONS: Record<MarketingTarget, Option<string>[]> = {
  company: ["design", "audiovisual", "marketing", "communication", "commercial"].map(sectorOpt),
  artist: ["music_administration", "communication", "marketing", "audiovisual", "commercial"].map(sectorOpt),
  music_project: ["design", "audiovisual", "digital_distribution", "marketing", "communication"].map(sectorOpt),
};

/** Types allowed per Context × Sector. */
export const CONTEXT_SECTOR_TYPE_OPTIONS: Record<MarketingTarget, Record<string, Option<TaskType>[]>> = {
  company: {
    design: (["institutional_material", "commercial_presentation", "folder", "banner", "visual_identity"] as TaskType[]).map(taskType),
    audiovisual: (["institutional_video", "company_behind_the_scenes", "corporate_event_coverage", "corporate_interview"] as TaskType[]).map(taskType),
    marketing: (["institutional_campaign", "branding", "paid_traffic", "brand_positioning"] as TaskType[]).map(taskType),
    communication: (["announcements", "institutional_content", "partner_relationship"] as TaskType[]).map(taskType),
    commercial: (["meeting", "negotiation", "prospecting", "partnerships"] as TaskType[]).map(taskType),
  },
  artist: {
    music_administration: (["career_planning", "schedule_management", "strategic_planning", "partner_relationship"] as TaskType[]).map(taskType),
    communication: (["press_relations", "release", "interview"] as TaskType[]).map(taskType),
    marketing: (["personal_branding", "positioning", "growth_strategies"] as TaskType[]).map(taskType),
    audiovisual: (["photo_session", "social_media_content", "behind_the_scenes"] as TaskType[]).map(taskType),
    commercial: (["contracting", "shows", "negotiation", "prospecting"] as TaskType[]).map(taskType),
  },
  music_project: {
    design: (["cover", "motion_cover", "press_kit", "thumbnail", "promotional_art"] as TaskType[]).map(taskType),
    audiovisual: (["music_video", "lyric_video", "visualizer", "teaser", "release_content"] as TaskType[]).map(taskType),
    digital_distribution: (["distribution", "metadata", "pitching", "pre_save"] as TaskType[]).map(taskType),
    marketing: (["release_campaign", "paid_traffic", "promotion", "influencers"] as TaskType[]).map(taskType),
    communication: (["release", "content_approval", "publishing"] as TaskType[]).map(taskType),
  },
};

export const TASK_STATUS_OPTIONS: Option<TaskStatus>[] = [
  { value: "backlog", label: "Backlog" },
  { value: "pending", label: "A Fazer" },
  { value: "in_progress", label: "Em Andamento" },
  { value: "review", label: "Revisão" },
  { value: "done", label: "Concluída" },
  { value: "blocked", label: "Bloqueada" },
  { value: "cancelled", label: "Cancelada" },
];

export const TASK_STATUS_LABEL = optionLabels(TASK_STATUS_OPTIONS);

export const TASK_STATUS_TONE: Record<TaskStatus, Tone> = {
  backlog: "neutral",
  pending: "info",
  in_progress: "warning",
  review: "purple",
  done: "success",
  blocked: "danger",
  cancelled: "neutral",
};

/** Ordered columns used by the task board. */
export const TASK_BOARD_COLUMNS: TaskStatus[] = [
  "backlog",
  "pending",
  "in_progress",
  "review",
  "done",
];

// ---------------------------------------------------------------------------
// Asset
// ---------------------------------------------------------------------------

export const ASSET_CATEGORY_OPTIONS: Option<AssetCategory>[] = [
  { value: "cover", label: "Capa" },
  { value: "promotional_art", label: "Arte Promocional" },
  { value: "banner", label: "Banner" },
  { value: "logo", label: "Logo" },
  { value: "visual_identity", label: "Identidade Visual" },
  { value: "photography", label: "Fotografia" },
  { value: "reels", label: "Reels" },
  { value: "video", label: "Vídeo" },
  { value: "teaser", label: "Teaser" },
  { value: "shorts", label: "Shorts" },
  { value: "press_kit", label: "Press Kit" },
  { value: "template", label: "Template" },
  { value: "strategic_document", label: "Documento Estratégico" },
  { value: "institutional_material", label: "Material Institucional" },
  { value: "commercial_material", label: "Material Comercial" },
  { value: "behind_the_scenes_material", label: "Material de Bastidores" },
  { value: "meeting_material", label: "Material de Reunião" },
  { value: "portal_file", label: "Arquivo para Portal" },
  { value: "campaign_asset", label: "Material de campanha" },
];

export const ASSET_CATEGORY_LABEL = optionLabels(ASSET_CATEGORY_OPTIONS);

// ---------------------------------------------------------------------------
// Deliverables
// ---------------------------------------------------------------------------

export const DELIVERABLE_TYPE_OPTIONS: Option<DeliverableType>[] = [
  { value: "cover_art", label: "Capa / Cover Art" },
  { value: "banner", label: "Banner" },
  { value: "thumbnail", label: "Thumbnail" },
  { value: "artwork", label: "Artwork" },
  { value: "logo", label: "Logo" },
  { value: "brand_asset", label: "Material de marca" },
  { value: "video_clip", label: "Videoclipe" },
  { value: "teaser", label: "Teaser" },
  { value: "visualizer", label: "Visualizer" },
  { value: "lyric_video", label: "Lyric Video" },
  { value: "reels", label: "Reels" },
  { value: "shorts", label: "Shorts" },
  { value: "stories", label: "Stories" },
  { value: "audio", label: "Áudio" },
  { value: "document", label: "Documento" },
  { value: "press_kit", label: "Press Kit" },
  { value: "release", label: "Release" },
  { value: "template", label: "Template" },
  { value: "other", label: "Outro" },
];

export const DELIVERABLE_TYPE_LABEL = optionLabels(DELIVERABLE_TYPE_OPTIONS);

export const DELIVERABLE_APPROVAL_OPTIONS: Option<DeliverableApproval>[] = [
  { value: "pending", label: "Pendente" },
  { value: "in_review", label: "Em Revisão" },
  { value: "approved", label: "Aprovado" },
  { value: "rejected", label: "Rejeitado" },
];

export const DELIVERABLE_APPROVAL_LABEL = optionLabels(DELIVERABLE_APPROVAL_OPTIONS);

export const DELIVERABLE_APPROVAL_TONE: Record<DeliverableApproval, Tone> = {
  pending: "pending",
  in_review: "warning",
  approved: "success",
  rejected: "danger",
};

// ---------------------------------------------------------------------------
// Automations
// ---------------------------------------------------------------------------

export const AUTOMATION_FLOW_LABEL: Record<AutomationFlowType, string> = {
  music_release: "Fluxo de Lançamento Musical",
  corporate_content: "Fluxo de Conteúdo Corporativo",
  behind_the_scenes: "Fluxo de Bastidores",
  event: "Fluxo de Evento",
  product_service_saas: "Fluxo de Produto, Serviço ou SaaS",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function optionLabels<T extends string>(options: Option<T>[]): Record<T, string> {
  return options.reduce(
    (acc, opt) => {
      acc[opt.value] = opt.label;
      return acc;
    },
    {} as Record<T, string>,
  );
}

