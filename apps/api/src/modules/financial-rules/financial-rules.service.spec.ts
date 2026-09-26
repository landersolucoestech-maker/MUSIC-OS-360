import 'reflect-metadata';
import { ConflictException } from '@nestjs/common';
import { FinancialRulesService } from './financial-rules.service';
import { EventsService } from '../../core/events/events.service';

/**
 * Task K — mesma proteção de concorrência otimista aplicada a
 * TransactionsService/ClientsService: FinancialRulesService.update() usava
 * repo.update() incondicional — duas pessoas editando a mesma regra
 * financeira em paralelo faziam a segunda gravação sobrescrever a primeira
 * em silêncio. Sem `expectedUpdatedAt`, o comportamento continua idêntico.
 */

const NOW = new Date('2026-08-14T12:00:00.000Z');
const RULE = {
  id: 'rule-1', tenant_id: 'tenant-1', name: 'Comissão padrão', type: 'comissao',
  calculo: 'percentual', value: '10', active: true, condicoes: {},
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
  it('sem expectedUpdatedAt: aplica update incondicional (compatibilidade retroativa)', async () => {
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
 * REM-03 (Remaining Product Completion Backlog): calculo:'faixa' não tem
 * estrutura de brackets persistida (feature "em breve" no frontend —
 * FinancialRules.tsx). evaluateRules() computava 0 em silêncio e emitia
 * FINANCIAL_RULE_TRIGGERED como se fosse um resultado real. Agora pula a
 * regra e avisa — nunca fabrica um resultado.
 */
describe('FinancialRulesService.evaluateRules — unimplemented calculo (REM-03)', () => {
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

  it("calculo:'faixa' does not emit FINANCIAL_RULE_TRIGGERED (never fabricates computed=0)", async () => {
    const { svc, events } = makeEvalService({
      id: 'rule-faixa', tenant_id: 'tenant-1', name: 'Comissão em faixas', type: 'comissao',
      calculo: 'faixa', value: '10', active: true, condicoes: {},
    });

    await svc.evaluateRules('tenant-1', 'transaction.created', { entityId: 'tx-1', entityType: 'transaction', valor: 1000 });

    expect(events.emitTyped).not.toHaveBeenCalled();
  });

  it("calculo:'percentual' still emits normally (regression)", async () => {
    const { svc, events } = makeEvalService({
      id: 'rule-pct', tenant_id: 'tenant-1', name: 'Comissão padrão', type: 'comissao',
      calculo: 'percentual', value: '10', active: true, condicoes: {},
    });

    await svc.evaluateRules('tenant-1', 'transaction.created', { entityId: 'tx-1', entityType: 'transaction', valor: 1000 });

    expect(events.emitTyped).toHaveBeenCalledTimes(1);
  });
});
