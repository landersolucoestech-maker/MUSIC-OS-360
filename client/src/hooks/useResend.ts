import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  DisabledIntegrationError,
  INTEGRATION_DISABLED_CODE,
} from "@/lib/disabled-integration";

/** Stubs do Resend — integração desligada (sem backend). */

export interface ResendStatus {
  connected: boolean;
  status?: string;
  has_api_key?: boolean;
  from_address?: string | null;
  last_error?: string | null;
  last_sync_at?: string | null;
  has_global_fallback?: boolean;
}

function fail(): never {
  throw new DisabledIntegrationError("Resend");
}

export function useResendStatus() {
  return useQuery<ResendStatus>({
    queryKey: ["resend", "status"] as const,
    queryFn: async () => ({
      connected: false,
      status: INTEGRATION_DISABLED_CODE,
      last_error: "Integração Resend desativada — backend não configurado.",
    }),
    staleTime: Infinity,
  });
}

export function useResendSaveCredentials() {
  return useMutation({
    mutationFn: async (_input: { api_key: string; from_address?: string }) => fail(),
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useResendDeleteCredentials() {
  return useMutation({
    mutationFn: async () => fail(),
    onError: (err: Error) => toast.error(err.message),
  });
}
