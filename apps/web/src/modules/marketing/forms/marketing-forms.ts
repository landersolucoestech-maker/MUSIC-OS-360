/**
 * Marketing Module — Form schemas & value mappers.
 *
 * Declarative field definitions for each entity's create/edit modal plus the
 * functions that turn raw form values into typed create payloads. Keeps form
 * structure and value normalization out of the page JSX.
 */

import type { FieldDef, FormValues } from "../components/MarketingFormModal";
import {
  ASSET_CATEGORY_OPTIONS,
  BRIEFING_STATUS_OPTIONS,
  BRIEFING_TYPE_OPTIONS,
  CAMPAIGN_STATUS_OPTIONS,
  CAMPAIGN_TYPE_OPTIONS,
  CONTENT_CHANNEL_OPTIONS,
  CONTENT_STATUS_OPTIONS,
  CONTENT_TYPE_OPTIONS,
  MARKETING_TARGET_OPTIONS,
  APPROVAL_STATUS_OPTIONS,
  PRIORITY_OPTIONS,
  PROJECT_STATUS_OPTIONS,
  PROJECT_TYPE_OPTIONS,
  TASK_STATUS_OPTIONS,
  CONTEXT_SECTOR_OPTIONS,
  CONTEXT_SECTOR_TYPE_OPTIONS,
} from "../constants/marketing.constants";
import type {
  ApprovalStatus,
  AssetCategory,
  BriefingStatus,
  BriefingType,
  CampaignStatus,
  CampaignType,
  ContentChannel,
  ContentStatus,
  ContentType,
  CreateInput,
  MarketingAsset,
  MarketingBriefing,
  MarketingCampaign,
  MarketingContent,
  MarketingProject,
  MarketingTask,
  MarketingTarget,
  Priority,
  ReferenceAudio,
  ProjectStatus,
  ProjectType,
  TaskStatus,
  TaskType,
} from "../types/marketing.types";


/**
 * Options for the "Projeto musical, artista ou empresa" field, keyed by the
 * selected Contexto (targetType). Supplied at runtime by the Tarefas page from
 * the real artists/projects/companies registries.
 */
export type TaskTargetOptions = Record<string, { value: string; label: string }[]>;

// ---------------------------------------------------------------------------
// Raw value helpers (form values are unknown-typed)
// ---------------------------------------------------------------------------

function str(values: FormValues, key: string): string {
  const value = values[key];
  return typeof value === "string" ? value : "";
}

function num(values: FormValues, key: string): number {
  const value = values[key];
  return typeof value === "number" ? value : Number(value ?? 0) || 0;
}

function arr(values: FormValues, key: string): string[] {
  const value = values[key];
  return Array.isArray(value) ? (value as string[]) : [];
}

// ===========================================================================
// Projects
// ===========================================================================

export const projectFields: FieldDef[] = [
  { name: "name", label: "Nome do projeto", type: "text", required: true, colSpan: 2 },
  { name: "type", label: "Tipo", type: "select", required: true, options: PROJECT_TYPE_OPTIONS },
  { name: "status", label: "Status", type: "select", required: true, options: PROJECT_STATUS_OPTIONS },
  { name: "priority", label: "Prioridade", type: "select", required: true, options: PRIORITY_OPTIONS },
  { name: "owner", label: "Responsável", type: "text", required: true },
  { name: "startDate", label: "Data inicial", type: "date", required: true },
  { name: "endDate", label: "Data final", type: "date", required: true },
  { name: "objective", label: "Objetivo", type: "textarea", colSpan: 2 },
  { name: "description", label: "Briefing do Projeto", type: "textarea", colSpan: 2 },
  { name: "channels", label: "Canais", type: "multiselect", options: CONTENT_CHANNEL_OPTIONS },
  { name: "team", label: "Equipe", type: "tags" },
];

export function projectInitialValues(project?: MarketingProject): FormValues {
  return {
    name: project?.name ?? "",
    type: project?.type ?? "lancamento_musical",
    status: project?.status ?? "planejamento",
    priority: project?.priority ?? "media",
    owner: project?.owner ?? "",
    startDate: project?.startDate ?? "",
    endDate: project?.endDate ?? "",
    objective: project?.objective ?? "",
    channels: project?.channels ?? [],
    team: project?.team ?? [],
    description: project?.description ?? "",
  };
}

export function toProjectInput(values: FormValues): CreateInput<MarketingProject> {
  return {
    name: str(values, "name"),
    type: str(values, "type") as ProjectType,
    status: str(values, "status") as ProjectStatus,
    priority: str(values, "priority") as Priority,
    owner: str(values, "owner"),
    team: arr(values, "team"),
    startDate: str(values, "startDate"),
    endDate: str(values, "endDate"),
    objective: str(values, "objective"),
    audience: "",
    channels: arr(values, "channels") as ContentChannel[],
    description: str(values, "description"),
    taskIds: [],
    campaignIds: [],
    contentIds: [],
    briefingIds: [],
    files: [],
    progress: 0,
  };
}

// ===========================================================================
// Campaigns
// ===========================================================================

export const campaignFields: FieldDef[] = [
  { name: "name", label: "Nome da campanha", type: "text", required: true, colSpan: 2 },
  { name: "targetType", label: "Contexto", type: "select", required: true, options: MARKETING_TARGET_OPTIONS },
  { name: "targetName", label: "Projeto musical, artista ou empresa", type: "text", required: true },
  { name: "type", label: "Tipo", type: "select", required: true, options: CAMPAIGN_TYPE_OPTIONS },
  { name: "status", label: "Status", type: "select", required: true, options: CAMPAIGN_STATUS_OPTIONS },
  { name: "owner", label: "Responsável", type: "text", required: true },
  { name: "budget", label: "Orçamento (R$)", type: "number" },
  { name: "startDate", label: "Início", type: "date", required: true },
  { name: "endDate", label: "Fim", type: "date", required: true },
  { name: "objective", label: "Objetivo", type: "textarea", colSpan: 2 },
  { name: "audience", label: "Público-alvo", type: "text", colSpan: 2 },
  { name: "segmentation", label: "Segmentação", type: "textarea", colSpan: 2 },
  { name: "platforms", label: "Plataformas", type: "multiselect", options: CONTENT_CHANNEL_OPTIONS, colSpan: 2 },
  { name: "notes", label: "Observações", type: "textarea", colSpan: 2 },
];

export function campaignInitialValues(campaign?: MarketingCampaign): FormValues {
  return {
    name: campaign?.name ?? "",
    targetType: campaign?.targetType ?? "empresa",
    targetName: campaign?.targetName ?? "",
    type: campaign?.type ?? "institucional",
    status: campaign?.status ?? "rascunho",
    owner: campaign?.owner ?? "",
    budget: campaign?.budget ?? 0,
    startDate: campaign?.startDate ?? "",
    endDate: campaign?.endDate ?? "",
    objective: campaign?.objective ?? "",
    audience: campaign?.audience ?? "",
    segmentation: campaign?.segmentation ?? "",
    platforms: campaign?.platforms ?? [],
    notes: campaign?.notes ?? "",
  };
}

export function toCampaignInput(values: FormValues): CreateInput<MarketingCampaign> {
  return {
    name: str(values, "name"),
    targetType: str(values, "targetType") as MarketingTarget,
    targetName: str(values, "targetName"),
    type: str(values, "type") as CampaignType,
    status: str(values, "status") as CampaignStatus,
    owner: str(values, "owner"),
    budget: num(values, "budget"),
    startDate: str(values, "startDate"),
    endDate: str(values, "endDate"),
    objective: str(values, "objective"),
    audience: str(values, "audience"),
    segmentation: str(values, "segmentation"),
    platforms: arr(values, "platforms") as ContentChannel[],
    notes: str(values, "notes"),
    creativeAssetIds: [],
    contentIds: [],
    metrics: {
      reach: 0,
      impressions: 0,
      engagement: 0,
      clicks: 0,
      conversions: 0,
      roi: 0,
      costPerResult: 0,
    },
  };
}

// ===========================================================================
// Contents
// ===========================================================================

export const contentFields: FieldDef[] = [
  { name: "title", label: "Título", type: "text", required: true, colSpan: 2 },
  { name: "targetType", label: "Contexto", type: "select", required: true, options: MARKETING_TARGET_OPTIONS },
  { name: "targetName", label: "Projeto musical, artista ou empresa", type: "text", required: true },
  { name: "type", label: "Tipo", type: "select", required: true, options: CONTENT_TYPE_OPTIONS },
  { name: "channel", label: "Canal", type: "select", required: true, options: CONTENT_CHANNEL_OPTIONS },
  { name: "status", label: "Status", type: "select", required: true, options: CONTENT_STATUS_OPTIONS },
  { name: "approval", label: "Aprovação", type: "select", required: true, options: APPROVAL_STATUS_OPTIONS },
  { name: "publishDate", label: "Data de publicação", type: "date", required: true },
  { name: "publishTime", label: "Horário", type: "time" },
  { name: "owner", label: "Responsável", type: "text", required: true },
  { name: "copy", label: "Legenda / Copy", type: "textarea", colSpan: 2 },
  { name: "notes", label: "Observações", type: "textarea", colSpan: 2 },
];

export function contentInitialValues(content?: MarketingContent): FormValues {
  return {
    title: content?.title ?? "",
    targetType: content?.targetType ?? "empresa",
    targetName: content?.targetName ?? "",
    type: content?.type ?? "rede_social",
    channel: content?.channel ?? "instagram",
    status: content?.status ?? "ideia",
    approval: content?.approval ?? "pendente",
    publishDate: content?.publishDate ?? "",
    publishTime: content?.publishTime ?? "12:00",
    owner: content?.owner ?? "",
    copy: content?.copy ?? "",
    notes: content?.notes ?? "",
  };
}

export function toContentInput(values: FormValues): CreateInput<MarketingContent> {
  return {
    title: str(values, "title"),
    targetType: str(values, "targetType") as MarketingTarget,
    targetName: str(values, "targetName"),
    type: str(values, "type") as ContentType,
    channel: str(values, "channel") as ContentChannel,
    status: str(values, "status") as ContentStatus,
    approval: str(values, "approval") as ApprovalStatus,
    publishDate: str(values, "publishDate"),
    publishTime: str(values, "publishTime"),
    owner: str(values, "owner"),
    copy: str(values, "copy"),
    notes: str(values, "notes"),
    files: [],
  };
}

// ===========================================================================
// Briefings
// ===========================================================================

/**
 * Lean field set for the "Novo Briefing" modal — only what's needed to create
 * the initial record. Advanced/strategic fields live in {@link briefingEditFields}
 * and are filled later in the detail/edit flow.
 */
export const briefingCreateFields: FieldDef[] = [
  { name: "title", label: "Título", type: "text", required: true, colSpan: 2 },
  { name: "type", label: "Tipo", type: "select", required: true, options: BRIEFING_TYPE_OPTIONS },
  { name: "status", label: "Status", type: "select", required: true, options: BRIEFING_STATUS_OPTIONS },
  { name: "deadline", label: "Prazo", type: "date", required: true },
  { name: "owners", label: "Responsáveis", type: "tags", colSpan: 1 },
  { name: "objective", label: "Objetivo", type: "textarea", colSpan: 2 },
];

/** Full field set used for viewing/editing an existing briefing. */
export const briefingEditFields: FieldDef[] = [
  { name: "title", label: "Título", type: "text", required: true, colSpan: 2 },
  { name: "type", label: "Tipo", type: "select", required: true, options: BRIEFING_TYPE_OPTIONS },
  { name: "status", label: "Status", type: "select", required: true, options: BRIEFING_STATUS_OPTIONS },
  { name: "deadline", label: "Prazo", type: "date", required: true },
  { name: "objective", label: "Objetivo", type: "textarea", colSpan: 2 },
  { name: "context", label: "Contexto", type: "textarea", colSpan: 2 },
  { name: "audience", label: "Público-alvo", type: "text", colSpan: 2 },
  { name: "positioning", label: "Posicionamento", type: "text", colSpan: 2 },
  { name: "tone", label: "Tom de comunicação", type: "text", colSpan: 2 },
  { name: "references", label: "Referências", type: "textarea", colSpan: 2 },
  { name: "visualGuidelines", label: "Diretrizes visuais", type: "textarea", colSpan: 2 },
  { name: "textGuidelines", label: "Diretrizes textuais", type: "textarea", colSpan: 2 },
  { name: "channels", label: "Canais", type: "multiselect", options: CONTENT_CHANNEL_OPTIONS, colSpan: 2 },
  { name: "restrictions", label: "Restrições", type: "textarea", colSpan: 2 },
  { name: "deliverables", label: "Entregáveis", type: "tags", colSpan: 2 },
  { name: "owners", label: "Responsáveis", type: "tags", colSpan: 2 },
];

export function briefingInitialValues(briefing?: MarketingBriefing): FormValues {
  return {
    title: briefing?.title ?? "",
    type: briefing?.type ?? "campanha",
    status: briefing?.status ?? "draft",
    deadline: briefing?.deadline ?? "",
    objective: briefing?.objective ?? "",
    context: briefing?.context ?? "",
    audience: briefing?.audience ?? "",
    positioning: briefing?.positioning ?? "",
    tone: briefing?.tone ?? "",
    references: briefing?.references ?? "",
    visualGuidelines: briefing?.visualGuidelines ?? "",
    textGuidelines: briefing?.textGuidelines ?? "",
    channels: briefing?.channels ?? [],
    restrictions: briefing?.restrictions ?? "",
    deliverables: briefing?.deliverables ?? [],
    owners: briefing?.owners ?? [],
  };
}

/**
 * Maps an existing briefing onto form values for the view/edit modal. Delegates
 * to {@link briefingInitialValues} so the field mapping lives in one place.
 */
export function briefingToFormValues(briefing: MarketingBriefing): FormValues {
  return briefingInitialValues(briefing);
}

export function toBriefingInput(values: FormValues): CreateInput<MarketingBriefing> {
  return {
    title: str(values, "title"),
    type: str(values, "type") as BriefingType,
    status: str(values, "status") as BriefingStatus,
    deadline: str(values, "deadline"),
    objective: str(values, "objective"),
    context: str(values, "context"),
    audience: str(values, "audience"),
    positioning: str(values, "positioning"),
    tone: str(values, "tone"),
    references: str(values, "references"),
    visualGuidelines: str(values, "visualGuidelines"),
    textGuidelines: str(values, "textGuidelines"),
    channels: arr(values, "channels") as ContentChannel[],
    restrictions: str(values, "restrictions"),
    deliverables: arr(values, "deliverables"),
    owners: arr(values, "owners"),
    files: [],
  };
}

// ===========================================================================
// Tasks
// ===========================================================================

/**
 * Lean field set for the "Nova Tarefa" modal — only what's needed to create the
 * operational record. Status defaults to "a_fazer" and the longer description is
 * filled later in the edit flow.
 */
/** Field shared by create/edit: searchable target picker dependent on Contexto. */
const targetNameField = (targetOptions: TaskTargetOptions): FieldDef => ({
  name: "targetName",
  label: "Projeto musical, artista ou empresa",
  type: "select",
  required: true,
  searchable: true,
  dependsOn: "targetType",
  computeOptions: (values) => targetOptions[String(values.targetType ?? "")] ?? [],
  placeholder: "Busque por projeto, artista ou empresa",
});

/** Field shared by create/edit: Tipo filtrado por Contexto + Setor. */
const typeField: FieldDef = {
  name: "type",
  label: "Tipo",
  type: "select",
  required: true,
  dependsOn: "sector",
  computeOptions: (values) =>
    CONTEXT_SECTOR_TYPE_OPTIONS[values.targetType as MarketingTarget]?.[String(values.sector ?? "")] ?? [],
  placeholder: "Selecione um setor primeiro",
};

/** Field shared by create/edit: Setor filtrado pelo Contexto selecionado. */
const sectorField: FieldDef = {
  name: "sector",
  label: "Setor",
  type: "select",
  required: true,
  dependsOn: "targetType",
  computeOptions: (values) => CONTEXT_SECTOR_OPTIONS[values.targetType as MarketingTarget] ?? [],
  placeholder: "Selecione antes o contexto",
};

export const taskCreateFields = (targetOptions: TaskTargetOptions): FieldDef[] => [
  { name: "title", label: "Título", type: "text", required: true, colSpan: 2 },
  { name: "targetType", label: "Contexto", type: "select", required: true, options: MARKETING_TARGET_OPTIONS },
  targetNameField(targetOptions),
  sectorField,
  typeField,
  { name: "owner", label: "Responsável", type: "text", required: true },
  { name: "priority", label: "Prioridade", type: "select", required: true, options: PRIORITY_OPTIONS },
  { name: "deadline", label: "Prazo", type: "date", required: true },
];

/** Full field set used for viewing/editing an existing task. */
export const taskEditFields = (targetOptions: TaskTargetOptions): FieldDef[] => [
  { name: "title", label: "Título", type: "text", required: true, colSpan: 2 },
  { name: "targetType", label: "Contexto", type: "select", required: true, options: MARKETING_TARGET_OPTIONS },
  targetNameField(targetOptions),
  sectorField,
  typeField,
  { name: "status", label: "Status", type: "select", required: true, options: TASK_STATUS_OPTIONS },
  { name: "priority", label: "Prioridade", type: "select", required: true, options: PRIORITY_OPTIONS },
  { name: "owner", label: "Responsável", type: "text", required: true },
  { name: "deadline", label: "Prazo", type: "date", required: true },
  { name: "description", label: "Descrição", type: "textarea", colSpan: 2 },
];

/**
 * Localiza a música de referência (WAV) de um Projeto Musical entre os arquivos
 * vinculados. Usado para herdar o áudio automaticamente em tarefas do contexto
 * "projeto_musical" — sem upload manual. Retorna undefined se não houver áudio.
 */
export function findProjectReferenceAudio(project?: MarketingProject | null): ReferenceAudio | undefined {
  if (!project) return undefined;
  const audio = project.files.find(
    (f) => f.kind?.toLowerCase().includes("audio") || /\.(wav|mp3|aiff?|flac)$/i.test(f.name),
  );
  if (!audio) return undefined;
  return { fileName: audio.name, url: audio.url };
}

export function taskInitialValues(task?: MarketingTask): FormValues {
  return {
    title: task?.title ?? "",
    targetType: task?.targetType ?? "empresa",
    targetName: task?.targetName ?? "",
    // Setor e Tipo começam vazios na criação — Setor é obrigatório e Tipo só é
    // habilitado/selecionável depois que um Setor compatível é escolhido.
    type: task?.type ?? "",
    status: task?.status ?? "a_fazer",
    priority: task?.priority ?? "media",
    owner: task?.owner ?? "",
    sector: task?.sector ?? "",
    deadline: task?.deadline ?? "",
    description: task?.description ?? "",
  };
}

/**
 * Maps an existing task onto form values for the view/edit modal. Delegates to
 * {@link taskInitialValues} so the field mapping lives in one place.
 */
export function taskToFormValues(task: MarketingTask): FormValues {
  return taskInitialValues(task);
}

export function toTaskInput(values: FormValues): CreateInput<MarketingTask> {
  return {
    title: str(values, "title"),
    targetType: str(values, "targetType") as MarketingTarget,
    targetName: str(values, "targetName"),
    type: str(values, "type") as TaskType,
    status: str(values, "status") as TaskStatus,
    priority: str(values, "priority") as Priority,
    owner: str(values, "owner"),
    sector: str(values, "sector"),
    deadline: str(values, "deadline"),
    description: str(values, "description"),
    files: [],
    checklist: [],
    comments: [],
    history: [],
    dependencies: [],
  };
}

// ===========================================================================
// Assets
// ===========================================================================

export const assetFields: FieldDef[] = [
  { name: "name", label: "Nome do ativo", type: "text", required: true, colSpan: 2 },
  { name: "category", label: "Categoria", type: "select", required: true, options: ASSET_CATEGORY_OPTIONS },
  { name: "approval", label: "Aprovação", type: "select", required: true, options: APPROVAL_STATUS_OPTIONS },
  { name: "owner", label: "Responsável", type: "text", required: true },
  { name: "department", label: "Departamento", type: "text" },
  { name: "url", label: "URL / Arquivo", type: "text", required: true, colSpan: 2 },
  { name: "thumbnailUrl", label: "URL da miniatura", type: "text", colSpan: 2 },
  { name: "tags", label: "Tags", type: "tags", colSpan: 2 },
  { name: "notes", label: "Observações", type: "textarea", colSpan: 2 },
];

export function assetInitialValues(asset?: MarketingAsset): FormValues {
  return {
    name: asset?.name ?? "",
    category: asset?.category ?? "arte_promocional",
    approval: asset?.approval ?? "pendente",
    owner: asset?.owner ?? "",
    department: asset?.department ?? "",
    url: asset?.url ?? "",
    thumbnailUrl: asset?.thumbnailUrl ?? "",
    tags: asset?.tags ?? [],
    notes: asset?.notes ?? "",
  };
}

export function toAssetInput(values: FormValues): CreateInput<MarketingAsset> {
  const department = str(values, "department");
  const thumbnailUrl = str(values, "thumbnailUrl");
  return {
    name: str(values, "name"),
    category: str(values, "category") as AssetCategory,
    approval: str(values, "approval") as ApprovalStatus,
    owner: str(values, "owner"),
    department: department || undefined,
    url: str(values, "url"),
    thumbnailUrl: thumbnailUrl || undefined,
    tags: arr(values, "tags"),
    notes: str(values, "notes"),
  };
}

