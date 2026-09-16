import { api } from "@/shared/lib/api-client";
import {
  CAMPAIGN_TYPE_LABEL,
  CONTENT_CHANNEL_LABEL,
  CONTENT_TYPE_LABEL,
} from "../constants/marketing.constants";
import { getFormatViolation } from "../config/social-formats";
import type {
  ActivityEvent,
  AiSuggestion,
  AnalyticsBreakdownRow,
  AnalyticsDimension,
  AnalyticsOverview,
  CampaignBuilderConfig,
  CreateInput,
  DashboardData,
  DeliverableApproval,
  ID,
  MarketingAsset,
  MarketingBriefing,
  MarketingCampaign,
  MarketingContent,
  MarketingDeliverable,
  MarketingProject,
  MarketingTask,
  MetricSnapshot,
} from "../types/marketing.types";

type ApiList<T> = T[] | { data: T[]; meta?: Record<string, unknown> };
type RecordRow = Record<string, any>;

function rows<T>(value: ApiList<T>): T[] {
  if (Array.isArray(value)) return value;
  if (value && Array.isArray(value.data)) return value.data;
  throw new Error("[marketing] resposta de lista inválida recebida da API");
}

function metadata(row: RecordRow): RecordRow {
  return row.metadata && typeof row.metadata === "object" ? row.metadata : {};
}

function iso(value: unknown): string {
  if (!value) return "";
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
}

function assertValidContent(channel: string, type: string, files: { kind?: string }[]): void {
  const violation = getFormatViolation(channel, type, files);
  if (violation) throw new Error(`[marketing] ${violation}`);
}

interface ResourceLike<T extends { id: ID; createdAt: string; updatedAt: string }> {
  list(): Promise<T[]>;
  create(input: CreateInput<T>): Promise<T>;
  update(id: ID, patch: Partial<T>, expectedUpdatedAt?: string): Promise<T>;
  remove(id: ID): Promise<{ id: ID }>;
}

function projectFromApi(row: RecordRow): MarketingProject {
  const meta = metadata(row);
  return {
    id: row.id,
    name: row.title,
    type: String(row.type ?? "custom").toLowerCase(),
    status: meta.uiStatus ?? row.status ?? "planejamento",
    priority: meta.uiPriority ?? row.priority ?? "media",
    owner: meta.owner ?? "",
    team: meta.team ?? [],
    startDate: row.starts_at ?? "",
    endDate: row.ends_at ?? "",
    objective: meta.objective ?? "",
    audience: meta.audience ?? "",
    channels: meta.channels ?? [],
    description: row.description ?? "",
    taskIds: meta.taskIds ?? [],
    campaignIds: meta.campaignIds ?? [],
    contentIds: meta.contentIds ?? [],
    briefingIds: meta.briefingIds ?? [],
    files: meta.files ?? [],
    artistId: row.artist_id ?? undefined,
    progress: Number(meta.progress ?? 0),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  } as MarketingProject;
}

function projectToApi(input: Partial<MarketingProject>) {
  return {
    type: String(input.type ?? "custom").toUpperCase(),
    title: input.name,
    description: input.description,
    status: input.status === "em_andamento" ? "active" : input.status,
    priority: input.priority === "media" ? "normal" : input.priority,
    artistId: input.artistId,
    startsAt: input.startDate || null,
    endsAt: input.endDate || null,
    metadata: {
      uiStatus: input.status,
      uiPriority: input.priority,
      owner: input.owner,
      team: input.team,
      objective: input.objective,
      audience: input.audience,
      channels: input.channels,
      taskIds: input.taskIds,
      campaignIds: input.campaignIds,
      contentIds: input.contentIds,
      briefingIds: input.briefingIds,
      files: input.files,
      progress: input.progress,
    },
  };
}

const projectsApi: ResourceLike<MarketingProject> = {
  async list() {
    return rows(await api.get<ApiList<RecordRow>>("/marketing/projects?limit=100")).map(projectFromApi);
  },
  async create(input) {
    return projectFromApi(await api.post<RecordRow>("/marketing/projects", projectToApi(input)));
  },
  async update(id, patch) {
    const current = projectFromApi(await api.get<RecordRow>(`/marketing/projects/${id}`));
    return projectFromApi(await api.patch<RecordRow>(
      `/marketing/projects/${id}`,
      projectToApi({ ...current, ...patch }),
    ));
  },
  async remove(id) {
    await api.delete(`/marketing/projects/${id}`);
    return { id };
  },
};

function campaignFromApi(row: RecordRow): MarketingCampaign {
  const builder = metadata(row).marketingBuilder;
  const payload = builder?.payload ?? row;
  const meta = metadata(row);
  const metrics = (payload.metrics ?? meta.metrics ?? {}) as Partial<MetricSnapshot>;
  return {
    id: row.id,
    name: payload.name ?? row.nome ?? "",
    targetType: payload.promotedEntityType?.toLowerCase(),
    targetId: payload.promotedEntityId,
    targetName: payload.promotedEntityName,
    type: payload.type ?? meta.type ?? "trafego",
    objective: payload.objective ?? row.objetivo ?? "",
    audience: typeof payload.audience === "string" ? payload.audience : JSON.stringify(payload.audience ?? {}),
    segmentation: payload.segmentation ?? "",
    budget: Number(payload.totalBudget ?? payload.dailyBudget ?? row.orcamento ?? 0),
    startDate: payload.startDate ?? row.start_date ?? "",
    endDate: payload.endDate ?? row.end_date ?? "",
    platforms: payload.platforms ?? [],
    status: String(row.status ?? payload.status ?? "DRAFT").toLowerCase(),
    owner: payload.owner ?? "",
    projectId: payload.projectId,
    creativeAssetIds: payload.creativeAssetIds ?? [],
    contentIds: payload.contentIds ?? [],
    metrics: {
      reach: Number(metrics.reach ?? 0),
      impressions: Number(metrics.impressions ?? 0),
      engagement: Number(metrics.engagement ?? 0),
      clicks: Number(metrics.clicks ?? 0),
      conversions: Number(metrics.conversions ?? 0),
      roi: Number(metrics.roi ?? 0),
      costPerResult: Number(metrics.costPerResult ?? 0),
      // CODEBASE_MAP Gotcha #16: absent (every campaign created before this field
      // existed) defaults to estimated too -- only an explicit `false` means measured.
      isEstimated: metrics.isEstimated !== false,
    },
    notes: payload.notes ?? "",
    createdAt: iso(row.createdAt ?? row.created_at),
    updatedAt: iso(row.updatedAt ?? row.updated_at),
  } as MarketingCampaign;
}

function campaignToBuilder(input: Partial<MarketingCampaign>) {
  return {
    name: input.name,
    objective: input.objective,
    promotedEntityType: input.targetType?.toUpperCase(),
    promotedEntityId: input.targetId,
    promotedEntityName: input.targetName,
    platforms: input.platforms,
    totalBudget: input.budget,
    budgetType: "TOTAL",
    startDate: input.startDate,
    endDate: input.endDate,
    audience: input.audience ? { description: input.audience } : {},
    type: input.type,
    owner: input.owner,
    projectId: input.projectId,
    creativeAssetIds: input.creativeAssetIds,
    contentIds: input.contentIds,
    metrics: input.metrics,
    notes: input.notes,
  };
}

const campaignsApi: ResourceLike<MarketingCampaign> = {
  async list() {
    return rows(await api.get<ApiList<RecordRow>>("/marketing/campaigns")).map(campaignFromApi);
  },
  async create(input) {
    return campaignFromApi(await api.post<RecordRow>("/marketing/campaigns/draft", campaignToBuilder(input)));
  },
  async update(id, patch, expectedUpdatedAt) {
    const current = campaignFromApi(await api.get<RecordRow>(`/marketing/campaigns/${id}`));
    return campaignFromApi(await api.patch<RecordRow>(
      `/marketing/campaigns/${id}`,
      { ...campaignToBuilder({ ...current, ...patch }), expectedUpdatedAt },
    ));
  },
  async remove(id) {
    await api.post(`/marketing/campaigns/${id}/archive`, {});
    return { id };
  },
};

function contentFromApi(row: RecordRow): MarketingContent {
  return {
    ...row,
    approval: row.approval ?? metadata(row).approval ?? "pendente",
    files: row.files ?? [],
    notes: row.notes ?? "",
    owner: row.owner ?? "",
    createdAt: iso(row.createdAt ?? row.created_at),
    updatedAt: iso(row.updatedAt ?? row.updated_at),
  } as MarketingContent;
}

const contentsApi: ResourceLike<MarketingContent> = {
  async list() {
    return rows(await api.get<ApiList<RecordRow>>("/marketing/contents?limit=100")).map(contentFromApi);
  },
  async create(input) {
    assertValidContent(input.channel, input.type, input.files ?? []);
    return contentFromApi(await api.post<RecordRow>("/marketing/contents", input));
  },
  async update(id, patch, expectedUpdatedAt) {
    if (patch.channel && patch.type) assertValidContent(patch.channel, patch.type, patch.files ?? []);
    return contentFromApi(await api.patch<RecordRow>(`/marketing/contents/${id}`, { ...patch, expectedUpdatedAt }));
  },
  async remove(id) {
    await api.delete(`/marketing/contents/${id}`);
    return { id };
  },
};

function briefingFromApi(row: RecordRow): MarketingBriefing {
  const meta = metadata(row);
  return {
    id: row.id,
    title: row.titulo ?? row.title,
    type: meta.type ?? "campanha",
    status: meta.uiStatus ?? row.status ?? "rascunho",
    objective: meta.objective ?? "",
    context: row.descricao ?? meta.context ?? "",
    audience: meta.audience ?? "",
    positioning: meta.positioning ?? "",
    tone: meta.tone ?? "",
    requirements: meta.requirements,
    creativeDirection: meta.creativeDirection,
    references: meta.references ?? "",
    visualGuidelines: meta.visualGuidelines ?? "",
    textGuidelines: meta.textGuidelines ?? "",
    market: meta.market,
    competitors: meta.competitors,
    trends: meta.trends,
    channels: meta.channels ?? [],
    restrictions: meta.restrictions ?? "",
    resources: meta.resources,
    expectations: meta.expectations,
    deliverables: meta.deliverables ?? [],
    timeline: meta.timeline,
    executionPlan: meta.executionPlan,
    aiRecommendations: meta.aiRecommendations,
    deadline: iso(row.prazo ?? row.dueAt),
    owners: meta.owners ?? [],
    projectId: meta.projectId,
    campaignId: row.campaign_id ?? row.campaignId,
    files: meta.files ?? [],
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  } as MarketingBriefing;
}

function briefingToApi(input: Partial<MarketingBriefing>) {
  return {
    title: input.title,
    campaignId: input.campaignId,
    content: input.context,
    dueAt: input.deadline || undefined,
    status: input.status,
    metadata: {
      ...input,
      uiStatus: input.status,
    },
  };
}

const briefingsApi: ResourceLike<MarketingBriefing> = {
  async list() {
    return rows(await api.get<ApiList<RecordRow>>("/briefings?limit=100")).map(briefingFromApi);
  },
  async create(input) {
    return briefingFromApi(await api.post<RecordRow>("/briefings", briefingToApi(input)));
  },
  async update(id, patch) {
    const current = briefingFromApi(await api.get<RecordRow>(`/briefings/${id}`));
    return briefingFromApi(await api.patch<RecordRow>(
      `/briefings/${id}`,
      briefingToApi({ ...current, ...patch }),
    ));
  },
  async remove(id) {
    await api.delete(`/briefings/${id}`);
    return { id };
  },
};

function taskFromApi(row: RecordRow): MarketingTask {
  const meta = metadata(row);
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? "",
    targetType: meta.targetType,
    targetId: meta.targetId,
    targetName: meta.targetName,
    type: meta.uiType ?? row.kind ?? "outro",
    status: meta.uiStatus ?? row.status ?? "a_fazer",
    priority: meta.uiPriority ?? row.priority ?? "media",
    owner: meta.owner ?? row.assigned_to ?? "",
    sector: meta.sector ?? "",
    deadline: iso(row.due_date),
    projectId: row.marketing_project_id,
    campaignId: meta.campaignId,
    briefingId: meta.briefingId,
    releaseId: meta.releaseId,
    contentId: meta.contentId,
    files: meta.files ?? [],
    referenceAudio: meta.referenceAudio,
    checklist: meta.checklist ?? [],
    comments: meta.comments ?? [],
    history: meta.history ?? [],
    dependencies: row.dependencies ?? [],
    automationFlowId: meta.automationFlowId,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  } as MarketingTask;
}

function taskToApi(input: Partial<MarketingTask>) {
  const marketingProjectId = input.projectId;
  if (!marketingProjectId) {
    throw new Error("[marketing] uma tarefa exige projectId de um Marketing Project persistido");
  }
  return {
    marketingProjectId,
    title: input.title,
    description: input.description,
    status: input.status,
    priority: input.priority,
    kind: input.type,
    assignedTo: input.owner || null,
    dueDate: input.deadline || null,
    dependencies: input.dependencies ?? [],
    metadata: {
      targetType: input.targetType,
      targetId: input.targetId,
      targetName: input.targetName,
      uiType: input.type,
      uiStatus: input.status,
      uiPriority: input.priority,
      owner: input.owner,
      sector: input.sector,
      campaignId: input.campaignId,
      briefingId: input.briefingId,
      releaseId: input.releaseId,
      contentId: input.contentId,
      files: input.files,
      referenceAudio: input.referenceAudio,
      checklist: input.checklist,
      comments: input.comments,
      history: input.history,
      automationFlowId: input.automationFlowId,
    },
  };
}

const tasksApi: ResourceLike<MarketingTask> = {
  async list() {
    return rows(await api.get<ApiList<RecordRow>>("/marketing/tasks?limit=100")).map(taskFromApi);
  },
  async create(input) {
    return taskFromApi(await api.post<RecordRow>("/marketing/tasks", taskToApi(input)));
  },
  async update(id, patch, expectedUpdatedAt) {
    const current = taskFromApi(await api.get<RecordRow>(`/marketing/tasks/${id}`));
    return taskFromApi(await api.patch<RecordRow>(
      `/marketing/tasks/${id}`,
      { ...taskToApi({ ...current, ...patch }), expectedUpdatedAt },
    ));
  },
  async remove(id) {
    await api.delete(`/marketing/tasks/${id}`);
    return { id };
  },
};

function assetFromApi(row: RecordRow): MarketingAsset {
  const meta = metadata(row);
  return {
    id: row.id,
    name: row.title,
    category: String(row.asset_type ?? "OTHER").toLowerCase(),
    projectId: meta.projectId ?? row.marketing_project_id,
    taskId: meta.taskId,
    sourceDepartment: meta.sourceDepartment,
    campaignId: row.campaign_id,
    artistId: row.artist_id,
    department: meta.department,
    owner: meta.owner ?? row.created_by ?? "",
    approval: row.status === "approved" ? "aprovado" : row.status === "rejected" ? "rejeitado" : "pendente",
    url: row.file_url ?? "",
    thumbnailUrl: row.thumbnail_url ?? undefined,
    tags: row.tags ?? [],
    notes: row.description ?? "",
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  } as MarketingAsset;
}

function assetToApi(input: Partial<MarketingAsset>) {
  return {
    title: input.name,
    assetType: String(input.category ?? "other").toUpperCase(),
    fileUrl: input.url,
    description: input.notes,
    thumbnailUrl: input.thumbnailUrl,
    projectId: input.projectId,
    taskId: input.taskId,
    sourceDepartment: input.sourceDepartment ?? input.department,
    campaignId: input.campaignId,
    artistId: input.artistId,
    tags: input.tags,
    metadata: { owner: input.owner, department: input.department },
  };
}

const assetsApi: ResourceLike<MarketingAsset> = {
  async list() {
    return rows(await api.get<ApiList<RecordRow>>("/marketing/assets?limit=100")).map(assetFromApi);
  },
  async create(input) {
    return assetFromApi(await api.post<RecordRow>("/marketing/assets", assetToApi(input)));
  },
  async update(id, patch) {
    const current = assetFromApi(await api.get<RecordRow>(`/marketing/assets/${id}`));
    return assetFromApi(await api.patch<RecordRow>(
      `/marketing/assets/${id}`,
      assetToApi({ ...current, ...patch }),
    ));
  },
  async remove(id) {
    await api.delete(`/marketing/assets/${id}`);
    return { id };
  },
};

export interface DeliverableFileInput {
  url: string;
  name: string;
  mimeType: string;
  size: number;
}
export interface CreateDeliverableInput {
  taskId: ID;
  title: string;
  description?: string;
  type: MarketingDeliverable["type"];
  file: DeliverableFileInput;
  createdBy?: string;
}
export type DeliverableLink =
  | { kind: "release"; id: ID }
  | { kind: "campaign"; id: ID }
  | { kind: "content"; id: ID }
  | { kind: "briefing"; id: ID }
  | { kind: "project"; id: ID };

async function deliverableFromApi(row: RecordRow): Promise<MarketingDeliverable> {
  const [versions] = await Promise.all([
    api.get<RecordRow[]>(`/marketing/assets/${row.id}/versions`),
  ]);
  const meta = metadata(row);
  return {
    id: row.id,
    taskId: meta.taskId,
    title: row.title,
    description: row.description ?? "",
    type: String(row.asset_type ?? "OTHER").toLowerCase(),
    approval: row.status === "approved" ? "aprovado" : row.status === "rejected" ? "rejeitado" : row.status === "in_review" ? "em_revisao" : "pendente",
    fileUrl: row.file_url ?? "",
    fileName: meta.fileName ?? row.title,
    mimeType: row.mime_type ?? "",
    fileSize: Number(row.size_bytes ?? 0),
    version: Number(row.current_version ?? versions.length),
    versions: versions.map((version) => ({
      id: version.id,
      version: version.version,
      fileUrl: version.file_url,
      fileName: metadata(version).fileName ?? row.title,
      mimeType: version.mime_type ?? "",
      fileSize: Number(version.size_bytes ?? 0),
      createdBy: version.created_by ?? "",
      createdAt: iso(version.created_at),
      note: version.change_notes ?? undefined,
    })),
    comments: meta.comments ?? [],
    approvedBy: row.approved_by ?? undefined,
    approvedAt: row.approved_at ? iso(row.approved_at) : undefined,
    createdBy: row.created_by ?? "",
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  } as MarketingDeliverable;
}

async function listDeliverables(query = "") {
  const list = rows(await api.get<ApiList<RecordRow>>(`/marketing/assets?limit=100${query}`));
  return Promise.all(list.filter((row) => metadata(row).taskId).map(deliverableFromApi));
}

const deliverablesApi = {
  list: () => listDeliverables(),
  listByTask: (taskId: ID) => listDeliverables(`&taskId=${encodeURIComponent(taskId)}`),
  async listByLink(link: DeliverableLink) {
    const tasks = await tasksApi.list();
    const field = `${link.kind}Id` as keyof MarketingTask;
    const taskIds = new Set(tasks.filter((task) => task[field] === link.id).map((task) => task.id));
    return (await listDeliverables()).filter((item) => taskIds.has(item.taskId));
  },
  async create(input: CreateDeliverableInput) {
    const row = await api.post<RecordRow>("/marketing/assets", {
      title: input.title,
      description: input.description,
      assetType: input.type.toUpperCase(),
      fileUrl: input.file.url,
      mimeType: input.file.mimeType,
      sizeBytes: String(input.file.size),
      taskId: input.taskId,
      metadata: { fileName: input.file.name, comments: [] },
    });
    return deliverableFromApi(row);
  },
  async update(id: ID, patch: Partial<Pick<MarketingDeliverable, "title" | "description" | "type">>, expectedUpdatedAt?: string) {
    return deliverableFromApi(await api.patch<RecordRow>(`/marketing/assets/${id}`, {
      title: patch.title,
      description: patch.description,
      assetType: patch.type?.toUpperCase(),
      expectedUpdatedAt,
    }));
  },
  async addVersion(id: ID, file: DeliverableFileInput, note?: string, expectedUpdatedAt?: string) {
    return deliverableFromApi(await api.patch<RecordRow>(`/marketing/assets/${id}`, {
      fileUrl: file.url,
      mimeType: file.mimeType,
      sizeBytes: String(file.size),
      changeNotes: note,
      metadata: { fileName: file.name },
      expectedUpdatedAt,
    }));
  },
  async setApproval(id: ID, approval: DeliverableApproval) {
    if (approval === "em_revisao") {
      await api.post(`/marketing/assets/${id}/request-approval`, {});
      return deliverableFromApi(await api.get<RecordRow>(`/marketing/assets/${id}`));
    }
    const approvals = await api.get<RecordRow[]>(`/marketing/assets/${id}/approvals`);
    const pending = approvals.find((item) => item.status === "pending");
    if (!pending) throw new Error("[marketing] ativo não possui aprovação pendente");
    await api.post(`/marketing/assets/approvals/${pending.id}/decision`, {
      status: approval === "aprovado" ? "approved" : "rejected",
    });
    return deliverableFromApi(await api.get<RecordRow>(`/marketing/assets/${id}`));
  },
  async addComment(id: ID, message: string, author?: string) {
    const row = await api.get<RecordRow>(`/marketing/assets/${id}`);
    const comments = metadata(row).comments ?? [];
    return deliverableFromApi(await api.patch<RecordRow>(`/marketing/assets/${id}`, {
      metadata: {
        ...metadata(row),
        comments: [...comments, {
          id: crypto.randomUUID(),
          author: author ?? "",
          message: message.trim(),
          createdAt: new Date().toISOString(),
        }],
      },
    }));
  },
  async duplicate(id: ID) {
    const row = await api.get<RecordRow>(`/marketing/assets/${id}`);
    return deliverableFromApi(await api.post<RecordRow>("/marketing/assets", {
      title: `${row.title} (cópia)`,
      description: row.description,
      assetType: row.asset_type,
      fileUrl: row.file_url,
      thumbnailUrl: row.thumbnail_url,
      mimeType: row.mime_type,
      sizeBytes: row.size_bytes,
      marketingProjectId: row.marketing_project_id,
      taskId: metadata(row).taskId,
      tags: row.tags,
      metadata: { ...metadata(row), comments: [] },
    }));
  },
  async remove(id: ID) {
    await api.delete(`/marketing/assets/${id}`);
    return { id };
  },
};

const EMPTY_METRICS: MetricSnapshot = {
  reach: 0, impressions: 0, engagement: 0, clicks: 0,
  conversions: 0, roi: 0, costPerResult: 0,
};

function sumMetrics(campaigns: MarketingCampaign[]): MetricSnapshot {
  const total = campaigns.reduce((sum, campaign) => ({
    reach: sum.reach + campaign.metrics.reach,
    impressions: sum.impressions + campaign.metrics.impressions,
    engagement: sum.engagement + campaign.metrics.engagement,
    clicks: sum.clicks + campaign.metrics.clicks,
    conversions: sum.conversions + campaign.metrics.conversions,
    roi: sum.roi + campaign.metrics.roi,
    costPerResult: sum.costPerResult + campaign.metrics.costPerResult,
  }), { ...EMPTY_METRICS });
  if (campaigns.length) {
    total.roi /= campaigns.length;
    total.costPerResult /= campaigns.length;
  }
  return total;
}

function breakdown(campaigns: MarketingCampaign[], key: (item: MarketingCampaign) => string, label: (key: string) => string): AnalyticsBreakdownRow[] {
  const groups = new Map<string, MarketingCampaign[]>();
  campaigns.forEach((item) => {
    const groupKey = key(item);
    if (groupKey) groups.set(groupKey, [...(groups.get(groupKey) ?? []), item]);
  });
  return [...groups].map(([groupKey, items]) => ({ key: groupKey, label: label(groupKey), ...sumMetrics(items) }));
}

async function analytics(): Promise<AnalyticsOverview> {
  const [campaigns, contents, tasks, projects] = await Promise.all([
    campaignsApi.list(), contentsApi.list(), tasksApi.list(), projectsApi.list(),
  ]);
  const totals = sumMetrics(campaigns);
  const projectBreakdown = breakdown(campaigns, (item) => item.projectId ?? "", (id) => projects.find((item) => item.id === id)?.name ?? id);
  const campaignBreakdown = breakdown(campaigns, (item) => item.id, (id) => campaigns.find((item) => item.id === id)?.name ?? id);
  const channelBreakdown = breakdown(campaigns, (item) => item.platforms[0] ?? "", (key) => CONTENT_CHANNEL_LABEL[key as keyof typeof CONTENT_CHANNEL_LABEL] ?? key);
  const responsibleBreakdown = breakdown(campaigns, (item) => item.owner, (key) => key);
  const typeBreakdown = breakdown(campaigns, (item) => item.type, (key) => CAMPAIGN_TYPE_LABEL[key as keyof typeof CAMPAIGN_TYPE_LABEL] ?? key);
  const contentCounts = new Map<string, number>();
  contents.forEach((item) => contentCounts.set(item.type, (contentCounts.get(item.type) ?? 0) + 1));
  const contentTypeBreakdown = [...contentCounts].map(([key, count]) => ({
    key, label: CONTENT_TYPE_LABEL[key as keyof typeof CONTENT_TYPE_LABEL] ?? key,
    reach: 0, impressions: 0, engagement: 0, clicks: 0, conversions: count, roi: 0,
  }));
  // Only the numeric metrics are summable -- isEstimated is a boolean flag,
  // never aggregated (a month mixing estimated/measured campaigns has no
  // single meaningful isEstimated value; period rollups are display-only
  // reach/engagement/conversions below, not re-labeled as estimated/measured).
  const NUMERIC_METRIC_KEYS = ["reach", "impressions", "engagement", "clicks", "conversions", "roi", "costPerResult"] as const;
  const byDate = new Map<string, MetricSnapshot>();
  campaigns.forEach((item) => {
    const label = item.startDate ? item.startDate.slice(0, 7) : "sem-data";
    const current = byDate.get(label) ?? { ...EMPTY_METRICS };
    const value = sumMetrics([item]);
    NUMERIC_METRIC_KEYS.forEach((metric) => {
      current[metric] += value[metric];
    });
    byDate.set(label, current);
  });
  const series = [...byDate].sort(([a], [b]) => a.localeCompare(b)).map(([label, value]) => ({
    label, reach: value.reach, engagement: value.engagement, conversions: value.conversions,
  }));
  const periodBreakdown = series.map((item) => ({
    key: item.label, label: item.label, reach: item.reach, impressions: 0,
    engagement: item.engagement, clicks: 0, conversions: item.conversions, roi: 0,
  }));
  const breakdownByDimension: Record<AnalyticsDimension, AnalyticsBreakdownRow[]> = {
    projeto_musical: projectBreakdown,
    campanha: campaignBreakdown,
    canal: channelBreakdown,
    periodo: periodBreakdown,
    responsavel: responsibleBreakdown,
    tipo_conteudo: contentTypeBreakdown,
    artista: projectBreakdown,
    empresa: typeBreakdown,
  };
  return {
    totals: {
      ...totals,
      audienceGrowth: 0,
      approvalRate: contents.length ? contents.filter((item) => item.approval === "aprovado").length / contents.length * 100 : 0,
      deliveries: tasks.filter((item) => item.status === "concluida").length,
      tasksDone: tasks.filter((item) => item.status === "concluida").length,
      activeProjects: projects.filter((item) => item.status === "em_andamento").length,
      publishedContents: contents.filter((item) => item.status === "publicado").length,
      lateContents: contents.filter((item) => item.status === "atrasado").length,
      runningCampaigns: campaigns.filter((item) => item.status === "ativa").length,
    },
    series,
    breakdownByDimension,
  };
}

function activityFromApi(row: RecordRow): ActivityEvent {
  return {
    id: row.id,
    entity: metadata(row).entity ?? row.entity_type,
    action: row.action,
    subject: row.description,
    author: row.user_name ?? row.user_id,
    at: iso(row.created_at),
  } as ActivityEvent;
}

export const marketingService = {
  projects: projectsApi,
  campaigns: campaignsApi,
  contents: contentsApi,
  deliverables: deliverablesApi,
  briefings: briefingsApi,
  tasks: tasksApi,
  assets: assetsApi,

  async getDashboard(): Promise<DashboardData> {
    const [campaigns, projects, contents, briefings, tasks, activity] = await Promise.all([
      campaignsApi.list(), projectsApi.list(), contentsApi.list(), briefingsApi.list(), tasksApi.list(), this.getActivity(),
    ]);
    const pendingApprovals = contents.filter((item) => item.approval === "pendente");
    const upcoming = contents.filter((item) => item.status !== "publicado")
      .sort((a, b) => a.publishDate.localeCompare(b.publishDate)).slice(0, 5);
    return {
      kpis: {
        activeCampaigns: campaigns.filter((item) => item.status === "ativa").length,
        activeProjects: projects.filter((item) => item.status === "em_andamento").length,
        scheduledContents: contents.filter((item) => item.status === "agendado").length,
        pendingTasks: tasks.filter((item) => item.status !== "concluida").length,
        openBriefings: briefings.filter((item) => !["aprovado", "arquivado"].includes(item.status)).length,
        pendingApprovals: pendingApprovals.length,
        upcomingDeliveries: upcoming.length,
        sectorPerformance: 0,
      },
      alerts: [
        ...contents.filter((item) => item.status === "atrasado").map((item) => ({
          id: `content-${item.id}`, level: "critical" as const, message: `Conteúdo atrasado: ${item.title}`,
        })),
        ...tasks.filter((item) => item.status === "bloqueada").map((item) => ({
          id: `task-${item.id}`, level: "warning" as const, message: `Tarefa bloqueada: ${item.title}`,
        })),
      ],
      recentActivity: activity.slice(0, 8),
      upcomingContents: upcoming,
      pendingApprovals,
    };
  },

  getAnalytics: analytics,
  getCampaignBuilderConfig: () => api.get<CampaignBuilderConfig>("/marketing/campaign-builder/config"),

  async getActivity(): Promise<ActivityEvent[]> {
    return rows(await api.get<ApiList<RecordRow>>("/activity-logs?entityType=marketing&limit=50")).map(activityFromApi);
  },

  async logActivity(event: Omit<ActivityEvent, "id" | "at">): Promise<ActivityEvent> {
    const row = await api.post<RecordRow>("/activity-logs", {
      entity_type: "marketing",
      entity_id: crypto.randomUUID(),
      action: event.action,
      description: event.subject,
      user_name: event.author,
      metadata: { source: "marketing", entity: event.entity },
    });
    return activityFromApi(row);
  },

  getAiSuggestions(): Promise<AiSuggestion[]> {
    return api.get<AiSuggestion[]>("/marketing/ai-suggestions");
  },

  addAiSuggestion(suggestion: Omit<AiSuggestion, "id" | "at">): Promise<AiSuggestion> {
    return api.post<AiSuggestion>("/marketing/ai-suggestions", suggestion);
  },
};

export type MarketingService = typeof marketingService;
