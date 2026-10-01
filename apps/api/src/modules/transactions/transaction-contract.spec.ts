/**
 * CZ-041 wire contract for transactions: canonical English keys/values, the
 * deprecated Portuguese payload of a pre-CZ-041 web build still accepted
 * (deploy-skew window), and blank optional fields sent as null.
 */
import { createTransactionSchema, patchTransactionSchema } from './validators/transaction.validator';
import { canonicalizeTransactionInput, canonicalTransactionType } from './transaction-legacy-fields';

const CANONICAL = {
  transactionType: 'expense',
  counterpartyType: 'company',
  category: 'other',
  description: 'Aluguel sala',
  amount: '250.00',
  transactionDate: '2026-09-01',
  paymentMethod: 'credit_card',
  paymentType: 'upfront',
  status: 'pending',
};

describe('transactions — CZ-041 canonical contract', () => {
  it('accepts the canonical payload unchanged', () => {
    const parsed = createTransactionSchema.parse(CANONICAL);
    expect(parsed).toMatchObject(CANONICAL);
  });

  it('accepts null in blank optional fields (the form sends null, not undefined)', () => {
    const result = createTransactionSchema.safeParse({
      ...CANONICAL, notes: null, subcategory: null, costCenter: null, referenceMonth: null,
      sourceBankAccount: null, destinationBankAccount: null, attachmentUrl: null, attachmentName: null,
    });
    expect(result.success).toBe(true);
  });

  it('maps the deprecated pre-CZ-041 Portuguese payload to the canonical contract', () => {
    const parsed = createTransactionSchema.parse({
      tipoTransacao: 'despesa',
      tipoCliente: 'empresa',
      category: 'outros',
      description: 'Aluguel sala',
      amount: '250.00',
      dataTransacao: '2026-09-01',
      formaPagamento: 'cartao-credito',
      tipoPagamento: 'avista',
      observacao: 'nota',
    }) as Record<string, unknown>;
    expect(parsed).toMatchObject({
      transactionType: 'expense', counterpartyType: 'company', transactionDate: '2026-09-01',
      paymentMethod: 'credit_card', paymentType: 'upfront', notes: 'nota',
    });
    for (const legacy of ['tipoTransacao', 'tipoCliente', 'dataTransacao', 'formaPagamento', 'tipoPagamento', 'observacao']) {
      expect(parsed).not.toHaveProperty(legacy);
    }
  });

  it('maps every legacy counterparty value, including tax/transfer rule values', () => {
    expect(canonicalizeTransactionInput({ counterpartyType: 'governo' })).toEqual({ counterpartyType: 'government' });
    expect(canonicalizeTransactionInput({ tipoCliente: 'conta-propria' })).toEqual({ counterpartyType: 'own_account' });
  });

  it('an empty deprecated key never wipes the canonical value (deploy skew)', () => {
    expect(canonicalizeTransactionInput({ transactionType: 'revenue', tipoTransacao: '' })).toEqual({ transactionType: 'revenue' });
  });

  it('rejects a value outside the canonical vocabulary, with the canonical path', () => {
    const result = createTransactionSchema.safeParse({ ...CANONICAL, paymentMethod: 'bitcoin' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues.some((i) => i.path[0] === 'paymentMethod')).toBe(true);
  });

  it('validation paths use canonical keys, with PT-BR messages', () => {
    const result = createTransactionSchema.safeParse({ ...CANONICAL, counterpartyType: null });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path[0] === 'counterpartyType');
      expect(issue?.message).toBe('Selecione o tipo de cliente');
    }
  });

  it('values that do not fit the columns are rejected by validation (422), never reaching Postgres (500)', () => {
    const cases: Array<[string, unknown]> = [
      ['counterpartyName', 'x'.repeat(256)], ['costCenter', 'x'.repeat(101)], ['firstInstallmentDate', '2025-02-30'],
      ['referenceMonth', '09/2026'], ['eventId', 'not-a-uuid'], ['installmentCount', 'três'],
    ];
    for (const [field, value] of cases) {
      const result = createTransactionSchema.safeParse({ ...CANONICAL, [field]: value });
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.issues.some((i) => i.path[0] === field)).toBe(true);
    }
    expect(createTransactionSchema.safeParse({ ...CANONICAL, referenceMonth: '2026-09', firstInstallmentDate: '2026-02-28' }).success).toBe(true);
  });

  it('PATCH accepts a partial canonical body and maps legacy keys', () => {
    expect(patchTransactionSchema.parse({ descricao: 'x' } as unknown)).toEqual(expect.not.objectContaining({ descricao: 'x' }));
    expect(patchTransactionSchema.parse({ description: 'x' })).toMatchObject({ description: 'x' });
  });

  it('canonicalTransactionType maps legacy values case-insensitively and keeps unknown values', () => {
    expect(canonicalTransactionType('RECEITA')).toBe('revenue');
    expect(canonicalTransactionType('transfer')).toBe('transfer');
    expect(canonicalTransactionType('bogus')).toBe('bogus');
  });
});
