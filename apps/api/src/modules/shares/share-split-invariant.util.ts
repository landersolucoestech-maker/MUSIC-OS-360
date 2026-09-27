import { BadRequestException } from '@nestjs/common';

/**
 * "Splits for a work/phonogram sum to exactly 100%" can only be evaluated
 * once every share for that work is entered — a work legitimately has 0, 1,
 * 2... shares over time before reaching completeness, so checking for
 * exactly 100% at every individual write would break normal incremental
 * data entry. That check already exists, correctly scoped to the point
 * where it's meaningful: WorkRegistryValidationService, run only when a
 * work is prepared for society (ABRAMUS/ECAD) submission.
 *
 * What IS safe to check at every single write, regardless of how many
 * shares exist yet, is that the running total never exceeds 100% — a
 * monotonic invariant. Combined with the DB CHECK constraint on each row's
 * own range (migration 20260905000002), this closes the concrete gap:
 * SharesService.create/update previously persisted any percentual with no
 * validation at all (not even a same-row range check, let alone a
 * cross-row sum), so splits summing to 0%, 300%, or negative could be
 * saved with the write reporting success.
 */
export const SPLIT_TOLERANCE = 0.01;

export function assertSplitBudgetNotExceeded(
  existingEligibleSum: number,
  incomingPercentage: number,
  context: string,
): void {
  const total = existingEligibleSum + incomingPercentage;
  if (total - 100 > SPLIT_TOLERANCE) {
    throw new BadRequestException(
      `Soma dos splits elegíveis para registro em ${context} excederia 100% ` +
      `(existente: ${existingEligibleSum.toFixed(2)}% + este: ${incomingPercentage.toFixed(2)}% = ${total.toFixed(2)}%).`,
    );
  }
}
