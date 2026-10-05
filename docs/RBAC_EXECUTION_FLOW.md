# RBAC Execution Flow

## Actual Pipeline

Global order registered in `AppModule`:

1. `RateLimitGuard`
2. `JwtAuthGuard`
3. `MustChangePasswordGuard`
4. `TenantGuard`
5. `BillingEnforcementGuard`
6. `RolesGuard`
7. `PermissionsGuard`
8. interceptors for RLS context, metrics, auditing and the handler

`RequestIdMiddleware` and `CorrelationMiddleware` run before the guards.
Every request receives a `requestId` and a `traceId`; valid `traceparent`,
`X-Trace-ID`, `X-Correlation-ID` and `X-Request-ID` headers are propagated.

## Sources Of Authority

- ACTIVE: `RolesGuard`, using `org_members.role`, `@RequireRole` and the
  legacy hierarchy.
- SHADOW: `PermissionResolverService.resolvePersisted`, using
  `org_members.role_id`, `roles`, `role_inheritance`, `role_permissions`,
  `permissions` and active dependencies.
- `RBAC_PERSISTED_AUTHORITY=SHADOW` does not change the HTTP response.
- `RbacService.getEffectivePermissions` keeps a legacy fallback only for
  compatibility consumers. The SHADOW evaluator does not use this fallback,
  which avoids false matches when the database or `role_id` is unavailable.

## Decision Order

Routes with `@RequirePermission`:

1. `RolesGuard` computes ACTIVE.
2. If ACTIVE denies, it runs and persists SHADOW before throwing 403.
3. If ACTIVE allows, it stores the state on the request.
4. `PermissionsGuard` runs SHADOW, compares and persists.
5. In SHADOW mode, the response is still ACTIVE.

Possible outcomes: `ALLOW_MATCH`, `DENY_MATCH`, `WOULD_ALLOW` and
`WOULD_DENY`.

Routes with only `@RequireRole` would not change once `PermissionsGuard` is
activated; they remain under the legacy hierarchy and do not produce a
permission comparison. This coverage gap must stay visible in the inventory
before any promotion.

## Tenant And Membership

`TenantGuard` requires:

- a JWT with `app_metadata.org_id`;
- an `X-Tenant-ID` compatible with the resolved tenant;
- an active membership for `(tenant_id, auth_user_id)`.

Bootstrap uses `ADMIN_DATA_SOURCE` only for pre-RLS identity. Tenant and
membership share a Redis cache with a 60-second TTL. Membership mutations
invalidate the shared key. Without Redis, the guard queries
PostgreSQL directly.

## Cache

- L1: per-instance local map, 60-second TTL.
- L2: Redis under `rbac:value:*`.
- Invalidation index: `rbac:role:{roleId}:keys`.
- Pub/sub channel: `rbac:cache:invalidate`.
- Mutations of roles, grants, inheritance, dependencies and conflicts
  invalidate descendant roles and all instances.
- A Redis failure degrades to PostgreSQL/L1 and is sent to Sentry as
  `cache_failure`.

## Persistence And Auditing

Each evaluated permission produces a row in `rbac_decision_logs`, partitioned by
`created_at`, with indexes on time, tenant, user, role, request, resource and
action. Retention is configured by `RBAC_DECISION_RETENTION_DAYS`.

The same event produces append-only entries in `audit_logs` for the decision,
divergence and cache. Persistence failures never change the authorization.

## Observability

- Prometheus: `rbac_requests_total`, `rbac_allow_total`, `rbac_deny_total`,
  `rbac_would_allow_total`, `rbac_would_deny_total`,
  `rbac_cache_hit_total`, `rbac_cache_miss_total`, `rbac_latency_ms`.
- Grafana: `infra/observability/grafana/dashboards/rbac-shadow.json`.
- Sentry: `would_allow`, `would_deny`, `authorization_failure`,
  `cache_failure`, `resolver_failure`.
- Real readiness: `pnpm --filter @music-os-360/api rbac:readiness`.

## Actual Fallbacks

- Invalid JWT: 401, no RBAC.
- Missing tenant/membership: 401/403.
- Persisted resolver unavailable: SHADOW records DENY and
  `resolver_failure`; ACTIVE remains in force.
- Redis unavailable: query PostgreSQL.
- Telemetry unavailable: the decision proceeds, the error is logged/sent to Sentry.
- `ON` mode: not activated by this implementation.
