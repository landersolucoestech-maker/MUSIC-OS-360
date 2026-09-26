// ─────────────────────────────────────────────────────────────────────────────
// SECURITY-SENSITIVE — Auth bypass switch.
//
// AUTH_DISABLED bypasses JwtAuthGuard / TenantGuard / RolesGuard / RateLimitGuard.
// It is honored ONLY when BOTH conditions hold:
//   1. explicit opt-in via env: AUTH_DISABLED=true
//   2. NODE_ENV is exactly 'development'
// Staging/production are ALWAYS fail-closed (guards enforced), regardless of env.
// A hard bootstrap guard in main.ts additionally aborts startup if someone sets
// AUTH_DISABLED=true in production.
// ─────────────────────────────────────────────────────────────────────────────
import { isProdLike } from './config/runtime-environment';
import {
  TENANT_ZERO_AUTH_DISABLED_IDENTITY,
  TENANT_ZERO_NAME,
  TENANT_ZERO_SLUG,
  TENANT_ZERO_SYNTHETIC_OWNER_EMAIL,
  TENANT_ZERO_SYNTHETIC_OWNER_NAME,
} from '../database/tenant-zero.constants';

const NODE_ENV = process.env.NODE_ENV ?? 'development';
const IS_DEVELOPMENT = NODE_ENV === 'development' && !isProdLike(NODE_ENV);
const AUTH_DISABLE_REQUESTED = process.env.AUTH_DISABLED === 'true';

export const AUTH_DISABLED = AUTH_DISABLE_REQUESTED && IS_DEVELOPMENT;

if (AUTH_DISABLED) {
  // eslint-disable-next-line no-console
  console.warn(
    `[SECURITY] AUTH_DISABLED is ACTIVE — authentication, tenant and RBAC guards are BYPASSED. ` +
      `Permitted only because NODE_ENV='${NODE_ENV}' (non-production). NEVER enable in production.`,
  );
}

// Tenant/org used by the bypass. By default they point to the real tenant-zero
// (LANDER RECORDS — single source of truth: tenant-zero.constants.ts), so
// that AUTH_DISABLED operates on real data instead of an empty workspace.
// Overridable via env (DEV_TENANT_ID / DEV_ORG_ID) when a dev
// needs to point to another local tenant. Honored only outside
// production, under the same conditions as AUTH_DISABLED above.
const DEV_TENANT_ID = process.env.DEV_TENANT_ID ?? TENANT_ZERO_AUTH_DISABLED_IDENTITY.tenantId;
const DEV_ORG_ID = process.env.DEV_ORG_ID ?? TENANT_ZERO_AUTH_DISABLED_IDENTITY.orgId;
const DEV_USER_ID = TENANT_ZERO_AUTH_DISABLED_IDENTITY.syntheticOwnerAuthUserId;

export const DEV_AUTH = {
  userId: DEV_USER_ID,
  sessionId: "dev-auth-disabled-session",
  orgId: DEV_ORG_ID,
  orgRole: "owner",
  claims: {
    sub: DEV_USER_ID,
    app_metadata: {
      org_id: DEV_ORG_ID,
      role: "owner",
    },
  },
};

export const DEV_TENANT = {
  id: DEV_TENANT_ID,
  org_id: DEV_ORG_ID,
  external_auth_org_id: DEV_ORG_ID,
  name: TENANT_ZERO_NAME,
  slug: TENANT_ZERO_SLUG,
  active: true,
  plan: "enterprise",
};

export const DEV_MEMBER = {
  id: "00000000-0000-4000-8000-000000000002",
  tenant_id: DEV_TENANT.id,
  org_id: DEV_TENANT.org_id,
  auth_user_id: DEV_AUTH.userId,
  email: TENANT_ZERO_SYNTHETIC_OWNER_EMAIL,
  full_name: TENANT_ZERO_SYNTHETIC_OWNER_NAME,
  role: "owner",
  is_active: true,
};
