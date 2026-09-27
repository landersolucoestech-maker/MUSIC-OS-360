/**
 * integrations/hooks/useTikTok.ts
 *
 * Hook for the organic TikTok integration (Login Kit — distinct from TikTok Ads,
 * see useTikTokAds.ts). The backend has a real, working OAuth flow
 * (GET /integrations/tiktok/auth, POST /integrations/tiktok/callback,
 * GET /integrations/tiktok/status, DELETE /integrations/tiktok/disconnect —
 * apps/api/src/modules/integrations/tiktok/tiktok.service.ts), but the TikTok
 * Display API exposes no video/sound metrics endpoints for this developer
 * account — that is why useTikTokVideoMetrics/useTikTokSoundMetrics
 * stay unavailable (it is not a mock, it is a real API limitation).
 *
 * Contract: @/shared/integrations/contracts/streaming.contract → IStreamingProvider
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/shared/lib/api-client";
import { disabledIntegration } from "@/shared/lib/disabled-integration";

import { toUserMessage } from "@/shared/lib/errors";
// ─── TikTok-specific types ────────────────────────────────────────────────────

/** Mirrors exactly the return of IntegrationBaseService.getOAuthStatus() —
 * do not extend IntegrationRuntimeStatus here, which would have fields (integration_id,
 * status) that the real endpoint does not return. */
export interface TikTokStatus {
  connected: boolean;
}

// ─── Status hook (real — GET /integrations/tiktok/status) ───────────────────

export function useTikTokStatus() {
  return useQuery<TikTokStatus>({
    queryKey: ["integrations", "tiktok", "status"],
    queryFn: async () => api.get<TikTokStatus>("/integrations/tiktok/status"),
    staleTime: 30_000,
  });
}

export function useTikTokAuthUrl() {
  return useMutation({
    mutationFn: async () => api.get<{ url: string }>("/integrations/tiktok/auth"),
  });
}

export function useTikTokDisconnect() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => api.delete("/integrations/tiktok/disconnect"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integrations", "tiktok"] });
      toast.success("TikTok desconectado.");
    },
    onError: (err: Error) => toast.error(toUserMessage(err)),
  });
}

// ─── Unavailable metrics (a real TikTok Display API limitation) ──────────────

export function useTikTokVideoMetrics() {
  return {
    data: null,
    isLoading: false,
    fetch: () => disabledIntegration("TikTok", "the TikTok Display API does not expose video metrics"),
  };
}

export function useTikTokSoundMetrics() {
  return {
    data: null,
    isLoading: false,
    fetch: (_isrc: string) =>
      disabledIntegration("TikTok", "the TikTok Display API does not expose sound metrics"),
  };
}
