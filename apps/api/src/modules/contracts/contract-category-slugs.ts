/**
 * Platform-owned contract category slugs (`contracts.type`,
 * `contract_templates.service_type`).
 *
 * The contract category registry still lives in the browser, so most slugs are
 * tenant-authored content and are NEVER rewritten here. Only the slugs the
 * platform itself seeds are canonical English ids. Legacy (Portuguese) slugs keep
 * being read (filters expand to both spellings); writes are canonical.
 *
 * `distribuicao`, `licenciamento`, `gestao`, `outros` are ALSO the slugs of the
 * tenant-owned `contract_service_types` rows (derived from the tenant-entered
 * names). Those rows are never rewritten: the web resolves a contract/template
 * category to its service type with the alias-aware matcher
 * (`sameContractCategory`). `shows` is already English and is kept.
 * Tenant-created slugs (`agenciamento`, `edicao`, `empresariamento_360`, ...) are
 * never touched.
 *
 * Removal condition for LEGACY_CONTRACT_CATEGORY_SLUGS: no `contracts.type` /
 * `contract_templates.service_type` row and no browser category registry still
 * holds a legacy slug (census query: docs/runbooks/staging-to-production.md#residue-census-of-the-contract-vocabulary-backfills-read-only) for one release window.
 */
export const CANONICAL_CONTRACT_CATEGORY_SLUGS = [
  'recording',
  'rights_assignment',
  'production',
  'exclusivity',
  'advertising',
  'semantic',
  'distribution',
  'licensing',
  'management',
  'other',
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
  distribuicao: 'distribution',
  licenciamento: 'licensing',
  gestao: 'management',
  outros: 'other',
  // Singular spelling written by ContractsService.create() as the default type until 20260930000034 backfilled it.
  outro: 'other',
};

/**
 * Spellings the browser registry/filters still read (apps/web .../contract-type-filters.ts) that the platform never
 * wrote and the backfill migration 20260930000036 does not rewrite, so they are NOT in LEGACY_CONTRACT_CATEGORY_SLUGS
 * (that map must stay equal to the backfill). READ compatibility only: they widen list filters
 * (`type=exclusivity` also matches `exclusivo`, and `type=exclusivo` resolves to the canonical set) but are never
 * rewritten on write. The other web-only spellings (nao_exclusivo, representacao, servicos) have no canonical slug
 * and are deliberately not mapped here.
 */
export const READ_ONLY_LEGACY_CONTRACT_CATEGORY_SLUGS: Readonly<Record<string, CanonicalContractCategorySlug>> = {
  exclusivo: 'exclusivity',
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
  const own = (map: object, key: string) => Object.prototype.hasOwnProperty.call(map, key);
  const canonical = own(READ_ONLY_LEGACY_CONTRACT_CATEGORY_SLUGS, slug)
    ? READ_ONLY_LEGACY_CONTRACT_CATEGORY_SLUGS[slug]
    : canonicalContractCategorySlug(slug);
  const aliases = [LEGACY_CONTRACT_CATEGORY_SLUGS, READ_ONLY_LEGACY_CONTRACT_CATEGORY_SLUGS].flatMap((map) =>
    Object.entries(map)
      .filter(([, c]) => c === canonical)
      .map(([l]) => l),
  );
  return aliases.length === 0 ? [slug] : [canonical, ...aliases];
}
