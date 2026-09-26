/**
 * packages/ai-skills/src/copywriting/contracts.ts
 *
 * Contracts of the copywriting skill (version 1.0.0).
 * Draft of GENERIC marketing text (not structured into channel/platform-specific
 * fields) for a real MarketingTaskEntity whose `kind` indicates a textual work
 * type (copywriting, email, press, etc. — the real catalog is in
 * operational-lists.defaults.ts).
 *
 * Scope distinction (never duplicated):
 *   social-content — structured copy for ONE existing social content POST
 *                     (headline/cta not applicable; focus on caption
 *                     variations for a specific channel).
 *   ad-creative     — structured copy (headline/primaryCopy/description/cta)
 *                     for ONE paid ad creative, specific platform+placement.
 *   copywriting     — FREE-FORM text draft (prose, not structured into channel
 *                     fields) for a marketing TASK (email, press release,
 *                     landing copy, etc.) — the source is the TASK
 *                     (marketing_tasks), not a post or an ad.
 *
 * ANTI-FABRICATION: every fact about the artist/release/campaign used in the
 * text must come literally from the input (sourceFacts) — the skill never
 * invents dates, numbers, awards or claims about the artist/project. The
 * generated text is always marked as a DRAFT — never a published campaign or a
 * real result.
 *
 * Execution: ON_DEMAND, triggered by the user on the marketing task screen.
 */

import type { SkillLanguage } from "../shared/primitives";

export type CopywritingLanguage = SkillLanguage;

export type CopywritingIntent =
  | "email"
  | "press_release"
  | "landing_copy"
  | "general_draft";

// ─── Input ────────────────────────────────────────────────────────────────────

export interface CopywritingInput {
  taskTitle: string;
  taskDescription?: string;
  intent: CopywritingIntent;
  projectTitle?: string;
  artistName?: string;
  tone?: string;
  sourceFacts?: string[];
  context?: string;
  language?: CopywritingLanguage;
}

// ─── Output ───────────────────────────────────────────────────────────────────

export interface CopywritingOutput {
  draftTitle: string;
  draftBody: string;
  usedFacts: string[];
  isDraft: true;
}
