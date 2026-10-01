/**
 * transaction-legacy-fields.ts — CZ-041 deploy-skew compatibility for the
 * transaction contract.
 *
 * A web build released before CZ-041 sends the Portuguese camelCase keys and
 * Portuguese values below; they are mapped to the canonical contract before
 * the zod schemas run (z.preprocess in transaction.validator.ts), so the rest
 * of the API only ever sees canonical keys/values. Responses are canonical.
 */
import { applyDeprecatedFieldAliases, type DeprecatedFieldAliases } from '../../common/compat/deprecated-field-aliases.util';
import { canonicalTransactionSlug } from './transaction-category-slugs';

export const TRANSACTION_DEPRECATED_FIELDS: DeprecatedFieldAliases = {
  tipoTransacao: 'transactionType',
  tipoCliente: 'counterpartyType',
  subcategoria: 'subcategory',
  dataTransacao: 'transactionDate',
  observacao: 'notes',
  artistaVinculado: 'artistId',
  projetoVinculado: 'projectId',
  contratoVinculado: 'contractId',
  eventoVinculado: 'eventId',
  fornecedorCliente: 'counterpartyName',
  orgaoArrecadador: 'taxAuthority',
  centro_custo: 'costCenter',
  competencia: 'referenceMonth',
  conta_origem: 'sourceBankAccount',
  conta_destino: 'destinationBankAccount',
  itemInvestimento: 'investmentItem',
  motivoViagem: 'travelReason',
  formaPagamento: 'paymentMethod',
  tipoPagamento: 'paymentType',
  quantidadeParcelas: 'installmentCount',
  intervaloParcelas: 'installmentInterval',
  dataPrimeiraParcela: 'firstInstallmentDate',
  anexoUrl: 'attachmentUrl',
  anexoNome: 'attachmentName',
};

/** Deprecated QUERY-string keys (list filters) → canonical filter keys. */
export const TRANSACTION_QUERY_DEPRECATED_FIELDS: DeprecatedFieldAliases = {
  artistId: 'artist_id',
};

export const TRANSACTION_TYPES = ['revenue', 'expense', 'investment', 'tax', 'transfer'] as const;
export const COUNTERPARTY_TYPES = ['company', 'artist', 'individual', 'government', 'own_account'] as const;
export const PAYMENT_METHODS = ['pix', 'ted', 'boleto', 'credit_card', 'debit_card', 'cash', 'check'] as const;
export const PAYMENT_TYPES = ['upfront', 'installments'] as const;
export const INSTALLMENT_INTERVALS = ['monthly', 'biweekly', 'weekly'] as const;

/** Legacy Portuguese value -> canonical value, per canonical key. */
export const LEGACY_TRANSACTION_VALUES: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  transactionType: {
    receita: 'revenue', despesa: 'expense', investimento: 'investment', imposto: 'tax', transferencia: 'transfer',
  },
  counterpartyType: {
    empresa: 'company', artista: 'artist', pessoa: 'individual', governo: 'government', 'conta-propria': 'own_account',
  },
  paymentMethod: { 'cartao-credito': 'credit_card', 'cartao-debito': 'debit_card', dinheiro: 'cash', cheque: 'check' },
  paymentType: { avista: 'upfront', parcelado: 'installments' },
  installmentInterval: { mensal: 'monthly', quinzenal: 'biweekly', semanal: 'weekly' },
};

const mapValue = (map: Readonly<Record<string, string>>, value: unknown): unknown =>
  typeof value === 'string' && Object.prototype.hasOwnProperty.call(map, value.toLowerCase()) ? map[value.toLowerCase()] : value;

/** Canonical transaction type (legacy receita/despesa/... mapped; unknown values kept). */
export const canonicalTransactionType = (value: unknown): unknown => mapValue(LEGACY_TRANSACTION_VALUES.transactionType, value);

/** Maps every deprecated CZ-041 key and value of a transaction request body. */
export function canonicalizeTransactionInput(input: unknown): unknown {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) return input;
  const out = applyDeprecatedFieldAliases(input as Record<string, unknown>, TRANSACTION_DEPRECATED_FIELDS);
  for (const [key, map] of Object.entries(LEGACY_TRANSACTION_VALUES)) {
    if (out[key] !== undefined) out[key] = mapValue(map, out[key]);
  }
  // TX1: platform-owned category/subcategory slugs (legacy kebab-case Portuguese -> canonical English;
  // free text and canonical ids pass through untouched).
  for (const key of ['category', 'subcategory'] as const) {
    if (typeof out[key] === 'string') out[key] = canonicalTransactionSlug(out[key]);
  }
  return out;
}
