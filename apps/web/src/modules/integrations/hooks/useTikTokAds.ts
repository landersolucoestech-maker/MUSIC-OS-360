/**
 * integrations/hooks/useTikTokAds.ts
 *
 * Hook for the TikTok Ads Manager integration.
 * Credentials managed server-side (encrypted in the database).
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/shared/lib/api-client";

import { toUserMessage } from "@/shared/lib/errors";
export interface TikTokAdsStatus {
  connected: boolean;
  last_sync_at?: string | null;
  advertiser_id?: string | null;
  app_id?: string | null;
}

export interface TikTokAdsCredentials {
  app_id: string;
  secret: string;
  advertiser_id?: string;
}

export function useTikTokAdsStatus() {
  return useQuery<TikTokAdsStatus>({
    queryKey: ["integrations", "tiktok-ads", "status"],
    queryFn: async (): Promise<TikTokAdsStatus> => {
      return api.get<TikTokAdsStatus>("/integrations/tiktok/ads/status");
    },
    staleTime: 30_000,
  });
}

export function useTikTokAdsSaveCredentials() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: TikTokAdsCredentials) => {
      return api.post("/integrations/tiktok/ads/configure", {
        appId: input.app_id,
        secret: input.secret,
        advertiserId: input.advertiser_id,
        accessToken: "",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integrations", "tiktok-ads"] });
      toast.success("TikTok Ads conectado com sucesso.");
    },
    onError: (err: Error) => toast.error(toUserMessage(err)),
  });
}

export function useTikTokAdsDeleteCredentials() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      return api.delete("/integrations/tiktok/ads/disconnect");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integrations", "tiktok-ads"] });
      toast.success("TikTok Ads desconectado.");
    },
    onError: (err: Error) => toast.error(toUserMessage(err)),
  });
}

export function useTikTokAdsCampaigns() {
  return useQuery({
    queryKey: ["integrations", "tiktok-ads", "campaigns"],
    queryFn: async () => {
      return api.get("/integrations/tiktok/ads/campaigns");
    },
    staleTime: 60_000,
  });
}

