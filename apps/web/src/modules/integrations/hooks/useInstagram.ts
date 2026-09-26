/**
 * integrations/hooks/useInstagram.ts
 *
 * Hook for the Instagram Insights integration (Meta Graph API).
 * OAuth 2.0 flow via popup → the backend manages the tokens.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/shared/lib/api-client";

import { toUserMessage } from "@/shared/lib/errors";
export interface InstagramStatus {
  connected: boolean;
  last_sync_at?: string | null;
}

export interface InstagramAccountMetrics {
  instagramId?: string;
  username?: string;
  name?: string;
  followers?: number;
  following?: number;
  mediaCount?: number;
  profilePicture?: string;
  syncedAt?: string;
  error?: string;
}

export function useInstagramStatus() {
  return useQuery<InstagramStatus>({
    queryKey: ["integrations", "instagram", "status"],
    queryFn: async (): Promise<InstagramStatus> => {
      return api.get<InstagramStatus>("/integrations/instagram/status");
    },
    staleTime: 30_000,
  });
}

export function useInstagramConnect() {
  return {
    connect: async () => {
      const { url } = await api.get<{ url: string }>("/integrations/instagram/auth");
      const popup = window.open(url, "instagram_oauth", "width=600,height=700");
      if (!popup) toast.error("Popup bloqueado. Permita popups para este site.");
    },
  };
}

export function useInstagramAccountMetrics() {
  return useQuery<InstagramAccountMetrics | null>({
    queryKey: ["integrations", "instagram", "metrics"],
    queryFn: async () => {
      return api.get<InstagramAccountMetrics>("/integrations/instagram/metrics");
    },
    staleTime: 60_000,
  });
}

export function useInstagramDisconnect() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      return api.delete("/integrations/instagram/disconnect");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integrations", "instagram"] });
      toast.success("Instagram desconectado.");
    },
    onError: (err: Error) => toast.error(toUserMessage(err)),
  });
}

export function useInstagramReelsMetrics() {
  return { data: null, isLoading: false, fetch: () => {} };
}
