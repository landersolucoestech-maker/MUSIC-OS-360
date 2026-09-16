/**
 * packages/ai-skills/src/campaign-plan/parser.ts
 *
 * Converte a resposta crua do provider em CampaignPlanOutput estruturado.
 * Estratégia:
 *  1. tentar extrair e parsear JSON da resposta (com/sem cercas markdown, com texto à volta);
 *  2. coagir cada campo para o shape esperado, descartando valores inválidos;
 *  3. normalizar suggestedBudgetSharePercent por canal para somar 100 quando a
 *     soma bruta do modelo divergir;
 *  4. se nada for aproveitável, devolver fallback estruturado seguro montado a
 *     partir de campaignName/campaignType/objective (sinalizado como
 *     planejamento heurístico local no texto).
 * NUNCA lança — qualquer resposta malformada resulta num output válido.
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

// ─── Helpers de coerção ───────────────────────────────────────────────────────

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

// ─── Mapeadores de blocos ─────────────────────────────────────────────────────

function mapChannels(value: unknown): CampaignPlanChannel[] {
  const raw = asRecordArray(value).map((c) => ({
    channel: asString(c.channel),
    rationale: asString(c.rationale),
    suggestedBudgetSharePercent: Math.max(0, asNumber(c.suggestedBudgetSharePercent)),
  })).filter((c) => c.channel.length > 0);

  if (raw.length === 0) return [];

  const sum = raw.reduce((acc, c) => acc + c.suggestedBudgetSharePercent, 0);
  if (sum <= 0) {
    // Distribui igualmente quando o modelo não forneceu percentuais utilizáveis.
    const equalShare = Math.round((100 / raw.length) * 100) / 100;
    return raw.map((c) => ({ ...c, suggestedBudgetSharePercent: equalShare }));
  }
  if (Math.round(sum) !== 100) {
    // Renormaliza proporcionalmente para somar exatamente 100.
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

// ─── Fallback heurístico ───────────────────────────────────────────────────────

function buildFallback(input: CampaignPlanInput): CampaignPlanOutput {
  return {
    planSummary: `${HEURISTIC_NOTE} Campanha "${input.campaignName}" (${input.campaignType}).`,
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

// ─── Extração de JSON da resposta ─────────────────────────────────────────────

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
    // ignora — resposta não era JSON válido
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
