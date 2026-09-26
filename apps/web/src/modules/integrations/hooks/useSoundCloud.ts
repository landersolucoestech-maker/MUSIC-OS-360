/**
 * integrations/hooks/useSoundCloud.ts
 *
 * Hook for the SoundCloud integration.
 * Credentials managed server-side (encrypted in the database).
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/shared/lib/api-client";

export interface SoundCloudStatus {
  connected: boolean;
  last_sync_at?: string | null;
  permalink?: string | null;
  username?: string | null;
}

export interface SoundCloudCredentials {
  client_id: string;
  client_secret: string;
  permalink?: string;
}

export function useSoundCloudStatus() {
  return useQuery<SoundCloudStatus>({
    queryKey: ["integrations", "soundcloud", "status"],
    queryFn: async (): Promise<SoundCloudStatus> => {
      return api.get<SoundCloudStatus>("/integrations/soundcloud/status");
    },
    staleTime: 30_000,
  });
}

export function useSoundCloudSaveCredentials() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: SoundCloudCredentials) => {
      return api.post("/integrations/soundcloud/configure", {
        clientId: input.client_id,
        clientSecret: input.client_secret,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integrations", "soundcloud"] });
      toast.success("SoundCloud conectado com sucesso.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useSoundCloudDeleteCredentials() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      return api.delete("/integrations/soundcloud/disconnect");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integrations", "soundcloud"] });
      toast.success("SoundCloud desconectado.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useSoundCloudUserMetrics(permalinkUrl?: string) {
  return useQuery({
    queryKey: ["integrations", "soundcloud", "user", permalinkUrl],
    queryFn: async () => {
      if (!permalinkUrl) return null;
      return api.get(`/integrations/soundcloud/user?url=${encodeURIComponent(permalinkUrl)}`);
    },
    enabled: !!permalinkUrl,
    staleTime: 60_000,
  });
}

export function useSoundCloudTrackMetrics(trackId?: string) {
  return useQuery({
    queryKey: ["integrations", "soundcloud", "track", trackId],
    queryFn: async () => {
      if (!trackId) return null;
      return api.get(`/integrations/soundcloud/track/${trackId}`);
    },
    enabled: !!trackId,
    staleTime: 60_000,
  });
}

export function useSoundCloudArtistMetrics() {
  return { data: null, isLoading: false, fetch: (_permalink: string) => {} };
}

