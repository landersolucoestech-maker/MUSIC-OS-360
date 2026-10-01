/**
 * Platform-owned contract category slugs (`contracts.type`,
 * `contract_templates.service_type`).
 *
 * The contract category registry still lives in the browser, so most slugs are
 * tenant-authored content and are NEVER rewritten here. Only the slugs the
 * platform itself seeds AND that no tenant-owned taxonomy shares are canonical
 * English ids. Legacy (Portuguese) slugs keep being read; writes are canonical.
 *
 * Not included on purpose: `distribuicao`, `licenciamento`, `gestao`, `shows`,
 * `outros`. They are also `contract_service_types.slug` values that tenants own
 * (and compare by exact string), so renaming them needs the server-side
 * registry (see findings contracts-ct1.md, follow-up F1).
 *
 * Removal condition for LEGACY_CONTRACT_CATEGORY_SLUGS: no `contracts.type` /
 * `contract_templates.service_type` row and no browser category registry still
 * holds a legacy slug (census query in contracts-ct1.md) for one release window.
 */
export const CANONICAL_CONTRACT_CATEGORY_SLUGS = [
  'recording',
  'rights_assignment',
  'production',
  'exclusivity',
  'advertising',
  'semantic',
] as const;

export type CanonicalContractCategorySlug = (typeof CANONICAL_CONTRACT_CATEGORY_SLUGS)[number];

/** legacy slug -> canonical slug (READ compatibility only). */
export const LEGACY_CONTRACT_CATEGORY_SLUGS: Readonly<Record<string, CanonicalContractCategorySlug>> = {
  gravacao: 'recording',
  cessao_direitos: 'rights_assignment',
  producao: 'production',
  exclusividade: 'exclusivity',
  publicitario: 'advertising',
  semantico: 'semantic',
};

/** Canonical slug for a platform-owned legacy slug; every other slug is returned untouched. */
export function canonicalContractCategorySlug(slug: string): string {
  return Object.prototype.hasOwnProperty.call(LEGACY_CONTRACT_CATEGORY_SLUGS, slug)
    ? LEGACY_CONTRACT_CATEGORY_SLUGS[slug]
    : slug;
}

/**
 * Every persisted spelling of a category: the canonical slug plus its legacy
 * aliases when `slug` is platform-owned (either spelling), otherwise `[slug]`.
 * Used by exact-match list filters so old and new rows both match.
 */
export function contractCategorySlugVariants(slug: string): string[] {
  const canonical = canonicalContractCategorySlug(slug);
  const legacy = Object.entries(LEGACY_CONTRACT_CATEGORY_SLUGS)
    .filter(([, c]) => c === canonical)
    .map(([l]) => l);
  return legacy.length === 0 ? [slug] : [canonical, ...legacy];
}
