/**
 * platform-profiles/metric-keys.ts
 *
 * Central typed registry of every platform metric persisted as a
 * historical series (Phase 2 — Time-Series Foundation). The snapshot store and
 * the history API import from here — no other place may scatter
 * arbitrary metric strings.
 */

export const METRIC_KEYS = {
  SPOTIFY_MONTHLY_LISTENERS: 'spotify.monthly_listeners',
  YOUTUBE_SUBSCRIBERS: 'youtube.subscribers',
  YOUTUBE_VIEWS: 'youtube.total_views',
  YOUTUBE_VIDEOS: 'youtube.total_videos',
  DEEZER_FANS: 'deezer.fans',
  SOUNDCLOUD_FOLLOWERS: 'soundcloud.followers',
  INSTAGRAM_FOLLOWERS: 'instagram.followers',
  TIKTOK_FOLLOWERS: 'tiktok.followers',
  APPLE_MUSIC_PLAYLIST_COUNT: 'apple-music.playlist_count',
} as const;

export type MetricKey = (typeof METRIC_KEYS)[keyof typeof METRIC_KEYS];

/** Explicit unit per metric — none is interchangeable with another (followers != listeners != views). */
export const METRIC_UNIT: Record<MetricKey, 'count'> = {
  [METRIC_KEYS.SPOTIFY_MONTHLY_LISTENERS]: 'count',
  [METRIC_KEYS.YOUTUBE_SUBSCRIBERS]: 'count',
  [METRIC_KEYS.YOUTUBE_VIEWS]: 'count',
  [METRIC_KEYS.YOUTUBE_VIDEOS]: 'count',
  [METRIC_KEYS.DEEZER_FANS]: 'count',
  [METRIC_KEYS.SOUNDCLOUD_FOLLOWERS]: 'count',
  [METRIC_KEYS.INSTAGRAM_FOLLOWERS]: 'count',
  [METRIC_KEYS.TIKTOK_FOLLOWERS]: 'count',
  [METRIC_KEYS.APPLE_MUSIC_PLAYLIST_COUNT]: 'count',
};

export function isMetricKey(value: string): value is MetricKey {
  return (Object.values(METRIC_KEYS) as string[]).includes(value);
}

/**
 * Primary metric (the same one shown on the UI platform card) per
 * platform — reused by the Phase 3 engines (Career Stage/
 * Benchmark) to read the current value from `SocialPlatformProfileSnapshot` without
 * duplicating the mapping. No generic string-typed entry: using the exact
 * `SocialPlatform` key (social-platform-sync.types.ts) avoids loose
 * strings — replicated here as a literal instead of imported to avoid a
 * circular dependency with that file.
 */
export const PRIMARY_METRIC_BY_PLATFORM: Record<
  'spotify' | 'youtube' | 'deezer' | 'soundcloud' | 'instagram' | 'tiktok' | 'apple-music',
  MetricKey
> = {
  spotify: METRIC_KEYS.SPOTIFY_MONTHLY_LISTENERS,
  youtube: METRIC_KEYS.YOUTUBE_SUBSCRIBERS,
  deezer: METRIC_KEYS.DEEZER_FANS,
  soundcloud: METRIC_KEYS.SOUNDCLOUD_FOLLOWERS,
  instagram: METRIC_KEYS.INSTAGRAM_FOLLOWERS,
  tiktok: METRIC_KEYS.TIKTOK_FOLLOWERS,
  'apple-music': METRIC_KEYS.APPLE_MUSIC_PLAYLIST_COUNT,
};

/** Extracts the current value of the primary metric from a profile snapshot (same rule as the frontend: never fabricates 0). */
export function primaryMetricValue(platform: keyof typeof PRIMARY_METRIC_BY_PLATFORM, snapshot: {
  followers: number | null;
  subscribers: number | null;
  monthly_listeners: number | null;
  raw_payload: Record<string, unknown>;
}): number | null {
  switch (platform) {
    case 'spotify': return snapshot.monthly_listeners;
    case 'youtube': return snapshot.subscribers;
    case 'deezer': case 'soundcloud': case 'instagram': case 'tiktok': return snapshot.followers;
    case 'apple-music': {
      const v = snapshot.raw_payload?.['playlist_count'];
      return typeof v === 'number' && Number.isFinite(v) ? v : null;
    }
  }
}
