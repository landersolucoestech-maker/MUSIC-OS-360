# MUSIC OS 360 — Runbook

**Audience:** On-call engineers  
**Updated:** 2026-05-21

---

## SLIs & SLOs

| Signal | SLI | SLO | Alert threshold |
|--------|-----|-----|-----------------|
| API availability | `sum(rate(http_requests_total{status!~"5.."})) / sum(rate(http_requests_total))` | 99.5% / 30d | < 99% for 5 min |
| API p95 latency | p95 of response time for non-health routes | < 500ms | > 1s for 5 min |
| DB connection pool | ratio of active / max connections | < 80% | > 90% for 2 min |
| Queue backlog | BullMQ `waiting` jobs per queue | < 100 | > 500 for 10 min |
| Error budget | 1 - SLO = 0.5% errors / 30d = ~216 min downtime | 100% consumed → freeze deploys | < 20% remaining |

---

## Health Endpoints

| Endpoint | Purpose |
|----------|---------|
| `GET /api/v1/health` | Full check: DB + memory + disk |
| `GET /api/v1/health/live` | Liveness (process up) — k8s livenessProbe |
| `GET /api/v1/health/ready` | Readiness (DB connected) — k8s readinessProbe |
| `GET /api/v1/health/integrations` | Circuit breaker states for external APIs |

---

## Incident Response

### P0 — API completely down

1. Check `GET /api/v1/health/live` — if 5xx: process crashed, check Railway/Render logs
2. Check `GET /api/v1/health/ready` — if 5xx: DB unreachable
   - Check Supabase status page
   - Check `DATABASE_URL` env var is correct
   - Check connection pool exhaustion in logs
3. If DB healthy but API still down: check Sentry for uncaught exceptions
4. Restart the dyno/container as last resort

### P1 — Elevated error rate (4xx/5xx > 5%)

1. Check Sentry for error clusters — look for `500 Internal Server Error`
2. Check circuit breaker states at `/api/v1/health/integrations`
   - If `OPEN`: an external integration is down — not a system error
3. Check recent deploys (`git log --oneline -10`) — rollback if correlated
4. Check Redis queue backlog — if > 500 jobs, Redis may be overwhelmed

### P2 — High latency (p95 > 1s)

1. Check DB slow query logs (statement_timeout = 30s in prod)
2. Check connection pool usage
3. Check if BullMQ workers are consuming CPU
4. Look for N+1 patterns in logs

### Payment failure / Dunning

1. Stripe webhook `invoice.payment_failed` is processed automatically
2. Subscription marked `past_due` → tenant notified via WebSocket
3. Manual override: update `billing_subscriptions.status` directly if needed
4. Stripe portal: redirect org owner to `/billing` page

---

## On-Call Checklist

**Daily:**
- [ ] Check `/api/v1/health` returns status `ok`
- [ ] Check Sentry for new error clusters
- [ ] Check Redis queue backlog

**Weekly:**
- [ ] Review AI cost per tenant (`GET /api/v1/ai/usage`)
- [ ] Check security scan results in GitHub Actions
- [ ] Review pnpm audit output

---

## Environment Variables — Critical

| Var | Required | Effect if missing |
|-----|----------|-------------------|
| `DATABASE_URL` | Prod required | App exits |
| `REDIS_QUEUE_URL` | Prod required | App exits |
| `SUPABASE_URL` | Prod required | Auth fails |
| `ENCRYPTION_KEY` | Always | PII in plaintext |
| `SENTRY_DSN` | Optional | No error monitoring |
| `STRIPE_SECRET_KEY` | Optional | Billing disabled |

---

## Git Flow

`dev` is the only branch of this repository. Commit only on `dev` and push only
`dev` to `origin/dev`; no other branch is created, switched to, synced or
published. There is no `main` branch and no promotion between branches.

```
dev    development, integration and the ref every workflow runs on
        (CI on every push: Tests, Migrations Check, Docker Build,
        Security Regression, gitleaks, CodeQL)
```

Staging is an environment (GitHub Environment `staging`), not a branch;
`staging.yml` is a manual dispatch from `dev`. Production is released by an
owner-authorized manual action, never by a branch merge. Steps and gates:
[`docs/runbooks/staging-to-production.md`](runbooks/staging-to-production.md).
Policy, guards and enforcement: [`docs/engineering/git-safety.md`](engineering/git-safety.md).

---

## Rollback Procedure

```bash
# 1. Identify last known good commit
git log --oneline apps/api/src/ -10

# 2. Deploy previous version (Railway)
railway rollback --service api

# 3. If DB migration needs rollback
pnpm --filter api db:rollback

# 4. Verify health
curl https://api.musicos360.com.br/api/v1/health
```

---

## Disaster Recovery

> **DOC-01 (fixed):** this section used to describe RTO/RPO as if Supabase PITR
> and a managed "daily Supabase backup" already covered recovery, and claimed R2
> needed no separate backup. Neither claim is confirmed: Supabase PITR is an
> opt-in paid feature not verified as enabled, and R2 durability protects against
> storage-layer loss, not application-level mistakes (accidental delete, bad
> migration, compromised key) — none of which R2 durability helps with.
>
> **`docs/runbooks/dr.md` is the single source of truth for disaster recovery.**
> It documents the actual mechanism (`pg_dump` → age/gpg encryption →
> `.github/workflows/backup.yml` → R2, weekly automated restore drill) and its
> real current status, including any open blockers. Read that file, not this
> section, before relying on backup/restore during an incident.
