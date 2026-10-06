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

/** Expands any textual IPv6 form (compressed, uncompressed, dotted IPv4 tail, zone id) to eight 16-bit groups, or null. */
function ipv6Groups(text: string): number[] | null {
  let ip = text.split('%')[0];
  const dotted = /(\d{1,3}(?:\.\d{1,3}){3})$/.exec(ip);
  if (dotted) {
    const octets = ipv4Octets(dotted[1]);
    if (!octets) return null;
    ip = ip.slice(0, ip.length - dotted[1].length)
      + ((octets[0] << 8) | octets[1]).toString(16) + ':' + ((octets[2] << 8) | octets[3]).toString(16);
  }
  const halves = ip.split('::');
  if (halves.length > 2) return null;
  const parse = (part: string): number[] | null => {
    if (part === '') return [];
    const groups = part.split(':').map((g) => (/^[0-9a-f]{1,4}$/.test(g) ? parseInt(g, 16) : NaN));
    return groups.some(Number.isNaN) ? null : groups;
  };
  const head = parse(halves[0]);
  const tail = halves.length === 2 ? parse(halves[1]) : [];
  if (!head || !tail) return null;
  if (halves.length === 1) return head.length === 8 ? head : null;
  const missing = 8 - head.length - tail.length;
  return missing < 1 ? null : [...head, ...new Array<number>(missing).fill(0), ...tail];
}

const embeddedIpv4 = (hi: number, lo: number): number[] => [hi >> 8, hi & 255, lo >> 8, lo & 255];

/** True for any address a tenant-configured URL must not reach (IPv4 or IPv6, literal form). */
export function isPrivateAddress(address: string): boolean {
  const ip = address.replace(/^\[|\]$/g, '').toLowerCase();
  const v4 = ipv4Octets(ip);
  if (v4) return isPrivateIpv4(v4);
  if (!ip.includes(':')) return false;
  const g = ipv6Groups(ip);
  if (!g) return true; // not a parseable address: never treat it as public
  const [g0, g1, g2, g3, g4, g5, g6, g7] = g;
  const zeros = (...groups: number[]) => groups.every((x) => x === 0);
  if (zeros(g0, g1, g2, g3, g4, g5, g6) && (g7 === 0 || g7 === 1)) return true;           // :: and ::1
  if (zeros(g0, g1, g2, g3, g4) && g5 === 0xffff) return isPrivateIpv4(embeddedIpv4(g6, g7)); // ::ffff:a.b.c.d
  if (zeros(g0, g1, g2, g3) && g4 === 0xffff && g5 === 0) return isPrivateIpv4(embeddedIpv4(g6, g7)); // ::ffff:0:a.b.c.d (SIIT)
  if (zeros(g0, g1, g2, g3, g4, g5)) return isPrivateIpv4(embeddedIpv4(g6, g7));              // IPv4-compatible
  if (g0 === 0x64 && g1 === 0xff9b) {
    if (g2 === 1) return true;                                                              // RFC 8215 local-use /48
    if (zeros(g2, g3, g4, g5)) return isPrivateIpv4(embeddedIpv4(g6, g7));                  // NAT64 64:ff9b::/96
  }
  if (g0 === 0x2002) return isPrivateIpv4(embeddedIpv4(g1, g2));                            // 6to4
  if (g0 === 0x2001 && g1 === 0) return true;                                               // Teredo 2001::/32
  if (g0 === 0x2001 && g1 === 0xdb8) return true;                                           // documentation 2001:db8::/32
  if (g0 === 0x100 && zeros(g1, g2, g3)) return true;                                       // discard-only 100::/64
  return (
    (g0 & 0xfe00) === 0xfc00 ||                                                             // fc00::/7 unique local
    (g0 & 0xffc0) === 0xfe80 ||                                                             // fe80::/10 link-local
    (g0 & 0xffc0) === 0xfec0 ||                                                             // fec0::/10 site-local (deprecated)
    (g0 & 0xff00) === 0xff00                                                                // ff00::/8 multicast
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
  // A trailing dot names the same host (`localhost.`): judge the name without it.
  const host = parsed.hostname.toLowerCase().replace(/\.$/, '');
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

export type HostResolver = (name: string) => Promise<string[]>;

/**
 * A `dns.lookup`-compatible function for `https.request({ lookup })` that refuses private answers. The address it
 * returns is the one the socket connects to, so validation and connection share one resolution and a name that
 * answers differently the second time (DNS rebinding) cannot reach an address that was never checked.
 */
export function createPublicOnlyLookup(resolve: HostResolver) {
  type Callback = (error: Error | null, address?: unknown, family?: number) => void;
  const familyOf = (address: string): number => (address.includes(':') ? 6 : 4);
  return (hostname: string, options: unknown, callback?: Callback): void => {
    const done = (typeof options === 'function' ? options : callback) as Callback;
    const wantsAll = typeof options === 'object' && options !== null && (options as { all?: boolean }).all === true;
    resolve(hostname).then((addresses) => {
      if (addresses.length === 0 || addresses.some(isPrivateAddress)) {
        throw new UnsafeInputError('host must resolve to a public address');
      }
      if (wantsAll) done(null, addresses.map((address) => ({ address, family: familyOf(address) })));
      else done(null, addresses[0], familyOf(addresses[0]));
    }).catch((error: Error) => done(error));
  };
}
