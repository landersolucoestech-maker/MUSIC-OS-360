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

  it('canonicalizes the registry seeds that tenant service types share (R3-04)', () => {
    expect(canonicalContractCategorySlug('distribuicao')).toBe('distribution');
    expect(canonicalContractCategorySlug('licenciamento')).toBe('licensing');
    expect(canonicalContractCategorySlug('gestao')).toBe('management');
    expect(canonicalContractCategorySlug('outros')).toBe('other');
    expect(contractCategorySlugVariants('distribution')).toEqual(['distribution', 'distribuicao']);
    expect(contractCategorySlugVariants('outros')).toEqual(['other', 'outros', 'outro']);
  });

  it('reads the singular `outro` (the old ContractsService default) as the canonical `other`, so list filters keep matching those rows', () => {
    expect(canonicalContractCategorySlug('outro')).toBe('other');
    expect(contractCategorySlugVariants('other')).toEqual(['other', 'outros', 'outro']);
    expect(contractCategorySlugVariants('outro')).toEqual(['other', 'outros', 'outro']);
  });

  it('never renames tenant-created slugs or the already-English `shows`', () => {
    for (const shared of ['shows', 'agenciamento', 'edicao', 'empresariamento_360', 'parceria']) {
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
