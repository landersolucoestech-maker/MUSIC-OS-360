/**
 * integrations/hooks/useSpotify.ts
 *
 * Hook for the Spotify for Artists integration.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/shared/lib/api-client";


import { toUserMessage } from "@/shared/lib/errors";
export interface SpotifyStatus {
  connected: boolean;
  client_id?: string | null;
  artist_id?: string | null;
  last_sync_at?: string | null;
}

export function useSpotifyStatus() {
  return useQuery<SpotifyStatus>({
    queryKey: ["integrations", "spotify", "status"],
    queryFn: async (): Promise<SpotifyStatus> => {
      const all = await api.get<Record<string, { configured: boolean }>>("/integrations/status");
      return { connected: all["spotify"]?.configured ?? false, last_sync_at: null };
    },
    staleTime: 30_000,
  });
}

/** @deprecated Kept for backward compatibility with SpotifyConfigDialog. */
export function useSpotifySaveCredentials() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (_input: { client_id?: string; client_secret?: string; artist_id?: string }) => {
      // Real mode: starts OAuth (does not use the form's client_id/secret — the backend manages them)
      const { url } = await api.get<{ url: string }>("/integrations/spotify/auth");
      window.open(url, "spotify_oauth", "width=600,height=700");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integrations", "spotify", "status"] });
      toast.info("Janela OAuth aberta. Complete a autenticação no Spotify.");
    },
    onError: (err: Error) => toast.error(toUserMessage(err)),
  });
}

/** @deprecated Kept for backward compatibility with SpotifyConfigDialog. */
export function useSpotifyDeleteCredentials() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      return api.delete("/integrations/spotify/disconnect");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integrations", "spotify", "status"] });
      toast.success("Spotify desconectado.");
    },
    onError: (err: Error) => toast.error(toUserMessage(err)),
  });
}

export function useSpotifyConnect() {
  return {
    connect: async () => {
      const { url } = await api.get<{ url: string }>("/integrations/spotify/auth");
      const popup = window.open(url, "spotify_oauth", "width=600,height=700");
      if (!popup) toast.error("Popup bloqueado. Permita popups para este site.");
    },
  };
}

export function useSpotifyArtistMetrics() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (spotifyUrl: string) => {
      return api.post("/integrations/spotify/sync-artist", { spotifyUrl });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integrations", "spotify"] });
      toast.success("Métricas do artista Spotify sincronizadas.");
    },
    onError: (err: Error) => toast.error(toUserMessage(err)),
  });
}

export function useSpotifyDisconnect() {
  return useSpotifyDeleteCredentials();
}

export function useSpotifyTrackMetrics() {
  return { data: null, isLoading: false, fetch: (_isrc: string) => {} };
}

