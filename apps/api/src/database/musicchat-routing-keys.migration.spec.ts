import {
  BackfillMusicChatRoutingKeys20261005100001 as Migration,
  MUSICCHAT_ROUTING_KEYS_BACKFILL_MAPS,
  menuOptionsWithRoutingKeysForBackfill,
} from './migrations/20261005100001_BackfillMusicChatRoutingKeys';
import { ALL_MIGRATIONS } from './migrations';
import { LEGACY_QUEUE_LABELS, LEGACY_SECTOR_LABELS } from '../modules/conversations/musicchat-vocabulary';
import { fakeRunner, makeFakeDb, type Row } from '../../test/helpers/jsonb-row-backfill.fake';

const ID = (n: number) => `00000000-0000-0000-0000-0000000000${String(n).padStart(2, '0')}`;
const isCandidate = (_t: string, r: Row) => menuOptionsWithRoutingKeysForBackfill(r['menu_options']) !== null;

const dataset = () => ({
  musicchat_automation_settings: [
    { id: ID(1), tenant_id: 't1', updated_at: 'U1', welcome_message: 'Oi', menu_options: [
      { id: 'shows', order: 1, label: 'Contratação de Shows', queue: 'Comercial', sector: 'Shows', tags: ['Show'], extra: { a: 1 } },
      { id: 'custom', order: 2, label: 'Vendas', queue: 'Vendas', sector: 'Triagem' }, // edited queue label, sector legacy
      'not-an-object',
    ] },
    { id: ID(2), tenant_id: 't2', updated_at: 'U2', menu_options: [{ id: 'x', queue: 'comercial', sector: 'Suporte ' }] }, // no exact match
    { id: ID(3), tenant_id: 't3', updated_at: 'U3', menu_options: [{ id: 'y', queue: 'Atendimento', queueKey: 'my_queue', sector: 'Suporte', sectorKey: null }] },
    { id: ID(4), tenant_id: 't4', updated_at: 'U4', menu_options: [] },
    { id: ID(5), tenant_id: 't5', updated_at: 'U5', menu_options: { not: 'array' } },
    { id: ID(6), tenant_id: 't6', updated_at: 'U6', menu_options: [{ id: 'z', queue: 'constructor', sector: '__proto__' }] },
  ] as Array<Record<string, any>>,
});

describe('BackfillMusicChatRoutingKeys20261005100001', () => {
  const migration = new Migration();
  beforeEach(() => jest.spyOn(console, 'log').mockImplementation(() => undefined));
  afterEach(() => jest.restoreAllMocks());

  it('is registered and its frozen maps equal the application maps', () => {
    expect(ALL_MIGRATIONS).toContain(Migration);
    expect(MUSICCHAT_ROUTING_KEYS_BACKFILL_MAPS).toEqual({ QUEUE: LEGACY_QUEUE_LABELS, SECTOR: LEGACY_SECTOR_LABELS });
  });

  it.each(['up', 'down'] as const)('%s() stops at the RLS-bypass guard before any other SQL', async (direction) => {
    const db = makeFakeDb(dataset() as never, { bypass: false });
    await expect(migration[direction](fakeRunner(db) as never)).rejects.toThrow(/BYPASSRLS/);
    expect(db.statements).toHaveLength(1);
  });

  it('adds keys by exact legacy label only; edited labels, existing keys, prototype names and other jsonb keys stay', async () => {
    const tables = dataset();
    const db = makeFakeDb(tables as never);
    await migration.up(fakeRunner(db, isCandidate) as never);
    const t = tables.musicchat_automation_settings;
    expect(t[0].menu_options).toEqual([
      { id: 'shows', order: 1, label: 'Contratação de Shows', queue: 'Comercial', queueKey: 'commercial', sector: 'Shows', sectorKey: 'shows', tags: ['Show'], extra: { a: 1 } },
      { id: 'custom', order: 2, label: 'Vendas', queue: 'Vendas', sector: 'Triagem', sectorKey: 'triage' },
      'not-an-object',
    ]);
    expect(t[0].welcome_message).toBe('Oi');
    expect(t[1].menu_options).toEqual([{ id: 'x', queue: 'comercial', sector: 'Suporte ' }]);
    expect(t[2].menu_options).toEqual([{ id: 'y', queue: 'Atendimento', queueKey: 'my_queue', sector: 'Suporte', sectorKey: 'support' }]);
    expect(t[3].menu_options).toEqual([]);
    expect(t[4].menu_options).toEqual({ not: 'array' });
    expect(t[5].menu_options).toEqual([{ id: 'z', queue: 'constructor', sector: '__proto__' }]);
    for (const row of t) expect(String(row['updated_at'])).toMatch(/^U/);
    for (const s of db.statements) expect(s.sql).not.toMatch(/updated_at|DROP |DELETE |TRUNCATE|ADD CONSTRAINT/i);
    expect(db.log.map((l) => l.id).sort()).toEqual([ID(1), ID(3)]);
  });

  it('is idempotent; down() restores untouched rows only; logs are counts only', async () => {
    const tables = dataset();
    const original = JSON.parse(JSON.stringify(tables)) as typeof tables;
    const db = makeFakeDb(tables as never);
    const runner = fakeRunner(db, isCandidate);
    await migration.up(runner as never);
    const writes = () => db.statements.filter((s) => s.sql.startsWith('UPDATE ')).length;
    const before = writes();
    await migration.up(runner as never);
    expect(writes()).toBe(before);
    tables.musicchat_automation_settings[2].menu_options = [{ id: 'y', edited: true }];
    await migration.down(runner as never);
    expect(tables.musicchat_automation_settings[0]).toEqual(original.musicchat_automation_settings[0]);
    expect(tables.musicchat_automation_settings[2].menu_options).toEqual([{ id: 'y', edited: true }]);
    for (const [line] of (console.log as unknown as jest.Mock).mock.calls) expect(String(line)).not.toMatch(/Comercial|Vendas|Triagem/);
  });

  it('transform returns null for canonical, non-array and unrelated menu_options', () => {
    expect(menuOptionsWithRoutingKeysForBackfill(null)).toBeNull();
    expect(menuOptionsWithRoutingKeysForBackfill({})).toBeNull();
    expect(menuOptionsWithRoutingKeysForBackfill([{ queue: 'Comercial', queueKey: 'commercial', sector: 'Shows', sectorKey: 'shows' }])).toBeNull();
  });
});
