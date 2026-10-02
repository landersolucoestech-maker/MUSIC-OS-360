/**
 * platform-profiles/dev-social-metrics-mock.ts
 *
 * DEVELOPMENT fallback for Instagram/TikTok when Soundcharts answers
 * "no linked social account" (a real 404, validated against the API —
 * see InstagramArtistProfileProvider/TikTokArtistProfileProvider). This is
 * not a pipeline bug: synthetic dev/seed artists will never be indexed in
 * Soundcharts. Without this fallback the card stays permanently
 * "Indisponível" (UI label) in any local environment, even with valid credentials.
 *
 * Same gate as AUTH_DISABLED/USE_MOCK (env.schema.ts): activates only with
 * BOTH
 *   1. explicit opt-in DEV_SOCIAL_METRICS_MOCK=true (canonical name) or its
 *      deprecated alias USE_MOCK=true — both blocked in staging/production by
 *      PROD_FORBIDDEN_BYPASS_FLAGS (env.schema.ts, create-app.ts,
 *      security-startup.service.ts);
 *   2. NODE_ENV is not production/staging (isProdLike).
 * Real Soundcharts data ALWAYS takes priority — this fallback only runs
 * after the real resolution (canonical + own handle) has already returned 404.
 * The resulting snapshot is marked with raw_payload.source = 'dev_mock' so it
 * is never mistaken for a real metric (it never appears in production).
 */
import { createHash } from 'crypto';
import { isProdLike } from '../../../core/config/runtime-environment';

export function isDevMockSocialMetricsEnabled(): boolean {
  const optedIn = process.env['DEV_SOCIAL_METRICS_MOCK'] === 'true' || process.env['USE_MOCK'] === 'true';
  return optedIn && !isProdLike(process.env['NODE_ENV']);
}

/**
 * Deterministic follower count per (artistId, platform) — stable across
 * re-syncs (does not flicker on every refresh), with no dependency on any
 * random library. Plausible range for an independent artist
 * (1,000–150,000), never 0 (a real 0 has its own meaning: "no followers
 * yet", different from "no data available" — not what this mock simulates).
 */
export function mockFollowersFor(artistId: string, platform: 'instagram' | 'tiktok'): number {
  const hash = createHash('sha256').update(`${artistId}:${platform}`).digest();
  const seed = hash.readUInt32BE(0);
  return 1_000 + (seed % 149_000);
}
