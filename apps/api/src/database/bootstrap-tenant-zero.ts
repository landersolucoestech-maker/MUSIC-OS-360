/**
 * bootstrap-tenant-zero.ts  (Part 69 — formalization of tenant-zero)
 *
 * Creates or validates LANDER RECORDS — the initial institutional tenant of
 * MUSIC OS 360 — idempotently. Deliberately separate from the generic seed
 * runner (`seeds/index.ts`): LANDER RECORDS is not a disposable
 * fixture, so it must not depend on generic seed flags nor be
 * confused with the demo tenant created by `01_default_tenant.ts`.
 *
 * This module exposes the pure function `bootstrapTenantZero(ds)` — no connection
 * I/O — so it can be unit tested without a real Postgres. The real CLI
 * (`npm run db:bootstrap:tenant-zero`, flags: `--force` for production) lives
 * in `bootstrap-tenant-zero.cli.ts`.
 *
 * Guarantees:
 *  - Never runs against the MAIN Supabase branch, with or without --force.
 *  - Idempotent: running twice neither duplicates nor diverges the identity.
 *  - Never promotes an existing tenant/organization other than the canonical
 *    ID to tenant-zero (the partial UNIQUE INDEX of migration
 *    20260801000002 blocks that at the database level; this script also
 *    validates beforehand, for a readable error message).
 *  - Grants no RLS/RBAC/billing bypass — the row created is an ordinary
 *    tenant/organization with `plan='enterprise'`,
 *    `billing_status='active'` (the same billing path used by
 *    any real enterprise customer, not a special exemption).
 *  - In production, requires a real owner (fails if absent) — never creates the
 *    DEV/STAGING synthetic owner in production.
 *  - Outside production, a real owner (`realOwner`) is optional — when
 *    provided (e.g. TENANT_ZERO_OWNER_EMAIL set, see
 *    bootstrap-tenant-zero.cli.ts), it replaces the synthetic one even in DEV/
 *    STAGING. Only on the row's first creation, it also seeds
 *    `tenants.settings.onboarding.completed = false` so the real owner's first
 *    login lands in the company setup wizard that already
 *    exists in the frontend (never resets it on reruns).
 */
import type { DataSource } from 'typeorm';
import {
  TENANT_ZERO_ORG_ID,
  TENANT_ZERO_TENANT_ID,
  TENANT_ZERO_SLUG,
  TENANT_ZERO_NAME,
  TENANT_ZERO_SYNTHETIC_OWNER_AUTH_USER_ID,
  TENANT_ZERO_SYNTHETIC_OWNER_EMAIL,
  TENANT_ZERO_SYNTHETIC_OWNER_NAME,
  TENANT_ZERO_AUDIT_ACTION_CREATED,
  TENANT_ZERO_AUDIT_ACTION_VERIFIED,
} from './tenant-zero.constants';

export interface BootstrapTenantZeroResult {
  orgId: string;
  tenantId: string;
  created: boolean;
}

/**
 * Real tenant-zero owner — must already exist as a real Supabase Auth
 * user (see bootstrap-tenant-zero.cli.ts, which creates/finds that user
 * and sets app_metadata.must_change_password=true before calling this
 * function). This pure function never talks to the Supabase API — it only writes the
 * relational rows that point to the already existing auth_user_id.
 */
export interface RealOwnerInput {
  authUserId: string;
  email: string;
  fullName?: string | null;
}

class TenantZeroInvariantError extends Error {}

/**
 * Fails loud and clear if a row other than the canonical ID has already claimed
 * `is_system_tenant = true` — it never silently "wins" by execution
 * order. The migration's partial UNIQUE INDEX guarantees this in the database;
 * this check only exists to give a readable error before attempting the INSERT.
 */
async function assertNoConflictingSystemTenant(ds: DataSource, table: 'organizations' | 'tenants', canonicalId: string): Promise<void> {
  const rows = await ds.query(
    `SELECT id FROM ${table} WHERE is_system_tenant = true AND id != $1 LIMIT 1`,
    [canonicalId],
  );
  if (rows.length > 0) {
    throw new TenantZeroInvariantError(
      `${table}.id=${rows[0].id} is already marked is_system_tenant=true, but differs from the canonical tenant-zero ID (${canonicalId}). ` +
      'Never promote an existing tenant by name/slug — fix it manually before running the bootstrap again.',
    );
  }
}

/**
 * If the canonical row already exists, validates that its identity (name/slug)
 * is still the expected one — never silently overwrites a tenant that
 * may already exist with this ID but with divergent data.
 */
async function assertIdentityMatchesIfExists(
  ds: DataSource,
  table: 'organizations' | 'tenants',
  canonicalId: string,
): Promise<{ exists: boolean }> {
  const rows = await ds.query(`SELECT slug, name FROM ${table} WHERE id = $1`, [canonicalId]);
  if (rows.length === 0) return { exists: false };
  const row = rows[0] as { slug: string; name: string };
  if (row.slug !== TENANT_ZERO_SLUG) {
    throw new TenantZeroInvariantError(
      `${table}.id=${canonicalId} exists but with slug="${row.slug}" (expected "${TENANT_ZERO_SLUG}"). ` +
      'Diverging identity — resolve it manually; the bootstrap does not overwrite slugs.',
    );
  }
  return { exists: true };
}

export async function bootstrapTenantZero(ds: DataSource, realOwner?: RealOwnerInput | null): Promise<BootstrapTenantZeroResult> {
  await assertNoConflictingSystemTenant(ds, 'organizations', TENANT_ZERO_ORG_ID);
  await assertNoConflictingSystemTenant(ds, 'tenants', TENANT_ZERO_TENANT_ID);

  const { exists: orgExists } = await assertIdentityMatchesIfExists(ds, 'organizations', TENANT_ZERO_ORG_ID);
  await assertIdentityMatchesIfExists(ds, 'tenants', TENANT_ZERO_TENANT_ID);

  const created = !orgExists;
  const isProduction = (process.env['NODE_ENV'] ?? 'development') === 'production';

  if (isProduction && !realOwner) {
    throw new TenantZeroInvariantError(
      'In production, a real owner (RealOwnerInput) is required — the synthetic DEV/STAGING owner is never created in production.',
    );
  }

  await ds.query(
    `
    INSERT INTO organizations (id, name, slug, plan, billing_status, industry, is_system_tenant)
    VALUES ($1, $2, $3, 'enterprise', 'active', 'gravadora', true)
    ON CONFLICT (id) DO UPDATE
      SET name = EXCLUDED.name, slug = EXCLUDED.slug, is_system_tenant = true
    `,
    [TENANT_ZERO_ORG_ID, TENANT_ZERO_NAME, TENANT_ZERO_SLUG],
  );

  // `settings` is only set on INSERT (never on the ON CONFLICT UPDATE) — so
  // bootstrap reruns never reset the onboarding progress the real owner
  // has already made. Only seeds incomplete onboarding when a real owner
  // is being assigned — the synthetic owner does not go through the wizard.
  const initialTenantSettings = realOwner
    ? JSON.stringify({ onboarding: { completed: false, currentStep: 'company_profile' } })
    : JSON.stringify({});

  await ds.query(
    `
    INSERT INTO tenants (id, org_id, name, slug, plan, active, is_system_tenant, settings)
    VALUES ($1, $2, $3, $4, 'enterprise', TRUE, true, $5::jsonb)
    ON CONFLICT (id) DO UPDATE
      SET name = EXCLUDED.name, slug = EXCLUDED.slug, active = TRUE, is_system_tenant = true
    `,
    [TENANT_ZERO_TENANT_ID, TENANT_ZERO_ORG_ID, TENANT_ZERO_NAME, TENANT_ZERO_SLUG, initialTenantSettings],
  );

  // Billing: the same normal path as any active enterprise tenant — it is not
  // a `manual_override`/special exemption (see the module docstring).
  // tenant_id populated (not only org_id): upsertStripeSubscription
  // (billing.service.ts) does a real Stripe webhook upsert keyed on
  // UNIQUE(tenant_id) -- a row with a NULL tenant_id would never match that
  // ON CONFLICT, letting a real webhook insert a second row instead
  // of updating this one.
  await ds.query(
    `
    INSERT INTO billing_subscriptions (org_id, tenant_id, plan, status, seats, seats_used)
    VALUES ($1, $2, 'enterprise', 'active', 25, 1)
    ON CONFLICT (org_id) DO NOTHING
    `,
    [TENANT_ZERO_ORG_ID, TENANT_ZERO_TENANT_ID],
  );

  if (realOwner) {
    await ds.query(
      `
      INSERT INTO org_members (org_id, tenant_id, auth_user_id, email, full_name, role, role_id, is_active)
      VALUES ($1, $2, $3, $4, $5, 'owner',
        (SELECT id FROM roles WHERE slug = 'owner' AND tenant_id IS NULL AND deleted_at IS NULL AND archived_at IS NULL LIMIT 1),
        TRUE)
      ON CONFLICT (tenant_id, auth_user_id) DO UPDATE
        SET role = EXCLUDED.role, role_id = EXCLUDED.role_id, is_active = TRUE
      `,
      [TENANT_ZERO_ORG_ID, TENANT_ZERO_TENANT_ID, realOwner.authUserId, realOwner.email, realOwner.fullName ?? null],
    );
  } else {
    await ds.query(
      `
      INSERT INTO org_members (org_id, tenant_id, auth_user_id, email, full_name, role, role_id, is_active)
      VALUES ($1, $2, $3, $4, $5, 'owner',
        (SELECT id FROM roles WHERE slug = 'owner' AND tenant_id IS NULL AND deleted_at IS NULL AND archived_at IS NULL LIMIT 1),
        TRUE)
      ON CONFLICT (tenant_id, auth_user_id) DO UPDATE
        SET role = EXCLUDED.role, role_id = EXCLUDED.role_id, is_active = TRUE
      `,
      [TENANT_ZERO_ORG_ID, TENANT_ZERO_TENANT_ID, TENANT_ZERO_SYNTHETIC_OWNER_AUTH_USER_ID, TENANT_ZERO_SYNTHETIC_OWNER_EMAIL, TENANT_ZERO_SYNTHETIC_OWNER_NAME],
    );
  }

  await ds.query(
    `
    INSERT INTO audit_logs (tenant_id, org_id, actor_role, action, entity, entity_id, after)
    VALUES ($1::uuid, $1::uuid, 'system', $2, 'organizations', $1::text, $3::jsonb)
    `,
    [
      TENANT_ZERO_ORG_ID,
      created ? TENANT_ZERO_AUDIT_ACTION_CREATED : TENANT_ZERO_AUDIT_ACTION_VERIFIED,
      JSON.stringify({
        name: TENANT_ZERO_NAME,
        slug: TENANT_ZERO_SLUG,
        is_system_tenant: true,
        owner_type: realOwner ? 'real' : 'synthetic',
      }),
    ],
  );

  return { orgId: TENANT_ZERO_ORG_ID, tenantId: TENANT_ZERO_TENANT_ID, created };
}
