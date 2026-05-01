import type { Tables, TablesInsert, TablesUpdate } from "@/types/database";
import { QUERY_KEYS } from "@/lib/query-config";
import { useSupabaseQuery } from "./useSupabaseQuery";

export type FeriasAusencia = Tables<"ferias_ausencias">;
export type FeriasAusenciaInsert = Omit<TablesInsert<"ferias_ausencias">, "user_id">;
export type FeriasAusenciaUpdate = TablesUpdate<"ferias_ausencias">;

export const TIPOS_AUSENCIA = [
  "férias",
  "licença médica",
  "licença maternidade",
  "licença paternidade",
  "falta justificada",
  "falta injustificada",
  "day off",
  "folga compensatória",
] as const;

export const STATUS_AUSENCIA = [
  "pendente",
  "aprovado",
  "rejeitado",
  "em andamento",
  "concluído",
] as const;

export function useFeriasAusencias() {
  const result = useSupabaseQuery<FeriasAusencia>({
    queryKey: [...QUERY_KEYS.FERIAS_AUSENCIAS],
    table: "ferias_ausencias",
  }, {
    create: { success: "Registro de ausência criado com sucesso!", error: "Erro ao criar registro de ausência" },
    update: { success: "Registro de ausência atualizado com sucesso!", error: "Erro ao atualizar registro de ausência" },
    delete: { success: "Registro de ausência excluído com sucesso!", error: "Erro ao excluir registro de ausência" },
  });

  return {
    feriasAusencias: result.data,
    isLoading: result.isLoading,
    error: result.error,
    refetch: result.refetch,
    addFeriasAusencia: result.create,
    updateFeriasAusencia: result.update,
    deleteFeriasAusencia: result.delete,
  };
}
