# PHASE 4 — Enterprise-Grade Operational Audit

## What & Why
The system has a basic `AuditLogEntity` and `AuditInterceptor`, but coverage is incomplete: `correlation_id` is missing, `org_id` is missing (only `tenant_id`), automatic `before`/`after` on critical mutations is missing, and the billing/permissions/settings entities are not covered. This phase implements a complete audit trail that is append-only, tenant-safe and prepared for future compliance (LGPD, SOC2).

## Done looks like
- `AuditLogEntity` expanded with: `org_id`, `correlation_id`, `session_id`, `actor_role`, `http_method`, `http_path`, a `diff` field (only changed fields, not the full snapshot when irrelevant)
- `AuditInterceptor` automatically captures `before` (pre-load of the entity) and `after` (post-mutation) for all endpoints decorated with `@Audit()`
- Mandatory coverage implemented in:
  - `contracts` — every create/edit/signature/cancellation
  - `releases` — every status transition
  - `artists` — creation, editing of sensitive data, deactivation
  - `billing` — plan change, cancellation, subscription update
  - `permissions/roles` — any change to a member's role
  - `settings` — tenant configuration changes
  - `integrations` — connection/disconnection of platforms
  - `uploads` — upload and deletion of critical assets
  - `campaigns` — creation and budget changes
- The audit is append-only: no UPDATE or DELETE on the `audit_logs` table
- Isolation per tenant: audit queries are always filtered by `tenant_id`
- `GET /audit-logs` endpoint with filters by entity_type, entity_id, actor_id, date range — access restricted to OWNER/ADMIN
- Frontend: Audit Trail page under Settings > "Segurança" (Security) displaying the history with a visual diff (before/after)
- `correlation_id` propagated from PHASE 3 linked to the corresponding audit logs

## Out of scope
- Export of audit logs to an external SIEM
- Automatic retention with TTL (future infrastructure)
- Cryptographic signing of logs

## Steps
1. **Expand AuditLogEntity** — Add columns: `org_id UUID`, `correlation_id VARCHAR(255)`, `session_id VARCHAR(255)`, `actor_role VARCHAR(50)`, `http_method VARCHAR(10)`, `http_path TEXT`, `diff JSONB` (only modified fields). Create the migration.
2. **Refactor AuditInterceptor** — Implement automatic capture of `before`: before the handler, SELECT the current entity by ID (when available in the request params). Capture `after` in the response. Compute `diff` as an object of modified fields. Read `correlation_id` from AsyncLocalStorage (PHASE 3).
3. **Annotate controllers with @Audit()** — Add the `@Audit('entity.action')` decorator to all critical endpoints of the modules: contracts, releases, artists, billing, settings, integrations, uploads. Verify that `AuditModule` is imported globally.
4. **Create the GET /audit-logs endpoint** — Controller with filters: `entity_type`, `entity_id`, `actor_id`, `from_date`, `to_date`, `action`, `tenant_id`. Paginated. Protected by `@Roles('OWNER', 'ADMIN')`.
5. **Implement the Audit Trail page in the frontend** — In `apps/web/src/modules/settings/pages/`, create `AuditTrail.tsx` with a log table, filters by entity and date, and row expansion to see the before/after diff. Route: `/settings/audit`.
6. **Guarantee append-only at the repository layer** — In `AuditService`, remove any update/delete method. Add a database constraint (trigger or policy) that prevents UPDATE/DELETE on the table.

## Relevant files
- `apps/api/src/core/interceptors/audit.interceptor.ts`
- `apps/api/src/database/entities.ts`
- `apps/api/src/core/audit/audit.service.ts`
- `apps/api/src/modules/contracts/contracts.controller.ts`
- `apps/api/src/modules/releases/releases.controller.ts`
- `apps/web/src/modules/settings/pages/`
- `apps/web/src/app/routes/`
