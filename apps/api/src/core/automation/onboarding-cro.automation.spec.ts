import 'reflect-metadata';
import { OnboardingCroAutomation } from './onboarding-cro.automation';

function makeSkillRun() {
  return {
    start: jest.fn(async () => 'run-1'),
    succeed: jest.fn(async () => undefined),
    fail: jest.fn(async () => undefined),
    findRecentSuccess: jest.fn(async () => null),
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

/** Routes by table: tenants -> tenantRow; counts -> counts[table]. */
function makeDs(tenantRow: unknown, counts: Record<string, number>) {
  const query = jest.fn(async (sql: string) => {
    if (/FROM tenants/i.test(sql)) return [tenantRow];
    for (const [table, cnt] of Object.entries(counts)) {
      if (new RegExp(`FROM "${table}"`, 'i').test(sql)) return [{ cnt }];
    }
    return [{ cnt: 0 }];
  });
  return { query };
}

const FULL_COUNTS = { artists: 3, works: 2, phonograms: 1, contracts: 1, org_members: 4, oauth_connections: 1 };
const EMPTY_COUNTS = { artists: 0, works: 0, phonograms: 0, contracts: 0, org_members: 1, oauth_connections: 0 };

const VALID_JSON = JSON.stringify({
  progressSummary: 'Onboarding avançado, faltando apenas conectar uma integração.',
  nextRecommendedStep: 'connect_integration',
  recommendedActions: [{ action: 'Conectar Instagram', priority: 'medium' }],
});

describe('OnboardingCroAutomation (ON_DEMAND: POST /auth/onboarding/ai/progress-analysis)', () => {
  it('derives each step deterministically from real counts — tenant with advanced progress', async () => {
    const skillRun = makeSkillRun();
    const ai = makeAi(VALID_JSON);
    const ds = makeDs({ name: 'Gravadora X', onboarding_completed: true }, FULL_COUNTS);
    const handler = new OnboardingCroAutomation(ds as never, skillRun as never, ai as never);

    const result = await handler.run('t1', 'u1');

    const aiCalls = ai.complete.mock.calls as unknown as Array<[{ prompt: string }]>;
    expect(aiCalls[0][0].prompt).toContain('company_profile=concluído');
    expect(aiCalls[0][0].prompt).toContain('first_artist=concluído');
    expect(aiCalls[0][0].prompt).toContain('connect_integration=concluído');

    expect(result.parsed.completedStepsCount).toBe(6);
    expect(result.parsed.totalStepsCount).toBe(6);
    expect(skillRun.succeed).toHaveBeenCalled();
  });

  it('ANTI-FABRICATION: brand-new tenant with no real data — all steps pending, never an invented rate', async () => {
    const skillRun = makeSkillRun();
    const ai = makeAi(VALID_JSON);
    const ds = makeDs({ name: 'Novo Tenant', onboarding_completed: false }, EMPTY_COUNTS);
    const handler = new OnboardingCroAutomation(ds as never, skillRun as never, ai as never);

    const result = await handler.run('t1', 'u1');

    expect(result.parsed.completedStepsCount).toBe(0);
    const aiCalls = ai.complete.mock.calls as unknown as Array<[{ prompt: string }]>;
    expect(aiCalls[0][0].prompt).toContain('company_profile=pendente');
    expect(aiCalls[0][0].prompt).toContain('invite_team=pendente'); // org_members=1 (only the owner) does not count as an invited team
  });

  it('nonexistent tenant: throws NotFoundException', async () => {
    const skillRun = makeSkillRun();
    const ai = makeAi(VALID_JSON);
    const ds = { query: jest.fn(async () => []) };
    const handler = new OnboardingCroAutomation(ds as never, skillRun as never, ai as never);

    await expect(handler.run('t1', 'u1')).rejects.toThrow();
    expect(ai.complete).not.toHaveBeenCalled();
  });

  it('AI failure records fail and rethrows', async () => {
    const skillRun = makeSkillRun();
    const ai = makeFailingAi();
    const ds = makeDs({ name: 'Gravadora X', onboarding_completed: true }, FULL_COUNTS);
    const handler = new OnboardingCroAutomation(ds as never, skillRun as never, ai as never);

    await expect(handler.run('t1', 'u1')).rejects.toThrow('No AI provider configured');
    expect(skillRun.fail).toHaveBeenCalledWith('run-1', 't1', 'onboarding-cro', expect.any(Error));
  });
});
