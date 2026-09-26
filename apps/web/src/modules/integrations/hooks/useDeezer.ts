/**
 * integrations/hooks/useDeezer.ts
 *
 * Hook for the Deezer integration.
 *
 * The backend (apps/api/.../integrations/deezer/deezer.service.ts) is a public
 * API that needs no credentials (isConfigured() is always true) — the
 * "connect" flow below (app_id/secret_key in sessionStorage) is only
 * a cosmetic UI preference to keep a reference artist_id,
 * since the public Deezer API exposes no configure/status/
 * disconnect endpoints. useDeezerArtistMetrics/useDeezerTopTracks call the real,
 * working endpoints (GET /integrations/deezer/artist/:id[/top]).
 *
 * Contract: @/shared/integrations/contracts/streaming.contract → IStreamingProvider
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/shared/lib/api-client";

const LS_KEY = "musicos360_deezer_credentials";

export interface DeezerCredentials {
  app_id: string;
  secret_key: string;
  artist_id?: string;
}

export interface DeezerStatus {
  connected: boolean;
  status: string;
  has_credentials: boolean;
  app_id?: string | null;
  artist_id?: string | null;
  last_error?: string | null;
  last_checked_at: string;
}

function readCredentials(): DeezerCredentials | null {
  try {
    const raw = sessionStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function useDeezerStatus() {
  return useQuery<DeezerStatus>({
    queryKey: ["integrations", "deezer", "status"],
    queryFn: async (): Promise<DeezerStatus> => {
      const creds = readCredentials();
      if (creds?.app_id && creds?.secret_key) {
        return {
          connected: true,
          status: "connected",
          has_credentials: true,
          app_id: creds.app_id,
          artist_id: creds.artist_id ?? null,
          last_error: null,
          last_checked_at: new Date().toISOString(),
        };
      }
      return {
        connected: false,
        status: "disconnected",
        has_credentials: false,
        app_id: null,
        artist_id: null,
        last_error: null,
        last_checked_at: new Date().toISOString(),
      };
    },
    staleTime: 0,
  });
}

export function useDeezerSaveCredentials() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: DeezerCredentials) => {
      try {
        sessionStorage.setItem(LS_KEY, JSON.stringify(input));
      } catch {
        throw new Error("Não foi possível salvar as credenciais.");
      }
      return input;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integrations", "deezer", "status"] });
      toast.success("Deezer conectado com sucesso.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeezerDeleteCredentials() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      try {
        sessionStorage.removeItem(LS_KEY);
      } catch {
        throw new Error("Não foi possível remover as credenciais.");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integrations", "deezer", "status"] });
      toast.success("Deezer desconectado.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export interface DeezerArtistStats {
  artistId: string;
  name: string;
  fans: number;
  albums: number;
  picture: string;
  link: string;
  syncedAt: string;
}

export interface DeezerTopTrack {
  id: string;
  title: string;
  rank: number;
  duration: number;
  preview: string;
  album: string;
  cover: string;
}

/**
 * Deezer's backend (GET /integrations/deezer/artist/:id) is a real, working
 * public-API wrapper — no credentials required (isConfigured() is always
 * true server-side). This calls it directly; there is no "disabled" state
 * for Deezer artist stats, unlike platforms that genuinely require OAuth.
 */
export function useDeezerArtistMetrics(artistId?: string) {
  return useQuery<DeezerArtistStats>({
    queryKey: ["integrations", "deezer", "artist", artistId],
    queryFn: async () => api.get<DeezerArtistStats>(`/integrations/deezer/artist/${artistId}`),
    enabled: !!artistId,
    staleTime: 60_000,
  });
}

/** Top tracks for an artist — GET /integrations/deezer/artist/:id/top. Deezer
 * has no track-by-ISRC lookup, so this takes an artist id, not an ISRC. */
export function useDeezerTopTracks(artistId?: string, limit = 10) {
  return useQuery<DeezerTopTrack[]>({
    queryKey: ["integrations", "deezer", "artist", artistId, "top", limit],
    queryFn: async () =>
      api.get<DeezerTopTrack[]>(`/integrations/deezer/artist/${artistId}/top?limit=${limit}`),
    enabled: !!artistId,
    staleTime: 60_000,
  });
}

