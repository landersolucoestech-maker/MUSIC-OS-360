/**
 * Platform-owned contract category slugs — web mirror of
 * apps/api/src/modules/contracts/contract-category-slugs.ts.
 *
 * The API now WRITES the canonical English slug for these six platform-seeded
 * categories and keeps READING the legacy Portuguese spelling. The category
 * registry still lives in the browser (localStorage) and seeds the legacy
 * values, so every web reader must treat both spellings as the same category.
 * Tenant-created slugs are never rewritten.
 *
 * Removal condition for LEGACY_CONTRACT_CATEGORY_SLUGS: see
 * docs/runbooks/staging-to-production.md#residue-census-of-the-contract-vocabulary-backfills-read-only (no row / registry still holds a legacy slug).
 */
export const LEGACY_CONTRACT_CATEGORY_SLUGS: Readonly<Record<string, string>> = {
  gravacao: "recording",
  cessao_direitos: "rights_assignment",
  producao: "production",
  exclusividade: "exclusivity",
  publicitario: "advertising",
  semantico: "semantic",
  // Also tenant-owned contract_service_types slugs: those rows are never rewritten,
  // callers match them with `sameContractCategory`.
  distribuicao: "distribution",
  licenciamento: "licensing",
  gestao: "management",
  outros: "other",
  // Singular spelling the API wrote as the default contract type until migration 20260930000034.
  outro: "other",
};

/**
 * Finds the tenant's service type for a contract/template category, matching either
 * spelling (contracts now persist `distribution`, the tenant row may still be `distribuicao`).
 * An exact slug match wins.
 */
export function findServiceTypeByCategory<T extends { slug: string }>(
  serviceTypes: ReadonlyArray<T>,
  category: string | null | undefined,
): T | undefined {
  if (!category) return undefined;
  return serviceTypes.find((t) => t.slug === category) ?? serviceTypes.find((t) => sameContractCategory(t.slug, category));
}

export const SEMANTIC_CONTRACT_CATEGORY = "semantic";

export function canonicalContractCategorySlug(slug: string): string {
  return Object.prototype.hasOwnProperty.call(LEGACY_CONTRACT_CATEGORY_SLUGS, slug)
    ? LEGACY_CONTRACT_CATEGORY_SLUGS[slug]
    : slug;
}

export function sameContractCategory(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  return canonicalContractCategorySlug(a) === canonicalContractCategorySlug(b);
}

/** True for the AI-assisted ("semantic") template category, in either spelling. */
export function isSemanticContractCategory(slug: string | null | undefined): boolean {
  return sameContractCategory(slug, SEMANTIC_CONTRACT_CATEGORY);
}
