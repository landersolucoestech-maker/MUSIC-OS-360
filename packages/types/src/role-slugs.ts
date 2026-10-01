import { FunctionalRole } from "./enums";

/**
 * Canonical English role slugs (RBAC expand-contract, slice S4a).
 *
 * Machine values are English; Portuguese appears only as display labels. Each LEGACY slug below is
 * still persisted (roles.slug, org_members.role rows written before S4a) and stays ACCEPTED on every
 * read path until the gated S4b/S5 retirement (docs/engineering/rbac-retirement-plan.md). A legacy
 * slug and its canonical slug grant IDENTICAL authorization (level, permissions, workflow
 * transitions); that equivalence is pinned by the parity specs in apps/api and apps/web.
 *
 * Deliberately NOT mapped (no unambiguous canonical English slug, or independent decision):
 *  - tenant_owner (legacy alias of owner; retirement is a separate decision)
 *  - radio, tv (English word / international acronym)
 *  - web-only form values with no roles row (admin_master, ar_gestao, financeiro_contabil): product
 *    decision pending, the API already rejects them (ROLE_UNKNOWN).
 */
export const LEGACY_TO_CANONICAL_ROLE_SLUG: Readonly<Record<string, string>> = {
  [FunctionalRole.JURIDICO]: FunctionalRole.LEGAL,
  [FunctionalRole.COMERCIAL]: FunctionalRole.SALES,
  [FunctionalRole.PRODUTOR]: FunctionalRole.PRODUCER,
  [FunctionalRole.COLABORADOR]: FunctionalRole.COLLABORATOR,
  [FunctionalRole.RH_MANAGER]: FunctionalRole.HR_MANAGER,
  [FunctionalRole.ARTISTA]: FunctionalRole.ARTIST,
};

const hasOwn = (o: object, k: string): boolean => Object.prototype.hasOwnProperty.call(o, k);

const CANONICAL_TO_LEGACY: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(LEGACY_TO_CANONICAL_ROLE_SLUG).map(([legacy, canonical]) => [canonical, legacy]),
);

/** Legacy slug -> canonical English slug; every other value (incl. unknown/inherited keys) is returned unchanged. */
export function toCanonicalRoleSlug(slug: string): string {
  return typeof slug === "string" && hasOwn(LEGACY_TO_CANONICAL_ROLE_SLUG, slug)
    ? LEGACY_TO_CANONICAL_ROLE_SLUG[slug]
    : slug;
}

/** Canonical English slug -> legacy slug that is still persisted (rollback / kill-switch direction). */
export function toLegacyRoleSlug(slug: string): string {
  return typeof slug === "string" && hasOwn(CANONICAL_TO_LEGACY, slug) ? CANONICAL_TO_LEGACY[slug] : slug;
}

/** True when the slug is a legacy (Portuguese or retired-alias) slug that has a canonical English form. */
export function isLegacyRoleSlug(slug: string): boolean {
  return typeof slug === "string" && hasOwn(LEGACY_TO_CANONICAL_ROLE_SLUG, slug);
}

/** Every slug that grants the same authorization as `slug` (canonical first). Unknown -> [slug]. */
export function roleSlugEquivalents(slug: string): string[] {
  const canonical = toCanonicalRoleSlug(slug);
  const legacy = toLegacyRoleSlug(canonical);
  return legacy === canonical ? [canonical] : [canonical, legacy];
}

export function areEquivalentRoleSlugs(a: string, b: string): boolean {
  return toCanonicalRoleSlug(a) === toCanonicalRoleSlug(b);
}
