import type { TransactionFormData } from "@/modules/accounting/constants/transaction-constants";
import {
  getCategoriesForTransactionType,
  getSubcategoriesForCategory,
  getInvestmentItemsByCategory,
  expenseServicesRequiringArtistAndProject,
  expenseProductsRequiringEvent,
  musicRevenueRequiringArtistAndProject,
  revenueServicesRequiringArtistAndProject,
  revenueServicesRequiringArtistOnly,
} from "@/modules/accounting/constants/transaction-constants";

export interface FinancialFormRules {
  exibirTipoCliente:      boolean;
  exibirCategoria:        boolean;
  exibirSubcategoria:     boolean;
  exibirItemInvestimento: boolean;
  exibirArtista:          boolean;
  exibirProjeto:          boolean;
  projetoObrigatorio:     boolean;
  exibirEvento:           boolean;
  exibirFornecedor:       boolean;
  exibirOrgaoArrecadador: boolean;
  exibirMotivoViagem:     boolean;
  exibirAdvertisingName:  boolean;
  exibirParcelamento:     boolean;
  labelTipoCliente:       string;
}

// ── Rule context ─────────────────────────────────────────────────────────────
// Intermediate booleans derived from formData that predicates can reference.
interface RuleContext {
  isImposto:      boolean;
  isTransferencia: boolean;
  isInvestimento: boolean;
  isDespesa:      boolean;
  isReceita:      boolean;
  isEmpresa:      boolean;
  isArtista:      boolean;
  isPessoa:       boolean;
  isEmpresaOuPessoa: boolean;
  isDespesaServico:             boolean;
  isDespesaMarketing:           boolean;
  isDespesaViagem:              boolean;
  isDespesaProduto:             boolean;
  isDespesaSuporteFinanceiro:   boolean;
  isDespesaArtistaCaches:       boolean;
  isDespesaArtistaSuporteFinanceiro: boolean;
  isReceitaMusical: boolean;
  isReceitaServico: boolean;
  isReceitaProduto: boolean;
  hasTipoTransacao: boolean;
}

function buildContext(f: TransactionFormData): RuleContext {
  const isTax       = f.tipoTransacao === "imposto";
  const isTransferencia = f.tipoTransacao === "transferencia";
  const isInvestment  = f.tipoTransacao === "investimento";
  const isExpense       = f.tipoTransacao === "despesa";
  const isIncome       = f.tipoTransacao === "receita";
  const isCompany       = f.tipoCliente === "empresa";
  const isArtist       = f.tipoCliente === "artista";
  const isPerson        = f.tipoCliente === "pessoa";
  const isCompanyOrPerson = isCompany || isPerson;
  return {
    isImposto: isTax, isTransferencia, isInvestimento: isInvestment, isDespesa: isExpense, isReceita: isIncome,
    isEmpresa: isCompany, isArtista: isArtist, isPessoa: isPerson, isEmpresaOuPessoa: isCompanyOrPerson,
    isDespesaServico:             isExpense && isCompanyOrPerson && f.category === "servicos",
    isDespesaMarketing:           isExpense && isCompanyOrPerson && f.category === "marketing",
    isDespesaViagem:              isExpense && isCompanyOrPerson && f.category === "viagens",
    isDespesaProduto:             isExpense && isCompanyOrPerson && f.category === "produtos",
    isDespesaSuporteFinanceiro:   isExpense && isCompanyOrPerson && f.category === "suporte-financeiro",
    isDespesaArtistaCaches:       isExpense && isArtist && f.category === "caches",
    isDespesaArtistaSuporteFinanceiro: isExpense && isArtist && f.category === "suporte-financeiro",
    isReceitaMusical: isIncome && isCompanyOrPerson && f.category === "receitas-musicais",
    isReceitaServico: isIncome && isCompanyOrPerson && f.category === "servicos",
    isReceitaProduto: isIncome && isCompanyOrPerson && f.category === "produtos",
    hasTipoTransacao: Boolean(f.tipoTransacao),
  };
}

// ── DISPLAY_RULES — the single configurable source of truth for every boolean ─
// Each entry is a pure predicate (f, ctx) → boolean.
// To add, remove, or change a rule, edit only this map — no other code needs to change.
type BooleanRuleKey = Exclude<keyof FinancialFormRules, "labelTipoCliente">;
type RulePredicate  = (f: TransactionFormData, ctx: RuleContext) => boolean;

export const DISPLAY_RULES: Record<BooleanRuleKey, RulePredicate> = {
  exibirTipoCliente: (_f, ctx) =>
    ctx.hasTipoTransacao && !ctx.isImposto && !ctx.isTransferencia && !ctx.isInvestimento,

  exibirCategoria: (f, ctx) => {
    const categories = getCategoriesForTransactionType(f.tipoTransacao, f.tipoCliente);
    return categories.length > 0 && Boolean(f.tipoCliente || ctx.isImposto || ctx.isTransferencia || ctx.isInvestimento);
  },

  exibirSubcategoria: (f) => {
    const subs = getSubcategoriesForCategory(f.tipoTransacao, f.tipoCliente, f.category);
    return subs.length > 0;
  },

  exibirItemInvestimento: (f, ctx) => {
    const itens = getInvestmentItemsByCategory(f.category);
    return ctx.isInvestimento && Boolean(f.category) && itens.length > 0;
  },

  exibirArtista: (f, ctx) =>
    (ctx.isDespesaServico  && expenseServicesRequiringArtistAndProject.includes(f.subcategoria)) ||
    (ctx.isDespesaMarketing && Boolean(f.subcategoria)) ||
    (ctx.isDespesaViagem   && Boolean(f.subcategoria)) ||
    (ctx.isDespesaProduto  && Boolean(f.subcategoria)) ||
    ctx.isDespesaSuporteFinanceiro ||
    (ctx.isDespesaArtistaCaches && Boolean(f.subcategoria)) ||
    ctx.isDespesaArtistaSuporteFinanceiro ||
    (ctx.isReceitaMusical && Boolean(f.subcategoria)) ||
    (ctx.isReceitaServico && (
      revenueServicesRequiringArtistAndProject.includes(f.subcategoria) ||
      revenueServicesRequiringArtistOnly.includes(f.subcategoria)
    )) ||
    (ctx.isReceitaProduto && Boolean(f.subcategoria)),

  exibirProjeto: (f, ctx) =>
    (ctx.isDespesaServico   && expenseServicesRequiringArtistAndProject.includes(f.subcategoria)) ||
    (ctx.isDespesaMarketing && Boolean(f.subcategoria) && Boolean(f.artistaVinculado)) ||
    (ctx.isReceitaMusical   && musicRevenueRequiringArtistAndProject.includes(f.subcategoria)) ||
    (ctx.isReceitaServico   && revenueServicesRequiringArtistAndProject.includes(f.subcategoria)),

  projetoObrigatorio: (f, ctx) =>
    (ctx.isDespesaServico  && expenseServicesRequiringArtistAndProject.includes(f.subcategoria)) ||
    (ctx.isReceitaMusical  && musicRevenueRequiringArtistAndProject.includes(f.subcategoria)) ||
    (ctx.isReceitaServico  && revenueServicesRequiringArtistAndProject.includes(f.subcategoria)),

  exibirEvento: (f, ctx) =>
    (ctx.isDespesaProduto      && expenseProductsRequiringEvent.includes(f.subcategoria)) ||
    (ctx.isDespesaArtistaCaches && f.subcategoria === "show-evento") ||
    (ctx.isReceitaMusical       && ["participacao-show-evento", "venda-show-fechado"].includes(f.subcategoria)),

  exibirFornecedor: (_f, ctx) => (ctx.isDespesa || ctx.isReceita) && ctx.isEmpresaOuPessoa,

  exibirOrgaoArrecadador: (_f, ctx) => ctx.isImposto,

  exibirMotivoViagem: (f, ctx) => ctx.isDespesaViagem && Boolean(f.subcategoria),

  exibirAdvertisingName: (f, ctx) => ctx.isDespesaArtistaCaches && f.subcategoria === "publicidade",

  exibirParcelamento: (f) => f.tipoPagamento === "parcelado",
};

// ── computeFinancialRules — applies DISPLAY_RULES map + derives label ─────────
export function computeFinancialRules(f: TransactionFormData): FinancialFormRules {
  const ctx = buildContext(f);

  const booleans = Object.fromEntries(
    (Object.entries(DISPLAY_RULES) as [BooleanRuleKey, RulePredicate][]).map(
      ([key, predicate]) => [key, predicate(f, ctx)],
    ),
  ) as Record<BooleanRuleKey, boolean>;

  const labelClientType = ctx.isDespesa ? "Pagar quem" : ctx.isReceita ? "Receber de" : "Tipo de Cliente";

  return { ...booleans, labelTipoCliente: labelClientType };
}

