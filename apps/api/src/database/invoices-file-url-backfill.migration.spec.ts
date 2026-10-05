import { getMetadataArgsStorage } from 'typeorm';
import { InvoiceEntity } from './entities';
import { ALL_MIGRATIONS } from './migrations';
import { BackfillInvoicesFileUrlFromUrlPdf20261005200001 as Migration } from './migrations/20261005200001_BackfillInvoicesFileUrlFromUrlPdf';

function runner(opts: { bypass?: boolean; tableGone?: boolean } = {}) {
  const calls: string[] = [];
  const query = jest.fn(async (sql: string) => {
    calls.push(sql);
    if (sql.includes('rolbypassrls')) return [{ bypass: opts.bypass ?? true }];
    if (sql.includes('to_regclass')) return [{ t: opts.tableGone ? null : 'tracking' }];
    if (sql.includes('count(*)::int AS n')) return [{ n: 2 }];
    return [];
  });
  return { query, calls };
}

describe('BackfillInvoicesFileUrlFromUrlPdf20261005200001 (expand, no drop)', () => {
  const migration = new Migration();
  beforeEach(() => jest.spyOn(console, 'log').mockImplementation(() => undefined));
  afterEach(() => jest.restoreAllMocks());

  it('is registered exactly once', () => {
    expect(ALL_MIGRATIONS.filter((m) => m === Migration)).toHaveLength(1);
  });

  it('both columns exist in the entity (the canonical target is not invented)', () => {
    const columns = getMetadataArgsStorage().columns.filter((c) => c.target === InvoiceEntity).map((c) => c.propertyName);
    expect(columns).toEqual(expect.arrayContaining(['file_url', 'url_pdf']));
  });

  it('up(): guard, lock_timeout, locked-down side table before the UPDATE; only fills NULL file_url', async () => {
    const { query, calls } = runner();
    await migration.up({ query } as never);
    expect(calls[0]).toContain('rolbypassrls');
    expect(calls[1]).toContain(`SET LOCAL lock_timeout = '15s'`);
    const update = calls.findIndex((c) => c.includes('UPDATE "invoices"'));
    const created = calls.findIndex((c) => c.includes('CREATE TABLE IF NOT EXISTS "invoices_file_url_backfill_20261005"'));
    expect(created).toBeGreaterThan(1);
    expect(created).toBeLessThan(update);
    expect(calls.some((c) => c.includes('FORCE ROW LEVEL SECURITY'))).toBe(true);
    expect(calls[update]).toContain('SET "file_url" = "url_pdf"');
    expect(calls[update]).toContain('"file_url" IS NULL AND "url_pdf" IS NOT NULL');
    expect(calls[update]).toContain('INSERT INTO "invoices_file_url_backfill_20261005"');
  });

  it('up(): never drops/alters a column, never touches updated_at or type/tipo_nota', async () => {
    const { query, calls } = runner();
    await migration.up({ query } as never);
    const all = calls.join('\n');
    expect(all).not.toMatch(/DROP\s+(COLUMN|TABLE)|ALTER TABLE "invoices"|RENAME|updated_at|tipo_nota|"type"/i);
  });

  it('up(): refuses to run without RLS bypass (no UPDATE issued)', async () => {
    const { query, calls } = runner({ bypass: false });
    await expect(migration.up({ query } as never)).rejects.toThrow();
    expect(calls.some((c) => c.includes('UPDATE "invoices"'))).toBe(false);
  });

  it('down(): reverts only recorded ids still equal to url_pdf, then drops the side table; a second down() is a no-op', async () => {
    const { query, calls } = runner();
    await migration.down({ query } as never);
    const revert = calls.find((c) => c.includes('UPDATE "invoices"'))!;
    expect(revert).toContain('SET "file_url" = NULL');
    expect(revert).toContain('IS NOT DISTINCT FROM i."url_pdf"');
    expect(calls.some((c) => c.includes('DROP TABLE IF EXISTS "invoices_file_url_backfill_20261005"'))).toBe(true);
    const again = runner({ tableGone: true });
    await migration.down({ query: again.query } as never);
    expect(again.calls.some((c) => c.includes('UPDATE "invoices"'))).toBe(false);
  });
});
