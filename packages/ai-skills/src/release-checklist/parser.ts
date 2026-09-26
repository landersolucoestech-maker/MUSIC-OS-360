/**
 * packages/ai-skills/src/release-checklist/parser.ts
 *
 * Converts the provider's raw response into a structured ReleaseChecklistOutput.
 * Strategy: extract JSON (markdown/cutout/surrounding text) → coerce → normalize
 * readinessScore (0–100) and status → safe fallback from the booleans.
 * NEVER throws — any malformed response yields a valid output.
 */

import type {
  ReleaseChecklistInput,
  ReleaseChecklistOutput,
  ReleaseStatus,
  ItemSeverity,
  ActionPriority,
  MissingItem,
  CriticalIssue,
  ChecklistItem,
  RecommendedAction,
  MetadataReview,
} from "./contracts";

const SEVERITIES: ItemSeverity[] = ["low", "medium", "high", "critical"];
const PRIORITIES: ActionPriority[] = ["low", "medium", "high", "critical"];
const STATUSES: ReleaseStatus[] = ["not-ready", "needs-attention", "almost-ready", "ready"];

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

function asSeverity(value: unknown): ItemSeverity {
  const v = asString(value).toLowerCase();
  return (SEVERITIES as string[]).includes(v) ? (v as ItemSeverity) : "medium";
}

function asPriority(value: unknown): ActionPriority {
  const v = asString(value).toLowerCase();
  return (PRIORITIES as string[]).includes(v) ? (v as ActionPriority) : "medium";
}

function asRecordArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is Record<string, unknown> => typeof v === "object" && v !== null);
}

function normalizeScore(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : Number(asString(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function statusFromScore(score: number): ReleaseStatus {
  if (score >= 90) return "ready";
  if (score >= 70) return "almost-ready";
  if (score >= 40) return "needs-attention";
  return "not-ready";
}

function asStatus(value: unknown, score: number): ReleaseStatus {
  const v = asString(value).toLowerCase();
  return (STATUSES as string[]).includes(v) ? (v as ReleaseStatus) : statusFromScore(score);
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

function mapMissingItems(value: unknown): MissingItem[] {
  return asRecordArray(value).map((m) => ({
    item:     asString(m.item),
    area:     asString(m.area),
    severity: asSeverity(m.severity),
    reason:   asString(m.reason),
  }));
}

function mapCriticalIssues(value: unknown): CriticalIssue[] {
  return asRecordArray(value).map((c) => ({
    issue:          asString(c.issue),
    impact:         asString(c.impact),
    recommendedFix: asString(c.recommendedFix),
  }));
}

function mapChecklist(value: unknown): ChecklistItem[] {
  return asRecordArray(value).map((c) => ({
    item:      asString(c.item),
    completed: asBoolean(c.completed),
    area:      asString(c.area),
    required:  asBoolean(c.required, true),
  }));
}

function mapRecommendedActions(value: unknown): RecommendedAction[] {
  return asRecordArray(value).map((a) => ({
    action:    asString(a.action),
    priority:  asPriority(a.priority),
    ownerArea: asString(a.ownerArea),
  }));
}

function mapMetadataReview(value: unknown, fallback: MetadataReview): MetadataReview {
  if (typeof value !== "object" || value === null) return fallback;
  const m = value as Record<string, unknown>;
  return {
    hasMinimumMetadata: asBoolean(m.hasMinimumMetadata, fallback.hasMinimumMetadata),
    missingMetadata:    asStringArray(m.missingMetadata),
    notes:              asStringArray(m.notes),
  };
}

// ─── Basic score from the input booleans ──────────────────────────────────────

function computeBaselineScore(input: ReleaseChecklistInput): number {
  const flags = [
    input.hasCover,
    input.hasISRC,
    input.hasUPC,
    input.hasContracts,
    input.hasSplits,
    input.hasMarketingPlan,
  ];
  const done = flags.filter(Boolean).length;
  return Math.round((done / flags.length) * 100);
}

// ─── Fallback estruturado seguro ──────────────────────────────────────────────

function buildFallback(raw: string, input: ReleaseChecklistInput): ReleaseChecklistOutput {
  const score = computeBaselineScore(input);

  const checks: Array<{ item: string; completed: boolean; area: string }> = [
    { item: "Capa (artwork)",     completed: input.hasCover,        area: "Audiovisual" },
    { item: "ISRC",               completed: input.hasISRC,         area: "Gravadora" },
    { item: "UPC",                completed: input.hasUPC,          area: "Gravadora" },
    { item: "Contratos",          completed: input.hasContracts,    area: "Jurídico" },
    { item: "Splits",             completed: input.hasSplits,       area: "Editora" },
    { item: "Plano de marketing", completed: input.hasMarketingPlan, area: "Marketing" },
  ];

  const missingItems: MissingItem[] = checks
    .filter((c) => !c.completed)
    .map((c) => ({
      item:     c.item,
      area:     c.area,
      severity: "high" as ItemSeverity,
      reason:   `${c.item} ainda não está pronto.`,
    }));

  return {
    readinessScore: score,
    status:         statusFromScore(score),
    missingItems,
    criticalIssues: [],
    warnings: raw.trim()
      ? ["Resposta do modelo não pôde ser interpretada como JSON; checklist calculado a partir dos dados de entrada."]
      : [],
    checklist: checks.map((c) => ({
      item:      c.item,
      completed: c.completed,
      area:      c.area,
      required:  true,
    })),
    recommendedActions: missingItems.map((m) => ({
      action:    `Concluir: ${m.item}`,
      priority:  "high" as ActionPriority,
      ownerArea: m.area,
    })),
    metadataReview: {
      hasMinimumMetadata: input.hasISRC && input.hasUPC,
      missingMetadata: [
        ...(input.hasISRC ? [] : ["ISRC"]),
        ...(input.hasUPC ? [] : ["UPC"]),
      ],
      notes: [],
    },
  };
}

// ─── Parser principal ─────────────────────────────────────────────────────────

export function parseReleaseChecklistResponse(
  raw: string,
  input: ReleaseChecklistInput,
): ReleaseChecklistOutput {
  const json = extractJson(raw);

  if (!json) {
    return buildFallback(raw, input);
  }

  const fallback = buildFallback(raw, input);
  const score = normalizeScore(json.readinessScore, fallback.readinessScore);

  return {
    readinessScore:     score,
    status:             asStatus(json.status, score),
    missingItems:       mapMissingItems(json.missingItems),
    criticalIssues:     mapCriticalIssues(json.criticalIssues),
    warnings:           asStringArray(json.warnings),
    checklist:          json.checklist !== undefined ? mapChecklist(json.checklist) : fallback.checklist,
    recommendedActions: mapRecommendedActions(json.recommendedActions),
    metadataReview:     mapMetadataReview(json.metadataReview, fallback.metadataReview),
  };
}
