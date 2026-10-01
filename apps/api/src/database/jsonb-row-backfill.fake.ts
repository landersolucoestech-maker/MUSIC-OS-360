/**
 * In-memory stand-in for the QueryRunner used by the PJ1 backfill migration specs
 * (no database is available to the unit tests). It understands exactly the SQL
 * shapes emitted by jsonb-row-backfill.ts: candidate SELECT (the predicate is
 * evaluated by the supplied `isCandidate`), side-table INSERT / SELECT, guarded
 * UPDATE ... RETURNING, plus the RLS-bypass probe and DDL (recorded only).
 */
export type Row = Record<string, unknown>;

export interface FakeDb {
  tables: Record<string, Row[]>;
  log: Array<{ table_name: string; id: string; tenant_id: string; before: Row; after: Row }>;
  statements: Array<{ sql: string; params?: unknown[] }>;
  bypass: boolean;
  logTablePresent: boolean;
}

export function makeFakeDb(tables: Record<string, Row[]>, opts: { bypass?: boolean } = {}): FakeDb {
  return { tables, log: [], statements: [], bypass: opts.bypass ?? true, logTablePresent: false };
}

const clone = <T>(v: T): T => (v === undefined ? v : (JSON.parse(JSON.stringify(v)) as T));
const eq = (a: unknown, b: unknown): boolean => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

export function fakeRunner(db: FakeDb, isCandidate: (table: string, row: Row) => boolean = () => true) {
  const query = async (sql: string, params: unknown[] = []): Promise<unknown> => {
    db.statements.push({ sql, params });
    if (sql.includes('rolbypassrls')) return [{ bypass: db.bypass }];
    if (sql.startsWith('SELECT to_regclass')) return [{ present: db.logTablePresent }];
    if (/^\s*CREATE TABLE IF NOT EXISTS/.test(sql)) {
      db.logTablePresent = true;
      return [];
    }
    const select = /^SELECT (.+) FROM "(\w+)" WHERE \((.*)\) AND "id" > \$1 ORDER BY "id" LIMIT (\d+)/s.exec(sql);
    if (select) {
      const [, cols, table, , limit] = select;
      // last quoted identifier of each select item ("id", `expr AS "tenant_id"`, "metadata", ...)
      const names = cols.split(/,\s*(?=["'(])/).map((item) => [...item.matchAll(/"(\w+)"/g)].pop()![1]);
      return db.tables[table]
        .filter((r) => String(r['id']) > String(params[0]) && isCandidate(table, r))
        .sort((a, b) => String(a['id']).localeCompare(String(b['id'])))
        .slice(0, Number(limit))
        .map((r) => Object.fromEntries(names.map((n) => [n, clone(n === 'tenant_id' && r[n] === undefined ? r['id'] : r[n])])));
    }
    if (sql.startsWith('SELECT "id", "before", "after" FROM')) {
      return db.log.filter((l) => l.table_name === params[0]).map((l) => ({ id: l.id, before: clone(l.before), after: clone(l.after) }));
    }
    if (sql.includes('INSERT INTO') && sql.includes('"before", "after"')) {
      const [table_name, id, tenant_id, before, after] = params as string[];
      if (!db.log.some((l) => l.table_name === table_name && l.id === id)) {
        db.log.push({ table_name, id, tenant_id, before: JSON.parse(before) as Row, after: JSON.parse(after) as Row });
      }
      return [];
    }
    const update = /^UPDATE "(\w+)" SET (.+) WHERE "id" = \$1 AND (.+) RETURNING "id"/s.exec(sql);
    if (update) {
      const [, table, sets, guards] = update;
      const row = db.tables[table].find((r) => r['id'] === params[0]);
      if (!row) return [];
      const parse = (v: unknown, jsonb: boolean) => (jsonb && typeof v === 'string' ? (JSON.parse(v) as unknown) : v);
      const guardOk = [...guards.matchAll(/"(\w+)" (?:= \$(\d+)(::jsonb)|IS NOT DISTINCT FROM \$(\d+))/g)].every((m) => {
        const column = m[1];
        const n = Number(m[2] ?? m[4]);
        return eq(row[column], parse(params[n - 1], Boolean(m[3])));
      });
      if (!guardOk) return [];
      for (const m of sets.matchAll(/"(\w+)" = \$(\d+)(::jsonb)?/g)) row[m[1]] = clone(parse(params[Number(m[2]) - 1], Boolean(m[3])));
      return [{ id: row['id'] }];
    }
    return [];
  };
  return { query };
}
