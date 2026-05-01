import { useQuery } from "@tanstack/react-query";
import {
  DisabledIntegrationError,
  INTEGRATION_DISABLED_CODE,
} from "@/lib/disabled-integration";

/**
 * Stubs do Spotify. O app não tem mais backend, então qualquer
 * tentativa de buscar dados reais devolve um erro padronizado e o
 * status de conexão fica permanentemente desligado.
 */

export class SpotifyDataError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "SpotifyDataError";
    this.status = status;
    this.code = code;
  }
}

function disabled(): SpotifyDataError {
  const err = new DisabledIntegrationError("Spotify");
  return new SpotifyDataError(err.message, err.status, err.code);
}

export interface SpotifyStatus {
  connected: boolean;
  status?: string;
  client_id?: string | null;
  has_secret?: boolean;
  last_error?: string | null;
  last_sync_at?: string | null;
  has_global_fallback?: boolean;
}

export function useSpotifyStatus() {
  return useQuery<SpotifyStatus>({
    queryKey: ["spotify", "status"] as const,
    queryFn: async () => ({
      connected: false,
      status: INTEGRATION_DISABLED_CODE,
      last_error: "Integração Spotify desativada — backend não configurado.",
    }),
    staleTime: Infinity,
  });
}

export interface SpotifyArtist {
  id: string;
  name: string;
  followers?: { total?: number | null } | null;
  popularity?: number | null;
  genres?: string[] | null;
  images?: Array<{ url: string; width?: number | null; height?: number | null }> | null;
  external_urls?: { spotify?: string } | null;
}

export interface SpotifyTrack {
  id: string;
  name: string;
  popularity?: number | null;
  preview_url?: string | null;
  album?: { name?: string; images?: Array<{ url: string }> } | null;
}

export function useSpotifyArtist(artistId: string | null | undefined) {
  return useQuery<SpotifyArtist, SpotifyDataError>({
    queryKey: ["spotify", "artist", artistId ?? ""] as const,
    enabled: false,
    retry: false,
    queryFn: async () => {
      throw disabled();
    },
  });
}

export function useSpotifyTopTracks(
  artistId: string | null | undefined,
  market = "BR",
) {
  return useQuery<{ tracks: SpotifyTrack[] }, SpotifyDataError>({
    queryKey: ["spotify", "top-tracks", artistId ?? "", market] as const,
    enabled: false,
    retry: false,
    queryFn: async () => {
      throw disabled();
    },
  });
}

export interface MetricEvolutionPoint {
  captured_at: string;
  followers: number | null;
  popularity: number | null;
  views: number | null;
}

export function useSpotifyEvolution(
  artistaId: string | null | undefined,
  days = 30,
) {
  return useQuery<MetricEvolutionPoint[]>({
    queryKey: ["spotify", "evolution", artistaId ?? "", days] as const,
    enabled: false,
    queryFn: async () => [],
  });
}
