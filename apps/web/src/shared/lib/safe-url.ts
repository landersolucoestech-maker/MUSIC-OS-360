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

/**
 * A scheme-relative or backslash-relative reference (`//evil.test`, `/\\evil.test`,
 * `\\evil.test`) is resolved by browsers against the current scheme to another
 * origin: never a legitimate in-app link, so it is rejected like a dangerous scheme.
 */
// eslint-disable-next-line no-control-regex -- C0 controls are exactly what browsers strip around a URL
const NETWORK_PATH_REFERENCE = /^[\s\u0000-\u001f]*[/\\][/\\]/;
// eslint-disable-next-line no-control-regex
const ASCII_CONTROL = /[\u0000-\u001f\u007f]/;

/**
 * Returns `url` if it is a safe link (absolute http/https/mailto, or a same-origin
 * relative path), else "". Scheme-relative `//host` references are rejected.
 */
export function safeLinkHref(url: string | null | undefined): string {
  if (!url || typeof url !== "string") return "";
  // Browsers drop tab/LF/CR anywhere in a URL, so `/\t/evil.test` becomes `//evil.test`: no control chars at all.
  if (ASCII_CONTROL.test(url)) return "";
  if (NETWORK_PATH_REFERENCE.test(url)) return "";
  const u = parse(url);
  return u && SAFE_LINK_SCHEMES.has(u.protocol) ? url : "";
}

/**
 * The single guard for a raw `href` bound to API/user data that is not a stored
 * file (those go through StoredFileLink): the trimmed value when it is an
 * absolute http:, https: or mailto: URL, otherwise undefined (render the text
 * without a link). Relative and scheme-relative references, control characters
 * and whitespace-obfuscated schemes (`java\tscript:`, ` javascript:`) are rejected.
 */
export function safeHref(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed || ASCII_CONTROL.test(trimmed)) return undefined;
  const scheme = /^([A-Za-z][A-Za-z0-9+.-]*):/.exec(trimmed);
  if (!scheme || !["http", "https", "mailto"].includes(scheme[1].toLowerCase())) return undefined;
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return undefined;
  }
  if (!SAFE_LINK_SCHEMES.has(parsed.protocol)) return undefined;
  if (parsed.protocol !== "mailto:" && !parsed.hostname) return undefined;
  return trimmed;
}

/** `src` of an <audio>/<video>/<img> fed by API data: http(s)/blob only, else "" (nothing is rendered). */
export function safeMediaSrc(url: string | null | undefined): string {
  if (!url || typeof url !== "string") return "";
  if (ASCII_CONTROL.test(url)) return "";
  if (NETWORK_PATH_REFERENCE.test(url)) return "";
  const u = parse(url);
  return u && SAFE_IMAGE_SCHEMES.has(u.protocol) ? url : "";
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
  if (!url || typeof url !== "string") return "";
  if (ASCII_CONTROL.test(url)) return "";
  if (NETWORK_PATH_REFERENCE.test(url)) return "";
  const u = parse(url);
  if (!u) return "";
  if (SAFE_IMAGE_SCHEMES.has(u.protocol)) return url;
  if (u.protocol === "data:" && /^data:image\/(png|jpe?g|gif|webp|avif|svg\+xml);/i.test(url)) {
    // Reject inline SVG (can carry scripts); allow raster image data URLs only.
    return /^data:image\/svg/i.test(url) ? "" : url;
  }
  return "";
}
