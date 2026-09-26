/**
 * seeds/02_admin_user.ts
 *
 * Seed: creates the default development admin OrgMember.
 * Depends on 01_default_tenant.ts (org + tenant already exist).
 */

import { DataSource } from 'typeorm';
import type { SeedResult } from './01_default_tenant';

export async function seedAdminUser(
  ds: DataSource,
  tenant: SeedResult,
): Promise<void> {
  const { orgId, tenantId } = tenant;

  const adminSubjectId = process.env['SEED_ADMIN_SUB'] ?? '00000000-0000-0000-0000-000000000099';
  const adminEmail     = process.env['SEED_ADMIN_EMAIL'] ?? 'admin@musicos360.dev';
  const adminName      = process.env['SEED_ADMIN_NAME']  ?? 'Admin Dev (Seed)';

  // Dual-write (STEP 12-G): writes the legacy role AND the canonical role_id (global catalog subquery).
  await ds.query(`
    INSERT INTO org_members (org_id, tenant_id, auth_user_id, email, full_name, role, role_id, is_active)
    VALUES ($1, $2, $3, $4, $5, 'owner',
      (SELECT id FROM roles WHERE slug = 'owner' AND tenant_id IS NULL AND deleted_at IS NULL AND archived_at IS NULL LIMIT 1),
      TRUE)
    ON CONFLICT (tenant_id, auth_user_id) DO UPDATE
      SET role      = EXCLUDED.role,
          role_id   = EXCLUDED.role_id,
          is_active = TRUE
  `, [orgId, tenantId, adminSubjectId, adminEmail, adminName]);

  console.log(`  ✓ org_members: ${adminEmail} (role=owner, tenant=${tenantId})`);
}
