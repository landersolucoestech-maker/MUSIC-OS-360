/**
 * core/resilience/safe-url.ts
 *
 * SSRF guards (CWE-918). Outbound integration calls interpolate user-controlled
 * identifiers into request URLs. Each user-supplied value is validated with an
 * explicit, local regex/allowlist check that THROWS on anything unexpected — so
 * a crafted value (`/`, `@`, `%2f`, a full URL, an injected host, …) can never
 * reach a fetch sink. `assertAllowedHost` is the final defense, ensuring the
 * fully-built URL still targets an allowlisted HTTPS host.
 */

export class UnsafeInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnsafeInputError';
  }
}

export class DisallowedHostError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DisallowedHostError';
  }
}

// Only unreserved URL chars (RFC 3986): letters, digits, and - . _ ~
const PATH_SEGMENT_RE = /^[A-Za-z0-9._~-]+$/;
const STOREFRONT_RE = /^[a-z]{2}$/;

/**
 * Validates a single URL path segment (e.g. an artist/track/album id). Rejects
 * separators, schemes, hosts and percent-encoding. Returns the value unchanged
 * so it can be safely `encodeURIComponent`-ed by the caller.
 */
export function assertSafePathSegment(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || !PATH_SEGMENT_RE.test(value)) {
    throw new UnsafeInputError(`Invalid parameter: ${fieldName}`);
  }
  return value;
}

/** Apple Music storefront — exactly two lowercase letters (e.g. "br", "us"). */
export function assertSafeStorefront(value: unknown): string {
  if (typeof value !== 'string' || !STOREFRONT_RE.test(value)) {
    throw new UnsafeInputError('invalid storefront');
  }
  return value;
}

/** Integer limit within [min, max]; rejects NaN/floats/out-of-range. */
export function assertSafeLimit(value: unknown, min = 1, max = 50): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(n) || n < min || n > max) {
    throw new UnsafeInputError('invalid limit');
  }
  return n;
}

/** Comma-separated resource types validated against an explicit allowlist. */
export function assertSafeTypes(value: unknown, allowed: readonly string[]): string {
  if (typeof value !== 'string') throw new UnsafeInputError('invalid types');
  const parts = value.split(',').map((s) => s.trim()).filter(Boolean);
  if (parts.length === 0) throw new UnsafeInputError('invalid types');
  for (const part of parts) {
    if (!allowed.includes(part)) throw new UnsafeInputError(`invalid types: ${part}`);
  }
  return parts.join(',');
}

/** Free-text query value (search term) — bounded length, no control chars. */
export function assertSafeQueryValue(value: unknown, fieldName: string, maxLen = 256): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > maxLen) {
    throw new UnsafeInputError(`Invalid parameter: ${fieldName}`);
  }
  for (let i = 0; i < value.length; i += 1) {
    if (value.charCodeAt(i) < 0x20) {
      throw new UnsafeInputError(`Invalid parameter: ${fieldName}`);
    }
  }
  return value;
}

/**
 * Final barrier: returns the URL string if it is HTTPS and its host is in
 * `allowedHosts`; throws `DisallowedHostError` otherwise.
 */
export function assertAllowedHost(rawUrl: string, allowedHosts: readonly string[]): string {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new DisallowedHostError('Invalid integration URL');
  }
  if (parsed.protocol !== 'https:') {
    throw new DisallowedHostError(`Scheme not allowed: ${parsed.protocol}`);
  }
  if (!allowedHosts.includes(parsed.hostname)) {
    throw new DisallowedHostError(`Host not allowed for integration: ${parsed.hostname}`);
  }
  return parsed.toString();
}
