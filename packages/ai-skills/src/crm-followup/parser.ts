/**
 * skills/crm-followup/parsers/crm-followup.parser.ts
 *
 * Converts the provider's raw response into a structured CrmFollowupOutput.
 * Strategy:
 *  1. try to extract and parse JSON from the response (with/without markdown fences, with surrounding text);
 *  2. coerce each field to the expected shape, dropping invalid values;
 *  3. normalize conversionProbability to 0–1;
 *  4. if nothing is usable, return a safe structured fallback based on
 *     currentStage (priority, conversionProbability and a pt-BR message).
 * NEVER throws — any malformed response yields a valid output.
 */

import type {
  CrmFollowupInput,
  CrmFollowupOutput,
  CrmStage,
  CrmObjection,
  CrmTask,
  CrmStageRecommendation,
  CrmRisk,
} from "./contracts";
import type { SkillSeverity, SkillPriority } from "../shared/primitives";

const SEVERITIES: SkillSeverity[] = ["low", "medium", "high", "critical"];
const PRIORITIES: SkillPriority[] = ["low", "medium", "high", "critical"];
const STAGES: CrmStage[] = ["new", "contacted", "qualified", "proposal", "negotiation", "won", "lost", "inactive"];

// Deterministic maps for the fallback (based on currentStage).
const STAGE_PRIORITY: Record<CrmStage, SkillPriority> = {
  negotiation: "high",
  proposal:    "high",
  qualified:   "medium",
  contacted:   "medium",
  new:         "low",
  inactive:    "low",
  won:         "low",
  lost:        "low",
};

const STAGE_PROBABILITY: Record<CrmStage, number> = {
  won:         1,
  negotiation: 0.7,
  proposal:    0.6,
  qualified:   0.45,
  contacted:   0.3,
  new:         0.15,
  inactive:    0.1,
  lost:        0,
};

// ─── Coercion helpers ─────────────────────────────────────────────────────────

function asString(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return fallback;
}

function asOptionalNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function asSeverity(value: unknown): SkillSeverity {
  const v = asString(value).toLowerCase();
  return (SEVERITIES as string[]).includes(v) ? (v as SkillSeverity) : "medium";
}

function asPriority(value: unknown, fallback: SkillPriority = "medium"): SkillPriority {
  const v = asString(value).toLowerCase();
  return (PRIORITIES as string[]).includes(v) ? (v as SkillPriority) : fallback;
}

function asStage(value: unknown): CrmStage | undefined {
  const v = asString(value).toLowerCase();
  return (STAGES as string[]).includes(v) ? (v as CrmStage) : undefined;
}

function asRecordArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is Record<string, unknown> => typeof v === "object" && v !== null);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function normalizeProbability(value: unknown, fallback: number): number {
  let n = typeof value === "number" ? value : Number(asString(value));
  if (!Number.isFinite(n)) return fallback;
  if (n > 1 && n <= 100) n = n / 100; // aceita percentual (ex.: 70 → 0.7)
  return Math.max(0, Math.min(1, n));
}

// ─── Mapeadores de blocos ─────────────────────────────────────────────────────

function mapObjections(value: unknown): CrmObjection[] {
  return asRecordArray(value).map((o) => ({
    objection:        asString(o.objection),
    responseStrategy: asString(o.responseStrategy),
    severity:         asSeverity(o.severity),
  }));
}

function mapTasks(value: unknown): CrmTask[] {
  return asRecordArray(value).map((t) => {
    const task: CrmTask = {
      title:       asString(t.title),
      description: asString(t.description),
      priority:    asPriority(t.priority),
    };
    const dueInDays = asOptionalNumber(t.dueInDays);
    if (dueInDays !== undefined) task.dueInDays = dueInDays;
    return task;
  });
}

function mapRisks(value: unknown): CrmRisk[] {
  return asRecordArray(value).map((r) => ({
    risk:           asString(r.risk),
    severity:       asSeverity(r.severity),
    recommendation: asString(r.recommendation),
  }));
}

function mapStageRecommendation(value: unknown, fallback: CrmStageRecommendation): CrmStageRecommendation {
  const m = asRecord(value);
  if (!m) return fallback;

  const recommendation: CrmStageRecommendation = {
    currentStage: asStage(m.currentStage) ?? fallback.currentStage,
    reason:       asString(m.reason) || fallback.reason,
  };
  const suggested = asStage(m.suggestedStage);
  if (suggested) recommendation.suggestedStage = suggested;
  return recommendation;
}

// ─── Fallback estruturado seguro ──────────────────────────────────────────────

function buildFollowUpMessage(input: CrmFollowupInput): string {
  return [
    `Olá, ${input.leadName}!`,
    ``,
    `Passando para retomar nosso contato sobre ${input.objective}.`,
    `Fico à disposição para avançarmos no melhor formato para você.`,
    ``,
    `Um abraço.`,
  ].join("\n");
}

function buildFallback(input: CrmFollowupInput): CrmFollowupOutput {
  const stage = input.currentStage;
  const priority = STAGE_PRIORITY[stage] ?? "low";
  const conversionProbability = STAGE_PROBABILITY[stage] ?? 0.15;

  return {
    priority,
    nextAction: `Retomar contato com ${input.leadName} sobre ${input.objective}.`,
    followUpMessage: buildFollowUpMessage(input),
    objections: [],
    conversionProbability,
    tasks: [
      {
        title:       `Follow-up com ${input.leadName}`,
        description: `Dar seguimento ao objetivo: ${input.objective}.`,
        priority,
      },
    ],
    stageRecommendation: {
      currentStage: stage,
      reason: "Recomendação heurística gerada localmente (sem resposta válida do modelo).",
    },
    risks: [],
  };
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

// ─── Parser principal ─────────────────────────────────────────────────────────

export function parseCrmFollowupResponse(
  raw: string,
  input: CrmFollowupInput,
): CrmFollowupOutput {
  const json = extractJson(raw);

  const fallback = buildFallback(input);

  if (!json) {
    return fallback;
  }

  const suggestedDeadline = asString(json.suggestedDeadline);

  const output: CrmFollowupOutput = {
    priority:              asPriority(json.priority, fallback.priority),
    nextAction:            asString(json.nextAction) || fallback.nextAction,
    followUpMessage:       asString(json.followUpMessage) || fallback.followUpMessage,
    objections:            mapObjections(json.objections),
    conversionProbability: normalizeProbability(json.conversionProbability, fallback.conversionProbability),
    tasks:                 json.tasks !== undefined ? mapTasks(json.tasks) : fallback.tasks,
    stageRecommendation:   mapStageRecommendation(json.stageRecommendation, fallback.stageRecommendation),
    risks:                 mapRisks(json.risks),
  };

  if (suggestedDeadline) output.suggestedDeadline = suggestedDeadline;

  return output;
}
