/**
 * packages/ai-skills/src/social-content/contracts.ts
 *
 * Contracts of the social-content skill (version 1.0.0).
 * Shared canonical source (web + api).
 *
 * Scope: `marketing_content_posts` is a strictly ORGANIC content entity
 * (channels: instagram/facebook/tiktok/youtube/twitter/threads — see
 * MARKETING_CONTENT_CHANNELS in marketing-contents.dto.ts). There is no paid
 * media entity in the schema today — so `ad-creative` and `paid-ads` do NOT
 * reuse this contract (see NEEDS_PRODUCT_DECISION in the mission report).
 *
 * Critical non-goal: this skill NEVER generates the published `copy` or changes
 * the publication status. The user already provides `copy` when creating the
 * post (a required field). The output here is a SUGGESTION (caption variations,
 * hashtags, channel checklist) stored in metadata — never applied to the post
 * automatically or treated as published (generated != published).
 */

import type { SkillLanguage } from "../shared/primitives";

export type SocialContentLanguage = SkillLanguage;

// ─── Input ────────────────────────────────────────────────────────────────────

export interface SocialContentInput {
  title: string;
  targetType: string;
  targetName: string;
  channel: string;
  contentType: string;
  draftCopy?: string;
  relatedCampaign?: string;
  context?: string;
  language?: SocialContentLanguage;
}

// ─── Output blocks ────────────────────────────────────────────────────────────

export interface SocialContentCaptionVariant {
  variant: string;
  tone: string;
}

export interface SocialContentChecklistItem {
  item: string;
  reason: string;
}

// ─── Output ───────────────────────────────────────────────────────────────────

export interface SocialContentOutput {
  captionVariants: SocialContentCaptionVariant[];
  hashtags: string[];
  toneNotes: string;
  channelChecklist: SocialContentChecklistItem[];
}
