/**
 * Spotify artist URL parsing, shared by SpotifyService and
 * SpotifyArtistProfileProvider. Uses `URL` (real hostname) instead of a regex
 * over the whole string — `evil.com/artist/xyz` or
 * `open.spotify.com/track/xyz` must never be accepted as an artist.
 */
export function parseSpotifyArtistId(value: string): string | null {
  if (!value) return null;

  // Bare ID/URI (no slashes) — accepted directly, without URL parsing.
  if (/^[A-Za-z0-9]{10,}$/.test(value)) return value;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }

  const host = url.hostname.toLowerCase();
  if (host !== 'open.spotify.com' && !host.endsWith('.open.spotify.com')) return null;

  // Path segments, without empty ones (trailing or double slash). Accepts the
  // standard `/artist/{id}` format and the locale-prefixed `/intl-pt/artist/{id}`.
  const segments = url.pathname.split('/').filter(Boolean);
  const artistIdx = segments.indexOf('artist');
  if (artistIdx === -1 || artistIdx > 1) return null;
  const id = segments[artistIdx + 1];
  return id && /^[A-Za-z0-9]+$/.test(id) ? id : null;
}
