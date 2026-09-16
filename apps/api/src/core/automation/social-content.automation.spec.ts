import 'reflect-metadata';
import { SocialContentAutomation } from './social-content.automation';
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
 *  - SELECT ... FROM skill_runs               → skillRunRows
 *  - SELECT ... FROM marketing_content_posts   → contentRows
 *  - UPDATE                                    → undefined
 */
function makeDs(contentRows: unknown[], skillRunRows: unknown[] = []) {
  const query = jest.fn(async (sql: string) => {
    if (/FROM\s+skill_runs/i.test(sql)) return skillRunRows;
    if (/FROM\s+marketing_content_posts/i.test(sql)) return contentRows;
    return undefined;
  });
  return { ds: { query }, query };
}

function makeEvent(overrides: Record<string, unknown> = {}) {
  return {
    tenantId: 't1',
    payload: {
      contentId: 'p1',
      tenantId: 't1',
      title: 'Teaser do single',
      channel: 'instagram',
      createdBy: 'u1',
      ...overrides,
    },
  };
}

const CONTENT_ROW = {
  title: 'Teaser do single',
  target_type: 'artista',
  target_name: 'Banda Aurora',
  channel: 'instagram',
  content_type: 'feed',
  copy: 'Chegou o teaser do novo single!',
  metadata: {},
  campaign_name: 'Lançamento Single Verão',
};

const VALID_JSON = JSON.stringify({
  captionVariants: [
    { variant: 'O teaser chegou! Prepare-se.', tone: 'direto' },
    { variant: 'Era uma vez uma música esperando para nascer...', tone: 'storytelling' },
  ],
  hashtags: ['novomusica', 'teaser', 'bandaaurora'],
  toneNotes: 'Tom animado para gerar expectativa no Instagram.',
  channelChecklist: [{ item: 'Usar formato vertical 9:16', reason: 'Melhor desempenho em Stories/Reels' }],
});

const IDEMPOTENCY_KEY = 'marketing.content_created:t1:p1';

describe('SocialContentAutomation (marketing.content_created → social-content)', () => {
  it('executa, registra skill_run e grava marketing_content_posts.metadata.aiSocialContent no sucesso', async () => {
    const { ds, query } = makeDs([CONTENT_ROW]);
    const skillRun = makeSkillRun();
    const ai = makeAi(VALID_JSON);
    const handler = new SocialContentAutomation(ds as never, skillRun as never, ai as never, passThroughTenantContext(ds) as never);

    await handler.onContentCreated(makeEvent() as never);

    expect(skillRun.start).toHaveBeenCalledWith(
      expect.objectContaining({
        skillName: 'social-content',
        entityType: 'marketing_content_post',
        entityId: 'p1',
        input: { idempotencyKey: IDEMPOTENCY_KEY },
      }),
    );
    expect(skillRun.succeed).toHaveBeenCalled();
    expect(skillRun.fail).not.toHaveBeenCalled();

    const aiCalls = ai.complete.mock.calls as unknown as Array<[{ prompt: string; jsonMode: boolean }]>;
    expect(aiCalls[0][0].jsonMode).toBe(true);
    expect(aiCalls[0][0].prompt).toContain('Teaser do single');
    expect(aiCalls[0][0].prompt).toContain('Chegou o teaser do novo single!');
    expect(aiCalls[0][0].prompt).toContain('Lançamento Single Verão');

    const updateCall = query.mock.calls.find((c: unknown[]) => /UPDATE\s+marketing_content_posts/i.test(c[0] as string));
    expect(updateCall).toBeDefined();
    const meta = JSON.parse((updateCall as unknown as [string, string[]])[1][0]);
    expect(meta.aiSocialContent.source).toBe('native-automation');
    expect(meta.aiSocialContent.skill).toBe('social-content');
    expect(meta.aiSocialContent.event).toBe('marketing.content_created');
    expect(meta.aiSocialContent.idempotencyKey).toBe(IDEMPOTENCY_KEY);
    expect(meta.aiSocialContent.status).toBe('generated');
    expect(meta.aiSocialContent.parsed.captionVariants).toHaveLength(2);
    // nunca escreve no campo `copy` real nem em status de publicação — apenas metadata
    expect(query.mock.calls.find((c: unknown[]) => /SET\s+copy/i.test(c[0] as string))).toBeUndefined();
  });

  it('sem campanha relacionada, monta input sem relatedCampaign', async () => {
    const row = { ...CONTENT_ROW, campaign_name: null };
    const { ds } = makeDs([row]);
    const skillRun = makeSkillRun();
    const ai = makeAi(VALID_JSON);
    const handler = new SocialContentAutomation(ds as never, skillRun as never, ai as never, passThroughTenantContext(ds) as never);

    await handler.onContentCreated(makeEvent() as never);

    const aiCalls = ai.complete.mock.calls as unknown as Array<[{ prompt: string }]>;
    expect(aiCalls[0][0].prompt).not.toContain('Lançamento Single Verão');
  });

  it('idempotência metadata — não reprocessa se já gerado com a mesma chave', async () => {
    const row = { ...CONTENT_ROW, metadata: { aiSocialContent: { idempotencyKey: IDEMPOTENCY_KEY, status: 'generated' } } };
    const { ds, query } = makeDs([row]);
    const skillRun = makeSkillRun();
    const ai = makeAi(VALID_JSON);
    const handler = new SocialContentAutomation(ds as never, skillRun as never, ai as never, passThroughTenantContext(ds) as never);

    await handler.onContentCreated(makeEvent() as never);

    expect(skillRun.start).not.toHaveBeenCalled();
    expect(ai.complete).not.toHaveBeenCalled();
    expect(query.mock.calls.find((c: unknown[]) => /UPDATE/i.test(c[0] as string))).toBeUndefined();
  });

  it('idempotência skill_runs — run em andamento/sucesso bloqueia', async () => {
    const { ds, query } = makeDs([CONTENT_ROW], [{ '1': 1 }]);
    const skillRun = makeSkillRun();
    const ai = makeAi(VALID_JSON);
    const handler = new SocialContentAutomation(ds as never, skillRun as never, ai as never, passThroughTenantContext(ds) as never);

    await handler.onContentCreated(makeEvent() as never);

    expect(skillRun.start).not.toHaveBeenCalled();
    expect(ai.complete).not.toHaveBeenCalled();
    expect(query.mock.calls.find((c: unknown[]) => /UPDATE/i.test(c[0] as string))).toBeUndefined();
  });

  it('falha da IA registra fail, não relança e não grava aiSocialContent', async () => {
    const { ds, query } = makeDs([CONTENT_ROW]);
    const skillRun = makeSkillRun();
    const ai = makeFailingAi();
    const handler = new SocialContentAutomation(ds as never, skillRun as never, ai as never, passThroughTenantContext(ds) as never);

    await expect(handler.onContentCreated(makeEvent() as never)).resolves.toBeUndefined();

    expect(skillRun.fail).toHaveBeenCalledWith('run-1', 't1', 'social-content', expect.any(Error));
    expect(skillRun.succeed).not.toHaveBeenCalled();
    expect(query.mock.calls.find((c: unknown[]) => /UPDATE/i.test(c[0] as string))).toBeUndefined();
  });

  it('guarda: tenantId/contentId ausente é ignorado (sem run, sem query)', async () => {
    const { ds, query } = makeDs([CONTENT_ROW]);
    const skillRun = makeSkillRun();
    const ai = makeAi(VALID_JSON);
    const handler = new SocialContentAutomation(ds as never, skillRun as never, ai as never, passThroughTenantContext(ds) as never);

    await handler.onContentCreated({ tenantId: 't1', payload: { contentId: '' } } as never);

    expect(skillRun.start).not.toHaveBeenCalled();
    expect(query).not.toHaveBeenCalled();
  });
});
