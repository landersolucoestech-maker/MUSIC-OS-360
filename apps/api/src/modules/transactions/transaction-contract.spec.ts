/**
 * CZ-041 wire contract for transactions: canonical English keys/values, the
 * deprecated Portuguese payload of a pre-CZ-041 web build still accepted
 * (deploy-skew window), and blank optional fields sent as null.
 */
import { createTransactionSchema, patchTransactionSchema } from './validators/transaction.validator';
import {
  LEGACY_TRANSACTION_VALUES,
  PAYMENT_METHODS,
  TRANSACTION_DEPRECATED_FIELDS,
  TRANSACTION_QUERY_DEPRECATED_FIELDS,
  canonicalizeTransactionInput,
  canonicalTransactionType,
} from './transaction-legacy-fields';
import { applyDeprecatedFieldAliases } from '../../common/compat/deprecated-field-aliases.util';

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

// ─── Exhaustive pins of every legacy name of transaction-legacy-fields.ts (explicit static tables, not derived from the module) ───
type Row2 = ReadonlyArray<readonly [string, string]>;
type Row3 = ReadonlyArray<readonly [string, string, string]>;
const X_TRANSACTION_FIELDS: Row2 = [
  ['tipoTransacao', 'transactionType'],
  ['tipoCliente', 'counterpartyType'],
  ['subcategoria', 'subcategory'],
  ['dataTransacao', 'transactionDate'],
  ['observacao', 'notes'],
  ['artistaVinculado', 'artistId'],
  ['projetoVinculado', 'projectId'],
  ['contratoVinculado', 'contractId'],
  ['eventoVinculado', 'eventId'],
  ['fornecedorCliente', 'counterpartyName'],
  ['orgaoArrecadador', 'taxAuthority'],
  ['centro_custo', 'costCenter'],
  ['competencia', 'referenceMonth'],
  ['conta_origem', 'sourceBankAccount'],
  ['conta_destino', 'destinationBankAccount'],
  ['itemInvestimento', 'investmentItem'],
  ['motivoViagem', 'travelReason'],
  ['formaPagamento', 'paymentMethod'],
  ['tipoPagamento', 'paymentType'],
  ['quantidadeParcelas', 'installmentCount'],
  ['intervaloParcelas', 'installmentInterval'],
  ['dataPrimeiraParcela', 'firstInstallmentDate'],
  ['anexoUrl', 'attachmentUrl'],
  ['anexoNome', 'attachmentName'],
];

const X_TRANSACTION_QUERY_FIELDS: Row2 = [
  ['artistId', 'artist_id'],
];

/** [canonical key, legacy value, canonical value] */
const X_TRANSACTION_VALUES: Row3 = [
  ['transactionType', 'receita', 'revenue'],
  ['transactionType', 'despesa', 'expense'],
  ['transactionType', 'investimento', 'investment'],
  ['transactionType', 'imposto', 'tax'],
  ['transactionType', 'transferencia', 'transfer'],
  ['counterpartyType', 'empresa', 'company'],
  ['counterpartyType', 'artista', 'artist'],
  ['counterpartyType', 'pessoa', 'individual'],
  ['counterpartyType', 'governo', 'government'],
  ['counterpartyType', 'conta-propria', 'own_account'],
  ['paymentMethod', 'cartao-credito', 'credit_card'],
  ['paymentMethod', 'cartao-debito', 'debit_card'],
  ['paymentMethod', 'dinheiro', 'cash'],
  ['paymentMethod', 'cheque', 'check'],
  ['paymentType', 'avista', 'upfront'],
  ['paymentType', 'parcelado', 'installments'],
  ['installmentInterval', 'mensal', 'monthly'],
  ['installmentInterval', 'quinzenal', 'biweekly'],
  ['installmentInterval', 'semanal', 'weekly'],
];

describe('transaction legacy names: every deprecated key and value, one by one', () => {
  it('the exported alias tables declare exactly the expected pairs', () => {
    expect({ ...TRANSACTION_DEPRECATED_FIELDS }).toEqual(Object.fromEntries(X_TRANSACTION_FIELDS));
    expect({ ...TRANSACTION_QUERY_DEPRECATED_FIELDS }).toEqual(Object.fromEntries(X_TRANSACTION_QUERY_FIELDS));
  });

  it.each(X_TRANSACTION_FIELDS)('key %s -> %s: legacy-only moves, the CANONICAL value wins when both are sent', (legacy, canonical) => {
    expect(canonicalizeTransactionInput({ [legacy]: 'legacy-value' })).toEqual({ [canonical]: 'legacy-value' });
    expect(canonicalizeTransactionInput({ [legacy]: 'legacy-value', [canonical]: 'canonical-value' })).toEqual({ [canonical]: 'canonical-value' });
  });

  it.each(X_TRANSACTION_QUERY_FIELDS)('query key %s -> %s: legacy-only moves, canonical wins when both are sent', (legacy, canonical) => {
    expect(applyDeprecatedFieldAliases({ [legacy]: 'legacy-value' }, TRANSACTION_QUERY_DEPRECATED_FIELDS)).toEqual({ [canonical]: 'legacy-value' });
    expect(applyDeprecatedFieldAliases({ [legacy]: 'legacy-value', [canonical]: 'canonical-value' }, TRANSACTION_QUERY_DEPRECATED_FIELDS)).toEqual({ [canonical]: 'canonical-value' });
  });

  it.each(X_TRANSACTION_VALUES)('%s: legacy value %s -> %s (case-insensitive); canonical unchanged; table export pinned', (key, legacy, canonical) => {
    expect(canonicalizeTransactionInput({ [key]: legacy })).toEqual({ [key]: canonical });
    expect(canonicalizeTransactionInput({ [key]: legacy.toUpperCase() })).toEqual({ [key]: canonical });
    expect(canonicalizeTransactionInput({ [key]: canonical })).toEqual({ [key]: canonical });
    expect(LEGACY_TRANSACTION_VALUES[key][legacy]).toBe(canonical);
  });

  it.each(X_TRANSACTION_VALUES.filter(([key]) => key === 'transactionType'))('canonicalTransactionType maps %s: %s -> %s', (_key, legacy, canonical) => {
    expect(canonicalTransactionType(legacy)).toBe(canonical);
  });

  it('legacy KEYS and legacy VALUES combine in one body; a legacy value under the wrong key and unknown text are kept', () => {
    expect(canonicalizeTransactionInput({ tipoTransacao: 'despesa', formaPagamento: 'cartao-credito' })).toEqual({ transactionType: 'expense', paymentMethod: 'credit_card' });
    expect(canonicalizeTransactionInput({ transactionType: 'mensal' })).toEqual({ transactionType: 'mensal' });
    expect(canonicalizeTransactionInput({ transactionType: 'custom' })).toEqual({ transactionType: 'custom' });
  });
});

describe('canonical payment methods (closed vocabulary enforced by the create schema)', () => {
  it('PAYMENT_METHODS is exactly the canonical set', () => {
    expect([...PAYMENT_METHODS]).toEqual(['pix', 'ted', 'boleto', 'credit_card', 'debit_card', 'cash', 'check']);
  });

  it.each(['pix', 'ted', 'boleto', 'credit_card', 'debit_card', 'cash', 'check'])('createTransactionSchema accepts paymentMethod %s', (paymentMethod) => {
    expect(createTransactionSchema.safeParse({ ...CANONICAL, paymentMethod }).success).toBe(true);
  });

  it('the schema canonicalises a legacy spelling before validating it, and still rejects an unknown method', () => {
    const legacy = createTransactionSchema.safeParse({ ...CANONICAL, paymentMethod: 'cartao-credito' });
    expect(legacy.success).toBe(true);
    if (legacy.success) expect(legacy.data.paymentMethod).toBe('credit_card');
    expect(createTransactionSchema.safeParse({ ...CANONICAL, paymentMethod: 'bitcoin' }).success).toBe(false);
  });
});
