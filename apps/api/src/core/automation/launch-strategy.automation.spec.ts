import 'reflect-metadata';
import { LaunchStrategyAutomation } from './launch-strategy.automation';
import { passThroughTenantContext } from '../../../test/helpers/tenant-context.mock';

// ─── Mocks de fronteira (DB / SkillRunService / AIService) ────────────────────

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
  return { complete: jest.fn(async () => { throw new Error('Nenhum provider de AI configurado'); }) };
}

/**
 * Mock de DataSource que roteia por SQL:
 *  - SELECT ... FROM skill_runs → skillRunRows
 *  - SELECT ... FROM releases   → releaseRows
 *  - UPDATE                     → undefined
 */
function makeDs(releaseRows: unknown[], skillRunRows: unknown[] = []) {
  const query = jest.fn(async (sql: string) => {
    if (/FROM\s+skill_runs/i.test(sql)) return skillRunRows;
    if (/FROM\s+releases/i.test(sql)) return releaseRows;
    return undefined;
  });
  return { ds: { query }, query };
}

function makeEvent(overrides: Record<string, unknown> = {}) {
  return {
    tenantId: 't1',
    payload: {
      releaseId: 'r1',
      tenantId: 't1',
      title: 'Verão Eterno',
      artistId: 'a1',
      approvedBy: 'u1',
      approvedAt: '2026-06-01T00:00:00.000Z',
      ...overrides,
    },
  };
}

const RELEASE_ROW = {
  title: 'Verão Eterno',
  type: 'single',
  genero: 'pop',
  data_lancamento: '2026-07-01T00:00:00.000Z',
  metadata: {
    aiMarketingCalendar: { parsed: { contentPillars: [{ pillar: 'Bastidores' }, { pillar: 'Lyric teasers' }] } },
  },
  artist_name: 'Banda Aurora',
};

const VALID_JSON = JSON.stringify({
  strategicNarrative: 'Uma celebração do verão através de sons nostálgicos.',
  targetAudience: 'Fãs de pop nacional, 18-24 anos',
  competitivePositioning: 'Diferenciação por autenticidade regional',
  keyMessages: [{ message: 'O verão nunca acaba', audience: 'fãs atuais' }],
  successSignals: [{ signal: 'aumento de saves em playlists', why: 'indica intenção de re-escuta' }],
  riskFactors: [{ risk: 'saturação de lançamentos de verão no mercado', severity: 'medium', mitigation: 'antecipar lançamento em 2 semanas' }],
});

const IDEMPOTENCY_KEY = 'release.approved:t1:r1';

describe('LaunchStrategyAutomation (release.approved → launch-strategy)', () => {
  it('executa, registra skill_run e grava releases.metadata.aiLaunchStrategy no sucesso', async () => {
    const { ds, query } = makeDs([RELEASE_ROW]);
    const skillRun = makeSkillRun();
    const ai = makeAi(VALID_JSON);
    const handler = new LaunchStrategyAutomation(ds as never, skillRun as never, ai as never, passThroughTenantContext(ds) as never);

    await handler.onReleaseApproved(makeEvent() as never);

    expect(skillRun.start).toHaveBeenCalledWith(
      expect.objectContaining({
        skillName: 'launch-strategy',
        entityType: 'release',
        entityId: 'r1',
        input: { idempotencyKey: IDEMPOTENCY_KEY },
      }),
    );
    expect(skillRun.succeed).toHaveBeenCalled();
    expect(skillRun.fail).not.toHaveBeenCalled();

    // reaproveita os pilares de conteúdo reais já gerados por marketing-calendar-builder
    const aiCalls = ai.complete.mock.calls as unknown as Array<[{ prompt: string; jsonMode: boolean }]>;
    expect(aiCalls[0][0].jsonMode).toBe(true);
    expect(aiCalls[0][0].prompt).toContain('Verão Eterno');
    expect(aiCalls[0][0].prompt).toContain('Bastidores, Lyric teasers');
    expect(aiCalls[0][0].prompt).toContain('Banda Aurora');

    const updateCall = query.mock.calls.find((c: unknown[]) => /UPDATE\s+releases/i.test(c[0] as string));
    expect(updateCall).toBeDefined();
    const meta = JSON.parse((updateCall as unknown as [string, string[]])[1][0]);
    expect(meta.aiLaunchStrategy.source).toBe('native-automation');
    expect(meta.aiLaunchStrategy.skill).toBe('launch-strategy');
    expect(meta.aiLaunchStrategy.event).toBe('release.approved');
    expect(meta.aiLaunchStrategy.idempotencyKey).toBe(IDEMPOTENCY_KEY);
    expect(meta.aiLaunchStrategy.status).toBe('generated');
    expect(meta.aiLaunchStrategy.parsed.targetAudience).toBe('Fãs de pop nacional, 18-24 anos');
  });

  it('sem calendário tático prévio, monta input sem existingCalendarSummary', async () => {
    const row = { ...RELEASE_ROW, metadata: {} };
    const { ds } = makeDs([row]);
    const skillRun = makeSkillRun();
    const ai = makeAi(VALID_JSON);
    const handler = new LaunchStrategyAutomation(ds as never, skillRun as never, ai as never, passThroughTenantContext(ds) as never);

    await handler.onReleaseApproved(makeEvent() as never);

    const aiCalls = ai.complete.mock.calls as unknown as Array<[{ prompt: string }]>;
    expect(aiCalls[0][0].prompt).not.toContain('Pilares de conteúdo');
  });

  it('idempotência metadata — não reprocessa se já gerado com a mesma chave', async () => {
    const row = { ...RELEASE_ROW, metadata: { aiLaunchStrategy: { idempotencyKey: IDEMPOTENCY_KEY, status: 'generated' } } };
    const { ds, query } = makeDs([row]);
    const skillRun = makeSkillRun();
    const ai = makeAi(VALID_JSON);
    const handler = new LaunchStrategyAutomation(ds as never, skillRun as never, ai as never, passThroughTenantContext(ds) as never);

    await handler.onReleaseApproved(makeEvent() as never);

    expect(skillRun.start).not.toHaveBeenCalled();
    expect(ai.complete).not.toHaveBeenCalled();
    expect(query.mock.calls.find((c: unknown[]) => /UPDATE/i.test(c[0] as string))).toBeUndefined();
  });

  it('idempotência skill_runs — run em andamento/sucesso bloqueia', async () => {
    const { ds, query } = makeDs([RELEASE_ROW], [{ '1': 1 }]);
    const skillRun = makeSkillRun();
    const ai = makeAi(VALID_JSON);
    const handler = new LaunchStrategyAutomation(ds as never, skillRun as never, ai as never, passThroughTenantContext(ds) as never);

    await handler.onReleaseApproved(makeEvent() as never);

    expect(skillRun.start).not.toHaveBeenCalled();
    expect(ai.complete).not.toHaveBeenCalled();
    expect(query.mock.calls.find((c: unknown[]) => /UPDATE/i.test(c[0] as string))).toBeUndefined();
  });

  it('falha da IA registra fail, não relança e não grava aiLaunchStrategy', async () => {
    const { ds, query } = makeDs([RELEASE_ROW]);
    const skillRun = makeSkillRun();
    const ai = makeFailingAi();
    const handler = new LaunchStrategyAutomation(ds as never, skillRun as never, ai as never, passThroughTenantContext(ds) as never);

    await expect(handler.onReleaseApproved(makeEvent() as never)).resolves.toBeUndefined();

    expect(skillRun.fail).toHaveBeenCalledWith('run-1', 't1', 'launch-strategy', expect.any(Error));
    expect(skillRun.succeed).not.toHaveBeenCalled();
    expect(query.mock.calls.find((c: unknown[]) => /UPDATE/i.test(c[0] as string))).toBeUndefined();
  });

  it('guarda: tenantId/releaseId ausente é ignorado (sem run, sem query)', async () => {
    const { ds, query } = makeDs([RELEASE_ROW]);
    const skillRun = makeSkillRun();
    const ai = makeAi(VALID_JSON);
    const handler = new LaunchStrategyAutomation(ds as never, skillRun as never, ai as never, passThroughTenantContext(ds) as never);

    await handler.onReleaseApproved({ tenantId: 't1', payload: { releaseId: '' } } as never);

    expect(skillRun.start).not.toHaveBeenCalled();
    expect(query).not.toHaveBeenCalled();
  });
});
