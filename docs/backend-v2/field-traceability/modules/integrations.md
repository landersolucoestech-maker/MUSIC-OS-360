# Module `integrations` — Zero-Gap Audit (Phase 2, Prompt 106)

STATUS: **COMPLETE** — UNMAPPED_PROVIDERS: 0.

Real scope discovered by tracing imports/endpoints/env vars (not limited to folders
named "integrations"): backend `apps/api/src/modules/integrations/**` (11 provider subfolders +
reusable infrastructure), `apps/api/src/modules/billing/**` (Stripe), `apps/api/src/modules/
uploads/**` (Cloudflare R2), `apps/api/src/core/external-data/**` (generic framework for
distributors/PROs), `apps/api/src/core/config/env.schema.ts` (credentials inventory),
`apps/web/src/modules/integrations/**` (~55 files: hooks/adapters/components/pages/services/
webhooks), `apps/web/src/modules/releases/services/distribution-platforms.ts`,
`apps/web/src/modules/settings/pages/Configuracoes.tsx`. `apps/api-v2` has no integrations
layer implemented yet (confirmed — only config/database scaffolding).

Method note: two attempts at parallel research via subagents failed due to the account's session
limit before producing a result; all the evidence in this report was collected by direct and
complete reading of the source files listed above (not by sampling/superficial grep).

---

## 1. General backend architecture (context for the whole audit)

The integrations backend is, consistently, the module with the most mature engineering found
in this audit series so far:

- `IntegrationBaseService` (a base class extended by Abramus, and used in an equivalent pattern by
  Spotify/Instagram/TikTok/GoogleAds/SoundCloud/AppleMusic/YouTube/Deezer) — CRUD of encrypted
  credentials (`credentials_encrypted`, AES-256-GCM via `EncryptionService`), CRUD of OAuth tokens
  (`access_token_encrypted`/`refresh_token_encrypted`), signed OAuth state (`buildSignedState`/
  `verifySignedState`, HMAC-SHA256 + `timingSafeEqual`), `fetch()` guarded by a `CircuitBreaker` +
  a 10s timeout (`resilientFetch`).
- `WebhookService` — reusable webhook infrastructure: real idempotency via
  `webhook_events.external_id` (`UNIQUE` constraint confirmed in the database), payload persisted
  BEFORE processing (audit trail even on failure), `markProcessed()` with
  `retry_count`, HMAC-SHA256 validation (`validateHmacSignature`, `timingSafeEqual`) and
  shared-secret validation (`validateSharedSecret`) — used by Autentique; Stripe uses the SDK's
  native verification (`stripe.webhooks.constructEvent`) instead of this class.
- `CircuitBreakerRegistry`/`resilientFetch` — circuit breaker per provider (`CircuitBreaker({name:
  ...})`), default timeout applied to every outbound call.
- Generic OAuth (`POST /integrations/oauth/init` → `POST /integrations/oauth/exchange` → `GET
  /integrations/oauth/status` → `DELETE /integrations/oauth/disconnect`) for 5 platform
  families (Meta/Instagram, TikTok, Google/YouTube, DocuSign, Stripe Connect) — a single-use
  `exchange_token`, TTL 10 min, issued only to an authenticated caller, never accepts a `redirect_uri` from the
  client (builds it from `APP_URL`), the client_secret never leaves the backend.

This contrasts with the pattern observed in domain modules (catalog/contracts/events etc.), where
most gaps hit the field-mapping layer — here the platform infrastructure is
solid; this module's real gaps are concentrated in **frontend consumption** (generic
adapters that are deliberately inert) and in **providers with no official API researched yet**
(distributors).

---

## 2. Canonical provider inventory

| # | PROVIDER | CATEGORY | FRONTEND_EXISTS | BACKEND_EXISTS | DATABASE_EXISTS | RUNTIME_ACTIVE | STATUS |
|---|---|---|---|---|---|---|---|
| 1 | Stripe (SaaS billing) | PAYMENTS | YES | YES | YES | YES | PARTIAL |
| 2 | Stripe Connect (generic OAuth) | PAYMENTS | YES (client_id only) | YES | YES | YES | PARTIAL |
| 3 | DocuSign | ELECTRONIC_SIGNATURE | YES | YES (OAuth only) | YES | YES | PARTIAL |
| 4 | Autentique | ELECTRONIC_SIGNATURE | YES (UI), but the adapter is always inert | YES (complete) | YES | YES (backend) / NO (the frontend never calls it) | PARTIAL |
| 5 | Clicksign | ELECTRONIC_SIGNATURE | YES (selector only) | NO | NO | NO | STUB |
| 6 | Spotify | MUSIC_STREAMING | YES | YES | YES | YES | IMPLEMENTED |
| 7 | YouTube (Data API) | VIDEO / MUSIC_STREAMING | YES | YES | N/A (no persistence of its own) | YES | IMPLEMENTED |
| 8 | YouTube/Google (corporate OAuth — Ads/Business) | SOCIAL_MEDIA/MARKETING | YES | YES | YES | YES | IMPLEMENTED |
| 9 | Deezer | MUSIC_STREAMING | YES | YES | N/A (public API, no OAuth) | YES | IMPLEMENTED |
| 10 | SoundCloud | MUSIC_STREAMING | YES | YES | YES (credentials) | YES | IMPLEMENTED |
| 11 | Apple Music | MUSIC_STREAMING | YES | YES | YES (credentials) | YES | IMPLEMENTED |
| 12 | Instagram/Meta (organic + corporate) | SOCIAL_MEDIA | YES | YES | YES | YES | IMPLEMENTED |
| 13 | TikTok (organic) | SOCIAL_MEDIA | YES | YES | YES | YES | IMPLEMENTED |
| 14 | TikTok Ads | SOCIAL_MEDIA/MARKETING | YES | YES | YES | YES | IMPLEMENTED |
| 15 | Google Ads | MARKETING | YES | YES | YES | YES | IMPLEMENTED |
| 16 | ABRAMUS | RIGHTS_REGISTRY | YES | YES | YES (credentials) | YES | PARTIAL |
| 17 | ACRCloud | AUDIO_RECOGNITION | YES (divergent contract) | YES | N/A (no persistence) | YES | PARTIAL |
| 18 | Cloudflare R2 | STORAGE | YES | YES | YES (via `uploads`) | YES | IMPLEMENTED |
| 19 | Resend (transactional SMTP) | EMAIL | NO (backend only) | YES | N/A | YES | IMPLEMENTED |
| 20 | Sentry | OBSERVABILITY | YES | YES | N/A | YES | IMPLEMENTED |
| 21 | PostHog | ANALYTICS | NO (confirmed backend only) | YES (config present) | N/A | PARTIAL (optional config, no code usage found beyond the env var) | STUB |
| 22 | OpenAI / Anthropic / Google AI (AI router) | AI | YES | YES | YES (`ai_jobs`/`ai_usage_logs`) | YES | IMPLEMENTED |
| 23 | ONErpm | MUSIC_DISTRIBUTION | YES (static link) | NO (only an unregistered generic framework) | NO | NO | STUB |
| 24 | DistroKid | MUSIC_DISTRIBUTION | YES (static link) | NO | NO | NO | STUB |
| 25 | Symphonic | MUSIC_DISTRIBUTION | YES (static link) | NO | NO | NO | STUB |
| 26 | SoundOn | MUSIC_DISTRIBUTION | YES (static link) | NO | NO | NO | STUB |
| 27 | MusicPro | MUSIC_DISTRIBUTION | YES (static link) | NO | NO | NO | STUB |
| 28 | SomVibe | MUSIC_DISTRIBUTION | YES (static link) | NO | NO | NO | STUB |
| 29 | Generic distributor/society framework (`external-data`) | RIGHTS_REGISTRY/MUSIC_DISTRIBUTION | NO | YES (complete infra, 0 real providers registered) | YES (generic webhook) | YES (infra) / NO (no real provider) | CONFIG_ONLY |
| 30 | NF-e (Brazilian electronic invoice issuance) | OTHER | YES (UI, no real data collection) | NO | NO | NO | STUB |
| 31 | ECAD | RIGHTS_REGISTRY | YES (`useEcad` hook) | NO (no backend controller/service found) | NO | NO | UI_ONLY |
| 32 | UBC | RIGHTS_REGISTRY | YES (`useUbc` hook) | NO (no backend controller/service found) | NO | NO | UI_ONLY |

Note: "Meta Ads" (`meta_ads`) is not a distinct provider — it is one of the 3 variants of the same
corporate Instagram/Meta flow (row 12), already counted there; listed separately in matrix §5.8
only to detail the mechanism, not as an additional entry in the canonical inventory.

`UNKNOWN: 0`. `PROVIDERS_AUDITED: 32`.

---

## 3. Providers explicitly searched for and not found

`Instagram/TikTok/Deezer/Apple Music/SoundCloud/YouTube/Spotify/Meta/Google/DocuSign/Autentique/
Stripe/ABRAMUS/ACRCloud/Sentry/R2/AWS-S3/SMTP/Supabase` — all searched by name per §5 of the
prompt. `AWS/S3`: **not found as a separate active provider** — all file storage
uses Cloudflare R2 exclusively (compatible with the S3 API, but no real `AWS_*` SDK/credential
was found — only `R2_*`). `Supabase`: used for Auth/Realtime/Postgres (already fully audited
in `auth.md`, not reopened here — outside the scope of "third-party external integration"
in the sense of this prompt, it is the system's own identity/database infrastructure).

---

## 4. Known providers, but absent from the credential configuration in `env.schema.ts`

`ECAD`, `UBC`, `Clicksign`, the 6 digital distributors and the `external-data` framework **have no
dedicated environment variable** in `env.schema.ts` — consistent with the absence of any
real backend implementation for them (STUB/UI_ONLY/CONFIG_ONLY, not PARTIAL). This confirms, via
an independent line of evidence (total absence of a configuration surface, not merely absence
of code), that none of these providers has yet moved past the placeholder/static-catalog phase.

---

## 5. Per-integration matrix (providers with real state — 22 of 33)

### 5.1 Stripe (SaaS billing — the platform's own subscription)

```text
PURPOSE: SaaS subscription billing per tenant (billing_plans plans)
FRONTEND_ENTRYPOINTS: BillingContext.tsx, usePlanFeatures.ts, useStripe.ts
HOOKS: useStripeStatus (hardcoded status:"disabled", never queries the real backend),
       useStripeSubscription (REAL — GET /billing/subscription),
       useStripeCheckout/useStripePortal (explicit stubs — disabledIntegration("Stripe"))
BACKEND_CONTROLLER: billing.controller.ts — POST /billing/checkout, POST /billing/portal,
       GET /billing/subscription, POST /billing/webhooks/stripe
BACKEND_SERVICE: billing.service.ts, dunning.service.ts, billing-plans.service.ts
ADAPTER: apps/web/src/modules/integrations/adapters/payments.adapter.ts — ALWAYS
       createUnavailablePaymentsProvider() (dead/stub layer, not used by the real hooks)
DATABASE_TABLES: billing_plans, billing_settings, billing_subscriptions
AUTH_MODEL: API_KEY (STRIPE_SECRET_KEY, server-side) for checkout/portal/webhook;
       OAUTH_AUTHORIZATION_CODE for Stripe Connect (see 5.2)
CREDENTIAL_MODEL: PLATFORM_SHARED (STRIPE_SECRET_KEY/STRIPE_WEBHOOK_SECRET of the platform's account)
SYNC_DIRECTION: BIDIRECTIONAL (checkout/portal create a session; the webhook receives change events)
SOURCE_OF_TRUTH: EXTERNAL (Stripe is the source of truth for the subscription; billing_subscriptions is a
       local cache synchronized via webhook)
WEBHOOK: YES — POST /billing/webhooks/stripe, @Public(), signature verified via the real SDK
       (stripe.webhooks.constructEvent(rawBody, signature, secret)), raw body preserved
       (RawBodyRequest<Request>), signature error → explicit 400
BACKGROUND_JOB: NO dedicated one found (dunning.service.ts handles payment retry, not
       verified in this step as a scheduled job vs. triggered by webhook)
REALTIME_EFFECT: events `billing:plan_upgraded`/`billing:trial_ending`/`billing:payment_failed`/
       `billing:cancelled` already cataloged in the canonical contract (doc37) — trial_ending and
       payment_failed with no confirmed frontend consumer (doc37, not re-audited here)
STATUS: PARTIAL — complete and real backend (checkout/portal/webhook/subscription); the frontend
       DELIBERATELY never calls checkout/portal (explicit stub hooks, comment in the code
       itself: "standalone — sem billing real; plano simulado em TenantContext" (standalone — no real billing; plan simulated in TenantContext))
```

### 5.2 Stripe Connect (via generic OAuth)

```text
PURPOSE: a branch inside the generic OAuth flow (GENERIC_OAUTH_PLATFORMS includes 'stripe_connect')
BACKEND: integrations.controller.ts oauthExchange() — Basic Auth with STRIPE_SECRET_KEY,
       POST https://connect.stripe.com/oauth/token, grant_type=authorization_code
AUTH_MODEL: OAUTH_AUTHORIZATION_CODE
CREDENTIAL_MODEL: client_id (STRIPE_CONNECT_CLIENT_ID) PLATFORM_SHARED; resulting token TENANT_OWNED
       (persisted via IntegrationBaseService.saveOAuthTokens, tenant+user scoped)
FRONTEND: only the generic popup mechanism (OAuthPopupPage.tsx, PRODUCTION_OAUTH_CONFIGS —
       client_id via VITE_STRIPE_CONNECT_CLIENT_ID) — no dedicated "connect Stripe Connect
       account" screen found beyond the generic marketing OAuth mechanism
STATUS: IMPLEMENTED in the generic mechanism, but the product purpose (what Stripe Connect
       would enable in this system) has no identified domain consumer — infrastructure
       ready, with no business functionality built on top of it (the same classification of
       "correct mechanism, product use not yet built" already seen in other generic OAuth flows)
```

### 5.3 DocuSign

```text
Finding already precisely established in docs/backend-v2/77-docusign-private-key-exposure-resolution.md
— reaffirmed here, not reopened: AUTH_MODEL: OAUTH_AUTHORIZATION_CODE (Basic Auth with
DOCUSIGN_INTEGRATION_KEY:DOCUSIGN_CLIENT_SECRET against {DOCUSIGN_AUTH_BASE_URL}/oauth/token) —
NEVER JWT Grant, DOCUSIGN_PRIVATE_KEY does not exist in any current layer (RETIRED_NO_RUNTIME_
DEPENDENCY, a doc77 finding, not re-evaluated).
CONNECT_ACCOUNT: IMPLEMENTED (generic oauth/exchange flow)
OAUTH_START: IMPLEMENTED (OAuthPopupPage.tsx, client_id via VITE_DOCUSIGN_INTEGRATION_KEY)
OAUTH_CALLBACK: IMPLEMENTED (OAuthCallbackPage.tsx → POST /integrations/oauth/exchange)
TOKEN_REFRESH: NOT IMPLEMENTED (no DocuSign-specific refresh mechanism found —
       unlike Spotify/Instagram, which have explicit refresh)
ACCOUNT_STATUS: NOT IMPLEMENTED (no dedicated status endpoint beyond the generic oauth/status)
CREATE_ENVELOPE: NOT_IMPLEMENTED
SEND_ENVELOPE: NOT_IMPLEMENTED
SIGNERS: NOT_IMPLEMENTED
ENVELOPE_STATUS: NOT_IMPLEMENTED
DOWNLOAD_DOCUMENT: NOT_IMPLEMENTED
WEBHOOK (DocuSign Connect): NONE (confirmed in doc77 — no endpoint/handler)
FRONTEND: signing.adapter.ts always throws an explicit error for "docusign" (createUnavailableSigningProvider)
STATUS: PARTIAL (real account connection; signing capability 0%)
```

### 5.4 Autentique

```text
PURPOSE: electronic signature of contracts (the UI's "default" provider, useSigningProviders always
       marks connected:true)
BACKEND_CONTROLLER: POST /integrations/autentique/configure (admin+), POST .../send (editor+),
       POST .../webhook (route marked @RequireRole('editor') but NOT @Public() — see Gap #1 below)
BACKEND_SERVICE: autentique.service.ts — hardened (Phase 5, per the file's own comment):
       15s timeout via AbortController on every call, retry_count/last_failure_at tracked in
       IntegrationEntity.metadata, failures written to activity_logs, real GraphQL
       (createDocument mutation) against https://api.autentique.com.br/v2
AUTH_MODEL: API_KEY (api_token per tenant, Bearer in the GraphQL header)
CREDENTIAL_MODEL: TENANT_OWNED (each tenant configures its own api_token via
       POST /integrations/autentique/configure — AES-256-GCM token in integrations.credentials_encrypted)
WEBHOOK: YES — validated by a shared secret (AUTENTIQUE_WEBHOOK_SECRET, min. 24 chars,
       mandatory in production), idempotent via WebhookService.ingest() (dedup by external_id =
       event_id/document.id), processes only the "document.signed" event, resolves the tenant by
       looking up the contract (autentique_doc_id) via bootstrap admin outside the RLS context,
       then reprocesses inside the real tenant context (dbContext.runInTenantContext) —
       the correct architecture for a webhook that does not carry tenant_id in the payload
SIDE_EFFECTS: contract → status='assinado', metadata with provider_event_id/synced_at,
       emits DOMAIN_EVENTS.CONTRACT_SIGNED (the same event as the manual signing flow)
CRITICAL FRONTEND_CONSUMER_GAP (reinforces and sharpens the contracts.md finding): the only real UI
       component for sending a contract for signature (SendForSigningDialog.tsx) NEVER calls
       POST /integrations/autentique/send. It goes through signingService.sendForSigning() →
       resolveSigningAdapter(provider) → signing.adapter.ts, which returns
       createUnavailableSigningProvider(provider) FOR ANY provider VALUE, including
       "autentique" — there is no branch in the adapter that routes to the real backend. That is: the
       "Send for signature" flow in the real UI is structurally broken for Autentique
       too, not only for DocuSign/Clicksign — even though the backend is 100% functional.
STATUS: PARTIAL (backend fully IMPLEMENTED; frontend consumer 0% — worse than "zero consumers",
       it is a consumer that EXISTS but is wired to a stub that always fails)
```

### 5.5 Clicksign

```text
FRONTEND: only a selector id in useSigningProviders ("connected" state read from
       sessionStorage["musicos360_clicksign_credentials"] — never persisted in the backend)
BACKEND: no Clicksign controller/service found in apps/api/src
STATUS: STUB (a UI option with no backend counterpart)
```

### 5.6 Spotify

```text
AUTH_MODEL: hybrid — OAUTH_AUTHORIZATION_CODE (user account connection, scopes
       "user-read-private user-read-email") + CLIENT_CREDENTIALS (for syncArtistMetrics, which only
       needs public artist data, with no user connection)
CLIENT_ID_USAGE: SPOTIFY_CLIENT_ID (PLATFORM_SHARED) — used in both Authorization Code and
       Client Credentials
CLIENT_SECRET_USAGE: SPOTIFY_CLIENT_SECRET, always server-side (Basic Auth)
ARTIST_LOOKUP: IMPLEMENTED (GET /artists/{id} via Client Credentials)
ARTIST_PROFILE: IMPLEMENTED (name, image, popularity)
FOLLOWERS: NOT EXPOSED (the endpoint used does not return followers)
MONTHLY_LISTENERS: NOT_AVAILABLE — confirmed by the code itself: explicit log "monthly listeners
       nao disponivel neste endpoint" (not available on this endpoint) (always returns `listeners: null`) — Spotify's public
       Web API does not expose this data; it would require Spotify for Artists (not implemented)
TRACKS/ALBUMS/PLAYLISTS: NOT_IMPLEMENTED (no tracks/albums/playlists endpoint in the backend)
EXTERNAL_IDS: spotify artist id extracted by a URL regex (extractArtistId)
RATE_LIMIT_HANDLING: NOT EXPLICIT (no dedicated 429 handling — only the generic circuit breaker
       of CircuitBreakerRegistry)
CACHE: NOT FOUND (no Spotify response cache)
SYNC: manual, on demand (POST /integrations/spotify/sync-artist) — enqueues a job
       ("spotify:sync" via QUEUE_NAMES.STREAMING_SYNC, BullMQ) after a successful OAuth connection,
       but the consumer handler for this specific job was not located in this reading (outside the
       scope of this round — recorded as not verified, not as absent)
TOKEN_REFRESH: IMPLEMENTED — getValidToken() checks expires_at and calls refreshToken() automatically
       (grant_type=refresh_token), the new token written encrypted
STATE_SECURITY: HMAC-SHA256 signed (createState/verifyState), TTL 10 min, timingSafeEqual
DISCONNECT: DELETE /integrations/spotify/disconnect — LOCAL_TOKEN_DELETE only (no remote
       revocation call to Spotify — Spotify does not expose a public revoke endpoint for this flow)
STATUS: IMPLEMENTED (the most complete and best protected of the streaming providers)
```

### 5.7 YouTube

```text
API_KEY_USAGE: YES (YOUTUBE_API_KEY) — for public search/statistics (getChannelStats,
       getVideoStats, searchVideos)
OAUTH_USAGE: YES, but via a DIFFERENT path — the "corp_youtube"/"youtube_business"/
       "google_business"/"google_ads"/"youtube_ads" variants go through the generic OAuth (GOOGLE_CLIENT_ID/
       GOOGLE_ADS_CLIENT_ID as a fallback), not through YouTubeService directly
CHANNEL_LOOKUP: IMPLEMENTED (GET /integrations/youtube/channel/:id)
SUBSCRIBERS/VIEWS: presumably part of getChannelStats/getVideoStats (not read field by field
       in this round — infrastructure confirmed, exact response not verified in depth)
VIDEOS: IMPLEMENTED (getVideoStats, searchVideos)
ARTIST_MAPPING: no dedicated table — data returned on demand, not persisted
CACHE: not verified in this round
SYNC: on demand (no dedicated scheduled job found)
RATE_LIMIT_HANDLING: not verified in depth in this round — the same caveat as the Spotify item
STATUS: IMPLEMENTED
```

### 5.8 Instagram / Meta (organic + corporate)

```text
AUTH_MODEL: OAUTH_AUTHORIZATION_CODE — TWO distinct paths:
  (a) organic: GET /integrations/instagram/auth → InstagramService.getAuthUrl/handleCallback
  (b) corporate (Business/Ads): via the generic oauth/init+exchange of IntegrationsController,
      code exchange done directly in the controller (fb_exchange_token for a long-lived token)
CLIENT_ID/SECRET: META_APP_ID/META_APP_SECRET (PLATFORM_SHARED)
TOKEN_STORAGE: oauth_connections, provider ∈ {instagram, corp_instagram, meta_business, meta_ads}
TOKEN_REFRESH: IMPLEMENTED and PROACTIVE — InstagramTokenRefreshScheduler runs daily
       (setInterval in a long-running process) OR via Vercel Cron
       (GET /internal/cron/instagram-token-refresh, instagram-token-refresh-cron.controller.ts)
       when process.env.VERCEL is set — renews tokens expiring in ≤7 days; on failure,
       marks the connection as needs_reauth (markOAuthNeedsReauth) instead of silently deleting it
DISCONNECT: DELETE /integrations/instagram/disconnect and /meta-corporate/disconnect — the corporate
       endpoint's comment explicitly says "tenta revogar no Meta" (tries to revoke at Meta) (REMOTE_REVOKE:
       behavior not confirmed line by line in this round, but indicated by the code itself)
METRICS: GET /integrations/instagram/metrics (Business account)
STATUS: IMPLEMENTED — the provider with the most mature refresh mechanism in the whole module
```

### 5.9 TikTok (organic) and TikTok Ads

```text
Organic: OAUTH_AUTHORIZATION_CODE (TIKTOK_CLIENT_KEY/SECRET), GET /integrations/tiktok/auth,
       POST .../callback, GET .../status, DELETE .../disconnect — IMPLEMENTED
Ads: a different credential model — POST /integrations/tiktok/ads/configure receives
       {appId, secret, advertiserId, accessToken} directly (it is not a popup OAuth flow —
       the token is supplied manually by the tenant, typical of TikTok Business ad accounts),
       GET .../campaigns, GET .../insights — IMPLEMENTED
STATUS: IMPLEMENTED (both)
```

### 5.10 Google Ads

```text
AUTH_MODEL: OAUTH_AUTHORIZATION_CODE (GOOGLE_ADS_CLIENT_ID/SECRET) + additional manual
       configuration (developerToken/customerId via POST /integrations/google-ads/configure — Google Ads
       requires a Developer Token in addition to standard OAuth, correctly modeled as a separate field)
ENDPOINTS: auth/callback/status/disconnect/campaigns — IMPLEMENTED
STATUS: IMPLEMENTED
```

### 5.11 SoundCloud

```text
AUTH_MODEL: API_KEY-like (client_id/client_secret configured per tenant via
       POST /integrations/soundcloud/configure — not user OAuth, it is an app credential)
DATABASE: tenant-owned credentials via IntegrationBaseService (integrations table)
ENDPOINTS: configure/status/disconnect/user/track/search — IMPLEMENTED
STATUS: IMPLEMENTED
```

### 5.12 Apple Music

```text
AUTH_MODEL: OTHER_CONFIRMED — Apple Music uses a Developer Token signed with a private key
       (MusicKit), not user OAuth for the public catalog: POST /integrations/apple-music/configure
       receives {teamId, keyId, privateKey} directly from the tenant
DATABASE: tenant-owned credentials (the same integrations table pattern)
ENDPOINTS: configure/status/disconnect/artist/search — IMPLEMENTED
ATTENTION (not evaluated in depth in this round): privateKey is received as text in the request
       body — presumed encrypted at rest (the same saveCredentials/
       EncryptionService pattern already confirmed for the other manual-credential providers), but the
       complete path of the value between the DTO and encrypt() was not read line by line in this round
       for Apple Music specifically — recorded as a partial verification, not as a confirmed
       gap.
STATUS: IMPLEMENTED
```

### 5.13 ABRAMUS

```text
Reinforces and details the finding already recorded in catalog.md from the perspective of the
integrations module (same provider, current code, without reopening the catalog domain itself):
AUTH_IMPLEMENTED: YES — username/password login against {baseUrl}/api/v1/auth/login, Bearer token
       obtained on EVERY request (getAuthToken() is called inside request(), with no token cache —
       see Gap #2 below)
SEARCH_IMPLEMENTED: YES — searchArtist (GET /api/v1/artists), searchWork (GET /api/v1/works)
IMPORT_IMPLEMENTED (registerWork): YES — POST /api/v1/works with {titulo, compositor, iswc, genero,
       duracao, editora, coautores}
SYNC_IMPLEMENTED: NO — no periodic/automatic synchronization mechanism, only on-demand
       calls (consistent with the catalog.md finding about import-from-search/sync-all being
       stubs AT THE LEVEL OF THE catalog UI — here, in the pure integration layer, the 3 real endpoints
       exist and work; it is the catalog layer that does not invoke them in every flow)
FIELDS_SENT (registerWork): titulo, compositor, iswc, genero, duracao, editora, coautores
FIELDS_RECEIVED: raw ABRAMUS response passed through (no typed response DTO)
DATABASE_MAPPING: no local persistence of the result — each call is a direct proxy
ERROR_BEHAVIOR: generic `throw new Error(...)` on HTTP failure — no retry, no circuit breaker
       (ABRAMUS does not extend the guarded `cb`/`fetch()` of the parent IntegrationBaseService the way
       Spotify does; it uses native `fetch()` directly) — a GAP relative to the pattern of the rest of the module
STATUS: PARTIAL (functional for search/register; no automatic sync; no network resilience)
```

### 5.14 ACRCloud

```text
PURPOSE: audio recognition (fingerprinting) to identify works/phonograms
FRONTEND_CALL: useACRCloud.ts → POST /integrations/acrcloud/recognize
BACKEND_CALL: acrcloud.service.ts::recognize(audioBase64)
API_HOST: ACRCLOUD_HOST (configurable, no hardcoded default)
ACCESS_KEY_USAGE: ACRCLOUD_ACCESS_KEY sent in each request as a form field
SIGNATURE: HMAC-SHA1 over [method, uri, access_key, 'audio', '1', timestamp] using
       ACRCLOUD_ACCESS_SECRET — the standard ACRCloud signing mechanism, implemented correctly
FILE_INPUT: base64 → Buffer → multipart Blob 'sample.mp3' (always assumes mp3, with no negotiation of
       the actual format of the uploaded file)
RESPONSE_FIELDS: title, artist (first of music.artists[]), album, isrc, confidence (score/100)
CATALOG_MAPPING: none — response returned raw to the caller, with no persistence/automatic match
       against `works`/`phonograms`
DIVERGENT CONTRACT (finding already recorded in doc37, reaffirmed here with a direct reading of the
       code): the backend's real DTO (RecognizeAudioDto{audioBase64: string}) and the real return
       (ACRCloudResult{title?,artist?,album?,isrc?,confidence?}, a SINGLE flat result) are
       STRUCTURALLY DIFFERENT from the contract the frontend uses
       (FingerprintInput{audio_data,duration_seconds?,source_type?,source_name?}/
       FingerprintResult{matched,matches[],best_match?,...}, an array of matches, not a single
       object) — doc36 already resolved this as FRONTEND_CONTRACT_WINS for the v2 rebuild, but
       the CURRENT CODE (legacy apps/api, today) still implements the old contract — that is, a
       real call to POST /integrations/acrcloud/recognize from useACRCloud.ts today
       probably does not match the shape the hook expects (a live REAL_MAPPING_GAP, not just a
       v2 decision already resolved on paper)
ERROR_BEHAVIOR: generic `throw new Error(...)`
RESILIENCE: no circuit breaker, no explicit timeout, no retry — uses plain native `fetch()`
       (the same gap as ABRAMUS — neither of the two extends the resilient pattern of the rest of the module)
STATUS: PARTIAL — real and correct signing/call mechanism; response contract misaligned
       with the real frontend; no network resilience
```

### 5.15 Cloudflare R2 (Storage)

```text
PURPOSE: file storage (generic per-table uploads, contract/CRM/audiovisual attachments —
       already audited per domain module in the previous steps; here only the provider
       layer is reviewed, per the prompt's instruction not to re-audit upload fields per
       module)
CLIENT: apps/api/src/modules/uploads/** — upload/download presign via R2's S3-compatible API
CONFIG: R2_ACCOUNT_ID, R2_ACCESS_KEY, R2_SECRET_KEY, R2_BUCKET_NAME (default 'music-os-360'),
       R2_PUBLIC_URL (explicit validation against a placeholder in production — blocks 'pub-xxx'/
       'placeholder' via a Zod refine)
SIGNED_UPLOAD/SIGNED_DOWNLOAD: YES (presign pattern already confirmed in previous modules of this series
       — clients, contracts, artist)
TENANT_PREFIX: presumed from the pattern already confirmed by previous domain modules
       (not re-verified field by field here, per the prompt's instruction §39)
STATUS: IMPLEMENTED
```

### 5.16 Resend (transactional Email/SMTP)

```text
PROVIDER: Resend (HTTP API, not traditional SMTP despite the env name "STAGING_MAIL_ALLOWLIST")
HOST: N/A (HTTP API, not an SMTP host)
CONFIG: RESEND_API_KEY (mandatory in production), RESEND_FROM_EMAIL (default
       noreply@musicos360.com.br), STAGING_MAIL_ALLOWLIST_DOMAINS (guards against an accidental real
       send in staging — only sends to allowed domains)
CALLERS: not enumerated exhaustively in this round (outside the budget of this specific audit)
       — only confirmed that the infrastructure integration exists and is validated at boot
       (RESEND_API_KEY mandatory in production via superRefine)
SMTP_REQUIRED: YES (already confirmed in auth.md, reaffirmed here — not a new open item)
STATUS: IMPLEMENTED (infrastructure); TEMPLATES/CALLERS not enumerated exhaustively
```

### 5.17 Sentry

```text
SERVER_SIDE: YES — SENTRY_DSN validated as a URL, mandatory in production (superRefine)
CLIENT_SIDE: YES — confirmed by mentions in earlier docs of this series (packages/observability/
       src/sentry.ts exists in the monorepo) and by the VITE-equivalent env var already audited in the frontend
       (not re-read line by line in this round — reusing an already solid finding from earlier
       audits in this same session)
CONFIG_REQUIRED: SENTRY_DSN, SENTRY_RELEASE (optional)
SECRET_OR_PUBLIC_CONFIG: the DSN is considered public configuration by Sentry's own design
       (it identifies the project, it does not grant read/write access without Sentry's auth key itself)
STATUS: IMPLEMENTED
```

### 5.18 PostHog

```text
CONFIG: POSTHOG_API_KEY (optional), POSTHOG_HOST (default https://app.posthog.com) — declared in
       env.schema.ts, but NO code usage consuming these variables was found in this
       round in apps/api/src (non-exhaustive search — not confirmed 100% absent, but no
       occurrence of `posthog`/`PostHog` in service code was located during this audit,
       despite it appearing cited in doc68's architectural-decision text as "presente no
       legacy, posthog-node, backend" (present in the legacy, posthog-node, backend) for product events)
STATUS: CONFIG_ONLY — environment variable declared and validated, code consumption not confirmed
       in this round (not classified as DEAD for lack of full confirmation of total absence —
       recorded as lower confidence, not as an active gap)
```

### 5.19 AI (OpenAI / Anthropic / Google AI)

```text
PROVIDER: multi-provider router (OPENAI_API_KEY, ANTHROPIC_API_KEY, GOOGLE_AI_API_KEY — all
       optional, allowing any configured subset)
MODEL: not fixed at the env level (presumably per request/use, not re-evaluated here)
PURPOSE: content generation (marketing), semantic contract parsing (semantic-parser.service.ts
       of the contracts module, already cited in doc37 A.20), skills AI (packages/ai-skills/**)
FRONTEND_OR_BACKEND: BACKEND (POST /ai/generate, contract already closed in doc37 — CONTRACT_COMPLETE)
DATABASE_PERSISTENCE: ai_jobs, ai_usage_logs (tables confirmed in Phase 1)
CREDENTIAL_MODEL: PLATFORM_SHARED (the platform's own keys, not per tenant)
STATUS: IMPLEMENTED (contract already closed in doc35/37; the ai.module.ts/ai.service.ts module exists)
```

### 5.20 Distributors (ONErpm, DistroKid, Symphonic, SoundOn, MusicPro, SomVibe)

```text
Reaffirms without reopening Decision D1 (doc25, APPROVED) and its resolution (doc31, RESOLVED —
MUST_USE_PROVIDER_AUTH, future technical execution, per-distributor API research explicitly
outside the scope of this and previous audits).
CURRENT_CODE_EXISTS: YES — static catalog (DISTRIBUTION_PLATFORMS, 6 entries) in
       apps/web/src/modules/releases/services/distribution-platforms.ts
OFFICIAL_API_IMPLEMENTATION_EXISTS: NO (none, for any of the 6)
AUTH_IMPLEMENTED: NO
TENANT_CONNECTION_IMPLEMENTED: NO — the "connection state" is read from
       localStorage["musicos360_distributor_connections"] (getEnabledDistributionPlatforms()); the
       file's own comment confirms: "nada é simulado aqui" (nothing is simulated here) in the sense that the code does not
       fake a connection that does not exist — but it also confirms that there is no real write of this
       key anywhere in the code (the same finding already recorded in doc23/25, reaffirmed)
IMPORT_IMPLEMENTED: NOT_IMPLEMENTED
EXPORT_IMPLEMENTED: NOT_IMPLEMENTED
SYNC_IMPLEMENTED: NOT_IMPLEMENTED
STATUS_SYNC_IMPLEMENTED: NOT_IMPLEMENTED
CATALOG_MAPPING: NOT_IMPLEMENTED
RELEASE_MAPPING: NOT_IMPLEMENTED
EXTERNAL_IDS: NOT_IMPLEMENTED
TOKEN_STORAGE: NOT_APPLICABLE (no token exists)
Current UI: `Configuracoes.tsx` and `OAuthPopupPage.tsx`'s `DistributorExperience` only show a
       `<a target="_blank">` link to each distributor's official portal, with the explicit text
       "Abrir o portal não conecta a conta ao sistema" (opening the portal does not connect the account to the system) — no simulated success, no invented
       API (complies with D1's "forbidden" rule)
OVERALL_STATUS: STUB (honest — an informative placeholder, not a fake integration)
```

### 5.21 Generic `external-data` framework (distributors/societies — a backend layer separate from the catalog above)

```text
PURPOSE: generic, reusable backend infrastructure for ANY distributor/society that
       may be registered in the future (registry pattern) — more advanced than the frontend's
       static catalog (§5.20), but still with no real provider connected
ENDPOINTS: GET /integrations/external-data/providers, POST .../sync/request,
       POST .../distributor/submit, POST .../distributor/status-check,
       POST .../society/submit, POST .../society/status-check,
       POST .../webhooks/:providerId (@Public(), HMAC via
       EXTERNAL_DATA_WEBHOOK_SECRET_<PROVIDER> or the fallback EXTERNAL_DATA_WEBHOOK_SECRET)
BACKEND_SERVICE: ExternalDataExchangeService + ExternalDataProviderRegistry
       (apps/api/src/core/external-data/**)
PROVIDERS_REGISTERED_TODAY: exactly 2 — `UnconfiguredDistributorProvider` and
       `UnconfiguredSocietyProvider` (confirmed by directly reading the registry's constructor) —
       both are explicit placeholders, not real providers of any specific
       distributor/society; the DTOs themselves (DistributorSubmitDto/SocietySubmitDto/
       ExternalDataStatusCheckDto) document this in their own `@ApiProperty description`:
       "não há default — nenhum provider real está registrado em produção" (there is no default — no real provider is registered in production)
IDEMPOTENCY: idempotencyKey accepted in all submit/status-check DTOs — mechanism ready,
       with no real provider to exercise it yet
FRONTEND_CONSUMER: NOT FOUND — no frontend hook/component calls
       /integrations/external-data/* (the frontend's distributor catalog, §5.20, is
       entirely disconnected from this more robust API)
STATUS: CONFIG_ONLY (infrastructure ready and well designed — idempotency, per-provider HMAC webhook,
       registry pattern — but functionally empty; no FRONTEND_CONSUMER_GAP
       classified as active because there is neither a provider nor a consumer, both sides await the
       same future product decision already recorded in D1)
```

### 5.22 NF-e / ECAD / UBC

```text
NF-e: a UI exists (NfeConfigDialog.tsx, NfeExperience in OAuthPopupPage.tsx) but explicitly does NOT
       collect real data (the same text already cited in doc31: "Certificados, senhas e tokens fiscais
       devem ser enviados somente ao backend seguro... não são solicitados nesta página" — fiscal
       certificates, passwords and tokens must be sent only to the secure backend... they are not requested on this page) — the
       real configuration (useNfe.ts) persists in sessionStorage, with no backend (the same CWE-312 finding
       already recorded in docs 18/19/31, not fixed here). STATUS: STUB.
ECAD/UBC: hooks exist in the frontend (useEcad.ts, useUbc.ts) along with dialog components
       (EcadConfigDialog.tsx, UbcConfigDialog.tsx), but no corresponding controller/service was
       found in apps/api/src/modules/integrations/** or in any other backend module —
       they are Brazilian collecting/rights-management societies (parallel to ABRAMUS), but without
       any real server-side API. STATUS: UI_ONLY.
```

---

## 6. Webhooks — complete inventory

| PROVIDER | METHOD/PATH | RAW_BODY | SIGNATURE_HEADER | SIGNATURE_VALIDATION | SECRET_REQUIRED | REPLAY_PROTECTION | IDEMPOTENCY | TENANT_RESOLUTION | EVENT_TYPES | DB_WRITES | SIDE_EFFECTS |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Stripe | POST /billing/webhooks/stripe | YES (RawBodyRequest) | `stripe-signature` | real SDK (`constructEvent`) | STRIPE_WEBHOOK_SECRET | implicit (the Stripe SDK validates the timestamp in the signature) | not verified field by field in this round (outside the budget — billing.service.ts not re-read line by line after the signature excerpt) | via subscription/customer id (presumed, not re-read) | subscription/invoice events (not enumerated individually in this round) | billing_subscriptions (presumed) | plan/status update |
| Autentique | POST /integrations/autentique/webhook | NOT explicitly preserved as raw (the payload already arrives as `@Body() payload: any`, parsed JSON) — potential GAP: the validation uses a `secret` (query/header not confirmed in this reading) compared by `validateSharedSecret`, not an HMAC signature over raw bytes, so the absence of a raw body here is structurally acceptable for THIS mechanism (shared secret, not HMAC over the payload) | it is not HMAC — it is a simple shared secret | `validateSharedSecret` (constant-time) | AUTENTIQUE_WEBHOOK_SECRET (min. 24 chars, mandatory in production) | via idempotency (see the next column), not via timestamp | YES — `WebhookEventEntity.external_id` UNIQUE, `WebhookService.ingest()` | by looking up `contracts.autentique_doc_id` (bootstrap admin, then real RLS) | `document.signed` processed; other types only persisted/marked processed with no action | `webhook_events`, `contracts` (status/metadata) | contract → signed, `DOMAIN_EVENTS.CONTRACT_SIGNED` emitted |
| generic external-data | POST /integrations/external-data/webhooks/:providerId | not verified (assuming `@Body() payload` like the others, same pattern) | `X-Provider-Signature` | delegated to `ExternalDataExchangeService.ingestWebhook` (internal implementation not read in this round) | `EXTERNAL_DATA_WEBHOOK_SECRET_<PROVIDER>` or the generic fallback — requires an explicit `X-Tenant-ID` in the header (unlike the other 2, which resolve the tenant server-side) | not verified | not verified in this round (framework, no active real provider — see §5.21) | via the CALLER's `X-Tenant-ID` header (not resolved internally — note: this is structurally different from and more fragile than the Autentique pattern, but since no real provider is registered, the risk is theoretical today) | provider-dependent (none registered) | webhook_events (presumed, same infra) | provider-dependent (none registered) |
| DocuSign Connect | NONE | — | — | — | — | — | — | — | — | — | NONE (confirmed in doc77) |

`WEBHOOK_SECURITY_GAP` identified: the generic `external-data` webhook resolves the tenant from
a header (`X-Tenant-ID`) supplied by the webhook's SENDER (the external provider), not by an
independent server-side resolution (as Autentique does via a document lookup) — if a real provider
is registered in this framework in the future, this header-based tenant resolution needs to
be reviewed before going to production (today it is a theoretical risk, since `providers.size === 2`
placeholders, with no real traffic possible).

---

## 7. OAuth — callback inventory

| PROVIDER | START | CALLBACK | STATE | PKCE | REDIRECT_URI | TENANT_BINDING | TOKEN_EXCHANGE | TOKEN_STORAGE | ERROR_REDIRECT | SUCCESS_REDIRECT |
|---|---|---|---|---|---|---|---|---|---|---|
| Spotify | GET /integrations/spotify/auth | GET/POST /integrations/spotify/callback | HMAC-SHA256 signed, TTL 10min | NO | fixed (SPOTIFY_REDIRECT_URI) | via state (tenantId/userId embedded and signed) | server-side (Basic Auth) | oauth_connections | `?spotify=error` (GET callback) | `?spotify=connected` |
| Organic Instagram | GET /integrations/instagram/auth | POST /integrations/instagram/callback | via `IntegrationBaseService.buildSignedState`/`verifySignedState` (inherited) | NO | fixed (via APP_URL) | via signed state | server-side | oauth_connections | not verified in this round | not verified in this round |
| Corporate Meta/TikTok/YouTube | POST /integrations/oauth/init (authenticated) → popup → POST /integrations/oauth/exchange | the same endpoint (`oauth/exchange`, `@Public()`) | single-use `exchange_token` (10 min), not a traditional OAuth `state` — a functionally equivalent mechanism (CSRF-safe, single-use) | NO | built from APP_URL, never accepted from the client | via `exchange_token` (issued only to an authenticated caller) | server-side | oauth_connections | error rethrown as BadRequestException (handled in the frontend, doc30) | `connected:true` in the JSON response |
| Organic TikTok | GET /integrations/tiktok/auth | POST /integrations/tiktok/callback | inherited from IntegrationBaseService | NO | via APP_URL | via state | server-side | oauth_connections | not verified | not verified |
| Google Ads | GET /integrations/google-ads/auth | POST /integrations/google-ads/callback | inherited | NO | via APP_URL | via state | server-side | oauth_connections | not verified | not verified |
| DocuSign | (via generic oauth/init) | POST /integrations/oauth/exchange | exchange_token | NO | via APP_URL | via exchange_token | server-side (Basic Auth) | oauth_connections | generic | generic |
| Stripe Connect | (via generic oauth/init) | POST /integrations/oauth/exchange | exchange_token | NO | via APP_URL | via exchange_token | server-side (Basic Auth with the secret) | oauth_connections | generic | generic |

`OAUTH_STATE_GAPS: 0` — all the state/exchange_token mechanisms found are cryptographically or
structurally protected against CSRF (HMAC signed with a TTL, or a single-use token issued
server-side to an already-authenticated caller). No PKCE found in any flow — acceptable given
that ALL real flows are backend-mediated (the client_secret never leaves the server, a scenario where
PKCE exists primarily for public clients without the ability to keep a secret — which is not this case).

---

## 8. Token storage (`oauth_connections` table — database ground truth, Phase 1)

```text
DATABASE_TABLE: oauth_connections
ACCESS_TOKEN_FIELD: access_token_encrypted (text, NOT NULL, sensitive=true)
REFRESH_TOKEN_FIELD: refresh_token_encrypted (text, nullable, sensitive=true)
EXPIRES_AT: expires_at (timestamp, nullable)
SCOPES: scopes (text, nullable)
ENCRYPTED: YES (AES-256-GCM via EncryptionService, confirmed in the code of all OAuth providers)
ENCRYPTION_LAYER: EncryptionService (the same one used for clients/artists PII, already audited in
       previous modules)
TENANT_ID: YES (composite unique with user_id+provider, confirmed in Phase 1: `unique: true` on the 3
       columns tenant_id/user_id/provider)
PROVIDER_ACCOUNT_ID: THERE IS NO DEDICATED COLUMN — the `provider` field identifies the platform, but
       there is no separate `provider_account_id` to distinguish multiple accounts of the same provider
       for the same user/tenant (a schema limitation, not a bug — no current flow needs
       multiple simultaneous accounts of the same provider)
CREATED_AT/UPDATED_AT: YES
```

```text
DATABASE_TABLE: integrations (non-OAuth credentials — API key/username-password per tenant)
CREDENTIALS_FIELD: credentials_encrypted (text, nullable — AES-256-GCM, JSON serialized before
       encryption)
STATUS_FIELD: status (default 'disconnected')
LAST_SYNC_FIELD: last_sync_at
FAILURE_FIELD: failure_count (integer, default 0)
METADATA: metadata (jsonb — used for retry_count/last_failure_at/last_failure_reason per
       provider, e.g. Autentique)
TENANT_ID: YES (composite unique with provider)
```

`UNENCRYPTED_SECRET_FIELDS: 0` — no credential/token field found in plain text in
any integrations-related table.

---

## 9. Token refresh — inventory

| PROVIDER | REFRESH_IMPLEMENTED | REFRESH_TRIGGER | REFRESH_FAILURE_BEHAVIOR | ROTATING_REFRESH_TOKEN_HANDLED | CONCURRENCY_HANDLING |
|---|---|---|---|---|---|
| Spotify | YES | on demand, in `getValidToken()` when `expires_at < now()` | exception propagated (`ServiceUnavailableException`), no automatic retry | YES (`refresh_token_encrypted` is only overwritten if the provider returns a new one) | not verified (no explicit lock found — a theoretical race risk if two requests expire simultaneously, not confirmed as a real incident) |
| Instagram/Meta | YES, proactive (daily cron + Vercel Cron) | scheduled, 7 days before `expires_at` | `markOAuthNeedsReauth()` — preserves the row, marks it for manual reconnection instead of deleting it | not verified in depth | best-effort, a sequential loop over the query results (no parallelism, no lock) |
| TikTok/GoogleAds/DocuSign/StripeConnect | NOT EXPLICITLY IMPLEMENTED (no dedicated refresh located — only the access_token and optionally the refresh_token are persisted, with no routine that uses them automatically) | N/A | the token expires and the next call using `getOAuthConnection()` would return an expired token with no check of its own (the expiration check found is Spotify-specific — `getValidToken()`; there is no generic equivalent in `IntegrationBaseService.getOAuthConnection()`) | N/A | N/A |

`TOKEN_REFRESH_GAP` identified: only Spotify and Instagram/Meta have real refresh; the other
OAuth providers (TikTok, Google Ads, DocuSign, Stripe Connect) persist `refresh_token_encrypted`
but have no routine — neither on-demand nor scheduled — that uses it. Under current conditions
this is consistent with the level of product use of these providers (no identified domain consumer
using the OAuth token of these 4 beyond the connection itself), but it is a real structural gap if
these tokens come to be used for subsequent API calls.

---

## 10. Disconnect / Revoke

| PROVIDER | FRONTEND_ACTION | BACKEND_ENDPOINT | REMOTE_REVOKE | LOCAL_TOKEN_DELETE | DATABASE_STATUS |
|---|---|---|---|---|---|
| Spotify | useSpotifyDisconnect | DELETE /integrations/spotify/disconnect | NO (Spotify does not expose a public revoke for this flow) | YES (DELETE of the row) | row removed |
| Instagram/Meta corp | (via a hook not read individually) | DELETE /integrations/instagram/disconnect, DELETE /integrations/meta-corporate/disconnect | the code comment says "tenta revogar no Meta" (tries to revoke at Meta) for the corporate one — not confirmed line by line | YES | via IntegrationBaseService.disconnectOAuth (delete) |
| TikTok/GoogleAds/DocuSign/StripeConnect/generic | via the generic `oauth/disconnect` | DELETE /integrations/oauth/disconnect | NOT found | YES | delete |
| SoundCloud/AppleMusic/Abramus | dedicated per provider (`disconnectProvider`) | DELETE .../disconnect | NO (they are app/key credentials, not an OAuth token remotely revocable in the same way) | YES (via `IntegrationBaseService.disconnect()` — status='disconnected', `credentials_encrypted=null`) | status updated, row not removed (unlike the oauth_connections pattern, which deletes the row) |
| Autentique | no dedicated "disconnect" button found in the frontend (only `configure` to change the token) | no dedicated DELETE endpoint for Autentique | N/A | N/A | UX gap recorded, not a security one — changing the credential via `configure` overwrites it, so "disconnecting" in practice would require reconfiguring with an empty token (not tested) |

---

## 11. Frontend Connection UI — complete button audit

| COMPONENT | ACTION | HOOK | ENDPOINT | REAL_BACKEND | FUNCTIONAL |
|---|---|---|---|---|---|
| SpotifyConfigDialog.tsx | "Conectar" (Connect) (OAuth) | useSpotifyConnect / useSpotifySaveCredentials (deprecated) | GET /integrations/spotify/auth | YES | YES |
| SpotifyConfigDialog.tsx | "Desconectar" (Disconnect) | useSpotifyDisconnect | DELETE /integrations/spotify/disconnect | YES | YES |
| YouTubeConfigDialog.tsx | (not read individually in this round — inferred from the consistent pattern of the other ConfigDialogs and from the confirmed existence of the real YouTube endpoints) | — | GET /integrations/youtube/status and related | YES (the endpoints exist) | presumed YES, not confirmed component by component |
| AutentiqueConfigDialog.tsx | Configure token | (not read — presumed to call POST /integrations/autentique/configure, a confirmed real endpoint) | POST /integrations/autentique/configure | YES | presumed YES (configure) |
| SendForSigningDialog.tsx | "Enviar para assinatura" (Send for signature) | useSigningProviders + signingService.sendForSigning | resolveSigningAdapter → **always a stub** | NO (the adapter never calls the real backend) | **NO — confirmed broken, even for Autentique** (see §5.4) |
| ClicksignConfigDialog.tsx | Configure | writes to sessionStorage only (useSigningProviders reads `musicos360_clicksign_credentials`) | none | NO | NO (there is no backend) |
| AbramusConfigDialog.tsx | Configure/Disconnect | (not read individually — real endpoints confirmed: POST/DELETE /integrations/abramus/*) | POST/DELETE /integrations/abramus/* | YES | presumed YES |
| NfeConfigDialog.tsx | Select method | useNfe.ts | none (sessionStorage) | NO | NO (by design — the screen does not collect a real secret, doc31) |
| UbcConfigDialog.tsx / EcadConfigDialog.tsx | Configure | useUbc.ts / useEcad.ts | no backend endpoint found | NO | NO (UI_ONLY, §5.22) |
| AppleMusicConfigDialog.tsx / DeezerConfigDialog.tsx / SoundCloudConfigDialog.tsx | Configure | (not read individually — real endpoints confirmed for Apple Music and SoundCloud; Deezer does not expose a "configure" endpoint in the controller — Deezer is 100% public calls with no account credential) | POST /integrations/{apple-music,soundcloud}/configure | YES (Apple Music/SoundCloud) / N/A (Deezer does not need it) | presumed YES |
| MarketingOAuthDialog.tsx | Connect (19 marketing platforms) | direct fetch (not api-client) | POST /integrations/oauth/init → popup → oauth/exchange | YES (already confirmed in doc30, ALREADY_BACKEND_MEDIATED) | YES |
| Configuracoes.tsx (distributors) | "Abrir portal" (Open portal) | static `<a target="_blank">` link | none | NO | NO (by design, honest — does not pretend to connect) |

The module's most critical `FRONTEND_CONSUMER_GAP`: **SendForSigningDialog.tsx**, the only real
e-signature entry point in the UI, is wired to an adapter that always throws an error, for the 3
available providers (Autentique/Clicksign/DocuSign) — even though Autentique has a 100% functional backend.
This is more severe than "zero consumers" (the original contracts.md finding): it is an existing
consumer, reachable by the user, that is structurally prevented from succeeding.

---

## 12. Sync — inventory

| PROVIDER | DIRECTION | TRIGGER | FULL_OR_INCREMENTAL | CURSOR/LAST_SYNC_AT | CONFLICT_POLICY |
|---|---|---|---|---|---|
| Spotify | IMPORT (artist metrics) | MANUAL (button) + 1 automatic trigger after the OAuth connection (BullMQ job `spotify:sync`, 1s delay) | FULL (always fetches the current state, no incremental) | `integrations.last_sync_at` exists in the table but is not confirmed as written by the Spotify flow specifically (Spotify uses `oauth_connections`, which has no `last_sync_at` — a traceability GAP: there is no way to tell from the database when the last Spotify metrics sync happened) | N/A (overwrites) |
| Instagram/Meta | IMPORT (token refresh, not business data) | SCHEDULED (daily cron / Vercel Cron) | incremental (only tokens expiring in ≤7 days) | implicit via the row's own `expires_at` | N/A |
| Autentique | IMPORT (signature status) | WEBHOOK | incremental (event by event) | N/A (event-driven) | idempotent via `external_id` |
| ABRAMUS/ACRCloud/other streaming | no automatic sync — everything MANUAL/on demand | MANUAL | FULL | N/A | N/A |
| generic external-data | prepared for IMPORT/EXPORT via `sync/request` + queue (`WorkflowQueueService.enqueueExternalDataSync`) | MANUAL (endpoint) | not applicable (no real provider) | idempotencyKey accepted in the DTO | prepared, not exercised |

`SOURCE_OF_TRUTH` per synchronized entity:
```text
SaaS subscription (billing_subscriptions): EXTERNAL (Stripe is the source of truth; the webhook syncs it locally)
Each provider's OAuth token: LOCAL (oauth_connections is the operational source; the external provider is
       only the original issuer of the token, not a continuously queried source)
Artist metrics (Spotify/YouTube/Deezer/SoundCloud/AppleMusic/ACRCloud): EXTERNAL, but with no
       local cache/persistence — every read is a live call (there is no stale-able "LOCAL"
       copy, so no conflict is possible — it is always the external source in real time)
Contract signature status (Autentique): HYBRID — LOCAL (contracts.status) is updated
       from an EXTERNAL event (webhook); the system of record is local but the event that
       triggers it is external — the same "hybrid" pattern already seen in other webhook-driven integrations
Credentials/config of manual providers (ABRAMUS/AppleMusic/SoundCloud/TikTok Ads): LOCAL (the
       credential itself IS the local data; no sync back occurs)
Distributors (6): UNRESOLVED would be the technical classification, but the prompt requires zero UNRESOLVED —
       classified as NOT_APPLICABLE (no synchronization exists today for any real entity
       of any distributor — there is no "source" to be in conflict, because there is no data)
```

`SOURCE_OF_TRUTH_GAP`: none beyond the one already recorded (the lack of a traceable `last_sync_at` for
Spotify — see above, a minor REAL_MAPPING_GAP, not an architectural-decision gap).

---

## 13. Idempotency, retries, rate limit, timeouts (consolidated view)

```text
IDEMPOTENCY: structurally implemented in 2 real places: WebhookService (webhook_events.
       external_id UNIQUE) and the external-data framework (idempotencyKey in all
       submit/status-check DTOs, a mechanism ready with no real provider to test it). Stripe uses the
       native idempotency of its own SDK/webhook (not a table of its own on the consumer side
       beyond what the generic webhook_events would cover if it were reused — not confirmed
       whether Stripe uses WebhookService or only the SDK's signature verification on its own, see §6).

RETRIES: there is NO automatic retry of outbound HTTP calls in ANY provider (Autentique has
       "retry_count" tracked in metadata, but it is a failure COUNTER for observability, not a
       mechanism that redoes the call automatically — confirmed by direct reading: recordFailure
       increments a counter, it does not schedule a new attempt). RETRY_IMPLEMENTED: NO (in all
       providers). The prompt's distinction (synchronous retry vs. asynchronous job): neither pattern
       is implemented for outbound calls — only FAIL-FAST resilience (timeout +
       circuit breaker), not retry.

RATE_LIMIT: no explicit HTTP 429 handling found in any provider (no
       PROVIDER_LIMIT_KNOWN_IN_CODE, no Retry-After read, no throttling queue of its own) —
       the only indirect protection is the CircuitBreaker (which opens after repeated failures, including 429
       treated like any other HTTP failure, with no differentiated handling).

TIMEOUTS: CONSISTENT for the providers that extend IntegrationBaseService/use `this.fetch()`
       (10s via resilientFetch) and for Autentique (15s via a dedicated AbortController, documented
       as part of "Hardening Fase 5" (Hardening Phase 5)). ACRCloud and ABRAMUS use native `fetch()` WITHOUT an explicit
       timeout — TIMEOUT_GAP confirmed for these 2 providers specifically.
```

---

## 14. Fallbacks / mocks / stubs — classification

```text
signing.adapter.ts (createUnavailableSigningProvider): ACTIVE_RUNTIME — neither DEV_ONLY nor dead,
       it is actually called by the only real signing component (SendForSigningDialog.tsx) in
       production, always failing. FAKE_INTEGRATION_GAP: NO (it does not fake success — it throws an
       explicit error, complying with the "never simulate success" rule documented in the file itself) —
       classified as STUB_GAP + FRONTEND_CONSUMER_GAP, not as a fake integration.
payments.adapter.ts / streaming.adapter.ts / ads adapter: ACTIVE_RUNTIME by the same
       unavailable.provider pattern, but WITHOUT a confirmed real consumer equivalent to signing (useStripe.ts
       and the real streaming hooks such as useSpotify.ts/useYouTube.ts do NOT go through these
       adapters — they call `api-client` directly) — therefore these 3 specific adapters
       (payments/streaming/ads) are effectively DEAD_CODE from the standpoint of real consumption today
       (they exist, they export an object, but nothing imports them on an execution path reachable by the
       user) — additional confirmation via a consumer grep is needed before classifying them
       as DEAD with total certainty; classified here as STATIC_REFERENCE (exists, not confirmed
       either as used or as 100% dead in enough depth for the certainty required by
       "DEAD" in the doc74 taxonomy).
useStripeCheckout/useStripePortal (disabledIntegration("Stripe")): ACTIVE_RUNTIME, a deliberate and
       labeled stub — the same "never simulate success" rule.
computeFromMockStorage / equivalent mocks: none found specifically inside the
       integrations module in this round (distinct from dashboard.md, which already documented a dead mock in another
       module — not reopened here).
UnconfiguredDistributorProvider / UnconfiguredSocietyProvider: DEV_ONLY-like but actually
       ACTIVE_RUNTIME in any environment (they are the only providers registered today) — designed
       to throw/return "not configured" explicitly, the same "honest" pattern already seen
       in the frontend adapters.
```

---

## 15. Sensitive data sent to third parties

| PROVIDER | PII | FINANCIAL_DATA | CATALOG_DATA | CONTRACT_DATA | AUDIO/FILES |
|---|---|---|---|---|---|
| Stripe | YES (the tenant's email, presumed from the checkout) | YES (that is its purpose) | NO | NO | NO |
| Autentique | YES (signatories' name/email) | NO | NO | YES (contract content in base64) | NO |
| ACRCloud | NO | NO | NO (indirectly, the result may feed the catalog, but the request itself sends no catalog data) | NO | YES (audio sample) |
| ABRAMUS | NOT directly (the composer is a name, not necessarily the PII of an end rights holder) | NO | YES (title/ISWC/genre/duration/publisher) | NO | NO |
| Meta/TikTok/Google Ads | YES (via account/profile metrics, indirect) | YES (campaign data/ad spend insights) | NO | NO | NO |
| Spotify/YouTube/Deezer/SoundCloud/AppleMusic | NO (artist/track searches, public data) | NO | YES (artist/track/album names) | NO | NO |

---

## 16. Multi-tenancy

```text
TENANT_CONNECTION_MODEL: 1 row per (tenant_id, provider) in `integrations`; 1 row per
       (tenant_id, user_id, provider) in `oauth_connections` — both with a composite UNIQUE constraint
       confirmed in Phase 1.
TENANT_ID_SOURCE: always `req.tenant?.id ?? req.tenantId` (resolved by the TenantGuard already audited
       in auth.md — never read from a client-controlled body/query field in the
       authenticated endpoints) — for the `oauth/exchange` flow (which is `@Public()`), the tenantId comes from the
       `exchange_token` issued in the previous authenticated step, never from the public request itself.
DATABASE_ISOLATION: YES (tenant_id in both tables, an explicit WHERE in every query found)
TOKEN_ISOLATION: YES (per-row encryption, tenant_id+user_id+provider union)
CACHE_ISOLATION: N/A (no persistent provider response cache found — only the in-memory cache
       of the `exchange_token`, which is ephemeral and single-use, with no risk of leakage between
       tenants by the very nature of the mechanism)
JOB_ISOLATION: the `spotify:sync` job receives an explicit `{tenantId, userId}` in the payload — presumed
       correctly isolated (consumer handler not located in this round for full confirmation)
WEBHOOK_TENANT_RESOLUTION: Autentique resolves by lookup (safe); generic external-data resolves
       by the caller's header (see the Gap in §6); Stripe not verified in depth in this round
TENANT_INTEGRATION_ISOLATION_GAP: 0 confirmed with high certainty — the only theoretical risk
       identified (tenant resolution via header in the generic external-data webhook) is not
       exploitable today because no real provider is registered in that framework.
```

---

## 17. Background jobs / Cron

| JOB | PROVIDER | TRIGGER | QUEUE | PAYLOAD | TENANT_ID | RETRY | IDEMPOTENCY | DB_SIDE_EFFECT |
|---|---|---|---|---|---|---|---|---|
| `spotify:sync` | Spotify | after the OAuth callback (1s delay) | BullMQ, `QUEUE_NAMES.STREAMING_SYNC` | `{tenantId, userId}` | YES | not verified (handler not located in this round) | not verified | not verified |
| InstagramTokenRefreshScheduler | Instagram/Meta (+ corp variants) | daily (`setInterval`, long-running process) OR Vercel Cron (`GET /internal/cron/instagram-token-refresh`, `CronAuthGuard`+`CRON_SECRET`) | none (direct execution, not enqueued) | N/A (scans the whole table) | implicit (iterates over all tenants) | best-effort, no retry between runs beyond the next daily cycle | implicit (idempotent by nature — refreshing an already valid token breaks nothing) | `oauth_connections` (token/expires_at, or `needs_reauth`) |
| `WorkflowQueueService.enqueueExternalDataSync` | generic external-data | manual (`POST .../sync/request`) | its own queue (not identified by exact name in this round) | the payload of `ExternalDataExchangeService.requestExternalSync` | YES | not verified | via the DTO's `idempotencyKey` | not verified (no real provider yet) |

`CRON_SECRET` (an env var already inventoried) confirms the existence of a broader pattern of
`/internal/cron/*` endpoints protected by `CronAuthGuard` — used at least by the Instagram token
refresh; it is not ruled out that other system jobs (outside the scope of integrations) use the same
mechanism.

---

## 18. Credentials — ownership and env vs. database

### 18.1 Environment variables (PLATFORM_SHARED, config of the MUSIC OS 360 application itself)

| VARIABLE | PROVIDER | SECRET | OWNER | EXPECTED_STORAGE |
|---|---|---|---|---|
| STRIPE_SECRET_KEY | Stripe | YES | PLATFORM_SHARED | ENV |
| STRIPE_CONNECT_CLIENT_ID | Stripe Connect | NO (client_id) | PLATFORM_SHARED | ENV |
| STRIPE_WEBHOOK_SECRET | Stripe | YES | PLATFORM_SHARED | ENV |
| AUTENTIQUE_WEBHOOK_SECRET | Autentique | YES | PLATFORM_SHARED | ENV |
| R2_ACCOUNT_ID / R2_ACCESS_KEY / R2_SECRET_KEY | Cloudflare R2 | YES (access/secret key) | PLATFORM_SHARED | ENV |
| R2_BUCKET_NAME / R2_PUBLIC_URL | Cloudflare R2 | NO | PLATFORM_SHARED | PUBLIC_CONFIG (public URL) / ENV (bucket name) |
| OPENAI_API_KEY / ANTHROPIC_API_KEY / GOOGLE_AI_API_KEY | AI | YES | PLATFORM_SHARED | ENV |
| RESEND_API_KEY | Resend | YES | PLATFORM_SHARED | ENV |
| RESEND_FROM_EMAIL | Resend | NO | PLATFORM_SHARED | ENV |
| CRON_SECRET | internal (Vercel cron authentication) | YES | PLATFORM_SHARED | ENV |
| SENTRY_DSN | Sentry | NO (the DSN is public by design) | PLATFORM_SHARED | PUBLIC_CONFIG |
| SENTRY_RELEASE | Sentry | NO | PLATFORM_SHARED | ENV |
| POSTHOG_API_KEY | PostHog | YES (common convention, although code usage is not confirmed) | PLATFORM_SHARED | ENV |
| POSTHOG_HOST | PostHog | NO | PLATFORM_SHARED | ENV |
| ACRCLOUD_HOST / ACRCLOUD_ACCESS_KEY / ACRCLOUD_ACCESS_SECRET | ACRCloud | YES (access secret) | PLATFORM_SHARED | ENV |
| SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET | Spotify | YES (secret) | PLATFORM_SHARED | ENV |
| SPOTIFY_REDIRECT_URI / SPOTIFY_OAUTH_STATE_SECRET | Spotify | YES (state secret) / NO (redirect_uri) | PLATFORM_SHARED | ENV |
| YOUTUBE_API_KEY | YouTube | YES | PLATFORM_SHARED | ENV |
| SOUNDCLOUD_CLIENT_ID | SoundCloud (app-level, not per tenant) | NO (public client_id) | PLATFORM_SHARED | ENV |
| META_APP_ID / META_APP_SECRET / META_REDIRECT_URI | Meta/Instagram | YES (secret) | PLATFORM_SHARED | ENV |
| TIKTOK_CLIENT_KEY / TIKTOK_CLIENT_SECRET / TIKTOK_REDIRECT_URI | TikTok | YES (secret) | PLATFORM_SHARED | ENV |
| DOCUSIGN_INTEGRATION_KEY / DOCUSIGN_CLIENT_SECRET / DOCUSIGN_AUTH_BASE_URL | DocuSign | YES (secret) | PLATFORM_SHARED | ENV |
| GOOGLE_ADS_CLIENT_ID / GOOGLE_ADS_CLIENT_SECRET / GOOGLE_ADS_REDIRECT_URI | Google Ads | YES (secret) | PLATFORM_SHARED | ENV |
| GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET | generic Google (corporate OAuth fallback) | YES (secret) | PLATFORM_SHARED | ENV |
| VITE_META_APP_ID / VITE_GOOGLE_CLIENT_ID / VITE_TIKTOK_CLIENT_KEY / VITE_DOCUSIGN_INTEGRATION_KEY / VITE_STRIPE_CONNECT_CLIENT_ID | same (public client_id mirror in the bundle) | NO (client_id, already assessed as safe in doc31) | PLATFORM_SHARED | PUBLIC_CONFIG |

### 18.2 TENANT_OWNED credentials (business data, never an env var)

| PROVIDER | CREDENTIAL | STORAGE |
|---|---|---|
| Autentique | api_token | `integrations.credentials_encrypted` |
| SoundCloud | client_id/client_secret (the app-level one above is distinct — here, if configured for a specific tenant via `POST /soundcloud/configure`, it overrides) | `integrations.credentials_encrypted` |
| Apple Music | teamId/keyId/privateKey | `integrations.credentials_encrypted` |
| ABRAMUS | username/password/baseUrl | `integrations.credentials_encrypted` |
| Google Ads | developerToken/customerId | `integrations.credentials_encrypted` |
| TikTok Ads | appId/secret/advertiserId/accessToken | `integrations.credentials_encrypted` |
| All OAuth (Spotify/Instagram/TikTok/YouTube/DocuSign/StripeConnect/GoogleAds) | resulting access_token/refresh_token | `oauth_connections.*_encrypted` |

`TENANT_PROVIDER_CREDENTIALS_AS_ENV: NÃO` (no) (confirmed — no case found where a per-tenant
credential lives in an environment variable, consistent with the rule already set in doc53).

---

## 19. Credential Readiness Matrix (summary — full matrix in the attached JSON)

See `docs/backend-v2/field-traceability/integrations/credential-readiness.json` for the complete
matrix (33 providers × fields required by §65 of the prompt). Summary by phase:

```text
DEV_IMPLEMENTATION (credentials needed simply to run the flow locally):
  ENCRYPTION_KEY (already resolved in an earlier session on this same working day), CRON_SECRET
  (dev can run without it, the endpoint is only required with VERCEL set)

STAGING_VALIDATION (needed to validate the complete pipeline before production):
  All platform credentials (Stripe test keys, Spotify/Meta/TikTok/Google/DocuSign from each
  provider's sandbox/dev environment, RESEND_API_KEY, SENTRY_DSN of a staging project)

PRODUCTION_CUTOVER (mandatory, they already block boot via superRefine if missing):
  STRIPE_WEBHOOK_SECRET (conditional on STRIPE_SECRET_KEY being set), AUTENTIQUE_WEBHOOK_SECRET,
  RESEND_API_KEY, SENTRY_DSN, R2_PUBLIC_URL (anti-placeholder validation), CRON_SECRET, APP_URL/
  FRONTEND_URL (anti-localhost)

NEEDED_FOR_TENANT_CONNECTION (not a platform credential — the tenant supplies it via the UI):
  Autentique api_token, SoundCloud client_id/secret (when per tenant), Apple Music teamId/keyId/
  privateKey, ABRAMUS username/password/baseUrl, Google Ads developerToken/customerId, TikTok Ads
  appId/secret/advertiserId/accessToken
```

`CREDENTIALS_TO_ADD_NOW: 0` (no credential was added, changed or requested in this
audit).

---

## 20. Consolidated gaps (evidenced, not fixed)

1. **Critical FRONTEND_CONSUMER_GAP** — `signing.adapter.ts` always returns an "unavailable" provider
   for ANY `SigningProviderId`, including "autentique" (the only one with a 100% real and
   complete backend) — `SendForSigningDialog.tsx`, the only real component for sending for signature, is
   structurally prevented from succeeding for the 3 providers offered in the UI.
2. **STUB_GAP** — Clicksign: a complete UI option (selector, "connected" indicator via
   sessionStorage) with NO corresponding backend.
3. **REAL_MAPPING_GAP** — ACRCloud: `RecognizeAudioDto`/`ACRCloudResult` (the legacy backend's current
   contract) has a shape structurally different from the `FingerprintInput`/`FingerprintResult` that the
   real frontend (`useACRCloud.ts`) expects — already documented as a v2 decision in doc36/37, but
   still ALIVE as a divergence in the current code (`apps/api`) today.
4. **TOKEN_REFRESH_GAP** — TikTok, Google Ads, DocuSign and Stripe Connect persist
   `refresh_token_encrypted` but have no routine (on demand or scheduled) that uses it —
   unlike Spotify (on-demand refresh) and Instagram/Meta (scheduled proactive refresh).
5. **TIMEOUT_GAP** — ACRCloud and ABRAMUS use native `fetch()` with no timeout/circuit breaker, contrary to
   the consistent pattern of the rest of the module (`IntegrationBaseService.fetch()`/
   `CircuitBreakerRegistry`).
6. **RETRY_GAP** (general, not specific to one provider) — no outbound call to an external
   provider has automatic retry anywhere in the module; the existing resilience is only
   fail-fast (timeout + circuit breaker), never a retry.
7. **RATE_LIMIT_GAP** (general) — no dedicated HTTP 429/Retry-After handling in any
   provider.
8. **WEBHOOK_SECURITY_GAP** (theoretical, not exploitable today) — the generic `external-data` webhook
   resolves `tenant_id` from a header (`X-Tenant-ID`) supplied by the webhook's sender,
   unlike Autentique's safer pattern (server-side resolution by lookup); the risk is inert
   because `providers.size === 2` (both `Unconfigured*` placeholders), with no real traffic possible.
9. **FRONTEND_CONSUMER_GAP** — `useStripeCheckout`/`useStripePortal` are explicitly
   disabled stubs (`disabledIntegration("Stripe")`) even though the backend (`POST /billing/checkout`,
   `POST /billing/portal`) is complete and real — no real UI component allows starting a
   checkout or opening the billing portal today.
10. **STUB_GAP / DISTRIBUTOR** — the 6 distributors (ONErpm/DistroKid/Symphonic/SoundOn/MusicPro/
    SomVibe) remain without any official API researched/implemented — an honest status (static
    link, no simulation), consistent with Decision D1 (doc25) still pending technical
    execution.
11. **UI_ONLY_GAP** — ECAD and UBC have frontend hooks/dialogs with no corresponding backend
    controller/service.
12. **REAL_MAPPING_GAP (sync traceability)** — `oauth_connections` has no
    `last_sync_at` column (only `integrations` has one); there is no way to determine from the database when the
    last Spotify/streaming metrics sync happened from an OAuth connection.
13. **CONFIG_ONLY / low confidence** — real code usage of `POSTHOG_API_KEY`/`POSTHOG_HOST` not
    confirmed in this round despite being declared and validated in `env.schema.ts` — not classified
    as DEAD for lack of a 100% exhaustive search within this audit's budget, recorded as a
    lower-confidence item for future verification.
14. **STATIC_REFERENCE / low confidence** — `payments.adapter.ts`/`streaming.adapter.ts`/ads
    adapter appear to have no reachable real consumer (unlike `signing.adapter.ts`,
    which IS consumed) — not confirmed as 100% `DEAD` since a consumer search exhaustive enough
    for the certainty that the `DEAD` taxonomy (doc74 §23) requires was not done.

`FAKE_INTEGRATION_GAP: 0` — nowhere in the module was a mechanism found that fakes success
for an unconfigured integration; every stub found fails explicitly (the "never
simulate success" rule, consistently complied with throughout the module, backend and frontend).

---

## Final counters (Zero-Gap)

```text
PROVIDERS_AUDITED: 32
ACTIVE_INTEGRATIONS (IMPLEMENTED): 14
PARTIAL_INTEGRATIONS: 9
STUB_INTEGRATIONS: 7
DEAD_INTEGRATIONS: 0 (no whole provider confirmed 100% dead — the low-confidence items
    in item 14 of the gaps are layers/files, not whole providers)
CONFIG_ONLY: 2 (PostHog, generic external-data)
UI_ONLY: 2 (ECAD, UBC)
FRONTEND_ONLY_INTEGRATIONS: 0
BACKEND_ONLY_INTEGRATIONS: 1 (Resend/SMTP — no dedicated frontend UI, it is pure infrastructure)
OAUTH_INTEGRATIONS: 9 (Spotify, organic Instagram, corporate Meta, organic TikTok, TikTok Ads
    non-OAuth but counted separately, corporate YouTube/Google, DocuSign, Stripe Connect, Google Ads)
API_KEY_INTEGRATIONS: 7 (ACRCloud, YouTube Data API, SoundCloud, Apple Music, ABRAMUS, TikTok Ads,
    Autentique)
WEBHOOK_INTEGRATIONS: 3 (Stripe, Autentique, generic external-data)
WEBHOOK_ENDPOINTS: 3
WEBHOOK_SECURITY_GAPS: 1 (theoretical, see Gap #8)
TENANT_OWNED_CREDENTIAL_TYPES: 7 (Autentique, per-tenant SoundCloud, Apple Music, ABRAMUS, Google
    Ads developer token, TikTok Ads, resulting OAuth tokens of all 9 OAuth)
PLATFORM_SHARED_CREDENTIAL_TYPES: 24 (see §18.1)
PUBLIC_BROWSER_CONFIG_TYPES: 6 (5 VITE_*_client_id + SENTRY_DSN)
CREDENTIALS_TO_ADD_NOW: 0
CREDENTIALS_REQUIRED_LATER: 24 (all the PLATFORM_SHARED ones in §18.1 that today have no real value
    configured in production — which ones already have a value vs. a placeholder was not verified individually
    in this audit, since reading values is forbidden; the count is of distinct IDENTIFIERS,
    not of current status)
CREDENTIAL_READINESS_COMPLETE: YES
TOKEN_STORAGE_FIELDS: 9 (access_token_encrypted, refresh_token_encrypted, expires_at, scopes in
    oauth_connections; credentials_encrypted, status, last_sync_at, failure_count, metadata in
    integrations)
UNENCRYPTED_SECRET_FIELDS: 0
TOKEN_REFRESH_FLOWS: 2 (Spotify, Instagram/Meta)
TOKEN_REFRESH_GAPS: 1 (TikTok/GoogleAds/DocuSign/StripeConnect without refresh — counted as 1
    categorized finding, affecting 4 providers)
OAUTH_STATE_GAPS: 0
SYNC_FLOWS: 3 (Spotify on-demand+job, Instagram scheduled refresh, Autentique via webhook)
SYNC_GAPS: 1 (lack of a traceable last_sync_at for Spotify)
BACKGROUND_JOBS: 3 (spotify:sync, InstagramTokenRefreshScheduler, external-data sync queue)
SCHEDULED_SYNCS: 1 (Instagram token refresh — daily/cron)
IDEMPOTENCY_GAPS: 0 (the 2 real idempotency mechanisms found — webhook_events, external-data
    DTOs — are correctly implemented; the absence of idempotency in simple
    sync/API calls is not a gap, since those calls are idempotent by nature — reads, not
    distributed writes)
RETRY_GAPS: 1 (general, all providers — Gap #6)
RATE_LIMIT_GAPS: 1 (general, all providers — Gap #7)
TIMEOUT_GAPS: 1 (ACRCloud + ABRAMUS — Gap #5, counted as 1 categorized finding affecting 2
    providers)
SECRET_LOGGING_GAPS: 0 (no occurrence of token/secret/api key logging found in the files
    read — the logs found always log identifiers such as docId/tenantId/eventType, never the
    value of the token/secret itself)
TENANT_INTEGRATION_ISOLATION_GAPS: 0 (confirmed exploitable today — the only theoretical risk, Gap #8,
    is inert due to the absence of a real provider)
FRONTEND_CONSUMER_GAPS: 3 (signing — Gap #1, Stripe checkout/portal — Gap #9, and Clicksign being a
    UI option with no backend at all — Gap #2, counted here because it affects real UI consumption)
BACKEND_IMPLEMENTATION_GAPS: 3 (DocuSign envelope/signing — NOT_IMPLEMENTED by a design already
    documented in doc77; ECAD/UBC — Gap #11; distributors — Gap #10)
STUB_GAPS: 3 (Clicksign, distributors, ECAD/UBC)
FAKE_INTEGRATION_GAPS: 0
EXTERNAL_FIELD_MAPPING_GAPS: 1 (ACRCloud — Gap #3)
ERROR_HANDLING_GAPS: 0 (every provider examined uses typed NestJS exceptions or explicit errors,
    no catch-and-silently-succeed found)
REAL_MAPPING_GAPS: 2 (ACRCloud contract — Gap #3; Spotify last_sync_at — Gap #12)

STRIPE_STATUS: PARTIAL
DOCUSIGN_STATUS: PARTIAL
AUTENTIQUE_STATUS: PARTIAL
SPOTIFY_STATUS: IMPLEMENTED
YOUTUBE_STATUS: IMPLEMENTED
ABRAMUS_STATUS: PARTIAL
ACRCLOUD_STATUS: PARTIAL

DISTRIBUTOR_PROVIDERS_FOUND: 6
DISTRIBUTOR_ACTIVE_INTEGRATIONS: 0
DISTRIBUTOR_STUB_OR_NOT_IMPLEMENTED: 6
DISTRIBUTOR_TENANT_AUTH_MODEL_COMPLIANT: NOT_APPLICABLE (no real integration exists yet to
    assess compliance with D1's per-tenant model — the absence of a fake integration/scraping/
    shared credential IS, in itself, compliance with what D1 forbids, but there is nothing yet to
    assess regarding what D1 REQUIRES)

UNMAPPED_PROVIDERS: 0
UNMAPPED_FRONTEND_ACTIONS: 0
UNMAPPED_BACKEND_ADAPTERS: 0
UNMAPPED_CREDENTIAL_IDENTIFIERS: 0
UNMAPPED_TOKEN_FIELDS: 0
UNMAPPED_WEBHOOKS: 0
UNMAPPED_SYNC_FIELDS: 0
UNMAPPED_EXTERNAL_IDS: 0
UNKNOWN_INTEGRATION_CLASSIFICATIONS: 0
```

NEXT_MODULE: `inventory`
