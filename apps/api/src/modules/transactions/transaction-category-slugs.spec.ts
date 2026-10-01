import {
  CANONICAL_TRANSACTION_CATEGORY_SLUGS,
  LEGACY_TRANSACTION_CATEGORY_SLUGS,
  UNCHANGED_TRANSACTION_CATEGORY_SLUGS,
  UNMAPPED_TRANSACTION_CATEGORY_SLUGS,
  canonicalTransactionSlug,
  isUncategorizedCategory,
  transactionSlugVariants,
} from './transaction-category-slugs';
import { canonicalizeTransactionInput } from './transaction-legacy-fields';
import { createTransactionSchema } from './validators/transaction.validator';

describe('transaction taxonomy slugs (TX1)', () => {
  const entries = Object.entries(LEGACY_TRANSACTION_CATEGORY_SLUGS);

  it('canonical ids are lower snake_case English ASCII', () => {
    for (const [, canonical] of entries) expect(canonical).toMatch(/^[a-z][a-z0-9]*(_[a-z0-9]+)*$/);
  });

  it('legacy slugs are lowercase ASCII kebab/plain; no canonical id is itself a legacy key (no chains)', () => {
    for (const [legacy, canonical] of entries) {
      expect(legacy).toMatch(/^[a-z0-9]+([-_][a-z0-9]+)*$/);
      expect(legacy).not.toBe(canonical);
      expect(Object.prototype.hasOwnProperty.call(LEGACY_TRANSACTION_CATEGORY_SLUGS, canonical)).toBe(false);
    }
  });

  it('only the two documented many-to-one aliases exist (everything else is injective, so down() is exact)', () => {
    const byCanonical = new Map<string, string[]>();
    for (const [legacy, canonical] of entries) byCanonical.set(canonical, [...(byCanonical.get(canonical) ?? []), legacy]);
    const multi = [...byCanonical.entries()].filter(([, l]) => l.length > 1).map(([c]) => c).sort();
    expect(multi).toEqual(['external_rights_streaming']);
  });

  it('canonical ids never collide with an unchanged English slug, an unmapped slug or another legacy key', () => {
    const reserved = new Set<string>([...UNCHANGED_TRANSACTION_CATEGORY_SLUGS, ...UNMAPPED_TRANSACTION_CATEGORY_SLUGS]);
    for (const canonical of CANONICAL_TRANSACTION_CATEGORY_SLUGS) expect(reserved.has(canonical)).toBe(false);
    for (const slug of [...UNCHANGED_TRANSACTION_CATEGORY_SLUGS, ...UNMAPPED_TRANSACTION_CATEGORY_SLUGS]) {
      expect(Object.prototype.hasOwnProperty.call(LEGACY_TRANSACTION_CATEGORY_SLUGS, slug)).toBe(false);
    }
  });

  it('maps legacy slugs exactly; canonical ids, unmapped slugs, free text, case variants and non-strings pass through', () => {
    expect(canonicalTransactionSlug('receitas-musicais')).toBe('music_revenue');
    expect(canonicalTransactionSlug('cache-show')).toBe('show_fee');
    expect(canonicalTransactionSlug('outros')).toBe('other');
    expect(canonicalTransactionSlug('music_revenue')).toBe('music_revenue');
    expect(canonicalTransactionSlug('marketing')).toBe('marketing');
    expect(canonicalTransactionSlug('receitas-internas')).toBe('receitas-internas');
    expect(canonicalTransactionSlug('Receitas Musicais')).toBe('Receitas Musicais');
    expect(canonicalTransactionSlug('Outros')).toBe('Outros');
    expect(canonicalTransactionSlug(' outros')).toBe(' outros');
    expect(canonicalTransactionSlug(null)).toBeNull();
    expect(canonicalTransactionSlug(undefined)).toBeUndefined();
    expect(canonicalTransactionSlug(7)).toBe(7);
  });

  it('folds the CT1 phrase and the seed spelling into external_rights_receipts', () => {
    expect(canonicalTransactionSlug('recebimentos externos de direitos')).toBe('external_rights_receipts');
    expect(canonicalTransactionSlug('external-rights-receipts')).toBe('external_rights_receipts');
    expect(canonicalTransactionSlug('recebimentos-externos-streaming')).toBe('external_rights_streaming');
    expect(canonicalTransactionSlug('external-rights-streaming')).toBe('external_rights_streaming');
  });

  it('variants: canonical first then every legacy alias (either spelling in); other values -> [value]', () => {
    expect(transactionSlugVariants('music_revenue')).toEqual(['music_revenue', 'receitas-musicais']);
    expect(transactionSlugVariants('receitas-musicais')).toEqual(['music_revenue', 'receitas-musicais']);
    expect(transactionSlugVariants('external_rights_streaming')).toEqual([
      'external_rights_streaming', 'external-rights-streaming', 'recebimentos-externos-streaming',
    ]);
    expect(transactionSlugVariants('external_rights_receipts')).toEqual([
      'external_rights_receipts', 'external-rights-receipts', 'recebimentos externos de direitos',
    ]);
    expect(transactionSlugVariants('other')).toEqual(['other', 'outros']);
    expect(transactionSlugVariants('marketing')).toEqual(['marketing']);
    expect(transactionSlugVariants('Receitas Musicais')).toEqual(['Receitas Musicais']);
  });

  it('the uncategorized placeholder is recognized in either spelling', () => {
    expect(isUncategorizedCategory('other')).toBe(true);
    expect(isUncategorizedCategory('outros')).toBe(true);
    expect(isUncategorizedCategory(' Outros ')).toBe(true);
    expect(isUncategorizedCategory('marketing')).toBe(false);
    expect(isUncategorizedCategory(null)).toBe(false);
  });

  describe('request input', () => {
    it('canonicalizeTransactionInput maps category/subcategory slugs (deprecated subcategoria key too)', () => {
      expect(canonicalizeTransactionInput({ category: 'servicos', subcategoria: 'design-grafico' }))
        .toEqual({ category: 'services', subcategory: 'graphic_design' });
      expect(canonicalizeTransactionInput({ category: 'Serviços Gerais', subcategory: 'x-y' }))
        .toEqual({ category: 'Serviços Gerais', subcategory: 'x-y' });
    });

    const ARTIST = '11111111-1111-4111-8111-111111111111';
    const base = {
      transactionType: 'revenue', counterpartyType: 'company', description: 'd', amount: '10',
      transactionDate: '2026-01-01', entityLinks: [],
    };
    const issuePaths = (input: Record<string, unknown>) => {
      const r = createTransactionSchema.safeParse({ ...base, ...input });
      return r.success ? [] : r.error.issues.map((i) => i.path.join('.'));
    };

    it('conditional rules fire for the legacy AND the canonical spelling (same outcome)', () => {
      const legacy = issuePaths({ category: 'receitas-musicais', subcategory: 'direitos-autorais', artistId: ARTIST });
      const canonical = issuePaths({ category: 'music_revenue', subcategory: 'copyright', artistId: ARTIST });
      expect(legacy).toEqual(canonical);
      expect(canonical).toContain('projectId');
      expect(issuePaths({ category: 'music_revenue', subcategory: 'copyright' })).toContain('artistId');
      expect(issuePaths({ category: 'receitas-musicais' })).toContain('subcategory');
      expect(issuePaths({ category: 'music_revenue' })).toContain('subcategory');
    });

    it('both external-rights streaming spellings require artist + project like the other music revenues', () => {
      for (const subcategory of ['external_rights_streaming', 'external-rights-streaming', 'recebimentos-externos-streaming']) {
        expect(issuePaths({ category: 'music_revenue', subcategory, artistId: ARTIST })).toContain('projectId');
      }
    });

    it('show-type subcategories require the event, in either spelling', () => {
      for (const subcategory of ['show_event_participation', 'participacao-show-evento']) {
        const paths = issuePaths({ category: 'music_revenue', subcategory, artistId: ARTIST });
        expect(paths).toContain('eventId');
      }
    });
  });
});
