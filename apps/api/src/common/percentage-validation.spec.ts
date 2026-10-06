import { assertPercentagesValid, checkPercentages } from './percentage-validation';

const run = (values: unknown[], maxDecimals = 3) => () => assertPercentagesValid(values, { maxDecimals, scope: 'test scope' });

describe('percentage validation', () => {
  it.each([
    [[]],
    [[null, undefined, '', '  ']],
    [['50', '50']],
    [[50, 49.5]],
    [['33.333', '33.333', '33.334']],
    [['0', '100']],
    [['10']],
  ])('accepts %j', (values) => {
    expect(run(values as unknown[])).not.toThrow();
  });

  it('a total below 100 is valid at write time (the exact 100 is checked at registry validation)', () => {
    expect(run(['30', '20'])).not.toThrow();
  });

  it.each([
    ['abc', 'not_a_number'],
    ['1e2', 'not_a_number'],
    ['-5', 'not_a_number'],
    ['12%', 'not_a_number'],
    ['40,5', 'not_a_number'],
    ['NaN', 'not_a_number'],
    ['101', 'out_of_range'],
    ['100.5', 'out_of_range'],
    ['10.12345', 'too_many_decimals'],
  ])('rejects %s as %s and reports the position', (value, reason) => {
    expect(() => assertPercentagesValid(['10', value], { maxDecimals: 3, scope: 'test scope' })).toThrow(
      expect.objectContaining({ response: expect.objectContaining({ code: 'PERCENTAGE_INVALID', issues: [{ index: 1, value, reason }] }) }),
    );
  });

  it('rejects a running total above 100% and states the total', () => {
    expect(run(['60', '40.5'])).toThrow(
      expect.objectContaining({ response: expect.objectContaining({ code: 'PERCENTAGE_TOTAL_EXCEEDS_100', total: 100.5 }) }),
    );
  });

  it('tolerates the same rounding slack as the shares invariant', () => {
    expect(run(['33.34', '33.33', '33.34'])).not.toThrow();
  });

  it('reports every invalid entry, not only the first', () => {
    expect(checkPercentages(['x', '50', '200'], 3).issues.map((i) => i.index)).toEqual([0, 2]);
  });

  it('accepts a number typed value as well as a string', () => {
    expect(run([33.3, '33.3', 33.4])).not.toThrow();
  });
});
