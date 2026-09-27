/**
 * packages/ai-skills/src/financial-classification/parser.ts
 *
 * Converts the provider's raw response into a structured FinancialClassificationOutput.
 * Strategy:
 *  1. try to extract and parse JSON from the response (with/without markdown fences, with surrounding text);
 *  2. coerce each field to the expected shape, dropping invalid values;
 *  3. normalize confidence to 0–1;
 *  4. if nothing is usable, return a safe structured fallback that infers the
 *     category and cost center from description keywords.
 * NEVER throws — any malformed response yields a valid output.
 */

import type {
  FinancialClassificationInput,
  FinancialClassificationOutput,
  FinancialRecurrence,
  LinkedEntityType,
  LinkedEntitySuggestion,
  FinancialRisk,
  FinancialRecommendedAction,
} from "./contracts";
import type { SkillSeverity, SkillPriority } from "../shared/primitives";

const SEVERITIES: SkillSeverity[] = ["low", "medium", "high", "critical"];
const PRIORITIES: SkillPriority[] = ["low", "medium", "high", "critical"];
const RECURRENCES: FinancialRecurrence[] = ["one-time", "weekly", "monthly", "quarterly", "yearly", "unknown"];
const COST_CENTERS = ["marketing", "audiovisual", "legal", "distribution", "royalties", "administrative", "commercial", "other"];
const ENTITY_TYPES: LinkedEntityType[] = ["artist", "project", "release", "contract", "campaign", "supplier", "client", "none"];

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

function asRecurrence(value: unknown): FinancialRecurrence {
  const v = asString(value).toLowerCase();
  return (RECURRENCES as string[]).includes(v) ? (v as FinancialRecurrence) : "unknown";
}

function asCostCenter(value: unknown, fallback: string): string {
  const v = asString(value).toLowerCase();
  return COST_CENTERS.includes(v) ? v : fallback;
}

function asEntityType(value: unknown): LinkedEntityType | undefined {
  const v = asString(value).toLowerCase();
  return (ENTITY_TYPES as string[]).includes(v) ? (v as LinkedEntityType) : undefined;
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

function normalizeConfidence(value: unknown, fallback: number): number {
  let n = typeof value === "number" ? value : Number(asString(value));
  if (!Number.isFinite(n)) return fallback;
  if (n > 1 && n <= 100) n = n / 100; // accepts a percentage (e.g. 80 → 0.8)
  return Math.max(0, Math.min(1, n));
}

// ─── Keyword inference (fallback) ─────────────────────────────────────────────

interface KeywordRule {
  test: RegExp;
  costCenter: string;
  category: string;
}

const KEYWORD_RULES: KeywordRule[] = [
  { test: /\b(marketing|tráfego|trafego|ads?|an[úu]ncio|meta|facebook|instagram|google ads|tiktok ads|campanha)\b/i, costCenter: "marketing", category: "Marketing / Tráfego pago" },
  { test: /\b(clipe|v[íi]deo|audiovisual|filmagem|capta[çc][ãa]o|p[óo]s-produ[çc][ãa]o|edi[çc][ãa]o de v[íi]deo)\b/i, costCenter: "audiovisual", category: "Audiovisual" },
  { test: /\b(est[úu]dio|studio|mixagem|masteriza[çc][ãa]o|produ[çc][ãa]o musical|grava[çc][ãa]o)\b/i, costCenter: "audiovisual", category: "Produção musical / Estúdio" },
  { test: /\b(jur[íi]dic[oa]|advogad[oa]|contrato|registro|legal|cart[óo]rio)\b/i, costCenter: "legal", category: "Jurídico" },
  { test: /\b(distribui[çc][ãa]o|dsp|agregador[a]?|onerpm|distrokid|symphonic|spotify|deezer)\b/i, costCenter: "distribution", category: "Distribuição" },
  { test: /\b(royalt(y|ies|ias?)|direito autoral|ecad|publishing|adiantamento|advance|recoup)\b/i, costCenter: "royalties", category: "Royalties / Direitos autorais" },
  { test: /\b(show|evento|cach[êe]|turn[êe]|festival|apresenta[çc][ãa]o)\b/i, costCenter: "commercial", category: "Shows / Eventos" },
  { test: /\b(licenciamento|sync|sincroniza[çc][ãa]o)\b/i, costCenter: "commercial", category: "Licenciamento / Sync" },
  { test: /\b(fornecedor|supplier|cliente|client|nota fiscal|servi[çc]o)\b/i, costCenter: "commercial", category: "Fornecedores / Clientes" },
  { test: /\b(imposto|tax|das|iss|inss|irrf|tribut)\b/i, costCenter: "administrative", category: "Impostos / Tributos" },
  { test: /\b(sal[áa]rio|aluguel|administra|escrit[óo]rio|cont[áa]bil|despesa fixa)\b/i, costCenter: "administrative", category: "Administrativo" },
];

function inferFromDescription(description: string): { category: string; costCenter: string } {
  for (const rule of KEYWORD_RULES) {
    if (rule.test.test(description)) {
      return { category: rule.category, costCenter: rule.costCenter };
    }
  }
  return { category: "Não classificado", costCenter: "other" };
}

function inferLinkedEntity(input: FinancialClassificationInput): LinkedEntitySuggestion {
  if (input.relatedArtist?.trim()) {
    return { entityType: "artist", entityName: input.relatedArtist, reason: "Artista informado na transação." };
  }
  if (input.relatedRelease?.trim()) {
    return { entityType: "release", entityName: input.relatedRelease, reason: "Lançamento informado na transação." };
  }
  if (input.relatedProject?.trim()) {
    return { entityType: "project", entityName: input.relatedProject, reason: "Projeto informado na transação." };
  }
  return { entityType: "none" };
}

// ─── Block mappers ────────────────────────────────────────────────────────────

function mapLinkedEntity(value: unknown, fallback: LinkedEntitySuggestion): LinkedEntitySuggestion {
  const m = asRecord(value);
  if (!m) return fallback;

  const suggestion: LinkedEntitySuggestion = {};
  const entityType = asEntityType(m.entityType);
  if (entityType) suggestion.entityType = entityType;
  const entityName = asString(m.entityName);
  if (entityName) suggestion.entityName = entityName;
  const reason = asString(m.reason);
  if (reason) suggestion.reason = reason;

  // When nothing is usable, return the fallback inferred from the input.
  return Object.keys(suggestion).length > 0 ? suggestion : fallback;
}

function mapRisks(value: unknown): FinancialRisk[] {
  return asRecordArray(value).map((r) => ({
    risk:           asString(r.risk),
    severity:       asSeverity(r.severity),
    recommendation: asString(r.recommendation),
  }));
}

function mapRecommendedActions(value: unknown): FinancialRecommendedAction[] {
  return asRecordArray(value).map((a) => ({
    action:   asString(a.action),
    priority: asPriority(a.priority),
  }));
}

// ─── Safe structured fallback ─────────────────────────────────────────────────

function buildFallback(input: FinancialClassificationInput): FinancialClassificationOutput {
  const { category, costCenter } = inferFromDescription(input.description ?? "");

  return {
    category,
    costCenter,
    suggestedTags: [input.direction, costCenter].filter(Boolean),
    recurrence: "unknown",
    confidence: 0.3,
    accountingNotes: [
      "Classificação heurística gerada localmente (sem resposta válida do modelo).",
    ],
    linkedEntitySuggestion: inferLinkedEntity(input),
    risks: [],
    recommendedActions:
      costCenter === "other"
        ? [{ action: "Revisar e classificar manualmente a transação.", priority: "medium" as SkillPriority }]
        : [],
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

export function parseFinancialClassificationResponse(
  raw: string,
  input: FinancialClassificationInput,
): FinancialClassificationOutput {
  const json = extractJson(raw);

  const fallback = buildFallback(input);

  if (!json) {
    return fallback;
  }

  return {
    category:               asString(json.category) || fallback.category,
    costCenter:             asCostCenter(json.costCenter, fallback.costCenter),
    suggestedTags:          json.suggestedTags !== undefined ? asStringArray(json.suggestedTags) : fallback.suggestedTags,
    recurrence:             asRecurrence(json.recurrence),
    confidence:             normalizeConfidence(json.confidence, fallback.confidence),
    accountingNotes:        asStringArray(json.accountingNotes),
    linkedEntitySuggestion: mapLinkedEntity(json.linkedEntitySuggestion, fallback.linkedEntitySuggestion),
    risks:                  mapRisks(json.risks),
    recommendedActions:     mapRecommendedActions(json.recommendedActions),
  };
}
