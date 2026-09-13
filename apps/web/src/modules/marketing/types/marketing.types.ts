/**
 * Marketing Module — Domain Types
 *
 * Single source of truth for every entity handled by the Marketing module.
 * Covers artistic, corporate, commercial, product/service/SaaS, events,
 * behind-the-scenes (bastidores), meetings and institutional communication.
 *
 * Pure type declarations only — no runtime values, no imports. Runtime
 * vocabulary (labels, colors, option lists) lives in ../constants.
 */

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

export type ID = string;
/** ISO-8601 date string (e.g. "2026-05-31" or full datetime). */
export type ISODate = string;

// ---------------------------------------------------------------------------
// Shared enumerations (string-literal unions; option lists live in constants)
// ---------------------------------------------------------------------------

export type Priority = "baixa" | "media" | "alta" | "urgente";

export type MarketingTarget =
  | "projeto_musical"
  | "artista"
  | "empresa";

export type ProjectType =
  | "lancamento_musical"
  | "videoclipe"
  | "audiovisual"
  | "campanha_institucional"
  | "campanha_promocional"
  | "evento"
  | "conteudo_corporativo"
  | "bastidores"
  | "reuniao"
  | "divulgacao_produto"
  | "divulgacao_servico"
  | "divulgacao_saas"
  | "comunicacao_interna"
  | "comunicacao_externa"
  | "portal_noticias"
  | "projeto_especial";

export type ProjectStatus =
  | "planejamento"
  | "em_andamento"
  | "pausado"
  | "concluido"
  | "cancelado";

export type CampaignType =
  | "institucional"
  | "comercial"
  | "artistica"
  | "promocional"
  | "lancamento_musical"
  | "produto"
  | "servico"
  | "saas"
  | "evento"
  | "conteudo"
  | "branding"
  | "trafego_pago"
  | "organica";

export type CampaignStatus =
  | "rascunho"
  | "agendada"
  | "ativa"
  | "pausada"
  | "concluida"
  | "cancelada";

export type ContentChannel =
  | "instagram"
  | "facebook"
  | "tiktok"
  | "youtube"
  | "twitter"
  | "threads"
  | "linkedin"
  | "shorts"
  | "reels"
  | "stories"
  | "blog"
  | "portal_noticias"
  | "podcast"
  | "campanha"
  | "material_publicitario"
  | "evento_interno"
  | "evento_externo"
  | "reuniao"
  | "bastidores";

export type ContentType =
  | "post"
  | "feed"
  | "stories"
  | "reels"
  | "shorts"
  | "video"
  | "carrossel"
  | "anuncio"
  | "rede_social"
  | "institucional"
  | "comercial"
  | "artista"
  | "bastidores"
  | "reuniao"
  | "evento"
  | "portal"
  | "blog"
  | "publicidade";

export type ContentStatus =
  | "ideia"
  | "producao"
  | "revisao"
  | "agendado"
  | "publicado"
  | "falhou"
  | "atrasado";

export type ApprovalStatus =
  | "pendente"
  | "aprovado"
  | "reprovado"
  | "ajustes_solicitados";

export type BriefingType =
  | "campanha"
  | "conteudo"
  | "design"
  | "audiovisual"
  | "institucional"
  | "comercial"
  | "artistico"
  | "evento"
  | "produto"
  | "servico"
  | "saas"
  | "portal_noticias"
  | "bastidores";

export type BriefingStatus = "rascunho" | "em_revisao" | "aprovado" | "arquivado";

export type TaskType =
  | "design"
  | "audiovisual"
  | "copywriting"
  | "publicacao"
  | "campanha"
  | "planejamento"
  | "aprovacao"
  | "revisao"
  | "analise"
  | "reuniao"
  | "bastidor"
  | "conteudo_institucional"
  | "conteudo_comercial"
  | "conteudo_artistico"
  | "portal"
  | "crm"
  | "trafego_pago"
  // Design
  | "capa"
  | "banner"
  | "press_kit"
  | "flyer"
  | "arte_redes_sociais"
  | "identidade_visual"
  | "thumbnail"
  | "material_promocional"
  // Audiovisual
  | "videoclipe"
  | "video_redes_sociais"
  | "making_of"
  | "bastidores"
  | "lyric_video"
  | "visualizer"
  | "entrevista"
  | "podcast_video"
  | "captacao_evento"
  // Comercial / CRM
  | "prospeccao"
  | "negociacao"
  | "follow_up"
  | "relacionamento"
  // Distribuição Digital
  | "planejamento_lancamento"
  // Empresa (corporativo)
  | "material_institucional"
  | "apresentacao_comercial"
  | "folder"
  | "video_institucional"
  | "bastidores_empresa"
  | "cobertura_evento_corporativo"
  | "entrevista_corporativa"
  | "campanha_institucional"
  | "branding"
  | "posicionamento_marca"
  | "comunicados"
  | "relacionamento_parceiros"
  | "parcerias"
  // Artista (gestão de carreira)
  | "planejamento_carreira"
  | "gestao_agenda"
  | "planejamento_estrategico"
  | "assessoria_imprensa"
  | "release"
  | "branding_pessoal"
  | "posicionamento"
  | "estrategias_crescimento"
  | "sessao_fotos"
  | "conteudo_redes_sociais"
  | "contratacoes"
  | "shows"
  // Projeto Musical (lançamento/obra)
  | "motion_cover"
  | "arte_divulgacao"
  | "teaser"
  | "conteudo_lancamento"
  | "distribuicao"
  | "metadata"
  | "pitching"
  | "pre_save"
  | "campanha_lancamento"
  | "divulgacao"
  | "influenciadores"
  | "aprovacao_conteudo";

export type TaskStatus =
  | "backlog"
  | "a_fazer"
  | "em_andamento"
  | "revisao"
  | "concluida"
  | "bloqueada";

export type AssetCategory =
  | "capa"
  | "arte_promocional"
  | "banner"
  | "logo"
  | "identidade_visual"
  | "fotografia"
  | "reels"
  | "video"
  | "teaser"
  | "shorts"
  | "press_kit"
  | "template"
  | "documento_estrategico"
  | "material_institucional"
  | "material_comercial"
  | "material_bastidores"
  | "material_reuniao"
  | "arquivo_portal"
  | "asset_campanha";

export type AutomationFlowType =
  | "lancamento_musical"
  | "conteudo_corporativo"
  | "bastidores"
  | "evento"
  | "produto_servico_saas";

// ---------------------------------------------------------------------------
// Value objects
// ---------------------------------------------------------------------------

export interface LinkedFile {
  id: ID;
  name: string;
  url: string;
  /** MIME-ish hint, e.g. "image/png", "application/pdf". */
  kind?: string;
  sizeKb?: number;
}

/** Música de referência (WAV) herdada do Projeto Musical para uma tarefa. */
export interface ReferenceAudio {
  fileName: string;
  url: string;
  /** Data do upload do arquivo no projeto (quando disponível). */
  uploadedAt?: ISODate;
  /** Usuário responsável pelo upload (quando disponível). */
  uploadedBy?: string;
}

export interface ChecklistItem {
  id: ID;
  label: string;
  done: boolean;
}

export interface Comment {
  id: ID;
  author: string;
  message: string;
  createdAt: ISODate;
}

export interface HistoryEntry {
  id: ID;
  action: string;
  author: string;
  at: ISODate;
}

export interface MetricSnapshot {
  reach: number;
  impressions: number;
  engagement: number;
  clicks: number;
  conversions: number;
  /** Return over investment, ratio (e.g. 3.2 = 320%). */
  roi: number;
  /** Cost per result, in BRL. */
  costPerResult: number;
}

// ---------------------------------------------------------------------------
// Entities
// ---------------------------------------------------------------------------

export interface MarketingProject {
  id: ID;
  name: string;
  type: ProjectType;
  status: ProjectStatus;
  priority: Priority;
  owner: string;
  team: string[];
  startDate: ISODate;
  endDate: ISODate;
  objective: string;
  audience: string;
  channels: ContentChannel[];
  description: string;
  /** Optional links to other entities by id. */
  taskIds: ID[];
  campaignIds: ID[];
  contentIds: ID[];
  briefingIds: ID[];
  files: LinkedFile[];
  /** Optional artist this project belongs to. */
  artistId?: ID;
  progress: number;
  createdAt: ISODate;
  updatedAt: ISODate;
}

export interface MarketingCampaign {
  id: ID;
  name: string;
  targetType?: MarketingTarget;
  targetId?: ID;
  targetName?: string;
  type: CampaignType;
  objective: string;
  audience: string;
  segmentation: string;
  budget: number;
  startDate: ISODate;
  endDate: ISODate;
  platforms: ContentChannel[];
  status: CampaignStatus;
  owner: string;
  projectId?: ID;
  creativeAssetIds: ID[];
  contentIds: ID[];
  metrics: MetricSnapshot;
  notes: string;
  createdAt: ISODate;
  updatedAt: ISODate;
}

export interface CampaignBuilderConfig {
  objectives: Array<{ value: string; label: string; description: string }>;
  expectedOutcomes: Record<string, string[]>;
  promotedEntityTypes: string[];
  platforms: Record<string, { objectives: string[]; creatives: string[]; placements: string[] }>;
  creativeTypes: string[];
  statusLifecycle: string[];
  compatibilityRules: string[];
  defaultRecommendations: Record<string, string[]>;
}

export interface MarketingContent {
  id: ID;
  title: string;
  targetType?: MarketingTarget;
  targetId?: ID;
  targetName?: string;
  type: ContentType;
  /** Plataforma principal (dirige formato/preview). Mantida por compatibilidade. */
  channel: ContentChannel;
  /** Todas as plataformas de publicação selecionadas (multiplataforma). */
  channels?: ContentChannel[];
  status: ContentStatus;
  publishDate: ISODate;
  publishTime: string;
  owner: string;
  projectId?: ID;
  campaignId?: ID;
  releaseId?: ID;
  format?: string;
  files: LinkedFile[];
  copy: string;
  notes: string;
  approval: ApprovalStatus;
  /** Free-form persisted extras (e.g. `creative` — see CreativeConfig in Calendario.tsx). Backend column: jsonb, merged on update, never replaced. */
  metadata?: Record<string, unknown>;
  createdAt: ISODate;
  updatedAt: ISODate;
}

export interface MarketingBriefing {
  id: ID;
  title: string;
  type: BriefingType;
  status: BriefingStatus;
  objective: string;
  context: string;
  audience: string;
  positioning: string;
  tone: string;
  requirements?: string;
  creativeDirection?: string;
  references: string;
  visualGuidelines: string;
  textGuidelines: string;
  market?: string;
  competitors?: string;
  trends?: string;
  channels: ContentChannel[];
  restrictions: string;
  resources?: string;
  expectations?: string;
  deliverables: string[];
  timeline?: string;
  executionPlan?: string;
  aiRecommendations?: string;
  deadline: ISODate;
  owners: string[];
  projectId?: ID;
  campaignId?: ID;
  files: LinkedFile[];
  createdAt: ISODate;
  updatedAt: ISODate;
}

export interface MarketingTask {
  id: ID;
  title: string;
  description: string;
  targetType?: MarketingTarget;
  targetId?: ID;
  targetName?: string;
  type: TaskType;
  status: TaskStatus;
  priority: Priority;
  owner: string;
  sector: string;
  deadline: ISODate;
  projectId?: ID;
  campaignId?: ID;
  briefingId?: ID;
  /** Optional link to a musical release (lançamento). */
  releaseId?: ID;
  /** Optional link to a scheduled content piece. */
  contentId?: ID;
  files: LinkedFile[];
  /**
   * Música de referência (WAV) vinculada automaticamente a partir do Projeto
   * Musical. Exclusivo do contexto "projeto_musical" — tarefas de Empresa/Artista
   * não possuem este vínculo. Preenchido pelo sistema, sem upload manual.
   */
  referenceAudio?: ReferenceAudio;
  checklist: ChecklistItem[];
  comments: Comment[];
  history: HistoryEntry[];
  dependencies: ID[];
  /** Set when this task was generated by an automation flow. */
  automationFlowId?: ID;
  createdAt: ISODate;
  updatedAt: ISODate;
}

// ---------------------------------------------------------------------------
// Deliverables (Entregáveis)
//
// Creative files are produced *inside the task* responsible for them — never in
// an isolated library. A deliverable keeps its full version history (uploading
// a new file adds a version, it never overwrites), an approval lifecycle and a
// comment thread. Because it lives on a task, it is automatically reachable by
// whatever that task is linked to (release, campaign, content, briefing,
// project) — no re-upload needed.
// ---------------------------------------------------------------------------

export type DeliverableType =
  | "cover_art"
  | "banner"
  | "thumbnail"
  | "artwork"
  | "logo"
  | "brand_asset"
  | "video_clip"
  | "teaser"
  | "visualizer"
  | "lyric_video"
  | "reels"
  | "shorts"
  | "stories"
  | "audio"
  | "document"
  | "press_kit"
  | "release"
  | "template"
  | "other";

export type DeliverableApproval = "pendente" | "em_revisao" | "aprovado" | "rejeitado";

export interface DeliverableVersion {
  id: ID;
  /** 1-based version number. */
  version: number;
  fileUrl: string;
  fileName: string;
  mimeType: string;
  /** Size in bytes. */
  fileSize: number;
  createdBy: string;
  createdAt: ISODate;
  /** Optional note describing what changed in this version. */
  note?: string;
}

export interface DeliverableComment {
  id: ID;
  author: string;
  message: string;
  createdAt: ISODate;
}

export interface MarketingDeliverable {
  id: ID;
  /** Owning task — the operational context that produced the file. */
  taskId: ID;
  title: string;
  description: string;
  type: DeliverableType;
  approval: DeliverableApproval;
  /** Mirror of the latest version's file (current file). */
  fileUrl: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  /** Current version number (equals versions.length). */
  version: number;
  versions: DeliverableVersion[];
  comments: DeliverableComment[];
  approvedBy?: string;
  approvedAt?: ISODate;
  createdBy: string;
  createdAt: ISODate;
  updatedAt: ISODate;
}

export interface MarketingAsset {
  id: ID;
  name: string;
  category: AssetCategory;
  projectId?: ID;
  taskId?: ID;
  sourceDepartment?: "design" | "audiovisual" | "marketing" | "conteudo" | "operacoes" | string;
  campaignId?: ID;
  artistId?: ID;
  department?: string;
  owner: string;
  approval: ApprovalStatus;
  url: string;
  thumbnailUrl?: string;
  tags: string[];
  notes: string;
  createdAt: ISODate;
  updatedAt: ISODate;
}

export interface ActivityEvent {
  id: ID;
  /** Entity kind the activity refers to. */
  entity: "project" | "campaign" | "content" | "task" | "briefing" | "asset";
  action: string;
  subject: string;
  author: string;
  at: ISODate;
}

// ---------------------------------------------------------------------------
// Automations
// ---------------------------------------------------------------------------

export interface AutomationStep {
  sector: string;
  task: string;
  type: TaskType;
}

export interface AutomationFlow {
  id: ID;
  type: AutomationFlowType;
  name: string;
  description: string;
  steps: AutomationStep[];
}

export interface AutomationRun {
  id: ID;
  flowId: ID;
  flowType: AutomationFlowType;
  triggeredBy: string;
  /** Free-form reference, e.g. a release name or product name. */
  reference: string;
  generatedTaskIds: ID[];
  at: ISODate;
}

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------

export type AnalyticsDimension =
  | "projeto_musical"
  | "campanha"
  | "canal"
  | "periodo"
  | "responsavel"
  | "tipo_conteudo"
  | "artista"
  | "empresa";

export interface AnalyticsSeriesPoint {
  label: string;
  reach: number;
  engagement: number;
  conversions: number;
}

export interface AnalyticsBreakdownRow {
  key: string;
  label: string;
  reach: number;
  impressions: number;
  engagement: number;
  clicks: number;
  conversions: number;
  roi: number;
}

export interface AnalyticsOverview {
  totals: MetricSnapshot & {
    audienceGrowth: number;
    approvalRate: number;
    deliveries: number;
    tasksDone: number;
    activeProjects: number;
    publishedContents: number;
    lateContents: number;
    runningCampaigns: number;
  };
  series: AnalyticsSeriesPoint[];
  breakdownByDimension: Record<AnalyticsDimension, AnalyticsBreakdownRow[]>;
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export interface DashboardKpis {
  activeCampaigns: number;
  activeProjects: number;
  scheduledContents: number;
  pendingTasks: number;
  openBriefings: number;
  pendingApprovals: number;
  upcomingDeliveries: number;
  sectorPerformance: number;
}

export interface DashboardAlert {
  id: ID;
  level: "info" | "warning" | "critical";
  message: string;
}

export interface DashboardData {
  kpis: DashboardKpis;
  alerts: DashboardAlert[];
  recentActivity: ActivityEvent[];
  upcomingContents: MarketingContent[];
  pendingApprovals: MarketingContent[];
}

// ---------------------------------------------------------------------------
// AI
// ---------------------------------------------------------------------------

export type AiTaskKind =
  | "analise_fonograma"
  | "analise_letra"
  | "planejamento_campanha"
  | "sugestao_conteudo"
  | "legenda"
  | "roteiro"
  | "analise_artista"
  | "analise_marca"
  | "analise_empresa"
  | "pitch_playlist"
  | "pitch_imprensa"
  | "posicionamento"
  | "calendario_editorial"
  | "conteudo_bastidores"
  | "conteudo_corporativo";

export interface AiAudioMetadata {
  fileName: string;
  fileSize: number;
  mimeType: string;
  extension: string;
  lastModified: number;
  durationSeconds?: number;
}

export interface AiGenerationPayload {
  kind: AiTaskKind;
  targetType: MarketingTarget;
  targetId?: ID;
  targetName: string;
  prompt: string;
  lyricText?: string;
  audioFile?: File;
  audioUrl?: string;
  coverUrl?: string;
  audioMetadata?: AiAudioMetadata;
  releaseMetadata?: Record<string, string | number | null | undefined>;
  profileData?: Record<string, unknown>;
  campaignObjective?: string;
  releasePhase?: string;
  genre?: string;
  references?: string;
  audience?: string;
  channels?: ContentChannel[];
}

export interface AiGeneratedResult {
  summary: string;
  creativeDirection: string;
  strengths: string[];
  risks: string[];
  audience: string[];
  positioning: string[];
  contentIdeas: string[];
  campaignIdeas: string[];
  pitchSuggestions: string[];
  nextActions: string[];
}

export interface AiSuggestion {
  id: ID;
  kind: AiTaskKind;
  targetType?: MarketingTarget;
  targetId?: ID;
  targetName?: string;
  prompt: string;
  lyricText?: string;
  audioUrl?: string;
  coverUrl?: string;
  audioMetadata?: AiAudioMetadata;
  releaseMetadata?: Record<string, string | number | null | undefined>;
  profileData?: Record<string, unknown>;
  campaignObjective?: string;
  releasePhase?: string;
  genre?: string;
  references?: string;
  audience?: string;
  channels?: ContentChannel[];
  output: AiGeneratedResult | string[];
  at: ISODate;
}

// ---------------------------------------------------------------------------
// Generic create payloads (id/timestamps are assigned by the service)
// ---------------------------------------------------------------------------

export type CreateInput<T> = Omit<T, "id" | "createdAt" | "updatedAt">;

// ---------------------------------------------------------------------------
// Metas (marketing goals / targets)
//
// Restored to its original shape because it is consumed outside the module
// (artist module's 360 view). Backed by hooks/useMetas.
// ---------------------------------------------------------------------------

export type MetaTipo =
  | "seguidores"
  | "streams"
  | "shows"
  | "receita"
  | "engajamento"
  | "lancamentos"
  | "personalizada";

export type MetaStatus =
  | "em_progresso"
  | "em_andamento"
  | "ativa"
  | "concluida"
  | "concluido"
  | "pausada"
  | "cancelada";

export interface Meta {
  id: string;
  nome: string;
  /** Legacy artist-360 label. Prefer nome in new marketing code. */
  title?: string;
  descricao: string;
  type: MetaTipo;
  /** Legacy artist-360 type. Prefer type in new marketing code. */
  tipo_meta?: string;
  categoria: string;
  valorAlvo: number;
  /** Legacy artist-360 target value. Prefer valorAlvo in new marketing code. */
  valor_meta?: number;
  valorAtual: number;
  /** Legacy artist-360 current value. Prefer valorAtual in new marketing code. */
  valor_atual?: number;
  unidade: string;
  prazo: string;
  start_date?: string | null;
  end_date?: string | null;
  artist_id?: string | number | null;
  status: MetaStatus;
  progresso: number;
  responsavel: string;
  createdAt: string;
  updatedAt: string;
  cor: string;
  icone: string;
}

export interface CreateMetaInput {
  nome?: string;
  title?: string;
  descricao: string;
  type?: MetaTipo | string;
  tipo_meta?: string;
  categoria: string;
  valorAlvo?: number;
  valor_meta?: number;
  valorAtual?: number;
  valor_atual?: number;
  unidade: string;
  prazo?: string;
  start_date?: string | null;
  end_date?: string | null;
  artist_id?: string | number | null;
  status?: MetaStatus;
  responsavel?: string;
  cor?: string;
  icone?: string;
  progresso?: number;
}

export interface UpdateMetaInput extends Partial<CreateMetaInput> {
  id: string;
}

