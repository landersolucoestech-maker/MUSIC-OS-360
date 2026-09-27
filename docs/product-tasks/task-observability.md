# Enterprise Observability — Correlation ID + Structured Logs + Tracing

## What & Why
The current logging interceptor only records `METHOD URL → STATUS [Xms]` in plain text. There is no correlation ID, no tenant ID in the logs, no structured JSON, no distributed tracing and no queue metrics. In multi-tenant production, this makes it impossible to correlate requests with tenants, track failures in queues and diagnose per-route performance problems. The AuditService exists but is not called systematically.

## Done looks like
- Each request has an `x-request-id` (UUID generated or propagated from the header)
- `LoggingInterceptor` reworked: emits structured JSON with `requestId`, `tenantId`, `userId`, `method`, `path`, `statusCode`, `durationMs`
- A `CorrelationIdMiddleware` injects `x-request-id` into the request and response before any handler
- `AsyncLocalStorage` propagates `requestId` and `tenantId` to any `this.logger.log()` done inside services (via `RequestContextService`)
- Queue processors: structured log of start (`job.id`, `queue`, `tenantId`), completion and failure
- Health check endpoint `GET /health` returns `{ status: "ok", uptime, version, db: "connected" }`
- Endpoint `GET /health/queues` returns the count of waiting/active/failed jobs per queue
- `GlobalExceptionFilter` reworked: includes `requestId`, `tenantId`, stack trace in dev, sanitized message in prod
- `tsc --noEmit` without errors

## Out of scope
- Full OpenTelemetry distributed tracing (end-to-end span instrumentation)
- PostHog / Sentry integration (already exists, only improve the integration)
- Frontend observability

## Steps
1. **CorrelationIdMiddleware** — create `core/middleware/correlation-id.middleware.ts`: generate a UUID v4 if `x-request-id` does not come in the header; set it on `req.requestId` and in the `x-request-id` response header; register it in `AppModule` as global middleware
2. **RequestContextService** — create `core/context/request-context.service.ts` using `AsyncLocalStorage<{ requestId: string; tenantId: string | null; userId: string | null }>`; export `getContext()` and `run(ctx, fn)`; register it in `CoreModule`
3. **LoggingInterceptor refactor** — rewrite it to emit structured JSON: `{ level, timestamp, requestId, tenantId, userId, method, path, statusCode, durationMs }`; use `RequestContextService.getContext()`
4. **Queue logs** — update all 4 existing processors (email, notifications, ai-jobs, clerk-sync) to log `{ jobId, queue, tenantId, attempt }` at the start and end of each job via `this.logger.log(JSON.stringify(...))`
5. **Health endpoints** — create `core/health/health.controller.ts` with `GET /health` (db ping via Drizzle `SELECT 1`) and `GET /health/queues` (BullMQ queue counts for EMAILS, NOTIFICATIONS, AI_JOBS, CLERK_SYNC); register it in `CoreModule`
6. **GlobalExceptionFilter update** — add `requestId` and `tenantId` to the error body; sanitize the stack trace (`NODE_ENV !== production`); log as structured JSON

## Relevant files
- `apps/api/src/core/interceptors/logging.interceptor.ts`
- `apps/api/src/core/filters/global-exception.filter.ts`
- `apps/api/src/core/audit/audit.service.ts`
- `apps/api/src/queues/processors/email.processor.ts`
- `apps/api/src/app.module.ts`
- `apps/api/src/core/core.module.ts`
