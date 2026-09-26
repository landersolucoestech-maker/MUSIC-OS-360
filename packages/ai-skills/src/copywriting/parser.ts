/**
 * packages/ai-skills/src/copywriting/parser.ts
 *
 * Converts the provider's raw response into a structured CopywritingOutput.
 *
 * ANTI-FABRICATION ENFORCEMENT: `usedFacts` is always filtered to contain only
 * items that literally exist in input.sourceFacts — any "fact" the model
 * invented is dropped here and never passed to the caller (the automation
 * runner does not call validateOutput).
 */

import type { CopywritingInput, CopywritingOutput } from "./contracts";

const HEURISTIC_NOTE = "Rascunho heurístico local: a geração detalhada do modelo não foi executada. Revise antes de usar.";

function asString(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return fallback;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((v) => (typeof v === "string" ? v.trim() : "")).filter((v) => v.length > 0);
}

function buildFallback(input: CopywritingInput): CopywritingOutput {
  return {
    draftTitle: input.taskTitle,
    draftBody: `${HEURISTIC_NOTE}\n\nRascunho para: ${input.taskTitle}.`,
    usedFacts: [],
    isDraft: true,
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

export function parseCopywritingResponse(
  raw: string,
  input: CopywritingInput,
): CopywritingOutput {
  const json = extractJson(raw);
  const fallback = buildFallback(input);

  if (!json) return fallback;

  const allowedFacts = new Set(input.sourceFacts ?? []);
  const usedFacts = asStringArray(json.usedFacts).filter((f) => allowedFacts.has(f));

  return {
    draftTitle: asString(json.draftTitle) || fallback.draftTitle,
    draftBody: asString(json.draftBody) || fallback.draftBody,
    // ENFORCEMENT: drops any "fact" that does not literally exist in the real input.
    usedFacts,
    isDraft: true,
  };
}
