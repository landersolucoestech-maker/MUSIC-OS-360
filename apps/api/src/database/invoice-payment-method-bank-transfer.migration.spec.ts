import { BackfillInvoicePaymentMethodBankTransfer20260930000021 as Migration } from './migrations/20260930000021_BackfillInvoicePaymentMethodBankTransfer';
import { ALL_MIGRATIONS } from './migrations';
import { CANONICAL_INVOICE_PAYMENT_METHODS, INVOICE_PAYMENT_METHODS } from '../modules/invoices/invoice-legacy-fields';

type Call = { sql: string; params?: unknown[] };

function runner(opts: { bypass?: boolean } = {}) {
  const calls: Call[] = [];
  const query = jest.fn(async (sql: string, params?: unknown[]) => {
    calls.push({ sql, params });
    if (sql.includes('rolbypassrls')) return [{ bypass: opts.bypass ?? true }];
    if (sql.includes('count(*)::int AS affected')) return [{ affected: 2 }];
    return [];
  });
  return { query, calls };
}
const quotedList = (sql: string) => [...sql.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);

describe('BackfillInvoicePaymentMethodBankTransfer20260930000021', () => {
  const migration = new Migration();
  beforeEach(() => jest.spyOn(console, 'log').mockImplementation(() => undefined));
  afterEach(() => jest.restoreAllMocks());

  it('is registered in ALL_MIGRATIONS after 20260930000010', () => {
    expect(ALL_MIGRATIONS).toContain(Migration);
  });

  it.each(['up', 'down'] as const)('%s() stops at the RLS-bypass guard before any other SQL', async (direction) => {
    const { query } = runner({ bypass: false });
    await expect(migration[direction]({ query } as never)).rejects.toThrow(/BYPASSRLS/);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('up() widens the CHECK to the API vocabulary (canonical + tolerated legacy) BEFORE the exact-match backfill', async () => {
    const { query, calls } = runner();
    await migration.up({ query } as never);
    expect(calls[1].sql).toContain("SET LOCAL lock_timeout = '15s'");
    const add = calls.findIndex((c) => c.sql.includes('ADD CONSTRAINT "chk_invoices_payment_method"'));
    const update = calls.findIndex((c) => c.sql.includes('WITH updated AS'));
    expect(add).toBeGreaterThan(0);
    expect(add).toBeLessThan(update);
    expect(quotedList(calls[add].sql).sort()).toEqual([...INVOICE_PAYMENT_METHODS].sort());
    expect(INVOICE_PAYMENT_METHODS).toEqual(expect.arrayContaining([...CANONICAL_INVOICE_PAYMENT_METHODS, 'transferencia']));
    expect(calls[update].params).toEqual(['transferencia', 'bank_transfer']);
    expect(calls[update].sql).toContain('WHERE "payment_method" = $1');
    expect(calls[update].sql).not.toMatch(/lower\(|updated_at|LIKE/i);
  });

  it('down() maps bank_transfer back and restores the 20260930000010 CHECK; nothing is dropped but the CHECK', async () => {
    const { query, calls } = runner();
    await migration.down({ query } as never);
    const update = calls.find((c) => c.sql.includes('WITH updated AS'))!;
    expect(update.params).toEqual(['bank_transfer', 'transferencia']);
    const add = calls.find((c) => c.sql.includes('ADD CONSTRAINT'))!;
    expect(quotedList(add.sql).sort()).toEqual(['pix', 'ted', 'boleto', 'credit_card', 'debit_card', 'cash', 'check', 'transferencia'].sort());
    for (const c of calls) expect(c.sql).not.toMatch(/DROP TABLE|DELETE |TRUNCATE/i);
  });

  it('logs only counts', async () => {
    const { query } = runner();
    await migration.up({ query } as never);
    for (const [line] of (console.log as unknown as jest.Mock).mock.calls) expect(String(line)).toMatch(/row\(s\)/);
  });
});
