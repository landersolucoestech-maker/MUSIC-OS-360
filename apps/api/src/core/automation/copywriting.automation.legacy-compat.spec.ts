import 'reflect-metadata';
import { CopywritingAutomation } from './copywriting.automation';

const VALID_JSON = JSON.stringify({ draftTitle: 't', draftBody: 'b', usedFacts: [] });

async function promptForKind(kind: string): Promise<string> {
  const skillRun = {
    start: jest.fn(async () => 'run-1'),
    succeed: jest.fn(async () => undefined),
    fail: jest.fn(async () => undefined),
    findRecentSuccess: jest.fn(async () => null),
  };
  const ai = {
    complete: jest.fn(async () => ({ content: VALID_JSON, provider: 'openai', model: 'm', inputTokens: 1, outputTokens: 1, costUsd: 0, latencyMs: 1 })),
  };
  const tasks = { findById: jest.fn(async () => ({ id: 'task-1' })) };
  const ds = { query: jest.fn(async () => [{ title: 'Titulo', description: null, kind }]) };
  const handler = new CopywritingAutomation(ds as never, skillRun as never, ai as never, tasks as never);
  await handler.run('t1', 'u1', 'task-1', undefined, undefined);
  return (ai.complete.mock.calls as unknown as Array<[{ prompt: string }]>)[0][0].prompt;
}

// Legacy task kind `assessoria` (stored before the English vocabulary) must resolve to the
// canonical `press_release` intent through the real automation.
describe('copywriting task kind legacy alias (legacy in, canonical out)', () => {
  it.each([
    ['assessoria', 'press_release'],
    [' Assessoria ', 'press_release'],
  ])('kind %j resolves to the same intent as %s', async (legacy, canonical) => {
    const legacyPrompt = await promptForKind(legacy);
    expect(legacyPrompt).toBe(await promptForKind(canonical));
    expect(legacyPrompt).not.toBe(await promptForKind('unmapped_kind_value'));
  });
});
