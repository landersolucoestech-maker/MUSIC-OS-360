/**
 * shared/lib/safe-url.ts
 *
 * XSS guards (CWE-79) for user-controlled URLs bound to `href`/`src`. Blocks
 * dangerous schemes (`javascript:`, `data:text/html`, `vbscript:`, …) that turn
 * a link/image into script execution, while preserving normal http(s)/blob and
 * inline image data URLs.
 */

const SAFE_LINK_SCHEMES = new Set(["http:", "https:", "mailto:"]);
const SAFE_IMAGE_SCHEMES = new Set(["http:", "https:", "blob:"]);

function parse(url: string): URL | null {
  try {
    // Same-origin base so relative URLs resolve safely; absolute schemes keep theirs.
    const base = typeof window !== "undefined" ? window.location.origin : "https://localhost";
    return new URL(url, base);
  } catch {
    return null;
  }
}

/** Returns `url` if it is a safe link scheme (http/https/mailto), else "". */
export function safeLinkHref(url: string | null | undefined): string {
  if (!url) return "";
  const u = parse(url);
  return u && SAFE_LINK_SCHEMES.has(u.protocol) ? url : "";
}

const EXTERNAL_URL_SCHEMES = new Set(["http:", "https:"]);

/**
 * Absolute external link from API/user data (social profiles, gallery, press
 * kit…): the trimmed value when it is an absolute http:/https: URL, otherwise
 * undefined. Relative paths and every other scheme (`javascript:`, `data:`,
 * `vbscript:`, `mailto:`, `file:`…) are rejected, so callers render the text
 * without a link instead of binding it to `href`/`window.open`.
 */
export function safeExternalUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  // Absolute URL required: no base, so "/x" or "evil.com" do not resolve.
  if (!/^https?:\/\//i.test(trimmed)) return undefined;
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return undefined;
  }
  if (!EXTERNAL_URL_SCHEMES.has(parsed.protocol) || !parsed.hostname) return undefined;
  return trimmed;
}

/** Returns `url` if it is a safe image source (http/https/blob or data:image/*), else "". */
export function safeImageSrc(url: string | null | undefined): string {
  if (!url) return "";
  const u = parse(url);
  if (!u) return "";
  if (SAFE_IMAGE_SCHEMES.has(u.protocol)) return url;
  if (u.protocol === "data:" && /^data:image\/(png|jpe?g|gif|webp|avif|svg\+xml);/i.test(url)) {
    // Reject inline SVG (can carry scripts); allow raster image data URLs only.
    return /^data:image\/svg/i.test(url) ? "" : url;
  }
  return "";
}
