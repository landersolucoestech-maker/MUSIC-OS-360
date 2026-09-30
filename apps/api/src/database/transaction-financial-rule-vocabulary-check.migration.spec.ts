import { ValidateTransactionTypeAndRestrictFinancialRuleVocabulary20260930000011 as Migration } from './migrations/20260930000011_ValidateTransactionTypeAndRestrictFinancialRuleVocabulary';
import { ALL_MIGRATIONS } from './migrations';
import { TRANSACTION_TYPES } from '../modules/transactions/transaction-legacy-fields';
import { CALCULATION_METHODS, RULE_TYPES } from '../modules/financial-rules/financial-rule-legacy.mapper';

type Call = { sql: string; params?: unknown[] };

function runner(opts: { bypass?: boolean; invalid?: Record<string, string[]> } = {}) {
  const calls: Call[] = [];
  const query = jest.fn(async (sql: string, params?: unknown[]) => {
    calls.push({ sql, params });
    if (sql.includes('rolbypassrls')) return [{ bypass: opts.bypass ?? true }];
    if (sql.includes('SELECT DISTINCT')) {
      const key = `${/FROM "(\w+)"/.exec(sql)![1]}.${/SELECT DISTINCT "(\w+)"/.exec(sql)![1]}`;
      return (opts.invalid?.[key] ?? []).map((value) => ({ value }));
    }
    return [];
  });
  return { query, calls };
}

const quotedList = (sql: string) => [...(/IN \(([^)]*)\)/.exec(sql)?.[1] ?? '').matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);

describe('ValidateTransactionTypeAndRestrictFinancialRuleVocabulary20260930000011', () => {
  const migration = new Migration();

  beforeEach(() => jest.spyOn(console, 'log').mockImplementation(() => undefined));
  afterEach(() => jest.restoreAllMocks());

  it('is registered in ALL_MIGRATIONS', () => {
    expect(ALL_MIGRATIONS).toContain(Migration);
  });

  it.each(['up', 'down'] as const)('%s() stops at the RLS-bypass guard before any other SQL', async (direction) => {
    const { query } = runner({ bypass: false });
    await expect(migration[direction]({ query } as never)).rejects.toThrow(/BYPASSRLS/);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('up() audits first, then adds the missing constraints NOT VALID, then validates all of them', async () => {
    const { query, calls } = runner();
    await migration.up({ query } as never);
    const audits = calls.map((c, i) => [c, i] as const).filter(([c]) => c.sql.includes('SELECT DISTINCT')).map(([, i]) => i);
    const adds = calls.map((c, i) => [c, i] as const).filter(([c]) => c.sql.includes('ADD CONSTRAINT')).map(([, i]) => i);
    const validates = calls.map((c, i) => [c, i] as const).filter(([c]) => c.sql.includes('VALIDATE CONSTRAINT')).map(([, i]) => i);
    expect(audits).toHaveLength(3);
    expect(adds).toHaveLength(3);
    expect(validates).toHaveLength(3);
    expect(Math.max(...audits)).toBeLessThan(Math.min(...adds));
    expect(Math.max(...adds)).toBeLessThan(Math.min(...validates));
    for (const i of adds) expect(calls[i].sql).toContain('NOT VALID');
    for (const c of calls) expect(c.sql).not.toMatch(/^\s*UPDATE|DELETE/);
  });

  it('the constraints allow exactly the vocabularies the writers produce', async () => {
    const { query, calls } = runner();
    await migration.up({ query } as never);
    const add = (name: string) => quotedList(calls.find((c) => c.sql.includes(`ADD CONSTRAINT "${name}"`))!.sql).sort();
    expect(add('chk_transactions_type')).toEqual([...TRANSACTION_TYPES].sort());
    expect(add('chk_financial_rules_type')).toEqual([...RULE_TYPES].sort());
    expect(add('chk_financial_rules_calculation_method')).toEqual([...CALCULATION_METHODS].sort());
  });

  it.each([
    ['transactions.type', ['income']],
    ['financial_rules.type', ['imposto']],
    ['financial_rules.calculation_method', ['percentual']],
  ])('up() aborts, listing the values, when %s holds an unexpected value (no constraint is touched)', async (key, values) => {
    const { query, calls } = runner({ invalid: { [key]: values } });
    await expect(migration.up({ query } as never)).rejects.toThrow(new RegExp(`${key.split('.')[1]}.*\\[${values[0]}\\]`));
    expect(calls.some((c) => c.sql.includes('ADD CONSTRAINT') || c.sql.includes('VALIDATE CONSTRAINT'))).toBe(false);
  });

  it('up() abort message is bounded: at most 20 values, each truncated to 40 characters', async () => {
    const many = Array.from({ length: 21 }, (_, i) => `v${i}-${'y'.repeat(100)}`);
    const { query, calls } = runner({ invalid: { 'financial_rules.type': many } });
    const error = await migration.up({ query } as never).then(() => null, (e: Error) => e);
    const listed = /\[(.*)\]/s.exec(error!.message)![1];
    expect(listed.split(', ').filter((v) => v.startsWith('v'))).toHaveLength(20);
    expect(listed).not.toContain('y'.repeat(41));
    expect(calls.find((c) => c.sql.includes('SELECT DISTINCT'))!.sql).toContain('LIMIT 21');
  });

  it('down() drops the financial_rules constraints and restores chk_transactions_type as NOT VALID', async () => {
    const { query, calls } = runner();
    await migration.down({ query } as never);
    const drops = calls.filter((c) => c.sql.includes('DROP CONSTRAINT')).map((c) => /"(chk_\w+)"/.exec(c.sql)![1]);
    expect(drops.sort()).toEqual(['chk_financial_rules_calculation_method', 'chk_financial_rules_type', 'chk_transactions_type']);
    const readd = calls.filter((c) => c.sql.includes('ADD CONSTRAINT'));
    expect(readd).toHaveLength(1);
    expect(readd[0].sql).toContain('chk_transactions_type');
    expect(readd[0].sql).toContain('NOT VALID');
    expect(calls.some((c) => c.sql.includes('VALIDATE CONSTRAINT'))).toBe(false);
  });
});
