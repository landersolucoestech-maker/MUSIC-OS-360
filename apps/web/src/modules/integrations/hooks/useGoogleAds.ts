/**
 * integrations/hooks/useGoogleAds.ts
 *
 * Hook for the Google Ads integration.
 * Credentials managed server-side (encrypted in the database).
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/shared/lib/api-client";

export interface GoogleAdsStatus {
  connected: boolean;
  last_sync_at?: string | null;
  manager_account_id?: string | null;
  client_id?: string | null;
}

export interface GoogleAdsCredentials {
  developer_token: string;
  client_id: string;
  client_secret: string;
  manager_account_id?: string;
}

export function useGoogleAdsStatus() {
  return useQuery<GoogleAdsStatus>({
    queryKey: ["integrations", "google-ads", "status"],
    queryFn: async (): Promise<GoogleAdsStatus> => {
      return api.get<GoogleAdsStatus>("/integrations/google-ads/status");
    },
    staleTime: 30_000,
  });
}

export function useGoogleAdsSaveCredentials() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: GoogleAdsCredentials) => {
      return api.post("/integrations/google-ads/configure", {
        developerToken: input.developer_token,
        customerId: input.manager_account_id ?? input.client_id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integrations", "google-ads"] });
      toast.success("Google Ads configurado com sucesso.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useGoogleAdsConnect() {
  return {
    connect: async () => {
      const { url } = await api.get<{ url: string }>("/integrations/google-ads/auth");
      const popup = window.open(url, "google_ads_oauth", "width=600,height=700");
      if (!popup) toast.error("Popup bloqueado. Permita popups para este site.");
    },
  };
}

export function useGoogleAdsDeleteCredentials() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      return api.delete("/integrations/google-ads/disconnect");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integrations", "google-ads"] });
      toast.success("Google Ads desconectado.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useGoogleAdsCampaigns() {
  return useQuery({
    queryKey: ["integrations", "google-ads", "campaigns"],
    queryFn: async () => {
      return api.get("/integrations/google-ads/campaigns");
    },
    staleTime: 60_000,
  });
}

