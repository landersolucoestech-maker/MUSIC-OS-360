# RBAC Architecture

## Permission origin

The operational role comes from `org_members.role`. The JWT carries `app_metadata.role` for UX and shortcuts, but the backend must trust the active membership loaded from the database.

## Flow

1. `JwtAuthGuard` validates the token.
2. `TenantGuard` finds the tenant by the token's `org_id`.
3. `TenantGuard` finds the active membership by `tenant_id` and `auth_user_id`.
4. `RolesGuard` compares the role with `@RequireRole`.

## Risks to track

- Claims that are stale until the token is refreshed.
- Endpoints without a tenant-aware filter.
- Public routes with more access than necessary.
- WebSocket and realtime without the same validation as HTTP.
