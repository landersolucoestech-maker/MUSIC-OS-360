import { BadRequestException } from '@nestjs/common';
import { SPLIT_TOLERANCE } from '../modules/shares/share-split-invariant.util';

/**
 * Write-time validation of participant percentages (Work participants, Phonogram participation).
 *
 * "The percentages total exactly 100%" can only be judged once every participant is entered, so it is
 * checked where it is meaningful (registry validation). What is always wrong, at every single write, is a
 * value that is not a number, is outside 0..100, carries more decimals than the column can hold, or a
 * running total above 100%. A blank value means "not informed yet" and is ignored.
 */
export interface PercentageIssue {
  index: number;
  value: string;
  reason: 'not_a_number' | 'out_of_range' | 'too_many_decimals';
}

// Dot decimals only: the stored value is the submitted text, and the column and its consumers cannot read a comma.
const PLAIN_DECIMAL = /^\d+(?:\.\d+)?$/;

/** Parses one informed percentage; returns null for blank. */
function parse(raw: unknown): { value: number; decimals: number } | null | 'invalid' {
  if (raw == null) return null;
  const text = String(raw).trim();
  if (text === '') return null;
  if (!PLAIN_DECIMAL.test(text)) return 'invalid';
  const value = Number(text);
  if (!Number.isFinite(value)) return 'invalid';
  return { value, decimals: (text.split('.')[1] ?? '').length };
}

export function checkPercentages(
  values: readonly unknown[],
  maxDecimals: number,
): { issues: PercentageIssue[]; total: number } {
  const issues: PercentageIssue[] = [];
  // Summed in integer units of the smallest allowed decimal place: binary floats would turn
  // 33.34 + 33.33 + 33.34 into 100.01000000000001.
  const unit = 10 ** maxDecimals;
  let scaled = 0;
  values.forEach((raw, index) => {
    const parsed = parse(raw);
    if (parsed === null) return;
    if (parsed === 'invalid') {
      issues.push({ index, value: String(raw), reason: 'not_a_number' });
      return;
    }
    if (parsed.value < 0 || parsed.value > 100) {
      issues.push({ index, value: String(raw), reason: 'out_of_range' });
      return;
    }
    if (parsed.decimals > maxDecimals) {
      issues.push({ index, value: String(raw), reason: 'too_many_decimals' });
      return;
    }
    scaled += Math.round(parsed.value * unit);
  });
  return { issues, total: scaled / unit };
}

/** Throws a 400 listing every invalid value, or the total when it exceeds 100%. */
export function assertPercentagesValid(
  values: readonly unknown[],
  options: { maxDecimals: number; scope: string },
): void {
  const { issues, total } = checkPercentages(values, options.maxDecimals);
  if (issues.length > 0) {
    throw new BadRequestException({
      code: 'PERCENTAGE_INVALID',
      message: `Percentual inválido em ${options.scope}: informe um número de 0 a 100 com até ${options.maxDecimals} casas decimais.`,
      issues,
    });
  }
  // Compared in the same integer units, so the tolerance is exact.
  if (Math.round(total * 10 ** options.maxDecimals) - 100 * 10 ** options.maxDecimals > Math.round(SPLIT_TOLERANCE * 10 ** options.maxDecimals)) {
    throw new BadRequestException({
      code: 'PERCENTAGE_TOTAL_EXCEEDS_100',
      message: `A soma dos percentuais de ${options.scope} excede 100% (${total.toFixed(options.maxDecimals)}%).`,
      total,
    });
  }
}
