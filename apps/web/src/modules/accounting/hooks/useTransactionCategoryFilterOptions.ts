/**
 * Category filter options of the transactions list: every value that can be
 * stored in transactions.category —
 * - categories of the category-rule store (what the transaction form writes);
 * - names of the tenant's financial categories and of the system keyword
 *   rules (what the server keyword categorization writes);
 * - the taxonomy slugs (historical rows, OFX placeholder).
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { buildTransactionCategoryFilterOptions } from "../constants/transaction-constants";
import { SYSTEM_FINANCE_CATEGORY_RULES } from "../data/finance-category-rules.config";
import { financialCategoriesService } from "../services/financial-categories.service";
import { useFinancialCategoryRulesStore } from "./useFinancialCategoryRulesStore";

export function useTransactionCategoryFilterOptions() {
  const { rules } = useFinancialCategoryRulesStore();
  const financialCategories = useQuery({
    queryKey: ["financial-categories", "transaction-filter-names"],
    queryFn: () => financialCategoriesService.list({ limit: 300 }),
    staleTime: 5 * 60_000,
  });

  const options = useMemo(
    () =>
      buildTransactionCategoryFilterOptions([
        ...rules.filter((rule) => rule.active).map((rule) => rule.category),
        ...SYSTEM_FINANCE_CATEGORY_RULES.map((rule) => rule.categoryName),
        ...(financialCategories.data ?? []).map((category) => category.name),
      ]),
    [rules, financialCategories.data],
  );

  return { options, isLoadingFinancialCategories: financialCategories.isLoading };
}
