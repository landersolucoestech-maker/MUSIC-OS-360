import * as fs from 'fs';
import * as path from 'path';
import { ALL_MIGRATIONS } from '../migrations';
import {
  CONFIRM_ENV,
  CONFIRM_TOKEN,
  SIDE_TABLES,
  PurgeBackfillSideTables20260930000050 as Draft,
} from './20260930000050_PurgeBackfillSideTables';

/** SEC3 F-MG1 draft guard (docs/engineering/backfill-side-tables-retention.md): never registered, gated, purge only, no archive. */
describe('PurgeBackfillSideTables draft', () => {
  const prev = process.env[CONFIRM_ENV];
  afterEach(() => { if (prev === undefined) delete process.env[CONFIRM_ENV]; else process.env[CONFIRM_ENV] = prev; });

  it('is not registered and migrations/index.ts does not import migration-drafts', () => {
    expect(ALL_MIGRATIONS.some((m) => m.name === Draft.name)).toBe(false);
    const index = fs.readFileSync(path.join(__dirname, '..', 'migrations', 'index.ts'), 'utf8');
    expect(index).not.toContain('migration-drafts');
    expect(index).not.toContain(Draft.name);
    expect(fs.readdirSync(path.join(__dirname, '..', 'migrations')).some((f) => f.startsWith('20260930000050'))).toBe(false);
  });

  it('lists every backfill side table created by the registered migrations', () => {
    const dir = path.join(__dirname, '..', 'migrations');
    const found = new Set<string>();
    for (const file of fs.readdirSync(dir).filter((f) => f.startsWith('20260930') && f.endsWith('.ts'))) {
      for (const m of fs.readFileSync(path.join(dir, file), 'utf8').matchAll(/'([a-z_]+_(?:backfill|backup|conflicts)_20260930)'/g)) found.add(m[1]);
    }
    expect([...found].sort()).toEqual([...SIDE_TABLES].sort());
  });

  describe('docs/engineering/backfill-side-tables-retention.md stays in sync with the draft', () => {
    const doc = fs.readFileSync(path.join(__dirname, '..', '..', '..', '..', '..', 'docs', 'engineering', 'backfill-side-tables-retention.md'), 'utf8');
    const NAME = /[a-z_]+_(?:backfill|backup|conflicts)_20260930/g;
    const section = (from: string, to: string) => doc.slice(doc.indexOf(from), doc.indexOf(to));
    const names = (text: string) => [...new Set(text.match(NAME) ?? [])].sort();

    it('the inventory lists exactly the draft tables (one row each)', () => {
      const rows = section('## Inventory', '## Retention rule').split('\n').filter((l) => l.startsWith('| `'));
      const listed = rows.map((l) => /^\| `([^`]+)`/.exec(l)![1]).filter((n) => /^[a-z_]+_(?:backfill|backup|conflicts)_20260930$/.test(n));
      expect([...listed].sort()).toEqual([...SIDE_TABLES].sort());
      expect(new Set(listed).size).toBe(listed.length);
    });

    it('the erasure array and the explicit DELETE statements cover exactly the draft tables', () => {
      const erasure = section('## Erasure procedure', '## Removed API aliases');
      const array = erasure.slice(erasure.indexOf('ARRAY['), erasure.indexOf('] LOOP'));
      expect(names(array)).toEqual([...SIDE_TABLES].sort());
      const deletes = [...erasure.matchAll(/^DELETE FROM ([a-z_0-9]+) WHERE/gm)].map((m) => m[1]).filter((n) => !n.includes('_legacy_archive_'));
      expect([...deletes].sort()).toEqual([...SIDE_TABLES].sort());
    });
  });

  it('up() and down() throw without the confirmation and run no SQL', async () => {
    delete process.env[CONFIRM_ENV];
    for (const direction of ['up', 'down'] as const) {
      const query = jest.fn();
      await expect(new Draft()[direction]({ query } as never)).rejects.toThrow(/gated draft.*BACKFILL_PURGE_CONFIRM/);
      expect(query).not.toHaveBeenCalled();
    }
    process.env[CONFIRM_ENV] = 'yes';
    const query = jest.fn();
    await expect(new Draft().up({ query } as never)).rejects.toThrow(/gated draft/);
    expect(query).not.toHaveBeenCalled();
  });

  it('stops at the RLS-bypass guard', async () => {
    process.env[CONFIRM_ENV] = CONFIRM_TOKEN;
    const query = jest.fn().mockResolvedValue([{ bypass: false }]);
    await expect(new Draft().up({ query } as never)).rejects.toThrow(/BYPASSRLS/);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('up(): guard, lock_timeout, then only DROP TABLE IF EXISTS of the side tables (no archive, no column drop)', async () => {
    process.env[CONFIRM_ENV] = CONFIRM_TOKEN;
    const sql: string[] = [];
    const query = jest.fn(async (text: string) => { sql.push(text); return text.includes('rolbypassrls') ? [{ bypass: true }] : []; });
    await new Draft().up({ query } as never);
    expect(sql[0]).toContain('rolbypassrls');
    expect(sql[1]).toContain(`SET LOCAL lock_timeout = '15s'`);
    expect(sql.slice(2)).toEqual(SIDE_TABLES.map((t) => `DROP TABLE IF EXISTS "${t}"`));
    expect(sql.join('\n')).not.toMatch(/CREATE TABLE|INSERT|DROP COLUMN|ALTER TABLE/i);
  });

  it('down() is irreversible even when confirmed', async () => {
    process.env[CONFIRM_ENV] = CONFIRM_TOKEN;
    const query = jest.fn();
    await expect(new Draft().down({ query } as never)).rejects.toThrow(/irreversible/);
    expect(query).not.toHaveBeenCalled();
  });
});
