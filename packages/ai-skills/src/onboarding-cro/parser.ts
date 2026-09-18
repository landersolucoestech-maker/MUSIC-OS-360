/**
 * packages/ai-skills/src/onboarding-cro/parser.ts
 *
 * Converte a resposta crua do provider em OnboardingCroOutput estruturado.
 *
 * ANTI-FABRICAÇÃO: completedStepsCount/totalStepsCount são SEMPRE derivados
 * do input.steps real (nunca do JSON do modelo) — o modelo não tem
 * permissão de reportar uma contagem diferente da realidade.
 */

import type {
  OnboardingCroInput,
  OnboardingCroOutput,
  OnboardingCroAction,
} from "./contracts";
import type { SkillPriority } from "../shared/primitives";

const PRIORITIES: SkillPriority[] = ["low", "medium", "high", "critical"];
const STEP_ORDER = [
  "company_profile",
  "invite_team",
  "first_artist",
  "first_catalog_item",
  "first_contract",
  "connect_integration",
];

const HEURISTIC_NOTE = "Análise heurística local: a análise detalhada do modelo não foi executada.";

function asString(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return fallback;
}

function asPriority(value: unknown): SkillPriority {
  const v = asString(value).toLowerCase();
  return (PRIORITIES as string[]).includes(v) ? (v as SkillPriority) : "medium";
}

function asRecordArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is Record<string, unknown> => typeof v === "object" && v !== null);
}

function mapActions(value: unknown): OnboardingCroAction[] {
  return asRecordArray(value)
    .map((v) => ({ action: asString(v.action), priority: asPriority(v.priority) }))
    .filter((v) => v.action.length > 0);
}

function computeNextStep(input: OnboardingCroInput): string {
  for (const stepName of STEP_ORDER) {
    const step = input.steps.find((s) => s.step === stepName);
    if (step && !step.completed) return stepName;
  }
  return "complete";
}

function buildFallback(input: OnboardingCroInput): OnboardingCroOutput {
  const completedCount = input.steps.filter((s) => s.completed).length;
  return {
    progressSummary: `${HEURISTIC_NOTE} Tenant "${input.tenantName}" — ${completedCount}/${input.steps.length} passos concluídos.`,
    completedStepsCount: completedCount,
    totalStepsCount: input.steps.length,
    nextRecommendedStep: computeNextStep(input),
    recommendedActions: [],
  };
}

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

export function parseOnboardingCroResponse(
  raw: string,
  input: OnboardingCroInput,
): OnboardingCroOutput {
  const json = extractJson(raw);
  const fallback = buildFallback(input);

  if (!json) return fallback;

  return {
    progressSummary: asString(json.progressSummary) || fallback.progressSummary,
    // ENFORCEMENT: sempre derivado do input real, nunca do modelo.
    completedStepsCount: fallback.completedStepsCount,
    totalStepsCount: fallback.totalStepsCount,
    nextRecommendedStep: asString(json.nextRecommendedStep) || fallback.nextRecommendedStep,
    recommendedActions: mapActions(json.recommendedActions),
  };
}
