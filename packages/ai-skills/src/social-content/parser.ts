/**
 * packages/ai-skills/src/social-content/parser.ts
 *
 * Converts the provider's raw response into a structured SocialContentOutput.
 * General strategy (same as the package's other skills): extracts JSON
 * (with/without markdown fences), coerces each field, and falls back to a safe
 * heuristic output when malformed. NEVER throws.
 */

import type {
  SocialContentInput,
  SocialContentOutput,
  SocialContentCaptionVariant,
  SocialContentChecklistItem,
} from "./contracts";

function asString(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return fallback;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .filter((v) => v.length > 0);
}

function asRecordArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is Record<string, unknown> => typeof v === "object" && v !== null);
}

function mapCaptionVariants(value: unknown): SocialContentCaptionVariant[] {
  return asRecordArray(value)
    .map((v) => ({ variant: asString(v.variant), tone: asString(v.tone, "neutro") }))
    .filter((v) => v.variant.length > 0);
}

function mapChecklist(value: unknown): SocialContentChecklistItem[] {
  return asRecordArray(value)
    .map((v) => ({ item: asString(v.item), reason: asString(v.reason) }))
    .filter((v) => v.item.length > 0);
}

function buildFallback(input: SocialContentInput): SocialContentOutput {
  return {
    captionVariants: input.draftCopy
      ? [{ variant: input.draftCopy, tone: "original (rascunho do usuário)" }]
      : [{ variant: `${input.title} — confira novidades sobre ${input.targetName}.`, tone: "direto" }],
    hashtags: [],
    toneNotes: "Retrospectiva heurística local: a sugestão detalhada do modelo não foi executada.",
    channelChecklist: [],
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
    // ignore — the response was not valid JSON
  }
  return null;
}

export function parseSocialContentResponse(
  raw: string,
  input: SocialContentInput,
): SocialContentOutput {
  const json = extractJson(raw);
  const fallback = buildFallback(input);

  if (!json) return fallback;

  const captionVariants = mapCaptionVariants(json.captionVariants);

  return {
    captionVariants: captionVariants.length > 0 ? captionVariants : fallback.captionVariants,
    hashtags: asStringArray(json.hashtags),
    toneNotes: asString(json.toneNotes) || fallback.toneNotes,
    channelChecklist: mapChecklist(json.channelChecklist),
  };
}
