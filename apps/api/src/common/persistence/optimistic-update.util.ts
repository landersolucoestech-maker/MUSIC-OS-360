import { BadRequestException, ConflictException } from '@nestjs/common';
import { Raw } from 'typeorm';
import type { FindOptionsWhere, ObjectLiteral, Repository } from 'typeorm';
import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';

/**
 * Task K — generic concurrency protection for updates via TypeORM
 * `Repository.update()`. Extracted from the original fix in TransactionsService
 * (Task J continuity) for consistent reuse across domains.
 *
 * Without `expectedUpdatedAt`: behavior identical to a plain `repo.update()` —
 * backward compatible, no existing caller breaks.
 *
 * With `expectedUpdatedAt`: the UPDATE only applies if the `updated_at` column in the
 * database is still exactly that value (CAS via an already existing column, no
 * migration). 0 affected rows = the record changed between the read and the
 * write (two users editing in parallel, or it was already deleted) → 409,
 * never overwrites silently ("lost update").
 *
 * Do not use for entities without an automatically managed `updated_at` column
 * (@UpdateDateColumn or equivalent) — the CAS depends on it already reflecting every
 * previous write.
 */
/**
 * Task Y — extracted from inside `casUpdate` for reuse by implementations
 * that need the SAME safe `updated_at` comparison criterion, but
 * have conflict semantics different from `casUpdate`'s (e.g.
 * AudiovisualApprovalsService.decide() needs 0 affected rows to ALWAYS become
 * 409 — even without expectedUpdatedAt, because of the additional
 * status='pending' guard in the UPDATE's own condition — while `casUpdate` only
 * checks that when expectedUpdatedAt was provided, for backward compatibility
 * with the ~44 existing callers). Reusing this avoids duplicating the
 * truncation logic (the precision bug itself), without forcing every caller
 * of `casUpdate` to inherit conflict semantics it did not ask for.
 *
 * `updated_at` is usually a Postgres `timestamp` without declared
 * precision (microseconds); the value arriving here has already lost that
 * precision by passing through Date/JSON (milliseconds at most — Date only
 * keeps that). An exact equality would never match the real database
 * value — compares truncated to milliseconds on both sides, otherwise every valid CAS
 * would be rejected as a conflict because of sub-precision noise.
 */
export function buildExpectedUpdatedAtCriterion(expectedUpdatedAt: string): unknown {
  const expected = new Date(expectedUpdatedAt);
  if (Number.isNaN(expected.getTime())) {
    throw new BadRequestException('A versão do registro enviada é inválida. Recarregue e tente novamente.');
  }
  return Raw(
    (alias) => `date_trunc('milliseconds', ${alias}) = date_trunc('milliseconds', :expected::timestamptz)`,
    { expected },
  );
}

export async function casUpdate<T extends ObjectLiteral>(
  repo: Repository<T>,
  criteria: FindOptionsWhere<T>,
  payload: QueryDeepPartialEntity<T>,
  expectedUpdatedAt: string | undefined,
  conflictMessage = 'Este registro foi alterado por outro usuário desde que você o carregou. Recarregue e tente novamente.',
): Promise<void> {
  const finalCriteria: FindOptionsWhere<T> = { ...criteria };

  if (expectedUpdatedAt) {
    (finalCriteria as Record<string, unknown>)['updated_at'] = buildExpectedUpdatedAtCriterion(expectedUpdatedAt);
  }

  const result = await repo.update(finalCriteria, payload);

  if (expectedUpdatedAt && result.affected === 0) {
    throw new ConflictException(conflictMessage);
  }
}
