import type { Tables, TablesInsert, TablesUpdate } from "@/types/database";
import { QUERY_KEYS } from "@/lib/query-config";
import { useSupabaseQuery } from "./useSupabaseQuery";

export type Funcionario = Tables<"funcionarios">;
export type FuncionarioInsert = Omit<TablesInsert<"funcionarios">, "user_id">;
export type FuncionarioUpdate = TablesUpdate<"funcionarios">;

export const SETORES = [
  "Administrativo",
  "Financeiro",
  "Marketing",
  "Jurídico",
  "Produção Musical",
  "A&R",
  "TI",
  "RH",
  "Comercial",
  "Operações",
] as const;

export const TIPOS_CONTRATO = [
  "CLT",
  "PJ",
  "Freelancer",
  "Estágio",
  "Temporário",
] as const;

export const STATUS_FUNCIONARIO = [
  "ativo",
  "inativo",
  "férias",
  "afastado",
  "desligado",
] as const;

export function useFuncionarios() {
  const result = useSupabaseQuery<Funcionario>({
    queryKey: [...QUERY_KEYS.FUNCIONARIOS],
    table: "funcionarios",
  }, {
    create: { success: "Funcionário criado com sucesso!", error: "Erro ao criar funcionário" },
    update: { success: "Funcionário atualizado com sucesso!", error: "Erro ao atualizar funcionário" },
    delete: { success: "Funcionário excluído com sucesso!", error: "Erro ao excluir funcionário" },
  });

  return {
    funcionarios: result.data,
    isLoading: result.isLoading,
    error: result.error,
    refetch: result.refetch,
    addFuncionario: result.create,
    updateFuncionario: result.update,
    deleteFuncionario: result.delete,
  };
}
