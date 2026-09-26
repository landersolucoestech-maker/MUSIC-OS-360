/**
 * legacy-platform-fields.guard.spec.ts
 *
 * Permanent guard: the Artist domain works EXCLUSIVELY with
 * spotify_url/youtube_url/foto_url. No reference to spotify_artist_id,
 * youtube_artist_id, youtube_channel_id may exist as a PERSISTED or
 * EXPOSED field (database column, DTO property, export/import header,
 * API payload). If any DTO, entity, service or mapper reintroduces
 * these fields, this test fails immediately.
 *
 * What this guard does NOT forbid (Platforms 17 — post-Soundcharts
 * re-audit): extracting an in-memory ID, from an already-validated URL, to
 * address an external API that only accepts an ID (never a URL) — as long
 * as the ID is never persisted on the Artist entity nor exposed in
 * DTO/export/import. This pattern already existed before Soundcharts
 * (exception 1 below) and legitimately repeated in the new metrics
 * architecture (exceptions 3 and 4) for the same reason: Soundcharts also
 * resolves an artist by platform ID, not by URL.
 *
 * Documented and approved exceptions — each proven by the same rule
 * (ID only in memory, never persisted/exposed; see the dedicated test
 * below, which runs the SAME check for all of them):
 *
 *   1. artist-external-profile-sync.service.ts — the PRIVATE methods
 *      extractSpotifyArtistId/resolveYoutubeRef (renamed from
 *      extractYouTubeChannelId — find-eb3c5c45-class, now delegates to
 *      the single canonical parser in youtube-ref.util.ts) extract an
 *      in-memory ID/ref to call the real Spotify/YouTube APIs directly.
 *
 *   2. create-artist.dto.spec.ts — regression test that sends the legacy
 *      fields as a fixture, exactly to prove that the API REJECTS them
 *      (whitelist/forbidNonWhitelisted). Referencing them there is the
 *      test itself.
 *
 *   3. platform-profiles/providers/spotify-artist-profile.provider.ts —
 *      calls `parseSpotifyArtistId(url)` (pure utility, see exception 5)
 *      only to obtain the ID that `SoundchartsService.resolveArtistByPlatform`
 *      requires; the ID never leaves the function's scope, never goes
 *      into `raw_payload` nor into any `artists` column.
 *
 *   4. platform-profiles/soundcharts-canonical-candidates.util.ts — resolves
 *      the canonical spotify→youtube→deezer→soundcloud chain for
 *      Soundcharts; uses `parseSpotifyArtistId` (exception 5) and the
 *      local function `extractYouTubeChannelId` (pure regex, only
 *      recognizes an already-explicit UC… id in the URL — @handle
 *      resolution stays isolated inside YouTubeArtistProfileProvider,
 *      which uses the YouTube Data API, not this util). Neither ID is
 *      persisted — they only serve to build
 *      `{ platform, externalId }` and call Soundcharts.
 *
 *   5. integrations/spotify/spotify-url.util.ts (+ its spec) — the parser
 *      itself (`parseSpotifyArtistId`), a pure I/O-free function, shared
 *      DELIBERATELY by exceptions 3/4 (Soundcharts) and by
 *      integrations/spotify/spotify.service.ts (OAuth for connecting a
 *      Spotify account — Integrations domain, does not touch
 *      ArtistEntity). Outside the Artist domain by definition — never
 *      reads/writes `artists`.
 *
 *   6. integrations/spotify/spotify.service.ts — OAuth service
 *      (getAuthUrl/handleCallback/disconnect/getValidToken) over
 *      OAuthConnectionEntity, not ArtistEntity; uses `parseSpotifyArtistId`
 *      only for `extractArtistId()`/`syncArtistMetrics()` (Integrations'
 *      own endpoint, with no write to `artists` or
 *      `artist_platform_profiles`). Outside the Artist domain.
 *      NOTE (not fixed here — out of scope for this task):
 *      `syncArtistMetrics()` partially duplicates the responsibility of
 *      `SpotifyArtistProfileProvider.resolve()` (both fetch public artist
 *      data from Spotify), but via different routes and for different
 *      consumers — it does not persist to `artist_platform_profiles`, so
 *      it does not threaten the rule protected by this guard.
 *      Investigating whether it still has a real consumer is a separate
 *      product decision, not an obvious dead-code fix.
 */
import * as fs from 'fs';
import * as path from 'path';

const SRC_ROOT = path.resolve(__dirname, '..', '..');
const THIS_FILE = path.resolve(__filename);

function resolveInSrc(relativePath: string): string {
  return path.resolve(SRC_ROOT, relativePath);
}

const ALL_EXCEPTIONS = new Set([
  resolveInSrc('modules/artists/platform-profiles/artist-external-profile-sync.service.ts'),
  resolveInSrc('modules/artists/dto/create-artist.dto.spec.ts'),
  resolveInSrc('modules/artists/platform-profiles/providers/spotify-artist-profile.provider.ts'),
  resolveInSrc('modules/artists/platform-profiles/soundcharts-canonical-candidates.util.ts'),
  resolveInSrc('modules/integrations/spotify/spotify-url.util.ts'),
  resolveInSrc('modules/integrations/spotify/spotify-url.util.spec.ts'),
  resolveInSrc('modules/integrations/spotify/spotify.service.ts'),
]);

// Real shapes the removed fields would take if they leaked into a database
// column, DTO property, export/import header or API payload — EVERYTHING in
// this codebase uses snake_case for those contexts (see ArtistEntity,
// CreateArtistDto, ReportEntityDefinition). camelCase is additional, only to
// cover code identifiers (TS variable/property).
const FORBIDDEN_SNAKE = [
  /spotify_artist_id/i,
  /youtube_artist_id/i,
  /youtube_channel_id/i,
];

const FORBIDDEN_CAMEL = [
  /spotifyArtistId/i,
  /youtubeArtistId/i,
  /youtubeChannelId/i,
];

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist') continue;
      // Rollback migrations (down()) are the explicit exception to rule 7 —
      // they purposely recreate legacy columns to revert the drop migration.
      if (full === path.resolve(SRC_ROOT, 'database/migrations')) continue;
      walk(full, out);
    } else if (/\.tsx?$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

describe('Permanent guard: Artist domain only uses foto_url/spotify_url/youtube_url', () => {
  const allFiles = walk(SRC_ROOT).filter((f) => f !== THIS_FILE);

  it('no file (except migrations/down and documented exceptions) contains the snake_case forms of the removed fields', () => {
    const violations: string[] = [];
    for (const file of allFiles) {
      if (ALL_EXCEPTIONS.has(file)) continue;
      const content = fs.readFileSync(file, 'utf8');
      for (const pattern of FORBIDDEN_SNAKE) {
        if (pattern.test(content)) {
          violations.push(`${path.relative(SRC_ROOT, file)} — matched ${pattern}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it('no file (except documented exceptions) contains the camelCase forms of the removed fields', () => {
    const violations: string[] = [];
    for (const file of allFiles) {
      if (ALL_EXCEPTIONS.has(file)) continue;
      const content = fs.readFileSync(file, 'utf8');
      for (const pattern of FORBIDDEN_CAMEL) {
        if (pattern.test(content)) {
          violations.push(`${path.relative(SRC_ROOT, file)} — matched ${pattern}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it('NO extract-by-ID exception persists or exposes the snake_case form (the ID stays only in memory)', () => {
    // Generalization (Platforms 17): previously only exception 1 was checked
    // this way. Now all 6 "extracts an in-memory ID to call an external API"
    // exceptions go through the SAME proof — if any of them lets the
    // snake_case form leak into the file (the shape a persisted/exposed
    // field would take), the guard fails even though it's an exception.
    // create-artist.dto.spec.ts is purposely excluded: it is the ONLY case
    // where the snake_case form MUST appear — the fixture sends these exact
    // fields to prove the API rejects them (see the dedicated test below).
    const dtoRegressionSpec = resolveInSrc('modules/artists/dto/create-artist.dto.spec.ts');
    for (const exceptionFile of ALL_EXCEPTIONS) {
      if (exceptionFile === dtoRegressionSpec) continue;
      const content = fs.readFileSync(exceptionFile, 'utf8');
      for (const pattern of FORBIDDEN_SNAKE) {
        expect(content).not.toMatch(pattern);
      }
    }
  });

  it('create-artist.dto.spec.ts contains the snake_case form only as a rejection fixture, never as an accepted value', () => {
    const content = fs.readFileSync(resolveInSrc('modules/artists/dto/create-artist.dto.spec.ts'), 'utf8');
    expect(content).toMatch(/rejects payload/i);
    expect(content).toMatch(/errors\.length\)\.toBeGreaterThan\(0\)/);
  });

  it('the sync service exception keeps the extraction as a private method (not exposed on the class public API)', () => {
    const content = fs.readFileSync(
      resolveInSrc('modules/artists/platform-profiles/artist-external-profile-sync.service.ts'),
      'utf8',
    );
    expect(content).toMatch(/private\s+extractSpotifyArtistId/);
    // find-eb3c5c45-class: extractYouTubeChannelId was renamed to
    // resolveYoutubeRef and now delegates to youtube-ref.util.ts's
    // parseYoutubeRef (the single canonical YouTube ref parser) — still a
    // private, in-memory-only method, same exception category.
    expect(content).toMatch(/private\s+resolveYoutubeRef/);
  });

  it('no documented exception persists the ID in artist_platform_profiles.raw_payload or in any artists column', () => {
    // The only real data that may survive past the end of the function is the
    // Soundcharts UUID (raw_payload.soundcharts_uuid) — never the id/handle of
    // the origin platform itself (spotify/youtube).
    for (const relativePath of [
      'modules/artists/platform-profiles/providers/spotify-artist-profile.provider.ts',
      'modules/artists/platform-profiles/soundcharts-canonical-candidates.util.ts',
    ]) {
      const content = fs.readFileSync(resolveInSrc(relativePath), 'utf8');
      expect(content).not.toMatch(/raw_payload\s*:\s*\{[^}]*spotify_?[Aa]rtist_?[Ii]d/);
      expect(content).not.toMatch(/raw_payload\s*:\s*\{[^}]*youtube_?[Cc]hannel_?[Ii]d/);
    }
  });
});
