/**
 * work-registry-fields.util.ts
 *
 * The work registry fields read by society-payload-builder.service.ts
 * (buildWorkPayload) are the single source of truth since CZ-039: the form
 * writes language / is_instrumental / ai_used / alternative_titles / lyrics
 * directly (their Portuguese duplicates became legacy_* columns). Only two
 * registry fields are still DERIVED on every write, because the form captures
 * them in another shape:
 *   - duration_seconds  <- duration_text ("MM:SS")
 *   - ai_tools / ai_prompts <- ai_harmony / ai_melody / ai_lyrics ({tool, prompt})
 */

import { parseDurationTextToSeconds } from '../../common/registry-fields/registry-fields.util';

// parseDurationTextToSeconds moved to the shared registry-fields util; re-exported so existing imports keep working.
export { parseDurationTextToSeconds };

type AiElement = { tool?: string; prompt?: string } | null | undefined;

/** ai_harmony/ai_melody/ai_lyrics ({tool,prompt}|null) -> ai_tools/ai_prompts (string[]). */
export function deriveAiToolsAndPrompts(
  aiHarmony: AiElement,
  aiMelody: AiElement,
  aiLyrics: AiElement,
): { ai_tools: string[]; ai_prompts: string[] } {
  const elements = [aiHarmony, aiMelody, aiLyrics];
  const ai_tools = elements
    .map((e) => e?.tool)
    .filter((v): v is string => typeof v === 'string' && v.trim().length > 0);
  const ai_prompts = elements
    .map((e) => e?.prompt)
    .filter((v): v is string => typeof v === 'string' && v.trim().length > 0);
  return { ai_tools, ai_prompts };
}

export interface WorkRegistrySourceFields {
  duration_text?: string | null;
  ai_harmony?: AiElement;
  ai_melody?: AiElement;
  ai_lyrics?: AiElement;
}

export interface WorkRegistryDerivedFields {
  duration_seconds: number | null;
  ai_tools: string[];
  ai_prompts: string[];
}

/**
 * Derives the registry fields from a FULLY MERGED view of their sources
 * (the caller merges the incoming patch over the current entity so a partial
 * update -- e.g. changing only `ai_melody` -- still derives correct
 * ai_tools/ai_prompts from the unchanged sibling fields, not from `undefined`).
 */
export function deriveWorkRegistryFields(merged: WorkRegistrySourceFields): WorkRegistryDerivedFields {
  const { ai_tools, ai_prompts } = deriveAiToolsAndPrompts(merged.ai_harmony, merged.ai_melody, merged.ai_lyrics);
  return {
    duration_seconds: parseDurationTextToSeconds(merged.duration_text),
    ai_tools,
    ai_prompts,
  };
}
