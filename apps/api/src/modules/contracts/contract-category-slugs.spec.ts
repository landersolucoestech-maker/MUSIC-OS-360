import {
  CANONICAL_CONTRACT_CATEGORY_SLUGS,
  LEGACY_CONTRACT_CATEGORY_SLUGS,
  canonicalContractCategorySlug,
  contractCategorySlugVariants,
} from './contract-category-slugs';

describe('contract category slugs (platform-owned only)', () => {
  it('every legacy slug maps to a canonical slug, and every canonical slug has a legacy alias', () => {
    const canon = new Set<string>(CANONICAL_CONTRACT_CATEGORY_SLUGS);
    for (const c of Object.values(LEGACY_CONTRACT_CATEGORY_SLUGS)) expect(canon.has(c)).toBe(true);
    for (const c of canon) expect(Object.values(LEGACY_CONTRACT_CATEGORY_SLUGS)).toContain(c);
  });

  it('canonicalizes legacy slugs and leaves canonical and tenant slugs untouched', () => {
    expect(canonicalContractCategorySlug('gravacao')).toBe('recording');
    expect(canonicalContractCategorySlug('recording')).toBe('recording');
    expect(canonicalContractCategorySlug('empresariamento_360')).toBe('empresariamento_360');
    expect(canonicalContractCategorySlug('toString')).toBe('toString');
  });

  it('never renames slugs shared with tenant-owned service types', () => {
    for (const shared of ['distribuicao', 'licenciamento', 'gestao', 'shows', 'outros', 'agenciamento', 'edicao']) {
      expect(canonicalContractCategorySlug(shared)).toBe(shared);
      expect(contractCategorySlugVariants(shared)).toEqual([shared]);
    }
  });

  it('variants contain the canonical slug first, then legacy aliases, from either spelling', () => {
    expect(contractCategorySlugVariants('gravacao')).toEqual(['recording', 'gravacao']);
    expect(contractCategorySlugVariants('recording')).toEqual(['recording', 'gravacao']);
    expect(contractCategorySlugVariants('custom_slug')).toEqual(['custom_slug']);
  });
});
