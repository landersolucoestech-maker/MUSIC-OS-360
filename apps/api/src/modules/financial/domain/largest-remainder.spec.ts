import { LargestRemainderError, largestRemainder } from './largest-remainder';

/**
 * Phase 13A Step 12 — PURE unit tests of the normative largest-remainder
 * algorithm (no database, no network). Minimum cases required by the mandate + the
 * normative cases of Phase 12 §10.
 */
describe('largestRemainder — normative algorithm (Phases 11/12)', () => {
  it('R$ 1.000,00 → 60/40 = 600,00 + 400,00', () => {
    expect(largestRemainder('1000.00', ['60', '40'])).toEqual(['600.00', '400.00']);
  });

  it('R$ 1.000,00 → 70/30 = 700,00 + 300,00', () => {
    expect(largestRemainder('1000.00', ['70', '30'])).toEqual(['700.00', '300.00']);
  });

  it('R$ 100.00 → 33.33/33.33/33.34 (no residue) = exactly the fractions', () => {
    expect(largestRemainder('100.00', ['33.33', '33.33', '33.34']))
      .toEqual(['33.33', '33.33', '33.34']);
  });

  it('Phase 12 normative case: 3×33.3333% of R$ 100.00 → the 1-cent residue goes to the largest fraction (lowest index)', () => {
    expect(largestRemainder('100.00', ['33.3333', '33.3333', '33.3333']))
      .toEqual(['33.34', '33.33', '33.33']);
  });

  it('exact reconciliation (I7): Σ allocated = round(amount × Σpct/100, 2) across samples', () => {
    const cases: Array<[string, string[]]> = [
      ['999.99', ['33.33', '33.33', '33.34']],
      ['0.03', ['50', '50']],
      ['123456789.01', ['12.5', '12.5', '75']],
      ['77.77', ['14.2857', '14.2857', '14.2857', '14.2857', '14.2857', '14.2857', '14.2858']],
    ];
    for (const [amount, pcts] of cases) {
      const result = largestRemainder(amount, pcts);
      const sumCents = result.reduce((acc, v) => acc + Math.round(Number(v) * 100), 0);
      const sumPct = pcts.reduce((acc, p) => acc + Number(p), 0);
      const expected = Math.round((Number(amount) * sumPct) / 100 * 100);
      expect(sumCents).toBe(expected);
    }
  });

  it('percentages below 100% (partial split): Σ allocated = allocated fraction; the remainder is an implicit "Sem vínculo"', () => {
    expect(largestRemainder('1000.00', ['25', '25'])).toEqual(['250.00', '250.00']);
  });

  it('sum above 100% → rejects (I5)', () => {
    expect(() => largestRemainder('1000.00', ['60', '50']))
      .toThrow(LargestRemainderError);
    expect(() => largestRemainder('1000.00', ['60', '50']))
      .toThrow(/exceeds 100/);
  });

  it('R$ 0.01 → 60/40: a R$ 0.00 share is REJECTED (allocated_amount > 0)', () => {
    expect(() => largestRemainder('0.01', ['60', '40']))
      .toThrow(/R\$ 0,00/);
  });

  it('invalid percentage (0, negative, >100, text) → rejected', () => {
    expect(() => largestRemainder('100.00', ['0'])).toThrow(LargestRemainderError);
    expect(() => largestRemainder('100.00', ['-5'])).toThrow(LargestRemainderError);
    expect(() => largestRemainder('100.00', ['100.0001'])).toThrow(LargestRemainderError);
    expect(() => largestRemainder('100.00', ['abc'])).toThrow(LargestRemainderError);
  });

  it('invalid amount (zero, negative, >2 decimals) → rejected', () => {
    expect(() => largestRemainder('0.00', ['100'])).toThrow(LargestRemainderError);
    expect(() => largestRemainder('-10.00', ['100'])).toThrow(LargestRemainderError);
    expect(() => largestRemainder('10.001', ['100'])).toThrow(LargestRemainderError);
  });

  it('empty list → rejects', () => {
    expect(() => largestRemainder('100.00', [])).toThrow(/empty percentage list/);
  });

  it('duplicate percentages are accepted by the algorithm (target UNIQUE is the database\'s responsibility)', () => {
    expect(largestRemainder('100.00', ['50', '50'])).toEqual(['50.00', '50.00']);
  });

  it('determinism: same input → same output; input order breaks ties', () => {
    const a = largestRemainder('100.00', ['33.3333', '33.3333', '33.3333']);
    const b = largestRemainder('100.00', ['33.3333', '33.3333', '33.3333']);
    expect(a).toEqual(b);
    // the residual cent follows the LARGEST fraction (0.66 of 33.3333% > 0.34 of
    // 66.6667%), regardless of order — position follows the input.
    const c = largestRemainder('200.00', ['66.6667', '33.3333']);
    const d = largestRemainder('200.00', ['33.3333', '66.6667']);
    expect(c).toEqual(['133.33', '66.67']);
    expect(d).toEqual(['66.67', '133.33']);
  });

  it('never uses float on the money path: accepts exact strings and keeps 2 decimals', () => {
    expect(largestRemainder('0.10', ['50', '50'])).toEqual(['0.05', '0.05']);
    expect(largestRemainder('0.03', ['33.3333', '33.3333', '33.3334']))
      .toEqual(['0.01', '0.01', '0.01']);
  });
});
