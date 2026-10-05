# MUSIC OS 360 — Enterprise Infrastructure

> **Status**: Active  
> **Scope**: Backup/restore, staging environments, secrets management, Redis monitoring, rate limiting, infrastructure hardening.  
> **Last updated**: 2026-05-21

---

## Backup & Restore

### Database (Supabase / PostgreSQL)

**Automated backups** (Supabase handles):
- Point-in-time recovery (PITR): 7-day window on Pro/Team plans
- Daily logical backups retained 30 days
- Verify PITR is enabled in Supabase dashboard → Settings → Backups

**Manual backup (pg_dump)**:
```bash
pg_dump "$DATABASE_URL" \
  --format=custom \
  --no-acl \
  --no-owner \
  --file="backup-$(date +%Y%m%d-%H%M%S).dump"
```

**Restore from dump**:
```bash
pg_restore \
  --dbname="$DATABASE_URL" \
  --no-acl \
  --no-owner \
  --clean \
  backup-YYYYMMDD-HHMMSS.dump
```

**Post-restore checklist**:
- [ ] Run pending migrations: `pnpm --filter @music-os-360/api db:migrate`, then `pnpm --filter @music-os-360/api db:check` (see `docs/engineering/database.md`)
- [ ] Verify RLS policies are intact: `SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public'`
- [ ] Validate row counts for critical tables
- [ ] Re-enable Supabase Auth hooks if needed (`supabase-jwt-hook.sql`)
- [ ] Smoke-test with `GET /api/v1/health`

### Redis

Redis holds BullMQ job queues and optional idempotency keys. Redis is **not** the source of truth — all critical state is in PostgreSQL.

**After Redis data loss**:
1. Restart the API (build with `pnpm build`, start with `pnpm --filter @music-os-360/api start`)
2. BullMQ reconnects automatically
3. In-flight jobs (pending at time of loss) are retried if they had `attempts > 1`
4. Idempotency keys reset — duplicate requests may re-execute; monitor for 15 minutes

**Backup Redis (if persistence needed)**:
```bash
redis-cli BGSAVE
# copy /var/lib/redis/dump.rdb to S3/R2
```

---

## Staging Environment

### Architecture

Staging mirrors production with separate:
- Supabase project (different URL/anon key)
- Stripe test-mode keys
- Redis instance (separate)
- R2 bucket

### Environment Variables (staging)

Create `.env.staging` (never commit):
```
NODE_ENV=production
DATABASE_URL=postgres://...staging-url...
SUPABASE_URL=https://...staging-project.supabase.co
SUPABASE_ANON_KEY=eyJ...staging-anon-key...
ENCRYPTION_KEY=...32-byte-hex...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_test_...
REDIS_URL=redis://...staging-redis...
CORS_ORIGINS=http://localhost:5173,https://staging.music-os-360.app
SENTRY_DSN=...staging-sentry-dsn...
```

### Staging Deployment Checklist

- [ ] Migrations run against staging DB first
- [ ] Smoke-test: auth, tenant isolation, billing webhooks
- [ ] No bypass flag enabled (`AUTH_DISABLED`, `DEV_SOCIAL_METRICS_MOCK`, `USE_MOCK`, `DEV_AUTH_ENDPOINT_ENABLED`); `pnpm --filter @music-os-360/api verify:production-flags` enforces it
- [ ] Stripe webhooks pointed to staging API endpoint
- [ ] Sentry release tag set to staging build

---

## Secrets Management

### Principles

1. **Never commit secrets** — `.env*` files are in `.gitignore`
2. **Rotation procedure**:
   - `ENCRYPTION_KEY` rotation: re-encrypt all encrypted fields with new key (requires migration script)
   - `SUPABASE_ANON_KEY` rotation: update env var and redeploy (no data migration needed)
   - `STRIPE_WEBHOOK_SECRET` rotation: update in Stripe dashboard + env var simultaneously
3. **Audit access** — all secret reads should be logged by the infrastructure provider

### Secret Storage

| Secret | Storage | Rotation |
|--------|---------|----------|
| `DATABASE_URL` | Railway / Render / Fly secrets | On compromise |
| `SUPABASE_ANON_KEY` | Provider secrets | Quarterly |
| `ENCRYPTION_KEY` | Provider secrets + HSM if enterprise | On compromise — with data migration |
| `STRIPE_SECRET_KEY` | Provider secrets | Quarterly |
| `REDIS_URL` | Provider secrets | On compromise |
| `SENTRY_DSN` | Provider secrets / CI env | Annually |

---

## Redis Monitoring

### Key Metrics

| Metric | Warning | Critical | Action |
|--------|---------|----------|--------|
| Memory usage | > 70% | > 90% | Increase instance size or evict old keys |
| Connected clients | > 50 | > 100 | Check for connection leaks |
| Blocked clients | > 0 | > 5 | Investigate blocking commands |
| Keyspace hit rate | < 80% | < 60% | Review caching strategy |
| Queue backlog (`bull:*`) | > 1000 | > 10000 | Scale workers or investigate blocking jobs |

### Health Check

API reports Redis status at `GET /api/v1/health`:
```json
{ "info": { "redis": { "status": "up" } } }
```

When Redis is down, the API continues in **degraded mode**:
- BullMQ queues are disabled — jobs dropped
- Idempotency cache falls back to in-memory (single instance only)
- Core API operations (auth, CRUD, billing webhooks) remain available

### Queue Monitoring

The BullMQ dashboard (Bull-Board) is mounted by the API itself at `/admin/queues`, protected by HTTP basic auth (`ADMIN_QUEUES_USER` / `ADMIN_QUEUES_PASS`; in production it is disabled unless both are set). There is no separate dashboard script. The authoritative queue list is `QUEUE_NAMES` in `apps/api/src/queues/queue.constants.ts`.

Examples of queues (retry counts below are not verified against the code):
| Queue | Purpose | DLQ behavior |
|-------|---------|-------------|
| `notifications` | Email/WS notifications, workflow automation | Retry 3x with exponential backoff |
| `ai-jobs` | AI model inference | Retry 2x; DLQ after failures |
| `webhook-events` | Stripe + outbound webhooks | Retry 5x; alert on DLQ |

---

## Rate Limiting

Rate limits are enforced globally by `RateLimitGuard`:

| Tier | Requests/min | Burst |
|------|-------------|-------|
| Unauthenticated | 20 | 30 |
| Viewer | 100 | 150 |
| Editor | 200 | 300 |
| Manager/Admin | 500 | 750 |

Rate limit responses: HTTP 429 with `Retry-After` header.

### Cloudflare WAF (production)

- Enable Cloudflare WAF for DDoS protection
- Rate limit rules at CF layer before reaching API
- Cache static assets at CF edge
- Bot protection on public form submission endpoint (`POST /forms/:id/submit`)

---

## Infrastructure Checklist (Production Readiness)

### Security

- [ ] All env vars validated at startup (fails closed in production)
- [ ] None of the bypass flags (`PROD_FORBIDDEN_BYPASS_FLAGS` in `apps/api/src/core/config/env.schema.ts`) is enabled in the production env
- [ ] `CORS_ORIGINS` explicitly set (no wildcard `*`)
- [ ] HTTPS enforced (Cloudflare or load balancer TLS termination)
- [ ] PostgreSQL: SSL enabled (`ssl: { rejectUnauthorized: false }` in TypeORM)
- [ ] Redis: TLS enabled (`rediss://` URL in production)
- [ ] Supabase: Row Level Security enabled on all tenant tables
- [ ] `ENCRYPTION_KEY` is 64 hex characters (32 bytes, AES-256)

### Reliability

- [ ] Connection pool tuned: `max: 20, min: 2` in production
- [ ] Statement timeout: 30s in production
- [ ] Redis: AOF or RDB persistence enabled
- [ ] Health endpoint responds within 500ms under normal load
- [ ] Sentry DSN configured and receiving events

### Operations

- [ ] `MigrationValidatorService` exits with code 1 if pending migrations in production
- [ ] `DunningService` running (verify logs at 08:00 UTC daily)
- [ ] BullMQ workers registered and processing queues
- [ ] Sentry release tags set on every deploy
- [ ] Structured logs forwarded to log aggregation (Papertrail / Logtail / Datadog)

---

## Scaling Guidelines

### Horizontal Scaling (stateless API)

The API is stateless — horizontal scaling requires:
- Redis-backed session/idempotency (already configured)
- BullMQ workers can run independently
- No in-memory state that must be shared (BullMQ queue is Redis-backed)

Deploy multiple replicas behind a load balancer (e.g., Railway, Fly.io, Render).

### Database Connection Pooling

With multiple API instances, use **PgBouncer** or **Supavisor** (Supabase built-in) to pool connections:
- Set `max: 5` per API instance in TypeORM config
- PgBouncer handles multiplexing to PostgreSQL
- Supabase connection string for PgBouncer: `postgres://...?pgbouncer=true&connection_limit=1`

### When to Scale

| Metric | Threshold | Action |
|--------|-----------|--------|
| CPU > 70% sustained | > 5 min | Add API replica |
| DB connections > 80% of max | Sustained | Enable PgBouncer |
| Redis memory > 70% | Sustained | Increase Redis instance |
| P95 latency > 600ms | > 10 min | Investigate or scale DB |
