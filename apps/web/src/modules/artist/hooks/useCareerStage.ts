import { useQuery } from "@tanstack/react-query";
import { api } from "@/shared/lib/api-client";
import { QUERY_KEYS } from "@/shared/lib/query-config";

// Espelha CareerStageResult (apps/api/.../analytics/career-stage.engine.ts) —
// sem pacote compartilhado entre web/api para este contrato ainda (mesmo
// padrão de useArtistPlatformProfiles.ts).
export type CareerStageDimensionKey = "AUDIENCE" | "STREAMING" | "SOCIAL" | "MARKET_PRESENCE" | "GROWTH" | "MOMENTUM";

export interface CareerStageDimensionResult {
  key: CareerStageDimensionKey;
  weight: number;
  status: "AVAILABLE" | "UNAVAILABLE";
  score: number | null;
  metricsUsed: string[];
  evidence: Array<{ metricKey: string; rawValue: number | null; normalizedScore: number | null }>;
}

export interface CareerStageExplainabilityItem {
  dimension: CareerStageDimensionKey;
  reason: string;
  metrics: string[];
  evidence: Array<{ metricKey: string; rawValue: number | null }>;
}

export interface CareerStageResult {
  status: "OK" | "INSUFFICIENT_DATA";
  score: number | null;
  classification: string | null;
  confidence: number;
  coverage: number;
  dimensions: CareerStageDimensionResult[];
  positiveFactors: CareerStageExplainabilityItem[];
  bottlenecks: CareerStageExplainabilityItem[];
  engineVersion: string;
  calculatedAt: string;
  freshness: "FRESH" | "STALE" | "UNKNOWN";
}

export const careerStageKey = (artistId: string | null | undefined) => [...QUERY_KEYS.ARTISTS, artistId, "career-stage"];

/**
 * Fase 3 — Estágio da Carreira: calculado no backend (React nunca calcula
 * score, item 39) a partir de métricas Soundcharts já ingeridas.
 */
export function useCareerStage(artistId: string | null | undefined) {
  return useQuery({
    queryKey: careerStageKey(artistId),
    queryFn: async () => {
      if (!artistId) return null;
      return api.get<CareerStageResult>(`/artists/${artistId}/career-stage`);
    },
    enabled: Boolean(artistId),
    staleTime: 5 * 60_000,
    retry: false,
  });
}
