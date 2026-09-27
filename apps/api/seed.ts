/**
 * seed.ts — initial data for development.
 *
 * Creates:
 *   - 1 organization "Music OS 360 Demo"
 *   - 1 tenant "Demo Label"
 *   - 1 billing subscription (trial)
 *
 * Usage:  cd apps/api && npx ts-node --transpile-only seed.ts
 */
import 'dotenv/config';
import { DataSource } from 'typeorm';
import { ALL_ENTITIES } from './src/database/entities';
import { assertDatabaseCommandEnv } from './src/core/config/env.schema';

const url = process.env.DATABASE_URL;

if (!url) {
  console.error('❌  Set DATABASE_URL in apps/api/.env.development');
  process.exit(1);
}

assertDatabaseCommandEnv('seed');

const ds = new DataSource({
  type:        'postgres',
  url,
  entities:    ALL_ENTITIES,
  synchronize: false,
  logging:     false,
  ssl:         process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function seed() {
  console.log('🌱  Starting seed...');
  await ds.initialize();
  const qr = ds.createQueryRunner();

  try {
    // ── 1. Organization ─────────────────────────────────────────────────────
    const existingOrg = await qr.query(
      `SELECT id FROM organizations WHERE slug = $1 LIMIT 1`,
      ['music-os-360-demo'],
    );

    let orgId: string;
    if (existingOrg.length > 0) {
      orgId = existingOrg[0].id;
      console.log('⏭️   Organization already exists:', orgId);
    } else {
      const [org] = await qr.query(
        `INSERT INTO organizations (name, slug, plan, billing_status, industry)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        ['Music OS 360 Demo', 'music-os-360-demo', 'professional', 'trial', 'gravadora'],
      );
      orgId = org.id;
      console.log('✅  Organization created:', orgId);
    }

    // ── 2. Tenant ────────────────────────────────────────────────────────────
    const existingTenant = await qr.query(
      `SELECT id FROM tenants WHERE slug = $1 LIMIT 1`,
      ['demo-label'],
    );

    let tenantId: string;
    if (existingTenant.length > 0) {
      tenantId = existingTenant[0].id;
      console.log('⏭️   Tenant already exists:', tenantId);
    } else {
      const features = JSON.stringify({
        artists: true, catalog: true, contracts: true, accounting: true,
        crm: true, marketing: true, events: true, projects: true,
        releases: true, monitoring: true, analytics: true, support: true, ai: true,
      });
      const settings = JSON.stringify({
        timezone: 'America/Sao_Paulo', locale: 'pt-BR', currency: 'BRL',
      });
      const [tenant] = await qr.query(
        `INSERT INTO tenants (org_id, name, slug, plan, features, settings, active)
         VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7)
         RETURNING id`,
        [orgId, 'Demo Label', 'demo-label', 'professional', features, settings, true],
      );
      tenantId = tenant.id;
      console.log('✅  Tenant created:', tenantId);
    }

    // ── 3. Billing Subscription ───────────────────────────────────────────────
    const existingBilling = await qr.query(
      `SELECT id FROM billing_subscriptions WHERE org_id = $1 LIMIT 1`,
      [orgId],
    );

    if (existingBilling.length > 0) {
      console.log('⏭️   Billing subscription already exists:', existingBilling[0].id);
    } else {
      const trialEnd = new Date();
      trialEnd.setDate(trialEnd.getDate() + 14);
      const [billing] = await qr.query(
        `INSERT INTO billing_subscriptions (org_id, plan, status, trial_ends_at, seats, seats_used)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [orgId, 'professional', 'trial', trialEnd, 10, 1],
      );
      console.log('✅  Billing subscription created:', billing.id);
    }

    console.log('\n🎉  Seed finished!');
    console.log('    org_id:    ', orgId);
    console.log('    tenant_id: ', tenantId);

  } finally {
    await qr.release();
    await ds.destroy();
  }
}

seed().catch((err) => {
  console.error('❌  Seed failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
