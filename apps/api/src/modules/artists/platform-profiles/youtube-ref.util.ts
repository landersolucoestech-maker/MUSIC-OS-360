export type YoutubeRef = { kind: 'id' | 'handle' | 'username' | 'custom'; value: string };

/**
 * Single canonical parser for any YouTube channel identifier/URL — bare
 * `UC…` id, `@handle`, and URLs `/channel/UC…`, `/@handle`, `/user/NAME`
 * (legacy), `/c/NAME` (custom) and bare `/NAME` (legacy custom).
 *
 * find-eb3c5c45-class (naming-canonical.md "one business rule, one
 * authoritative implementation"): this used to be reimplemented 3 times
 * (YouTubeArtistProfileProvider.parseRef — the original, most permissive
 * version; a narrower hand-rolled regex on the sync-service side accepting
 * only a bare/`/channel/` id; and two separate, even narrower regexes on
 * the frontend), so the same `@handle`
 * input could be accepted at one boundary and rejected at another. This is
 * now the one place the shape is defined; every layer imports it.
 */
export function parseYoutubeRef(raw: string): YoutubeRef | null {
  const value = (raw ?? '').trim();
  if (!value) return null;

  if (/^UC[A-Za-z0-9_-]{20,}$/.test(value)) return { kind: 'id', value };
  if (/^@[A-Za-z0-9._-]+$/.test(value)) return { kind: 'handle', value: value.slice(1) };

  let path = value;
  try {
    if (/^https?:\/\//i.test(value)) path = new URL(value).pathname;
  } catch { /* treat as raw path */ }
  path = path.replace(/^\/+|\/+$/g, '');

  const channel = path.match(/^channel\/(UC[A-Za-z0-9_-]{20,})/);
  if (channel) return { kind: 'id', value: channel[1]! };
  const handle = path.match(/^@([A-Za-z0-9._-]+)/);
  if (handle) return { kind: 'handle', value: handle[1]! };
  const user = path.match(/^user\/([A-Za-z0-9._-]+)/i);
  if (user) return { kind: 'username', value: user[1]! };
  const custom = path.match(/^c\/([A-Za-z0-9._-]+)/i);
  if (custom) return { kind: 'custom', value: custom[1]! };
  const bare = path.match(/^([A-Za-z0-9._-]+)$/);
  if (bare) return { kind: 'custom', value: bare[1]! };
  return null;
}
