import { IsNull } from 'typeorm';
import { ContractsService } from './contracts.service';

/**
 * find-7ced4670: softDelete() had no `deleted_at IS NULL` guard on the UPDATE,
 * no CAS/lock, and DELETE /contracts/:id has no idempotency-key interceptor
 * (unlike POST /contracts). Two concurrent cancel calls for the same contract
 * (double-click, retry racing the original in flight) could both pass
 * findById() before either committed, then both unconditionally emit
 * CONTRACT_CANCELLED — duplicate activity-log rows and duplicate
 * notifications for one logical cancellation.
 */
describe('ContractsService.softDelete — idempotent under concurrent/racing calls (find-7ced4670)', () => {
  function makeService(affected: number) {
    const contractRow = { id: 'contract-1', tenant_id: 'tenant-1', title: 'T', artist_id: 'artist-1' };
    const qb: Record<string, jest.Mock> = {};
    const chain = () => qb;
    qb['leftJoinAndMapOne'] = jest.fn(chain);
    qb['where'] = jest.fn(chain);
    qb['getOne'] = jest.fn(async () => contractRow);
    const repo = {
      createQueryBuilder: jest.fn(() => qb),
      update: jest.fn(async () => ({ affected })),
    };
    const dataSource = { getRepository: jest.fn(() => repo) };
    const events = { emitTyped: jest.fn() };
    const workflowService = { getAllowedTransitions: jest.fn(() => []) };
    const service = new ContractsService(
      dataSource as never,
      workflowService as never,
      events as never,
      {} as never,
    );
    return { service, events, repo };
  }

  it('emits CONTRACT_CANCELLED when the row actually transitions (affected=1)', async () => {
    const { service, events } = makeService(1);
    await service.softDelete('tenant-1', 'user-1', 'contract-1');
    expect(events.emitTyped).toHaveBeenCalledTimes(1);
  });

  it('does NOT re-emit CONTRACT_CANCELLED when the WHERE guard finds the row already deleted (affected=0, racing/duplicate call)', async () => {
    const { service, events, repo } = makeService(0);
    const result = await service.softDelete('tenant-1', 'user-1', 'contract-1');
    expect(result).toEqual({ deleted: true });
    expect(events.emitTyped).not.toHaveBeenCalled();
    // The WHERE guard itself: deleted_at must be constrained to IS NULL so a
    // concurrent winner's write can never be raced by a loser re-applying it.
    expect(repo.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'contract-1', tenant_id: 'tenant-1', deleted_at: IsNull() }),
      expect.anything(),
    );
  });
});
