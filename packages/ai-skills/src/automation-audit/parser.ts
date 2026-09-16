/**
 * packages/ai-skills/src/automation-audit/parser.ts
 *
 * Converte a resposta crua do provider em AutomationAuditOutput estruturado.
 * Estratégia geral (igual às demais skills do pacote): extrai JSON
 * (com/sem cercas markdown), coage cada campo, cai para fallback heurístico
 * seguro quando malformado. NUNCA lança.
 */

import type {
  AutomationAuditInput,
  AutomationAuditOutput,
  AutomationAuditHealthStatus,
  AutomationAuditFinding,
  AutomationAuditAction,
} from "./contracts";
import type { SkillSeverity, SkillPriority } from "../shared/primitives";

const HEALTH_STATUSES: AutomationAuditHealthStatus[] = ["healthy", "attention", "critical"];
const SEVERITIES: SkillSeverity[] = ["low", "medium", "high", "critical"];
const PRIORITIES: SkillPriority[] = ["low", "medium", "high", "critical"];

const HEURISTIC_NOTE = "Auditoria heurística local: a análise detalhada do modelo não foi executada.";

function asString(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return fallback;
}

function asHealthStatus(value: unknown): AutomationAuditHealthStatus {
  const v = asString(value).toLowerCase();
  return (HEALTH_STATUSES as string[]).includes(v) ? (v as AutomationAuditHealthStatus) : "attention";
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

function mapFindings(value: unknown): AutomationAuditFinding[] {
  return asRecordArray(value)
    .map((v) => ({ finding: asString(v.finding), severity: asSeverity(v.severity), evidence: asString(v.evidence) }))
    .filter((v) => v.finding.length > 0);
}

function mapActions(value: unknown): AutomationAuditAction[] {
  return asRecordArray(value)
    .map((v) => ({ action: asString(v.action), priority: asPriority(v.priority) }))
    .filter((v) => v.action.length > 0);
}

function buildFallback(input: AutomationAuditInput): AutomationAuditOutput {
  const findings: AutomationAuditFinding[] = [];
  if (!input.automationEnabled) {
    findings.push({ finding: "Automação do MusicChat está desativada.", severity: "high", evidence: "automationEnabled=false" });
  }
  return {
    auditSummary: `${HEURISTIC_NOTE} ${input.totalEventsAnalyzed} eventos analisados.`,
    healthStatus: !input.automationEnabled ? "critical" : "attention",
    findings,
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

export function parseAutomationAuditResponse(
  raw: string,
  input: AutomationAuditInput,
): AutomationAuditOutput {
  const json = extractJson(raw);
  const fallback = buildFallback(input);

  if (!json) return fallback;

  return {
    auditSummary: asString(json.auditSummary) || fallback.auditSummary,
    healthStatus: asHealthStatus(json.healthStatus),
    findings: mapFindings(json.findings).length > 0 ? mapFindings(json.findings) : fallback.findings,
    recommendedActions: mapActions(json.recommendedActions),
  };
}
