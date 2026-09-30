# Tenant Auth Flow

## Login

1. The user authenticates with Supabase.
2. Supabase issues a JWT.
3. The Custom Access Token Hook injects `app_metadata.org_id` and `app_metadata.role`.
4. The frontend stores the session via the Supabase SDK.
5. The API receives the Bearer token and validates it via JWKS.

## Tenant resolution

1. The API reads `request.auth.orgId`.
2. `TenantGuard` looks up `tenants.org_id`.
3. Membership is validated in `org_members.auth_user_id`.
4. The request receives `tenant` and `currentMember`.

## Isolation

Every multi-tenant service must filter by `tenant_id`. Activity logs, notifications, uploads and integrations must record ownership by tenant and user.
