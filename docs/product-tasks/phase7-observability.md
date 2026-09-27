# PHASE 7 — Operational Observability

## What & Why
The system has `packages/observability` with Sentry and a Pino logger declared, but tracing coverage is superficial, there is no workflow monitoring, no queue tracking and no structured RBAC/tenant logs for critical decisions. To operate at SaaS scale, complete visibility of every request, every workflow transition and every permission decision is needed.

## Done looks like
- `X-Request-ID` and `X-Correlation-ID` propagated in 100% of requests — generated in the inbound middleware, returned in the response headers, logged on every log line of the request
- Structured logging with Pino: each log includes the fields: `request_id`, `correlation_id`, `tenant_id`, `user_id`, `module`, `action`, `duration_ms`, `status_code`
- RBAC logs: each `assertCan()` decision logs `{role, resource, action, allowed, tenant_id, user_id}` at DEBUG level in development, WARN when denied
- Tenant propagation logs: tenant resolution in the guard logs `{tenant_id, org_id, clerk_org_id, resolved_in_ms}` at DEBUG
- Workflow transition logs: each call to `WorkflowService.transition()` logs `{entity_type, entity_id, from, to, actor_id, tenant_id, guards_evaluated, duration_ms}` at INFO
- Queue monitoring: `QueueService` logs queue metrics on each cycle: `{queue_name, waiting, active, completed, failed, delayed}` at INFO
- Integration monitoring: `IntegrationService` logs each sync: `{provider, tenant_id, status, items_synced, errors, duration_ms}`
- Failure tracking: `WebhookEventEntity` already has `retry_count` and `error` — add alerts when `retry_count > 3` and `failure_count > 5` on `IntegrationEntity`
- Health endpoint `GET /health` expanded with: DB status, Queue status, summarized Integration status, uptime, version
- In development (NODE_ENV=development): DEBUG log level active, duration of each SQL query logged, RBAC decisions logged
- In production: INFO log level, JSON output to stdout (Pino production config)
- Sentry: error capturing with `tenant_id` and `user_id` in the context of each captured error

## Out of scope
- External APM (Datadog, NewRelic)
- Distributed tracing with external OpenTelemetry exporters
- External log aggregation (CloudWatch, etc.)
- Infrastructure metrics dashboard

## Steps
1. **Implement RequestContextMiddleware** — NestJS middleware that generates `X-Request-ID` (UUID v4) and reads/generates `X-Correlation-ID` from the header. Stores both in AsyncLocalStorage. Adds the headers to the response. Apply it globally in `main.ts`.
2. **Configure Pino with automatic fields** — Refactor the `packages/observability` logger to automatically include `request_id` and `correlation_id` from AsyncLocalStorage in each log. Configure serializers for `tenant_id` and `user_id`. JSON format in production, pretty in dev.
3. **Add structured logs to RBAC** — In `RbacService.can()` and `assertCan()`, log each decision with complete fields. DEBUG level when allowed, WARN when denied. Include `tenant_id` and `user_id` from the context.
4. **Add logs to WorkflowService** — Instrument `WorkflowService.transition()` with an entry log (guards to evaluate), each evaluated guard, the final result and the total duration. Log `workflow_transition` as a structured event.
5. **Queue and Integration monitoring** — In `QueueService`, add a `getMetrics()` method called on a schedule (every 30s) that logs the state of the queues. In `IntegrationService`, log each sync with result and duration. Alert (WARN) when `failure_count` exceeds a threshold.
6. **Expand the health endpoint** — `GET /health` returns: `{status, version, uptime, db: {status, latency_ms}, queues: [{name, waiting, failed}], integrations: {connected_count, error_count}}`. Protected by an internal API key for scraping.

## Relevant files
- `packages/observability/src/`
- `apps/api/src/core/logger/`
- `apps/api/src/core/rbac/rbac.service.ts`
- `apps/api/src/core/queue/queue.service.ts`
- `apps/api/src/core/interceptors/`
- `apps/api/src/main.ts`
- `apps/api/src/app.module.ts`
