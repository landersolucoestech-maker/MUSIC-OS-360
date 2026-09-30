# RUNBOOK — Rollback

**When to use**: a release just deployed and is causing user-visible breakage,
elevated error rate (>1% / 5min), failed migrations, broken auth/billing, or
data corruption. Choose the smallest rollback that resolves the symptom.

**Decision tree**:

```
Production broken
        │
        ▼
Is the symptom user-facing JS errors only?
        │
        ├── YES → §1 Rollback web deploy
        │
        ▼
Is it API 5xx / failed startup?
        │
        ├── YES + last release < 30min ago → §2 Rollback API image
        │
        ▼
Is it after a migration that ran < 1h ago?
        │
        ├── YES → §3 Rollback migration
        │
        ▼
Is data corrupted / unrecoverable from app?
        │
        ├── YES → §4 Restore from backup (RTO ~30min, RPO ≤24h)
        │
        ▼
None of the above → §5 Maintenance mode while diagnosing
```

Always announce in `#ops-incident` Slack before executing a destructive step.

---

## §1 — Rollback web deploy

Web is a static SPA. The simplest rollback is to redeploy the previous commit
on the hosting platform.

**Static hosting platform**: redeploy the previous web build artifact (previous
commit or image digest) using the platform's own rollback mechanism.

**Cloudflare Pages**:
- Dashboard → Pages → musicos360-web → Deployments → previous → "Rollback to this deployment"

**Self-hosted (nginx / static)**:
```bash
# Switch symlink to previous build
ln -sfn /var/www/musicos360/releases/<previous-sha> /var/www/musicos360/current
nginx -s reload
```

**Validation**:
- `curl https://app.musicos360.com | grep '<title>'` → returns expected title
- DevTools console clean in browser
- Smoke: login + open /dashboard

**Time**: 30–60s.

---

## §2 — Rollback API image

Production API runs the Docker image tagged from `apps/api/Dockerfile`.

**Identify previous good image**:
```bash
# Last 5 image tags in registry
docker pull ghcr.io/<org>/musicos360-api:latest  # what's currently deployed
# List previous tags via your registry UI or
crane ls ghcr.io/<org>/musicos360-api | tail -5
```

**Deploy previous image**:

Railway:
```bash
railway up --service api --image ghcr.io/<org>/musicos360-api:<previous-sha>
```

Fly.io:
```bash
fly deploy --image ghcr.io/<org>/musicos360-api:<previous-sha> --strategy immediate
```

Kubernetes:
```bash
kubectl set image deployment/api api=ghcr.io/<org>/musicos360-api:<previous-sha> -n prod
kubectl rollout status deployment/api -n prod
# If still bad:
kubectl rollout undo deployment/api -n prod
```

**Validation**:
- `curl https://api.musicos360.com/api/v1/health/live` → 200
- `curl https://api.musicos360.com/api/v1/health/ready` → 200
- `/metrics` shows `musicos_db_up 1` and `musicos_redis_up 1`
- Sentry error rate drops back below 1%

**Time**: 2–5min. **Caveat**: do NOT rollback past a migration boundary
without §3 — the old code may fail against the newer schema. `db:check` fails
when the database holds migrations the image does not ship.

---

## §3 — Rollback migration

Use only if the latest migration is structurally bad (added bad NOT NULL,
dropped a needed index, etc.) AND no production data has been written against
the new schema yet (rare — usually within minutes of deploy).

**Confirm last migration**:
```bash
docker exec musicos360_db psql -U musicos360 -d musicos360 -c \
  "SELECT name FROM musicos360_migrations ORDER BY id DESC LIMIT 1;"
```

**Order (no build may serve a schema it cannot read — see
`docs/engineering/database.md`, "Reverse transition")**:

1. Confirm `/api/v1/health/live` answers 200 (`status: up`) on the base URL you
   will probe, stop every API instance (HTTP + in-process workers) — §5
   maintenance mode or scale to zero — and confirm the same URL now refuses the
   connection, times out or answers 502/503/504 (a 404/3xx is not proof).
   Run `pnpm --filter @music-os-360/api exec tsx scripts/db-ops.ts preflight rollback` first.
2. Roll the database back, from the NEWER build (it holds the `down()` code),
   to the last migration of the build you are going back to:

```bash
# Production (uses TypeORM data-source.ts via tsx)
DATABASE_URL='<prod-url>' DB_SSL=true NODE_ENV=production CONFIRM_ROLLBACK=YES_I_KNOW_WHAT_I_AM_DOING \
  pnpm --filter @music-os-360/api exec tsx scripts/db-ops.ts rollback:to <LastMigrationOfOlderBuild>

# Local Docker
DATABASE_URL='postgresql://musicos360:musicos360_dev@localhost:5432/musicos360' DB_SSL=false \
  pnpm --filter @music-os-360/api exec tsx scripts/db-ops.ts rollback:to <LastMigrationOfOlderBuild>
```

   `rollback:to` validates the whole revert list first (refuses out-of-order
   rows, rows without a `down()` in this build and EXTERNAL_MANAGED migrations).
   Staging: `staging.yml` → `workflow_dispatch` on `staging` with
   `rollback_to_migration` and the same name in `confirm_rollback` (stops the
   build itself and never deploys; set `staging_already_down` when it is
   already stopped). The `staging` GitHub Environment should require reviewers
   and allow only the `staging` branch. Partial states: see
   `docs/engineering/database.md`, "Recovering from a partial state".
3. Deploy the older API image (§2); `db:check` with that image must pass.
4. Start it, validate, then leave maintenance mode.

**Validation**:
- `pnpm --filter @music-os-360/api db:check` → "✓ No pending migrations — schema in sync." (exit 0)
- API boots without errors
- Smoke test: any CRUD endpoint returns 200

**Time**: 1–3min per migration.

**SAFETY**: TypeORM `down()` is hand-written per migration. Verify the file's
`down()` exists and is correct before running. If absent, prefer §4 (restore).

---

## §4 — Restore from backup

**When**: data corrupted, migration partially applied and `down()` is unsafe,
or you simply need yesterday's data back.

**RPO** (max data loss): 24h (daily backups @ 03:00 UTC).
**RTO** (recovery time): ~30min for a fresh restore.

### Step 4.1 — Locate the backup

```bash
# List backups in R2/S3
aws --endpoint-url "$AWS_ENDPOINT_URL" s3 ls "s3://$BACKUP_BUCKET/musicos360-prod/" | tail -5
# Pick the one BEFORE the incident
LATEST=musicos360_20260524_030000.sql.age
aws --endpoint-url "$AWS_ENDPOINT_URL" s3 cp "s3://$BACKUP_BUCKET/musicos360-prod/$LATEST" /tmp/backup.age
```

### Step 4.2 — Decrypt

```bash
# age (preferred)
age --decrypt -i ~/.config/musicos360/age.key -o /tmp/backup.sql /tmp/backup.age

# gpg fallback
gpg --decrypt /tmp/backup.gpg > /tmp/backup.sql
```

### Step 4.3 — Restore into a new DB and verify BEFORE swapping

```bash
# Create staging DB on the prod instance
psql "$DATABASE_URL_ADMIN" -c "CREATE DATABASE musicos360_restore;"

# Apply auth shim if your prod is Supabase, you can SKIP shim — Supabase already has auth schema
psql "$DATABASE_URL_RESTORE" -f /tmp/backup.sql

# Paridade
psql "$DATABASE_URL_RESTORE" -c "
  SELECT
    (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public') AS tables,
    (SELECT COUNT(*) FROM tenants) AS tenants,
    (SELECT MAX(name) FROM musicos360_migrations) AS last_migration;
"
```

### Step 4.4 — Cutover

**Enable maintenance mode** (§5) FIRST. Then:

```bash
# Rename databases (atomic swap)
psql "$DATABASE_URL_ADMIN" <<SQL
ALTER DATABASE musicos360 RENAME TO musicos360_old_${TS};
ALTER DATABASE musicos360_restore RENAME TO musicos360;
SQL

# Restart API to drop stale connections
# (k8s)  kubectl rollout restart deployment/api -n prod
# (fly)  fly machine restart -a musicos360-api

# Disable maintenance mode
```

**Validation**:
- `/health/ready` → 200
- Login flow works
- One CRUD smoke per major domain (artists, contracts, invoices)
- Audit log row counts match expected
- Sentry quiet for 5min

**Time**: 20–40min including cutover.

---

## §5 — Maintenance mode

Use when diagnosing a problem and you need users to stop hitting the API.

**At the edge (preferred)**:

Cloudflare Workers:
```js
// Route /* → return 503 with Retry-After
export default {
  fetch() {
    return new Response('Maintenance in progress — back in ~30min', {
      status: 503,
      headers: { 'Retry-After': '1800', 'Content-Type': 'text/plain' },
    });
  },
};
```

Nginx:
```nginx
# /etc/nginx/conf.d/maint.conf
location / {
  if (-f /var/www/MAINT) {
    return 503;
  }
  proxy_pass http://api_upstream;
}
```
Activate: `touch /var/www/MAINT && nginx -s reload`
Deactivate: `rm /var/www/MAINT && nginx -s reload`

**Without edge** (degraded mode):
- Set `MAINT_MODE=true` env var on API
- API reads at boot, registers a global filter that returns 503 for all routes
  except `/health/live` and `/health/ready`
- (Not yet implemented — backlog if needed)

---

## §6 — Traffic shift / canary rollback

If using a canary deployment (10% traffic to new version):
```bash
# Reduce canary weight to 0
kubectl patch service api -n prod --type=merge -p '{"spec":{"selector":{"version":"stable"}}}'
```

Static hosting: re-promote previous build (§1 pattern).

Fly.io: `fly scale count 0 --process new-version`

---

## Authorisations

- **§1 web rollback** — any on-call engineer
- **§2 API rollback** — any on-call engineer
- **§3 migration rollback** — requires #ops-incident announcement + 1 reviewer
- **§4 restore** — requires #ops-incident announcement + on-call lead approval
- **§5 maintenance mode** — any on-call engineer; notify customers via status page

## Post-mortem trigger

If §3, §4, or §5 was used → schedule blameless post-mortem within 5 business days.
See `docs/RUNBOOK_INCIDENT.md` for severity/communication rules.

## Dry-run

This runbook was dry-run on local stack (FASE 10):
- §4 step 4.3 paridade: `tables=59 fks=18 indexes=239 rls=93` ✅ (against `backups/musicos360_20260524_0054.sql`)
- §3 db:rollback: not exercised on prod data (no rollback-safe migration to test)
- §2 image rollback: validated locally via `docker compose up -d api` of previous tag

Production-side validation must be repeated post-deploy with real registry + real DB.
