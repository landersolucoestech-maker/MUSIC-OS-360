import { BackfillInvoicePaymentMethodBankTransfer20260930000021 as Migration } from './migrations/20260930000021_BackfillInvoicePaymentMethodBankTransfer';
import { ALL_MIGRATIONS } from './migrations';
import {
  CANONICAL_INVOICE_PAYMENT_METHODS,
  INVOICE_DEPRECATED_FIELDS,
  INVOICE_ITEM_DEPRECATED_FIELDS,
  INVOICE_QUERY_DEPRECATED_FIELDS,
  INVOICE_PAYMENT_METHODS,
  canonicalInvoicePaymentMethod,
} from '../modules/invoices/invoice-legacy-fields';
import { applyDeprecatedFieldAliases } from '../common/compat/deprecated-field-aliases.util';

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

describe('invoice legacy request contract (CZ-036 deploy-skew window): legacy input still maps to the canonical output', () => {
  it('every deprecated invoice field is moved to its canonical name and the deprecated key never survives', () => {
    const legacy = {
      numero: 'NF-1', venda_id: 's1', data_emissao: '2026-09-01', vencimento: '2026-10-01',
      tomador_razao_social: 'Tomador LTDA', forma_pagamento: 'pix', condicao_pagamento: '30 dias', itens: [{ x: 1 }],
    };
    const out = applyDeprecatedFieldAliases(legacy, INVOICE_DEPRECATED_FIELDS);
    expect(out).toEqual({
      invoice_number: 'NF-1', sale_id: 's1', issued_at: '2026-09-01', due_at: '2026-10-01',
      tomador_legal_name: 'Tomador LTDA', payment_method: 'pix', payment_terms: '30 dias', items: [{ x: 1 }],
    });
  });

  it('when canonical and deprecated invoice names are both sent the CANONICAL value wins and the deprecated key is dropped', () => {
    const out = applyDeprecatedFieldAliases(
      { tomador_legal_name: 'Canonical', tomador_razao_social: 'Legacy', payment_terms: 'canonical', condicao_pagamento: 'legacy' },
      INVOICE_DEPRECATED_FIELDS,
    ) as Record<string, unknown>;
    expect(out).toEqual({ tomador_legal_name: 'Canonical', payment_terms: 'canonical' });
  });

  it('every deprecated item key (codigo_servico, quantidade) is moved; canonical wins when both are sent', () => {
    expect(applyDeprecatedFieldAliases({ codigo_servico: '1.07', quantidade: 3 }, INVOICE_ITEM_DEPRECATED_FIELDS)).toEqual({ service_code: '1.07', quantity: 3 });
    expect(
      applyDeprecatedFieldAliases({ service_code: 'new', codigo_servico: 'old', quantity: 1, quantidade: 9 }, INVOICE_ITEM_DEPRECATED_FIELDS),
    ).toEqual({ service_code: 'new', quantity: 1 });
  });

  it.each([
    ['dinheiro', 'cash'],
    ['cartao_credito', 'credit_card'],
    ['cartao_debito', 'debit_card'],
    ['cheque', 'check'],
    ['transferencia', 'bank_transfer'],
    [' Cartao_Credito ', 'credit_card'],
  ])('canonicalInvoicePaymentMethod maps the deprecated value %j to %j', (legacy, canonical) => {
    expect(canonicalInvoicePaymentMethod(legacy)).toBe(canonical);
  });

  it('canonical and rail proper names pass through unchanged; unknown values are never guessed', () => {
    for (const value of ['credit_card', 'debit_card', 'bank_transfer', 'pix', 'boleto', 'cash', 'check']) {
      expect(canonicalInvoicePaymentMethod(value)).toBe(value);
    }
    expect(canonicalInvoicePaymentMethod('moeda_x')).toBe('moeda_x');
    expect(canonicalInvoicePaymentMethod(42)).toBe(42);
  });
});

describe('invoice deprecated field alias tables: fiscal document kind', () => {
  it('body: the deprecated tipo_nota moves to fiscal_document_type and is removed before persistence', () => {
    const out = applyDeprecatedFieldAliases({ tipo_nota: 'nfe' }, INVOICE_DEPRECATED_FIELDS) as Record<string, unknown>;
    expect(out['fiscal_document_type']).toBe('nfe');
    expect(out).not.toHaveProperty('tipo_nota');
  });

  it('query: the deprecated tipo_nota moves to fiscal_document_type', () => {
    const out = applyDeprecatedFieldAliases({ tipo_nota: 'nfce' }, INVOICE_QUERY_DEPRECATED_FIELDS) as Record<string, unknown>;
    expect(out['fiscal_document_type']).toBe('nfce');
    expect(out).not.toHaveProperty('tipo_nota');
  });

  it('negative: the canonical value wins over a different deprecated one, in the body and in the query', () => {
    const body = applyDeprecatedFieldAliases({ fiscal_document_type: 'nfse', tipo_nota: 'nfe' }, INVOICE_DEPRECATED_FIELDS) as Record<string, unknown>;
    const query = applyDeprecatedFieldAliases({ fiscal_document_type: 'nfse', tipo_nota: 'nfe' }, INVOICE_QUERY_DEPRECATED_FIELDS) as Record<string, unknown>;
    expect(body['fiscal_document_type']).toBe('nfse');
    expect(query['fiscal_document_type']).toBe('nfse');
    expect(body).not.toHaveProperty('tipo_nota');
    expect(query).not.toHaveProperty('tipo_nota');
  });
});
