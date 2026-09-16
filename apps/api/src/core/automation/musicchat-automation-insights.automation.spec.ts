import 'reflect-metadata';
import { MusicChatAutomationInsightsAutomation } from './musicchat-automation-insights.automation';

function makeSkillRun(recentSuccess: unknown = null) {
  return {
    start: jest.fn(async () => 'run-1'),
    succeed: jest.fn(async () => undefined),
    fail: jest.fn(async () => undefined),
    findRecentSuccess: jest.fn(async () => recentSuccess),
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

const SETTINGS = {
  enabled: true,
  menu_options: [{ label: 'Suporte' }, { label: 'Comercial' }],
  escalation_rules: [{ level: 'supervisor' }],
};

const EVENTS = [
  { event_type: 'automation.routed', payload: {} },
  { event_type: 'automation.routed', payload: {} },
  { event_type: 'automation.invalid_option', payload: { body: 'quero cancelar meu contrato' } },
  { event_type: 'automation.invalid_option', payload: { body: 'como funciona o repasse de royalties' } },
  { event_type: 'automation.notification_retried', payload: {} },
];

function makeAutomationService(settings = SETTINGS, events = EVENTS) {
  return {
    getSettings: jest.fn(async () => settings),
    listEvents: jest.fn(async () => events),
  };
}

const AUDIT_JSON = JSON.stringify({
  auditSummary: 'Automação saudável, com atenção ao menu de triagem.',
  healthStatus: 'attention',
  findings: [{ finding: 'Duas mensagens sem correspondência no menu', severity: 'medium', evidence: 'invalidOptionCount=2' }],
  recommendedActions: [{ action: 'Revisar opções de menu', priority: 'medium' }],
});

const BUILDER_JSON = JSON.stringify({
  suggestionsSummary: 'Considerar adicionar uma opção de menu para dúvidas de royalties.',
  suggestedMenuChanges: [{ change: 'Adicionar opção "Royalties e Repasses"', rationale: 'Padrão recorrente nas amostras sem correspondência' }],
  suggestedEscalationChanges: [],
  risks: [{ risk: 'Fragmentar o menu com opções muito específicas', severity: 'low' }],
});

describe('MusicChatAutomationInsightsAutomation.runAudit (ON_DEMAND: POST .../automation/audit)', () => {
  it('agrega contadores reais de eventos e settings, registra skill_run e retorna o resultado', async () => {
    const skillRun = makeSkillRun();
    const ai = makeAi(AUDIT_JSON);
    const automation = makeAutomationService();
    const handler = new MusicChatAutomationInsightsAutomation(skillRun as never, ai as never, automation as never);

    const result = await handler.runAudit('t1', 'u1', false);

    expect(skillRun.start).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 't1', userId: 'u1', skillName: 'automation-audit', entityType: null, entityId: null }),
    );

    const aiCalls = ai.complete.mock.calls as unknown as Array<[{ prompt: string; jsonMode: boolean }]>;
    expect(aiCalls[0][0].jsonMode).toBe(true);
    expect(aiCalls[0][0].prompt).toContain('automationEnabled=true');
    expect(aiCalls[0][0].prompt).toContain('automation.routed=2');
    expect(aiCalls[0][0].prompt).toContain('invalidOptionCount=2');
    expect(aiCalls[0][0].prompt).toContain('notificationRetryCount=1');

    expect(result.fromCache).toBe(false);
    expect(result.parsed.healthStatus).toBe('attention');
    expect(skillRun.succeed).toHaveBeenCalled();
  });

  it('reaproveita auditoria recente (stale-refresh de 1 dia) sem nova chamada de IA', async () => {
    const cachedRun = {
      id: 'run-old',
      finished_at: new Date().toISOString(),
      output_payload: { provider: 'openai', model: 'gpt-4o-mini', generatedAt: '2026-01-01T00:00:00Z', parsed: { healthStatus: 'healthy' } },
    };
    const skillRun = makeSkillRun(cachedRun);
    const ai = makeAi(AUDIT_JSON);
    const automation = makeAutomationService();
    const handler = new MusicChatAutomationInsightsAutomation(skillRun as never, ai as never, automation as never);

    const result = await handler.runAudit('t1', 'u1', false);

    expect(result.fromCache).toBe(true);
    expect(ai.complete).not.toHaveBeenCalled();
  });

  it('falha da IA registra fail e relança', async () => {
    const skillRun = makeSkillRun();
    const ai = makeFailingAi();
    const automation = makeAutomationService();
    const handler = new MusicChatAutomationInsightsAutomation(skillRun as never, ai as never, automation as never);

    await expect(handler.runAudit('t1', 'u1', false)).rejects.toThrow('Nenhum provider de AI configurado');
    expect(skillRun.fail).toHaveBeenCalledWith('run-1', 't1', 'automation-audit', expect.any(Error));
  });
});

describe('MusicChatAutomationInsightsAutomation.runBuilderSuggestions (ON_DEMAND: POST .../automation/builder-suggestions)', () => {
  it('extrai amostras reais de mensagens sem correspondência e nunca aplica a configuração', async () => {
    const skillRun = makeSkillRun();
    const ai = makeAi(BUILDER_JSON);
    const automation = makeAutomationService();
    const handler = new MusicChatAutomationInsightsAutomation(skillRun as never, ai as never, automation as never);

    const result = await handler.runBuilderSuggestions('t1', 'u1');

    expect(skillRun.start).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 't1', userId: 'u1', skillName: 'automation-builder', entityType: null, entityId: null }),
    );

    const aiCalls = ai.complete.mock.calls as unknown as Array<[{ prompt: string }]>;
    expect(aiCalls[0][0].prompt).toContain('Suporte, Comercial');
    expect(aiCalls[0][0].prompt).toContain('quero cancelar meu contrato');
    expect(aiCalls[0][0].prompt).toContain('como funciona o repasse de royalties');

    // updateSettings nunca é chamado por esta skill — sugestão apenas
    expect((automation as unknown as { updateSettings?: unknown }).updateSettings).toBeUndefined();
    expect(result.parsed.suggestedMenuChanges).toHaveLength(1);
  });

  it('sem amostras sem correspondência, monta input com lista vazia', async () => {
    const skillRun = makeSkillRun();
    const ai = makeAi(BUILDER_JSON);
    const automation = makeAutomationService(SETTINGS, []);
    const handler = new MusicChatAutomationInsightsAutomation(skillRun as never, ai as never, automation as never);

    await handler.runBuilderSuggestions('t1', 'u1');

    const aiCalls = ai.complete.mock.calls as unknown as Array<[{ prompt: string }]>;
    expect(aiCalls[0][0].prompt).toContain('invalidOptionCount=0');
    expect(aiCalls[0][0].prompt).toContain('Nenhuma amostra');
  });

  it('falha da IA registra fail e relança', async () => {
    const skillRun = makeSkillRun();
    const ai = makeFailingAi();
    const automation = makeAutomationService();
    const handler = new MusicChatAutomationInsightsAutomation(skillRun as never, ai as never, automation as never);

    await expect(handler.runBuilderSuggestions('t1', 'u1')).rejects.toThrow('Nenhum provider de AI configurado');
    expect(skillRun.fail).toHaveBeenCalledWith('run-1', 't1', 'automation-builder', expect.any(Error));
  });
});
