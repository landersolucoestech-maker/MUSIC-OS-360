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

// TX1: the sets hold the canonical English ids; request values are canonicalized
// first (legacy kebab-case Portuguese slugs are accepted as deprecated input, see
// transaction-category-slugs.ts).
const expenseServicesWithArtistAndProject = new Set([
  'graphic_design', 'audiovisual_production', 'works_licensing',
  'copyright', 'photography_audiovisual', 'sampling_clearance',
]);

const expenseProductsWithEvent = new Set(['set_design_pyrotechnics']);

const musicIncomeWithArtistAndProject = new Set([
  'copyright', 'neighboring_rights', 'external_rights_streaming',
  'work_licensing', 'phonogram_licensing', 'synchronization', 'beat_sales',
]);

const incomeServicesWithArtistAndProject = new Set([
  'music_production', 'audiovisual_production', 'marketing_promotion',
  'graphic_design', 'paid_traffic', 'studio_recording',
  'mixing', 'mastering', 'production_session',
]);

const incomeServicesWithArtist = new Set([
  'website_creation', 'social_media_management', 'rehearsal',
]);

// ── Shared field declarations ──────────────────────────────────────────────────
// transactionType is defined separately in each schema so create makes it required
// and update keeps it required (context always known when editing a transaction).

// No defaults here — defaults only belong in createTransactionSchema so partial
// PATCH requests don't silently overwrite existing DB values.
// Every optional field accepts null: the web form sends null for a blank
// field (it used to fail with 422 — CZ-041).
const optionalText = z.string().nullish();
// Bounded by the physical column (CZ-041 moved these from unbounded metadata
// into columns — an over-long value must be a 422, never a Postgres 500).
const boundedText = (max: number) => z.string().max(max, `Informe no máximo ${max} caracteres`).nullish();
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const optionalUuid = z.string().regex(UUID_PATTERN, 'Selecione um registro válido').nullish().or(z.literal(''));
const isCalendarDate = (value: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
};
const optionalDate = z.string().refine(isCalendarDate, 'Informe uma data válida').nullish().or(z.literal(''));
const commonFields = {
  counterpartyType:       z.enum(COUNTERPARTY_TYPES).nullish(),
  category:               boundedText(100),
  subcategory:            boundedText(100),
  status:                 z.enum(STATUS).nullish(),
  paymentMethod:          z.enum(PAYMENT_METHODS).nullish(),
  paymentType:            z.enum(PAYMENT_TYPES).nullish(),
  installmentCount:       z.union([z.string().regex(/^\d{1,6}$/, 'Informe um número de parcelas válido'), z.number().int().min(0).max(999999)])
    .transform((v) => String(v)).nullish().or(z.literal('')),
  installmentInterval:    z.enum(INSTALLMENT_INTERVALS).nullish(),
  firstInstallmentDate:   optionalDate,
  artistId:               optionalUuid,
  projectId:              optionalUuid,
  contractId:             optionalUuid,
  eventId:                optionalUuid,
  counterpartyName:       boundedText(255),
  taxAuthority:           boundedText(255),
  costCenter:             boundedText(100),
  referenceMonth:         z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Informe a competência no formato MM/AAAA').nullish().or(z.literal('')),
  sourceBankAccount:      boundedText(100),
  destinationBankAccount: boundedText(100),
  investmentItem:         boundedText(255),
  travelReason:           boundedText(255),
  advertisingName:        boundedText(255),
  notes:                  optionalText,
  attachmentUrl:          optionalText,
  attachmentName:         boundedText(255),
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
 * Category/subcategory slugs are the canonical English taxonomy ids: every schema runs this only after z.preprocess(canonicalizeTransactionInput) has mapped the legacy ones, so they are not mapped again here.
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

  const isServiceExpense                  = isExpense && isCompanyOrPerson && category === 'services';
  const isMarketingExpense                = isExpense && isCompanyOrPerson && category === 'marketing';
  const isTravelExpense                   = isExpense && isCompanyOrPerson && category === 'travel';
  const isProductExpense                  = isExpense && isCompanyOrPerson && category === 'products';
  const isFinancialSupportExpense        = isExpense && isCompanyOrPerson && category === 'financial_support';
  const isArtistFeeExpense            = isExpense && isArtist && category === 'performance_fees';
  const isArtistFinancialSupportExpense = isExpense && isArtist && category === 'financial_support';
  const isMusicIncome                  = isIncome && isCompanyOrPerson && category === 'music_revenue';
  const isServiceIncome                  = isIncome && isCompanyOrPerson && category === 'services';
  const isProductIncome                  = isIncome && isCompanyOrPerson && category === 'products';

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
    (isArtistFeeExpense && subcategory === 'show_event') ||
    (isMusicIncome     && ['show_event_participation', 'closed_show_sale'].includes(subcategory));

  if (needsEvent && linkedArtist && !data.eventId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Selecione o show/evento', path: ['eventId'] });
  }

  if (isTravelExpense && Boolean(subcategory) && !data.travelReason?.trim()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Informe o motivo da viagem', path: ['travelReason'] });
  }

  if (isArtistFeeExpense && subcategory === 'advertising' && !data.advertisingName?.trim()) {
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
