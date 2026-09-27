# Backend Integrations — All Services

## What & Why
Create the `IntegrationBaseService` (a centralized helper to encrypt/save credentials,
read credentials, save/read OAuth tokens), and implement the 6 missing services:
SoundCloud, Apple Music, Instagram (Meta Graph API), TikTok (Ads + organic), Google Ads
and Abramus. Update `IntegrationsModule` and `IntegrationsController` to register
all the services and expose their endpoints. Add the optional environment variables
to env.schema.ts.

## Done looks like
- `integration-base.service.ts` exists with: `saveCredentials`, `loadCredentials`,
  `getStatus`, `disconnect`, `saveOAuthTokens`, `getOAuthConnection`, `disconnectOAuth`
- 6 new services created: SoundCloud, AppleMusic, Instagram, TikTok, GoogleAds, Abramus
- `integrations.module.ts` lists 11 providers/exports (ACRCloud, Autentique, Spotify,
  YouTube, Deezer + 6 new ones)
- `integrations.controller.ts` has 30+ endpoints covering all services
- `env.schema.ts` has SOUNDCLOUD_CLIENT_ID/SECRET, META_APP_ID/SECRET/REDIRECT_URI,
  TIKTOK_CLIENT_KEY/SECRET/REDIRECT_URI, GOOGLE_ADS_CLIENT_ID/SECRET/REDIRECT_URI
- API `tsc --noEmit`: 0 errors

## Out of scope
- Migration of the frontend hooks (next task)
- Implementation of automatic sync jobs
- E2E tests of the integrations

## Steps
1. **IntegrationBaseService** — Create `integration-base.service.ts` at the root of
   `apps/api/src/modules/integrations/`. Inject `@Inject(DRIZZLE_DB)` and
   `EncryptionService`. Implement the 7 methods: `saveCredentials`, `loadCredentials`,
   `getStatus`, `disconnect`, `saveOAuthTokens`, `getOAuthConnection`, `disconnectOAuth`.
   Register it as a provider in IntegrationsModule.
2. **SoundCloudService** — Create `soundcloud/soundcloud.service.ts` extending
   `IntegrationBaseService`. Inject `ConfigService` for SOUNDCLOUD_CLIENT_ID.
   Methods: `configure`, `getStatus`, `disconnectProvider`, `resolveUser`,
   `getTrackStats`, `searchTracks` (public API v2, no OAuth for public data).
3. **AppleMusicService** — Create `apple-music/apple-music.service.ts`. Save
   `team_id`, `key_id`, `private_key` (PEM) encrypted. Generate the Developer JWT with
   `crypto.createSign('SHA256')`. Methods: `configure`, `getStatus`,
   `disconnectProvider`, `getArtistFromCatalog`, `searchCatalog`.
4. **InstagramService** — Create `instagram/instagram.service.ts`. OAuth 2.0 via
   Facebook Login (Meta Graph API v19.0). Scopes: `instagram_basic`,
   `instagram_manage_insights`, `pages_show_list`. Methods: `getAuthUrl`,
   `handleCallback` (exchanges for a 60-day long-lived token), `getStatus`,
   `disconnectProvider`, `getAccountMetrics`.
5. **TikTokService** — Create `tiktok/tiktok.service.ts`. Covers two flows:
   Ads API (credentials `app_id`, `secret`, `advertiser_id` — no OAuth) and
   organic (OAuth 2.0 TikTok Login Kit). Ads methods: `configureAds`, `getAdsStatus`,
   `disconnectAds`, `getAdsCampaigns`, `getAdsInsights`. Organic methods: `getOAuthUrl`,
   `handleOAuthCallback`.
6. **GoogleAdsService** — Create `google-ads/google-ads.service.ts`. API v17 with
   developer_token + OAuth 2.0. Methods: `configure`, `getStatus`, `disconnectProvider`,
   `getOAuthUrl`, `handleOAuthCallback`, `getCampaigns` (GAQL query).
7. **AbramusService** — Create `abramus/abramus.service.ts`. Encrypted
   `username`/`password`/`base_url` credentials. Token authentication (Bearer).
   Methods: `configure`, `getStatus`, `disconnectProvider`, `searchArtist`,
   `searchWork`, `registerWork`, `getStatements`.
8. **Update IntegrationsModule** — Replace the module completely to
   include `IntegrationBaseService` + the 6 new services in providers and exports.
   Keep BullModule.registerQueue for the two existing queues.
9. **Update IntegrationsController** — Replace the controller completely
   to include all 11 services in the constructor and add all the endpoints:
   SoundCloud (configure, status, disconnect, user, track, search),
   AppleMusic (configure, status, disconnect, artist, search),
   Instagram (auth, callback, status, metrics, disconnect),
   TikTok Ads (configure, status, disconnect, campaigns, insights) and
   TikTok organic (auth, callback),
   Google Ads (configure, auth, callback, status, disconnect, campaigns),
   Abramus (configure, status, disconnect, search-artist, search-work, register-work, statements).
   Add `Query` to the import if needed.
10. **Update env.schema.ts** — Add optional variables for SoundCloud,
    Meta/Facebook, TikTok and Google Ads.
11. **Fix constructors** — For each service that extends IntegrationBaseService,
    ensure that the `@Inject(DRIZZLE_DB) db` and `enc: EncryptionService` parameters
    are passed explicitly in the constructor's `super(db, enc)`.
12. **Final TypeCheck** — `cd apps/api && npx tsc --noEmit` zero errors.

## Relevant files
- `apps/api/src/modules/integrations/integrations.module.ts`
- `apps/api/src/modules/integrations/integrations.controller.ts`
- `apps/api/src/modules/integrations/acrcloud/acrcloud.service.ts`
- `apps/api/src/modules/integrations/autentique/autentique.service.ts`
- `apps/api/src/modules/integrations/spotify/spotify.service.ts`
- `apps/api/src/modules/integrations/dto/integrations.dto.ts`
- `apps/api/src/core/security/encryption.service.ts`
- `apps/api/src/core/config/env.schema.ts`
- `apps/api/src/database/schema.ts`
- `apps/api/src/database/database.module.ts`
