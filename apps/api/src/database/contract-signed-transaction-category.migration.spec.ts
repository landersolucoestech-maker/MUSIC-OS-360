import {
  BackfillContractSignedTransactionCategoryToContractualRevenue20260930000035 as Migration,
  CONTRACT_SIGNED_CATEGORY_BACKFILL,
} from './migrations/20260930000035_BackfillContractSignedTransactionCategoryToContractualRevenue';
import { ALL_MIGRATIONS } from './migrations';
import { CANONICAL_TRANSACTION_CATEGORY_SLUGS } from '../modules/transactions/transaction-category-slugs';
import { fakeRunner, makeFakeDb, type Row } from '../../test/helpers/jsonb-row-backfill.fake';

const ID = (n: number) => `00000000-0000-0000-0000-0000000000${String(n).padStart(2, '0')}`;
const isCandidate = (_t: string, r: Row) =>
  ['contratos', 'contracts'].includes(String(r['category'])) && (r['metadata'] as Record<string, unknown> | undefined)?.['source'] === 'contract.signed';

const dataset = () => ({
  transactions: [
    { id: ID(1), tenant_id: 't', category: 'contratos', metadata: { source: 'contract.signed', contractId: 'c1' }, updated_at: 'U1' },
    { id: ID(2), tenant_id: 't', category: 'contracts', metadata: { source: 'contract.signed', contractId: 'c2' }, updated_at: 'U2' },
    { id: ID(3), tenant_id: 't', category: 'contracts', metadata: {}, updated_at: 'U3' }, // typed by a tenant: no provenance
    { id: ID(4), tenant_id: 't', category: 'contracts', metadata: { source: 'import' }, updated_at: 'U4' },
    { id: ID(5), tenant_id: 't', category: 'contractual_revenue', metadata: { source: 'contract.signed' }, updated_at: 'U5' },
    { id: ID(6), tenant_id: 't', category: 'Contratos', metadata: { source: 'contract.signed' }, updated_at: 'U6' }, // not exact
  ] as Array<Record<string, any>>,
});

describe('BackfillContractSignedTransactionCategoryToContractualRevenue20260930000035', () => {
  const migration = new Migration();
  beforeEach(() => jest.spyOn(console, 'log').mockImplementation(() => undefined));
  afterEach(() => jest.restoreAllMocks());

  it('is registered and targets a category of the canonical transaction taxonomy', () => {
    expect(ALL_MIGRATIONS).toContain(Migration);
    expect(CANONICAL_TRANSACTION_CATEGORY_SLUGS).toContain(CONTRACT_SIGNED_CATEGORY_BACKFILL.CANONICAL_CATEGORY);
  });

  it('selects candidates by value AND the handler provenance stamp in SQL', async () => {
    const db = makeFakeDb(dataset() as never);
    await migration.up(fakeRunner(db, isCandidate) as never);
    const select = db.statements.find((s) => /^SELECT .* FROM "transactions"/s.test(s.sql))!.sql;
    expect(select).toContain(`"category" IN ('contratos', 'contracts')`);
    expect(select).toContain(`("metadata" ->> 'source') = 'contract.signed'`);
  });

  it.each(['up', 'down'] as const)('%s() stops at the RLS-bypass guard before any other SQL', async (direction) => {
    const db = makeFakeDb(dataset() as never, { bypass: false });
    await expect(migration[direction](fakeRunner(db) as never)).rejects.toThrow(/BYPASSRLS/);
    expect(db.statements).toHaveLength(1);
  });

  it('rewrites only handler-created rows; tenant-typed, other-source, canonical and non-exact values stay', async () => {
    const tables = dataset();
    const db = makeFakeDb(tables as never);
    await migration.up(fakeRunner(db, isCandidate) as never);
    expect(tables.transactions.map((t) => t['category'])).toEqual(['contractual_revenue', 'contractual_revenue', 'contracts', 'contracts', 'contractual_revenue', 'Contratos']);
    for (const row of tables.transactions) expect(String(row['updated_at'])).toMatch(/^U/);
    for (const s of db.statements) expect(s.sql).not.toMatch(/updated_at|DROP |DELETE |TRUNCATE|ADD CONSTRAINT/i);
    expect(db.log.map((l) => l.id).sort()).toEqual([ID(1), ID(2)]);
  });

  it('is idempotent; down() restores untouched rows only, exactly (both legacy spellings)', async () => {
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
    expect(tables.transactions).toEqual(original.transactions);
    await migration.up(runner as never);
    tables.transactions[1]['category'] = 'services';
    await migration.down(runner as never);
    expect(tables.transactions[1]['category']).toBe('services');
    expect(tables.transactions[0]['category']).toBe('contratos');
    for (const [line] of (console.log as unknown as jest.Mock).mock.calls) expect(String(line)).not.toMatch(/contratos|\bcontracts\b/);
  });
});
