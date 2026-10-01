> Historical record. Kept as recorded; not the current contract.

# 11 — Resolução Final das 13 Incertezas de Response (com evidência do backend legacy)

Continuação read-only de [`10-http-response-unknowns-resolution.md`](./10-http-response-unknowns-resolution.md). Escopo: `apps/web/**` (já coberto) + apenas os controllers/services/DTOs de `apps/api/**` diretamente ligados a cada um dos 13 casos — nenhuma auditoria geral do backend. Nenhum arquivo foi alterado. Doc 10 não foi modificado. Erros HTTP e permissões não foram analisados (as rotas de integração e a de billing admin têm guards de auth/role, mas isso não foi examinado aqui).

**Achado estrutural que se aplica a todos os 12 casos UNKNOWN_TYPE:** as 12 rotas de integração vivem todas em um único controller (`apps/api/src/modules/integrations/integrations.controller.ts`), não em controllers por subpasta — cada subpasta (`youtube/`, `tiktok/`, `spotify/`, `soundcloud/`, `google-ads/`, `apple-music/`, `abramus/`) só tem um `*.service.ts`. Nenhuma das 13 respostas usa uma classe DTO de resposta do NestJS/Swagger — todas são objetos simples (shape inferido do código) ou assinaturas de retorno TypeScript diretas.

---

## Caso 1 — `MusicChatAutomationSettings` sub-tipos (UNKNOWN_FIELD do doc 10)

```text
CALL_SITE:
modules/musicchat/services/musicchat-automation.service.ts — getSettings()/updateSettings()

ENDPOINT:
GET/PATCH /conversations/musicchat/automation/settings

INCERTEZA:
UNKNOWN_FIELD

EVIDÊNCIA_FRONTEND:
modules/musicchat/types/musicchat-automation.types.ts:41-42,53 — menu_options: MusicChatMenuOption[], templates: MusicChatTemplate[], escalation_rules: MusicChatEscalationRule[] — os 3 tipos referenciados mas não localizados/expandidos no doc 07/10.

EVIDÊNCIA_LEGACY:
apps/api/src/modules/conversations/dto/musicchat-automation.dto.ts:16-45 — MusicChatMenuOptionDto, MusicChatTemplateDto, MusicChatEscalationRuleDto (usadas em UpdateMusicChatAutomationSettingsDto, o DTO do PATCH; presumível que a GET retorne a mesma forma persistida, dado o padrão CRUD do NestJS observado no restante do módulo).

RESULTADO:
MusicChatMenuOptionDto: { id: string, order: number, label: string, responseTemplateId: string, queue: string, sector: string, defaultAssignee?: string|null, tags?: string[], priority?: string, active?: boolean, required_fields?: string[], optional_fields?: string[] }
MusicChatTemplateDto: { id: string, title: string, body: string }
MusicChatEscalationRuleDto: { id: string, afterMinutes: number, level: string, recipientRole: string, recipientUserId?: string|null, channels?: string[], active?: boolean }

STATUS:
CONFIRMED

JUSTIFICATIVA:
O frontend não declarava nenhum shape para esses 3 sub-tipos (apenas os nomes, sem interface própria localizada em apps/web) — não há divergência possível para marcar CONFLICTING. O DTO do backend é a única fonte concreta de campos. Ressalva: a evidência vem do DTO de UPDATE (PATCH), não de um DTO de resposta explícito do GET — assumido consistente por ser o padrão do resto do módulo (mesma entidade servida em ambos os sentidos), não confirmado por leitura de um DTO de resposta dedicado.
```

## Caso 2 — `useYouTubeVideoMetrics` (UNKNOWN_TYPE #1)

```text
CALL_SITE: modules/integrations/hooks/useYouTube.ts — useYouTubeVideoMetrics
ENDPOINT: GET /integrations/youtube/video/:id
INCERTEZA: UNKNOWN_TYPE
EVIDÊNCIA_FRONTEND: sem generic, nenhum caller do hook em apps/web/src (confirmado no doc 10).
EVIDÊNCIA_LEGACY: apps/api/src/modules/integrations/integrations.controller.ts:532 (getYouTubeVideo) → apps/api/src/modules/integrations/youtube/youtube.service.ts:41-60 (getVideoStats). Integração real e viva (YouTube Data API v3, YOUTUBE_API_KEY).
RESULTADO: { videoId: string, title: string, channelTitle: string, publishedAt: string, views: number, likes: number, comments: number, syncedAt: string } — ou { error: string } se não encontrado.
STATUS: CONFIRMED
JUSTIFICATIVA: Frontend não declarava shape algum (nenhum caller); sem base para conflito. Rota existe e é uma integração real, não stub.
```

## Caso 3 — `useTikTokAdsSaveCredentials` (UNKNOWN_TYPE #2)

```text
CALL_SITE: modules/integrations/hooks/useTikTokAds.ts — useTikTokAdsSaveCredentials
ENDPOINT: POST /integrations/tiktok/ads/configure
INCERTEZA: UNKNOWN_TYPE
EVIDÊNCIA_FRONTEND: sem generic; retorno da mutation não é lido em nenhum lugar (padrão "configure" repetido nos outros integrações).
EVIDÊNCIA_LEGACY: integrations.controller.ts:752 (configureTikTokAds) → tiktok/tiktok.service.ts:35-37 (configureAds): assinatura Promise<void>, só persiste credenciais criptografadas.
RESULTADO: void — corpo de resposta vazio (HTTP 200 sem payload).
STATUS: CONFIRMED
JUSTIFICATIVA: O backend confirma exatamente o que o padrão de uso no frontend já sugeria (resposta nunca lida porque não há nada a ler) — coerência total, sem conflito.
```

## Caso 4 — `useTikTokAdsCampaigns` (UNKNOWN_TYPE #3)

```text
CALL_SITE: modules/integrations/hooks/useTikTokAds.ts — useTikTokAdsCampaigns
ENDPOINT: GET /integrations/tiktok/ads/campaigns
INCERTEZA: UNKNOWN_TYPE
EVIDÊNCIA_FRONTEND: sem generic, nenhum caller do hook (confirmado no doc 10).
EVIDÊNCIA_LEGACY: integrations.controller.ts:782 (tiktokAdsCampaigns) → tiktok/tiktok.service.ts:42-54 (getAdsCampaigns): chamada real à TikTok Business API (campaign/get).
RESULTADO: array de objetos crus da API do TikTok — `d.data?.list ?? []`, campos solicitados incluem campaign_id, campaign_name, status, budget, objective_type — ou { error: string } se não configurado/falhar.
STATUS: CONFIRMED
JUSTIFICATIVA: Sem shape frontend para conflitar. Integração real (não mock), campos vêm diretamente da API externa sem DTO de normalização no backend.
```

## Caso 5 — `useSpotifyArtistMetrics` (UNKNOWN_TYPE #4)

```text
CALL_SITE: modules/integrations/hooks/useSpotify.ts — useSpotifyArtistMetrics
ENDPOINT: POST /integrations/spotify/sync-artist
INCERTEZA: UNKNOWN_TYPE
EVIDÊNCIA_FRONTEND: sem generic, nenhum caller do hook (confirmado no doc 10).
EVIDÊNCIA_LEGACY: integrations.controller.ts:498 (syncSpotifyArtist) → spotify/spotify.service.ts:189-224 (syncArtistMetrics), assinatura de retorno explícita no TypeScript do backend.
RESULTADO: Promise<{ listeners: number|null, popularity: number, name: string, image: string|null } | null> — `listeners` é hard-coded `null` sempre (comentário no código: monthly listeners não disponível via essa API pública do Spotify).
STATUS: CONFIRMED
JUSTIFICATIVA: Sem shape frontend para conflitar. Achado relevante: `listeners` é um stub permanente por limitação real da API pública do Spotify, não um bug — documentado no próprio backend.
```

## Caso 6 — `useSoundCloudSaveCredentials` (UNKNOWN_TYPE #5)

```text
CALL_SITE: modules/integrations/hooks/useSoundCloud.ts — useSoundCloudSaveCredentials
ENDPOINT: POST /integrations/soundcloud/configure
INCERTEZA: UNKNOWN_TYPE
EVIDÊNCIA_FRONTEND: sem generic; caller existe (SoundCloudConfigDialog.tsx) mas só usa .mutate()/.isPending, nunca .data (confirmado no doc 10).
EVIDÊNCIA_LEGACY: integrations.controller.ts:578 (configureSoundCloud) → soundcloud/soundcloud.service.ts:27-29 (configure): Promise<void>, só salva credenciais.
RESULTADO: void — corpo vazio.
STATUS: CONFIRMED
JUSTIFICATIVA: Backend confirma void, exatamente consistente com o fato de nenhum componente ler `.data` — não há nada para ler mesmo.
```

## Caso 7 — `useSoundCloudUserMetrics` (UNKNOWN_TYPE #6)

```text
CALL_SITE: modules/integrations/hooks/useSoundCloud.ts — useSoundCloudUserMetrics
ENDPOINT: GET /integrations/soundcloud/user?url=...
INCERTEZA: UNKNOWN_TYPE
EVIDÊNCIA_FRONTEND: sem generic, nenhum caller do hook (confirmado no doc 10).
EVIDÊNCIA_LEGACY: integrations.controller.ts:606 (resolveSoundCloudUser) → soundcloud/soundcloud.service.ts:34-48 (resolveUser): chamada real ao endpoint /resolve da SoundCloud.
RESULTADO: { id: string, username: string, displayName: string, followers: number, following: number, tracksCount: number, avatar: string, permalink: string } — ou { error: string }.
STATUS: CONFIRMED
JUSTIFICATIVA: Sem shape frontend para conflitar. Integração real.
```

## Caso 8 — `useSoundCloudTrackMetrics` (UNKNOWN_TYPE #7)

```text
CALL_SITE: modules/integrations/hooks/useSoundCloud.ts — useSoundCloudTrackMetrics
ENDPOINT: GET /integrations/soundcloud/track/:id
INCERTEZA: UNKNOWN_TYPE
EVIDÊNCIA_FRONTEND: sem generic, nenhum caller do hook (confirmado no doc 10).
EVIDÊNCIA_LEGACY: integrations.controller.ts:613 (getSoundCloudTrack) → soundcloud/soundcloud.service.ts:50-65 (getTrackStats): chamada real a /tracks/:id.
RESULTADO: { id: string, title: string, plays: number, likes: number, reposts: number, comments: number, duration: number, genre: string, artworkUrl: string, permalinkUrl: string, syncedAt: string } — ou { error: string }.
STATUS: CONFIRMED
JUSTIFICATIVA: Sem shape frontend para conflitar. Integração real.
```

## Caso 9 — `useGoogleAdsSaveCredentials` (UNKNOWN_TYPE #8)

```text
CALL_SITE: modules/integrations/hooks/useGoogleAds.ts — useGoogleAdsSaveCredentials
ENDPOINT: POST /integrations/google-ads/configure
INCERTEZA: UNKNOWN_TYPE
EVIDÊNCIA_FRONTEND: sem generic, nenhum caller do hook (confirmado no doc 10).
EVIDÊNCIA_LEGACY: integrations.controller.ts:836 (configureGoogleAds) → google-ads/google-ads.service.ts:33-35 (configure): Promise<void>, só salva credenciais.
RESULTADO: void — corpo vazio.
STATUS: CONFIRMED
JUSTIFICATIVA: Sem shape frontend para conflitar; backend confirma void.
```

## Caso 10 — `useGoogleAdsCampaigns` (UNKNOWN_TYPE #9)

```text
CALL_SITE: modules/integrations/hooks/useGoogleAds.ts — useGoogleAdsCampaigns
ENDPOINT: GET /integrations/google-ads/campaigns
INCERTEZA: UNKNOWN_TYPE
EVIDÊNCIA_FRONTEND: sem generic, nenhum caller do hook (confirmado no doc 10).
EVIDÊNCIA_LEGACY: integrations.controller.ts:880 (googleAdsCampaigns) → google-ads/google-ads.service.ts:75-103 (getCampaigns): chamada real à Google Ads API (busca GAQL).
RESULTADO: array de { id: string, name: string, status: string, channelType: string, impressions: number, clicks: number, costMicros: number, ctr: number } — ou { error: string } se não configurado/OAuth ausente/erro de API.
STATUS: CONFIRMED
JUSTIFICATIVA: Sem shape frontend para conflitar. Integração real.
```

## Caso 11 — `useAppleMusicSaveCredentials` (UNKNOWN_TYPE #10)

```text
CALL_SITE: modules/integrations/hooks/useAppleMusic.ts — useAppleMusicSaveCredentials
ENDPOINT: POST /integrations/apple-music/configure
INCERTEZA: UNKNOWN_TYPE
EVIDÊNCIA_FRONTEND: sem generic; caller existe (AppleMusicConfigDialog.tsx) mas só usa .mutate()/.isPending, nunca .data (confirmado no doc 10).
EVIDÊNCIA_LEGACY: integrations.controller.ts:629 (configureAppleMusic) → apple-music/apple-music.service.ts:38-40 (configure): Promise<void>, só salva credenciais.
RESULTADO: void — corpo vazio.
STATUS: CONFIRMED
JUSTIFICATIVA: Backend confirma void, coerente com o componente nunca ler `.data`.
```

## Caso 12 — `useAppleMusicArtistMetrics` (UNKNOWN_TYPE #11)

```text
CALL_SITE: modules/integrations/hooks/useAppleMusic.ts — useAppleMusicArtistMetrics
ENDPOINT: GET /integrations/apple-music/artist/:id
INCERTEZA: UNKNOWN_TYPE
EVIDÊNCIA_FRONTEND: sem generic, nenhum caller do hook (confirmado no doc 10).
EVIDÊNCIA_LEGACY: integrations.controller.ts:657 (getAppleMusicArtist) → apple-music/apple-music.service.ts:62-78 (getArtistFromCatalog): chamada real à Apple Music Catalog API, usando JWT ES256 auto-assinado a partir das credenciais salvas.
RESULTADO: { artistId: string, name: string, genreNames: string[], url: string, editorialNotes: string, artwork: string, syncedAt: string } — ou { error: string }.
STATUS: CONFIRMED
JUSTIFICATIVA: Sem shape frontend para conflitar. Integração real (não stub).
```

## Caso 13 — `useAbramusSaveCredentials` (UNKNOWN_TYPE #12)

```text
CALL_SITE: modules/integrations/hooks/useAbramus.ts — useAbramusSaveCredentials
ENDPOINT: POST /integrations/abramus/configure
INCERTEZA: UNKNOWN_TYPE
EVIDÊNCIA_FRONTEND: sem generic; caller existe (AbramusConfigDialog.tsx) mas só usa .mutate()/.isPending, nunca .data (confirmado no doc 10).
EVIDÊNCIA_LEGACY: integrations.controller.ts:889 (configureAbramus) → abramus/abramus.service.ts:24-26 (configure): Promise<void>, só salva credenciais (sem validação contra a API real no momento do configure).
RESULTADO: void — corpo vazio.
STATUS: CONFIRMED
JUSTIFICATIVA: Backend confirma void, coerente com o componente nunca ler `.data`.
```

---

## Achado estrutural adicional (não fazia parte dos 13 casos oficiais, registrado por completude)

O padrão dos 5 endpoints `*/configure` (tiktok/ads, google-ads, apple-music, soundcloud, abramus) é idêntico em todos: `Promise<void>`, apenas persiste credenciais criptografadas, **nenhum valida contra a API real do provedor no momento da configuração**. Isso é consistente entre backend e frontend (nenhum dos dois espera uma resposta significativa), mas é um achado de comportamento potencialmente relevante para quem for reconstruir o backend: credenciais inválidas só seriam descobertas na primeira chamada real subsequente (status/campaigns/etc.), não no momento de salvar.

Também verificado por completude (fora da contagem oficial de 13, mas mencionado no doc 10 como caso relacionado): `adminBillingService.listInvoices` (GET `/billing/admin/invoices`) — rota real, backed por SQL bruto contra as tabelas `invoices`/`tenants` (não é mock), retornando array de `{ id, tenant_id, tenant_name, stripe_invoice_id, status, amount_due: number, amount_paid: number, currency, due_date, hosted_invoice_url, invoice_pdf, created_at }` (`apps/api/src/modules/billing/billing.controller.ts:163-168` → `billing.service.ts:436-482`, interface `AdminInvoiceRow` em `billing.service.ts:136-149`). Também sem caller no frontend — CONFIRMED pela mesma lógica dos demais.

## Resumo

```text
UNKNOWN_FIELDS_INITIAL_THIS_STEP: 1
UNKNOWN_FIELDS_RESOLVED: 1
UNKNOWN_FIELDS_CONFLICTING: 0
UNKNOWN_FIELDS_REMAINING: 0

UNKNOWN_TYPES_INITIAL_THIS_STEP: 12
UNKNOWN_TYPES_RESOLVED: 12
UNKNOWN_TYPES_CONFLICTING: 0
UNKNOWN_TYPES_REMAINING: 0
```

Nenhum caso resultou em CONFLICTING porque, em todos os 13, o frontend não declarava nenhum shape próprio para o dado (generic ausente e/ou nenhum consumidor real do valor) — não havia contrato-frontend algum para divergir do contrato-backend encontrado. O backend legacy foi, em todos os casos, a única fonte real do shape.

## Cobertura

Consultados em `apps/api` apenas: `modules/integrations/integrations.controller.ts` (rotas), `modules/integrations/{youtube,tiktok,spotify,soundcloud,google-ads,apple-music,abramus}/*.service.ts`, `modules/conversations/dto/musicchat-automation.dto.ts`, e (achado adicional) `modules/billing/{billing.controller.ts,billing.service.ts}`. Nenhum outro módulo do backend foi lido. Erros HTTP, guards/permissões e regras de negócio não foram analisados.
