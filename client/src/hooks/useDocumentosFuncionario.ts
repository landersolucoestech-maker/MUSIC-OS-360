import type { Tables, TablesInsert, TablesUpdate } from "@/types/database";
import { QUERY_KEYS } from "@/lib/query-config";
import { useSupabaseQuery } from "./useSupabaseQuery";

export type DocumentoFuncionario = Tables<"documentos_funcionario">;
export type DocumentoFuncionarioInsert = Omit<TablesInsert<"documentos_funcionario">, "user_id">;
export type DocumentoFuncionarioUpdate = TablesUpdate<"documentos_funcionario">;

export const TIPOS_DOCUMENTO = [
  "RG",
  "CPF",
  "CTPS",
  "Contrato",
  "Comprovante de Residência",
  "Certidão",
  "Atestado",
  "Diploma",
  "Outro",
] as const;

export function useDocumentosFuncionario(funcionarioId?: string) {
  const result = useSupabaseQuery<DocumentoFuncionario>({
    queryKey: [...QUERY_KEYS.DOCUMENTOS_FUNCIONARIO, ...(funcionarioId ? [funcionarioId] : [])],
    table: "documentos_funcionario",
    filters: funcionarioId ? { funcionario_id: funcionarioId } : undefined,
    enabled: !!funcionarioId,
  }, {
    create: { success: "Documento enviado com sucesso!", error: "Erro ao enviar documento" },
    update: { success: "Documento atualizado com sucesso!", error: "Erro ao atualizar documento" },
    delete: { success: "Documento excluído com sucesso!", error: "Erro ao excluir documento" },
  });

  return {
    documentos: result.data,
    isLoading: result.isLoading,
    error: result.error,
    refetch: result.refetch,
    addDocumento: result.create,
    updateDocumento: result.update,
    deleteDocumento: result.delete,
  };
}
