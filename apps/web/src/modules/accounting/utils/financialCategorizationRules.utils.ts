import type {
  FinanceCategoryRule,
  FinanceCategoryRuleOrigin,
  FinanceCategoryRuleDraft,
  FinanceRuleTransactionType,
} from "../types/financial-categories.types";

export interface FinanceRuleValidationResult {
  valid: boolean;
  errors: string[];
}

const TRANSACTION_TYPES: FinanceRuleTransactionType[] = ["REVENUE", "EXPENSE"];
const RULE_ORIGINS: FinanceCategoryRuleOrigin[] = ["SYSTEM", "CUSTOM"];

export function isFinanceRuleTransactionType(value: string): value is FinanceRuleTransactionType {
  return TRANSACTION_TYPES.includes(value as FinanceRuleTransactionType);
}

export function isFinanceCategoryRuleOrigin(value: string): value is FinanceCategoryRuleOrigin {
  return RULE_ORIGINS.includes(value as FinanceCategoryRuleOrigin);
}

export function normalizeKeyword(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

export function parseKeywords(value: string | string[]): string[] {
  const raw = Array.isArray(value) ? value : value.split(/[,\n;]/);
  return Array.from(new Set(raw.map(normalizeKeyword).filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

export function validateRule(
  draft: FinanceCategoryRuleDraft,
  existingRules: FinanceCategoryRule[],
  editingId?: string,
): FinanceRuleValidationResult {
  const errors: string[] = [];
  const keywords = parseKeywords(draft.keywords);

  if (keywords.length === 0) errors.push("Informe pelo menos uma palavra-chave.");
  if (!draft.categoryId || !draft.categoryName) errors.push("Selecione uma categoria financeira.");
  if (!["REVENUE", "EXPENSE"].includes(draft.transactionType)) errors.push("Selecione um tipo de transação válido.");

  const conflicts = existingRules
    .filter((rule) => rule.id !== editingId && rule.transactionType === draft.transactionType)
    .flatMap((rule) => rule.keywords.map((keyword) => ({ keyword, rule })))
    .filter(({ keyword }) => keywords.includes(normalizeKeyword(keyword)));

  if (conflicts.length > 0 && draft.priority === undefined) {
    errors.push("Há palavra-chave conflitante. Defina uma prioridade para resolver a precedência.");
  }

  return { valid: errors.length === 0, errors };
}
