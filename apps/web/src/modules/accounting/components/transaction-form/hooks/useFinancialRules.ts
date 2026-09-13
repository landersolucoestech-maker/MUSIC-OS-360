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
  categorias:          { value: string; label: string }[];
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
    const { tipoTransacao, tipoCliente, categoria } = formData;
    const overridden: FinancialFormRules = { ...computed };
    for (const ruleKey of Object.keys(DISPLAY_RULES) as (keyof typeof DISPLAY_RULES)[]) {
      const k = buildKey(tipoTransacao, tipoCliente, categoria, ruleKey);
      if (k in stored) {
        overridden[ruleKey] = stored[k];
      }
    }
    return overridden;
  }, [formData]);

  const categorias = useMemo(
    () => getCategoriesForTransactionType(formData.tipoTransacao, formData.tipoCliente),
    [formData.tipoTransacao, formData.tipoCliente],
  );

  const subcategorias = useMemo(
    () => getSubcategoriesForCategory(formData.tipoTransacao, formData.tipoCliente, formData.categoria),
    [formData.tipoTransacao, formData.tipoCliente, formData.categoria],
  );

  const itensInvestimento = useMemo(
    () => getInvestmentItemsByCategory(formData.categoria),
    [formData.categoria],
  );

  const filteredEvents = useMemo(
    () => formData.artistaVinculado
      ? events.filter(e => e.artist_id != null && e.artist_id === formData.artistaVinculado)
      : [],
    [formData.artistaVinculado, events],
  );

  const valorParcela = useMemo(() => {
    if (formData.tipoPagamento === "parcelado" && formData.valor && formData.quantidadeParcelas) {
      const v = parseFloat(formData.valor);
      const p = parseInt(formData.quantidadeParcelas);
      if (v > 0 && p >= 2) return (v / p).toFixed(2);
    }
    return null;
  }, [formData.tipoPagamento, formData.valor, formData.quantidadeParcelas]);

  return {
    ...rules,
    categorias,
    subcategorias,
    itensInvestimento,
    filteredEvents,
    valorParcela,
  };
}
