/**
 * packages/ai-skills/src/project-planning/parser.ts
 *
 * Converts the provider's raw response into a structured ProjectPlanningOutput.
 * Strategy: extract JSON (markdown/cutout/surrounding text) → coerce fields →
 * safe structured fallback (with a heuristic-provenance marker).
 * NEVER throws — any malformed response yields a valid output.
 */

import type {
  ProjectPlanningInput,
  ProjectPlanningOutput,
  ProjectPhase,
  ProjectTask,
  ProjectRisk,
  ProjectOwner,
  ProjectMilestone,
  TaskPriority,
  RiskSeverity,
} from "./contracts";

const PRIORITIES: TaskPriority[] = ["low", "medium", "high", "critical"];
const SEVERITIES: RiskSeverity[] = ["low", "medium", "high", "critical"];

// ─── Coercion helpers ─────────────────────────────────────────────────────────

function asString(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return fallback;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((v) => asString(v)).filter((v) => v.length > 0);
}

function asOptionalNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function asPriority(value: unknown): TaskPriority {
  const v = asString(value).toLowerCase();
  return (PRIORITIES as string[]).includes(v) ? (v as TaskPriority) : "medium";
}

function asSeverity(value: unknown): RiskSeverity {
  const v = asString(value).toLowerCase();
  return (SEVERITIES as string[]).includes(v) ? (v as RiskSeverity) : "medium";
}

function asRecordArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is Record<string, unknown> => typeof v === "object" && v !== null);
}

// ─── JSON extraction from the response ────────────────────────────────────────

function extractJson(raw: string): Record<string, unknown> | null {
  if (!raw) return null;

  const fenced = raw.match(/```(?:json)?([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : raw;

  const direct = tryParse(candidate);
  if (direct) return direct;

  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    return tryParse(candidate.slice(start, end + 1));
  }

  return null;
}

function tryParse(text: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(text.trim());
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // ignore — the response was not valid JSON
  }
  return null;
}

// ─── Mapeadores de blocos ─────────────────────────────────────────────────────

function mapPhases(value: unknown): ProjectPhase[] {
  return asRecordArray(value).map((p, idx) => ({
    name:        asString(p.name) || `Fase ${idx + 1}`,
    description: asString(p.description),
    order:       asOptionalNumber(p.order) ?? idx + 1,
  }));
}

function mapTasks(value: unknown): ProjectTask[] {
  return asRecordArray(value).map((t) => {
    const task: ProjectTask = {
      title:       asString(t.title),
      description: asString(t.description),
      department:  asString(t.department),
      priority:    asPriority(t.priority),
    };
    const estimatedDays = asOptionalNumber(t.estimatedDays);
    if (estimatedDays !== undefined) task.estimatedDays = estimatedDays;
    const dependencies = asStringArray(t.dependencies);
    if (dependencies.length > 0) task.dependencies = dependencies;
    return task;
  });
}

function mapRisks(value: unknown): ProjectRisk[] {
  return asRecordArray(value).map((r) => ({
    risk:       asString(r.risk),
    severity:   asSeverity(r.severity),
    mitigation: asString(r.mitigation),
  }));
}

function mapOwners(value: unknown): ProjectOwner[] {
  return asRecordArray(value).map((o) => ({
    department:     asString(o.department),
    responsibility: asString(o.responsibility),
  }));
}

function mapMilestones(value: unknown): ProjectMilestone[] {
  return asRecordArray(value).map((m) => {
    const milestone: ProjectMilestone = {
      title:       asString(m.title),
      description: asString(m.description),
    };
    const suggestedDate = asString(m.suggestedDate);
    if (suggestedDate) milestone.suggestedDate = suggestedDate;
    return milestone;
  });
}

// ─── Fallback estruturado seguro ──────────────────────────────────────────────

const HEURISTIC_NOTE = "Plano heurístico local: a análise detalhada do modelo não foi executada. Revise manualmente antes de usar como plano operacional definitivo.";

function buildFallback(raw: string, input: ProjectPlanningInput): ProjectPlanningOutput {
  const base = raw.trim()
    ? raw.trim()
    : `Plano operacional para o projeto "${input.projectName}" (${input.projectType}).`;

  return {
    summary:         `${base}\n\n${HEURISTIC_NOTE}`,
    phases:          [],
    tasks:           [],
    dependencies:    [],
    risks:           [],
    suggestedOwners: input.departments.map((department) => ({
      department,
      responsibility: "A definir",
    })),
    milestones:      [],
    checklist:       [HEURISTIC_NOTE, ...input.goals],
  };
}

// ─── Parser principal ─────────────────────────────────────────────────────────

export function parseProjectPlanningResponse(
  raw: string,
  input: ProjectPlanningInput,
): ProjectPlanningOutput {
  const json = extractJson(raw);

  if (!json) {
    return buildFallback(raw, input);
  }

  const fallback = buildFallback(raw, input);

  return {
    summary:         asString(json.summary) || fallback.summary,
    phases:          mapPhases(json.phases),
    tasks:           mapTasks(json.tasks),
    dependencies:    asStringArray(json.dependencies),
    risks:           mapRisks(json.risks),
    suggestedOwners: json.suggestedOwners !== undefined
      ? mapOwners(json.suggestedOwners)
      : fallback.suggestedOwners,
    milestones:      mapMilestones(json.milestones),
    checklist:       asStringArray(json.checklist),
  };
}
