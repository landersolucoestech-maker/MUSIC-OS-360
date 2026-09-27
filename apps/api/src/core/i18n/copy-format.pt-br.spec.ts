import { formatBrlPtBr, formatDatePtBr } from './copy-format.pt-br';

describe('copy-format.pt-br', () => {
  it('formats amounts as BRL currency', () => {
    expect(formatBrlPtBr(1500.5)).toBe('R$ 1.500,50');
    expect(formatBrlPtBr('1234.56')).toBe('R$ 1.234,56');
    expect(formatBrlPtBr(0)).toBe('R$ 0,00');
  });

  it('returns null for missing or non-numeric amounts (never "R$NaN")', () => {
    expect(formatBrlPtBr(undefined)).toBeNull();
    expect(formatBrlPtBr('')).toBeNull();
    expect(formatBrlPtBr('abc')).toBeNull();
  });

  it('formats date-only strings without a time-zone shift', () => {
    expect(formatDatePtBr('2026-01-05')).toBe('05/01/2026');
  });

  it('formats timestamps in America/Sao_Paulo', () => {
    expect(formatDatePtBr('2026-01-05T02:00:00.000Z')).toBe('04/01/2026');
    expect(formatDatePtBr(new Date('2026-03-10T15:00:00.000Z'))).toBe('10/03/2026');
  });

  it('returns null for unparseable dates (never "Invalid Date")', () => {
    expect(formatDatePtBr('not-a-date')).toBeNull();
    expect(formatDatePtBr(null)).toBeNull();
  });
});
