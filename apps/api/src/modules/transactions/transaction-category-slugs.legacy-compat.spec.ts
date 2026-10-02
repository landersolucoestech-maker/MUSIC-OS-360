import {
  canonicalTransactionSlug,
  transactionSlugVariants,
  UNCHANGED_TRANSACTION_CATEGORY_SLUGS,
} from './transaction-category-slugs';

// `das`, `icms`, `iptu`, `ipva`, `irrf` are statutory acronyms kept as-is (no alias): reading them must be the
// identity and filters must not expand them. `pro-labore` is the legacy spelling of canonical `pro_labore`.
describe('transaction category legacy slugs (legacy in, canonical out)', () => {
  it('pro-labore is read as pro_labore and the filter matches both spellings', () => {
    expect(canonicalTransactionSlug('pro-labore')).toBe('pro_labore');
    expect(canonicalTransactionSlug('pro_labore')).toBe('pro_labore');
    expect(transactionSlugVariants('pro_labore')).toEqual(['pro_labore', 'pro-labore']);
    expect(transactionSlugVariants('pro-labore')).toEqual(['pro_labore', 'pro-labore']);
  });

  it.each(['das', 'icms', 'iptu', 'ipva', 'irrf'])('statutory acronym %s is kept as stored', (slug) => {
    expect(UNCHANGED_TRANSACTION_CATEGORY_SLUGS).toContain(slug);
    expect(canonicalTransactionSlug(slug)).toBe(slug);
    expect(transactionSlugVariants(slug)).toEqual([slug]);
  });

  it('matching is exact and case-sensitive; free text and non-strings are untouched', () => {
    expect(canonicalTransactionSlug('Pro-Labore')).toBe('Pro-Labore');
    expect(canonicalTransactionSlug(5)).toBe(5);
  });
});
