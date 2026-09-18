import 'reflect-metadata';
import { PostizAutomation } from './postiz.automation';

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
  return { complete: jest.fn(async () => { throw new Error('Nenhum provider de AI configurado'); }) };
}

const CONTENT_ROW = { title: 'Teaser do single', channel: 'instagram', copy: 'Chegou o teaser!' };

function makeDs(rows: unknown[] = [CONTENT_ROW]) {
  return { query: jest.fn(async () => rows) };
}

function makeInstagram(status: { connected: boolean; needs_reauth?: boolean } = { connected: true }) {
  return { getProviderStatus: jest.fn(async () => status) };
}
function makeTikTok(status: { connected: boolean; needs_reauth?: boolean } = { connected: false }) {
  return { getOrganicStatus: jest.fn(async () => status) };
}
function makeYouTube() {
  return { isConfigured: jest.fn(() => true) };
}

const READY_JSON = JSON.stringify({
  readinessSummary: 'Canal conectado e legenda presente.',
  readyToRequestPublish: true,
  blockers: [],
  recommendedActions: [{ action: 'Revisar horário de publicação', priority: 'low' }],
});

describe('PostizAutomation (ON_DEMAND: POST /marketing/contents/:id/ai/postiz)', () => {
  it('canal instagram conectado + copy presente: readyToRequestPublish=true', async () => {
    const skillRun = makeSkillRun();
    const ai = makeAi(READY_JSON);
    const ds = makeDs();
    const handler = new PostizAutomation(ds as never, skillRun as never, ai as never, makeInstagram() as never, makeTikTok() as never, makeYouTube() as never);

    const result = await handler.run('t1', 'u1', 'post-1');

    const aiCalls = ai.complete.mock.calls as unknown as Array<[{ prompt: string }]>;
    expect(aiCalls[0][0].prompt).toContain('connected');
    expect(result.parsed.readyToRequestPublish).toBe(true);
    expect(skillRun.succeed).toHaveBeenCalled();
  });

  it('ANTI-FABRICAÇÃO: canal não conectado força readyToRequestPublish=false mesmo se o provider reivindicar true', async () => {
    const skillRun = makeSkillRun();
    const ai = makeAi(READY_JSON); // provider tenta reivindicar readyToRequestPublish=true
    const ds = makeDs([{ ...CONTENT_ROW, channel: 'tiktok' }]);
    const handler = new PostizAutomation(ds as never, skillRun as never, ai as never, makeInstagram() as never, makeTikTok({ connected: false }) as never, makeYouTube() as never);

    const result = await handler.run('t1', 'u1', 'post-1');

    expect(result.parsed.readyToRequestPublish).toBe(false);
    expect(result.parsed.blockers.length).toBeGreaterThan(0);
  });

  it('canal facebook/twitter/threads sem serviço de integração: reporta not_implemented, nunca fabricado', async () => {
    const skillRun = makeSkillRun();
    const ai = makeAi(READY_JSON);
    const ds = makeDs([{ ...CONTENT_ROW, channel: 'facebook' }]);
    const handler = new PostizAutomation(ds as never, skillRun as never, ai as never, makeInstagram() as never, makeTikTok() as never, makeYouTube() as never);

    const result = await handler.run('t1', 'u1', 'post-1');

    const aiCalls = ai.complete.mock.calls as unknown as Array<[{ prompt: string }]>;
    expect(aiCalls[0][0].prompt).toContain('not_implemented');
    expect(result.parsed.readyToRequestPublish).toBe(false);
  });

  it('sem copy: blocker obrigatório', async () => {
    const skillRun = makeSkillRun();
    const ai = makeAi(READY_JSON);
    const ds = makeDs([{ ...CONTENT_ROW, copy: null }]);
    const handler = new PostizAutomation(ds as never, skillRun as never, ai as never, makeInstagram() as never, makeTikTok() as never, makeYouTube() as never);

    const result = await handler.run('t1', 'u1', 'post-1');

    expect(result.parsed.readyToRequestPublish).toBe(false);
  });

  it('post inexistente: lança NotFoundException', async () => {
    const skillRun = makeSkillRun();
    const ai = makeAi(READY_JSON);
    const ds = makeDs([]);
    const handler = new PostizAutomation(ds as never, skillRun as never, ai as never, makeInstagram() as never, makeTikTok() as never, makeYouTube() as never);

    await expect(handler.run('t1', 'u1', 'post-1')).rejects.toThrow();
    expect(ai.complete).not.toHaveBeenCalled();
  });

  it('falha da IA registra fail e relança', async () => {
    const skillRun = makeSkillRun();
    const ai = makeFailingAi();
    const ds = makeDs();
    const handler = new PostizAutomation(ds as never, skillRun as never, ai as never, makeInstagram() as never, makeTikTok() as never, makeYouTube() as never);

    await expect(handler.run('t1', 'u1', 'post-1')).rejects.toThrow('Nenhum provider de AI configurado');
    expect(skillRun.fail).toHaveBeenCalledWith('run-1', 't1', 'postiz', expect.any(Error));
  });
});
