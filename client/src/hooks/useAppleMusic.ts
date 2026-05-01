import { useQuery } from "@tanstack/react-query";
import {
  DisabledIntegrationError,
  INTEGRATION_DISABLED_CODE,
} from "@/lib/disabled-integration";
import type { MetricEvolutionPoint } from "./useSpotify";

const APPLE_MUSIC_URL_REGEX = /\/artist\/(?:[^/]+\/)?(?:id)?(\d+)/i;

/** Igual ao helper SQL antigo `extract_apple_music_artist_id`. */
export function extractAppleMusicArtistIdFromUrl(
  input: string | null | undefined,
): string | null {
  if (!input) return null;
  const trimmed = String(input).trim();
  if (!trimmed) return null;
  if (/^\d+$/.test(trimmed)) return trimmed;
  const match = trimmed.match(APPLE_MUSIC_URL_REGEX);
  return match?.[1] ?? null;
}

export interface AppleMusicDataError {
  status: number;
  code?: string;
  message: string;
}

export interface AppleMusicArtist {
  artistId: string;
  artistName: string | null;
  artistLinkUrl: string | null;
  primaryGenreName: string | null;
  albumCount: number;
  latestRelease: string | null;
  latestReleaseDate: string | null;
  monthlyListeners: number | null;
  source: "apple_music_catalog" | "itunes_lookup";
}

export interface AppleMusicStatus {
  connected: boolean;
  status?: string;
  team_id?: string | null;
  key_id?: string | null;
  has_private_key?: boolean;
  last_error?: string | null;
  last_sync_at?: string | null;
}

function disabled(): AppleMusicDataError {
  const err = new DisabledIntegrationError("Apple Music");
  return { status: err.status, code: err.code, message: err.message };
}

export function useAppleMusicStatus() {
  return useQuery<AppleMusicStatus>({
    queryKey: ["apple_music", "status"] as const,
    queryFn: async () => ({
      connected: false,
      status: INTEGRATION_DISABLED_CODE,
      last_error: "Integração Apple Music desativada — backend não configurado.",
    }),
    staleTime: Infinity,
  });
}

export function useAppleMusicArtist(
  appleMusicUrl: string | null | undefined,
) {
  const artistId = extractAppleMusicArtistIdFromUrl(appleMusicUrl);
  return useQuery<AppleMusicArtist, AppleMusicDataError>({
    queryKey: ["apple-music", "artist", artistId ?? ""] as const,
    enabled: false,
    retry: false,
    queryFn: async () => {
      throw disabled();
    },
  });
}

export function useAppleMusicEvolution(
  artistaId: string | null | undefined,
  days = 30,
) {
  return useQuery<MetricEvolutionPoint[]>({
    queryKey: ["apple-music", "evolution", artistaId ?? "", days] as const,
    enabled: false,
    queryFn: async () => [],
  });
}
