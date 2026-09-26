import 'reflect-metadata';
import { SupportTriageAutomation } from './support-triage.automation';
import { passThroughTenantContext } from '../../../test/helpers/tenant-context.mock';

// ─── Boundary mocks (DB / SkillRunService / AIService) ────────────────────────

function makeSkillRun() {
  return {
    start: jest.fn(async () => 'run-1'),
    succeed: jest.fn(async () => undefined),
    fail: jest.fn(async () => undefined),
    log: jest.fn(async () => undefined),
  };
}

function makeAi(content: string) {
  return {
    complete: jest.fn(async () => ({
      content,
      provider: 'openai',
      model: 'gpt-4o-mini',
      inputTokens: 1,
      outputTokens: 1,
      costUsd: 0,
      latencyMs: 1,
    })),
  };
}

function makeFailingAi() {
  return { complete: jest.fn(async () => { throw new Error('No AI provider configured'); }) };
}

/**
 * DataSource mock that routes by SQL:
 *  - SELECT ... FROM skill_runs      → skillRunRows (idempotency guard)
 *  - SELECT ... FROM support_tickets → ticketRows
 *  - UPDATE                          → undefined
 */
function makeDs(ticketRows: unknown[], skillRunRows: unknown[] = []) {
  const query = jest.fn(async (sql: string) => {
    if (/FROM\s+skill_runs/i.test(sql)) return skillRunRows;
    if (/FROM\s+support_tickets/i.test(sql)) return ticketRows;
    return undefined;
  });
  return { ds: { query }, query };
}

function makeEvent(overrides: Record<string, unknown> = {}) {
  return {
    tenantId: 't1',
    payload: {
      tenantId: 't1',
      ticketId: 'k1',
      createdBy: 'u1',
      category: 'financial',
      priority: 'high',
      ...overrides,
    },
  };
}

const TICKET_ROW = {
  subject: 'Cobrança duplicada',
  description: 'Fui cobrado duas vezes na fatura deste mês.',
  category: 'financial',
  metadata: {},
};

const VALID_TRIAGE_JSON = JSON.stringify({
  category: 'Erro financeiro',
  priority: 'high',
  severity: 'high',
  affectedModule: 'financial',
  likelyCause: 'Cobrança em duplicidade no gateway',
  suggestedResponse: 'Olá! Já estamos verificando a cobrança duplicada.',
  escalationNeeded: true,
  SLARecommendation: { responseTime: '2h', resolutionTime: '1 dia útil', reason: 'tema financeiro sensível' },
  internalNotes: ['Verificar logs do gateway'],
  recommendedActions: [{ action: 'Abrir investigação financeira', priority: 'high', ownerArea: 'financial' }],
});

const IDEMPOTENCY_KEY = 'support.ticket.created:t1:k1';

describe('SupportTriageAutomation (support.ticket.created → support-triage)', () => {
  it('Flow: executes, records skill_run and writes support_tickets.metadata.aiTriage on success', async () => {
    const { ds, query } = makeDs([TICKET_ROW]);
    const skillRun = makeSkillRun();
    const ai = makeAi(VALID_TRIAGE_JSON);
    const handler = new SupportTriageAutomation(ds as never, skillRun as never, ai as never, passThroughTenantContext(ds) as never);

    await handler.onSupportTicketCreated(makeEvent() as never);

    expect(skillRun.start).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 't1',
        skillName: 'support-triage',
        entityType: 'support_ticket',
        entityId: 'k1',
        input: { idempotencyKey: IDEMPOTENCY_KEY },
      }),
    );
    expect(skillRun.succeed).toHaveBeenCalledWith(
      'run-1', 't1', 'support-triage',
      expect.objectContaining({ idempotencyKey: IDEMPOTENCY_KEY, status: 'generated' }),
    );
    expect(skillRun.fail).not.toHaveBeenCalled();

    // input built from the ticket: subject + message(description) + affectedModule(category)
    const aiCalls = ai.complete.mock.calls as unknown as Array<[{ prompt: string; jsonMode: boolean }]>;
    const aiArg = aiCalls[0][0];
    expect(aiArg.jsonMode).toBe(true);
    expect(aiArg.prompt).toContain('Cobrança duplicada');
    expect(aiArg.prompt).toContain('financial');

    // aiTriage written via UPDATE
    const updateCall = query.mock.calls.find((c: unknown[]) => /UPDATE/i.test(c[0] as string));
    expect(updateCall).toBeDefined();
    const params = (updateCall as unknown as [string, string[]])[1];
    const meta = JSON.parse(params[0]);
    expect(meta.aiTriage).toBeDefined();
    expect(meta.aiTriage.source).toBe('native-automation');
    expect(meta.aiTriage.skill).toBe('support-triage');
    expect(meta.aiTriage.event).toBe('support.ticket.created');
    expect(meta.aiTriage.idempotencyKey).toBe(IDEMPOTENCY_KEY);
    expect(meta.aiTriage.status).toBe('generated');
    expect(meta.aiTriage.parsed.category).toBe('Erro financeiro');
  });

  it('Idempotency (metadata): does not reprocess if aiTriage with the same key already exists', async () => {
    const rowWithTriage = {
      ...TICKET_ROW,
      metadata: { aiTriage: { idempotencyKey: IDEMPOTENCY_KEY, status: 'generated' } },
    };
    const { ds, query } = makeDs([rowWithTriage]);
    const skillRun = makeSkillRun();
    const ai = makeAi(VALID_TRIAGE_JSON);
    const handler = new SupportTriageAutomation(ds as never, skillRun as never, ai as never, passThroughTenantContext(ds) as never);

    await handler.onSupportTicketCreated(makeEvent() as never);

    expect(skillRun.start).not.toHaveBeenCalled();
    expect(ai.complete).not.toHaveBeenCalled();
    const updateCall = query.mock.calls.find((c: unknown[]) => /UPDATE/i.test(c[0] as string));
    expect(updateCall).toBeUndefined();
  });

  it('Idempotency (skill_runs): does not reprocess if a successful run with the same key already exists', async () => {
    const { ds, query } = makeDs([TICKET_ROW], [{ '1': 1 }]);
    const skillRun = makeSkillRun();
    const ai = makeAi(VALID_TRIAGE_JSON);
    const handler = new SupportTriageAutomation(ds as never, skillRun as never, ai as never, passThroughTenantContext(ds) as never);

    await handler.onSupportTicketCreated(makeEvent() as never);

    expect(skillRun.start).not.toHaveBeenCalled();
    expect(ai.complete).not.toHaveBeenCalled();
    const updateCall = query.mock.calls.find((c: unknown[]) => /UPDATE/i.test(c[0] as string));
    expect(updateCall).toBeUndefined();
  });

  it('AI failure records fail, does not rethrow and does not write aiTriage', async () => {
    const { ds, query } = makeDs([TICKET_ROW]);
    const skillRun = makeSkillRun();
    const ai = makeFailingAi();
    const handler = new SupportTriageAutomation(ds as never, skillRun as never, ai as never, passThroughTenantContext(ds) as never);

    // Must not throw (support.ticket.created is not rolled back)
    await expect(handler.onSupportTicketCreated(makeEvent() as never)).resolves.toBeUndefined();

    expect(skillRun.start).toHaveBeenCalled();
    expect(skillRun.fail).toHaveBeenCalledWith('run-1', 't1', 'support-triage', expect.any(Error));
    expect(skillRun.succeed).not.toHaveBeenCalled();
    const updateCall = query.mock.calls.find((c: unknown[]) => /UPDATE/i.test(c[0] as string));
    expect(updateCall).toBeUndefined();
  });

  it('Guard: missing tenantId/ticketId is ignored (no run, no query)', async () => {
    const { ds, query } = makeDs([TICKET_ROW]);
    const skillRun = makeSkillRun();
    const ai = makeAi(VALID_TRIAGE_JSON);
    const handler = new SupportTriageAutomation(ds as never, skillRun as never, ai as never, passThroughTenantContext(ds) as never);

    await handler.onSupportTicketCreated({ tenantId: 't1', payload: { ticketId: '' } } as never);

    expect(skillRun.start).not.toHaveBeenCalled();
    expect(query).not.toHaveBeenCalled();
  });
});
