import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  DisabledIntegrationError,
  INTEGRATION_DISABLED_CODE,
} from "@/lib/disabled-integration";

/** Stubs do Meta Ads — integração desligada (sem backend). */

export type MetaAdsGlobalFallbackStatus = "valid" | "invalid" | "absent";

export interface MetaAdsStatus {
  connected: boolean;
  status?: string;
  ad_account_id?: string | null;
  has_token?: boolean;
  last_error?: string | null;
  last_sync_at?: string | null;
  has_global_fallback?: boolean;
  global_fallback_status?: MetaAdsGlobalFallbackStatus;
  global_fallback_error?: string | null;
}

export interface MetaAdsTestConnectionResult {
  ok: boolean;
  source: "org" | "env" | null;
  error?: string | null;
  identity?: { id: string; name: string };
}

function fail(): never {
  throw new DisabledIntegrationError("Meta Ads");
}

export function useMetaAdsStatus() {
  return useQuery<MetaAdsStatus>({
    queryKey: ["meta_ads", "status"] as const,
    queryFn: async () => ({
      connected: false,
      status: INTEGRATION_DISABLED_CODE,
      last_error: "Integração Meta Ads desativada — backend não configurado.",
      global_fallback_status: "absent",
    }),
    staleTime: Infinity,
  });
}

export function useMetaAdsSaveCredentials() {
  return useMutation({
    mutationFn: async (_input: {
      access_token: string;
      ad_account_id?: string;
    }) => fail(),
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useMetaAdsTestConnection() {
  return useMutation<MetaAdsTestConnectionResult>({
    mutationFn: async () => fail(),
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useMetaAdsDeleteCredentials() {
  return useMutation({
    mutationFn: async () => fail(),
    onError: (err: Error) => toast.error(err.message),
  });
}
