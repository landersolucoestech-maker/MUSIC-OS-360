import 'reflect-metadata';
import { AudiovisualBriefingAutomation } from './audiovisual-briefing.automation';
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
  return { complete: jest.fn(async () => { throw new Error('Nenhum provider de AI configurado'); }) };
}
function makeDs(releaseRows: unknown[], skillRunRows: unknown[] = []) {
  const query = jest.fn(async (sql: string) => {
    if (/FROM\s+skill_runs/i.test(sql)) return skillRunRows;
    if (/FROM\s+releases/i.test(sql)) return releaseRows;
    return undefined;
  });
  return { ds: { query }, query };
}
function makeEvent(overrides: Record<string, unknown> = {}) {
  return { tenantId: 't1', payload: { releaseId: 'rel1', tenantId: 't1', title: 'Aurora', artistId: 'a1', approvedBy: 'u1', approvedAt: '2026-06-10T00:00:00.000Z', ...overrides } };
}

const RELEASE_ROW = { title: 'Aurora', artist_name: 'Banda Aurora', metadata: {} };
const VALID_JSON = JSON.stringify({
  concept: 'Conceito', contentType: 'music-video', scriptScenes: [], scenes: [], assets: [], deliverables: [],
  teamNeeds: [], checklist: [], risks: [],
});
const IDEMPOTENCY_KEY = 'release.approved:t1:rel1';

describe('AudiovisualBriefingAutomation (release.approved → audiovisual-briefing)', () => {
  it('executa e grava releases.metadata.aiAudiovisualBriefing (chave/skill distintas do marketing)', async () => {
    const { ds, query } = makeDs([RELEASE_ROW]);
    const skillRun = makeSkillRun();
    const ai = makeAi(VALID_JSON);
    const handler = new AudiovisualBriefingAutomation(ds as never, skillRun as never, ai as never, passThroughTenantContext(ds) as never);

    await handler.onReleaseApproved(makeEvent() as never);

    expect(skillRun.start).toHaveBeenCalledWith(expect.objectContaining({
      skillName: 'audiovisual-briefing', entityType: 'release', entityId: 'rel1', input: { idempotencyKey: IDEMPOTENCY_KEY },
    }));
    expect(skillRun.succeed).toHaveBeenCalled();

    const aiCalls = ai.complete.mock.calls as unknown as Array<[{ prompt: string }]>;
    expect(aiCalls[0][0].prompt).toContain('Banda Aurora');

    const updateCall = query.mock.calls.find((c: unknown[]) => /UPDATE\s+releases/i.test(c[0] as string));
    expect(updateCall).toBeDefined();
    const meta = JSON.parse((updateCall as unknown as [string, string[]])[1][0]);
    // key distinct from marketing-calendar (same idempotencyKey, different metadataKey)
    expect(meta.aiAudiovisualBriefing).toBeDefined();
    expect(meta.aiAudiovisualBriefing.skill).toBe('audiovisual-briefing');
    expect(meta.aiAudiovisualBriefing.event).toBe('release.approved');
    expect(meta.aiAudiovisualBriefing.status).toBe('generated');
  });

  it('metadata idempotency blocks reprocessing', async () => {
    const row = { ...RELEASE_ROW, metadata: { aiAudiovisualBriefing: { idempotencyKey: IDEMPOTENCY_KEY, status: 'generated' } } };
    const { ds, query } = makeDs([row]);
    const skillRun = makeSkillRun();
    const ai = makeAi(VALID_JSON);
    const handler = new AudiovisualBriefingAutomation(ds as never, skillRun as never, ai as never, passThroughTenantContext(ds) as never);
    await handler.onReleaseApproved(makeEvent() as never);
    expect(skillRun.start).not.toHaveBeenCalled();
    expect(query.mock.calls.find((c: unknown[]) => /UPDATE/i.test(c[0] as string))).toBeUndefined();
  });

  it('an AI failure records fail and does not write', async () => {
    const { ds, query } = makeDs([RELEASE_ROW]);
    const skillRun = makeSkillRun();
    const ai = makeFailingAi();
    const handler = new AudiovisualBriefingAutomation(ds as never, skillRun as never, ai as never, passThroughTenantContext(ds) as never);
    await expect(handler.onReleaseApproved(makeEvent() as never)).resolves.toBeUndefined();
    expect(skillRun.fail).toHaveBeenCalledWith('run-1', 't1', 'audiovisual-briefing', expect.any(Error));
    expect(query.mock.calls.find((c: unknown[]) => /UPDATE/i.test(c[0] as string))).toBeUndefined();
  });

  it('guarda releaseId ausente', async () => {
    const { ds, query } = makeDs([RELEASE_ROW]);
    const skillRun = makeSkillRun();
    const ai = makeAi(VALID_JSON);
    const handler = new AudiovisualBriefingAutomation(ds as never, skillRun as never, ai as never, passThroughTenantContext(ds) as never);
    await handler.onReleaseApproved({ tenantId: 't1', payload: { releaseId: '' } } as never);
    expect(skillRun.start).not.toHaveBeenCalled();
    expect(query).not.toHaveBeenCalled();
  });
});
