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
  return { complete: jest.fn(async () => { throw new Error('Nenhum provider de AI configurado'); }) };
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
  it('gera rascunho a partir do contexto real da tarefa, isDraft sempre true', async () => {
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

  it('ANTI-FABRICAÇÃO: descarta qualquer "fato usado" que não exista no sourceFacts real', async () => {
    const inventingJson = JSON.stringify({
      draftTitle: 'x',
      draftBody: 'x',
      usedFacts: ['Lançamento em 15/07', 'Artista ganhou um Grammy'], // fato inventado
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

  it('sem sourceFacts: escreve genérico, usedFacts vazio', async () => {
    const skillRun = makeSkillRun();
    const ai = makeAi(VALID_JSON); // modelo tenta reivindicar um fato mesmo sem ter recebido nenhum
    const tasks = makeTasks();
    const ds = makeDs();
    const handler = new CopywritingAutomation(ds as never, skillRun as never, ai as never, tasks as never);

    const result = await handler.run('t1', 'u1', 'task-1', undefined, undefined);

    expect(result.parsed.usedFacts).toEqual([]);
    const aiCalls = ai.complete.mock.calls as unknown as Array<[{ prompt: string }]>;
    expect(aiCalls[0][0].prompt).toContain('Nenhum fato específico foi fornecido');
  });

  it('kind não mapeado: usa intent general_draft', async () => {
    const skillRun = makeSkillRun();
    const ai = makeAi(VALID_JSON);
    const tasks = makeTasks();
    const ds = makeDs([{ ...TASK_ROW, kind: 'outro-tipo-qualquer' }]);
    const handler = new CopywritingAutomation(ds as never, skillRun as never, ai as never, tasks as never);

    await handler.run('t1', 'u1', 'task-1', undefined, undefined);

    const aiCalls = ai.complete.mock.calls as unknown as Array<[{ prompt: string }]>;
    expect(aiCalls[0][0].prompt).toContain('rascunho de texto genérico');
  });

  it('falha da IA registra fail e relança', async () => {
    const skillRun = makeSkillRun();
    const ai = makeFailingAi();
    const tasks = makeTasks();
    const ds = makeDs();
    const handler = new CopywritingAutomation(ds as never, skillRun as never, ai as never, tasks as never);

    await expect(handler.run('t1', 'u1', 'task-1', undefined, undefined)).rejects.toThrow('Nenhum provider de AI configurado');
    expect(skillRun.fail).toHaveBeenCalledWith('run-1', 't1', 'copywriting', expect.any(Error));
  });
});
