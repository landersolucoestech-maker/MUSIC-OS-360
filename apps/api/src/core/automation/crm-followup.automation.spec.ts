import 'reflect-metadata';
import { CrmFollowupAutomation } from './crm-followup.automation';
import { passThroughTenantContext } from '../../../test/helpers/tenant-context.mock';

function makeSkillRun() {
  return {
    start: jest.fn(async () => 'run-1'),
    succeed: jest.fn(async () => undefined),
    fail: jest.fn(async () => undefined),
    log: jest.fn(async () => undefined),
  };
}
function makeAi(content: string) {
  return { complete: jest.fn(async () => ({ content, provider: 'openai', model: 'gpt-4o-mini', inputTokens: 1, outputTokens: 1, costUsd: 0, latencyMs: 1 })) };
}
function makeFailingAi() {
  return { complete: jest.fn(async () => { throw new Error('No AI provider configured'); }) };
}
function makeDs(leadRows: unknown[], skillRunRows: unknown[] = []) {
  const query = jest.fn(async (sql: string) => {
    if (/FROM\s+skill_runs/i.test(sql)) return skillRunRows;
    if (/FROM\s+leads/i.test(sql)) return leadRows;
    return undefined;
  });
  return { ds: { query }, query };
}
function makeEvent(overrides: Record<string, unknown> = {}) {
  return { tenantId: 't1', payload: { tenantId: 't1', leadId: 'l1', nome: 'Estúdio X', origem: 'site', ...overrides } };
}

const LEAD_ROW = { nome: 'Estúdio X', empresa: 'Estúdio X Ltda', status: 'novo', fonte: 'site', pipeline_stage: null, metadata: {} };
const VALID_JSON = JSON.stringify({
  nextStep: 'Ligar para qualificar', suggestedMessage: 'Olá!', objections: [], conversionProbability: 0.4,
  funnelStage: 'qualified', recommendedActions: [], risks: [], stageRecommendation: { stage: 'qualified', reason: 'x' },
});
const IDEMPOTENCY_KEY = 'lead.created:t1:l1';

describe('CrmFollowupAutomation (lead.created → crm-followup)', () => {
  it('executes, logs skill_run and saves leads.metadata.aiFollowup on success', async () => {
    const { ds, query } = makeDs([LEAD_ROW]);
    const skillRun = makeSkillRun();
    const ai = makeAi(VALID_JSON);
    const handler = new CrmFollowupAutomation(ds as never, skillRun as never, ai as never, passThroughTenantContext(ds) as never);

    await handler.onLeadCreated(makeEvent() as never);

    expect(skillRun.start).toHaveBeenCalledWith(expect.objectContaining({
      skillName: 'crm-followup', entityType: 'lead', entityId: 'l1', input: { idempotencyKey: IDEMPOTENCY_KEY },
    }));
    expect(skillRun.succeed).toHaveBeenCalled();
    expect(skillRun.fail).not.toHaveBeenCalled();

    // input: leadName + stage mapeado (novo→new) no prompt
    const aiCalls = ai.complete.mock.calls as unknown as Array<[{ prompt: string; jsonMode: boolean }]>;
    expect(aiCalls[0][0].jsonMode).toBe(true);
    expect(aiCalls[0][0].prompt).toContain('Estúdio X');

    const updateCall = query.mock.calls.find((c: unknown[]) => /UPDATE\s+leads/i.test(c[0] as string));
    expect(updateCall).toBeDefined();
    const meta = JSON.parse((updateCall as unknown as [string, string[]])[1][0]);
    expect(meta.aiFollowup.skill).toBe('crm-followup');
    expect(meta.aiFollowup.event).toBe('lead.created');
    expect(meta.aiFollowup.idempotencyKey).toBe(IDEMPOTENCY_KEY);
    expect(meta.aiFollowup.status).toBe('generated');
  });

  it('metadata idempotency blocks reprocessing', async () => {
    const row = { ...LEAD_ROW, metadata: { aiFollowup: { idempotencyKey: IDEMPOTENCY_KEY, status: 'generated' } } };
    const { ds, query } = makeDs([row]);
    const skillRun = makeSkillRun();
    const ai = makeAi(VALID_JSON);
    const handler = new CrmFollowupAutomation(ds as never, skillRun as never, ai as never, passThroughTenantContext(ds) as never);
    await handler.onLeadCreated(makeEvent() as never);
    expect(skillRun.start).not.toHaveBeenCalled();
    expect(ai.complete).not.toHaveBeenCalled();
    expect(query.mock.calls.find((c: unknown[]) => /UPDATE/i.test(c[0] as string))).toBeUndefined();
  });

  it('skill_runs idempotency blocks reprocessing', async () => {
    const { ds } = makeDs([LEAD_ROW], [{ '1': 1 }]);
    const skillRun = makeSkillRun();
    const ai = makeAi(VALID_JSON);
    const handler = new CrmFollowupAutomation(ds as never, skillRun as never, ai as never, passThroughTenantContext(ds) as never);
    await handler.onLeadCreated(makeEvent() as never);
    expect(skillRun.start).not.toHaveBeenCalled();
    expect(ai.complete).not.toHaveBeenCalled();
  });

  it('an AI failure records fail, does not rethrow and does not write', async () => {
    const { ds, query } = makeDs([LEAD_ROW]);
    const skillRun = makeSkillRun();
    const ai = makeFailingAi();
    const handler = new CrmFollowupAutomation(ds as never, skillRun as never, ai as never, passThroughTenantContext(ds) as never);
    await expect(handler.onLeadCreated(makeEvent() as never)).resolves.toBeUndefined();
    expect(skillRun.fail).toHaveBeenCalledWith('run-1', 't1', 'crm-followup', expect.any(Error));
    expect(skillRun.succeed).not.toHaveBeenCalled();
    expect(query.mock.calls.find((c: unknown[]) => /UPDATE/i.test(c[0] as string))).toBeUndefined();
  });

  it('guards against a missing tenantId/leadId', async () => {
    const { ds, query } = makeDs([LEAD_ROW]);
    const skillRun = makeSkillRun();
    const ai = makeAi(VALID_JSON);
    const handler = new CrmFollowupAutomation(ds as never, skillRun as never, ai as never, passThroughTenantContext(ds) as never);
    await handler.onLeadCreated({ tenantId: 't1', payload: { leadId: '' } } as never);
    expect(skillRun.start).not.toHaveBeenCalled();
    expect(query).not.toHaveBeenCalled();
  });
});
