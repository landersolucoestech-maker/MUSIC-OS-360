import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { DisabledIntegrationError, INTEGRATION_DISABLED_CODE } from "@/shared/lib/disabled-integration";

/**
 * Clicksign stubs — integration switched off (no backend).
 *
 * There is no Clicksign service in apps/api/src. The previous
 * implementation here wrote non-sensitive metadata to sessionStorage and reported
 * `connected: true` without ever validating anything against a real Clicksign account
 * — the UI showed "Conectado" for a connection that never happened. Fixed
 * to follow the same honest pattern already used by the sibling integrations
 * (Autentique, Spotify, YouTube, Deezer, SoundCloud, ABRAMUS, Resend, Creative
 * AI, Meta Ads — see shared/lib/disabled-integration.ts) instead of
 * inventing an exception just for this one.
 */

export interface ClicksignStatus {
  connected: boolean;
  status?: string;
  has_token?: boolean;
  account_email?: string | null;
  last_sync_at?: string | null;
}

function fail(): never {
  throw new DisabledIntegrationError("Clicksign");
}

export function useClicksignStatus() {
  return useQuery<ClicksignStatus>({
    queryKey: ["integrations", "clicksign", "status"],
    queryFn: async (): Promise<ClicksignStatus> => ({
      connected: false,
      status: INTEGRATION_DISABLED_CODE,
      has_token: false,
      account_email: null,
      last_sync_at: null,
    }),
    staleTime: Infinity,
  });
}

export function useClicksignSaveCredentials() {
  return useMutation({
    mutationFn: async (_input: { api_key: string; account_email?: string }) => fail(),
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useClicksignDeleteCredentials() {
  return useMutation({
    mutationFn: async () => fail(),
    onError: (err: Error) => toast.error(err.message),
  });
}
