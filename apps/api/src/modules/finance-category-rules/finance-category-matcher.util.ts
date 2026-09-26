/**
 * finance-category-matcher.util.ts
 *
 * Task W — deterministic matching engine between a transaction
 * (type + description) and the keyword categorization rules
 * (finance_category_keyword_rules). A faithful port of the algorithm already used (but
 * never called in production) by the frontend in
 * apps/web/src/modules/accounting/utils/financialCategorizationRules.utils.ts
 * (matchTransactionCategory) — same normalization, same priority
 * criterion — so the behavior is identical on both ends
 * and there is ONE SINGLE real implementation of the matcher (the backend, the right
 * place in the architecture to apply the rule when creating/importing transactions).
 *
 * Single, pure, no I/O — testable in isolation and reusable by any
 * transaction creation path (manual, OFX, bulk import).
 */

export interface MatchableCategoryRule {
  id: string;
  keywords: string[];
  transaction_type: string;
  priority: number;
  active: boolean;
}

const DIACRITICS_REGEX = /[̀-ͯ]/g;

/** Same normalization as the frontend: strips accents, lowercases, collapses spaces. */
export function normalizeMatchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(DIACRITICS_REGEX, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Finds the active rule with the highest precedence for which some keyword appears in the
 * normalized description. Deterministic: assumes `rules` already arrives sorted
 * by a stable criterion (priority ASC, created_at ASC — same pattern as
 * FinanceCategoryRulesService.list()); on a priority tie, the
 * first one in the received list wins. An inactive rule or one for a different transaction
 * type never takes part.
 */
export function matchCategoryRule<T extends MatchableCategoryRule>(
  rules: T[],
  input: { descricao: string; transactionType: string },
): T | null {
  const haystack = normalizeMatchText(input.descricao ?? '');
  if (!haystack) return null;

  const candidates = rules.filter(
    (rule) => rule.active && rule.transaction_type === input.transactionType,
  );

  for (const rule of candidates) {
    if (rule.keywords.some((keyword) => haystack.includes(normalizeMatchText(keyword)))) {
      return rule;
    }
  }
  return null;
}
