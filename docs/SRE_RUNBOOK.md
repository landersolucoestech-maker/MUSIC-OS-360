# MUSIC OS 360 — SRE Runbook

> **Audience**: On-call engineers, DevOps, platform team.  
> **Last updated**: 2026-05-21  
> **Scope**: Production API + Web, Supabase, Redis, Cloudflare R2, Stripe webhooks.

---

## Service Inventory

| Service | Tech | Owner | Health endpoint |
|---|---|---|---|
| API | NestJS / Node 20 | Platform | `GET /api/v1/health` |
| Web | React + Vite / CDN | Frontend | — |
| Database | PostgreSQL (Supabase) | Platform | Supabase dashboard |
| Queue | BullMQ + Redis | Platform | `GET /api/v1/health` (redis key) |
| Storage | Cloudflare R2 | Platform | — |
| Auth | Supabase Auth | Platform | Supabase dashboard |
| Billing | Stripe | Platform | Stripe dashboard |
| Error tracking | Sentry | Platform | Sentry dashboard |

---

## SLI / SLO Definitions

### API Availability
- **SLI**: Percentage of requests returning HTTP 2xx or 4xx (excluding 5xx)
- **SLO**: ≥ 99.5% over any rolling 30-day window
- **Error budget**: 0.5% = ~3.6 hours of full outage per month

### API Latency (P95)
- **SLI**: 95th percentile response time for all non-health endpoints
- **SLO**: P95 ≤ 800 ms
- **Measurement**: Sentry performance / request logs (`latency_ms`)

### Auth Success Rate
- **SLI**: Percentage of JWT validation calls that succeed (excluding invalid/expired tokens)
- **SLO**: ≥ 99.9%

### Webhook Processing (Stripe)
- **SLI**: Percentage of Stripe webhook events processed within 30 seconds
- **SLO**: ≥ 99%

### Dunning Cycle
- **SLI**: Daily dunning cron completes without exception
- **SLO**: ≥ 99% of scheduled runs succeed

---

## Error Budgets

```
Monthly budget:
  API availability:   21.9 minutes of full outage (99.5% SLO, 30-day window)
  Latency budget:     4 hours of P95 > 800ms
  Auth success:       4.3 minutes of auth failure
```

When > 50% of monthly budget is consumed, initiate a **blameless post-mortem** and freeze non-critical deployments.

---

## On-Call Escalation

```
Severity 1 (complete outage):
  1. Page primary on-call immediately
  2. Notify #incidents channel
  3. Open war room
  4. P1 bridge: 15 min SLA to respond

Severity 2 (degraded service):
  1. Notify primary on-call
  2. Notify #incidents channel
  3. 30 min SLA to respond

Severity 3 (minor / single tenant affected):
  1. Create ticket
  2. Notify during business hours
```

---

## Common Runbook Scenarios

### API is returning 5xx

1. Check Sentry for new exceptions: filter by `level: error` and `service: music-os-api`
2. Check structured logs for `statusCode >= 500`:
   ```json
   { "level": "error", "type": "http", "statusCode": 500 }
   ```
3. Check database connectivity:
   ```bash
   GET /api/v1/health  # look for db.status === "up"
   ```
4. Check Redis connectivity (queue backlog):
   ```bash
   GET /api/v1/health  # look for redis.status
   ```
5. If DB unreachable: escalate to Supabase status page
6. If Redis unreachable: API continues in degraded mode (queues disabled). Non-fatal.
7. If dependency timeout: check `EXTERNAL_SERVICE_TIMEOUT` env var

### Authentication failures spike

1. Check Supabase Auth dashboard for JWKS endpoint status
2. Verify `SUPABASE_URL` and `SUPABASE_ANON_KEY` env vars are correct in production
3. Check if JWKS cache is stale:
   - JwtAuthGuard fetches JWKS on demand with 5-minute TTL
   - Restart pod if JWKS is stale
4. Check for token expiration issues (clock skew): verify server time sync

### Stripe webhook failures

1. Check Stripe dashboard → Webhooks → delivery failures
2. Verify `STRIPE_WEBHOOK_SECRET` env var in production
3. Manually replay failed webhooks via Stripe dashboard
4. Check idempotency: `webhook_events` table records processed events to prevent double-processing
5. If webhook handler is throwing: check Sentry for the exception

### Billing dunning missed

1. Check logs for `DunningService` entries at 08:00 UTC
2. If database was unavailable, dunning is skipped (no-op)
3. Manually trigger via admin API (future): `POST /api/v1/admin/billing/dunning/run`
4. Past-due subscriptions that missed dunning will be caught on the next daily cycle

### Plan limit ForbiddenException (unexpected)

1. Check `PlanLimitService` logs: `Plano X atingiu limite`
2. Verify subscription status for the affected org in `billing_subscriptions` table
3. If wrong plan: update subscription record and trigger `billing:plan_upgraded` WS event
4. If legitimate limit hit: guide user to upgrade

### Redis is unavailable

1. API continues in degraded mode:
   - Queue jobs (emails, AI jobs, notifications) are dropped (no retry)
   - `QueueModule` logs `Redis indisponível — modo sem filas`
2. Core API operations (auth, CRUD, billing) continue normally
3. Escalate to Redis provider (Railway / Upstash)
4. After Redis recovery: restart API pods to reconnect BullMQ

### Database migration pending (production)

1. `MigrationValidatorService` will exit the process with code 1 in production
2. Run migrations: `pnpm --filter @music-os-360/api db:migrate`
3. Verify: `pnpm --filter @music-os-360/api db:check` (fails on pending or unknown applied migrations)
4. Rollback if needed: follow the reverse transition in `docs/engineering/database.md` (`rollback:to <Migration>`, or `db:rollback` for the last migration; production requires `CONFIRM_ROLLBACK`)

---

## Health Check Response Reference

```json
GET /api/v1/health → 200
{
  "status": "ok",
  "info": {
    "database": { "status": "up" },
    "redis":    { "status": "up" },
    "storage":  { "status": "up" }
  },
  "error": {},
  "details": {
    "database": { "status": "up" },
    "redis":    { "status": "up" },
    "storage":  { "status": "up" }
  }
}
```

If any component is `"status": "down"`, return HTTP 503.

---

## Deployment Checklist

Before every production deploy:

- [ ] All tests pass (`pnpm test`)
- [ ] Build succeeds (`pnpm build`)
- [ ] No pending migrations OR migration has been run in staging first
- [ ] Sentry release tag set (`SENTRY_RELEASE`)
- [ ] Env vars validated (deployment will fail if required vars are missing)
- [ ] Feature flags reviewed (no bypass flag enabled; `pnpm --filter @music-os-360/api verify:production-flags` must pass)
- [ ] Rollback plan documented

---

## Incident Post-Mortem Template

```markdown
## Incident: [title]
**Date**: YYYY-MM-DD
**Duration**: HH:MM
**Severity**: P1 / P2 / P3
**Affected services**: 

### Timeline
- HH:MM — [event]
- HH:MM — [detection]
- HH:MM — [action]
- HH:MM — [resolution]

### Root cause
[Technical root cause]

### Contributing factors
- [factor 1]
- [factor 2]

### Impact
- Tenants affected:
- Errors during incident:
- Data loss:

### Action items
| Action | Owner | Due date |
|--------|-------|----------|
| | | |

### Lessons learned
[What worked well, what didn't]
```

---

## Key Environment Variables (Production)

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | YES | PostgreSQL connection string |
| `SUPABASE_URL` | YES | Supabase project URL |
| `SUPABASE_ANON_KEY` | YES | Supabase anon key (JWT validation) |
| `ENCRYPTION_KEY` | YES | 32-byte hex key for field encryption |
| `STRIPE_SECRET_KEY` | YES (billing) | Stripe API key |
| `STRIPE_WEBHOOK_SECRET` | YES (billing) | Stripe webhook signing secret |
| `REDIS_URL` | NO | Redis connection (queues degrade gracefully) |
| `SENTRY_DSN` | NO | Error tracking |
| `CORS_ORIGINS` | YES | Comma-separated allowed origins |
| `PORT` | NO (default 3001) | HTTP port |

Missing `YES` variables in production causes startup failure by design.
