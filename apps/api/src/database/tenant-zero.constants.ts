/**
 * tenant-zero.constants.ts  (Part 69 — formalization of tenant-zero)
 *
 * LANDER RECORDS is the initial institutional tenant ("tenant-zero") of
 * MUSIC OS 360: it must exist before the ordinary tenants, with a stable,
 * deterministic identity — not a UUID drawn per environment, not a
 * string scattered across multiple files.
 *
 * Adopted strategy — UUID v5 (namespace-derived, deterministic):
 *   TENANT_ZERO_ORG_ID / TENANT_ZERO_TENANT_ID are derived via
 *   uuidv5(seed, MUSICOS360_NAMESPACE_UUID). The same seed + the same
 *   namespace produce, by the definition of UUIDv5 (RFC 4122 §4.3, SHA-1),
 *   always the same UUID — in DEV, STAGING and PROD, without having to copy a
 *   literal manually between environments and without risk of two runs
 *   diverging. `tenant-zero.constants.spec.ts` proves determinism via
 *   independent recomputation.
 *
 * MUSICOS360_NAMESPACE_UUID was generated only once (crypto.randomUUID())
 * and is frozen — it must never be regenerated; regenerating it would change all
 * the IDs derived from it.
 *
 * This is the ONLY source of truth for the tenant-zero identity. No
 * other file may declare a UUID, slug or equivalent string for
 * LANDER RECORDS — always import from here.
 *
 * Important: tenant-zero is an ordinary tenant for RLS/RBAC/billing purposes.
 * These constants identify WHICH row is tenant-zero — they do not
 * grant, by themselves, any privilege. No RLS policy, no
 * RBAC guard and no billing rule may compare against these
 * values; the only legitimate readers of the three raw ID symbols are the
 * bootstrap (`bootstrap-tenant-zero.ts`, which uses them to create/validate the
 * row) and this module itself, which repackages them into
 * TENANT_ZERO_AUTH_DISABLED_IDENTITY for the dev-only authentication bypass
 * (`core/auth-disabled.ts`) — never an authorization comparison.
 */
import { v5 as uuidv5 } from 'uuid';

/** Frozen — never regenerate. See the docstring above. */
const MUSICOS360_NAMESPACE_UUID = '142d39d6-8454-4ba1-b2f0-695b120ae83f';

export const TENANT_ZERO_SLUG = 'lander-records';
export const TENANT_ZERO_NAME = 'LANDER RECORDS';

export const TENANT_ZERO_ORG_ID = uuidv5(`${TENANT_ZERO_SLUG}:organization`, MUSICOS360_NAMESPACE_UUID);
export const TENANT_ZERO_TENANT_ID = uuidv5(`${TENANT_ZERO_SLUG}:tenant`, MUSICOS360_NAMESPACE_UUID);

/**
 * Synthetic identity of the initial owner — used only in DEV/STAGING by the
 * bootstrap (never in production, where a real owner must be provided via
 * env — see bootstrap-tenant-zero.ts). Deterministic for the same reason as the
 * IDs above: it must be stable across bootstrap runs, not a
 * new UUID on every round.
 */
export const TENANT_ZERO_SYNTHETIC_OWNER_AUTH_USER_ID = uuidv5(`${TENANT_ZERO_SLUG}:synthetic-owner`, MUSICOS360_NAMESPACE_UUID);
export const TENANT_ZERO_SYNTHETIC_OWNER_EMAIL = 'owner@lander-records.example.com';
export const TENANT_ZERO_SYNTHETIC_OWNER_NAME = 'LANDER RECORDS (Owner Sintético — DEV/STAGING)';

/**
 * Identity packaged for the AUTH_DISABLED mode (dev-only authentication
 * bypass — see core/auth-disabled.ts). It exists as a separate object, and
 * not as a direct export of the three raw symbols above, so that
 * `tenant-zero-no-special-case.spec.ts` keeps guaranteeing that no other
 * file in the system (RLS, RBAC, billing, guards) references
 * TENANT_ZERO_ORG_ID/TENANT_ZERO_TENANT_ID/TENANT_ZERO_SYNTHETIC_OWNER_AUTH_USER_ID
 * directly — only the bootstrap and this package read them.
 */
export const TENANT_ZERO_AUTH_DISABLED_IDENTITY = {
  orgId: TENANT_ZERO_ORG_ID,
  tenantId: TENANT_ZERO_TENANT_ID,
  syntheticOwnerAuthUserId: TENANT_ZERO_SYNTHETIC_OWNER_AUTH_USER_ID,
};

/** Audit reason recorded on every tenant-zero bootstrap event. */
export const TENANT_ZERO_AUDIT_ACTION_CREATED = 'tenant.bootstrap.system_tenant_created';
export const TENANT_ZERO_AUDIT_ACTION_VERIFIED = 'tenant.bootstrap.system_tenant_verified';
