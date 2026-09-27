import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Finding closed by this fix: the backend (instagram-artist-profile.provider.ts
 * / tiktok-artist-profile.provider.ts) already classifies identity resolution
 * in raw_payload.primary_identity_status ('VERIFIED_EXACT' | 'INSUFFICIENT_EVIDENCE'
 * | 'PROFILE_NOT_FOUND') -- a follower count resolved via the canonical UUID
 * (cross-platform fallback, no exact handle confirmation) appeared, without
 * that distinction, with the same visual confidence as an exact value, even
 * though the Soundcharts catalog can fragment a real artist into several
 * internal entities.
 *
 * This guard mechanically proves the distinction reached the UI for the two
 * providers that use the canonical fallback (Instagram, TikTok) -- the other 5
 * (Spotify/YouTube/Deezer/AppleMusic/SoundCloud) resolve only by direct lookup
 * (no cross-platform canonical UUID), so they do not need this indicator.
 */
const FILE = join(__dirname, "ArtistPlatformMetrics.tsx");
const source = readFileSync(FILE, "utf8");

describe("The unconfirmed-identity indicator (primary_identity_status) reaches the UI", () => {
  it("defines the isUnverifiedIdentitySnapshot helper reading primary_identity_status === INSUFFICIENT_EVIDENCE", () => {
    expect(source).toContain("function isUnverifiedIdentitySnapshot(");
    expect(source).toContain('raw_payload?.["primary_identity_status"] === "INSUFFICIENT_EVIDENCE"');
  });

  it("the Instagram card uses the helper for the visual indicator and the 'não confirmado' text", () => {
    const instagramCardStart = source.indexOf("metric-instagram-${artistId}");
    const instagramCardEnd = source.indexOf("hasInstagramProfileInput ? syncButton");
    const instagramCard = source.slice(instagramCardStart, instagramCardEnd);
    expect(instagramCard).toContain("isUnverifiedIdentitySnapshot(instagramSnapshot)");
    expect(instagramCard).toContain("não confirmado");
  });

  it("the TikTok card uses the helper for the visual indicator and the 'não confirmado' text", () => {
    const tiktokCardStart = source.indexOf("metric-tiktok-${artistId}");
    const tiktokCardEnd = source.indexOf("hasTikTokProfileInput ? syncButton");
    const tiktokCard = source.slice(tiktokCardStart, tiktokCardEnd);
    expect(tiktokCard).toContain("isUnverifiedIdentitySnapshot(tiktokSnapshot)");
    expect(tiktokCard).toContain("não confirmado");
  });

  it("the indicator is not confused with the demo data label (dev_mock)", () => {
    // isDevMockSnapshot and isUnverifiedIdentitySnapshot are independent
    // conditions reading distinct raw_payload fields -- one never replaces the
    // other.
    expect(source).toContain('raw_payload?.["source"] === "dev_mock"');
    expect(source).toContain('raw_payload?.["primary_identity_status"] === "INSUFFICIENT_EVIDENCE"');
  });
});
