# Security Hardening — CSP + CSRF + Rate Limiting + Audit Trails + Signed Webhooks

## What & Why
The system has no Content Security Policy, no CSRF protection, no enterprise per-IP/tenant rate limiting, no signature validation on all incoming webhooks, and no integration token rotation. `RateLimitService` exists but only as a sketch. In multi-tenant production with financial data, contracts and phonograms, the absence of these protections represents a critical security risk: script injection via the missing CSP, CSRF on mutation endpoints, brute-force API abuse, and webhook replay by malicious actors.

## Done looks like
- `Content-Security-Policy` header on all responses: `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://r2.musicos360.com; connect-src 'self' https://api.clerk.dev`
- Helmet.js configured with: `frameguard`, `hsts` (production), `noSniff`, `xssFilter`, `referrerPolicy`
- CSRF: `csurf` or `@nestjs/csrf` applied to all mutation endpoints (POST/PATCH/PUT/DELETE); `X-CSRF-Token` generated per session and validated; webhook callbacks explicitly excluded via `@SkipCsrf()`
- Enterprise rate limiting: NestJS `ThrottlerModule` with Redis storage; rules: `100 req/15min` per IP globally; `1000 req/15min` per tenant; `10 req/min` on auth endpoints (`/auth/*`); custom `X-RateLimit-*` headers
- Mandatory webhook signature: no webhook processed without signature validation (HMAC or provider-specific); implemented via `WebhookOrchestratorService` (task #integration-gateway)
- Secrets not exposed in logs: `LoggingInterceptor` and `GlobalExceptionFilter` sanitize request bodies by removing the `password`, `token`, `secret`, `key`, `credential` fields
- Complete audit trail: every mutation (CREATE/UPDATE/DELETE) on sensitive data (contracts, transactions, users, integrations) is recorded in `audit_logs` via `AuditInterceptor` — `before`, `after`, `userId`, `tenantId`, `requestId`, `ip`, `userAgent`
- `AuditInterceptor` registered globally: automatically captures mutations with no need for a manual call in the services
- `tsc --noEmit` without errors

## Out of scope
- Penetration testing
- WAF (Web Application Firewall) — infrastructure level
- 2FA / MFA (delegated to Clerk)
- Database encryption at rest (the Neon provider is responsible)
- GDPR compliance (future phase)

## Steps
1. **Helmet + CSP** — install `helmet`; configure it in `main.ts` with `app.use(helmet({ contentSecurityPolicy: { directives: {...} }, hsts: IS_PROD, ... }))`; define conservative CSP directives allowing Clerk, R2 and the WebSocket of the app's own domain
2. **Enterprise rate limiting** — install `@nestjs/throttler` with `ThrottlerStorageRedisService` (Upstash Redis); configure `ThrottlerModule.forRoot({ throttlers: [{ ttl: 900, limit: 100 }] })`; override per route: `@Throttle({ default: { ttl: 60, limit: 10 } })` on auth endpoints; register `ThrottlerGuard` via `APP_GUARD`
3. **CSRF protection** — install `@nestjs/csrf`; configure middleware that generates a CSRF token per session via the `XSRF-TOKEN` cookie; validate the `X-XSRF-TOKEN` header on POST/PATCH/PUT/DELETE; skip decorator `@SkipCsrf()` for webhook callbacks and mobile endpoints; frontend: `api-client.ts` sends the `X-XSRF-TOKEN` header automatically on all mutations
4. **Global AuditInterceptor** — create `core/interceptors/audit.interceptor.ts` (it already exists, check whether it is complete); it must capture mutations (HTTP method != GET), extract `requestId`, `tenantId`, `userId`, the `entity` from the path, `before` from the current state, `after` from the response; call `AuditService.log()`; register it globally via `APP_INTERCEPTOR`
5. **Log sanitization** — create `core/utils/sanitize-log.ts` with a `sanitize(obj)` function that removes sensitive fields by name (`password`, `token`, `secret`, `key`, `apiKey`, `credential`, `access_token`, `refresh_token`); apply it in `LoggingInterceptor` (request body) and `GlobalExceptionFilter` (error context)
6. **Security response headers** — ensure that all responses include: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`

## Relevant files
- `apps/api/src/main.ts`
- `apps/api/src/app.module.ts`
- `apps/api/src/core/interceptors/audit.interceptor.ts`
- `apps/api/src/core/interceptors/logging.interceptor.ts`
- `apps/api/src/core/filters/global-exception.filter.ts`
- `apps/api/src/core/security/rate-limit.service.ts`
- `client/src/shared/lib/api-client.ts`

## Depends on
- Task #666 (Observability — requestId required in the audit trail)
- Task #661 (auth chain — tenantId/userId required in the audit)
