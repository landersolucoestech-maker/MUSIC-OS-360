# Integration Context/Provider Contract Matrix — 17 contracts

Sovereign contract given 2026-09-24, superseding the earlier "Instagram Analytics vs Marketing" binary model. Audited against real code by 4 independent agents (AGENT-MC, AGENT-METRICS, AGENT-MARKETING, AGENT-CROSS-CONTEXT), each with fresh context, real file:line evidence. Full detail in `agent-results/agent-{mc,metrics,marketing,cross-context}.md`.

DISCOVERED_EXPECTED_CONTEXT_CONTRACTS = 17
AUDITED_EXPECTED_CONTEXT_CONTRACTS = 17

| # | Context | Provider | Expected login | Implemented login | Purpose fulfilled | Status | Evidence |
|---|---|---|---|---|---|---|---|
| 1 | MusicChat | Facebook | REQUIRED | NONE — static UI label (`connected:false`), zero backend code | NO | **VIOLATION** | SupportCenterView.tsx:501, conversations.service.ts:274-288 |
| 2 | MusicChat | Instagram | REQUIRED | NONE — same pattern | NO | **VIOLATION** | SupportCenterView.tsx:502, conversations.service.ts:274-288 |
| 3 | MusicChat | TikTok | REQUIRED | NONE — same pattern | NO | **VIOLATION** | SupportCenterView.tsx:503, conversations.service.ts:274-288 |
| 4 | MusicChat | Website | REQUIRED | NONE — no backend channel enum value exists at all | NO | **VIOLATION** | ConversationChannel enum has no site/website value; SupportCenterView.tsx:495-499 (explicit code comment) |
| 5 | Metrics | Instagram | NOT_REQUIRED | NOT_REQUIRED — Soundcharts app-credential only | YES | **MATCH** | instagram-artist-profile.provider.ts, public-metrics-no-oauth.guard.test.ts |
| 6 | Metrics | TikTok | NOT_REQUIRED | NOT_REQUIRED | YES | **MATCH** | tiktok-artist-profile.provider.ts |
| 7 | Metrics | Spotify | NOT_REQUIRED | NOT_REQUIRED | YES | **MATCH** | spotify-artist-profile.provider.ts |
| 8 | Metrics | YouTube | NOT_REQUIRED | NOT_REQUIRED — even the YT Data API key is app-level, only for identity resolution | YES | **MATCH** | youtube-artist-profile.provider.ts |
| 9 | Metrics | Deezer | NOT_REQUIRED | NOT_REQUIRED | YES | **MATCH** | deezer-artist-profile.provider.ts |
| 10 | Metrics | Apple Music | NOT_REQUIRED | NOT_REQUIRED | YES | **MATCH** | apple-music-artist-profile.provider.ts |
| 11 | Metrics | SoundCloud | NOT_REQUIRED | NOT_REQUIRED | YES | **MATCH** | soundcloud-artist-profile.provider.ts |
| 12 | Marketing | Instagram | REQUIRED | Real OAuth exists, but scopes are metrics-only (no publish scope) | NO — publish() throws unconditionally | **VIOLATION** | instagram.service.ts scopes L10; marketing-publishing.processor.ts:95-99 |
| 13 | Marketing | Facebook | REQUIRED | NONE — no dedicated service exists | NO | **NOT_IMPLEMENTED** | postiz.automation.ts:13 explicit "nenhum serviço de integração existe" |
| 14 | Marketing | TikTok | REQUIRED | Real OAuth exists, but scopes are read-only (no video.publish) | NO — publish() throws unconditionally | **VIOLATION** | tiktok.service.ts scopes L83; marketing-publishing.processor.ts:95-99 |
| 15 | Marketing | YouTube | REQUIRED | NONE — global YOUTUBE_API_KEY only, no per-user OAuth at all | NO | **VIOLATION** (direct contract contradiction) | youtube.service.ts:19-27, no getAuthUrl/handleCallback |
| 16 | Marketing | X | REQUIRED | NONE — no backend service exists | NO | **NOT_IMPLEMENTED** | postiz.automation.ts:13 |
| 17 | Marketing | Threads | REQUIRED | NONE — no backend service exists | NO | **NOT_IMPLEMENTED** | postiz.automation.ts:13 |

## Summary
- MATCH: 7/17 (all of Metrics)
- VIOLATION: 7/17 (all of MusicChat's 4, plus Marketing Instagram/TikTok/YouTube)
- NOT_IMPLEMENTED: 3/17 (Marketing Facebook/X/Threads)
- NOT_PROVEN: 0/17
- BLOCKED_EXTERNAL: 0/17

## Cross-context contamination: 12/13 adversarial questions clean, 1 benign finding
See agent-results/agent-cross-context.md for full detail. No auth/token/service sharing found between the three contexts anywhere (module-graph-level proof, not just code-reading). One real but low-severity finding: Soundcharts/market-reference cache keys lack tenant_id — benign because the cached data is public third-party metric data, not tenant-private, but worth a hygiene fix.

## Root classification of the 10 non-MATCH rows
This is NOT a security/contamination problem (cross-context audit came back clean). This is a **scope/completeness gap**: MusicChat's non-WhatsApp channels and Marketing's actual publish capability across all 6 platforms are UI/schema scaffolding without working backend implementations. Recommend recording as a single consolidated NEEDS_PRODUCT_DECISION: is this a known, accepted state (MusicChat = WhatsApp-only today, Marketing = drafting/scheduling only, no live publish yet), or a genuine prioritization gap the product wants closed? This determination is out of a code-audit's authority — it's a roadmap/scope question for product ownership.

## Original bug hypothesis (not proven, real next step given)
See agent-results/agent-cross-context.md's final section — a plausible, evidence-backed mechanism for "Instagram data appears incorrect" was identified (Soundcharts catalog fragmentation + a permissive INSUFFICIENT_EVIDENCE fallback path in instagram-artist-profile.provider.ts), but not confirmed as an active bug. Recommended next step: audit `raw_payload.primary_identity_status` for INSUFFICIENT_EVIDENCE cases and spot-check against real accounts.
