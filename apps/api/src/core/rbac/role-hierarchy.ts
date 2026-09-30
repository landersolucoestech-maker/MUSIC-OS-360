import { FunctionalRole, SystemRole } from '@music-os-360/types';

/**
 * RBAC expand step (English naming): each English slug is an ALIAS of the Portuguese slug that is
 * still persisted in org_members.role / roles.slug. An alias must resolve to exactly the same
 * hierarchy level, permissions and workflow transitions as its canonical role (pinned by
 * role-hierarchy.spec.ts and workflow-role-matrix.spec.ts). The rows are seeded non-assignable
 * (migration 20260930000001), so no member can hold an English slug until the org_members backfill.
 * Portuguese slugs are never removed in this step.
 */
export const ENGLISH_ROLE_ALIASES: Readonly<Record<string, string>> = {
  [FunctionalRole.LEGAL]: FunctionalRole.JURIDICO,
  [FunctionalRole.SALES]: FunctionalRole.COMERCIAL,
  [FunctionalRole.PRODUCER]: FunctionalRole.PRODUTOR,
  [FunctionalRole.COLLABORATOR]: FunctionalRole.COLABORADOR,
  [FunctionalRole.HR_MANAGER]: FunctionalRole.RH_MANAGER,
};

export const ROLE_HIERARCHY: Record<string, number> = {
  [SystemRole.SUPER_ADMIN]: 100,
  [SystemRole.TENANT_OWNER]: 90,
  [SystemRole.OWNER]: 90,
  [SystemRole.ADMIN]: 80,
  [SystemRole.MANAGER]: 70,
  [SystemRole.EDITOR]: 60,
  [SystemRole.VIEWER]: 10,
  [FunctionalRole.FINANCIAL]: 60,
  [FunctionalRole.ACCOUNTING]: 60,
  [FunctionalRole.JURIDICO]: 55,
  [FunctionalRole.MARKETING]: 50,
  [FunctionalRole.MARKETING_MANAGER]: 55,
  [FunctionalRole.ARTIST]: 30,
  [FunctionalRole.ARTISTA]: 30,
  [FunctionalRole.PRODUTOR]: 40,
  [FunctionalRole.COMERCIAL]: 45,
  [FunctionalRole.COLABORADOR]: 20,
  [FunctionalRole.RH_MANAGER]: 55,
  [FunctionalRole.RADIO]: 40,
  [FunctionalRole.TV]: 40,
  // English aliases (levels intentionally equal to their canonical Portuguese role).
  [FunctionalRole.LEGAL]: 55,
  [FunctionalRole.SALES]: 45,
  [FunctionalRole.PRODUCER]: 40,
  [FunctionalRole.COLLABORATOR]: 20,
  [FunctionalRole.HR_MANAGER]: 55,
};
