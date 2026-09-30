import { BackfillAndRestrictInvoicePaymentMethodToEnglish20260930000010 as Migration } from './migrations/20260930000010_BackfillAndRestrictInvoicePaymentMethodToEnglish';
import { ALL_MIGRATIONS } from './migrations';
import { INVOICE_PAYMENT_METHODS, LEGACY_INVOICE_PAYMENT_METHODS } from '../modules/invoices/invoice-legacy-fields';

type Call = { sql: string; params?: unknown[] };

function runner(opts: { bypass?: boolean; invalid?: string[] } = {}) {
  const calls: Call[] = [];
  const query = jest.fn(async (sql: string, params?: unknown[]) => {
    calls.push({ sql, params });
    if (sql.includes('rolbypassrls')) return [{ bypass: opts.bypass ?? true }];
    if (sql.includes('count(*)')) return [{ affected: 1 }];
    if (sql.includes('SELECT DISTINCT')) return (opts.invalid ?? []).map((value) => ({ value }));
    return [];
  });
  return { query, calls };
}

const quotedList = (sql: string) => [...sql.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);

describe('BackfillAndRestrictInvoicePaymentMethodToEnglish20260930000010', () => {
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

  it('up() backfills exactly the API legacy map with bound parameters, then verifies, then adds the CHECK', async () => {
    const { query, calls } = runner();
    await migration.up({ query } as never);

    const mapped = calls.filter((c) => c.sql.includes('WITH updated AS') && c.params?.length === 2);
    expect(mapped.map((c) => c.params)).toEqual(Object.entries(LEGACY_INVOICE_PAYMENT_METHODS).map(([legacy, canonical]) => [legacy, canonical]));

    const backfills = calls.filter((c) => c.sql.includes('WITH updated AS'));
    // updated_at is a concurrency token: the vocabulary rewrite must not touch it.
    for (const c of backfills) expect(c.sql).not.toContain('updated_at');
    // Stripe rows hold NULL (never written by upsertStripeInvoice): no special case anywhere.
    for (const c of calls) expect(c.sql).not.toContain('stripe_subscription');
    // Case, tab/newline/NBSP and inner whitespace runs are normalized before comparing.
    for (const c of backfills) {
      expect(c.sql).toContain(`lower(btrim(regexp_replace("payment_method", '[[:space:]' || chr(160) || ']+', ' ', 'g')))`);
    }

    const lastBackfill = calls.lastIndexOf(backfills[backfills.length - 1]);
    const verify = calls.findIndex((c) => c.sql.includes('SELECT DISTINCT'));
    const add = calls.findIndex((c) => c.sql.includes('ADD CONSTRAINT'));
    expect(lastBackfill).toBeLessThan(verify);
    expect(verify).toBeLessThan(add);
  });

  it('the CHECK allows exactly the API vocabulary (transactions payment methods + the undecided transferencia)', async () => {
    const { query, calls } = runner();
    await migration.up({ query } as never);
    const add = calls.find((c) => c.sql.includes('ADD CONSTRAINT "chk_invoices_payment_method"'))!;
    expect(quotedList(add.sql).sort()).toEqual([...INVOICE_PAYMENT_METHODS].sort());
    // and the verification audits the same set
    const verify = calls.find((c) => c.sql.includes('SELECT DISTINCT'))!;
    expect(quotedList(verify.sql).sort()).toEqual([...INVOICE_PAYMENT_METHODS].sort());
  });

  it('up() aborts, listing the values, when a row holds a value with no canonical mapping (no constraint is added)', async () => {
    const { query, calls } = runner({ invalid: ['Cartão', 'weird'] });
    await expect(migration.up({ query } as never)).rejects.toThrow(/"invoices"\."payment_method".*\[Cartão, weird\]/);
    expect(calls.some((c) => c.sql.includes('ADD CONSTRAINT'))).toBe(false);
    expect(calls.some((c) => c.sql.includes('DROP CONSTRAINT'))).toBe(false);
  });

  it('up() abort message is bounded: at most 20 values, each truncated to 40 characters', async () => {
    const many = Array.from({ length: 21 }, (_, i) => `v${i}-${'x'.repeat(100)}`);
    const { query, calls } = runner({ invalid: many });
    const error = await migration.up({ query } as never).then(() => null, (e: Error) => e);
    expect(error).not.toBeNull();
    const listed = /\[(.*)\]/s.exec(error!.message)![1];
    expect(listed.split(', ').filter((v) => v.startsWith('v'))).toHaveLength(20);
    expect(listed).not.toContain('x'.repeat(41));
    expect(listed).toContain('more not shown');
    expect(calls.find((c) => c.sql.includes('SELECT DISTINCT'))!.sql).toContain('LIMIT 21');
  });

  it('down() drops the CHECK and maps every canonical value back, one-to-one', async () => {
    const { query, calls } = runner();
    await migration.down({ query } as never);
    expect(calls.filter((c) => c.sql.includes('DROP CONSTRAINT "chk_invoices_payment_method"') || c.sql.includes('DROP CONSTRAINT IF EXISTS "chk_invoices_payment_method"')).length).toBe(1);
    const updates = calls.filter((c) => c.sql.startsWith('UPDATE "invoices"'));
    expect(updates.map((c) => c.params)).toEqual(Object.entries(LEGACY_INVOICE_PAYMENT_METHODS).map(([legacy, canonical]) => [legacy, canonical]));
  });
});
