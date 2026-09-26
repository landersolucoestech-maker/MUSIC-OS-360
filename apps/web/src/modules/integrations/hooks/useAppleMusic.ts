/**
 * integrations/hooks/useAppleMusic.ts
 *
 * Hook for the Apple Music for Artists integration.
 * Credentials managed server-side (encrypted in the database).
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/shared/lib/api-client";

import { toUserMessage } from "@/shared/lib/errors";
export interface AppleMusicStatus {
  connected: boolean;
  last_sync_at?: string | null;
  team_id?: string | null;
  key_id?: string | null;
  artist_id?: string | null;
}

export interface AppleMusicCredentials {
  team_id: string;
  key_id: string;
  private_key: string;
  artist_id?: string;
}

export function useAppleMusicStatus() {
  return useQuery<AppleMusicStatus>({
    queryKey: ["integrations", "apple-music", "status"],
    queryFn: async (): Promise<AppleMusicStatus> => {
      return api.get<AppleMusicStatus>("/integrations/apple-music/status");
    },
    staleTime: 30_000,
  });
}

export function useAppleMusicSaveCredentials() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: AppleMusicCredentials) => {
      return api.post("/integrations/apple-music/configure", {
        teamId: input.team_id,
        keyId: input.key_id,
        privateKey: input.private_key,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integrations", "apple-music"] });
      toast.success("Apple Music conectado com sucesso.");
    },
    onError: (err: Error) => toast.error(toUserMessage(err)),
  });
}

export function useAppleMusicDeleteCredentials() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      return api.delete("/integrations/apple-music/disconnect");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integrations", "apple-music"] });
      toast.success("Apple Music desconectado.");
    },
    onError: (err: Error) => toast.error(toUserMessage(err)),
  });
}

export function useAppleMusicArtistMetrics(artistId?: string, storefront = "br") {
  return useQuery({
    queryKey: ["integrations", "apple-music", "artist", artistId, storefront],
    queryFn: async () => {
      if (!artistId) return null;
      return api.get(`/integrations/apple-music/artist/${artistId}?storefront=${storefront}`);
    },
    enabled: !!artistId,
    staleTime: 60_000,
  });
}

export function useAppleMusicShazamMetrics() {
  return { data: null, isLoading: false, fetch: (_isrc: string) => {} };
}

