import { api } from "@/lib/api";
import type {
  FinanceCategoryRule,
  FinanceCategoryRuleApiResponse,
  FinanceCategoryRuleDraft,
  FinancialCategory,
} from "../types/financial-categories.types";

function mapApiRule(rule: FinanceCategoryRuleApiResponse, categories: FinancialCategory[] = []): FinanceCategoryRule {
  const category = categories.find((item) => item.id === rule.category_id);
  return {
    id: rule.id,
    keywords: rule.keywords,
    transactionType: rule.transaction_type,
    categoryId: rule.category_id,
    categoryName: category?.name ?? "Categoria não identificada",
    origin: "CUSTOM",
    priority: rule.priority,
    active: rule.active,
    createdAt: rule.created_at,
    updatedAt: rule.updated_at,
  };
}

function toApiPayload(draft: FinanceCategoryRuleDraft) {
  return {
    keywords: draft.keywords,
    transaction_type: draft.transactionType,
    category_id: draft.categoryId,
    priority: draft.priority,
    active: draft.active,
  };
}

export const financeCategoryRulesService = {
  async list(categories: FinancialCategory[] = []) {
    // api.get() already unwraps the {data,timestamp} envelope; since the controller
    // returns {data:[...],meta} directly, the value here already IS the array.
    const rules = await api.get<FinanceCategoryRuleApiResponse[]>("/finance-category-rules?limit=300");
    return rules.map((rule) => mapApiRule(rule, categories));
  },
  async create(draft: FinanceCategoryRuleDraft) {
    const rule = await api.post<FinanceCategoryRuleApiResponse>("/finance-category-rules", toApiPayload(draft));
    return mapApiRule(rule);
  },
  async update(id: string, draft: FinanceCategoryRuleDraft, expectedUpdatedAt?: string) {
    const rule = await api.patch<FinanceCategoryRuleApiResponse>(`/finance-category-rules/${id}`, {
      ...toApiPayload(draft),
      expectedUpdatedAt,
    });
    return mapApiRule(rule);
  },
  async remove(id: string) {
    await api.delete(`/finance-category-rules/${id}`);
    return { deleted: true };
  },
};
