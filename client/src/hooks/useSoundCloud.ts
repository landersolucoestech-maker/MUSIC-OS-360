import { useQuery } from "@tanstack/react-query";
import { DisabledIntegrationError } from "@/lib/disabled-integration";
import type { MetricEvolutionPoint } from "./useSpotify";

/** Stubs do SoundCloud — integração desligada (sem backend). */

export interface SoundCloudUser {
  id: number | null;
  permalink: string;
  username: string | null;
  full_name: string | null;
  followers_count: number | null;
  followings_count: number | null;
  track_count: number | null;
  playlist_count: number | null;
  avatar_url: string | null;
  permalink_url: string;
  description: string | null;
  city: string | null;
  country_code: string | null;
  verified: boolean | null;
}

export interface SoundCloudDataError {
  status: number;
  code?: string;
  message: string;
}

const SC_RESERVED = new Set([
  "discover", "stream", "upload", "pages", "pro", "jobs", "developers",
  "mobile", "imprint", "charts", "tags", "people", "search", "you", "home",
]);

const SC_URL_REGEX = /soundcloud\.com\/([A-Za-z0-9_-]+)/i;

export function extractSoundCloudHandleFromUrl(
  input: string | null | undefined,
): string | null {
  if (!input) return null;
  const trimmed = String(input).trim();
  if (!trimmed) return null;
  if (/^[A-Za-z0-9_-]+$/.test(trimmed)) {
    return SC_RESERVED.has(trimmed.toLowerCase()) ? null : trimmed;
  }
  const match = trimmed.match(SC_URL_REGEX);
  const handle = match?.[1] ?? null;
  if (!handle) return null;
  return SC_RESERVED.has(handle.toLowerCase()) ? null : handle;
}

function disabled(): SoundCloudDataError {
  const err = new DisabledIntegrationError("SoundCloud");
  return { status: err.status, code: err.code, message: err.message };
}

export function useSoundCloudUser(
  soundcloudUrl: string | null | undefined,
) {
  const handle = extractSoundCloudHandleFromUrl(soundcloudUrl);
  return useQuery<SoundCloudUser, SoundCloudDataError>({
    queryKey: ["soundcloud", "user", handle ?? ""] as const,
    enabled: false,
    retry: false,
    queryFn: async () => {
      throw disabled();
    },
  });
}

export function useSoundCloudEvolution(
  artistaId: string | null | undefined,
  days = 30,
) {
  return useQuery<MetricEvolutionPoint[]>({
    queryKey: ["soundcloud", "evolution", artistaId ?? "", days] as const,
    enabled: false,
    queryFn: async () => [],
  });
}
