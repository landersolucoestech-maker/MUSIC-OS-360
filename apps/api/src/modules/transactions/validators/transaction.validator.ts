import { z } from 'zod';

// ── Enum values matching the frontend constants in transacao-constants.ts ─────

const TIPOS_TRANSACAO = ['receita', 'despesa', 'investimento', 'imposto', 'transferencia'] as const;
// 'aprovado'/'atrasado' were UI-only decorative labels with zero backend
// consumer (no service/query ever branched on them) — dead options, removed.
// 'pago' DOES have real consumers (transactions.service.ts PAID_STATUSES,
// analytics.service.ts KPI queries, both already treating it as equivalent
// to confirmado/concluido) so it is translated, not dropped: 'pago' ->
// 'paid' (see TransactionStatus in packages/types/src/enums.ts).
const STATUS          = ['pending', 'paid', 'confirmed', 'completed', 'scheduled', 'cancelled'] as const;
const FORMAS_PAGAMENTO = [
  'pix', 'ted', 'boleto', 'cartao-credito', 'cartao-debito', 'dinheiro', 'cheque',
] as const;
const TIPOS_PAGAMENTO     = ['avista', 'parcelado'] as const;
const INTERVALOS_PARCELAS = ['mensal', 'quinzenal', 'semanal'] as const;

// ── Subcategory sets used in conditional validation ────────────────────────────

const servicosDespesaComArtistaEProjeto = new Set([
  'design-grafico', 'producao-audiovisual', 'licenciamento-obras',
  'direitos-autorais', 'fotografia-audiovisual', 'sampling-clearance',
]);

const produtosDespesaComEvento = new Set(['cenografia-pirotecnia']);

const receitasMusicaisComArtistaEProjeto = new Set([
  'direitos-autorais', 'direitos-conexos', 'recebimentos-externos-streaming',
  'licenciamento-obra', 'licenciamento-fonograma', 'sincronizacao', 'venda-beats',
]);

const servicosReceitaComArtistaEProjeto = new Set([
  'producao-musical', 'producao-audiovisual', 'marketing-divulgacao',
  'design-grafico', 'trafego-pago', 'gravacao-estudio',
  'mixagem', 'masterizacao', 'sessao-producao',
]);

const servicosReceitaComArtista = new Set([
  'criacao-site', 'gestao-redes-sociais', 'ensaio',
]);

// ── Shared field declarations ──────────────────────────────────────────────────
// tipoTransacao is defined separately in each schema so create makes it required
// and update keeps it required (context always known when editing a transaction).

// No defaults here — defaults only belong in createTransactionSchema so partial
// PATCH requests don't silently overwrite existing DB values.
const commonFields = {
  tipoCliente:         z.string().optional(),
  categoria:           z.string().optional(),
  subcategoria:        z.string().optional(),
  status:              z.enum(STATUS).optional(),
  formaPagamento:      z.enum(FORMAS_PAGAMENTO).optional(),
  tipoPagamento:       z.enum(TIPOS_PAGAMENTO).optional(),
  quantidadeParcelas:  z.string().optional(),
  intervaloParcelas:   z.enum(INTERVALOS_PARCELAS).optional(),
  dataPrimeiraParcela: z.string().optional(),
  artistaVinculado:    z.string().optional(),
  projetoVinculado:    z.string().optional(),
  contratoVinculado:   z.string().optional(),
  eventoVinculado:     z.string().optional(),
  fornecedorCliente:   z.string().optional(),
  orgaoArrecadador:    z.string().optional(),
  itemInvestimento:    z.string().optional(),
  motivoViagem:        z.string().optional(),
  nomePublicidade:     z.string().optional(),
  observacao:          z.string().optional(),
  anexoUrl:            z.string().optional(),
  anexoNome:           z.string().optional(),
};

// ── Helpers ────────────────────────────────────────────────────────────────────

// ── valor field — accepts string or number from frontend mapper ───────────────
// The frontend form-to-payload.mapper.ts emits valor as a JS number via
// parseFloat(). The schema normalises both string and number to a string
// internally so validation logic can use parseFloat() uniformly.
const valorField = z
  .union([z.string(), z.number()])
  .transform((v) => String(v))
  .optional();

interface PayloadForValidation {
  tipoTransacao: (typeof TIPOS_TRANSACAO)[number];
  tipoCliente?: string;
  categoria?: string;
  subcategoria?: string;
  descricao?: string;
  valor?: string;
  dataTransacao?: string;
  formaPagamento?: string;
  tipoPagamento?: string;
  quantidadeParcelas?: string;
  dataPrimeiraParcela?: string;
  artistaVinculado?: string;
  projetoVinculado?: string;
  eventoVinculado?: string;
  motivoViagem?: string;
  nomePublicidade?: string;
  orgaoArrecadador?: string;
}

// Partial variant used by patchTransactionSchema where tipoTransacao may be absent
interface PartialPayloadForValidation extends Omit<PayloadForValidation, 'tipoTransacao'> {
  tipoTransacao?: (typeof TIPOS_TRANSACAO)[number];
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
  const tipoCliente      = data.tipoCliente;
  const categoria        = data.categoria;
  const subcategoria     = data.subcategoria ?? '';
  const artistaVinculado = data.artistaVinculado;

  const isImposto        = type === 'imposto';
  const isTransferencia  = type === 'transferencia';
  const isInvestimento   = type === 'investimento';
  const isDespesa        = type === 'despesa';
  const isReceita        = type === 'receita';
  const isEmpresa        = tipoCliente === 'empresa';
  const isArtista        = tipoCliente === 'artista';
  const isPessoa         = tipoCliente === 'pessoa';
  const isEmpresaOuPessoa = isEmpresa || isPessoa;

  const needsClientType = !isImposto && !isTransferencia && !isInvestimento;
  if (needsClientType && !tipoCliente) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Selecione o tipo de cliente', path: ['tipoCliente'] });
  }

  if (!isTransferencia && !categoria) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Selecione a categoria', path: ['categoria'] });
  }

  const isDespesaServico                  = isDespesa && isEmpresaOuPessoa && categoria === 'servicos';
  const isDespesaMarketing                = isDespesa && isEmpresaOuPessoa && categoria === 'marketing';
  const isDespesaViagem                   = isDespesa && isEmpresaOuPessoa && categoria === 'viagens';
  const isDespesaProduto                  = isDespesa && isEmpresaOuPessoa && categoria === 'produtos';
  const isDespesaSuporteFinanceiro        = isDespesa && isEmpresaOuPessoa && categoria === 'suporte-financeiro';
  const isDespesaArtistaCaches            = isDespesa && isArtista && categoria === 'caches';
  const isDespesaArtistaSuporteFinanceiro = isDespesa && isArtista && categoria === 'suporte-financeiro';
  const isReceitaMusical                  = isReceita && isEmpresaOuPessoa && categoria === 'receitas-musicais';
  const isReceitaServico                  = isReceita && isEmpresaOuPessoa && categoria === 'servicos';
  const isReceitaProduto                  = isReceita && isEmpresaOuPessoa && categoria === 'produtos';

  const needsSubcategoria =
    isDespesaServico || isDespesaMarketing || isDespesaViagem ||
    isDespesaProduto || isDespesaArtistaCaches ||
    isReceitaMusical || isReceitaServico || isReceitaProduto;

  if (needsSubcategoria && !subcategoria) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Selecione a subcategoria', path: ['subcategoria'] });
  }

  const needsArtista =
    (isDespesaServico  && servicosDespesaComArtistaEProjeto.has(subcategoria)) ||
    (isDespesaMarketing && Boolean(subcategoria)) ||
    (isDespesaViagem   && Boolean(subcategoria)) ||
    (isDespesaProduto  && Boolean(subcategoria)) ||
    isDespesaSuporteFinanceiro ||
    (isDespesaArtistaCaches && Boolean(subcategoria)) ||
    isDespesaArtistaSuporteFinanceiro ||
    (isReceitaMusical && Boolean(subcategoria)) ||
    (isReceitaServico && (
      servicosReceitaComArtistaEProjeto.has(subcategoria) ||
      servicosReceitaComArtista.has(subcategoria)
    )) ||
    (isReceitaProduto && Boolean(subcategoria));

  if (needsArtista && !artistaVinculado) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Selecione o artista', path: ['artistaVinculado'] });
  }

  const projetoObrigatorio =
    (isDespesaServico  && servicosDespesaComArtistaEProjeto.has(subcategoria)) ||
    (isReceitaMusical  && receitasMusicaisComArtistaEProjeto.has(subcategoria)) ||
    (isReceitaServico  && servicosReceitaComArtistaEProjeto.has(subcategoria));

  const exibirProjeto =
    projetoObrigatorio ||
    (isDespesaMarketing && Boolean(subcategoria) && Boolean(artistaVinculado));

  if (exibirProjeto && projetoObrigatorio && artistaVinculado && !data.projetoVinculado) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Selecione o projeto', path: ['projetoVinculado'] });
  }

  const needsEvento =
    (isDespesaProduto     && produtosDespesaComEvento.has(subcategoria)) ||
    (isDespesaArtistaCaches && subcategoria === 'show-evento') ||
    (isReceitaMusical     && ['participacao-show-evento', 'venda-show-fechado'].includes(subcategoria));

  if (needsEvento && artistaVinculado && !data.eventoVinculado) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Selecione o show/evento', path: ['eventoVinculado'] });
  }

  if (isDespesaViagem && Boolean(subcategoria) && !data.motivoViagem?.trim()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Informe o motivo da viagem', path: ['motivoViagem'] });
  }

  if (isDespesaArtistaCaches && subcategoria === 'publicidade' && !data.nomePublicidade?.trim()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Informe o nome da publicidade', path: ['nomePublicidade'] });
  }

  if (isImposto && !data.orgaoArrecadador) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Selecione o órgão arrecadador', path: ['orgaoArrecadador'] });
  }
}

// ── Create schema ─────────────────────────────────────────────────────────────
// All core fields required; conditional rules always run because tipoTransacao
// is always present.

export const createTransactionSchema = z.object({
  tipoTransacao: z.enum(TIPOS_TRANSACAO),
  descricao:     z.string().trim().min(1),
  valor:         valorField,
  dataTransacao: z.string().min(1),
  ...commonFields,
  // Defaults applied only on create — absent fields on PATCH/PUT must stay absent
  // so the update path does not reset existing values.
  status:        z.enum(STATUS).optional().default('pending'),
  tipoPagamento: z.enum(TIPOS_PAGAMENTO).optional().default('avista'),
}).superRefine((data, ctx) => {
  if (!data.descricao?.trim()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Informe a descrição', path: ['descricao'] });
  }
  if (!data.valor || isNaN(parseFloat(data.valor)) || parseFloat(data.valor) <= 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Informe um valor válido', path: ['valor'] });
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
  tipoTransacao: z.enum(TIPOS_TRANSACAO),
  descricao:     z.string().trim().optional(),
  valor:         valorField,
  dataTransacao: z.string().optional(),
  ...commonFields,
  // Concorrência otimista (Task J — fase de continuidade): quando enviado, o
  // update só é aplicado se updated_at no banco ainda for exatamente este —
  // detecta "lost update" quando dois usuários editam a mesma transação em
  // paralelo. Opcional para não quebrar chamadores existentes.
  expectedUpdatedAt: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.valor !== undefined) {
    if (isNaN(parseFloat(data.valor)) || parseFloat(data.valor) <= 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Informe um valor válido', path: ['valor'] });
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
  tipoTransacao: z.enum(TIPOS_TRANSACAO).optional(),
  descricao:     z.string().trim().optional(),
  valor:         valorField,
  dataTransacao: z.string().optional(),
  ...commonFields,
  // Concorrência otimista — ver comentário em updateTransactionSchema.
  expectedUpdatedAt: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.valor !== undefined) {
    if (isNaN(parseFloat(data.valor)) || parseFloat(data.valor) <= 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Informe um valor válido', path: ['valor'] });
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
