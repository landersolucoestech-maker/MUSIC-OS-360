/**
 * seed.mjs — initial data for development.
 *
 * Creates:
 *   - 1 organization "Music OS 360 Demo"
 *   - 1 tenant "Demo Label"
 *   - 1 billing subscription (14-day trial)
 *
 * Usage: node seed.mjs
 */
import { neon } from '@neondatabase/serverless';

const url =
  process.env.DIRECT_DATABASE_URL ??
  process.env.DATABASE_URL;

if (!url) {
  console.error('❌  Defina DIRECT_DATABASE_URL ou DATABASE_URL');
  process.exit(1);
}

const sql = neon(url);

async function seed() {
  console.log('🌱  A iniciar seed...');

  // ── 1. Organization ────────────────────────────────────────────────────────
  const existingOrgs = await sql`
    SELECT id FROM organizations WHERE slug = 'music-os-360-demo' LIMIT 1
  `;

  let orgId;
  if (existingOrgs.length > 0) {
    orgId = existingOrgs[0].id;
    console.log('⏭️   Organização já existe:', orgId);
  } else {
    const inserted = await sql`
      INSERT INTO organizations (name, slug, plan, billing_status, industry)
      VALUES ('Music OS 360 Demo', 'music-os-360-demo', 'professional', 'trial', 'gravadora')
      RETURNING id
    `;
    orgId = inserted[0].id;
    console.log('✅  Organização criada:', orgId);
  }

  // ── 2. Tenant ──────────────────────────────────────────────────────────────
  const existingTenants = await sql`
    SELECT id FROM tenants WHERE slug = 'demo-label' LIMIT 1
  `;

  let tenantId;
  if (existingTenants.length > 0) {
    tenantId = existingTenants[0].id;
    console.log('⏭️   Tenant já existe:', tenantId);
  } else {
    const features = {
      artists: true, catalog: true, contracts: true, accounting: true,
      crm: true, marketing: true, events: true, projects: true,
      releases: true, monitoring: true, analytics: true, support: true, ai: true,
    };
    const settings = {
      timezone: 'America/Sao_Paulo', locale: 'pt-BR', currency: 'BRL',
    };
    const inserted = await sql`
      INSERT INTO tenants (org_id, name, slug, plan, features, settings, active)
      VALUES (
        ${orgId},
        'Demo Label',
        'demo-label',
        'professional',
        ${JSON.stringify(features)},
        ${JSON.stringify(settings)},
        true
      )
      RETURNING id
    `;
    tenantId = inserted[0].id;
    console.log('✅  Tenant criado:', tenantId);
  }

  // ── 3. Billing Subscription ────────────────────────────────────────────────
  const existingBilling = await sql`
    SELECT id FROM billing_subscriptions WHERE org_id = ${orgId} LIMIT 1
  `;

  if (existingBilling.length > 0) {
    console.log('⏭️   Billing subscription já existe:', existingBilling[0].id);
  } else {
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 14);

    const inserted = await sql`
      INSERT INTO billing_subscriptions (org_id, plan, status, trial_ends_at, seats, seats_used)
      VALUES (${orgId}, 'professional', 'trial', ${trialEnd.toISOString()}, 10, 1)
      RETURNING id
    `;
    console.log('✅  Billing subscription criada:', inserted[0].id);
  }

  console.log('\n🎉  Seed concluído!');
  console.log('    org_id:    ', orgId);
  console.log('    tenant_id: ', tenantId);
}

seed().catch((err) => {
  console.error('❌  Seed falhou:', err instanceof Error ? err.message : err);
  process.exit(1);
});
