/**
 * shared/lib/get-session-org-id.ts
 *
 * Isolated utility to read the org_id from the in-memory JWT.
 * Separated from AuthContext for Vite Fast Refresh compatibility.
 */

import { getAccessToken } from "./api-client";

function decodeJwtPayload(token: string): Record<string, unknown> {
  try {
    const b64 = token.split(".")[1];
    return JSON.parse(atob(b64.replace(/-/g, "+").replace(/_/g, "/")));
  } catch { return {}; }
}

/** Reads org_id from the in-memory JWT (real mode) or returns null (mock).
 *
 * Read priority:
 *   1. app_metadata.org_id — injected by Supabase's Custom Access Token Hook
 *   2. top-level org_id    — fallback for legacy JWTs or custom templates
 */
export function getSessionOrgId(): string | null {
  const token = getAccessToken();
  if (!token)   return null;
  try {
    const p       = decodeJwtPayload(token);
    const appMeta = p["app_metadata"] as Record<string, unknown> | undefined;
    if (typeof appMeta?.["org_id"] === "string") return appMeta["org_id"];
    if (typeof p["org_id"] === "string")         return p["org_id"];
    return null;
  } catch { return null; }
}

/** Reads the `sub` (user id) from the in-memory JWT — the same claim the backend
 * uses as the user identifier in the Realtime Authorization policies
 * (`realtime.topic() = 'user:' || auth.jwt()->>'sub'`). */
export function getSessionUserId(): string | null {
  const token = getAccessToken();
  if (!token) return null;
  try {
    const p = decodeJwtPayload(token);
    return typeof p["sub"] === "string" ? p["sub"] : null;
  } catch { return null; }
}
