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
  { value: "projeto_musical", label: "Projeto Musical" },
  { value: "artista", label: "Artista" },
  { value: "empresa", label: "Empresa" },
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
  { value: "lancamento_musical", label: "Lançamento Musical" },
  { value: "videoclipe", label: "Videoclipe" },
  { value: "audiovisual", label: "Projeto Audiovisual" },
  { value: "campanha_institucional", label: "Campanha Institucional" },
  { value: "campanha_promocional", label: "Campanha Promocional" },
  { value: "evento", label: "Evento" },
  { value: "conteudo_corporativo", label: "Conteúdo Corporativo" },
  { value: "bastidores", label: "Bastidores" },
  { value: "reuniao", label: "Reunião" },
  { value: "divulgacao_produto", label: "Divulgação de Produto" },
  { value: "divulgacao_servico", label: "Divulgação de Serviço" },
  { value: "divulgacao_saas", label: "Divulgação de SaaS" },
  { value: "comunicacao_interna", label: "Comunicação Interna" },
  { value: "comunicacao_externa", label: "Comunicação Externa" },
  { value: "portal_noticias", label: "Portal de Notícias" },
  { value: "projeto_especial", label: "Projeto Especial" },
];

export const PROJECT_TYPE_LABEL = optionLabels(PROJECT_TYPE_OPTIONS);

export const PROJECT_STATUS_OPTIONS: Option<ProjectStatus>[] = [
  { value: "planejamento", label: "Planejamento" },
  { value: "em_andamento", label: "Em Andamento" },
  { value: "pausado", label: "Pausado" },
  { value: "concluido", label: "Concluído" },
  { value: "cancelado", label: "Cancelado" },
];

export const PROJECT_STATUS_LABEL = optionLabels(PROJECT_STATUS_OPTIONS);

export const PROJECT_STATUS_TONE: Record<ProjectStatus, Tone> = {
  planejamento: "info",
  em_andamento: "success",
  pausado: "warning",
  concluido: "neutral",
  cancelado: "danger",
};

// ---------------------------------------------------------------------------
// Campaign
// ---------------------------------------------------------------------------

export const CAMPAIGN_TYPE_OPTIONS: Option<CampaignType>[] = [
  { value: "institucional", label: "Institucional" },
  { value: "comercial", label: "Comercial" },
  { value: "artistica", label: "Artística" },
  { value: "promocional", label: "Promocional" },
  { value: "lancamento_musical", label: "Lançamento Musical" },
  { value: "produto", label: "Produto" },
  { value: "servico", label: "Serviço" },
  { value: "saas", label: "SaaS" },
  { value: "evento", label: "Evento" },
  { value: "conteudo", label: "Conteúdo" },
  { value: "branding", label: "Branding" },
  { value: "trafego_pago", label: "Tráfego Pago" },
  { value: "organica", label: "Orgânica" },
];

export const CAMPAIGN_TYPE_LABEL = optionLabels(CAMPAIGN_TYPE_OPTIONS);

export const CAMPAIGN_STATUS_OPTIONS: Option<CampaignStatus>[] = [
  { value: "rascunho", label: "Rascunho" },
  { value: "agendada", label: "Agendada" },
  { value: "ativa", label: "Ativa" },
  { value: "pausada", label: "Pausada" },
  { value: "concluida", label: "Concluída" },
  { value: "cancelada", label: "Cancelada" },
];

export const CAMPAIGN_STATUS_LABEL = optionLabels(CAMPAIGN_STATUS_OPTIONS);

export const CAMPAIGN_STATUS_TONE: Record<CampaignStatus, Tone> = {
  rascunho: "neutral",
  agendada: "info",
  ativa: "success",
  pausada: "warning",
  concluida: "neutral",
  cancelada: "danger",
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
  { value: "portal_noticias", label: "Portal de Notícias" },
  { value: "podcast", label: "Podcast" },
  { value: "campanha", label: "Campanha" },
  { value: "material_publicitario", label: "Material Publicitário" },
  { value: "evento_interno", label: "Evento Interno" },
  { value: "evento_externo", label: "Evento Externo" },
  { value: "reuniao", label: "Reunião" },
  { value: "bastidores", label: "Bastidores" },
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
  { value: "pendente", label: "Pendente" },
  { value: "aprovado", label: "Aprovado" },
  { value: "reprovado", label: "Reprovado" },
  { value: "ajustes_solicitados", label: "Ajustes Solicitados" },
];

export const APPROVAL_STATUS_LABEL = optionLabels(APPROVAL_STATUS_OPTIONS);

export const APPROVAL_STATUS_TONE: Record<ApprovalStatus, Tone> = {
  pendente: "pending",
  aprovado: "success",
  reprovado: "danger",
  ajustes_solicitados: "warning",
};

// ---------------------------------------------------------------------------
// Briefing
// ---------------------------------------------------------------------------

export const BRIEFING_TYPE_OPTIONS: Option<BriefingType>[] = [
  { value: "campanha", label: "Campanha" },
  { value: "conteudo", label: "Conteúdo" },
  { value: "design", label: "Design" },
  { value: "audiovisual", label: "Audiovisual" },
  { value: "institucional", label: "Institucional" },
  { value: "comercial", label: "Comercial" },
  { value: "artistico", label: "Artístico" },
  { value: "evento", label: "Evento" },
  { value: "produto", label: "Produto" },
  { value: "servico", label: "Serviço" },
  { value: "saas", label: "SaaS" },
  { value: "portal_noticias", label: "Portal de Notícias" },
  { value: "bastidores", label: "Bastidores" },
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
  { value: "publicacao", label: "Publicação" },
  { value: "campanha", label: "Campanha" },
  { value: "planejamento", label: "Planejamento" },
  { value: "aprovacao", label: "Aprovação" },
  { value: "revisao", label: "Revisão" },
  { value: "analise", label: "Análise" },
  { value: "reuniao", label: "Reunião" },
  { value: "bastidor", label: "Bastidor" },
  { value: "conteudo_institucional", label: "Conteúdo Institucional" },
  { value: "conteudo_comercial", label: "Conteúdo Comercial" },
  { value: "conteudo_artistico", label: "Conteúdo Artístico" },
  { value: "portal", label: "Portal" },
  { value: "crm", label: "CRM" },
  { value: "trafego_pago", label: "Tráfego Pago" },
  // Design
  { value: "capa", label: "Capa" },
  { value: "banner", label: "Banner" },
  { value: "press_kit", label: "Press Kit" },
  { value: "flyer", label: "Flyer" },
  { value: "arte_redes_sociais", label: "Arte para Redes Sociais" },
  { value: "identidade_visual", label: "Identidade Visual" },
  { value: "thumbnail", label: "Thumbnail" },
  { value: "material_promocional", label: "Material Promocional" },
  // Audiovisual
  { value: "videoclipe", label: "Videoclipe" },
  { value: "video_redes_sociais", label: "Vídeo para Redes Sociais" },
  { value: "making_of", label: "Making Of" },
  { value: "bastidores", label: "Bastidores" },
  { value: "lyric_video", label: "Lyric Video" },
  { value: "visualizer", label: "Visualizer" },
  { value: "entrevista", label: "Entrevista" },
  { value: "podcast_video", label: "Podcast em Vídeo" },
  { value: "captacao_evento", label: "Captação de Evento" },
  // Sales / CRM
  { value: "prospeccao", label: "Prospecção" },
  { value: "negociacao", label: "Negociação" },
  { value: "follow_up", label: "Follow-up" },
  { value: "relacionamento", label: "Relacionamento" },
  // Digital distribution
  { value: "planejamento_lancamento", label: "Planejamento de Lançamento" },
  // Company (corporate)
  { value: "material_institucional", label: "Material Institucional" },
  { value: "apresentacao_comercial", label: "Apresentação Comercial" },
  { value: "folder", label: "Folder" },
  { value: "video_institucional", label: "Vídeo Institucional" },
  { value: "bastidores_empresa", label: "Bastidores da Empresa" },
  { value: "cobertura_evento_corporativo", label: "Cobertura de Evento Corporativo" },
  { value: "entrevista_corporativa", label: "Entrevista Corporativa" },
  { value: "campanha_institucional", label: "Campanha Institucional" },
  { value: "branding", label: "Branding" },
  { value: "posicionamento_marca", label: "Posicionamento de Marca" },
  { value: "comunicados", label: "Comunicados" },
  { value: "relacionamento_parceiros", label: "Relacionamento com Parceiros" },
  { value: "parcerias", label: "Parcerias" },
  // Artist (career management)
  { value: "planejamento_carreira", label: "Planejamento de Carreira" },
  { value: "gestao_agenda", label: "Gestão de Agenda" },
  { value: "planejamento_estrategico", label: "Planejamento Estratégico" },
  { value: "assessoria_imprensa", label: "Assessoria de Imprensa" },
  { value: "release", label: "Release" },
  { value: "branding_pessoal", label: "Branding Pessoal" },
  { value: "posicionamento", label: "Posicionamento" },
  { value: "estrategias_crescimento", label: "Estratégias de Crescimento" },
  { value: "sessao_fotos", label: "Sessão de Fotos" },
  { value: "conteudo_redes_sociais", label: "Conteúdo para Redes Sociais" },
  { value: "contratacoes", label: "Contratações" },
  { value: "shows", label: "Shows" },
  // Music project (release/work)
  { value: "motion_cover", label: "Motion Cover" },
  { value: "arte_divulgacao", label: "Arte de Divulgação" },
  { value: "teaser", label: "Teaser" },
  { value: "conteudo_lancamento", label: "Conteúdo de Lançamento" },
  { value: "distribuicao", label: "Distribuição" },
  { value: "metadata", label: "Metadados" },
  { value: "pitching", label: "Pitching" },
  { value: "pre_save", label: "Pré-save" },
  { value: "campanha_lancamento", label: "Campanha de Lançamento" },
  { value: "divulgacao", label: "Divulgação" },
  { value: "influenciadores", label: "Influenciadores" },
  { value: "aprovacao_conteudo", label: "Aprovação de Conteúdo" },
];

export const TASK_TYPE_LABEL = optionLabels(TASK_TYPE_OPTIONS);

/**
 * Operational departments (canonical values) and the catalog
 * of Types allowed per department. The "Tipo" field in the task modal is filtered by
 * this map: it only shows options compatible with the chosen department.
 */
export const SECTOR_OPTIONS: Option<string>[] = [
  { value: "Design", label: "Design" },
  { value: "Audiovisual", label: "Audiovisual" },
  { value: "Marketing", label: "Marketing" },
  { value: "Comunicação", label: "Comunicação" },
  { value: "Comercial", label: "Comercial" },
  { value: "Administração Musical", label: "Administração Musical" },
  { value: "Distribuição Digital", label: "Distribuição Digital" },
  { value: "CRM", label: "CRM" },
];

const taskType = (value: TaskType): Option<TaskType> => ({ value, label: TASK_TYPE_LABEL[value] });

export const SECTOR_TYPE_OPTIONS: Record<string, Option<TaskType>[]> = {
  "Design": (["capa", "banner", "press_kit", "flyer", "arte_redes_sociais", "identidade_visual", "thumbnail", "material_promocional"] as TaskType[]).map(taskType),
  "Audiovisual": (["videoclipe", "video_redes_sociais", "making_of", "bastidores", "lyric_video", "visualizer", "entrevista", "podcast_video", "captacao_evento"] as TaskType[]).map(taskType),
  "Marketing": (["campanha", "trafego_pago", "planejamento", "analise", "conteudo_comercial", "conteudo_institucional", "conteudo_artistico"] as TaskType[]).map(taskType),
  "Comunicação": (["copywriting", "publicacao", "revisao", "aprovacao", "conteudo_institucional", "conteudo_comercial", "reuniao"] as TaskType[]).map(taskType),
  "Comercial": (["crm", "reuniao", "planejamento", "prospeccao", "negociacao", "follow_up"] as TaskType[]).map(taskType),
  "Administração Musical": (["planejamento", "aprovacao", "reuniao", "analise", "bastidores"] as TaskType[]).map(taskType),
  "Distribuição Digital": (["publicacao", "planejamento_lancamento", "aprovacao", "revisao", "analise"] as TaskType[]).map(taskType),
  "CRM": (["crm", "campanha", "follow_up", "relacionamento", "analise"] as TaskType[]).map(taskType),
};

const sectorOpt = (name: string): Option<string> => ({ value: name, label: name });

/**
 * Departments available per context. Operations are separate: company
 * (corporate), artist (career management) and music project (release/work) activities
 * have distinct department and type catalogs. The department field is filtered by context
 * and the type field by context + department.
 */
export const CONTEXT_SECTOR_OPTIONS: Record<MarketingTarget, Option<string>[]> = {
  empresa: ["Design", "Audiovisual", "Marketing", "Comunicação", "Comercial"].map(sectorOpt),
  artista: ["Administração Musical", "Comunicação", "Marketing", "Audiovisual", "Comercial"].map(sectorOpt),
  projeto_musical: ["Design", "Audiovisual", "Distribuição Digital", "Marketing", "Comunicação"].map(sectorOpt),
};

/** Types allowed per Context × Sector. */
export const CONTEXT_SECTOR_TYPE_OPTIONS: Record<MarketingTarget, Record<string, Option<TaskType>[]>> = {
  empresa: {
    "Design": (["material_institucional", "apresentacao_comercial", "folder", "banner", "identidade_visual"] as TaskType[]).map(taskType),
    "Audiovisual": (["video_institucional", "bastidores_empresa", "cobertura_evento_corporativo", "entrevista_corporativa"] as TaskType[]).map(taskType),
    "Marketing": (["campanha_institucional", "branding", "trafego_pago", "posicionamento_marca"] as TaskType[]).map(taskType),
    "Comunicação": (["comunicados", "conteudo_institucional", "relacionamento_parceiros"] as TaskType[]).map(taskType),
    "Comercial": (["reuniao", "negociacao", "prospeccao", "parcerias"] as TaskType[]).map(taskType),
  },
  artista: {
    "Administração Musical": (["planejamento_carreira", "gestao_agenda", "planejamento_estrategico", "relacionamento_parceiros"] as TaskType[]).map(taskType),
    "Comunicação": (["assessoria_imprensa", "release", "entrevista"] as TaskType[]).map(taskType),
    "Marketing": (["branding_pessoal", "posicionamento", "estrategias_crescimento"] as TaskType[]).map(taskType),
    "Audiovisual": (["sessao_fotos", "conteudo_redes_sociais", "bastidores"] as TaskType[]).map(taskType),
    "Comercial": (["contratacoes", "shows", "negociacao", "prospeccao"] as TaskType[]).map(taskType),
  },
  projeto_musical: {
    "Design": (["capa", "motion_cover", "press_kit", "thumbnail", "arte_divulgacao"] as TaskType[]).map(taskType),
    "Audiovisual": (["videoclipe", "lyric_video", "visualizer", "teaser", "conteudo_lancamento"] as TaskType[]).map(taskType),
    "Distribuição Digital": (["distribuicao", "metadata", "pitching", "pre_save"] as TaskType[]).map(taskType),
    "Marketing": (["campanha_lancamento", "trafego_pago", "divulgacao", "influenciadores"] as TaskType[]).map(taskType),
    "Comunicação": (["release", "aprovacao_conteudo", "publicacao"] as TaskType[]).map(taskType),
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
  { value: "capa", label: "Capa" },
  { value: "arte_promocional", label: "Arte Promocional" },
  { value: "banner", label: "Banner" },
  { value: "logo", label: "Logo" },
  { value: "identidade_visual", label: "Identidade Visual" },
  { value: "fotografia", label: "Fotografia" },
  { value: "reels", label: "Reels" },
  { value: "video", label: "Vídeo" },
  { value: "teaser", label: "Teaser" },
  { value: "shorts", label: "Shorts" },
  { value: "press_kit", label: "Press Kit" },
  { value: "template", label: "Template" },
  { value: "documento_estrategico", label: "Documento Estratégico" },
  { value: "material_institucional", label: "Material Institucional" },
  { value: "material_comercial", label: "Material Comercial" },
  { value: "material_bastidores", label: "Material de Bastidores" },
  { value: "material_reuniao", label: "Material de Reunião" },
  { value: "arquivo_portal", label: "Arquivo para Portal" },
  { value: "asset_campanha", label: "Material de campanha" },
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
  { value: "pendente", label: "Pendente" },
  { value: "em_revisao", label: "Em Revisão" },
  { value: "aprovado", label: "Aprovado" },
  { value: "rejeitado", label: "Rejeitado" },
];

export const DELIVERABLE_APPROVAL_LABEL = optionLabels(DELIVERABLE_APPROVAL_OPTIONS);

export const DELIVERABLE_APPROVAL_TONE: Record<DeliverableApproval, Tone> = {
  pendente: "pending",
  em_revisao: "warning",
  aprovado: "success",
  rejeitado: "danger",
};

// ---------------------------------------------------------------------------
// Automations
// ---------------------------------------------------------------------------

export const AUTOMATION_FLOW_LABEL: Record<AutomationFlowType, string> = {
  lancamento_musical: "Fluxo de Lançamento Musical",
  conteudo_corporativo: "Fluxo de Conteúdo Corporativo",
  bastidores: "Fluxo de Bastidores",
  evento: "Fluxo de Evento",
  produto_servico_saas: "Fluxo de Produto, Serviço ou SaaS",
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

