/**
 * seeds/01_default_tenant.ts
 *
 * Seed inicial: cria a organização e tenant padrão de desenvolvimento.
 * Executado apenas em dev/staging — nunca em produção sem confirmação explícita.
 */

import { DataSource } from 'typeorm';

export interface SeedResult {
  orgId: string;
  tenantId: string;
  orgSlug: string;
}

export async function seedDefaultTenant(ds: DataSource): Promise<SeedResult> {
  const tenantId = process.env['SEED_TENANT_ID'] ?? '10000000-0000-0000-0000-000000000002';
  const orgId    = process.env['SEED_ORG_ID']    ?? tenantId;
  const orgSlug  = process.env['SEED_ORG_SLUG']  ?? 'musicos360-demo';

  // ── organizations ──────────────────────────────────────────────────────────
  const orgName    = process.env['SEED_ORG_NAME']  ?? 'MUSIC OS 360 Demo';
  const tenantName = process.env['SEED_ORG_NAME']  ?? 'MUSIC OS 360 Demo';

  await ds.query(`
    INSERT INTO organizations (id, name, slug, plan, billing_status, industry)
    VALUES ($1, $2, $3, 'enterprise', 'active', 'gravadora')
    ON CONFLICT (id) DO UPDATE
      SET name = EXCLUDED.name, slug = EXCLUDED.slug
  `, [orgId, orgName, orgSlug]);

  console.log(`  ✓ organizations: ${orgSlug} (${orgId})`);

  // ── tenants ────────────────────────────────────────────────────────────────
  await ds.query(`
    INSERT INTO tenants (id, org_id, name, slug, plan, active)
    VALUES ($1, $2, $3, $4, 'enterprise', TRUE)
    ON CONFLICT (id) DO UPDATE
      SET name = EXCLUDED.name, slug = EXCLUDED.slug, active = TRUE
  `, [tenantId, orgId, tenantName, orgSlug]);

  console.log(`  ✓ tenants: dev-tenant (${tenantId})`);

  // ── billing_subscriptions ──────────────────────────────────────────────────
  // tenant_id populated (not just org_id): upsertStripeSubscription (billing.service.ts)
  // keys its real Stripe-webhook upsert on UNIQUE(tenant_id) -- a seed-created row
  // left NULL there would never match that ON CONFLICT target, letting a later real
  // webhook insert a second row instead of updating this one.
  await ds.query(`
    INSERT INTO billing_subscriptions (org_id, tenant_id, plan, status, seats, seats_used)
    VALUES ($1, $2, 'enterprise', 'active', 25, 1)
    ON CONFLICT (org_id) DO NOTHING
  `, [orgId, tenantId]);

  console.log('  ✓ billing_subscriptions: enterprise/active');

  return { orgId, tenantId, orgSlug };
}
