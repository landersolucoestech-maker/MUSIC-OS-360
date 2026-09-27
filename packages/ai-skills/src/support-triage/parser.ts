/**
 * packages/ai-skills/src/support-triage/parser.ts
 *
 * Converts the provider's raw response into a structured SupportTriageOutput.
 * Strategy:
 *  1. try to extract and parse JSON from the response (with/without markdown fences, with surrounding text);
 *  2. coerce each field to the expected shape, dropping invalid values;
 *  3. if nothing is usable, return a safe structured fallback with a local
 *     heuristic triage (priority/severity inferred from keywords).
 * NEVER throws — any malformed response yields a valid output.
 */

import type {
  SupportTriageInput,
  SupportTriageOutput,
  SLARecommendation,
  SupportRecommendedAction,
} from "./contracts";
import type { SkillSeverity, SkillPriority } from "../shared/primitives";

const SEVERITIES: SkillSeverity[] = ["low", "medium", "high", "critical"];
const PRIORITIES: SkillPriority[] = ["low", "medium", "high", "critical"];

const HEURISTIC_NOTE = "Triagem heurística local: a classificação detalhada do modelo não foi executada. Revisar antes de responder/escalar.";

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

function asBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    if (["true", "sim", "yes", "1"].includes(v)) return true;
    if (["false", "não", "nao", "no", "0"].includes(v)) return false;
  }
  return fallback;
}

function asSeverity(value: unknown, fallback: SkillSeverity): SkillSeverity {
  const v = asString(value).toLowerCase();
  return (SEVERITIES as string[]).includes(v) ? (v as SkillSeverity) : fallback;
}

function asPriority(value: unknown, fallback: SkillPriority): SkillPriority {
  const v = asString(value).toLowerCase();
  return (PRIORITIES as string[]).includes(v) ? (v as SkillPriority) : fallback;
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

// ─── Keyword inference (fallback) ─────────────────────────────────────────────

const HIGH_TECH_RE = /\b(erro|bug|falha|n[ãa]o consigo|travou|crash|quebrou|indispon[íi]vel)\b/i;
const HIGH_SENSITIVE_RE = /\b(pagamento|cobran[çc]a|contrato|login|acesso|senha|autentica[çc][ãa]o)\b/i;
const LOW_RE = /\b(d[úu]vida|como fa[çc]o|como faz|tutorial|ajuda para|aprender)\b/i;

function inferLevel(text: string): SkillPriority {
  if (HIGH_TECH_RE.test(text) || HIGH_SENSITIVE_RE.test(text)) return "high";
  if (LOW_RE.test(text)) return "low";
  return "medium";
}

const SLA_BY_LEVEL: Record<SkillPriority, { responseTime: string; resolutionTime: string }> = {
  critical: { responseTime: "1h",  resolutionTime: "8h" },
  high:     { responseTime: "2h",  resolutionTime: "1 dia útil" },
  medium:   { responseTime: "8h",  resolutionTime: "3 dias úteis" },
  low:      { responseTime: "24h", resolutionTime: "5 dias úteis" },
};

// ─── Block mappers ────────────────────────────────────────────────────────────

function mapSla(value: unknown, fallback: SLARecommendation): SLARecommendation {
  const m = asRecord(value);
  if (!m) return fallback;

  const sla: SLARecommendation = {
    responseTime: asString(m.responseTime) || fallback.responseTime,
    reason:       asString(m.reason) || fallback.reason,
  };
  const resolutionTime = asString(m.resolutionTime);
  if (resolutionTime) sla.resolutionTime = resolutionTime;
  return sla;
}

function mapActions(value: unknown): SupportRecommendedAction[] {
  return asRecordArray(value).map((a) => {
    const action: SupportRecommendedAction = {
      action:   asString(a.action),
      priority: asPriority(a.priority, "medium"),
    };
    const ownerArea = asString(a.ownerArea);
    if (ownerArea) action.ownerArea = ownerArea;
    return action;
  });
}

// ─── Safe structured fallback ─────────────────────────────────────────────────

function buildFallback(input: SupportTriageInput): SupportTriageOutput {
  const text = `${input.subject} ${input.message}`;
  const level = inferLevel(text);
  const escalationNeeded = level === "high" || level === "critical";
  const sla = SLA_BY_LEVEL[level] ?? SLA_BY_LEVEL.medium;

  return {
    category: "Não classificado (triagem heurística)",
    priority: level,
    severity: level,
    affectedModule: input.affectedModule ?? "other",
    likelyCause: `Causa não determinada automaticamente. ${HEURISTIC_NOTE}`,
    suggestedResponse:
      `Olá! Recebemos sua solicitação sobre "${input.subject}" e já estamos analisando. ` +
      `Em breve retornaremos com uma atualização. Obrigado pelo contato.`,
    escalationNeeded,
    SLARecommendation: {
      responseTime: sla.responseTime,
      resolutionTime: sla.resolutionTime,
      reason: `SLA sugerido pela prioridade heurística (${level}). ${HEURISTIC_NOTE}`,
    },
    internalNotes: [
      HEURISTIC_NOTE,
      `Prioridade/severidade inferidas por palavras-chave: ${level}.`,
    ],
    recommendedActions: [
      { action: "Revisar e reclassificar manualmente o ticket.", priority: "medium" },
    ],
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

export function parseSupportTriageResponse(
  raw: string,
  input: SupportTriageInput,
): SupportTriageOutput {
  const json = extractJson(raw);

  const fallback = buildFallback(input);

  if (!json) {
    return fallback;
  }

  return {
    category:           asString(json.category) || fallback.category,
    priority:           asPriority(json.priority, fallback.priority),
    severity:           asSeverity(json.severity, fallback.severity),
    affectedModule:     asString(json.affectedModule) || fallback.affectedModule,
    likelyCause:        asString(json.likelyCause) || fallback.likelyCause,
    suggestedResponse:  asString(json.suggestedResponse) || fallback.suggestedResponse,
    escalationNeeded:   json.escalationNeeded !== undefined ? asBoolean(json.escalationNeeded) : fallback.escalationNeeded,
    SLARecommendation:  mapSla(json.SLARecommendation, fallback.SLARecommendation),
    internalNotes:      asStringArray(json.internalNotes),
    recommendedActions: mapActions(json.recommendedActions),
  };
}
