import { useQuery } from "@tanstack/react-query";
import { api } from "@/shared/lib/api-client";
import { QUERY_KEYS } from "@/shared/lib/query-config";
import type { SocialPlatform } from "./useArtistPlatformProfiles";
import type { MetricEvolutionPoint } from "@/modules/artist/components/ArtistEvolutionCard";

// Espelha metric-keys.ts do backend (platform-profiles/metric-keys.ts) — sem
// pacote compartilhado entre web/api para este contrato ainda (mesmo padrão
// documentado em useArtistPlatformProfiles.ts). apple-music não tem entrada:
// a Soundcharts não expõe audiência para Apple Music (ver
// platform-metric-capabilities.ts) — a query fica sempre vazia, nunca inventa dado.
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
 * Histórico real (Fase 2 — Time-Series Foundation) de uma plataforma, no
 * formato que ArtistEvolutionCard/PlatformMiniTrend já esperam. Substitui o
 * stub `enabled:false, queryFn: async () => []` que existia em
 * ArtistEvolutionSection — a seção "Evolução" ficava com toda a UI pronta
 * (sparkline, badge de tendência, veredito agregado) mas nunca recebia dado
 * real porque não havia retenção de histórico entre sincronizações.
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
