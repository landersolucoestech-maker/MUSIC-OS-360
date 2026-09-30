# Auth Architecture

## Single source

Supabase Auth is the only source of authentication for MUSIC OS 360.

## Frontend

- `AuthContext` hydrates the session via the Supabase SDK.
- The Supabase access token is sent as a Bearer token on HTTP calls.
- Logout must clear the session, the query cache and sensitive tenant state.
- Relevant claims: `sub`, `email`, `app_metadata.org_id`, `app_metadata.role`.

## Backend

- `JwtAuthGuard` validates the JWT via Supabase's public JWKS.
- `request.auth.userId` receives the `sub`.
- `request.auth.orgId` receives `app_metadata.org_id`.
- `TenantGuard` loads the tenant and the active membership.
- `RolesGuard` applies RBAC based on `currentMember.role`.

## Database

- `org_members.auth_user_id` stores the Supabase `sub`.
- `organizations.external_auth_org_id` and `tenants.external_auth_org_id` are reserved for non-canonical external identifiers.
