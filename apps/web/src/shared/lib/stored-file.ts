/**
 * shared/lib/stored-file.ts
 *
 * Opening files the app stored in R2 (find-df79ea88).
 *
 * Uploads persist a link of the form `<R2_PUBLIC_URL|r2://bucket>/tenants/
 * <tenantId>/<category>/<fileId>/<name>` on the owning entity. Opening that
 * link directly depends on the bucket being publicly readable — no auth, no
 * expiry, no tenant check. Every reader of a stored file goes through
 * `openStoredFile` instead: for an upload link it asks the API for a
 * short-lived signed URL (GET /uploads/:fileId/download — authenticated,
 * tenant-checked, 1h), so the app keeps working once public access to private
 * prefixes is turned off at the storage edge. Links that are not uploads
 * (external URLs typed by a user) open as before, after the scheme check.
 */
import { api, getAccessToken, getTenantId } from "./api-client";
import { API_BASE_URL } from "./env";
import { safeLinkHref } from "./safe-url";
import { UserFacingError } from "@/shared/lib/errors";

const UPLOAD_KEY_RE =
  /(?:^|\/)tenants\/[0-9a-f-]{36}\/(?:documents|images|audio|spreadsheets|videos)\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\//i;

/** fileId of an app upload link (public R2 URL or r2:// reference), else null. */
export function uploadFileIdFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = UPLOAD_KEY_RE.exec(url);
  return m ? m[1].toLowerCase() : null;
}

/** Resolves the URL to actually open: a fresh signed URL for uploads, the safe original otherwise. */
export async function resolveStoredFileUrl(url: string | null | undefined): Promise<string> {
  const fileId = uploadFileIdFromUrl(url);
  if (!fileId) return safeLinkHref(url);
  const { url: signed } = await api.get<{ url: string; expiresIn: number }>(`/uploads/${fileId}/download`);
  return signed;
}

/**
 * Opens a stored file in a new tab. The tab is opened synchronously (inside
 * the click gesture, so popup blockers allow it) and navigated once the
 * signed URL arrives; on failure it is closed and the error propagates.
 */
export async function openStoredFile(url: string | null | undefined): Promise<void> {
  const tab = typeof window !== "undefined" ? window.open("", "_blank") : null;
  try {
    const target = await resolveStoredFileUrl(url);
    if (!target) throw new UserFacingError("Invalid stored file link", "Link de arquivo inválido.");
    if (tab) {
      tab.opener = null;
      tab.location.href = target;
    } else {
      window.open(target, "_blank", "noopener,noreferrer");
    }
  } catch (err) {
    tab?.close();
    throw err;
  }
}

/**
 * Human label for a stored file link: the original file name for uploads
 * (never the raw storage URL, which must not be surfaced for copy/paste),
 * the link itself otherwise.
 */
export function storedFileDisplayName(url: string | null | undefined): string {
  if (!url) return "";
  if (!uploadFileIdFromUrl(url)) return url;
  const last = url.split("/").pop() ?? "";
  try { return decodeURIComponent(last); } catch { return last; }
}

/**
 * Bytes of a stored file for in-app preview (PDF/DOCX viewers). Uploads are
 * streamed through the authenticated, tenant-checked GET /uploads/:fileId/raw
 * (same-origin API CORS) instead of fetching the public bucket URL.
 */
export async function fetchStoredFileBytes(url: string): Promise<ArrayBuffer> {
  const fileId = uploadFileIdFromUrl(url);
  if (!fileId) {
    const safe = safeLinkHref(url);
    if (!safe) throw new UserFacingError("Invalid stored file link", "Link de arquivo inválido.");
    return (await fetch(safe)).arrayBuffer();
  }
  const headers: Record<string, string> = {};
  const token = getAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const tenantId = getTenantId();
  if (tenantId) headers["X-Tenant-ID"] = tenantId;
  const res = await fetch(`${API_BASE_URL}/api/v1/uploads/${fileId}/raw`, { headers, credentials: "include" });
  if (!res.ok) throw new UserFacingError(`Stored file fetch failed (HTTP ${res.status})`, "Não foi possível carregar o arquivo. Tente novamente.");
  return res.arrayBuffer();
}
