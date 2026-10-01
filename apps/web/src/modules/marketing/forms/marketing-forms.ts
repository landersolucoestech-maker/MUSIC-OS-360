/**
 * Marketing Module — Task form schemas & value mappers.
 *
 * Declarative field definitions for the task create/edit modal plus the
 * functions that turn raw form values into typed create payloads. Keeps form
 * structure and value normalization out of the page JSX.
 */

import type { FieldDef, FormValues } from "../components/MarketingFormModal";
import {
  MARKETING_TARGET_OPTIONS,
  PRIORITY_OPTIONS,
  TASK_STATUS_OPTIONS,
  CONTEXT_SECTOR_OPTIONS,
  CONTEXT_SECTOR_TYPE_OPTIONS,
} from "../constants/marketing.constants";
import type {
  CreateInput,
  MarketingProject,
  MarketingTask,
  MarketingTarget,
  Priority,
  ReferenceAudio,
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

// ===========================================================================
// Tasks
// ===========================================================================

/**
 * Lean field set for the "Nova Tarefa" modal — only what's needed to create the
 * operational record. Status defaults to "pending" (A Fazer) and the longer description is
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

/** Field shared by create/edit: type filtered by context + sector. */
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

/** Field shared by create/edit: the department ("Setor") filtered by the selected context. */
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
 * Finds the reference track (WAV) of a music project among the linked
 * files. Used to inherit the audio automatically in tasks of the
 * "music_project" context — no manual upload. Returns undefined when there is no audio.
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
    targetType: task?.targetType ?? "company",
    targetName: task?.targetName ?? "",
    // Department and type start empty on creation — the department is mandatory and the type is only
    // enabled/selectable after a compatible department is chosen.
    type: task?.type ?? "",
    status: task?.status ?? "pending",
    priority: task?.priority ?? "normal",
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
