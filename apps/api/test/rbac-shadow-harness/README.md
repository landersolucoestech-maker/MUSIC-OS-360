# RBAC SHADOW E2E Harness (STEP 12-J.5)

Generates **real authenticated HTTP traffic** against the **staging** API to populate
`rbac_decision_logs` (mode `RBAC_PERSISTED_AUTHORITY=SHADOW`) and to allow the GO/NO-GO
decision for the persisted-RBAC cutover.

> It does **not** insert/edit/delete rows in `rbac_decision_logs`. The API writes them by itself
> while processing each real request. It does **not** mock JWT/tenant/guards. **Never** commit secrets.

## Prerequisites
- API deployed to staging with the 12-J.3A instrumentation and `RBAC_PERSISTED_AUTHORITY=SHADOW`.
- Enterprise migrations 001-007 applied + `04_rbac_seed` (catalog 130 / 887 grants).
- **Real staging test users** (1 per role) who are **members** of at least 3 staging tenants.

## Configuration (.env, do not commit)
```env
STAGING_API_URL=https://staging-api.example.com
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=...

RBAC_HARNESS_TENANT_A=<tenant_id_A>
RBAC_HARNESS_TENANT_B=<tenant_id_B>
RBAC_HARNESS_TENANT_C=<tenant_id_C>

RBAC_HARNESS_OWNER_EMAIL=...      RBAC_HARNESS_OWNER_PASSWORD=...
RBAC_HARNESS_ADMIN_EMAIL=...      RBAC_HARNESS_ADMIN_PASSWORD=...
RBAC_HARNESS_MANAGER_EMAIL=...    RBAC_HARNESS_MANAGER_PASSWORD=...
RBAC_HARNESS_EDITOR_EMAIL=...     RBAC_HARNESS_EDITOR_PASSWORD=...
RBAC_HARNESS_VIEWER_EMAIL=...     RBAC_HARNESS_VIEWER_PASSWORD=...
# optional (preferred):
RBAC_HARNESS_ACCOUNTING_EMAIL=... RBAC_HARNESS_ACCOUNTING_PASSWORD=...
RBAC_HARNESS_ARTIST_EMAIL=...     RBAC_HARNESS_ARTIST_PASSWORD=...

# targets (optional; defaults in parentheses)
RBAC_HARNESS_TARGET_REQUESTS=5000   # (1000)
RBAC_HARNESS_TARGET_ENDPOINTS=20    # (10)
RBAC_HARNESS_TARGET_RESOURCES=5     # (5)
RBAC_HARNESS_TARGET_ROLES=5         # (5)
RBAC_HARNESS_TARGET_TENANTS=3       # (3)
```

## Running
```bash
# 1) generate real traffic (populates rbac_decision_logs through the API)
pnpm --filter @music-os-360/api rbac:shadow:run

# 2) decide GO/NO-GO (reads rbac_decision_logs, read-only)
DATABASE_URL=<staging_db_url> DB_SSL=false \
  pnpm --filter @music-os-360/api rbac:shadow:go-no-go
```

## What the runner does
1. Authenticates each role via **Supabase password grant** (real token).
2. For each `role x tenant x controller x action` of the matrix (`rbac-shadow-harness.matrix.ts`),
   sends a real request with the headers `Authorization`, `X-Tenant-ID`, `X-Request-ID`, `X-Trace-ID`.
3. Roles **without** permission run anyway and assert **403** (this produces a legitimate `DENY_MATCH`).
4. Repeats READS until the request target is reached.
5. Created resources carry the marker `metadata.testRunId` + `createdBy: rbac-shadow-harness`;
   the harness tries to **clean up through the API** (DELETE) at the end, respecting RBAC. Blocked cleanup is reported.
6. Saves a summary to `test/rbac-shadow-harness/out/harness-run-<runId>.json`.

## Approval criterion (applied by go-no-go)
```
requests>=1000 AND endpoints>=10 AND roles>=5 AND tenants>=3
AND would_allow=0 AND would_deny=0 AND cross_tenant=0 AND resolver_divergence=0
```
Met -> `APPROVED` (ready for ON). Otherwise -> `REJECTED` (keep SHADOW).

> Translation note: the original README named the verdicts `APROVADO - APTO PARA ON` /
> `REPROVADO - MANTER SHADOW`; the current `scripts/rbac-shadow-go-no-go.ts` emits
> `APPROVED` / `REJECTED` (exit 0 / exit 3), which is what is documented above.

## Security
- Real requests only; no bypass of Auth/Tenant/Roles/Permissions guards.
- No direct database manipulation. No secrets in the repository.
- Rolling back the cutover (after ON) is done by flag (`RBAC_PERSISTED_AUTHORITY=SHADOW`/`OFF`), instantly.
