# Migrar Hooks Frontend de Integrações

## What & Why
Os hooks de integração do frontend atualmente armazenam credenciais e tokens em
`sessionStorage`/`localStorage`. Isso é inseguro e incorreto — credenciais devem
ficar no banco (criptografadas server-side). Os hooks devem apenas chamar o backend
via `api-client`. Migrar 8 hooks: useSpotify, useSoundCloud, useAppleMusic,
useInstagram, useTikTokAds, useGoogleAds, useAbramus e useYouTube.

## Done looks like
- Nenhum dos 8 hooks usa `sessionStorage` ou `localStorage` para credenciais
- Todos os hooks usam `api.get`, `api.post`, `api.delete` do `@/shared/lib/api-client`
- Modo mock respeitado: quando `MOCK_MODE === true`, os hooks retornam stub sem chamar backend
- useSpotify: `useSpotifyStatus` lê `/integrations/status`; `useSpotifyConnect` abre
  popup com URL do backend; `useSpotifyArtistMetrics` chama `POST /integrations/spotify/sync-artist`;
  `useSpotifyDisconnect` chama `DELETE /integrations/spotify/disconnect`
- useSoundCloud: status via `GET /integrations/soundcloud/status`, configure via POST,
  disconnect via DELETE, métricas via GET
- useAppleMusic: status, configure, disconnect, métricas via backend
- useInstagram: status, connect (popup OAuth), metrics, disconnect via backend
- useTikTokAds: status, configure, campaigns, disconnect via backend
- useGoogleAds: status, configure, connect (popup OAuth), campaigns, disconnect via backend
- useAbramus: status e saveCredentials chamam backend; searchArtist chama
  `GET /integrations/abramus/search/artist`
- useYouTube: status via `GET /integrations/youtube/status`, channelMetrics via
  `GET /integrations/youtube/channel/:id`
- `api-client.ts` tem método `delete` disponível (adicionar se faltar)

## Out of scope
- Criar novos serviços backend (já coberto pela task anterior)
- Refatorar componentes que consumem os hooks
- Testes E2E

## Steps
1. **Verificar api-client.ts** — Confirmar que o objeto `api` exporta método `delete`.
   Se não existir, adicionar: `delete: <T>(path: string) => request<T>(path, { method: 'DELETE' })`.
2. **Migrar useSpotify.ts** — Substituir completamente: remover sessionStorage.
   `useSpotifyStatus` lê do backend; `useSpotifyConnect` abre popup via URL do backend;
   `useSpotifyArtistMetrics` sincroniza via POST; `useSpotifyDisconnect` chama DELETE.
   Manter MOCK_MODE guard.
3. **Migrar useSoundCloud.ts** — Substituir completamente: `useSoundCloudStatus`,
   `useSoundCloudSaveCredentials` (POST configure), `useSoundCloudDeleteCredentials`
   (DELETE disconnect), `useSoundCloudUserMetrics` (GET user/:permalink),
   `useSoundCloudTrackMetrics` (GET track/:id).
4. **Migrar useAppleMusic.ts** — Substituir: `useAppleMusicStatus`,
   `useAppleMusicSaveCredentials` (POST configure com team_id/key_id/private_key),
   `useAppleMusicArtistMetrics` (GET artist/:id), `useAppleMusicDisconnect`.
5. **Migrar useInstagram.ts** — Substituir: `useInstagramStatus`, `useInstagramConnect`
   (GET auth → popup), `useInstagramAccountMetrics` (GET metrics),
   `useInstagramDisconnect` (DELETE).
6. **Migrar useTikTokAds.ts** — Substituir: `useTikTokAdsStatus`,
   `useTikTokAdsSaveCredentials` (POST configure com app_id/secret/advertiser_id),
   `useTikTokAdsCampaigns` (GET campaigns), `useTikTokAdsDisconnect` (DELETE).
7. **Migrar useGoogleAds.ts** — Substituir: `useGoogleAdsStatus`,
   `useGoogleAdsSaveCredentials` (POST configure), `useGoogleAdsConnect`
   (GET auth → popup), `useGoogleAdsCampaigns` (GET campaigns),
   `useGoogleAdsDisconnect` (DELETE).
8. **Migrar useAbramus.ts** — Atualizar seletivamente: `useAbramusStatus`
   (GET /integrations/abramus/status), `useAbramusSaveCredentials`
   (POST /integrations/abramus/configure com username/password/base_url),
   `useAbramusSearchArtist` (GET /integrations/abramus/search/artist). Manter
   tipos e demais funções existentes que não usam sessionStorage.
9. **Migrar useYouTube.ts** — `useYouTubeStatus` (GET /integrations/youtube/status),
   `useYouTubeChannelMetrics` (GET /integrations/youtube/channel/:id). Remover
   sessionStorage.
10. **Verificar ausência de sessionStorage** — Confirmar que nenhum dos 8 hooks
    exporta chamadas para `sessionStorage.setItem`/`getItem` para credenciais.
11. **TypeCheck frontend** — `cd client && npx tsc --noEmit` zero erros.

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
