import 'reflect-metadata';
import { CopywritingAutomation } from './copywriting.automation';

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

const TASK_ROW = { title: 'Escrever copy', description: 'Copy para e-mail marketing do lançamento', kind: 'email' };

function makeTasks() {
  return { findById: jest.fn(async () => ({ id: 'task-1' })) };
}

function makeDs(rows: unknown[] = [TASK_ROW]) {
  return { query: jest.fn(async () => rows) };
}

const VALID_JSON = JSON.stringify({
  draftTitle: 'Chegou o novo single!',
  draftBody: 'Confira agora o lançamento mais recente.',
  usedFacts: ['Lançamento em 15/07'],
});

describe('CopywritingAutomation (ON_DEMAND: POST /marketing/tasks/:id/ai/copywriting)', () => {
  it('generates a draft from the task\'s real context, isDraft always true', async () => {
    const skillRun = makeSkillRun();
    const ai = makeAi(VALID_JSON);
    const tasks = makeTasks();
    const ds = makeDs();
    const handler = new CopywritingAutomation(ds as never, skillRun as never, ai as never, tasks as never);

    const result = await handler.run('t1', 'u1', 'task-1', 'animado', ['Lançamento em 15/07']);

    expect(tasks.findById).toHaveBeenCalledWith('t1', 'task-1');
    const aiCalls = ai.complete.mock.calls as unknown as Array<[{ prompt: string }]>;
    expect(aiCalls[0][0].prompt).toContain('e-mail de marketing'); // kind='email' -> intent mapeado
    expect(aiCalls[0][0].prompt).toContain('Lançamento em 15/07');
    expect(aiCalls[0][0].prompt).toContain('animado');

    expect(result.parsed.isDraft).toBe(true);
    expect(result.parsed.usedFacts).toEqual(['Lançamento em 15/07']);
    expect(skillRun.succeed).toHaveBeenCalled();
  });

  it('ANTI-FABRICATION: drops any "used fact" that does not exist in the real sourceFacts', async () => {
    const inventingJson = JSON.stringify({
      draftTitle: 'x',
      draftBody: 'x',
      usedFacts: ['Lançamento em 15/07', 'Artista ganhou um Grammy'], // invented fact
    });
    const skillRun = makeSkillRun();
    const ai = makeAi(inventingJson);
    const tasks = makeTasks();
    const ds = makeDs();
    const handler = new CopywritingAutomation(ds as never, skillRun as never, ai as never, tasks as never);

    const result = await handler.run('t1', 'u1', 'task-1', undefined, ['Lançamento em 15/07']);

    expect(result.parsed.usedFacts).toEqual(['Lançamento em 15/07']);
    expect(result.parsed.usedFacts).not.toContain('Artista ganhou um Grammy');
  });

  it('without sourceFacts: writes generic text, empty usedFacts', async () => {
    const skillRun = makeSkillRun();
    const ai = makeAi(VALID_JSON); // the model tries to claim a fact even without having received any
    const tasks = makeTasks();
    const ds = makeDs();
    const handler = new CopywritingAutomation(ds as never, skillRun as never, ai as never, tasks as never);

    const result = await handler.run('t1', 'u1', 'task-1', undefined, undefined);

    expect(result.parsed.usedFacts).toEqual([]);
    const aiCalls = ai.complete.mock.calls as unknown as Array<[{ prompt: string }]>;
    expect(aiCalls[0][0].prompt).toContain('Nenhum fato específico foi fornecido');
  });

  it('unmapped kind: uses the general_draft intent', async () => {
    const skillRun = makeSkillRun();
    const ai = makeAi(VALID_JSON);
    const tasks = makeTasks();
    const ds = makeDs([{ ...TASK_ROW, kind: 'outro-tipo-qualquer' }]);
    const handler = new CopywritingAutomation(ds as never, skillRun as never, ai as never, tasks as never);

    await handler.run('t1', 'u1', 'task-1', undefined, undefined);

    const aiCalls = ai.complete.mock.calls as unknown as Array<[{ prompt: string }]>;
    expect(aiCalls[0][0].prompt).toContain('rascunho de texto genérico');
  });

  it('an AI failure records fail and rethrows', async () => {
    const skillRun = makeSkillRun();
    const ai = makeFailingAi();
    const tasks = makeTasks();
    const ds = makeDs();
    const handler = new CopywritingAutomation(ds as never, skillRun as never, ai as never, tasks as never);

    await expect(handler.run('t1', 'u1', 'task-1', undefined, undefined)).rejects.toThrow('No AI provider configured');
    expect(skillRun.fail).toHaveBeenCalledWith('run-1', 't1', 'copywriting', expect.any(Error));
  });
});
