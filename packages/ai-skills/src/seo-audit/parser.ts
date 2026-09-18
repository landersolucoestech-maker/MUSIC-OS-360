/**
 * packages/ai-skills/src/seo-audit/parser.ts
 *
 * Converte a resposta crua do provider em SeoAuditOutput estruturado.
 *
 * ENFORCEMENT ANTI-FABRICAÇÃO: todo check com source !== "static_analysis"
 * é DESCARTADO aqui (nunca repassado ao chamador) — o runner de automação
 * não chama validateOutput, então este é o ponto real de aplicação. As
 * métricas externas clássicas (ranking, tráfego, backlinks, etc.) são
 * SEMPRE incluídas em unavailableMetrics, independentemente do que o
 * modelo tenha devolvido.
 */

import type {
  SeoAuditInput,
  SeoAuditOutput,
  SeoAuditCheck,
  SeoAuditCheckSource,
  SeoAuditSeverityOrInfo,
  SeoAuditMetricProvenance,
} from "./contracts";

const SEVERITIES: SeoAuditSeverityOrInfo[] = ["low", "medium", "high", "critical", "info"];
const PROVENANCES: SeoAuditMetricProvenance[] = ["actual", "unavailable"];

const ALWAYS_UNAVAILABLE = [
  "ranking de busca",
  "volume de busca",
  "autoridade de domínio",
  "tráfego orgânico",
  "posição em SERP",
  "backlinks",
  "Core Web Vitals",
  "status de indexação",
];

const HEURISTIC_NOTE = "Auditoria heurística local: a análise detalhada do modelo não foi executada.";

function asString(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return fallback;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((v) => (typeof v === "string" ? v.trim() : "")).filter((v) => v.length > 0);
}

function asSeverity(value: unknown): SeoAuditSeverityOrInfo {
  const v = asString(value).toLowerCase();
  return (SEVERITIES as string[]).includes(v) ? (v as SeoAuditSeverityOrInfo) : "info";
}

function asProvenance(value: unknown): SeoAuditMetricProvenance {
  const v = asString(value).toLowerCase();
  return (PROVENANCES as string[]).includes(v) ? (v as SeoAuditMetricProvenance) : "unavailable";
}

function asRecordArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is Record<string, unknown> => typeof v === "object" && v !== null);
}

/** Descarta qualquer check que o modelo tenha marcado como external_measurement
 * ANTES de mapear — nunca repassado ao chamador, mesmo relabeled. */
function mapChecks(value: unknown): SeoAuditCheck[] {
  return asRecordArray(value)
    .filter((v) => asString(v.source, "static_analysis").toLowerCase() !== "external_measurement")
    .map((v) => ({
      subject: asString(v.subject),
      source: "static_analysis" as SeoAuditCheckSource,
      check: asString(v.check),
      evidence: asString(v.evidence),
      result: asString(v.result),
      severity: asSeverity(v.severity),
      recommendation: asString(v.recommendation),
      metricProvenance: asProvenance(v.metricProvenance),
    }))
    .filter((v) => v.check.length > 0);
}

function buildFallbackChecks(input: SeoAuditInput): SeoAuditCheck[] {
  const checks: SeoAuditCheck[] = [];
  checks.push({
    subject: input.campaignName,
    source: "static_analysis",
    check: "URL de destino configurada",
    evidence: input.destinationUrl ?? "(não configurada)",
    result: input.destinationUrl ? "presente" : "ausente",
    severity: input.destinationUrl ? "info" : "medium",
    recommendation: input.destinationUrl ? "" : "Configurar uma URL de destino para a campanha.",
    metricProvenance: "actual",
  });
  checks.push({
    subject: input.campaignName,
    source: "static_analysis",
    check: "Rastreamento UTM presente",
    evidence: String(input.hasUtm),
    result: input.hasUtm ? "presente" : "ausente",
    severity: input.hasUtm ? "info" : "low",
    recommendation: input.hasUtm ? "" : "Configurar parâmetros UTM para rastrear a origem do tráfego.",
    metricProvenance: "actual",
  });
  return checks;
}

function buildFallback(input: SeoAuditInput): SeoAuditOutput {
  return {
    auditSummary: `${HEURISTIC_NOTE} Campanha "${input.campaignName}".`,
    checks: buildFallbackChecks(input),
    unavailableMetrics: [...ALWAYS_UNAVAILABLE],
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

export function parseSeoAuditResponse(
  raw: string,
  input: SeoAuditInput,
): SeoAuditOutput {
  const json = extractJson(raw);
  const fallback = buildFallback(input);

  if (!json) return fallback;

  const checks = mapChecks(json.checks);
  const modelUnavailable = asStringArray(json.unavailableMetrics);
  const unavailableMetrics = Array.from(new Set([...ALWAYS_UNAVAILABLE, ...modelUnavailable]));

  return {
    auditSummary: asString(json.auditSummary) || fallback.auditSummary,
    checks: checks.length > 0 ? checks : fallback.checks,
    unavailableMetrics,
  };
}
