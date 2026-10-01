/**
 * Marketing Module — Domain Types
 *
 * Single source of truth for every entity handled by the Marketing module.
 * Covers artistic, corporate, commercial, product/service/SaaS, events,
 * behind-the-scenes (bastidores), meetings and institutional communication.
 *
 * Pure type declarations only — no runtime values and only type imports from
 * the shared contract package. Runtime vocabulary (labels, colors, option
 * lists) lives in ../constants.
 */

import type { ArtistGoalStatus } from "@music-os-360/types";

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

export type ID = string;
/** ISO-8601 date string (e.g. "2026-05-31" or full datetime). */
export type ISODate = string;

// ---------------------------------------------------------------------------
// Shared enumerations (string-literal unions; option lists live in constants)
// ---------------------------------------------------------------------------

/**
 * Canonical (technical, English) priority. Equal to the persisted value
 * (chk_marketing_tasks_priority); PT-BR labels live in PRIORITY_LABEL.
 */
export type Priority = "low" | "normal" | "high" | "urgent";

export type MarketingTarget =
  | "music_project"
  | "artist"
  | "company";

export type ProjectType =
  | "music_release"
  | "music_video"
  | "audiovisual"
  | "institutional_campaign"
  | "promotional_campaign"
  | "event"
  | "corporate_content"
  | "behind_the_scenes"
  | "meeting"
  | "product_promotion"
  | "service_promotion"
  | "saas_promotion"
  | "internal_communication"
  | "external_communication"
  | "news_portal"
  | "special_project";

export type ProjectStatus =
  | "planning"
  | "active"
  | "paused"
  | "completed"
  | "cancelled";

export type CampaignType =
  | "institutional"
  | "commercial"
  | "artistic"
  | "promotional"
  | "music_release"
  | "product"
  | "service"
  | "saas"
  | "event"
  | "content"
  | "branding"
  | "paid_traffic"
  | "organic";

/** Canonical English; the campaign-builder API lifecycle (lower-cased) plus `cancelled`. */
export type CampaignStatus =
  | "draft"
  | "ready"
  | "pending_review"
  | "scheduled"
  | "active"
  | "paused"
  | "rejected"
  | "completed"
  | "failed"
  | "archived"
  | "cancelled";

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
  | "news_portal"
  | "podcast"
  | "campaign"
  | "advertising_material"
  | "internal_event"
  | "external_event"
  | "meeting"
  | "behind_the_scenes";

export type ContentType =
  | "post"
  | "feed"
  | "stories"
  | "reels"
  | "shorts"
  | "video"
  | "carousel"
  | "ad"
  | "social_media"
  | "institutional"
  | "commercial"
  | "artist"
  | "behind_the_scenes"
  | "meeting"
  | "event"
  | "portal"
  | "blog"
  | "advertising";

/**
 * Persisted content lifecycle, identical to chk_marketing_content_posts_status.
 * PT-BR labels live in CONTENT_STATUS_LABEL. The former web-only pipeline
 * stages (idea / production / review) were never persistable (the API rejected
 * them) and are gone; see ContentDisplayStatus for the derived `overdue`.
 */
export type ContentStatus =
  | "draft"
  | "scheduled"
  | "published"
  | "cancelled"
  | "failed";

/**
 * What the UI shows: the persisted status, plus `overdue` -- derived, never
 * stored: a `scheduled` content whose publish date/time has already passed
 * (see deriveContentDisplayStatus).
 */
export type ContentDisplayStatus = ContentStatus | "overdue";

/**
 * Canonical (technical, English) approval state of a content or asset. Same
 * vocabulary as the asset-approval API (marketing-assets.dto.ts); PT-BR labels
 * live in APPROVAL_STATUS_LABEL. A content's approval is persisted in
 * marketing_content_posts.metadata.approval (chk_marketing_content_posts_metadata_approval).
 */
export type ApprovalStatus = "pending" | "approved" | "rejected" | "revision_requested";

export type BriefingType =
  | "campaign"
  | "content"
  | "design"
  | "audiovisual"
  | "institutional"
  | "commercial"
  | "artistic"
  | "event"
  | "product"
  | "service"
  | "saas"
  | "news_portal"
  | "behind_the_scenes";

// Canonical values match packages/types/src/enums.ts's BriefingStatus and the
// live chk_briefings_status DB constraint -- display labels stay PT-BR (see
// BRIEFING_STATUS_LABEL), only the wire-level value is the English enum.
export type BriefingStatus = "draft" | "in_progress" | "review" | "approved" | "completed" | "cancelled";

export type TaskType =
  | "design"
  | "audiovisual"
  | "copywriting"
  | "publishing"
  | "campaign"
  | "planning"
  | "approval"
  | "review"
  | "analysis"
  | "meeting"
  | "behind_the_scenes_shot"
  | "institutional_content"
  | "commercial_content"
  | "artistic_content"
  | "portal"
  | "crm"
  | "paid_traffic"
  // Design
  | "cover"
  | "banner"
  | "press_kit"
  | "flyer"
  | "social_media_art"
  | "visual_identity"
  | "thumbnail"
  | "promotional_material"
  // Audiovisual
  | "music_video"
  | "social_media_video"
  | "making_of"
  | "behind_the_scenes"
  | "lyric_video"
  | "visualizer"
  | "interview"
  | "podcast_video"
  | "event_coverage"
  // Comercial / CRM
  | "prospecting"
  | "negotiation"
  | "follow_up"
  | "relationship"
  // Digital distribution
  | "release_planning"
  // Company (corporate)
  | "institutional_material"
  | "commercial_presentation"
  | "folder"
  | "institutional_video"
  | "company_behind_the_scenes"
  | "corporate_event_coverage"
  | "corporate_interview"
  | "institutional_campaign"
  | "branding"
  | "brand_positioning"
  | "announcements"
  | "partner_relationship"
  | "partnerships"
  // Artist (career management)
  | "career_planning"
  | "schedule_management"
  | "strategic_planning"
  | "press_relations"
  | "release"
  | "personal_branding"
  | "positioning"
  | "growth_strategies"
  | "photo_session"
  | "social_media_content"
  | "contracting"
  | "shows"
  // Music project (release/work)
  | "motion_cover"
  | "promotional_art"
  | "teaser"
  | "release_content"
  | "distribution"
  | "metadata"
  | "pitching"
  | "pre_save"
  | "release_campaign"
  | "promotion"
  | "influencers"
  | "content_approval";

/**
 * Canonical (technical, English) task status. Equal to the persisted value
 * (chk_marketing_tasks_status); PT-BR labels live in TASK_STATUS_LABEL.
 * `backlog` is a distinct persisted state (own board column, own DB value).
 */
export type TaskStatus =
  | "backlog"
  | "pending"
  | "in_progress"
  | "review"
  | "blocked"
  | "done"
  | "cancelled";

export type AssetCategory =
  | "cover"
  | "promotional_art"
  | "banner"
  | "logo"
  | "visual_identity"
  | "photography"
  | "reels"
  | "video"
  | "teaser"
  | "shorts"
  | "press_kit"
  | "template"
  | "strategic_document"
  | "institutional_material"
  | "commercial_material"
  | "behind_the_scenes_material"
  | "meeting_material"
  | "portal_file"
  | "campaign_asset";

export type AutomationFlowType =
  | "music_release"
  | "corporate_content"
  | "behind_the_scenes"
  | "event"
  | "product_service_saas";

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

/** Reference track (WAV) inherited from the music project for a task. */
export interface ReferenceAudio {
  fileName: string;
  url: string;
  /** Upload date of the file in the project (when available). */
  uploadedAt?: ISODate;
  /** User responsible for the upload (when available). */
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
  /**
   * CODEBASE_MAP Gotcha #16: true when reach/impressions/engagement/clicks/
   * conversions are a budget-derived estimate (estimateCampaignResults), not
   * data measured by a real ad-platform integration -- which is every
   * campaign today, since publish() never actually calls one. Absent/undefined
   * (pre-existing campaigns created before this field existed) is treated as
   * estimated too; only an explicit `false`, written once a real integration
   * exists, means "measured."
   */
  isEstimated?: boolean;
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
  /** Main platform (drives format/preview). Kept for compatibility. */
  channel: ContentChannel;
  /** Every selected publishing platform (multi-platform). */
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
  /** Free-form persisted extras (e.g. `creative` — see CreativeConfig in Calendar.tsx). Backend column: jsonb, merged on update, never replaced. */
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
  /** Optional link to a musical release. */
  releaseId?: ID;
  /** Optional link to a scheduled content piece. */
  contentId?: ID;
  files: LinkedFile[];
  /**
   * Reference track (WAV) linked automatically from the music
   * project. Exclusive to the "music_project" context — company/artist tasks
   * do not have this link. Filled by the system, without manual upload.
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
// Deliverables
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

export type DeliverableApproval = "pending" | "in_review" | "approved" | "rejected";

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
  sourceDepartment?: "design" | "audiovisual" | "marketing" | "content" | "operations" | string;
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
  | "music_project"
  | "campaign"
  | "channel"
  | "period"
  | "owner"
  | "content_type"
  | "artist"
  | "company";

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
  | "phonogram_analysis"
  | "lyrics_analysis"
  | "campaign_planning"
  | "content_suggestion"
  | "caption"
  | "script"
  | "artist_analysis"
  | "brand_analysis"
  | "company_analysis"
  | "playlist_pitch"
  | "press_pitch"
  | "positioning"
  | "editorial_calendar"
  | "behind_the_scenes_content"
  | "corporate_content";

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
// Artist goals (artist_goals)
//
// Consumed outside the module (artist module's 360 view). Backed by
// hooks/useGoals. Values are the canonical technical contract; PT-BR labels
// live in the components that render them.
// ---------------------------------------------------------------------------

export type GoalType =
  | "streams"
  | "followers"
  | "shows"
  | "revenue"
  | "engagement"
  | "releases"
  | "other";

export type GoalCategory = "growth" | "financial" | "production" | "marketing" | "career";

export interface Goal {
  id: string;
  title: string;
  description: string;
  type: GoalType;
  category: string;
  targetValue: number;
  currentValue: number;
  unit: string;
  startDate: string | null;
  endDate: string | null;
  artistId: string | null;
  status: ArtistGoalStatus;
  progress: number;
  owner: string;
  color: string;
  icon: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateGoalInput {
  artistId: string;
  title: string;
  description?: string;
  type: GoalType;
  category?: string;
  targetValue: number;
  currentValue?: number;
  unit?: string;
  startDate?: string | null;
  endDate?: string | null;
  status?: ArtistGoalStatus;
  owner?: string;
  color?: string;
  icon?: string;
}

export interface UpdateGoalInput extends Partial<CreateGoalInput> {
  id: string;
}

