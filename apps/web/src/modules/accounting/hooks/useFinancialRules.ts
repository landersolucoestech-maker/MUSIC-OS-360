import { useDataQuery } from "@/shared/hooks/useDataQuery";
import { QUERY_KEYS } from "@/shared/lib/query-config";

export type FinancialRuleTrigger = "transaction.created" | "transaction.paid" | "invoice.overdue" | "contract.signed";
export type FinancialRuleType = "imposto" | "comissao" | "external_rights_fee" | "desconto" | "taxa" | "outros";
export type FinancialRuleCalculation = "percentual" | "fixo" | "faixa";

export interface FinancialRule {
  id: string;
  name: string;
  type: FinancialRuleType;
  category: string | null;
  calculo: FinancialRuleCalculation;
  value: number;
  description: string | null;
  active: boolean;
  condicoes: { triggers?: FinancialRuleTrigger[] } | null;
  created_at: string;
  updated_at: string;
}

export function useFinancialRules() {
  const result = useDataQuery<FinancialRule>({
    queryKey: [...QUERY_KEYS.FINANCIAL_RULES],
    table: "regras_financeiras",
    orderBy: { column: "name", ascending: true },
  }, {
    create: { success: "Regra criada com sucesso!", error: "Erro ao criar regra" },
    update: { success: "Regra atualizada com sucesso!", error: "Erro ao atualizar regra" },
    delete: { success: "Regra excluída com sucesso!", error: "Erro ao excluir regra" },
  });

  return {
    rules: result.data,
    isLoading: result.isLoading,
    createRule: result.create,
    updateRule: result.update,
    deleteRule: result.delete,
  };
}
