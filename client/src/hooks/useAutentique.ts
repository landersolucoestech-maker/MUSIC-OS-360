import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  DisabledIntegrationError,
  INTEGRATION_DISABLED_CODE,
} from "@/lib/disabled-integration";
import { QUERY_KEYS } from "@/lib/query-config";

/** Stubs do Autentique — integração desligada (sem backend). */

export interface AutentiqueStatus {
  connected: boolean;
  status?: string;
  has_token?: boolean;
  last_error?: string | null;
  last_sync_at?: string | null;
  has_global_fallback?: boolean;
}

interface Signer {
  email: string;
  name: string;
  action: "SIGN" | "APPROVE" | "RECOGNIZE" | "WITNESS";
}

interface CreateDocumentParams {
  name: string;
  content: string;
  signers: Signer[];
  message?: string;
}

interface AutentiqueDocument {
  id: string;
  name: string;
  created_at: string;
  signatures: Array<{
    public_id: string;
    name: string;
    email: string;
    action?: { name: string };
    link?: { short_link: string };
    signed?: { created_at: string };
  }>;
  files?: { original: string; signed: string };
}

function fail(): never {
  throw new DisabledIntegrationError("Autentique");
}

export function useAutentiqueStatus() {
  return useQuery<AutentiqueStatus>({
    queryKey: ["autentique", "status"] as const,
    queryFn: async () => ({
      connected: false,
      status: INTEGRATION_DISABLED_CODE,
      last_error: "Integração Autentique desativada — backend não configurado.",
    }),
    staleTime: Infinity,
  });
}

export function useAutentiqueSaveCredentials() {
  return useMutation({
    mutationFn: async (_input: { token: string }) => fail(),
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useAutentiqueDeleteCredentials() {
  return useMutation({
    mutationFn: async () => fail(),
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useAutentique() {
  const documentsQuery = useQuery<AutentiqueDocument[]>({
    queryKey: [...QUERY_KEYS.AUTENTIQUE_DOCUMENTS],
    queryFn: async () => [],
    enabled: false,
  });

  const createDocument = useMutation({
    mutationFn: async (_params: CreateDocumentParams) => fail(),
    onError: (err: Error) => toast.error(err.message),
  });

  const getDocument = useMutation({
    mutationFn: async (_documentId: string) => fail(),
    onError: (err: Error) => toast.error(err.message),
  });

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64 = (reader.result as string).split(",")[1];
        resolve(base64);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  return {
    documents: documentsQuery.data ?? [],
    isLoadingDocuments: documentsQuery.isLoading,
    refetchDocuments: documentsQuery.refetch,
    createDocument,
    getDocument,
    fileToBase64,
    isCreating: createDocument.isPending,
  };
}
