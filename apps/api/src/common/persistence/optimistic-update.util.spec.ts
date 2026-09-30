import 'reflect-metadata';
import { ConflictException, BadRequestException } from '@nestjs/common';
import { casUpdate } from './optimistic-update.util';

/**
 * Task K — canonical concurrency scenario required by the audit:
 *   A reads version X
 *   B reads version X
 *   A saves
 *   B tries to save version X
 *   → B must NOT silently overwrite A
 */
interface TestRow {
  id: string;
  name?: string;
  x?: number;
}

describe('casUpdate', () => {
  function buildRepo(affected: number) {
    return { update: jest.fn().mockResolvedValue({ affected }) } as any;
  }

  it('without expectedUpdatedAt: behaves exactly like a plain repo.update() (backward compatible)', async () => {
    const repo = buildRepo(1);
    await casUpdate<TestRow>(repo, { id: '1' }, { name: 'x' }, undefined);
    expect(repo.update).toHaveBeenCalledWith({ id: '1' }, { name: 'x' });
  });

  it('with expectedUpdatedAt: includes updated_at in the UPDATE criteria as a millisecond-truncated comparison', async () => {
    // Task X — updated_at is usually a Postgres `timestamp` without declared
    // precision (microseconds); the value arriving from the client has already lost
    // that precision (Date only keeps milliseconds). An exact equality
    // (`updated_at: t`) would never match the real database value — it must
    // be a Raw() with date_trunc on both sides.
    const repo = buildRepo(1);
    const t = new Date('2026-08-14T10:00:00.000Z');
    await casUpdate<TestRow>(repo, { id: '1' }, { name: 'x' }, t.toISOString());

    expect(repo.update).toHaveBeenCalledTimes(1);
    const [criteria, payload] = repo.update.mock.calls[0];
    expect(payload).toEqual({ name: 'x' });
    expect(criteria.id).toBe('1');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const op = criteria.updated_at as any;
    expect(op._type).toBe('raw');
    expect(op._getSql('t.updated_at')).toBe(
      "date_trunc('milliseconds', t.updated_at) = date_trunc('milliseconds', :expected::timestamptz)",
    );
    expect(op._objectLiteralParameters).toEqual({ expected: t });
  });

  it('A/B scenario: B saves against A\'s pre-write version (0 rows affected) -> 409, no overwrite', async () => {
    // A and B read updated_at = T0. A saves (the column becomes T1 in the database, outside
    // this test). B tries to save still against T0 -> WHERE does not match -> 0 rows.
    const repo = buildRepo(0);
    const t0 = new Date('2026-08-14T10:00:00.000Z').toISOString();
    await expect(casUpdate<TestRow>(repo, { id: '1' }, { name: 'edição de B' }, t0))
      .rejects.toThrow(ConflictException);
    // B's write is never applied unconditionally after the 409 —
    // repo.update was called only ONCE, with the conditional criterion.
    expect(repo.update).toHaveBeenCalledTimes(1);
  });

  it('malformed expectedUpdatedAt -> 400, never silently ignored and applied without CAS', async () => {
    const repo = buildRepo(1);
    await expect(casUpdate<TestRow>(repo, { id: '1' }, { name: 'x' }, 'não-é-uma-data'))
      .rejects.toThrow(BadRequestException);
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('conflict message customizable per domain', async () => {
    const repo = buildRepo(0);
    await expect(
      casUpdate<TestRow>(repo, { id: '1' }, { x: 1 }, new Date().toISOString(), 'Mensagem específica do domínio'),
    ).rejects.toThrow('Mensagem específica do domínio');
  });
});
