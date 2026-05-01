import { useQuery } from "@tanstack/react-query";
import {
  DisabledIntegrationError,
  INTEGRATION_DISABLED_CODE,
} from "@/lib/disabled-integration";

/** Stubs do YouTube Music — integração desligada (sem backend). */

export class YouTubeDataError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "YouTubeDataError";
    this.status = status;
    this.code = code;
  }
}

function disabled(): YouTubeDataError {
  const err = new DisabledIntegrationError("YouTube");
  return new YouTubeDataError(err.message, err.status, err.code);
}

export interface YouTubeStatus {
  connected: boolean;
  status?: string;
  has_api_key?: boolean;
  last_error?: string | null;
  last_sync_at?: string | null;
  has_global_fallback?: boolean;
}

export function useYouTubeStatus() {
  return useQuery<YouTubeStatus>({
    queryKey: ["youtube", "status"] as const,
    queryFn: async () => ({
      connected: false,
      status: INTEGRATION_DISABLED_CODE,
      last_error: "Integração YouTube desativada — backend não configurado.",
    }),
    staleTime: Infinity,
  });
}

export interface YouTubeChannel {
  id: string;
  snippet?: {
    title?: string;
    description?: string;
    customUrl?: string;
    thumbnails?: { default?: { url: string }; medium?: { url: string }; high?: { url: string } };
  };
  statistics?: {
    viewCount?: string;
    subscriberCount?: string;
    videoCount?: string;
    hiddenSubscriberCount?: boolean;
  };
}

export interface YouTubeChannelResponse {
  items?: YouTubeChannel[];
}

export function useYouTubeChannel(channelId: string | null | undefined) {
  return useQuery<YouTubeChannelResponse, YouTubeDataError>({
    queryKey: ["youtube", "channel", channelId ?? ""] as const,
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

export function useYouTubeEvolution(
  artistaId: string | null | undefined,
  days = 30,
) {
  return useQuery<MetricEvolutionPoint[]>({
    queryKey: ["youtube", "evolution", artistaId ?? "", days] as const,
    enabled: false,
    queryFn: async () => [],
  });
}
