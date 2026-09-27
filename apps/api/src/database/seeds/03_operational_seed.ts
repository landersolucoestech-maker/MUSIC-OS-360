/**
 * seeds/03_operational_seed.ts
 *
 * Minimal operational seed to validate the platform without recreating the legacy CRM.
 */

import { DataSource } from 'typeorm';
import type { SeedResult } from './01_default_tenant';

/**
 * Reuses the org/tenant that seedDefaultTenant already created (via its
 * returned SeedResult) instead of guessing its own IDs from independent env
 * vars. Those defaults previously disagreed with 01_default_tenant.ts's
 * (org ...001 here vs org == tenant ...002 there) -- wiring both into the
 * same runner without this would have inserted a second, orphaned
 * organizations row and silently reassigned the seeded tenant's org_id to
 * point at it.
 */
export async function seedOperational(ds: DataSource, tenant: SeedResult): Promise<void> {
  const { orgId, tenantId, orgSlug } = tenant;
  const orgName = process.env['SEED_ORG_NAME'] ?? 'MUSIC OS 360 Demo';
  // Same defaults as 02_admin_user.ts — this must reference the same seeded
  // admin identity, not an independent one.
  const effectiveAdminSub = process.env['SEED_ADMIN_SUB'] ?? '00000000-0000-0000-0000-000000000099';
  const adminEmail = process.env['SEED_ADMIN_EMAIL'] ?? 'admin@musicos360.dev';
  const adminName = process.env['SEED_ADMIN_NAME'] ?? 'Admin Dev (Seed)';

  console.log('\n[seed:operational] Starting operational seed...');

  await ds.query(`
    INSERT INTO organizations (id, name, slug, plan, billing_status, industry)
    VALUES ($1, $2, $3, 'enterprise', 'active', 'gravadora')
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      billing_status = EXCLUDED.billing_status
  `, [orgId, orgName, orgSlug]);

  await ds.query(`
    INSERT INTO tenants (id, org_id, name, slug, plan, active)
    VALUES ($1, $2, $3, $4, 'enterprise', TRUE)
    ON CONFLICT (id) DO UPDATE SET active = TRUE
  `, [tenantId, orgId, orgName, `${orgSlug}-tenant`]);

  // billing_subscriptions is already seeded by seedDefaultTenant() (01_default_tenant.ts)
  // for the same orgId -- inserting here too duplicated the row on every
  // run (billing_subscriptions has no UNIQUE(org_id), only PK(id) and
  // UNIQUE(stripe_customer_id/stripe_sub_id), always NULL here, so
  // ON CONFLICT DO NOTHING never had a target to match).

  // Dual-write (STEP 12-G): writes the legacy role AND the canonical role_id.
  await ds.query(`
    INSERT INTO org_members (org_id, tenant_id, auth_user_id, email, full_name, role, role_id, is_active)
    VALUES ($1, $2, $3, $4, $5, 'owner',
      (SELECT id FROM roles WHERE slug = 'owner' AND tenant_id IS NULL AND deleted_at IS NULL AND archived_at IS NULL LIMIT 1),
      TRUE)
    ON CONFLICT (tenant_id, auth_user_id) DO UPDATE
      SET role = 'owner',
          role_id = (SELECT id FROM roles WHERE slug = 'owner' AND tenant_id IS NULL AND deleted_at IS NULL AND archived_at IS NULL LIMIT 1),
          is_active = TRUE
  `, [orgId, tenantId, effectiveAdminSub, adminEmail, adminName]);

  await ds.query(`SET app.current_tenant_id = '${tenantId}'`);

  const artistId = '10000000-0000-0000-0000-000000000010';
  await ds.query(`
    INSERT INTO artists (id, tenant_id, nome_artistico, nome_civil, status, music_genre, created_by)
    VALUES ($1, $2, 'MC Demo Artist', 'Jose da Silva', 'active', 'Funk', $3)
    ON CONFLICT (id) DO NOTHING
  `, [artistId, tenantId, effectiveAdminSub]);

  // "contacts" (+ satellites) was removed in favor of "clients" (the
  // "Contact = Client" decision, see ContactsService) -- seeds directly into the canonical
  // table, with the creation event recorded in clients.interacoes (jsonb),
  // which is the documented replacement for contact_timeline.
  const contactId = '10000000-0000-0000-0000-000000000021';
  await ds.query(`
    INSERT INTO clients
      (id, tenant_id, tipo_pessoa, categoria, perfil, nome, razao_social, status_contato, prioridade_contato, status, interacoes, created_by)
    VALUES ($1, $2, 'pessoa_juridica', 'producer', 'outros', 'Maria Produtora', 'Gravadora Demo Records', 'active', 'high', 'active',
      $3::jsonb, $4)
    ON CONFLICT (id) DO NOTHING
  `, [contactId, tenantId, JSON.stringify([{ event_type: 'contact.created', summary: 'Contato criado via seed operacional', actor_id: effectiveAdminSub, at: new Date().toISOString() }]), effectiveAdminSub]);

  const campaignId = '10000000-0000-0000-0000-000000000040';
  const now = new Date();
  const end = new Date(now);
  end.setMonth(end.getMonth() + 1);

  await ds.query(`
    INSERT INTO campaigns (id, tenant_id, name, type, status, objective, artist_id, start_date, end_date, created_by)
    VALUES ($1, $2, 'Lancamento Verao Demo', 'digital', 'draft', 'Lancar single de verao', $3, $4, $5, $6)
    ON CONFLICT (id) DO NOTHING
  `, [campaignId, tenantId, artistId, now, end, effectiveAdminSub]);

  const campaignTaskId = '10000000-0000-0000-0000-000000000041';
  await ds.query(`
    INSERT INTO campaign_tasks (id, tenant_id, campaign_id, title, status, priority, due_date, created_by)
    VALUES ($1, $2, $3, 'Criar artes para redes sociais', 'pending', 'high', $4, $5)
    ON CONFLICT (id) DO NOTHING
  `, [campaignTaskId, tenantId, campaignId, end, effectiveAdminSub]);

  // "forms" (generic Form Builder) was removed in
  // 20260822000005_DropGenericFormsModule -- zero real consumers, final
  // product decision (Artist Public Form / Support Ticket / MusicChat
  // cover the 3 real channels). Nothing to seed here.

  const contractId = '10000000-0000-0000-0000-000000000060';
  await ds.query(`
    INSERT INTO contracts (id, tenant_id, title, type, status, artist_id, fixed_value, exclusive, created_by)
    VALUES ($1, $2, 'Contrato de Gravacao Demo', 'gravacao', 'draft', $3, 50000, FALSE, $4)
    ON CONFLICT (id) DO NOTHING
  `, [contractId, tenantId, artistId, effectiveAdminSub]);

  const txId = '10000000-0000-0000-0000-000000000070';
  await ds.query(`
    INSERT INTO transactions (id, tenant_id, type, categoria, descricao, valor, data, status, artist_id, created_by)
    VALUES ($1, $2, 'receita', 'external-rights-receipts', 'Recebimento externo de direitos Q1 Demo', 15000, $3, 'pending', $4, $5)
    ON CONFLICT (id) DO NOTHING
  `, [txId, tenantId, now, artistId, effectiveAdminSub]);

  await ds.query(`RESET app.current_tenant_id`);

  console.log('\n[seed:operational] Operational seed complete.\n');
}
