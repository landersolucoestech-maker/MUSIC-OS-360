# Integrações Backend — Todos os Serviços

## What & Why
Criar o `IntegrationBaseService` (helper centralizado para criptografar/salvar credenciais,
ler credenciais, salvar/ler tokens OAuth), e implementar os 6 serviços faltantes:
SoundCloud, Apple Music, Instagram (Meta Graph API), TikTok (Ads + orgânico), Google Ads
e Abramus. Atualizar o `IntegrationsModule` e `IntegrationsController` para registrar
todos os serviços e expor seus endpoints. Adicionar as variáveis de ambiente opcionais
ao env.schema.ts.

## Done looks like
- `integration-base.service.ts` existe com: `saveCredentials`, `loadCredentials`,
  `getStatus`, `disconnect`, `saveOAuthTokens`, `getOAuthConnection`, `disconnectOAuth`
- 6 novos services criados: SoundCloud, AppleMusic, Instagram, TikTok, GoogleAds, Abramus
- `integrations.module.ts` lista 11 providers/exports (ACRCloud, Autentique, Spotify,
  YouTube, Deezer + 6 novos)
- `integrations.controller.ts` tem 30+ endpoints cobrindo todos os serviços
- `env.schema.ts` tem SOUNDCLOUD_CLIENT_ID/SECRET, META_APP_ID/SECRET/REDIRECT_URI,
  TIKTOK_CLIENT_KEY/SECRET/REDIRECT_URI, GOOGLE_ADS_CLIENT_ID/SECRET/REDIRECT_URI
- `tsc --noEmit` da API: 0 erros

## Out of scope
- Migração dos hooks frontend (próxima task)
- Implementação de jobs de sync automático
- Testes E2E das integrações

## Steps
1. **IntegrationBaseService** — Criar `integration-base.service.ts` na raiz de
   `apps/api/src/modules/integrations/`. Injetar `@Inject(DRIZZLE_DB)` e
   `EncryptionService`. Implementar os 7 métodos: `saveCredentials`, `loadCredentials`,
   `getStatus`, `disconnect`, `saveOAuthTokens`, `getOAuthConnection`, `disconnectOAuth`.
   Registrar como provider no IntegrationsModule.
2. **SoundCloudService** — Criar `soundcloud/soundcloud.service.ts` extendendo
   `IntegrationBaseService`. Injetar `ConfigService` para SOUNDCLOUD_CLIENT_ID.
   Métodos: `configure`, `getStatus`, `disconnectProvider`, `resolveUser`,
   `getTrackStats`, `searchTracks` (API pública v2, sem OAuth para dados públicos).
3. **AppleMusicService** — Criar `apple-music/apple-music.service.ts`. Salvar
   `team_id`, `key_id`, `private_key` (PEM) criptografados. Gerar Developer JWT com
   `crypto.createSign('SHA256')`. Métodos: `configure`, `getStatus`,
   `disconnectProvider`, `getArtistFromCatalog`, `searchCatalog`.
4. **InstagramService** — Criar `instagram/instagram.service.ts`. OAuth 2.0 via
   Facebook Login (Meta Graph API v19.0). Escopos: `instagram_basic`,
   `instagram_manage_insights`, `pages_show_list`. Métodos: `getAuthUrl`,
   `handleCallback` (troca por long-lived token 60 dias), `getStatus`,
   `disconnectProvider`, `getAccountMetrics`.
5. **TikTokService** — Criar `tiktok/tiktok.service.ts`. Cobre dois fluxos:
   Ads API (credenciais `app_id`, `secret`, `advertiser_id` — sem OAuth) e
   orgânico (OAuth 2.0 TikTok Login Kit). Métodos Ads: `configureAds`, `getAdsStatus`,
   `disconnectAds`, `getAdsCampaigns`, `getAdsInsights`. Métodos orgânico: `getOAuthUrl`,
   `handleOAuthCallback`.
6. **GoogleAdsService** — Criar `google-ads/google-ads.service.ts`. API v17 com
   developer_token + OAuth 2.0. Métodos: `configure`, `getStatus`, `disconnectProvider`,
   `getOAuthUrl`, `handleOAuthCallback`, `getCampaigns` (GAQL query).
7. **AbramusService** — Criar `abramus/abramus.service.ts`. Credenciais
   `username`/`password`/`base_url` criptografadas. Autenticação por token (Bearer).
   Métodos: `configure`, `getStatus`, `disconnectProvider`, `searchArtist`,
   `searchWork`, `registerWork`, `getStatements`.
8. **Atualizar IntegrationsModule** — Substituir completamente o módulo para
   incluir `IntegrationBaseService` + 6 novos serviços em providers e exports.
   Manter BullModule.registerQueue para as duas filas existentes.
9. **Atualizar IntegrationsController** — Substituir completamente o controller
   para incluir todos os 11 serviços no constructor e adicionar todos os endpoints:
   SoundCloud (configure, status, disconnect, user, track, search),
   AppleMusic (configure, status, disconnect, artist, search),
   Instagram (auth, callback, status, metrics, disconnect),
   TikTok Ads (configure, status, disconnect, campaigns, insights) e
   TikTok orgânico (auth, callback),
   Google Ads (configure, auth, callback, status, disconnect, campaigns),
   Abramus (configure, status, disconnect, search-artist, search-work, register-work, statements).
   Adicionar `Query` ao import se necessário.
10. **Atualizar env.schema.ts** — Adicionar variáveis opcionais para SoundCloud,
    Meta/Facebook, TikTok e Google Ads.
11. **Corrigir constructors** — Para cada serviço que estende IntegrationBaseService,
    garantir que os parâmetros `@Inject(DRIZZLE_DB) db` e `enc: EncryptionService`
    são passados explicitamente no `super(db, enc)` do constructor.
12. **TypeCheck final** — `cd apps/api && npx tsc --noEmit` zero erros.

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
