import { useQuery } from "@tanstack/react-query";
import { api } from "@/shared/lib/api-client";
import { QUERY_KEYS } from "@/shared/lib/query-config";
import type { SocialPlatform } from "./useArtistPlatformProfiles";
import type { MetricEvolutionPoint } from "@/modules/artist/components/ArtistEvolutionCard";

// Mirrors the backend metric-keys.ts (platform-profiles/metric-keys.ts) — there
// is no shared web/api package for this contract yet (same pattern documented in
// useArtistPlatformProfiles.ts). apple-music has no entry: Soundcharts does not
// expose an Apple Music audience (see platform-metric-capabilities.ts) — the
// query stays empty and never invents data.
const METRIC_KEY_BY_PLATFORM: Partial<Record<SocialPlatform, string>> = {
  spotify: "spotify.monthly_listeners",
  youtube: "youtube.subscribers",
  deezer: "deezer.fans",
  soundcloud: "soundcloud.followers",
  instagram: "instagram.followers",
  tiktok: "tiktok.followers",
};

interface HistoryResponse {
  points: Array<{ value: number; observed_at: string }>;
}

/**
 * Real history (Phase 2 — time-series foundation) of a platform, in the shape
 * ArtistEvolutionCard/PlatformMiniTrend already expect. Replaces the
 * `enabled:false, queryFn: async () => []` stub that existed in
 * ArtistEvolutionSection — the "Evolução" section had its whole UI ready
 * (sparkline, trend badge, aggregated verdict) but never received real data
 * because no history was retained between syncs.
 */
export function useArtistPlatformEvolution(artistId: string | null | undefined, platform: SocialPlatform) {
  const metric = METRIC_KEY_BY_PLATFORM[platform];
  return useQuery<MetricEvolutionPoint[]>({
    queryKey: [...QUERY_KEYS.ARTISTS, artistId ?? "", "evolution", platform] as const,
    queryFn: async () => {
      if (!artistId || !metric) return [];
      const res = await api.get<HistoryResponse>(
        `/artists/${artistId}/platform-profiles/${platform}/history?metric=${encodeURIComponent(metric)}`,
      );
      return res.points.map((p) => ({ captured_at: p.observed_at, followers: p.value }));
    },
    enabled: Boolean(artistId),
    staleTime: 5 * 60_000,
    retry: false,
  });
}
