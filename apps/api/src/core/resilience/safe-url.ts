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

// ── Tenant-configured outbound endpoints ─────────────────────────────────────
// Some integrations call an endpoint the tenant configures (there is no fixed provider host to allow-list).
// Such a URL must still never reach the platform's own network: HTTPS only, no embedded credentials, no
// non-standard port and no private, loopback, link-local or cloud-metadata address, whether written as a
// literal or resolved from a name.

const PRIVATE_NAME_SUFFIXES = ['.localhost', '.local', '.internal', '.localdomain', '.lan', '.home.arpa'] as const;

function ipv4Octets(ip: string): number[] | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  const octets = parts.map((p) => (/^\d{1,3}$/.test(p) ? Number(p) : NaN));
  return octets.every((o) => o >= 0 && o <= 255) ? octets : null;
}

function isPrivateIpv4(octets: number[]): boolean {
  const [a, b, c] = octets;
  return (
    a === 0 ||                                  // 0.0.0.0/8 this network
    a === 10 ||                                 // 10.0.0.0/8
    a === 127 ||                                // loopback
    (a === 100 && b >= 64 && b <= 127) ||       // 100.64.0.0/10 carrier-grade NAT
    (a === 169 && b === 254) ||                 // link-local, includes the cloud metadata address
    (a === 172 && b >= 16 && b <= 31) ||        // 172.16.0.0/12
    (a === 192 && b === 0 && c === 0) ||        // 192.0.0.0/24
    (a === 192 && b === 168) ||                 // 192.168.0.0/16
    (a === 198 && (b === 18 || b === 19)) ||    // 198.18.0.0/15 benchmarking
    a >= 224                                    // multicast, reserved, broadcast
  );
}

/** True for any address a tenant-configured URL must not reach (IPv4 or IPv6, literal form). */
export function isPrivateAddress(address: string): boolean {
  const ip = address.replace(/^\[|\]$/g, '').toLowerCase();
  const v4 = ipv4Octets(ip);
  if (v4) return isPrivateIpv4(v4);
  if (!ip.includes(':')) return false;
  if (ip === '::' || ip === '::1') return true;
  const mapped = /^::ffff:(?:(\d{1,3}(?:\.\d{1,3}){3})|([0-9a-f]{1,4}):([0-9a-f]{1,4}))$/.exec(ip);
  if (mapped) {
    if (mapped[1]) {
      const octets = ipv4Octets(mapped[1]);
      return octets ? isPrivateIpv4(octets) : true;
    }
    const hi = parseInt(mapped[2], 16);
    const lo = parseInt(mapped[3], 16);
    return isPrivateIpv4([hi >> 8, hi & 255, lo >> 8, lo & 255]);
  }
  // NAT64 (64:ff9b::/96), 6to4 (2002::/16) and IPv4-compatible forms embed an IPv4 address: judge the embedded one.
  const embedded = /^(?:64:ff9b::|::)([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(ip);
  if (embedded) {
    const hi = parseInt(embedded[1], 16);
    const lo = parseInt(embedded[2], 16);
    return isPrivateIpv4([hi >> 8, hi & 255, lo >> 8, lo & 255]);
  }
  const first = parseInt(ip.split(':')[0] || '0', 16);
  if (first === 0x2002) {
    const hi = parseInt(ip.split(':')[1] || '0', 16);
    const lo = parseInt(ip.split(':')[2] || '0', 16);
    return isPrivateIpv4([hi >> 8, hi & 255, lo >> 8, lo & 255]);
  }
  return (
    (first & 0xffc0) === 0xfec0 ||              // fec0::/10 site-local (deprecated)
    (first & 0xfe00) === 0xfc00 ||              // fc00::/7 unique local
    (first & 0xffc0) === 0xfe80 ||              // fe80::/10 link-local
    (first & 0xff00) === 0xff00                 // ff00::/8 multicast
  );
}

/**
 * Validates a tenant-configured base URL and returns it normalized (origin plus path, no trailing slash).
 * Throws `UnsafeInputError` for anything that could reach the platform's own network.
 */
export function assertPublicHttpsUrl(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 2048) {
    throw new UnsafeInputError(`Invalid parameter: ${fieldName}`);
  }
  let parsed: URL;
  try {
    parsed = new URL(value.trim());
  } catch {
    throw new UnsafeInputError(`Invalid parameter: ${fieldName}`);
  }
  if (parsed.protocol !== 'https:') throw new UnsafeInputError(`${fieldName} must use https`);
  if (parsed.username || parsed.password) throw new UnsafeInputError(`${fieldName} must not carry credentials`);
  if (parsed.port && parsed.port !== '443') throw new UnsafeInputError(`${fieldName} must use the standard port`);
  const host = parsed.hostname.toLowerCase();
  if (!host || host === 'localhost' || !host.includes('.') && !host.includes(':') ) {
    throw new UnsafeInputError(`${fieldName} must name a public host`);
  }
  if (PRIVATE_NAME_SUFFIXES.some((suffix) => host.endsWith(suffix))) {
    throw new UnsafeInputError(`${fieldName} must name a public host`);
  }
  if (isPrivateAddress(host)) throw new UnsafeInputError(`${fieldName} must name a public host`);
  return `${parsed.origin}${parsed.pathname.replace(/\/+$/, '')}`;
}

/** Rejects a host whose name resolves to a private address; `resolve` is injectable so callers and tests need no network. */
export async function assertResolvesToPublicAddresses(
  hostname: string,
  resolve: (name: string) => Promise<string[]>,
): Promise<void> {
  const addresses = await resolve(hostname);
  if (addresses.length === 0 || addresses.some(isPrivateAddress)) {
    throw new UnsafeInputError('host must resolve to a public address');
  }
}
