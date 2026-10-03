# MUSIC OS 360 — Real Provisioning Guide

> **Goal**: Turn the code into an operational platform connected to the real Supabase.  
> **Status**: Active — run in the order below.  
> **Last updated**: 2026-05-21

---

## Prerequisites

Before you start:
- [ ] Supabase account created at [supabase.com](https://supabase.com)
- [ ] Supabase project created (Free tier is acceptable for dev/staging)
- [ ] Node.js 20+ installed
- [ ] pnpm installed (`npm i -g pnpm`)
- [ ] Dependencies installed: `pnpm install`

---

## Phase 16 — Database Provisioning

### Step 1: Create the Supabase project

1. Go to [app.supabase.com](https://app.supabase.com)
2. Click **New Project**
3. Pick a nearby region (e.g. `sa-east-1`, South America)
4. Write down the database password — you will need it
5. Wait for the project to initialize (~2 minutes)

### Step 2: Get the credentials

In the Supabase dashboard:
- **Settings → API** → copy:
  - `Project URL` → `SUPABASE_URL`
  - `anon public` → `SUPABASE_ANON_KEY`
  - `service_role` → `SUPABASE_SERVICE_ROLE_KEY`
- **Settings → Database** → Connection String → `URI` mode → copy to `DATABASE_URL`

### Step 3: Configure environment variables

```bash
# Edit with your real credentials (the file already exists at the root, outside Git)
nano .env.development  # or use your preferred editor
```

Required variables:
```
DATABASE_URL=postgres://postgres:PASSWORD@db.REF.supabase.co:5432/postgres
SUPABASE_URL=https://REF.supabase.co
SUPABASE_ANON_KEY=eyJ...
ENCRYPTION_KEY=<64-hex-chars>  # generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
CORS_ORIGINS=http://localhost:5173
```

### Step 4: Run migrations

```bash
cd apps/api
npm run db:migrate
```

Expected result (literal script output, which is in Portuguese):
```
[db:migrate] Aplicando migrations…
[db:migrate] Migrations aplicadas com sucesso.
```

### Step 5: Verify provisioning

```bash
npm run verify:supabase
```

This script automatically checks:
- ✓ Environment variables present
- ✓ Connectivity to PostgreSQL
- ✓ Migrations executed
- ✓ All tables exist (~60 tables)
- ✓ RLS enabled on multi-tenant tables
- ✓ RLS policies exist
- ✓ `tenant_id` column present

If any item fails, the script reports the problem and exits with code 1.

**To fix RLS automatically:**
```bash
npm run verify:rls -- --fix
```

### Step 6: Apply the Supabase JWT Hook

This hook guarantees that `app.current_tenant_id` is set automatically on every request:

```bash
# Run the SQL in the Supabase SQL Editor:
# apps/api/supabase-jwt-hook.sql
```

Or via the Supabase CLI:
```bash
supabase db execute --file apps/api/supabase-jwt-hook.sql
```

---

## Phase 17 — Operational Seed

### Step 7: Create a user in Supabase Auth

1. Supabase Dashboard → **Authentication → Users**
2. Click **Invite User** or **Create User**
3. Email: `admin@musicos360.dev` (or your real email)
4. Copy the UUID of the created user

### Step 8: Configure the seed

```bash
# In .env.development, set:
SEED_ADMIN_SUB=<supabase-user-uuid>
SEED_ADMIN_EMAIL=admin@musicos360.dev
```

### Step 9: Run the operational seed

```bash
npm run db:seed:operational
```

Creates:
- Organization + Tenant
- Admin member (owner)
- Enterprise billing subscription
- Demo artist
- CRM Contact + Company + Tag
- Pipeline with 3 stages + 1 opportunity
- Campaign + task
- Capture form
- Draft contract
- Financial transaction

---

## Phase 18 — Validate Tenant Isolation

```bash
npm run verify:tenant-isolation
```

This script:
1. Creates 2 temporary tenants
2. Inserts data in each tenant
3. Attempts cross-tenant read, update and delete
4. Confirms that RLS blocks all cross-tenant access
5. Removes test data (automatic cleanup)

**Acceptance criterion**: 7/7 tests pass.

---

## Phase 19 — Real Integrations

### Status per integration

| Integration | Variable | Status | Notes |
|-----------|---------|--------|-------|
| Supabase Auth | `SUPABASE_URL` + `SUPABASE_ANON_KEY` | **REQUIRED** | JWT validation |
| Supabase DB | `DATABASE_URL` | **REQUIRED** | All operations |
| Redis/BullMQ | `REDIS_URL` | OPTIONAL | Degrades gracefully |
| Stripe | `STRIPE_SECRET_KEY` | OPTIONAL (billing) | Paid plans |
| Sentry | `SENTRY_DSN` | RECOMMENDED | Observability |
| Cloudflare R2 | `R2_ACCESS_KEY_ID` | OPTIONAL (uploads) | File storage |
| Anthropic | `ANTHROPIC_API_KEY` | OPTIONAL (AI) | AI features |
| ACRCloud | `ACRCLOUD_ACCESS_KEY` | OPTIONAL | Content detection |
| Spotify | `SPOTIFY_CLIENT_ID` | OPTIONAL | Streaming integration |
| Email | `RESEND_API_KEY` | RECOMMENDED | Notifications |

**For each integration, test connectivity:**
```bash
GET /api/v1/health
```

Full response:
```json
{
  "status": "ok",
  "info": {
    "database": { "status": "up" },
    "redis":    { "status": "up" },
    "storage":  { "status": "up" }
  }
}
```

If Redis is `down`, the API keeps running in degraded mode — acceptable.  
If the Database is `down`, the API fails completely — critical.

---

## Phase 20 — End-to-End Smoke Test

### Step 10: Get a real JWT

1. Frontend: log in with the user created in Step 7
2. In the browser DevTools → Network → any API request → copy the `Authorization: Bearer ...` header
3. Or via the Supabase SDK:
```javascript
const { data } = await supabase.auth.signInWithPassword({ email, password });
const token = data.session.access_token;
```

### Step 11: Run the smoke test

```bash
API_URL=http://localhost:3001 \
SMOKE_TOKEN=<real-jwt> \
SMOKE_TENANT=10000000-0000-0000-0000-000000000002 \
npm run smoke-test
```

The smoke test checks:
1. Health check 200
2. Protected endpoint without a token → 401
3. Analytics dashboard
4. List artists
5. Create artist
6. List pipelines
7. List CRM contacts
8. List campaigns
9. Analytics revenue
10. Submit public form
11. Cross-tenant blocked (RLS)
12. Audit trail
13. Conversations
14. Automatic cleanup

**Acceptance criterion**: all tests pass (tests marked `SKIP` are acceptable when credentials are missing).

### Step 12: Verify full provisioning

```bash
npm run provision
```

Runs in sequence: `verify:supabase` → `verify:rls` → `verify:tenant-isolation`

---

## Frontend — Configuration

### apps/web/.env.development

```bash
cp apps/web/.env.production apps/web/.env.development
# Edit with your real DEV VITE_* variables
```

Required variables for the frontend:
```
VITE_API_URL=http://localhost:3001/api/v1
VITE_SUPABASE_URL=https://REF.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

### Start the frontend

```bash
cd apps/web
npm run dev
```

The frontend will authenticate through Supabase Auth, obtain a JWT, and send it to the API in the `Authorization: Bearer <jwt>` and `X-Tenant-ID: <tenant-uuid>` headers.

---

## Final Provisioning Checklist

```
PHASE 16 — Database
  [ ] Supabase project created
  [ ] DATABASE_URL configured
  [ ] SUPABASE_URL + SUPABASE_ANON_KEY configured
  [ ] ENCRYPTION_KEY generated (64 hex)
  [ ] npm run db:migrate → no errors
  [ ] npm run verify:supabase → ✓ all green
  [ ] npm run verify:rls → ✓ all tables with RLS
  [ ] JWT Hook applied (supabase-jwt-hook.sql)

PHASE 17 — Operational Data
  [ ] User created in Supabase Auth
  [ ] SEED_ADMIN_SUB configured
  [ ] npm run db:seed:operational → data created
  [ ] Real login works in the frontend
  [ ] Dashboard loads real data

PHASE 18 — Tenant Isolation
  [ ] npm run verify:tenant-isolation → 7/7 tests pass
  [ ] Cross-tenant blocking confirmed

PHASE 19 — Integrations
  [ ] Supabase Auth: CONNECTED
  [ ] PostgreSQL: CONNECTED
  [ ] Redis: CONNECTED or OPTIONAL
  [ ] Stripe: CONFIGURED or PENDING (billing)
  [ ] Storage: CONFIGURED or PENDING
  [ ] Email: CONFIGURED or PENDING
  [ ] AI providers: CONFIGURED or PENDING
  [ ] GET /api/v1/health → status: ok

PHASE 20 — Smoke Test
  [ ] API starts without errors
  [ ] npm run smoke-test → all tests pass
  [ ] Real login works
  [ ] Artist CRUD works
  [ ] Pipeline kanban works
  [ ] CRM contacts work
  [ ] Public form submit works
  [ ] RLS blocks cross-tenant
  [ ] Logs appear in Sentry (if configured)
```

---

## Classification Status per Component

| Component | IMPLEMENTED | PROVISIONED | CONNECTED | TESTED | VALIDATED |
|-----------|:---:|:---:|:---:|:---:|:---:|
| Auth (Supabase JWT) | ✓ | Depends on .env.development | Depends on .env.development | ✓ | After smoke test |
| Database (PostgreSQL) | ✓ | After db:migrate | After verify | ✓ | After verify:supabase |
| RLS / Tenant Isolation | ✓ | After db:migrate | ✓ | After verify:rls | After verify:tenant-isolation |
| BullMQ / Redis | ✓ | OPTIONAL | OPTIONAL | ✓ | After health check |
| Billing / Stripe | ✓ | After .env.development config | After .env.development config | Partial | After webhook test |
| CRM Canonical | ✓ | After db:migrate | ✓ | ✓ | After smoke test |
| Pipelines | ✓ | After db:migrate | ✓ | ✓ | After smoke test |
| Campaigns | ✓ | After db:migrate | ✓ | ✓ | After smoke test |
| Analytics | ✓ | After db:migrate | ✓ | ✓ | After smoke test |
| AI Governance | ✓ | After db:migrate | OPTIONAL | ✓ | After AI key config |
| Conversations | ✓ | After db:migrate | ✓ | ✓ | After smoke test |
| Forms | ✓ | After db:migrate | ✓ | ✓ | After smoke test |
| Workflow Automation | ✓ | After db:migrate | ✓ | ✓ | After events test |
| Observability (Sentry) | ✓ | OPTIONAL | OPTIONAL | ✓ | After SENTRY_DSN config |

---

## Troubleshooting

**Problem: `DATABASE_URL: connection refused`**
- Check that the URL uses the correct Supabase host
- In dev without SSL: remove `?sslmode=require` from the URL

**Problem: `JWT validation failed`**
- Check `SUPABASE_URL` — it must be `https://REF.supabase.co` (no trailing `/`)
- Check that the token has not expired (1 hour by default)

**Problem: `RLS: permission denied for table`**
- Run `npm run verify:rls -- --fix` to apply the policies
- Check that `supabase-jwt-hook.sql` was executed

**Problem: `app.current_tenant_id not set`**
- Check the `TenantGuard` — the `X-Tenant-ID` header is required
- The frontend must send `X-Tenant-ID` on every authenticated request

**Problem: Coverage below threshold after seed**
- Run `npm run test:ci` — it must pass with 13+ suites
- Do not mix the seed with the test environment

**Problema: `ENCRYPTION_KEY must be 64 hex chars`**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
