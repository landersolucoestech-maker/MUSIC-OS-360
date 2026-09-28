import { z } from 'zod';
import {
  COUNTERPARTY_TYPES,
  INSTALLMENT_INTERVALS,
  PAYMENT_METHODS,
  PAYMENT_TYPES,
  TRANSACTION_TYPES,
  canonicalizeTransactionInput,
} from '../transaction-legacy-fields';

// ── Canonical enum values (CZ-041; PT-BR labels live in the web UI) ───────────
// 'aprovado'/'atrasado' were UI-only decorative labels with zero backend
// consumer — dead options, removed. 'paid' has real consumers
// (transactions.service.ts PAID_STATUSES, analytics.service.ts KPI queries,
// both treating it as equivalent to confirmed/completed).
const STATUS = ['pending', 'paid', 'confirmed', 'completed', 'scheduled', 'cancelled'] as const;

// ── Subcategory sets used in conditional validation ────────────────────────────

const expenseServicesWithArtistAndProject = new Set([
  'design-grafico', 'producao-audiovisual', 'licenciamento-obras',
  'direitos-autorais', 'fotografia-audiovisual', 'sampling-clearance',
]);

const expenseProductsWithEvent = new Set(['cenografia-pirotecnia']);

const musicIncomeWithArtistAndProject = new Set([
  'direitos-autorais', 'direitos-conexos', 'recebimentos-externos-streaming',
  'licenciamento-obra', 'licenciamento-fonograma', 'sincronizacao', 'venda-beats',
]);

const incomeServicesWithArtistAndProject = new Set([
  'producao-musical', 'producao-audiovisual', 'marketing-divulgacao',
  'design-grafico', 'trafego-pago', 'gravacao-estudio',
  'mixagem', 'masterizacao', 'sessao-producao',
]);

const incomeServicesWithArtist = new Set([
  'criacao-site', 'gestao-redes-sociais', 'ensaio',
]);

// ── Shared field declarations ──────────────────────────────────────────────────
// transactionType is defined separately in each schema so create makes it required
// and update keeps it required (context always known when editing a transaction).

// No defaults here — defaults only belong in createTransactionSchema so partial
// PATCH requests don't silently overwrite existing DB values.
// Every optional field accepts null: the web form sends null for a blank
// field (it used to fail with 422 — CZ-041).
const optionalText = z.string().nullish();
const commonFields = {
  counterpartyType:       z.enum(COUNTERPARTY_TYPES).nullish(),
  category:               optionalText,
  subcategory:            optionalText,
  status:                 z.enum(STATUS).nullish(),
  paymentMethod:          z.enum(PAYMENT_METHODS).nullish(),
  paymentType:            z.enum(PAYMENT_TYPES).nullish(),
  installmentCount:       z.union([z.string(), z.number()]).transform((v) => String(v)).nullish(),
  installmentInterval:    z.enum(INSTALLMENT_INTERVALS).nullish(),
  firstInstallmentDate:   optionalText,
  artistId:               optionalText,
  projectId:              optionalText,
  contractId:             optionalText,
  eventId:                optionalText,
  counterpartyName:       optionalText,
  taxAuthority:           optionalText,
  costCenter:             optionalText,
  referenceMonth:         optionalText,
  sourceBankAccount:      optionalText,
  destinationBankAccount: optionalText,
  investmentItem:         optionalText,
  travelReason:           optionalText,
  advertisingName:        optionalText,
  notes:                  optionalText,
  attachmentUrl:          optionalText,
  attachmentName:         optionalText,
};

// ── Helpers ────────────────────────────────────────────────────────────────────

// ── amount field — accepts string or number from frontend mapper ──────────────
// The frontend form-to-payload.mapper.ts emits amount as a JS number via
// parseFloat(). The schema normalises both string and number to a string
// internally so validation logic can use parseFloat() uniformly.
const amountField = z
  .union([z.string(), z.number()])
  .transform((v) => String(v))
  .nullish();

type Nullish<T> = T | null | undefined;

interface PayloadForValidation {
  transactionType: (typeof TRANSACTION_TYPES)[number];
  counterpartyType?: Nullish<string>;
  category?: Nullish<string>;
  subcategory?: Nullish<string>;
  description?: Nullish<string>;
  amount?: Nullish<string>;
  transactionDate?: Nullish<string>;
  paymentMethod?: Nullish<string>;
  paymentType?: Nullish<string>;
  installmentCount?: Nullish<string>;
  firstInstallmentDate?: Nullish<string>;
  artistId?: Nullish<string>;
  projectId?: Nullish<string>;
  eventId?: Nullish<string>;
  travelReason?: Nullish<string>;
  advertisingName?: Nullish<string>;
  taxAuthority?: Nullish<string>;
}

// Partial variant used by patchTransactionSchema where transactionType may be absent
interface PartialPayloadForValidation extends Omit<PayloadForValidation, 'transactionType'> {
  transactionType?: Nullish<(typeof TRANSACTION_TYPES)[number]>;
}

/**
 * Validates installment fields whenever paymentType is 'installments'.
 * Accepts both full and partial payloads — transactionType not needed here.
 */
function validateInstallments(data: PartialPayloadForValidation, ctx: z.RefinementCtx): void {
  if (data.paymentType !== 'installments') return;

  const count = data.installmentCount ? parseInt(data.installmentCount, 10) : NaN;
  if (isNaN(count) || count < 2) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Mínimo 2 parcelas',
      path: ['installmentCount'],
    });
  }
  if (!data.firstInstallmentDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Informe a data da primeira parcela',
      path: ['firstInstallmentDate'],
    });
  }
}

/**
 * Validates all transaction-type-specific conditional fields.
 * Requires transactionType to be present — enforced by both schemas.
 * Category/subcategory slugs are the (unchanged) taxonomy values.
 */
function validateConditionalByType(data: PayloadForValidation, ctx: z.RefinementCtx): void {
  const type              = data.transactionType;
  const counterpartyType  = data.counterpartyType;
  const category          = data.category;
  const subcategory       = data.subcategory ?? '';
  const linkedArtist      = data.artistId;

  const isTax             = type === 'tax';
  const isTransfer        = type === 'transfer';
  const isInvestment      = type === 'investment';
  const isExpense         = type === 'expense';
  const isIncome          = type === 'revenue';
  const isCompany         = counterpartyType === 'company';
  const isArtist          = counterpartyType === 'artist';
  const isPerson          = counterpartyType === 'individual';
  const isCompanyOrPerson = isCompany || isPerson;

  const needsCounterpartyType = !isTax && !isTransfer && !isInvestment;
  if (needsCounterpartyType && !counterpartyType) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Selecione o tipo de cliente', path: ['counterpartyType'] });
  }

  if (!isTransfer && !category) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Selecione a categoria', path: ['category'] });
  }

  const isServiceExpense                  = isExpense && isCompanyOrPerson && category === 'servicos';
  const isMarketingExpense                = isExpense && isCompanyOrPerson && category === 'marketing';
  const isTravelExpense                   = isExpense && isCompanyOrPerson && category === 'viagens';
  const isProductExpense                  = isExpense && isCompanyOrPerson && category === 'produtos';
  const isFinancialSupportExpense        = isExpense && isCompanyOrPerson && category === 'suporte-financeiro';
  const isArtistFeeExpense            = isExpense && isArtist && category === 'caches';
  const isArtistFinancialSupportExpense = isExpense && isArtist && category === 'suporte-financeiro';
  const isMusicIncome                  = isIncome && isCompanyOrPerson && category === 'receitas-musicais';
  const isServiceIncome                  = isIncome && isCompanyOrPerson && category === 'servicos';
  const isProductIncome                  = isIncome && isCompanyOrPerson && category === 'produtos';

  const needsSubcategory =
    isServiceExpense || isMarketingExpense || isTravelExpense ||
    isProductExpense || isArtistFeeExpense ||
    isMusicIncome || isServiceIncome || isProductIncome;

  if (needsSubcategory && !subcategory) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Selecione a subcategoria', path: ['subcategory'] });
  }

  const needsArtist =
    (isServiceExpense  && expenseServicesWithArtistAndProject.has(subcategory)) ||
    (isMarketingExpense && Boolean(subcategory)) ||
    (isTravelExpense   && Boolean(subcategory)) ||
    (isProductExpense  && Boolean(subcategory)) ||
    isFinancialSupportExpense ||
    (isArtistFeeExpense && Boolean(subcategory)) ||
    isArtistFinancialSupportExpense ||
    (isMusicIncome && Boolean(subcategory)) ||
    (isServiceIncome && (
      incomeServicesWithArtistAndProject.has(subcategory) ||
      incomeServicesWithArtist.has(subcategory)
    )) ||
    (isProductIncome && Boolean(subcategory));

  if (needsArtist && !linkedArtist) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Selecione o artista', path: ['artistId'] });
  }

  const projectRequired =
    (isServiceExpense  && expenseServicesWithArtistAndProject.has(subcategory)) ||
    (isMusicIncome  && musicIncomeWithArtistAndProject.has(subcategory)) ||
    (isServiceIncome  && incomeServicesWithArtistAndProject.has(subcategory));

  const showProject =
    projectRequired ||
    (isMarketingExpense && Boolean(subcategory) && Boolean(linkedArtist));

  if (showProject && projectRequired && linkedArtist && !data.projectId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Selecione o projeto', path: ['projectId'] });
  }

  const needsEvent =
    (isProductExpense     && expenseProductsWithEvent.has(subcategory)) ||
    (isArtistFeeExpense && subcategory === 'show-evento') ||
    (isMusicIncome     && ['participacao-show-evento', 'venda-show-fechado'].includes(subcategory));

  if (needsEvent && linkedArtist && !data.eventId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Selecione o show/evento', path: ['eventId'] });
  }

  if (isTravelExpense && Boolean(subcategory) && !data.travelReason?.trim()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Informe o motivo da viagem', path: ['travelReason'] });
  }

  if (isArtistFeeExpense && subcategory === 'publicidade' && !data.advertisingName?.trim()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Informe o nome da publicidade', path: ['advertisingName'] });
  }

  if (isTax && !data.taxAuthority) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Selecione o órgão arrecadador', path: ['taxAuthority'] });
  }
}

// ── Create schema ─────────────────────────────────────────────────────────────
// All core fields required; conditional rules always run because transactionType
// is always present. Deprecated pre-CZ-041 keys/values are mapped first
// (z.preprocess + canonicalizeTransactionInput).

const createTransactionBaseSchema = z.object({
  transactionType: z.enum(TRANSACTION_TYPES),
  description:     z.string().trim().min(1),
  amount:          amountField,
  transactionDate: z.string().min(1),
  ...commonFields,
  // Defaults applied only on create — absent fields on PATCH/PUT must stay absent
  // so the update path does not reset existing values.
  status:          z.enum(STATUS).nullish().transform((v) => v ?? 'pending'),
  paymentType:     z.enum(PAYMENT_TYPES).nullish().transform((v) => v ?? 'upfront'),
}).superRefine((data, ctx) => {
  if (!data.description?.trim()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Informe a descrição', path: ['description'] });
  }
  if (!data.amount || isNaN(parseFloat(data.amount)) || parseFloat(data.amount) <= 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Informe um valor válido', path: ['amount'] });
  }
  if (!data.transactionDate) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Informe a data da transação', path: ['transactionDate'] });
  }
  if (!data.paymentMethod) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Selecione a forma de pagamento', path: ['paymentMethod'] });
  }
  validateInstallments(data, ctx);
  validateConditionalByType(data, ctx);
});

export const createTransactionSchema = z.preprocess(canonicalizeTransactionInput, createTransactionBaseSchema);

// ── PUT schema (full replace) ─────────────────────────────────────────────────
// transactionType REQUIRED — client always knows the transaction type on PUT;
// requiring it here ensures all conditional rules are always evaluated.
//
// NOTE: The controller currently applies createTransactionSchema for PUT requests
// (both POST and PUT share the same mandatory-field requirements for a full
// replace). updateTransactionSchema is exported here for explicit documentation
// of the intended PUT contract and to give future callers (e.g. admin CLI,
// integration tests, OpenAPI codegen) a clearly named schema.

export const updateTransactionSchema = z.preprocess(canonicalizeTransactionInput, z.object({
  transactionType: z.enum(TRANSACTION_TYPES),
  description:     z.string().trim().nullish(),
  amount:          amountField,
  transactionDate: z.string().nullish(),
  ...commonFields,
  // Optimistic concurrency (Task J — continuity phase): when sent, the
  // update is only applied if updated_at in the database is still exactly this value —
  // detects a "lost update" when two users edit the same transaction in
  // parallel. Optional so existing callers do not break.
  expectedUpdatedAt: z.string().nullish(),
}).superRefine((data, ctx) => {
  if (data.amount != null) {
    if (isNaN(parseFloat(data.amount)) || parseFloat(data.amount) <= 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Informe um valor válido', path: ['amount'] });
    }
  }
  validateInstallments(data, ctx);
  validateConditionalByType(data, ctx);
}));

// ── PATCH schema (partial update) ─────────────────────────────────────────────
// transactionType is optional — a PATCH may legitimately update only a subset
// of fields (e.g., status or description) without resending the full context.
// Business-rule enforcement:
//   • Installment rules (paymentType) always run when present.
//   • Type-specific conditional rules (artist, project, etc.) run only when
//     transactionType IS included in the payload.

export const patchTransactionSchema = z.preprocess(canonicalizeTransactionInput, z.object({
  transactionType: z.enum(TRANSACTION_TYPES).nullish(),
  description:     z.string().trim().nullish(),
  amount:          amountField,
  transactionDate: z.string().nullish(),
  ...commonFields,
  // Optimistic concurrency — see the comment in updateTransactionSchema.
  expectedUpdatedAt: z.string().nullish(),
}).superRefine((data, ctx) => {
  if (data.amount != null) {
    if (isNaN(parseFloat(data.amount)) || parseFloat(data.amount) <= 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Informe um valor válido', path: ['amount'] });
    }
  }
  validateInstallments(data, ctx);
  if (data.transactionType) {
    validateConditionalByType(data as PayloadForValidation, ctx);
  }
}));

export type CreateTransactionDto = z.infer<typeof createTransactionSchema>;
export type UpdateTransactionDto = z.infer<typeof updateTransactionSchema>;
export type PatchTransactionDto  = z.infer<typeof patchTransactionSchema>;
