# Integration Gateway — Centralized OAuth + Webhook Orchestrator + Retry Layer

## What & Why
`IntegrationBaseService` has a solid foundation (OAuth tokens, credentials encryption, HMAC state), but each provider (Spotify, YouTube, TikTok, Instagram, etc.) implements its own OAuth flow in a decoupled way. There is no: centralizing per-provider rate limiting layer, automatic retry with backoff when tokens expire, response normalization across providers, central webhook orchestrator that validates signatures before dispatching, nor a fallback handler when an integration fails. This creates inconsistent behavior and fragility in production.

## Done looks like
- A central `IntegrationGatewayService` that routes any provider call: `gateway.call(tenantId, provider, 'fetchMetrics', params)` with retry + automatic token refresh
- Automatic token refresh: when the access_token has expired, the gateway tries the refresh_token before throwing an error; it updates `oauth_connections`
- Per-provider rate limiting: a Redis-backed counter `rl:{provider}:{tenantId}` with a TTL; rejects with `429` before calling the external API
- `WebhookOrchestratorService`: validates the signature (HMAC, Stripe signature, etc.) before dispatching a job to the WEBHOOKS queue; rejects invalid payloads with 401
- Provider normalization: all return a standardized `{ provider, data, fetchedAt, tenantId }`
- Fallback handler: when a provider fails after the retry, it emits an `integration.degraded` event on the tenant's WebSocket and records it in the audit log
- Providers covered: Spotify, YouTube, TikTok, Instagram, Meta Ads, Google Ads, SoundCloud

## Out of scope
- Implementing real collection of streaming metrics (only the gateway — the data is left to the queue processors)
- Integration configuration frontend (already exists)
- New providers beyond those listed

## Steps
1. **IntegrationGatewayService** — create `modules/integrations/gateway/integration-gateway.service.ts`; a `call<T>(tenantId, userId, provider, method, params): Promise<T>` method that: loads the token via `loadOAuthTokens`, checks the rate limit, executes the call, catches 401 → tries a refresh → retries once, catches other errors → fallback + audit log
2. **Token auto-refresh** — create `gateway/token-refresh.service.ts`; for each provider, implement `refresh(tenantId, userId, provider): Promise<string>`, which calls the provider's token endpoint with the refresh_token; saves the new access_token via `saveOAuthTokens`; Spotify, YouTube, TikTok, Instagram with real refresh endpoints
3. **Rate limiter** — create `gateway/provider-rate-limit.service.ts`; use `UPSTASH_REDIS_URL` + `UPSTASH_REDIS_TOKEN`; per-provider configuration: Spotify (50 req/s), YouTube (10000 req/day), TikTok (100 req/min), Instagram (200 req/hour); a `checkLimit(provider, tenantId): Promise<boolean>` method
4. **WebhookOrchestratorService** — create `gateway/webhook-orchestrator.service.ts`; a `dispatch(provider, headers, rawBody): Promise<void>` method; validate the signature per provider (Stripe: `stripe-signature`, GitHub: `x-hub-signature-256`, TikTok: HMAC SHA256); dispatch to the WEBHOOKS queue via BullMQ with `{ provider, payload, tenantId }`
5. **Provider normalization** — create a `NormalizedProviderResponse<T>` interface with `provider`, `data`, `fetchedAt`, `tenantId`, `requestId`; update SpotifyService, YouTubeService, TikTokService to return this format via `IntegrationGatewayService`
6. **Register in IntegrationsModule** — add all the new services to `providers` and `exports`; update `IntegrationsController` to use `IntegrationGatewayService` instead of calling the providers directly

## Relevant files
- `apps/api/src/modules/integrations/integration-base.service.ts`
- `apps/api/src/modules/integrations/integrations.module.ts`
- `apps/api/src/modules/integrations/integrations.controller.ts`
- `apps/api/src/modules/integrations/spotify/spotify.service.ts`
- `apps/api/src/modules/integrations/youtube/youtube.service.ts`
- `apps/api/src/modules/integrations/tiktok/tiktok.service.ts`
- `apps/api/src/queues/queue.constants.ts`

## Depends on
- Task #661 (auth chain — tenantId/userId required in the gateway)
- Task #664 (queue processors — the WEBHOOKS queue needs a processor)
