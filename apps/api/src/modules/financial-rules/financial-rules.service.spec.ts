import 'reflect-metadata';
import { ConflictException } from '@nestjs/common';
import { FinancialRulesService } from './financial-rules.service';
import { EventsService } from '../../core/events/events.service';

/**
 * Task K — same optimistic concurrency protection applied to
 * TransactionsService/ClientsService: FinancialRulesService.update() used an
 * unconditional repo.update() — two people editing the same financial
 * rule in parallel made the second write silently overwrite the first.
 * Without `expectedUpdatedAt`, the behavior stays identical.
 */

const NOW = new Date('2026-08-14T12:00:00.000Z');
const RULE = {
  id: 'rule-1', tenant_id: 'tenant-1', name: 'Comissão padrão', type: 'commission',
  calculation_method: 'percentage', value: '10', active: true, conditions: {},
  deleted_at: null, updated_at: NOW,
};

function makeRepo() {
  return {
    findOne: jest.fn(async () => RULE),
    update: jest.fn(async () => ({ affected: 1 })),
  };
}

function makeService() {
  const repo = makeRepo();
  const ds = { getRepository: jest.fn(() => repo) } as any;
  const events = { emitTyped: jest.fn(), emit: jest.fn() } as unknown as EventsService;
  const svc = new FinancialRulesService(ds, events);
  return { svc, repo };
}

describe('FinancialRulesService.update — optimistic concurrency (Task K)', () => {
  it('without expectedUpdatedAt: applies an unconditional update (backward compatibility)', async () => {
    const { svc, repo } = makeService();

    await svc.update('tenant-1', 'user-1', 'rule-1', { value: 12 } as any);

    const [criteria] = (repo.update as jest.Mock).mock.calls[0];
    expect(criteria).toEqual({ id: 'rule-1', tenant_id: 'tenant-1' });
  });

  it('with a correct expectedUpdatedAt: includes updated_at in the UPDATE criteria', async () => {
    const { svc, repo } = makeService();

    await svc.update('tenant-1', 'user-1', 'rule-1', {
      value: 12,
      expectedUpdatedAt: NOW.toISOString(),
    } as any);

    const [criteria] = (repo.update as jest.Mock).mock.calls[0];
    expect(criteria.id).toBe('rule-1');
    expect(criteria.tenant_id).toBe('tenant-1');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const op = criteria.updated_at as any;
    expect(op._type).toBe('raw');
    expect(op._objectLiteralParameters).toEqual({ expected: NOW });
  });

  it('with a stale expectedUpdatedAt (0 rows affected): throws ConflictException, does not overwrite', async () => {
    const { svc, repo } = makeService();
    (repo.update as jest.Mock).mockResolvedValueOnce({ affected: 0 });

    await expect(
      svc.update('tenant-1', 'user-1', 'rule-1', {
        value: 99,
        expectedUpdatedAt: new Date('2026-08-14T11:00:00.000Z').toISOString(),
      } as any),
    ).rejects.toThrow(ConflictException);
  });
});

/**
 * REM-03 (Remaining Product Completion Backlog): calculation_method 'tiered' has no
 * persisted bracket structure ("coming soon" in the frontend —
 * FinancialRules.tsx). evaluateRules() silently computed 0 and emitted
 * FINANCIAL_RULE_TRIGGERED as if it were a real result. Now it skips the
 * rule and warns — it never fabricates a result.
 */
describe('FinancialRulesService.evaluateRules — unimplemented calculation method (REM-03)', () => {
  function makeEvalService(rule: Record<string, unknown>) {
    const qb = {
      where: jest.fn().mockReturnThis(),
      getMany: jest.fn(async () => [rule]),
    };
    const repo = { createQueryBuilder: jest.fn(() => qb) };
    const ds = { getRepository: jest.fn(() => repo) } as any;
    const events = { emitTyped: jest.fn(), emit: jest.fn() } as unknown as EventsService;
    const svc = new FinancialRulesService(ds, events);
    return { svc, events };
  }

  it("calculation_method 'tiered' does not emit FINANCIAL_RULE_TRIGGERED (never fabricates computed=0)", async () => {
    const { svc, events } = makeEvalService({
      id: 'rule-tiered', tenant_id: 'tenant-1', name: 'Comissão em faixas', type: 'commission',
      calculation_method: 'tiered', value: '10', active: true, conditions: {},
    });

    await svc.evaluateRules('tenant-1', 'transaction.created', { entityId: 'tx-1', entityType: 'transaction', amount: 1000 });

    expect(events.emitTyped).not.toHaveBeenCalled();
  });

  it("calculation_method 'percentage' still emits normally (regression)", async () => {
    const { svc, events } = makeEvalService({
      id: 'rule-pct', tenant_id: 'tenant-1', name: 'Comissão padrão', type: 'commission',
      calculation_method: 'percentage', value: '10', active: true, conditions: {},
    });

    await svc.evaluateRules('tenant-1', 'transaction.created', { entityId: 'tx-1', entityType: 'transaction', amount: 1000 });

    expect(events.emitTyped).toHaveBeenCalledTimes(1);
  });
});
