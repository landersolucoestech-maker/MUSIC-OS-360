/**
 * packages/ai-skills/src/project-planning/contracts.ts
 *
 * Contracts of the project-planning skill (version 1.0.0).
 * Shared canonical source (web + api).
 */

import type { SkillLanguage, SkillSeverity, SkillPriority } from "../shared/primitives";

export type ProjectPlanningLanguage = SkillLanguage;

export type TaskPriority = SkillPriority;

export type RiskSeverity = SkillSeverity;

// ─── Input ────────────────────────────────────────────────────────────────────

export interface ProjectPlanningInput {
  projectName: string;
  projectType: string;
  artistName?: string;
  deadline?: string;
  departments: string[];
  goals: string[];
  context?: string;
  language?: ProjectPlanningLanguage;
}

// ─── Output blocks ────────────────────────────────────────────────────────────

export interface ProjectPhase {
  name: string;
  description: string;
  order: number;
}

export interface ProjectTask {
  title: string;
  description: string;
  department: string;
  priority: TaskPriority;
  estimatedDays?: number;
  dependencies?: string[];
}

export interface ProjectRisk {
  risk: string;
  severity: RiskSeverity;
  mitigation: string;
}

export interface ProjectOwner {
  department: string;
  responsibility: string;
}

export interface ProjectMilestone {
  title: string;
  description: string;
  suggestedDate?: string;
}

// ─── Output ───────────────────────────────────────────────────────────────────

export interface ProjectPlanningOutput {
  summary: string;
  phases: ProjectPhase[];
  tasks: ProjectTask[];
  dependencies: string[];
  risks: ProjectRisk[];
  suggestedOwners: ProjectOwner[];
  milestones: ProjectMilestone[];
  checklist: string[];
}
