import {
  BackfillContractCategorySlugsToEnglish20260930000036 as Migration,
  CONTRACT_CATEGORY_SLUG_BACKFILL,
} from './migrations/20260930000036_BackfillContractCategorySlugsToEnglish';
import { ALL_MIGRATIONS } from './migrations';
import { CONTRACT_TYPE_BACKFILL } from './migrations/20260930000034_BackfillContractTypeOutroToOther';
import { CANONICAL_CONTRACT_CATEGORY_SLUGS, LEGACY_CONTRACT_CATEGORY_SLUGS } from '../modules/contracts/contract-category-slugs';
import { fakeRunner, makeFakeDb, type Row } from '../../test/helpers/jsonb-row-backfill.fake';

const { LEGACY_TO_CANONICAL, LOG_TABLE } = CONTRACT_CATEGORY_SLUG_BACKFILL;
const LEGACY = Object.keys(LEGACY_TO_CANONICAL);
const ID = (prefix: string, n: number) => `${prefix}000000-0000-0000-0000-0000000000${String(n).padStart(2, '0')}`;
const COLUMN: Record<string, string> = { contracts: 'type', contract_templates: 'service_type' };
const isCandidate = (table: string, r: Row) => LEGACY.includes(String(r[COLUMN[table]]));

/** One row per platform legacy slug in each table, plus the values that must never be touched. */
const dataset = () => ({
  contracts: [
    ...LEGACY.map((slug, i) => ({ id: ID('aaaa', i), tenant_id: 't', title: `c${i}`, type: slug, updated_at: `U${i}` })),
    { id: ID('aaaa', 50), tenant_id: 't', title: 'canonical', type: 'distribution', updated_at: 'U50' },
    { id: ID('aaaa', 51), tenant_id: 't', title: 'tenant slug', type: 'tenant_authored_slug', updated_at: 'U51' },
    { id: ID('aaaa', 52), tenant_id: 't', title: 'not exact', type: `${LEGACY[0]} `, updated_at: 'U52' },
  ] as Array<Record<string, any>>,
  contract_templates: [
    ...LEGACY.map((slug, i) => ({ id: ID('bbbb', i), tenant_id: 't', name: `t${i}`, service_type: slug, updated_at: `V${i}` })),
    { id: ID('bbbb', 50), tenant_id: 't', name: 'no type', service_type: null, updated_at: 'V50' },
    { id: ID('bbbb', 51), tenant_id: 't', name: 'tenant slug', service_type: 'tenant_authored_slug', updated_at: 'V51' },
  ] as Array<Record<string, any>>,
});

describe('BackfillContractCategorySlugsToEnglish20260930000036', () => {
  const migration = new Migration();
  beforeEach(() => jest.spyOn(console, 'log').mockImplementation(() => undefined));
  afterEach(() => jest.restoreAllMocks());

  it('is registered; its frozen map equals the application map except the singular `outro` (migration 34)', () => {
    expect(ALL_MIGRATIONS).toContain(Migration);
    const platform = Object.fromEntries(
      Object.entries(LEGACY_CONTRACT_CATEGORY_SLUGS as Record<string, string>).filter(([legacy]) => legacy !== CONTRACT_TYPE_BACKFILL.LEGACY_TYPE),
    );
    expect(LEGACY_TO_CANONICAL).toEqual(platform);
    for (const canonical of Object.values(LEGACY_TO_CANONICAL)) expect(CANONICAL_CONTRACT_CATEGORY_SLUGS as readonly string[]).toContain(canonical);
  });

  it.each(['up', 'down'] as const)('%s() stops at the RLS-bypass guard before any other SQL', async (direction) => {
    const db = makeFakeDb(dataset() as never, { bypass: false });
    await expect(migration[direction](fakeRunner(db) as never)).rejects.toThrow(/BYPASSRLS/);
    expect(db.statements).toHaveLength(1);
  });

  it('rewrites the ten platform legacy slugs in contracts.type and contract_templates.service_type, nothing else', async () => {
    const tables = dataset();
    const db = makeFakeDb(tables as never);
    await migration.up(fakeRunner(db, isCandidate) as never);
    const canonical = LEGACY.map((slug) => LEGACY_TO_CANONICAL[slug]);
    expect(tables.contracts.map((c) => c['type'])).toEqual([...canonical, 'distribution', 'tenant_authored_slug', `${LEGACY[0]} `]);
    expect(tables.contract_templates.map((t) => t['service_type'])).toEqual([...canonical, null, 'tenant_authored_slug']);
    for (const row of [...tables.contracts, ...tables.contract_templates]) expect(String(row['updated_at'])).toMatch(/^[UV]/);
    for (const s of db.statements) expect(s.sql).not.toMatch(/updated_at|DROP |DELETE |TRUNCATE|ADD CONSTRAINT/i);
    expect(db.log).toHaveLength(LEGACY.length * 2);
    expect(new Set(db.log.map((l) => l.table_name))).toEqual(new Set(['contracts', 'contract_templates']));
  });

  it('is idempotent; down() restores both tables exactly and never reverts a row edited after up()', async () => {
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
    expect(tables).toEqual(original);
    await migration.up(runner as never);
    tables.contracts[0]['type'] = 'tenant_authored_slug';
    await migration.down(runner as never);
    expect(tables.contracts[0]['type']).toBe('tenant_authored_slug');
    expect(tables.contracts[1]['type']).toBe(LEGACY[1]);
    for (const [line] of (console.log as unknown as jest.Mock).mock.calls) for (const slug of LEGACY) expect(String(line)).not.toContain(slug);
  });

  it('keeps one locked-down side table for both tables', async () => {
    const db = makeFakeDb(dataset() as never);
    await migration.up(fakeRunner(db, isCandidate) as never);
    const create = db.statements.filter((s) => /CREATE TABLE IF NOT EXISTS/.test(s.sql));
    expect(create).toHaveLength(1);
    expect(create[0].sql).toContain(LOG_TABLE);
  });
});
