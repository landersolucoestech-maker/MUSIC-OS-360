import { QUERY_KEYS } from "@/shared/lib/query-config";
import { useDataQuery } from "@/shared/hooks/useDataQuery";
import type { EmployeeDocument, EmployeeDocumentInsert, EmployeeDocumentUpdate } from "../types/hr.types";

export type { EmployeeDocument, EmployeeDocumentInsert, EmployeeDocumentUpdate };

export const DOCUMENT_TYPES = [
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

export function useEmployeeDocuments(employeeId?: string) {
  const result = useDataQuery<EmployeeDocument>({
    queryKey: [...QUERY_KEYS.EMPLOYEE_DOCUMENTS, ...(employeeId ? [employeeId] : [])],
    table: "documentos_funcionario",
    filters: employeeId ? { funcionario_id: employeeId } : undefined,
    enabled: !!employeeId,
  }, {
    create: { success: "Documento enviado com sucesso!", error: "Erro ao enviar documento" },
    update: { success: "Documento atualizado com sucesso!", error: "Erro ao atualizar documento" },
    delete: { success: "Documento excluído com sucesso!", error: "Erro ao excluir documento" },
  });

  return {
    documents: result.data,
    isLoading: result.isLoading,
    error: result.error,
    refetch: result.refetch,
    addDocumento: result.create,
    updateDocumento: result.update,
    deleteDocumento: result.delete,
  };
}
