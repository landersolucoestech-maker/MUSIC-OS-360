import { useQuery } from "@tanstack/react-query";
import { DisabledIntegrationError } from "@/lib/disabled-integration";
import type { MetricEvolutionPoint } from "./useSpotify";

/** Stubs do Deezer — integração desligada (sem backend). */

export interface DeezerArtist {
  id: number;
  name: string;
  link?: string;
  picture_medium?: string;
  picture_xl?: string;
  nb_album?: number;
  nb_fan?: number;
}

export interface DeezerDataError {
  status: number;
  code?: string;
  message: string;
}

export function extractDeezerArtistIdFromUrl(input: string | null | undefined): string | null {
  if (!input) return null;
  const trimmed = String(input).trim();
  if (!trimmed) return null;
  if (/^\d+$/.test(trimmed)) return trimmed;
  const match = trimmed.match(/deezer\.com\/(?:[a-z]{2}\/)?artist\/(\d+)/i);
  return match?.[1] ?? null;
}

function disabled(): DeezerDataError {
  const err = new DisabledIntegrationError("Deezer");
  return { status: err.status, code: err.code, message: err.message };
}

export function useDeezerArtist(deezerUrl: string | null | undefined) {
  const artistId = extractDeezerArtistIdFromUrl(deezerUrl);
  return useQuery<DeezerArtist, DeezerDataError>({
    queryKey: ["deezer", "artist", artistId ?? ""] as const,
    enabled: false,
    retry: false,
    queryFn: async () => {
      throw disabled();
    },
  });
}

export function useDeezerEvolution(
  artistaId: string | null | undefined,
  days = 30,
) {
  return useQuery<MetricEvolutionPoint[]>({
    queryKey: ["deezer", "evolution", artistaId ?? "", days] as const,
    enabled: false,
    queryFn: async () => [],
  });
}
