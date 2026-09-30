import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { LinkedDocument } from "@/modules/contracts/types/document-types";

// Linked documents do not have a real endpoint yet: reading reports the
// true (empty) state and writing fails explicitly. Simulating
// the backend in localStorage or returning fictitious documents is forbidden.
const DOCUMENTS_BACKEND_UNAVAILABLE =
  "Documentos de contrato ainda não possuem endpoint real no backend — operação indisponível.";

export const CONTRACTS_DOC_KEYS = {
  documents: ["contracts", "documents"] as const,
};

// Stable reference — see shared/hooks/useDataQuery.ts for the reason.
const EMPTY_DOCUMENTS: LinkedDocument[] = [];

export function useDocuments() {
  const query = useQuery({
    queryKey: CONTRACTS_DOC_KEYS.documents,
    queryFn:  async (): Promise<LinkedDocument[]> => [],
    staleTime: 1000 * 30,
  });
  return { ...query, data: query.data ?? EMPTY_DOCUMENTS };
}

export function useSaveDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (_doc: LinkedDocument): Promise<LinkedDocument> => {
      toast.error(DOCUMENTS_BACKEND_UNAVAILABLE);
      throw new Error(DOCUMENTS_BACKEND_UNAVAILABLE);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CONTRACTS_DOC_KEYS.documents });
    },
  });
}
