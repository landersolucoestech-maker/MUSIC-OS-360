import * as fs from 'fs';
import * as path from 'path';

/**
 * soundcharts-only-metrics.guard.spec.ts
 *
 * Permanent guard (2026-08-31 audit): ALL platform metrics
 * on the artist card must come exclusively from Soundcharts — never from
 * the YouTube Data API / Spotify API / SoundCloud API / Meta Graph API / TikTok
 * API / Deezer API / Apple Music API directly. Real finding fixed in this
 * audit: YouTubeArtistProfileProvider fetched total_views/total_videos
 * via the YouTube Data API `channels?part=statistics`, while subscribers
 * already came from Soundcharts — two competing metric engines on the same
 * card. Soundcharts `/audience/youtube` already returns followerCount, postCount
 * and viewCount in the SAME item, so the statistics call was removed
 * (see SoundchartsService.getYouTubeAudience). This guard scans the real
 * source code of the 7 providers so this regression never comes back
 * silently — it fails in CI/local and does not depend on someone remembering to
 * update a mocked test.
 */
const PROVIDERS_DIR = path.resolve(__dirname, 'providers');

const PROVIDER_FILES = [
  'spotify-artist-profile.provider.ts',
  'youtube-artist-profile.provider.ts',
  'deezer-artist-profile.provider.ts',
  'soundcloud-artist-profile.provider.ts',
  'instagram-artist-profile.provider.ts',
  'tiktok-artist-profile.provider.ts',
  'apple-music-artist-profile.provider.ts',
];

function readProvider(file: string): string {
  return fs.readFileSync(path.join(PROVIDERS_DIR, file), 'utf8');
}

/**
 * Strips `//` and `/* *‍/` comments before scanning — the providers themselves
 * document in prose what they NO LONGER use (e.g. "no longer depends
 * on SOUNDCLOUD_CLIENT_ID"), which would make a naive grep flag a historical
 * mention as if it were a real call. The guard must scan executable
 * code, not the explanation of the code.
 */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

// Patterns that only make sense as a direct provider METRIC CALL —
// they never appear in legitimate identity resolution (id/handle lookup).
// Checked against CODE (comments already stripped), not prose.
const METRIC_ONLY_PATTERNS = [
  /part=statistics/, // YouTube Data API — channel statistics (views/videos/subscribers)
  /subscriberCount/,
  /\.statistics\??\./, // access to the `statistics` object of the YouTube Data API response
  /SOUNDCLOUD_CLIENT_ID/,
  /nb_fan/, // metric field of the public Deezer API
  /graph\.facebook\.com|graph\.instagram\.com/,
  /open\.tiktokapis\.com/,
  /api\.spotify\.com/,
  /api\.deezer\.com/,
  /itunes\.apple\.com|api\.music\.apple\.com/,
];

describe('SOUNDCHARTS ONLY — no platform metric provider calls a direct API', () => {
  it.each(PROVIDER_FILES)('%s: nenhum padrão de métrica de API direta presente no código executável', (file) => {
    const src = stripComments(readProvider(file));
    for (const pattern of METRIC_ONLY_PATTERNS) {
      expect(src).not.toMatch(pattern);
    }
  });

  it('YouTubeArtistProfileProvider: the YouTube Data API is referenced only for IDENTITY RESOLUTION (part=id / search), never for metrics', () => {
    const src = readProvider('youtube-artist-profile.provider.ts');
    // The only two direct network calls allowed: channelId resolution
    // by handle/username (part=id) and search by name (search).
    const fetchCalls = [...src.matchAll(/fetch\(\s*`\$\{YOUTUBE_API\}([^`]*)`/g)].map((m) => m[1]);
    expect(fetchCalls.length).toBeGreaterThan(0);
    for (const call of fetchCalls) {
      const isIdentityLookup = call.includes('part=id') || call.startsWith('/search');
      expect(isIdentityLookup).toBe(true);
    }
    // subscribers/total_views/total_videos must all come from ONE Soundcharts call.
    expect(src).toContain('getYouTubeAudience');
    expect(src).not.toContain('getYouTubeSubscribers');
    expect(src).not.toContain('fetchChannelStatistics');
  });

  it('all 7 providers depend on SoundchartsService for the metric shown on the card', () => {
    for (const file of PROVIDER_FILES) {
      const src = readProvider(file);
      expect(src).toContain('SoundchartsService');
    }
  });

  it('SoundchartsService: metric methods only target customer.api.soundcharts.com/account.soundcharts.com hosts', () => {
    const src = fs.readFileSync(
      path.resolve(__dirname, '../../integrations/soundcharts/soundcharts.service.ts'),
      'utf8',
    );
    expect(src).toContain("'account.soundcharts.com', 'customer.api.soundcharts.com'");
  });
});
