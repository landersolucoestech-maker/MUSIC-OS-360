import { BackfillContractTypeOutroToOther20260930000034 as Migration, CONTRACT_TYPE_BACKFILL } from './migrations/20260930000034_BackfillContractTypeOutroToOther';
import { ALL_MIGRATIONS } from './migrations';
import { LEGACY_CONTRACT_CATEGORY_SLUGS, CANONICAL_CONTRACT_CATEGORY_SLUGS } from '../modules/contracts/contract-category-slugs';
import { fakeRunner, makeFakeDb, type Row } from '../../test/helpers/jsonb-row-backfill.fake';

const ID = (n: number) => `00000000-0000-0000-0000-0000000000${String(n).padStart(2, '0')}`;
const isCandidate = (_t: string, r: Row) => r['type'] === 'outro';

const dataset = () => ({
  contracts: [
    { id: ID(1), tenant_id: 't', title: 'A', type: 'outro', updated_at: 'U1' },
    { id: ID(2), tenant_id: 't', title: 'B', type: 'outros', updated_at: 'U2' }, // platform legacy alias: not this migration
    { id: ID(3), tenant_id: 't', title: 'C', type: 'other', updated_at: 'U3' },
    { id: ID(4), tenant_id: 't', title: 'D', type: 'Outro', updated_at: 'U4' }, // not exact
    { id: ID(5), tenant_id: 't', title: 'E', type: 'parceria', updated_at: 'U5' }, // tenant-authored slug
  ] as Array<Record<string, any>>,
});

describe('BackfillContractTypeOutroToOther20260930000034', () => {
  const migration = new Migration();
  beforeEach(() => jest.spyOn(console, 'log').mockImplementation(() => undefined));
  afterEach(() => jest.restoreAllMocks());

  it('is registered, and the target is the canonical slug that the application maps the legacy spelling to', () => {
    expect(ALL_MIGRATIONS).toContain(Migration);
    expect(LEGACY_CONTRACT_CATEGORY_SLUGS[CONTRACT_TYPE_BACKFILL.LEGACY_TYPE]).toBe(CONTRACT_TYPE_BACKFILL.CANONICAL_TYPE);
    expect(CANONICAL_CONTRACT_CATEGORY_SLUGS).toContain(CONTRACT_TYPE_BACKFILL.CANONICAL_TYPE);
  });

  it.each(['up', 'down'] as const)('%s() stops at the RLS-bypass guard before any other SQL', async (direction) => {
    const db = makeFakeDb(dataset() as never, { bypass: false });
    await expect(migration[direction](fakeRunner(db) as never)).rejects.toThrow(/BYPASSRLS/);
    expect(db.statements).toHaveLength(1);
  });

  it('rewrites the exact singular `outro` only; platform aliases, canonical values and tenant slugs stay', async () => {
    const tables = dataset();
    const db = makeFakeDb(tables as never);
    await migration.up(fakeRunner(db, isCandidate) as never);
    expect(tables.contracts.map((c) => c['type'])).toEqual(['other', 'outros', 'other', 'Outro', 'parceria']);
    for (const row of tables.contracts) expect(String(row['updated_at'])).toMatch(/^U/);
    for (const s of db.statements) expect(s.sql).not.toMatch(/updated_at|DROP |DELETE |TRUNCATE|ADD CONSTRAINT/i);
    expect(db.log.map((l) => l.id)).toEqual([ID(1)]);
    expect(db.log[0]).toMatchObject({ before: { type: 'outro' }, after: { type: 'other' } });
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
    await migration.down(runner as never);
    expect(tables.contracts).toEqual(original.contracts);
    // a row edited after up() is never reverted
    await migration.up(runner as never);
    tables.contracts[0]['type'] = 'distribution';
    await migration.down(runner as never);
    expect(tables.contracts[0]['type']).toBe('distribution');
    for (const [line] of (console.log as unknown as jest.Mock).mock.calls) expect(String(line)).not.toMatch(/\boutro\b/);
  });
});
