/**
 * integrations/hooks/useR2.ts
 *
 * Stub hook for the Cloudflare R2 integration (file storage).
 *
 * CURRENT STATE: standalone — files referenced by local/mock URLs.
 * FUTURE MIGRATION:
 *   1. Configure the R2 bucket and a signed-upload Worker
 *   2. Implement IStorageProvider with the R2 SDK
 *   3. Replace references to local URLs with R2 presigned URLs
 *
 * Contract: @/shared/integrations/contracts/storage.contract → IStorageProvider
 */

import { useQuery } from "@tanstack/react-query";
import type { IntegrationRuntimeStatus } from "@/shared/integrations/types";
import { disabledIntegration } from "@/shared/lib/disabled-integration";

// ─── R2-specific types ────────────────────────────────────────────────────────

export interface R2Status extends IntegrationRuntimeStatus {
  integration_id: "r2";
  account_id?: string | null;
  bucket_name?: string | null;
  public_domain?: string | null;
}

// ─── Hook de status ───────────────────────────────────────────────────────────

export function useR2Status() {
  return useQuery<R2Status>({
    queryKey: ["integrations", "r2", "status"],
    queryFn: async (): Promise<R2Status> => ({
      integration_id: "r2",
      status: "disabled",
      connected: false,
      account_id: null,
      bucket_name: null,
      public_domain: null,
      last_error: null,
      last_checked_at: new Date().toISOString(),
    }),
    staleTime: Infinity,
  });
}

// ─── Stubs desabilitados ──────────────────────────────────────────────────────

/**
 * FUTURE MIGRATION: implement the real upload to R2 via a signed Worker.
 */
export function useR2Upload() {
  return {
    upload: (_file: File, _key: string) => disabledIntegration("Cloudflare R2"),
    isLoading: false,
  };
}

export function useR2PresignedUrl() {
  return {
    getUrl: (_key: string) => disabledIntegration("Cloudflare R2"),
  };
}
