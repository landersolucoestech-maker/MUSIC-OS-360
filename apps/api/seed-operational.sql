-- ============================================================
-- MUSIC OS 360 — Operational Seed
-- Run in Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================
--
-- BEFORE RUNNING:
--   1. Replace <<YOUR_SUPABASE_AUTH_UUID>> below with the real
--      UUID from Supabase Dashboard → Authentication → Users
--      (create the admin user there first if it doesn't exist)
--
-- To get the UUID after creating the user:
--   SELECT id FROM auth.users WHERE email = 'admin@musicos360.dev';
-- ============================================================

DO $$
DECLARE
  v_org_id      UUID := '10000000-0000-0000-0000-000000000001';
  v_tenant_id   UUID := '10000000-0000-0000-0000-000000000002';
  v_org_slug    TEXT := 'musicos360-demo';
  v_org_name    TEXT := 'MUSIC OS 360 Demo';
  v_admin_sub   TEXT := '<<YOUR_SUPABASE_AUTH_UUID>>';  -- REPLACE THIS
  v_admin_email TEXT := 'admin@musicos360.dev';
  v_admin_name  TEXT := 'Admin Demo';
  v_artist_id   UUID := gen_random_uuid();
BEGIN

  -- ── 1. Organization ─────────────────────────────────────────────────────────
  INSERT INTO organizations (id, name, slug, plan, billing_status, industry)
  VALUES (v_org_id, v_org_name, v_org_slug, 'enterprise', 'active', 'record_label')
  ON CONFLICT (id) DO UPDATE SET
    name           = EXCLUDED.name,
    billing_status = EXCLUDED.billing_status;

  -- ── 2. Tenant ────────────────────────────────────────────────────────────────
  INSERT INTO tenants (id, org_id, name, slug, plan, active)
  VALUES (v_tenant_id, v_org_id, v_org_name, v_org_slug || '-tenant', 'enterprise', TRUE)
  ON CONFLICT (id) DO UPDATE SET active = TRUE;

  -- ── 3. Billing Subscription ─────────────────────────────────────────────────
  INSERT INTO billing_subscriptions (org_id, plan, status, seats, seats_used)
  VALUES (v_org_id, 'enterprise', 'active', 50, 1)
  ON CONFLICT DO NOTHING;

  -- ── 4. Admin Member ─────────────────────────────────────────────────────────
  IF v_admin_sub != '<<YOUR_SUPABASE_AUTH_UUID>>' THEN
    INSERT INTO org_members (org_id, tenant_id, auth_user_id, email, full_name, role, is_active)
    VALUES (v_org_id, v_tenant_id, v_admin_sub, v_admin_email, v_admin_name, 'owner', TRUE)
    ON CONFLICT (tenant_id, auth_user_id) DO UPDATE SET
      role      = 'owner',
      is_active = TRUE;
    RAISE NOTICE 'org_members: % created as owner', v_admin_email;
  ELSE
    RAISE WARNING 'SEED_ADMIN_SUB is not set: skipping org_members. Replace <<YOUR_SUPABASE_AUTH_UUID>> with the real UUID.';
  END IF;

  -- ── 5. Demo Artist ──────────────────────────────────────────────────────────
  INSERT INTO artists (id, tenant_id, stage_name, full_name, status, music_genre)
  VALUES (v_artist_id, v_tenant_id, 'Demo Artist', 'Demo Legal Name', 'active', 'MPB')
  ON CONFLICT DO NOTHING;

  -- ── 6. Demo Transaction ─────────────────────────────────────────────────────
  INSERT INTO transactions (tenant_id, type, category, description, amount, transaction_date, status)
  VALUES (v_tenant_id, 'revenue', 'performance_fees', 'Demo show', 5000.00, NOW(), 'confirmed')
  ON CONFLICT DO NOTHING;

  RAISE NOTICE '✓ Operational seed finished: org=%, tenant=%', v_org_id, v_tenant_id;
END $$;
