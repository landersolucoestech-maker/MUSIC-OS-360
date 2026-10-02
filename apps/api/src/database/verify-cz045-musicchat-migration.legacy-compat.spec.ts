import { CanonicalizeMusicChatValuesToEnglish20260928000026 as Migration } from './migrations/20260928000026_CanonicalizeMusicChatValuesToEnglish';

// The opt-in script (scripts/verify-cz045-musicchat-migration.ts) inserts legacy rows into a disposable
// database; here the real migration runs against a recording runner and the maps it sends are asserted.
async function run(direction: 'up' | 'down'): Promise<Record<string, string>[]> {
  const params: unknown[][] = [];
  const query = jest.fn(async (sql: string, p?: unknown[]) => {
    if (sql.includes('rolbypassrls')) return [{ bypass: true }];
    if (p) params.push(p);
    return [];
  });
  await new Migration()[direction]({ query } as never);
  const maps: Record<string, string>[] = [];
  for (const p of params) for (const v of p) if (typeof v === 'string' && v.startsWith('{')) maps.push(JSON.parse(v));
  return maps;
}

const STATUS: Array<[string, string]> = [
  ['nova', 'new'], ['aguardando_atendimento', 'waiting_agent'], ['em_atendimento', 'in_progress'],
  ['aguardando_cliente', 'waiting_customer'], ['resolvida', 'resolved'], ['arquivada', 'archived'],
];
const PRIORITY: Array<[string, string]> = [['baixa', 'low'], ['media', 'medium'], ['alta', 'high'], ['critica', 'critical']];
const OPTIONS: Array<[string, string]> = [
  ['producao', 'music_production'], ['editora', 'publishing_distribution'], ['financeiro', 'finance'],
  ['conteudo', 'content'], ['outros', 'other'], ['engano', 'wrong_contact'],
];

describe('CZ-045 MusicChat migration legacy values (legacy in, canonical out)', () => {
  it('up() sends legacy -> canonical maps for status, priority and menu option ids', async () => {
    const maps = await run('up');
    for (const group of [STATUS, PRIORITY, OPTIONS]) {
      expect(maps).toContainEqual(Object.fromEntries(group));
    }
  });

  it('down() sends the inverted maps (canonical -> legacy)', async () => {
    const maps = await run('down');
    for (const group of [STATUS, PRIORITY, OPTIONS]) {
      expect(maps).toContainEqual(Object.fromEntries(group.map(([l, c]) => [c, l])));
    }
  });
});
