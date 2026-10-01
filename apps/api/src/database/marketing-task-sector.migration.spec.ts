import {
  BackfillMarketingTaskSectorToEnglish20260930000029 as Migration,
  MARKETING_TASK_SECTOR_BACKFILL_MAPS,
  canonicalMarketingTaskSectorMetadataForBackfill,
} from './migrations/20260930000029_BackfillMarketingTaskSectorToEnglish';
import { ALL_MIGRATIONS } from './migrations';
import { LEGACY_MARKETING_AUTOMATION_FLOW_IDS, LEGACY_MARKETING_SECTORS } from '../modules/marketing/marketing-vocabulary';
import { fakeRunner, makeFakeDb, type Row } from './jsonb-row-backfill.fake';

const ID = (n: number) => `00000000-0000-0000-0000-0000000000${String(n).padStart(2, '0')}`;
const isCandidate = (_t: string, r: Row) => {
  const m = (r['metadata'] ?? {}) as Record<string, any>;
  return m.sector in LEGACY_MARKETING_SECTORS || m.automationFlowId in LEGACY_MARKETING_AUTOMATION_FLOW_IDS;
};

const dataset = () => ({
  marketing_tasks: [
    { id: ID(1), tenant_id: 't', kind: 'cover', updated_at: 'U1', metadata: { sector: 'Comunicação', automationFlowId: 'flow-lancamento', title: 'Comunicação', owner: 'Ana' } },
    { id: ID(2), tenant_id: 't', kind: 'cover', updated_at: 'U2', metadata: { sector: 'Distribuição Digital' } },
    { id: ID(3), tenant_id: 't', kind: 'cover', updated_at: 'U3', metadata: { sector: 'design', automationFlowId: 'flow-event' } },
    { id: ID(4), tenant_id: 't', kind: 'cover', updated_at: 'U4', metadata: { sector: 'Meu setor' } }, // tenant text
    { id: ID(5), tenant_id: 't', kind: 'cover', updated_at: 'U5', metadata: { sector: 'design ' } }, // not exact
    { id: ID(6), tenant_id: 't', kind: 'cover', updated_at: 'U6', metadata: {} },
  ] as Array<Record<string, any>>,
});

describe('BackfillMarketingTaskSectorToEnglish20260930000029', () => {
  const migration = new Migration();
  beforeEach(() => jest.spyOn(console, 'log').mockImplementation(() => undefined));
  afterEach(() => jest.restoreAllMocks());

  it('is registered and its frozen maps equal the application maps', () => {
    expect(ALL_MIGRATIONS).toContain(Migration);
    expect(MARKETING_TASK_SECTOR_BACKFILL_MAPS).toEqual({ SECTOR: LEGACY_MARKETING_SECTORS, FLOW_ID: LEGACY_MARKETING_AUTOMATION_FLOW_IDS });
  });

  it.each(['up', 'down'] as const)('%s() stops at the RLS-bypass guard before any other SQL', async (direction) => {
    const db = makeFakeDb(dataset() as never, { bypass: false });
    await expect(migration[direction](fakeRunner(db) as never)).rejects.toThrow(/BYPASSRLS/);
    expect(db.statements).toHaveLength(1);
  });

  it('rewrites exact platform sector labels and flow ids only; user text and every other key stay', async () => {
    const tables = dataset();
    const db = makeFakeDb(tables as never);
    await migration.up(fakeRunner(db, isCandidate) as never);
    const t = tables.marketing_tasks;
    expect(t[0].metadata).toEqual({ sector: 'communication', automationFlowId: 'flow-music-release', title: 'Comunicação', owner: 'Ana' });
    expect(t[1].metadata).toEqual({ sector: 'digital_distribution' });
    expect(t[2].metadata).toEqual({ sector: 'design', automationFlowId: 'flow-event' });
    expect(t[3].metadata).toEqual({ sector: 'Meu setor' });
    expect(t[4].metadata).toEqual({ sector: 'design ' });
    for (const row of t) expect(String(row['updated_at'])).toMatch(/^U/);
    for (const s of db.statements) expect(s.sql).not.toMatch(/updated_at|DROP |DELETE |TRUNCATE|ADD CONSTRAINT/i);
    expect(db.log.map((l) => l.id).sort()).toEqual([ID(1), ID(2)]);
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
    tables.marketing_tasks[1].metadata = { sector: 'digital_distribution', edited: true };
    await migration.down(runner as never);
    expect(tables.marketing_tasks[0]).toEqual(original.marketing_tasks[0]);
    expect(tables.marketing_tasks[1].metadata.edited).toBe(true);
    for (const [line] of (console.log as unknown as jest.Mock).mock.calls) expect(String(line)).not.toMatch(/Comunicação|flow-lancamento|Distribuição/);
  });

  it('transform returns null for canonical, non-object and unrelated metadata', () => {
    expect(canonicalMarketingTaskSectorMetadataForBackfill(null)).toBeNull();
    expect(canonicalMarketingTaskSectorMetadataForBackfill({ sector: 'communication' })).toBeNull();
    expect(canonicalMarketingTaskSectorMetadataForBackfill({ sector: 5 })).toBeNull();
  });
});
