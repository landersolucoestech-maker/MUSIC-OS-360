import { useMemo } from "react";
import type { TransactionFormData } from "@/modules/accounting/constants/transaction-constants";
import {
  getCategoriesForTransactionType,
  getSubcategoriesForCategory,
  getInvestmentItemsByCategory,
} from "@/modules/accounting/constants/transaction-constants";
import {
  computeFinancialRules,
  type FinancialFormRules,
  DISPLAY_RULES,
} from "@/modules/accounting/components/transaction-form/rules/financial-form-rules";
import { getStoredOverrides, buildKey } from "./useRuleOverrides";

interface Event  { id: string; artist_id?: string | null; title: string; start_date?: string | null }

export interface FinancialRulesResult extends FinancialFormRules {
  categories:          { value: string; label: string }[];
  subcategorias:       { value: string; label: string }[];
  itensInvestimento:   { value: string; label: string }[];
  filteredEvents:    Event[];
  valorParcela:        string | null;
}

interface UseFinancialRulesOptions {
  formData:  TransactionFormData;
  events:   Event[];
}

export function useFinancialRules({
  formData,
  events,
}: UseFinancialRulesOptions): FinancialRulesResult {
  const rules = useMemo(() => {
    const computed = computeFinancialRules(formData);
    const stored   = getStoredOverrides();
    if (Object.keys(stored).length === 0) return computed;

    // Apply stored overrides for matching combination
    const { transactionType, counterpartyType, category } = formData;
    const overridden: FinancialFormRules = { ...computed };
    for (const ruleKey of Object.keys(DISPLAY_RULES) as (keyof typeof DISPLAY_RULES)[]) {
      const k = buildKey(transactionType, counterpartyType, category, ruleKey);
      if (k in stored) {
        overridden[ruleKey] = stored[k];
      }
    }
    return overridden;
  }, [formData]);

  const categories = useMemo(
    () => getCategoriesForTransactionType(formData.transactionType, formData.counterpartyType),
    [formData.transactionType, formData.counterpartyType],
  );

  const subcategorias = useMemo(
    () => getSubcategoriesForCategory(formData.transactionType, formData.counterpartyType, formData.category),
    [formData.transactionType, formData.counterpartyType, formData.category],
  );

  const investmentItems = useMemo(
    () => getInvestmentItemsByCategory(formData.category),
    [formData.category],
  );

  const filteredEvents = useMemo(
    () => formData.artistId
      ? events.filter(e => e.artist_id != null && e.artist_id === formData.artistId)
      : [],
    [formData.artistId, events],
  );

  const installmentAmount = useMemo(() => {
    if (formData.paymentType === "installments" && formData.amount && formData.installmentCount) {
      const v = parseFloat(formData.amount);
      const p = parseInt(formData.installmentCount);
      if (v > 0 && p >= 2) return (v / p).toFixed(2);
    }
    return null;
  }, [formData.paymentType, formData.amount, formData.installmentCount]);

  return {
    ...rules,
    categories,
    subcategorias,
    itensInvestimento: investmentItems,
    filteredEvents,
    valorParcela: installmentAmount,
  };
}
