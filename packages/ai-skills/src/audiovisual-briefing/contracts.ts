/**
 * skills/audiovisual-briefing/contracts/audiovisual-briefing.contracts.ts
 *
 * Contracts of the audiovisual-briefing skill (version 1.0.0).
 * Audiovisual production briefing for a record label, production company and artist.
 * Uses the shared domain/ai.types types (SkillLanguage/SkillSeverity/SkillPriority).
 */

import type { SkillLanguage, SkillSeverity, SkillPriority } from "../shared/primitives";

export type AudiovisualContentType =
  | "music-video"
  | "lyric-video"
  | "visualizer"
  | "teaser"
  | "reels"
  | "shorts"
  | "stories"
  | "institutional"
  | "other";

export type AudiovisualBudgetLevel = "low" | "medium" | "high" | "premium";

export type AudiovisualAssetType =
  | "image"
  | "video"
  | "audio"
  | "document"
  | "prop"
  | "other";

// ─── Input ────────────────────────────────────────────────────────────────────

export interface AudiovisualBriefingInput {
  projectTitle: string;
  artistName: string;
  contentType: AudiovisualContentType;
  releaseTitle?: string;
  objective: string;
  references?: string[];
  budgetLevel: AudiovisualBudgetLevel;
  context?: string;
  language?: SkillLanguage;
}

// ─── Output blocks ────────────────────────────────────────────────────────────

export interface AudiovisualScriptScene {
  scene: number;
  title: string;
  description: string;
  duration?: string;
  notes?: string;
}

export interface AudiovisualScene {
  name: string;
  location?: string;
  visualStyle?: string;
  requiredAssets: string[];
}

export interface AudiovisualAsset {
  asset: string;
  type: AudiovisualAssetType;
  required: boolean;
}

export interface AudiovisualChecklistItem {
  item: string;
  area: string;
  priority: SkillPriority;
}

export interface AudiovisualTeamNeed {
  role: string;
  responsibility: string;
  required: boolean;
}

export interface AudiovisualDeliverable {
  name: string;
  format?: string;
  platform?: string;
  deadlineSuggestion?: string;
}

export interface AudiovisualRisk {
  risk: string;
  severity: SkillSeverity;
  mitigation: string;
}

// ─── Output ───────────────────────────────────────────────────────────────────

export interface AudiovisualBriefingOutput {
  creativeConcept: string;
  script: AudiovisualScriptScene[];
  scenes: AudiovisualScene[];
  assets: AudiovisualAsset[];
  productionChecklist: AudiovisualChecklistItem[];
  teamNeeds: AudiovisualTeamNeed[];
  deliverables: AudiovisualDeliverable[];
  risks: AudiovisualRisk[];
}
