import { z } from 'zod';

// ── Enum values matching the frontend constants in transacao-constants.ts ─────

const TRANSACTION_TYPES = ['receita', 'despesa', 'investimento', 'imposto', 'transferencia'] as const;
// 'aprovado'/'atrasado' were UI-only decorative labels with zero backend
// consumer (no service/query ever branched on them) — dead options, removed.
// 'pago' DOES have real consumers (transactions.service.ts PAID_STATUSES,
// analytics.service.ts KPI queries, both already treating it as equivalent
// to confirmado/concluido) so it is translated, not dropped: 'pago' ->
// 'paid' (see TransactionStatus in packages/types/src/enums.ts).
const STATUS          = ['pending', 'paid', 'confirmed', 'completed', 'scheduled', 'cancelled'] as const;
const PAYMENT_METHODS = [
  'pix', 'ted', 'boleto', 'cartao-credito', 'cartao-debito', 'dinheiro', 'cheque',
] as const;
const PAYMENT_PLANS     = ['avista', 'parcelado'] as const;
const INSTALLMENT_INTERVALS = ['mensal', 'quinzenal', 'semanal'] as const;

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
// tipoTransacao is defined separately in each schema so create makes it required
// and update keeps it required (context always known when editing a transaction).

// No defaults here — defaults only belong in createTransactionSchema so partial
// PATCH requests don't silently overwrite existing DB values.
const commonFields = {
  tipoCliente:         z.string().optional(),
  category:            z.string().optional(),
  subcategoria:        z.string().optional(),
  status:              z.enum(STATUS).optional(),
  formaPagamento:      z.enum(PAYMENT_METHODS).optional(),
  tipoPagamento:       z.enum(PAYMENT_PLANS).optional(),
  quantidadeParcelas:  z.string().optional(),
  intervaloParcelas:   z.enum(INSTALLMENT_INTERVALS).optional(),
  dataPrimeiraParcela: z.string().optional(),
  artistaVinculado:    z.string().optional(),
  projetoVinculado:    z.string().optional(),
  contratoVinculado:   z.string().optional(),
  eventoVinculado:     z.string().optional(),
  fornecedorCliente:   z.string().optional(),
  orgaoArrecadador:    z.string().optional(),
  itemInvestimento:    z.string().optional(),
  motivoViagem:        z.string().optional(),
  advertisingName:     z.string().optional(),
  observacao:          z.string().optional(),
  anexoUrl:            z.string().optional(),
  anexoNome:           z.string().optional(),
};

// ── Helpers ────────────────────────────────────────────────────────────────────

// ── amount field — accepts string or number from frontend mapper ──────────────
// The frontend form-to-payload.mapper.ts emits amount as a JS number via
// parseFloat(). The schema normalises both string and number to a string
// internally so validation logic can use parseFloat() uniformly.
const amountField = z
  .union([z.string(), z.number()])
  .transform((v) => String(v))
  .optional();

interface PayloadForValidation {
  tipoTransacao: (typeof TRANSACTION_TYPES)[number];
  tipoCliente?: string;
  category?: string;
  subcategoria?: string;
  description?: string;
  amount?: string;
  dataTransacao?: string;
  formaPagamento?: string;
  tipoPagamento?: string;
  quantidadeParcelas?: string;
  dataPrimeiraParcela?: string;
  artistaVinculado?: string;
  projetoVinculado?: string;
  eventoVinculado?: string;
  motivoViagem?: string;
  advertisingName?: string;
  orgaoArrecadador?: string;
}

// Partial variant used by patchTransactionSchema where tipoTransacao may be absent
interface PartialPayloadForValidation extends Omit<PayloadForValidation, 'tipoTransacao'> {
  tipoTransacao?: (typeof TRANSACTION_TYPES)[number];
}

/**
 * Validates installment fields whenever tipoPagamento is 'parcelado'.
 * Accepts both full and partial payloads — tipoTransacao not needed here.
 * Independent of tipoTransacao — applies on both create and update.
 */
function validateParcelamento(data: PartialPayloadForValidation, ctx: z.RefinementCtx): void {
  if (data.tipoPagamento !== 'parcelado') return;

  const qtd = data.quantidadeParcelas ? parseInt(data.quantidadeParcelas, 10) : NaN;
  if (isNaN(qtd) || qtd < 2) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Mínimo 2 parcelas',
      path: ['quantidadeParcelas'],
    });
  }
  if (!data.dataPrimeiraParcela) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Informe a data da primeira parcela',
      path: ['dataPrimeiraParcela'],
    });
  }
}

/**
 * Validates all transaction-type-specific conditional fields.
 * Requires tipoTransacao to be present — enforced by both schemas.
 */
function validateConditionalByType(data: PayloadForValidation, ctx: z.RefinementCtx): void {
  const type             = data.tipoTransacao;
  const clientType      = data.tipoCliente;
  const category        = data.category;
  const subcategoria     = data.subcategoria ?? '';
  const linkedArtist = data.artistaVinculado;

  const isTax        = type === 'imposto';
  const isTransferencia  = type === 'transferencia';
  const isInvestment   = type === 'investimento';
  const isExpense        = type === 'despesa';
  const isIncome        = type === 'receita';
  const isCompany        = clientType === 'empresa';
  const isArtist        = clientType === 'artista';
  const isPerson         = clientType === 'pessoa';
  const isCompanyOrPerson = isCompany || isPerson;

  const needsClientType = !isTax && !isTransferencia && !isInvestment;
  if (needsClientType && !clientType) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Selecione o tipo de cliente', path: ['tipoCliente'] });
  }

  if (!isTransferencia && !category) {
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

  const needsSubcategoria =
    isServiceExpense || isMarketingExpense || isTravelExpense ||
    isProductExpense || isArtistFeeExpense ||
    isMusicIncome || isServiceIncome || isProductIncome;

  if (needsSubcategoria && !subcategoria) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Selecione a subcategoria', path: ['subcategoria'] });
  }

  const needsArtist =
    (isServiceExpense  && expenseServicesWithArtistAndProject.has(subcategoria)) ||
    (isMarketingExpense && Boolean(subcategoria)) ||
    (isTravelExpense   && Boolean(subcategoria)) ||
    (isProductExpense  && Boolean(subcategoria)) ||
    isFinancialSupportExpense ||
    (isArtistFeeExpense && Boolean(subcategoria)) ||
    isArtistFinancialSupportExpense ||
    (isMusicIncome && Boolean(subcategoria)) ||
    (isServiceIncome && (
      incomeServicesWithArtistAndProject.has(subcategoria) ||
      incomeServicesWithArtist.has(subcategoria)
    )) ||
    (isProductIncome && Boolean(subcategoria));

  if (needsArtist && !linkedArtist) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Selecione o artista', path: ['artistaVinculado'] });
  }

  const projectRequired =
    (isServiceExpense  && expenseServicesWithArtistAndProject.has(subcategoria)) ||
    (isMusicIncome  && musicIncomeWithArtistAndProject.has(subcategoria)) ||
    (isServiceIncome  && incomeServicesWithArtistAndProject.has(subcategoria));

  const showProject =
    projectRequired ||
    (isMarketingExpense && Boolean(subcategoria) && Boolean(linkedArtist));

  if (showProject && projectRequired && linkedArtist && !data.projetoVinculado) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Selecione o projeto', path: ['projetoVinculado'] });
  }

  const needsEvent =
    (isProductExpense     && expenseProductsWithEvent.has(subcategoria)) ||
    (isArtistFeeExpense && subcategoria === 'show-evento') ||
    (isMusicIncome     && ['participacao-show-evento', 'venda-show-fechado'].includes(subcategoria));

  if (needsEvent && linkedArtist && !data.eventoVinculado) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Selecione o show/evento', path: ['eventoVinculado'] });
  }

  if (isTravelExpense && Boolean(subcategoria) && !data.motivoViagem?.trim()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Informe o motivo da viagem', path: ['motivoViagem'] });
  }

  if (isArtistFeeExpense && subcategoria === 'publicidade' && !data.advertisingName?.trim()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Informe o nome da publicidade', path: ['advertisingName'] });
  }

  if (isTax && !data.orgaoArrecadador) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Selecione o órgão arrecadador', path: ['orgaoArrecadador'] });
  }
}

// ── Create schema ─────────────────────────────────────────────────────────────
// All core fields required; conditional rules always run because tipoTransacao
// is always present.

export const createTransactionSchema = z.object({
  tipoTransacao: z.enum(TRANSACTION_TYPES),
  description:     z.string().trim().min(1),
  amount:        amountField,
  dataTransacao: z.string().min(1),
  ...commonFields,
  // Defaults applied only on create — absent fields on PATCH/PUT must stay absent
  // so the update path does not reset existing values.
  status:        z.enum(STATUS).optional().default('pending'),
  tipoPagamento: z.enum(PAYMENT_PLANS).optional().default('avista'),
}).superRefine((data, ctx) => {
  if (!data.description?.trim()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Informe a descrição', path: ['description'] });
  }
  if (!data.amount || isNaN(parseFloat(data.amount)) || parseFloat(data.amount) <= 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Informe um valor válido', path: ['amount'] });
  }
  if (!data.dataTransacao) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Informe a data da transação', path: ['dataTransacao'] });
  }
  if (!data.formaPagamento) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Selecione a forma de pagamento', path: ['formaPagamento'] });
  }
  validateParcelamento(data, ctx);
  validateConditionalByType(data, ctx);
});

// ── PUT schema (full replace) ─────────────────────────────────────────────────
// tipoTransacao REQUIRED — client always knows the transaction type on PUT;
// requiring it here ensures all conditional rules are always evaluated.
//
// NOTE: The controller currently applies createTransactionSchema for PUT requests
// (both POST and PUT share the same mandatory-field requirements for a full
// replace).  updateTransactionSchema is exported here for explicit documentation
// of the intended PUT contract and to give future callers (e.g. admin CLI,
// integration tests, OpenAPI codegen) a clearly named schema — remove this
// comment and wire the schema when a divergence from createTransactionSchema is
// needed.

export const updateTransactionSchema = z.object({
  tipoTransacao: z.enum(TRANSACTION_TYPES),
  description:     z.string().trim().optional(),
  amount:        amountField,
  dataTransacao: z.string().optional(),
  ...commonFields,
  // Optimistic concurrency (Task J — continuity phase): when sent, the
  // update is only applied if updated_at in the database is still exactly this value —
  // detects a "lost update" when two users edit the same transaction in
  // parallel. Optional so existing callers do not break.
  expectedUpdatedAt: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.amount !== undefined) {
    if (isNaN(parseFloat(data.amount)) || parseFloat(data.amount) <= 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Informe um valor válido', path: ['amount'] });
    }
  }
  validateParcelamento(data, ctx);
  validateConditionalByType(data, ctx);
});

// ── PATCH schema (partial update) ─────────────────────────────────────────────
// tipoTransacao is optional — a PATCH may legitimately update only a subset of
// fields (e.g., status or description) without resending the full context.
// Business-rule enforcement:
//   • Instalment rules (tipoPagamento/parcelamento) always run when present.
//   • Type-specific conditional rules (artista, projeto, etc.) run only when
//     tipoTransacao IS included in the payload so there is enough context to
//     evaluate them — partial payloads without tipoTransacao are validated only
//     on the fields provided.

export const patchTransactionSchema = z.object({
  tipoTransacao: z.enum(TRANSACTION_TYPES).optional(),
  description:     z.string().trim().optional(),
  amount:        amountField,
  dataTransacao: z.string().optional(),
  ...commonFields,
  // Optimistic concurrency — see the comment in updateTransactionSchema.
  expectedUpdatedAt: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.amount !== undefined) {
    if (isNaN(parseFloat(data.amount)) || parseFloat(data.amount) <= 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Informe um valor válido', path: ['amount'] });
    }
  }
  // Instalment validation runs whenever tipoPagamento is provided
  validateParcelamento(data, ctx);
  // Conditional business rules run only when tipoTransacao is present
  if (data.tipoTransacao) {
    validateConditionalByType(data as PayloadForValidation, ctx);
  }
});

export type CreateTransactionDto = z.infer<typeof createTransactionSchema>;
export type UpdateTransactionDto = z.infer<typeof updateTransactionSchema>;
export type PatchTransactionDto  = z.infer<typeof patchTransactionSchema>;
