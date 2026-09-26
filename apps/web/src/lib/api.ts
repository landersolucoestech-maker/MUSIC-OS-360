/**
 * lib/api.ts — Canonical entry point for the HTTP client.
 *
 * Re-exports from shared/lib/api-client so new modules
 * always import from @/lib/api instead of @/shared/lib/api-client.
 */
export {
  api,
  setAccessToken,
  getAccessToken,
  TABLE_ENDPOINT,
  PENDING_TABLES,
} from "@/shared/lib/api-client";
