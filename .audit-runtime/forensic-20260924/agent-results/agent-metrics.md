# AGENT-METRICS — Platform Metrics Provider Integration Audit

subagent_type: integration-reviewer
input_snapshot: HEAD 8c477787c043bdf0ceecf9feafe27a17fc932a3c
tool_uses: 32
duration_ms: 276295
status: COMPLETED

## Contract compliance: PASS, no violation, all 7 platforms
Auth mechanism (all 7): SoundchartsService.isConfigured() -- OAuth2 client_credentials, app-level (SOUNDCHARTS_CLIENT_ID/SECRET), never a per-user token. Zero of the 7 provider resolve() methods accept/require per-user OAuth. Reinforced by an EXISTING regression test: apps/web/src/modules/artist/components/public-metrics-no-oauth.guard.test.ts asserts ArtistPlatformMetrics.tsx never contains connect-account UI copy or oauth/init/exchange calls -- independently confirmed by reading the full 514-line component, zero connect/OAuth UI found for any of the 7 platform cards.

## METRICS_SOURCE_MATRIX (7/7, file:line evidence for each)
1. Instagram -- instagram-artist-profile.provider.ts, source=Soundcharts /audience/instagram (NOT Instagram's own API), mapping via artist.metadata.instagram_url (JSON, not a column)
2. TikTok -- tiktok-artist-profile.provider.ts, source=Soundcharts /audience/tiktok, mapping via artist.metadata.tiktok_url (JSON, not a column)
3. Spotify -- spotify-artist-profile.provider.ts, source=Soundcharts /streaming/spotify/listening (explicitly not Spotify's public API, which lacks monthly-listener exposure), mapping via artist.spotify_url (real column)
4. YouTube -- youtube-artist-profile.provider.ts, ALL metrics from Soundcharts /audience/youtube (documented "SOUNDCHARTS ONLY" per an internal 2026-08-31 audit comment); YouTube Data API (YOUTUBE_API_KEY) used ONLY for handle->channel-id identity resolution, never metric values; mapping via artist.youtube_url (real column)
5. Deezer -- deezer-artist-profile.provider.ts, source=Soundcharts /audience/deezer (Deezer's own public API deliberately not used, to avoid dual sources); mapping via artist.deezer_url (real column)
6. Apple Music -- apple-music-artist-profile.provider.ts, source=Soundcharts playlist-reach endpoint only (Soundcharts has no audience/follower endpoint for Apple Music); mapping via artist.apple_music_url (real column)
7. SoundCloud -- soundcloud-artist-profile.provider.ts, source=Soundcharts /audience/soundcloud (no longer depends on SOUNDCLOUD_CLIENT_ID/SECRET for this metric); mapping via artist.soundcloud_url (real column)

Persistence (all 7): current-state row in ArtistPlatformProfileEntity (upsert) + historical points in ArtistMetricSnapshotEntity, written by artist-platform-profiles.service.ts. Reads serve the persisted row; live fetch only on manual "Sincronizar agora".

## Non-violation findings (flagged, not contract breaks)
1. Stale frontend source-comments: ArtistPlatformMetrics.tsx:50,59 still describe Deezer/SoundCloud as using each platform's own "public API, no OAuth" -- no longer true (both are Soundcharts-sourced per the backend providers' own doc comments). No security/behavior impact (both paths are still app-credential-only either way), but misleading internal documentation.
2. Instagram/TikTok external IDs live in artist.metadata JSON (not first-class ArtistEntity columns) unlike the other 5 platforms (real columns) -- explicit in code comments, deterministic mapping, but schema-inconsistent. Minor data-governance note.
3. Dev-mock fallback (dev-social-metrics-mock.ts) properly fenced: only activates on a real Soundcharts 404 AND an explicit dev-mock-enabled flag; explicitly refused from persisting into the historical snapshot table (source:'dev_mock' check); frontend labels it "dados de demonstração (dev)". Legitimate affordance, not a hidden fabrication risk.

## Classification summary
- METRICS module: CONTRACT VERIFIED, real evidence, 7/7 platforms PASS
- Real data-source-vs-UI-label discrepancy documented for all 7 (UI says platform name, technical source is Soundcharts for all 7)
- 3 minor findings recorded, none contract-violating
