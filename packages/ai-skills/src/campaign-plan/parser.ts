/**
 * packages/ai-skills/src/campaign-plan/parser.ts
 *
 * Converts the provider's raw response into a structured CampaignPlanOutput.
 * Strategy:
 *  1. try to extract and parse JSON from the response (with/without markdown fences, with surrounding text);
 *  2. coerce each field to the expected shape, dropping invalid values;
 *  3. normalize suggestedBudgetSharePercent per channel to sum to 100 when the
 *     model's raw sum diverges;
 *  4. if nothing is usable, return a safe structured fallback built from
 *     campaignName/campaignType/objective (flagged in the text as local
 *     heuristic planning).
 * NEVER throws — any malformed response yields a valid output.
 */

import type {
  CampaignPlanInput,
  CampaignPlanOutput,
  CampaignPlanChannel,
  CampaignPlanMilestone,
  CampaignPlanTask,
  CampaignPlanRisk,
} from "./contracts";
import type { SkillSeverity, SkillPriority } from "../shared/primitives";

const SEVERITIES: SkillSeverity[] = ["low", "medium", "high", "critical"];
const PRIORITIES: SkillPriority[] = ["low", "medium", "high", "critical"];

const HEURISTIC_NOTE = "Plano heurístico local: o planejamento detalhado do modelo não foi executado. Revise antes de operacionalizar.";

// ─── Coercion helpers ─────────────────────────────────────────────────────────

function asString(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value.replace(/%/g, "").replace(",", "."));
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

function asSeverity(value: unknown): SkillSeverity {
  const v = asString(value).toLowerCase();
  return (SEVERITIES as string[]).includes(v) ? (v as SkillSeverity) : "medium";
}

function asPriority(value: unknown): SkillPriority {
  const v = asString(value).toLowerCase();
  return (PRIORITIES as string[]).includes(v) ? (v as SkillPriority) : "medium";
}

function asRecordArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is Record<string, unknown> => typeof v === "object" && v !== null);
}

// ─── Block mappers ────────────────────────────────────────────────────────────

function mapChannels(value: unknown): CampaignPlanChannel[] {
  const raw = asRecordArray(value).map((c) => ({
    channel: asString(c.channel),
    rationale: asString(c.rationale),
    suggestedBudgetSharePercent: Math.max(0, asNumber(c.suggestedBudgetSharePercent)),
  })).filter((c) => c.channel.length > 0);

  if (raw.length === 0) return [];

  const sum = raw.reduce((acc, c) => acc + c.suggestedBudgetSharePercent, 0);
  if (sum <= 0) {
    // Splits evenly when the model provided no usable percentages.
    const equalShare = Math.round((100 / raw.length) * 100) / 100;
    return raw.map((c) => ({ ...c, suggestedBudgetSharePercent: equalShare }));
  }
  if (Math.round(sum) !== 100) {
    // Renormalizes proportionally to sum to exactly 100.
    return raw.map((c) => ({
      ...c,
      suggestedBudgetSharePercent: Math.round((c.suggestedBudgetSharePercent / sum) * 10000) / 100,
    }));
  }
  return raw;
}

function mapMilestones(value: unknown): CampaignPlanMilestone[] {
  return asRecordArray(value).map((m) => ({
    milestone: asString(m.milestone),
    timing: asString(m.timing),
  })).filter((m) => m.milestone.length > 0);
}

function mapTasks(value: unknown): CampaignPlanTask[] {
  return asRecordArray(value).map((t) => ({
    task: asString(t.task),
    area: asString(t.area, "Marketing"),
    priority: asPriority(t.priority),
  })).filter((t) => t.task.length > 0);
}

function mapRisks(value: unknown): CampaignPlanRisk[] {
  return asRecordArray(value).map((r) => ({
    risk: asString(r.risk),
    severity: asSeverity(r.severity),
    mitigation: asString(r.mitigation),
  })).filter((r) => r.risk.length > 0);
}

// ─── Heuristic fallback ────────────────────────────────────────────────────────

function buildFallback(input: CampaignPlanInput): CampaignPlanOutput {
  return {
    planSummary: `${HEURISTIC_NOTE} Campanha "${input.campaignName}".`,
    channels: [],
    milestones: [],
    suggestedTasks: [
      { task: "Definir canais e orçamento da campanha manualmente.", area: "Marketing", priority: "high" },
    ],
    risks: [],
    budgetNotes: input.budget === undefined
      ? "Orçamento não informado — planejamento heurístico não pôde sugerir alocação por canal."
      : "Planejamento heurístico local — revisar alocação de orçamento manualmente.",
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

export function parseCampaignPlanResponse(
  raw: string,
  input: CampaignPlanInput,
): CampaignPlanOutput {
  const json = extractJson(raw);
  const fallback = buildFallback(input);

  if (!json) return fallback;

  return {
    planSummary: asString(json.planSummary) || fallback.planSummary,
    channels: mapChannels(json.channels),
    milestones: mapMilestones(json.milestones),
    suggestedTasks: mapTasks(json.suggestedTasks).length > 0
      ? mapTasks(json.suggestedTasks)
      : fallback.suggestedTasks,
    risks: mapRisks(json.risks),
    budgetNotes: asString(json.budgetNotes) || fallback.budgetNotes,
  };
}
