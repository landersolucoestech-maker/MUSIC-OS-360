import { isRegistryEligibleShare, REGISTRY_ELIGIBLE_SHARE_SQL } from './share-eligibility.util';

describe('isRegistryEligibleShare — TS predicate equivalent to the SQL "share_type IS NULL"', () => {
  it('true when share_type is null', () => {
    expect(isRegistryEligibleShare({ share_type: null })).toBe(true);
  });

  it('false when share_type has any non-null value', () => {
    expect(isRegistryEligibleShare({ share_type: 'pendente' })).toBe(false);
    expect(isRegistryEligibleShare({ share_type: '' })).toBe(false);
    expect(isRegistryEligibleShare({ share_type: 'registry' })).toBe(false);
  });

  it('does not treat undefined as eligible (persisted entities always have share_type null or string)', () => {
    expect(isRegistryEligibleShare({ share_type: undefined as unknown as null })).toBe(false);
  });

  it('the exported SQL constant is exactly the same condition, for use in query builders', () => {
    expect(REGISTRY_ELIGIBLE_SHARE_SQL).toBe('share_type IS NULL');
  });

  it('equivalence: for a set of simulated rows, the TS filter produces the same subset the SQL filter would apply', () => {
    const rows = [
      { id: '1', share_type: null },
      { id: '2', share_type: 'pendente' },
      { id: '3', share_type: null },
      { id: '4', share_type: 'financeiro' },
    ];
    // Simulates the result of `SELECT * FROM shares WHERE share_type IS NULL`
    const sqlEquivalentResult = rows.filter((r) => r.share_type === null);
    const tsResult = rows.filter(isRegistryEligibleShare);
    expect(tsResult).toEqual(sqlEquivalentResult);
    expect(tsResult.map((r) => r.id)).toEqual(['1', '3']);
  });
});
