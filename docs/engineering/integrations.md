---
paths:
  - "apps/api/src/modules/integrations/**"
description: Third-party integrations (Supabase, Stripe, AI providers, OAuth)
---

# Integrations

This repo integrates Supabase (auth/storage/realtime), Stripe (billing), OpenAI/Anthropic/Google
Generative AI (AI features live in the `apps/api` AI modules/`ai-jobs` queue, behind the
normal auth/tenant guard chain), Sentry, PostHog.

- OAuth/token handling: follow the existing pattern in
  `apps/api/src/modules/integrations/integrations.oauth-security.spec.ts` and neighboring code —
  don't roll a new token storage/refresh mechanism.
- Never hardcode API keys or webhook secrets; they come from env config
  (`apps/api/src/core/config/env.schema.ts`) which validates presence/shape at startup — extend
  that schema rather than reading `process.env` ad hoc in a new module.
- Webhook handlers (Stripe, etc.) must verify signatures before trusting payload contents.
- `@Public()` routes, OAuth callbacks, schedulers and workers get NO tenant DB context from
  `RequestTenantContextInterceptor`. With `DATABASE_SESSION_CONTEXT_ENABLED=true` the app role is
  NOBYPASSRLS, so any tenant-scoped read there silently returns 0 rows and any write is rejected
  (find-b4201eb2; identity rule: find-2220a85e). Resolve the tenant read-only via `ADMIN_DATA_SOURCE`, then do all tenant work
  inside `DatabaseContextService.runInTenantContext` (or `ensureTenantContext` when the same code
  also runs from an authenticated request). Never map a provider-side id to a tenant by
  "first row whose decrypted field matches": require an ownership proof at link time, uniqueness,
  and fail closed on ambiguity (see `WhatsAppCloudProvider.resolveTenantByPhoneNumberId`).
- Placeholder/dummy detection exists on purpose for Sentry/PostHog (`isPlaceholder`,
  `isPostHogPlaceholder` — see `security-regression` CI job) — don't remove it to silence a
  warning; fix the actual missing config.
- AI provider calls should have real error handling for rate limits/timeouts, not a silent
  fallback that fabricates a response.
