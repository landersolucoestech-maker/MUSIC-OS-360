# AGENT-05 — External Integrations Mechanical Inventory

subagent_type: integration-reviewer
scope: mechanical provider discovery (not a fixed guessed list), Instagram analytics/marketing separation, Soundcharts/Spotify identity-equivalence check
input_snapshot: HEAD 8c477787c043bdf0ceecf9feafe27a17fc932a3c
tool_uses: 31
duration_ms: 348804
status: COMPLETED

## Method
Read apps/api/package.json and apps/web/package.json in full; grepped apps/api/src and apps/web/src for literal https:// external hosts and *_API_KEY/*_CLIENT_ID/*_CLIENT_SECRET/*_ACCESS_KEY/*_WEBHOOK_SECRET env-var references in source (not .env files).

## Providers discovered (25), each with file:line evidence
Soundcharts, Spotify, Instagram/Meta (analytics via Soundcharts), Instagram/Meta (MusicChat OAuth), Instagram/Meta/TikTok/YouTube (marketing/ads generic OAuth), TikTok, YouTube, Google Ads, Deezer, SoundCloud, Apple Music, ACRCloud, Autentique, DocuSign, Stripe, WhatsApp Cloud (Meta), Resend, OpenAI, Anthropic, Google Generative AI, AWS S3/Cloudflare R2, Supabase, Sentry, PostHog, Abramus (no https:// host found — flagged as possibly not yet wired to a real endpoint), UBC/ECAD (not confirmed via URL/env grep this pass — flagged for follow-up).

Full table with exact file:line citations for every PURPOSE/OWNER_MODULE/AUTH_TYPE/scope claim is in the agent's full result (see task-notification for agent a568f8401bca79e3f, 2026-09-24).

## Finding 1 — Instagram analytics vs marketing: CONFIRMED two genuinely separate flows
Backed by an explicit source comment (`instagram-artist-profile.provider.ts:13-16`): the analytics provider explicitly documents it is "nunca a conexão OAuth de Marketing/MusicChat... uma integração tenant-scoped completamente separada" and only depends on SoundchartsService, never touches graph.facebook.com.

## Finding 2 (NEW) — real code duplication: Meta OAuth token-exchange implemented twice
`apps/api/src/modules/integrations/instagram/instagram.service.ts` (tenant-scoped single-account OAuth, PROVIDER='instagram') and `apps/api/src/modules/integrations/integrations.controller.ts:44-49,151,179-215` (generic marketing OAuth for corp_instagram/meta_business/meta_ads) both independently implement the same short-token->long-token Meta Graph exchange against the same META_APP_ID/META_APP_SECRET, rather than the controller delegating to InstagramService. Not asserted as a bug requiring a fix -- flagged as observed duplication with file:line evidence, disposition left open (could be intentional separation of tenant-scoped vs corporate-level OAuth, or genuine duplication worth consolidating -- NOT_PROVEN which, requires a product/architecture call, same as other open findings this session).

## Finding 3 — internalArtistId/Soundcharts-UUID/Spotify-ID equivalence: NOT FOUND (real negative, proven)
`grep -rn "internalArtistId"` across apps/api/src: zero matches (identifier doesn't exist in this codebase). soundcharts-canonical-candidates.util.ts's own doc comment (lines 143-157) explicitly states UUID divergence is "PURAMENTE DIAGNÓSTICO... NUNCA deve gatear persistência de métrica". artist-metric-snapshots.service.ts uses artist_id consistently as the internal PK, never a provider ID, confirmed via actual query context.

## Classification
- Finding 1: DISPROVEN (as a contamination risk) -- confirmed safe separation
- Finding 2: OPEN, NEEDS_PRODUCT_DECISION-adjacent (architecture disposition, not urgent, no security impact identified)
- Finding 3: DISPROVEN (as a risk) -- confirmed absent
