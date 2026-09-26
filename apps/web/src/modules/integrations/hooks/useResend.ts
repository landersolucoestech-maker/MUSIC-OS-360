import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { UserFacingError } from "@/shared/lib/errors";

interface ResendStatus {
  connected: boolean;
  has_api_key: boolean;
  has_global_fallback: boolean;
  from_address?: string;
  last_sync_at?: string;
  last_error?: string;
  status?: "ok" | "error";
}

export function useResendStatus() {
  return useQuery<ResendStatus>({
    queryKey: ["resend", "status"],
    queryFn: async () => ({
      connected: false,
      has_api_key: false,
      has_global_fallback: false,
    }),
    staleTime: Infinity,
  });
}

export function useResendSaveCredentials() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (_payload: { api_key: string; from_address?: string }) => {
      throw new UserFacingError("Resend integration unavailable in demo mode", "Integração Resend não disponível no modo demo.");
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["resend", "status"] });
    },
  });
}

export function useResendDeleteCredentials() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      throw new UserFacingError("Resend integration unavailable in demo mode", "Integração Resend não disponível no modo demo.");
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["resend", "status"] });
    },
  });
}
