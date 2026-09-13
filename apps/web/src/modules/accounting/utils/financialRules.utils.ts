import type {
  FinancialCategoryLink,
  FinancialCategoryRuleEntity,
  FinancialCounterpartyType,
  FinancialTransactionType,
} from "@/modules/accounting/types/financial-category-rules.types";

export type SelectOption = { value: string; label: string };

const transactionTypeValueByLabel: Record<FinancialTransactionType, string> = {
  Receita: "receita",
  Despesa: "despesa",
  Investimento: "investimento",
  Imposto: "imposto",
  Transferência: "transferencia",
};

const counterpartyValueByLabel: Record<FinancialCounterpartyType, string> = {
  Empresa: "empresa",
  Pessoa: "pessoa",
  Artista: "artista",
  Governo: "governo",
  "Conta Própria": "conta-propria",
};

const linkValueByLabel: Record<FinancialCategoryLink, string> = {
  Artista: "artista",
  Projeto: "projeto",
  Contrato: "contrato",
  Evento: "evento",
  "Centro de custo": "centro-custo",
  Competência: "competencia",
  "Conta Origem": "conta-origem",
  "Conta Destino": "conta-destino",
};

const transactionTypeLabelByValue = invertMap(transactionTypeValueByLabel);
const counterpartyLabelByValue = invertMap(counterpartyValueByLabel);
const linkLabelByValue = invertMap(linkValueByLabel);

function invertMap<T extends string>(map: Record<T, string>): Record<string, T> {
  return (Object.keys(map) as T[]).reduce<Record<string, T>>((acc, label) => {
    const value = map[label];
    acc[value] = label;
    return acc;
  }, {});
}

function uniqueSorted<T extends string>(items: T[]): T[] {
  return Array.from(new Set(items)).sort((a, b) => a.localeCompare(b, "pt-BR"));
}

function asOptions<T extends string>(items: T[], valueByLabel: Record<T, string>): SelectOption[] {
  return items.map((label) => ({ value: valueByLabel[label], label }));
}

export function getActiveRules(rules: FinancialCategoryRuleEntity[]): FinancialCategoryRuleEntity[] {
  return rules
    .filter((rule) => rule.active)
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order || a.category.localeCompare(b.category, "pt-BR"));
}

export function getTransactionTypes(rules: FinancialCategoryRuleEntity[]): SelectOption[] {
  const labels = uniqueSorted(getActiveRules(rules).map((rule) => rule.transaction_type));
  return asOptions(labels, transactionTypeValueByLabel);
}

export function getCounterpartiesByType(
  rules: FinancialCategoryRuleEntity[],
  transactionType: string,
): SelectOption[] {
  const typeLabel = toRuleTransactionType(transactionType);
  if (!typeLabel) return [];

  const labels = uniqueSorted(
    getActiveRules(rules)
      .filter((rule) => rule.transaction_type === typeLabel)
      .map((rule) => rule.counterparty_type),
  );

  return asOptions(labels, counterpartyValueByLabel);
}

export function getCategoriesByCounterparty(
  rules: FinancialCategoryRuleEntity[],
  transactionType: string,
  counterpartyType: string,
): SelectOption[] {
  const typeLabel = toRuleTransactionType(transactionType);
  const counterpartyLabel = toRuleCounterpartyType(counterpartyType);
  if (!typeLabel || !counterpartyLabel) return [];

  return uniqueSorted(
    getActiveRules(rules)
      .filter(
        (rule) =>
          rule.transaction_type === typeLabel &&
          rule.counterparty_type === counterpartyLabel,
      )
      .map((rule) => rule.category),
  ).map((category) => ({ value: category, label: category }));
}

export function getSubcategoriesByCategory(
  rules: FinancialCategoryRuleEntity[],
  transactionType: string,
  counterpartyType: string,
  category: string,
): SelectOption[] {
  const typeLabel = toRuleTransactionType(transactionType);
  const counterpartyLabel = toRuleCounterpartyType(counterpartyType);
  if (!typeLabel || !counterpartyLabel || !category) return [];

  return uniqueSorted(
    getActiveRules(rules)
      .filter(
        (rule) =>
          rule.transaction_type === typeLabel &&
          rule.counterparty_type === counterpartyLabel &&
          rule.category === category &&
          Boolean(rule.subcategory?.trim()),
      )
      .map((rule) => rule.subcategory as string),
  ).map((subcategory) => ({ value: subcategory, label: subcategory }));
}

export function getFinalRule(
  rules: FinancialCategoryRuleEntity[],
  transactionType: string,
  counterpartyType: string,
  category: string,
  subcategory: string,
): FinancialCategoryRuleEntity | null {
  const typeLabel = toRuleTransactionType(transactionType);
  const counterpartyLabel = toRuleCounterpartyType(counterpartyType);
  if (!typeLabel || !counterpartyLabel || !category) return null;

  const candidates = getActiveRules(rules).filter(
    (rule) =>
      rule.transaction_type === typeLabel &&
      rule.counterparty_type === counterpartyLabel &&
      rule.category === category,
  );

  const hasSubcategories = candidates.some((rule) => Boolean(rule.subcategory?.trim()));
  if (hasSubcategories) {
    if (!subcategory) return null;
    return candidates.find((rule) => rule.subcategory === subcategory) ?? null;
  }

  return candidates.find((rule) => !rule.subcategory?.trim()) ?? null;
}

export function getLinksFromRule(rule: FinancialCategoryRuleEntity | null): FinancialCategoryLink[] {
  return rule?.links?.filter(Boolean) ?? [];
}

export function toRuleTransactionType(value: string): FinancialTransactionType | null {
  return transactionTypeLabelByValue[value] ?? null;
}

export function toRuleCounterpartyType(value: string): FinancialCounterpartyType | null {
  return counterpartyLabelByValue[value] ?? null;
}

export function toRuleLink(value: string): FinancialCategoryLink | null {
  return linkLabelByValue[value] ?? null;
}

export function toFormTransactionType(label: FinancialTransactionType): string {
  return transactionTypeValueByLabel[label];
}

export function toFormCounterpartyType(label: FinancialCounterpartyType): string {
  return counterpartyValueByLabel[label];
}

export function toFormLink(label: FinancialCategoryLink): string {
  return linkValueByLabel[label];
}

export function getLinkOptions(rule: FinancialCategoryRuleEntity | null): SelectOption[] {
  return getLinksFromRule(rule).map((link) => ({ value: toFormLink(link), label: link }));
}

export function isValidRuleCombination(
  rules: FinancialCategoryRuleEntity[],
  transactionType: string,
  counterpartyType: string,
  category: string,
  subcategory: string,
): boolean {
  return Boolean(getFinalRule(rules, transactionType, counterpartyType, category, subcategory));
}

export type PaymentCondition =
  | "full_upfront"
  | "half_half"
  | "after_completion"
  | "installments"
  | "custom"
  | "no_invoice_now";

export type PaymentScheduleItem = {
  invoice_type: "deposit" | "remaining" | "full" | "installment" | "custom";
  amount: number;
  due_in_days: number;
  description: string;
};

export function calculatePaymentSchedule(
  totalAmount: number,
  paymentCondition: PaymentCondition,
  terms: Record<string, unknown> = {},
): PaymentScheduleItem[] {
  const total = roundMoney(totalAmount);
  if (total <= 0 || paymentCondition === "no_invoice_now") return [];

  if (paymentCondition === "half_half") {
    const deposit = roundMoney(total / 2);
    return [
      { invoice_type: "deposit", amount: deposit, due_in_days: 0, description: "Entrada 50%" },
      { invoice_type: "remaining", amount: roundMoney(total - deposit), due_in_days: 30, description: "Restante 50%" },
    ];
  }

  if (paymentCondition === "after_completion") {
    return [{ invoice_type: "remaining", amount: total, due_in_days: 30, description: "Pagamento após conclusão" }];
  }

  if (paymentCondition === "installments") {
    const installments = Math.max(1, Number(terms.installments ?? 1));
    const base = roundMoney(total / installments);
    return Array.from({ length: installments }, (_, index) => ({
      invoice_type: "installment",
      amount: index === installments - 1 ? roundMoney(total - base * (installments - 1)) : base,
      due_in_days: index * 30,
      description: `Parcela ${index + 1}/${installments}`,
    }));
  }

  if (paymentCondition === "custom" && Array.isArray(terms.schedule)) {
    return terms.schedule
      .map((item, index) => item as Record<string, unknown>)
      .map((item, index) => ({
        invoice_type: "custom" as const,
        amount: roundMoney(Number(item.amount ?? 0)),
        due_in_days: Number(item.due_in_days ?? index * 30),
        description: String(item.description ?? `Cobrança ${index + 1}`),
      }))
      .filter((item) => item.amount > 0);
  }

  return [{ invoice_type: "full", amount: total, due_in_days: 0, description: "Pagamento integral" }];
}

export function generateInvoiceForSale(schedule: PaymentScheduleItem[], invoiceType?: string): PaymentScheduleItem | null {
  return schedule.find((item) => !invoiceType || item.invoice_type === invoiceType) ?? schedule[0] ?? null;
}

export function markInvoiceAsPaid(invoice: { status: string }, amountPaid: number) {
  if (invoice.status === "paid") throw new Error("INVOICE_ALREADY_PAID");
  return { status: "paid" as const, amount_paid: roundMoney(amountPaid) };
}

export function createFinancialTransactionFromPaidInvoice(input: {
  sale_id: string;
  invoice_id: string;
  amount_paid: number;
  payment_method: string;
}) {
  return {
    type: "receita",
    status: "paid",
    valor: roundMoney(input.amount_paid),
    metadata: input,
  };
}

export function sendInvoiceByWhatsapp(invoiceId: string, recipient?: string) {
  return { invoice_id: invoiceId, channel: "whatsapp", recipient: recipient ?? null };
}

export function sendInvoiceByEmail(invoiceId: string, recipient?: string) {
  return { invoice_id: invoiceId, channel: "email", recipient: recipient ?? null };
}

export function createAppointmentAfterDepositPaid(status: string): boolean {
  return ["deposit_paid", "partially_paid", "paid", "approved_without_invoice"].includes(status);
}

export function generateRemainingInvoice(totalAmount: number, paidAmount: number): PaymentScheduleItem | null {
  const amount = roundMoney(totalAmount - paidAmount);
  return amount > 0 ? { invoice_type: "remaining", amount, due_in_days: 0, description: "Cobrança restante" } : null;
}

export function generateContract(input: { title: string; content?: string; description: string }) {
  return {
    title: input.title,
    content: input.content?.trim() || `Contrato referente a: ${input.description}`,
    status: "generated" as const,
  };
}

export function generateContractPDF(contractId: string) {
  return { contract_id: contractId, pdf_url: null, status: "pending_renderer" };
}

export function sendContract(contractId: string, recipient?: string) {
  return { contract_id: contractId, recipient: recipient ?? null };
}

export function markContractAsSigned(signedAt = new Date().toISOString(), signedPdfUrl?: string) {
  return { status: "signed" as const, signed_at: signedAt, signed_pdf_url: signedPdfUrl ?? null };
}

function roundMoney(value: number): number {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

