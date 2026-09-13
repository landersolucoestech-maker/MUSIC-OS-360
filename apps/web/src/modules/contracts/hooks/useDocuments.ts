import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { VinculadoDocument } from "@/modules/contracts/types/document-types";

// Documentos vinculados não possuem endpoint real ainda: leitura reporta o
// estado verdadeiro (vazio) e escrita falha explicitamente. É proibido simular
// o backend em localStorage ou devolver documents fictícios.
const DOCUMENTS_BACKEND_UNAVAILABLE =
  "Documentos de contrato ainda não possuem endpoint real no backend — operação indisponível.";

export const CONTRACTS_DOC_KEYS = {
  documents: ["contracts", "documents"] as const,
};

// Referência estável — ver shared/hooks/useDataQuery.ts para o motivo.
const EMPTY_DOCUMENTS: VinculadoDocument[] = [];

export function useDocuments() {
  const query = useQuery({
    queryKey: CONTRACTS_DOC_KEYS.documents,
    queryFn:  async (): Promise<VinculadoDocument[]> => [],
    staleTime: 1000 * 30,
  });
  return { ...query, data: query.data ?? EMPTY_DOCUMENTS };
}

export function useSaveDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (_doc: VinculadoDocument): Promise<VinculadoDocument> => {
      toast.error(DOCUMENTS_BACKEND_UNAVAILABLE);
      throw new Error(DOCUMENTS_BACKEND_UNAVAILABLE);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CONTRACTS_DOC_KEYS.documents });
    },
  });
}
