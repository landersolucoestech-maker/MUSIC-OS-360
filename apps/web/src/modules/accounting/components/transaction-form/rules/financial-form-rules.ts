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
import { canonicalTransactionSlug } from "@/modules/accounting/constants/transaction-category-slugs";

export interface FinancialFormRules {
  showClientType:      boolean;
  showCategory:        boolean;
  showSubcategory:     boolean;
  showInvestmentItem: boolean;
  showArtist:          boolean;
  showProject:          boolean;
  projectRequired:     boolean;
  showEvent:           boolean;
  showSupplier:       boolean;
  showCollectingAgency: boolean;
  showTravelReason:     boolean;
  showAdvertisingName:  boolean;
  showInstallments:     boolean;
  clientTypeLabel:       string;
}

// ── Rule context ─────────────────────────────────────────────────────────────
// Intermediate booleans derived from formData that predicates can reference.
interface RuleContext {
  isTax:      boolean;
  isTransfer: boolean;
  isInvestment: boolean;
  isExpense:      boolean;
  isRevenue:      boolean;
  isCompany:      boolean;
  isArtist:      boolean;
  isPerson:       boolean;
  isCompanyOrPerson: boolean;
  isExpenseService:             boolean;
  isExpenseMarketing:           boolean;
  isExpenseTravel:              boolean;
  isExpenseProduct:             boolean;
  isExpenseFinancialSupport:   boolean;
  isExpenseArtistFees:       boolean;
  isExpenseArtistFinancialSupport: boolean;
  isRevenueMusic: boolean;
  isRevenueService: boolean;
  isRevenueProduct: boolean;
  hasTransactionType: boolean;
}

// Category/subcategory are compared by their canonical English id; a stored row that still
// holds the legacy Portuguese slug (not yet backfilled) behaves exactly like its canonical twin.
function buildContext(raw: TransactionFormData): RuleContext {
  const f = { ...raw, category: canonicalTransactionSlug(raw.category) };
  const isTax       = f.transactionType === "tax";
  const isTransfer = f.transactionType === "transfer";
  const isInvestment  = f.transactionType === "investment";
  const isExpense       = f.transactionType === "expense";
  const isRevenue       = f.transactionType === "revenue";
  const isCompany       = f.counterpartyType === "company";
  const isArtist       = f.counterpartyType === "artist";
  const isPerson        = f.counterpartyType === "individual";
  const isCompanyOrPerson = isCompany || isPerson;
  return {
    isTax, isTransfer, isInvestment, isExpense, isRevenue,
    isCompany, isArtist, isPerson, isCompanyOrPerson,
    isExpenseService:             isExpense && isCompanyOrPerson && f.category === "services",
    isExpenseMarketing:           isExpense && isCompanyOrPerson && f.category === "marketing",
    isExpenseTravel:              isExpense && isCompanyOrPerson && f.category === "travel",
    isExpenseProduct:             isExpense && isCompanyOrPerson && f.category === "products",
    isExpenseFinancialSupport:   isExpense && isCompanyOrPerson && f.category === "financial_support",
    isExpenseArtistFees:       isExpense && isArtist && f.category === "performance_fees",
    isExpenseArtistFinancialSupport: isExpense && isArtist && f.category === "financial_support",
    isRevenueMusic: isRevenue && isCompanyOrPerson && f.category === "music_revenue",
    isRevenueService: isRevenue && isCompanyOrPerson && f.category === "services",
    isRevenueProduct: isRevenue && isCompanyOrPerson && f.category === "products",
    hasTransactionType: Boolean(f.transactionType),
  };
}

// ── DISPLAY_RULES — the single configurable source of truth for every boolean ─
// Each entry is a pure predicate (f, ctx) → boolean.
// To add, remove, or change a rule, edit only this map — no other code needs to change.
type BooleanRuleKey = Exclude<keyof FinancialFormRules, "clientTypeLabel">;
type RulePredicate  = (f: TransactionFormData, ctx: RuleContext) => boolean;

export const DISPLAY_RULES: Record<BooleanRuleKey, RulePredicate> = {
  showClientType: (_f, ctx) =>
    ctx.hasTransactionType && !ctx.isTax && !ctx.isTransfer && !ctx.isInvestment,

  showCategory: (f, ctx) => {
    const categories = getCategoriesForTransactionType(f.transactionType, f.counterpartyType);
    return categories.length > 0 && Boolean(f.counterpartyType || ctx.isTax || ctx.isTransfer || ctx.isInvestment);
  },

  showSubcategory: (f) => {
    const subs = getSubcategoriesForCategory(f.transactionType, f.counterpartyType, f.category);
    return subs.length > 0;
  },

  showInvestmentItem: (f, ctx) => {
    const items = getInvestmentItemsByCategory(f.category);
    return ctx.isInvestment && Boolean(f.category) && items.length > 0;
  },

  showArtist: (f, ctx) =>
    (ctx.isExpenseService  && expenseServicesRequiringArtistAndProject.includes(canonicalTransactionSlug(f.subcategory))) ||
    (ctx.isExpenseMarketing && Boolean(f.subcategory)) ||
    (ctx.isExpenseTravel   && Boolean(f.subcategory)) ||
    (ctx.isExpenseProduct  && Boolean(f.subcategory)) ||
    ctx.isExpenseFinancialSupport ||
    (ctx.isExpenseArtistFees && Boolean(f.subcategory)) ||
    ctx.isExpenseArtistFinancialSupport ||
    (ctx.isRevenueMusic && Boolean(f.subcategory)) ||
    (ctx.isRevenueService && (
      revenueServicesRequiringArtistAndProject.includes(canonicalTransactionSlug(f.subcategory)) ||
      revenueServicesRequiringArtistOnly.includes(canonicalTransactionSlug(f.subcategory))
    )) ||
    (ctx.isRevenueProduct && Boolean(f.subcategory)),

  showProject: (f, ctx) =>
    (ctx.isExpenseService   && expenseServicesRequiringArtistAndProject.includes(canonicalTransactionSlug(f.subcategory))) ||
    (ctx.isExpenseMarketing && Boolean(f.subcategory) && Boolean(f.artistId)) ||
    (ctx.isRevenueMusic   && musicRevenueRequiringArtistAndProject.includes(canonicalTransactionSlug(f.subcategory))) ||
    (ctx.isRevenueService   && revenueServicesRequiringArtistAndProject.includes(canonicalTransactionSlug(f.subcategory))),

  projectRequired: (f, ctx) =>
    (ctx.isExpenseService  && expenseServicesRequiringArtistAndProject.includes(canonicalTransactionSlug(f.subcategory))) ||
    (ctx.isRevenueMusic  && musicRevenueRequiringArtistAndProject.includes(canonicalTransactionSlug(f.subcategory))) ||
    (ctx.isRevenueService  && revenueServicesRequiringArtistAndProject.includes(canonicalTransactionSlug(f.subcategory))),

  showEvent: (f, ctx) =>
    (ctx.isExpenseProduct      && expenseProductsRequiringEvent.includes(canonicalTransactionSlug(f.subcategory))) ||
    (ctx.isExpenseArtistFees && canonicalTransactionSlug(f.subcategory) === "show_event") ||
    (ctx.isRevenueMusic       && ["show_event_participation", "closed_show_sale"].includes(canonicalTransactionSlug(f.subcategory))),

  showSupplier: (_f, ctx) => (ctx.isExpense || ctx.isRevenue) && ctx.isCompanyOrPerson,

  showCollectingAgency: (_f, ctx) => ctx.isTax,

  showTravelReason: (f, ctx) => ctx.isExpenseTravel && Boolean(f.subcategory),

  showAdvertisingName: (f, ctx) => ctx.isExpenseArtistFees && canonicalTransactionSlug(f.subcategory) === "advertising",

  showInstallments: (f) => f.paymentType === "installments",
};

// ── computeFinancialRules — applies DISPLAY_RULES map + derives label ─────────
export function computeFinancialRules(f: TransactionFormData): FinancialFormRules {
  const ctx = buildContext(f);

  const booleans = Object.fromEntries(
    (Object.entries(DISPLAY_RULES) as [BooleanRuleKey, RulePredicate][]).map(
      ([key, predicate]) => [key, predicate(f, ctx)],
    ),
  ) as Record<BooleanRuleKey, boolean>;

  const labelClientType = ctx.isExpense ? "Pagar quem" : ctx.isRevenue ? "Receber de" : "Tipo de Cliente";

  return { ...booleans, clientTypeLabel: labelClientType };
}

