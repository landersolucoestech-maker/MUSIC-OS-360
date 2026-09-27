---
title: Frontend — migrate 8 integration hooks to use the backend (remove sessionStorage)
---
# Migrate the Frontend Integration Hooks

## What & Why
The frontend integration hooks currently store credentials and tokens in
`sessionStorage`/`localStorage`. This is insecure and incorrect — credentials must
live in the database (encrypted server-side). The hooks must only call the backend
via `api-client`. Migrate 8 hooks: useSpotify, useSoundCloud, useAppleMusic,
useInstagram, useTikTokAds, useGoogleAds, useAbramus and useYouTube.

## Done looks like
- None of the 8 hooks uses `sessionStorage` or `localStorage` for credentials
- All hooks use `api.get`, `api.post`, `api.delete` from `@/shared/lib/api-client`
- Mock mode respected: when `MOCK_MODE === true`, the hooks return a stub without calling the backend
- useSpotify: `useSpotifyStatus` reads `/integrations/status`; `useSpotifyConnect` opens a
  popup with the backend URL; `useSpotifyArtistMetrics` calls `POST /integrations/spotify/sync-artist`;
  `useSpotifyDisconnect` calls `DELETE /integrations/spotify/disconnect`
- useSoundCloud: status via `GET /integrations/soundcloud/status`, configure via POST,
  disconnect via DELETE, metrics via GET
- useAppleMusic: status, configure, disconnect, metrics via the backend
- useInstagram: status, connect (OAuth popup), metrics, disconnect via the backend
- useTikTokAds: status, configure, campaigns, disconnect via the backend
- useGoogleAds: status, configure, connect (OAuth popup), campaigns, disconnect via the backend
- useAbramus: status and saveCredentials call the backend; searchArtist calls
  `GET /integrations/abramus/search/artist`
- useYouTube: status via `GET /integrations/youtube/status`, channelMetrics via
  `GET /integrations/youtube/channel/:id`
- `api-client.ts` has a `delete` method available (add it if missing)

## Out of scope
- Creating new backend services (already covered by the previous task)
- Refactoring the components that consume the hooks
- E2E tests

## Steps
1. **Check api-client.ts** — Confirm that the `api` object exports a `delete` method.
   If it does not exist, add: `delete: <T>(path: string) => request<T>(path, { method: 'DELETE' })`.
2. **Migrate useSpotify.ts** — Replace completely: remove sessionStorage.
   `useSpotifyStatus` reads from the backend; `useSpotifyConnect` opens a popup via the backend URL;
   `useSpotifyArtistMetrics` syncs via POST; `useSpotifyDisconnect` calls DELETE.
   Keep the MOCK_MODE guard.
3. **Migrate useSoundCloud.ts** — Replace completely: `useSoundCloudStatus`,
   `useSoundCloudSaveCredentials` (POST configure), `useSoundCloudDeleteCredentials`
   (DELETE disconnect), `useSoundCloudUserMetrics` (GET user/:permalink),
   `useSoundCloudTrackMetrics` (GET track/:id).
4. **Migrate useAppleMusic.ts** — Replace: `useAppleMusicStatus`,
   `useAppleMusicSaveCredentials` (POST configure with team_id/key_id/private_key),
   `useAppleMusicArtistMetrics` (GET artist/:id), `useAppleMusicDisconnect`.
5. **Migrate useInstagram.ts** — Replace: `useInstagramStatus`, `useInstagramConnect`
   (GET auth → popup), `useInstagramAccountMetrics` (GET metrics),
   `useInstagramDisconnect` (DELETE).
6. **Migrate useTikTokAds.ts** — Replace: `useTikTokAdsStatus`,
   `useTikTokAdsSaveCredentials` (POST configure with app_id/secret/advertiser_id),
   `useTikTokAdsCampaigns` (GET campaigns), `useTikTokAdsDisconnect` (DELETE).
7. **Migrate useGoogleAds.ts** — Replace: `useGoogleAdsStatus`,
   `useGoogleAdsSaveCredentials` (POST configure), `useGoogleAdsConnect`
   (GET auth → popup), `useGoogleAdsCampaigns` (GET campaigns),
   `useGoogleAdsDisconnect` (DELETE).
8. **Migrate useAbramus.ts** — Update selectively: `useAbramusStatus`
   (GET /integrations/abramus/status), `useAbramusSaveCredentials`
   (POST /integrations/abramus/configure with username/password/base_url),
   `useAbramusSearchArtist` (GET /integrations/abramus/search/artist). Keep
   the types and the other existing functions that do not use sessionStorage.
9. **Migrate useYouTube.ts** — `useYouTubeStatus` (GET /integrations/youtube/status),
   `useYouTubeChannelMetrics` (GET /integrations/youtube/channel/:id). Remove
   sessionStorage.
10. **Check for absence of sessionStorage** — Confirm that none of the 8 hooks
    exports calls to `sessionStorage.setItem`/`getItem` for credentials.
11. **Frontend TypeCheck** — `cd client && npx tsc --noEmit` zero errors.

## Relevant files
- `client/src/shared/lib/api-client.ts`
- `client/src/shared/lib/env.ts`
- `client/src/modules/integrations/hooks/useSpotify.ts`
- `client/src/modules/integrations/hooks/useSoundCloud.ts`
- `client/src/modules/integrations/hooks/useAppleMusic.ts`
- `client/src/modules/integrations/hooks/useInstagram.ts`
- `client/src/modules/integrations/hooks/useTikTokAds.ts`
- `client/src/modules/integrations/hooks/useGoogleAds.ts`
- `client/src/modules/integrations/hooks/useAbramus.ts`
- `client/src/modules/integrations/hooks/useYouTube.ts`