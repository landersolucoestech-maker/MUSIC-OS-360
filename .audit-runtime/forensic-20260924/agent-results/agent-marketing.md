# AGENT-MARKETING — Marketing Publishing Provider Integration Audit

subagent_type: integration-reviewer
input_snapshot: HEAD 8c477787c043bdf0ceecf9feafe27a17fc932a3c
tool_uses: 48
duration_ms: 386051
status: COMPLETED

## MAJOR FINDING 1: publishing unimplemented for all 6 platforms
marketing-publishing.processor.ts:95-99 -- publish() unconditionally throws "Publicacao real para {channel} nao configurada" for EVERY channel. Everything upstream (composer, scheduler queue, RLS-safe claim/idempotency) is real; the actual platform-post adapter does not exist for any of the 6. Confirmed independently by postiz.automation.ts's readiness check, whose own comment states facebook/twitter/threads have no integration service at all, and youtube has only a global read-only API key.

## MARKETING_PROVIDER_MATRIX (6/6, file:line evidence)
1. Instagram -- real OAuth (InstagramService), signed-HMAC CSRF state, token exchange, encrypted oauth_connections storage, proactive refresh scheduler. Scopes: instagram_basic,instagram_manage_insights,pages_show_list -- NO publish scope (no instagram_content_publish/pages_manage_posts). No publish call exists anywhere.
2. Facebook -- NO dedicated service exists at all. Folded only nominally into generic corp OAuth (meta_business/meta_ads). No Facebook-specific endpoint, no page-post call anywhere.
3. TikTok -- real OAuth (TikTokService), same signed-state mechanism. Scopes: user.info.basic,video.list -- read-only, no video.publish/video.upload. refresh_token captured but no refresh-execution code found (unlike Instagram's scheduler). No publish call exists.
4. YouTube -- NO OAuth at all. YouTubeService doesn't extend IntegrationBaseService, no getAuthUrl/handleCallback, authenticated solely by a global YOUTUBE_API_KEY env var. All exposed endpoints are read-only. Directly contradicts this service's own LOGIN_REQUIRED=TRUE contract.
5. X (Twitter) -- NO backend service exists anywhere. Confirmed scaffolded-only via postiz.automation.ts's explicit "not_implemented" comment. Frontend accepts the channel value and has preview chrome, but zero connect button, zero account picker entry, zero backend OAuth route.
6. Threads -- same as X, zero backend integration code, pure UI/content-model scaffolding.

## Cross-module sharing: NOT shared (confirmed for Instagram/TikTok/YouTube against MusicChat and Metrics)
MusicChat: zero real provider code for any of these 3 (matches AGENT-MC's finding exactly -- cross-confirmed by 2 independent agents). Metrics: uses SoundchartsService exclusively, explicit source comment confirms separation from Marketing's InstagramService.

## MAJOR FINDING 2 (new architectural wrinkle): dual OAuth paths within Marketing itself, composer reads the wrong one
Instagram/TikTok/YouTube each have TWO independently-coded, differently-keyed OAuth paths inside IntegrationsController: a dedicated "organic" flow (instagram/tiktok providers, metrics-only scopes) and a generic "corporate/ads" flow (corp_instagram/meta_business/meta_ads/corp_tiktok/tiktok_business/tiktok_ads/corp_youtube/youtube_business/google_business/google_ads/youtube_ads providers). The marketing composer's publish-eligibility gate (Calendario.tsx:353-358,517-520) reads the ADS/CORPORATE connection, not the platform-specific organic one -- an internal naming/wiring inconsistency, though moot for actual publishing since the processor stub throws regardless.

## Classification
FINDING, category D (functional gap) x2, NOT reconciled by the agent. This entire module's publish functionality is scaffolding, not a working feature, across all 6 platforms -- consistent in severity/nature with AGENT-MC's MusicChat finding. Recommends the same NEEDS_PRODUCT_DECISION treatment: is this a known, accepted "marketing publishing is not yet built" state, or a gap requiring prioritization.
