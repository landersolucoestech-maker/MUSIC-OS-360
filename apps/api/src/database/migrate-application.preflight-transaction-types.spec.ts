import { preflightSchemaChange } from './migrate-application';

/**
 * Behavioral proof of the legacy transactions.type literals in the preflight SQL of migrate-application.ts
 * (`receita`, `despesa`, `investimento`, `imposto`, `transferencia`, the Portuguese values kept valid by chk_transactions_type).
 * preflightSchemaChange runs for real; only the database round trip is replaced by a double that CAPTURES the SQL text and
 * evaluates its `lower("type") NOT IN (...)` predicate (taken from the SQL itself, so removing/renaming a literal in the source changes
 * the outcome) against fixture rows. The same captured SQL is also executed on a real PostgreSQL when PG_INTEGRATION_URL is set
 * (TEMP table only; nothing in a real schema is created or altered).
 */
const LEGACY = ['receita', 'despesa', 'investimento', 'imposto', 'transferencia'] as const;
const CANONICAL = ['revenue', 'expense', 'investment', 'tax', 'transfer'] as const;

type Tx = { type: string | null };

function typesSql(captured: string[]): string {
  const sql = captured.find((s) => /FROM "transactions"/.test(s));
  if (!sql) throw new Error('the preflight did not query transactions');
  return sql;
}

/** Evaluates `WHERE lower("type") NOT IN (<list>) GROUP BY 1` as written in the SQL text. */
function evalTypesQuery(sql: string, rows: Tx[]): Array<{ type: string | null; count: string }> {
  const m = /lower\("type"\)\s+NOT IN\s*\(([^)]*)\)/.exec(sql);
  if (!m) throw new Error(`unexpected predicate in: ${sql}`);
  const list = new Set([...m[1].matchAll(/'([^']*)'/g)].map((x) => x[1]));
  const groups = new Map<string | null, number>();
  for (const r of rows) {
    // SQL three-valued logic: lower(NULL) NOT IN (...) is NULL, so the row is not selected
    if (r.type === null) continue;
    if (!list.has(r.type.toLowerCase())) groups.set(r.type, (groups.get(r.type) ?? 0) + 1);
  }
  return [...groups].map(([type, n]) => ({ type, count: String(n) }));
}

function fakeDataSource(rows: Tx[], captured: string[]) {
  const query = jest.fn(async (sql: string) => {
    captured.push(sql);
    if (/pg_roles/.test(sql)) return [{ bypass: true }];
    if (/FROM "transactions"/.test(sql)) return evalTypesQuery(sql, rows);
    return [];
  });
  const queryRunner = {
    release: jest.fn(async () => undefined),
    hasTable: jest.fn(async () => true),
    query,
    connection: undefined as unknown,
  };
  const ds = {
    query,
    migrations: [],
    options: { type: 'postgres', migrationsTableName: 'migrations' },
    createQueryRunner: () => queryRunner,
    driver: {},
    logger: { logSchemaBuild: jest.fn() },
  };
  queryRunner.connection = ds;
  return ds;
}

async function run(rows: Tx[]) {
  const captured: string[] = [];
  const result = await preflightSchemaChange(fakeDataSource(rows, captured) as never, 'rollback');
  return { result, captured };
}

describe('preflightSchemaChange: legacy transactions.type literals are mapped, anything else warns', () => {
  it.each(LEGACY)('legacy value %s (and its upper/mixed-case form) is accepted: no warning', async (legacy) => {
    const upper = legacy.toUpperCase();
    const mixed = legacy[0].toUpperCase() + legacy.slice(1);
    const { result } = await run([{ type: legacy }, { type: upper }, { type: mixed }]);
    expect(result.warnings).toEqual([]);
    expect(result.blocking).toEqual([]);
  });

  it.each(CANONICAL)('canonical value %s is accepted: no warning', async (canonical) => {
    expect((await run([{ type: canonical }])).result.warnings).toEqual([]);
  });

  it.each(LEGACY)('near-miss of %s is NOT accepted: it is reported with its count', async (legacy) => {
    const nearMisses = [`${legacy}s`, legacy.slice(0, -1), `${legacy} `, `x${legacy}`];
    for (const near of nearMisses) {
      const { result } = await run([{ type: near }, { type: near }]);
      expect(result.warnings).toEqual([
        `transactions with an unmapped type (chk_transactions_type is NOT VALID; they fail on their next UPDATE): ${near}=2`,
      ]);
    }
  });

  it('mixed table: only the unmapped legacy-looking values are reported', async () => {
    const rows: Tx[] = [...LEGACY.map((t) => ({ type: t })), ...CANONICAL.map((t) => ({ type: t })), { type: 'despesas' }, { type: 'income' }, { type: null }];
    const { result } = await run(rows);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain('despesas=1');
    expect(result.warnings[0]).toContain('income=1');
    for (const ok of [...LEGACY, ...CANONICAL]) expect(result.warnings[0]).not.toMatch(new RegExp(`(^|[ :])${ok}=`));
  });

  it('the SQL text carries every legacy literal exactly once, quoted, in the NOT IN list', async () => {
    const { captured } = await run([]);
    const m = /NOT IN\s*\(([^)]*)\)/.exec(typesSql(captured));
    const list = [...(m as RegExpExecArray)[1].matchAll(/'([^']*)'/g)].map((x) => x[1]);
    expect([...list].sort()).toEqual([...LEGACY, ...CANONICAL].sort());
  });
});

const pgUrl = process.env.PG_INTEGRATION_URL;
(pgUrl ? describe : describe.skip)('preflight transactions.type SQL on a real PostgreSQL (TEMP table, no schema change)', () => {
  it('executes the captured SQL: legacy and canonical types pass, near-misses are grouped', async () => {
    const { Client } = await import('pg');
    const { captured } = await run([]);
    const sql = typesSql(captured);
    const c = new Client({ connectionString: pgUrl });
    await c.connect();
    try {
      await c.query('CREATE TEMP TABLE transactions ("type" text)');
      const values = [...LEGACY, ...CANONICAL, 'DESPESA', 'despesas', 'income'];
      await c.query('INSERT INTO transactions ("type") SELECT unnest($1::text[])', [values]);
      const { rows } = await c.query(sql);
      expect(rows.map((r: { type: string }) => r.type).sort()).toEqual(['despesas', 'income']);
    } finally {
      await c.end();
    }
  });
});
