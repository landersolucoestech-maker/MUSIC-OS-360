-- =============================================================================
-- MUSIC OS 360 — Supabase Row-Level Security (RLS) Policies
-- =============================================================================
-- Run this script in the Supabase SQL Editor (Settings → SQL Editor).
--
-- SAFETY: every block uses EXCEPTION WHEN undefined_table to skip tables that
-- do not exist yet — the script is idempotent and can be re-run after every
-- migration without errors.
--
-- JWT isolation structure:
--   auth.uid()                              → user UUID (sub)
--   auth.jwt()->'app_metadata'->>'org_id'   → UUID of the tenant organization
--   auth.jwt()->'app_metadata'->>'role'     → RBAC role of the user
-- =============================================================================


-- =============================================================================
-- STEP 1 — Helper functions (always created, independent of tables)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.auth_org_id()
  RETURNS uuid LANGUAGE sql STABLE AS
$$
  SELECT ((auth.jwt()->'app_metadata'->>'org_id')::uuid)
$$;

CREATE OR REPLACE FUNCTION public.auth_org_role()
  RETURNS text LANGUAGE sql STABLE AS
$$
  SELECT (auth.jwt()->'app_metadata'->>'role')
$$;

CREATE OR REPLACE FUNCTION public.has_min_role(required text)
  RETURNS boolean LANGUAGE plpgsql STABLE AS
$$
DECLARE
  role_levels jsonb := '{"viewer":1,"editor":2,"manager":3,"admin":4,"owner":5,"super_admin":6}';
  user_level  int;
  req_level   int;
BEGIN
  user_level := (role_levels->>(public.auth_org_role()))::int;
  req_level  := (role_levels->>required)::int;
  RETURN COALESCE(user_level, 0) >= COALESCE(req_level, 99);
END;
$$;


-- =============================================================================
-- STEP 2 — Per-table blocks: enable RLS + create policies
-- Every block is independent — missing tables raise a NOTICE, not an error.
-- =============================================================================


-- ── organizations ─────────────────────────────────────────────────────────────
DO $$ BEGIN
  ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "musicos360_org_select"       ON public.organizations;
  DROP POLICY IF EXISTS "musicos360_org_super_admin"  ON public.organizations;
  CREATE POLICY "musicos360_org_select" ON public.organizations
    FOR SELECT USING (id = public.auth_org_id());
  CREATE POLICY "musicos360_org_super_admin" ON public.organizations
    FOR ALL
    USING      (public.has_min_role('super_admin'))
    WITH CHECK (public.has_min_role('super_admin'));
  RAISE NOTICE 'RLS applied: organizations';
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'SKIP: table organizations does not exist yet';
END $$;


-- ── tenants ───────────────────────────────────────────────────────────────────
DO $$ BEGIN
  ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "musicos360_tenant_select" ON public.tenants;
  DROP POLICY IF EXISTS "musicos360_tenant_admin"  ON public.tenants;
  CREATE POLICY "musicos360_tenant_select" ON public.tenants
    FOR SELECT USING (org_id = public.auth_org_id());
  CREATE POLICY "musicos360_tenant_admin" ON public.tenants
    FOR ALL
    USING      (org_id = public.auth_org_id() AND public.has_min_role('admin'))
    WITH CHECK (org_id = public.auth_org_id() AND public.has_min_role('admin'));
  RAISE NOTICE 'RLS applied: tenants';
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'SKIP: table tenants does not exist yet';
END $$;


-- ── org_members ───────────────────────────────────────────────────────────────
DO $$ BEGIN
  ALTER TABLE public.org_members ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "musicos360_member_select" ON public.org_members;
  DROP POLICY IF EXISTS "musicos360_member_insert" ON public.org_members;
  DROP POLICY IF EXISTS "musicos360_member_update" ON public.org_members;
  DROP POLICY IF EXISTS "musicos360_member_delete" ON public.org_members;
  CREATE POLICY "musicos360_member_select" ON public.org_members
    FOR SELECT USING (org_id = public.auth_org_id());
  CREATE POLICY "musicos360_member_insert" ON public.org_members
    FOR INSERT WITH CHECK (org_id = public.auth_org_id() AND public.has_min_role('admin'));
  CREATE POLICY "musicos360_member_update" ON public.org_members
    FOR UPDATE
    USING      (org_id = public.auth_org_id() AND public.has_min_role('admin'))
    WITH CHECK (org_id = public.auth_org_id() AND public.has_min_role('admin'));
  CREATE POLICY "musicos360_member_delete" ON public.org_members
    FOR DELETE USING (org_id = public.auth_org_id() AND public.has_min_role('owner'));
  RAISE NOTICE 'RLS applied: org_members';
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'SKIP: table org_members does not exist yet';
END $$;


-- ── artists ───────────────────────────────────────────────────────────────────
DO $$ BEGIN
  ALTER TABLE public.artists ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "musicos360_artists_select" ON public.artists;
  DROP POLICY IF EXISTS "musicos360_artists_insert" ON public.artists;
  DROP POLICY IF EXISTS "musicos360_artists_update" ON public.artists;
  DROP POLICY IF EXISTS "musicos360_artists_delete" ON public.artists;
  CREATE POLICY "musicos360_artists_select" ON public.artists
    FOR SELECT USING (tenant_id IN (SELECT id FROM public.tenants WHERE org_id = public.auth_org_id()));
  CREATE POLICY "musicos360_artists_insert" ON public.artists
    FOR INSERT WITH CHECK (tenant_id IN (SELECT id FROM public.tenants WHERE org_id = public.auth_org_id()) AND public.has_min_role('editor'));
  CREATE POLICY "musicos360_artists_update" ON public.artists
    FOR UPDATE USING (tenant_id IN (SELECT id FROM public.tenants WHERE org_id = public.auth_org_id()) AND public.has_min_role('editor'));
  CREATE POLICY "musicos360_artists_delete" ON public.artists
    FOR DELETE USING (tenant_id IN (SELECT id FROM public.tenants WHERE org_id = public.auth_org_id()) AND public.has_min_role('manager'));
  RAISE NOTICE 'RLS applied: artists';
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'SKIP: table artists does not exist yet';
END $$;


-- ── works ─────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  ALTER TABLE public.works ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "musicos360_works_select" ON public.works;
  DROP POLICY IF EXISTS "musicos360_works_insert" ON public.works;
  DROP POLICY IF EXISTS "musicos360_works_update" ON public.works;
  DROP POLICY IF EXISTS "musicos360_works_delete" ON public.works;
  CREATE POLICY "musicos360_works_select" ON public.works
    FOR SELECT USING (tenant_id IN (SELECT id FROM public.tenants WHERE org_id = public.auth_org_id()));
  CREATE POLICY "musicos360_works_insert" ON public.works
    FOR INSERT WITH CHECK (tenant_id IN (SELECT id FROM public.tenants WHERE org_id = public.auth_org_id()) AND public.has_min_role('editor'));
  CREATE POLICY "musicos360_works_update" ON public.works
    FOR UPDATE USING (tenant_id IN (SELECT id FROM public.tenants WHERE org_id = public.auth_org_id()) AND public.has_min_role('editor'));
  CREATE POLICY "musicos360_works_delete" ON public.works
    FOR DELETE USING (tenant_id IN (SELECT id FROM public.tenants WHERE org_id = public.auth_org_id()) AND public.has_min_role('manager'));
  RAISE NOTICE 'RLS applied: works';
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'SKIP: table works does not exist yet';
END $$;


-- ── phonograms ────────────────────────────────────────────────────────────────
DO $$ BEGIN
  ALTER TABLE public.phonograms ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "musicos360_phonograms_select" ON public.phonograms;
  DROP POLICY IF EXISTS "musicos360_phonograms_insert" ON public.phonograms;
  DROP POLICY IF EXISTS "musicos360_phonograms_update" ON public.phonograms;
  DROP POLICY IF EXISTS "musicos360_phonograms_delete" ON public.phonograms;
  CREATE POLICY "musicos360_phonograms_select" ON public.phonograms
    FOR SELECT USING (tenant_id IN (SELECT id FROM public.tenants WHERE org_id = public.auth_org_id()));
  CREATE POLICY "musicos360_phonograms_insert" ON public.phonograms
    FOR INSERT WITH CHECK (tenant_id IN (SELECT id FROM public.tenants WHERE org_id = public.auth_org_id()) AND public.has_min_role('editor'));
  CREATE POLICY "musicos360_phonograms_update" ON public.phonograms
    FOR UPDATE USING (tenant_id IN (SELECT id FROM public.tenants WHERE org_id = public.auth_org_id()) AND public.has_min_role('editor'));
  CREATE POLICY "musicos360_phonograms_delete" ON public.phonograms
    FOR DELETE USING (tenant_id IN (SELECT id FROM public.tenants WHERE org_id = public.auth_org_id()) AND public.has_min_role('manager'));
  RAISE NOTICE 'RLS applied: phonograms';
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'SKIP: table phonograms does not exist yet';
END $$;


-- ── contracts ─────────────────────────────────────────────────────────────────
DO $$ BEGIN
  ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "musicos360_contracts_select" ON public.contracts;
  DROP POLICY IF EXISTS "musicos360_contracts_insert" ON public.contracts;
  DROP POLICY IF EXISTS "musicos360_contracts_update" ON public.contracts;
  DROP POLICY IF EXISTS "musicos360_contracts_delete" ON public.contracts;
  CREATE POLICY "musicos360_contracts_select" ON public.contracts
    FOR SELECT USING (tenant_id IN (SELECT id FROM public.tenants WHERE org_id = public.auth_org_id()));
  CREATE POLICY "musicos360_contracts_insert" ON public.contracts
    FOR INSERT WITH CHECK (tenant_id IN (SELECT id FROM public.tenants WHERE org_id = public.auth_org_id()) AND public.has_min_role('editor'));
  CREATE POLICY "musicos360_contracts_update" ON public.contracts
    FOR UPDATE USING (tenant_id IN (SELECT id FROM public.tenants WHERE org_id = public.auth_org_id()) AND public.has_min_role('editor'));
  CREATE POLICY "musicos360_contracts_delete" ON public.contracts
    FOR DELETE USING (tenant_id IN (SELECT id FROM public.tenants WHERE org_id = public.auth_org_id()) AND public.has_min_role('manager'));
  RAISE NOTICE 'RLS applied: contracts';
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'SKIP: table contracts does not exist yet';
END $$;


-- ── contract_templates ────────────────────────────────────────────────────────
DO $$ BEGIN
  ALTER TABLE public.contract_templates ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "musicos360_ctpl_select" ON public.contract_templates;
  DROP POLICY IF EXISTS "musicos360_ctpl_write"  ON public.contract_templates;
  DROP POLICY IF EXISTS "musicos360_ctpl_delete" ON public.contract_templates;
  CREATE POLICY "musicos360_ctpl_select" ON public.contract_templates
    FOR SELECT USING (tenant_id IN (SELECT id FROM public.tenants WHERE org_id = public.auth_org_id()));
  CREATE POLICY "musicos360_ctpl_write" ON public.contract_templates
    FOR INSERT WITH CHECK (tenant_id IN (SELECT id FROM public.tenants WHERE org_id = public.auth_org_id()) AND public.has_min_role('editor'));
  CREATE POLICY "musicos360_ctpl_delete" ON public.contract_templates
    FOR DELETE USING (tenant_id IN (SELECT id FROM public.tenants WHERE org_id = public.auth_org_id()) AND public.has_min_role('manager'));
  RAISE NOTICE 'RLS applied: contract_templates';
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'SKIP: table contract_templates does not exist yet';
END $$;


-- ── transactions ──────────────────────────────────────────────────────────────
DO $$ BEGIN
  ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "musicos360_tx_select" ON public.transactions;
  DROP POLICY IF EXISTS "musicos360_tx_insert" ON public.transactions;
  DROP POLICY IF EXISTS "musicos360_tx_update" ON public.transactions;
  DROP POLICY IF EXISTS "musicos360_tx_delete" ON public.transactions;
  CREATE POLICY "musicos360_tx_select" ON public.transactions
    FOR SELECT USING (tenant_id IN (SELECT id FROM public.tenants WHERE org_id = public.auth_org_id()));
  CREATE POLICY "musicos360_tx_insert" ON public.transactions
    FOR INSERT WITH CHECK (tenant_id IN (SELECT id FROM public.tenants WHERE org_id = public.auth_org_id()) AND public.has_min_role('editor'));
  CREATE POLICY "musicos360_tx_update" ON public.transactions
    FOR UPDATE USING (tenant_id IN (SELECT id FROM public.tenants WHERE org_id = public.auth_org_id()) AND public.has_min_role('editor'));
  CREATE POLICY "musicos360_tx_delete" ON public.transactions
    FOR DELETE USING (tenant_id IN (SELECT id FROM public.tenants WHERE org_id = public.auth_org_id()) AND public.has_min_role('manager'));
  RAISE NOTICE 'RLS applied: transactions';
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'SKIP: table transactions does not exist yet';
END $$;


-- ── invoices ──────────────────────────────────────────────────────────────────
DO $$ BEGIN
  ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "musicos360_inv_select" ON public.invoices;
  DROP POLICY IF EXISTS "musicos360_inv_insert" ON public.invoices;
  DROP POLICY IF EXISTS "musicos360_inv_update" ON public.invoices;
  DROP POLICY IF EXISTS "musicos360_inv_delete" ON public.invoices;
  CREATE POLICY "musicos360_inv_select" ON public.invoices
    FOR SELECT USING (tenant_id IN (SELECT id FROM public.tenants WHERE org_id = public.auth_org_id()));
  CREATE POLICY "musicos360_inv_insert" ON public.invoices
    FOR INSERT WITH CHECK (tenant_id IN (SELECT id FROM public.tenants WHERE org_id = public.auth_org_id()) AND public.has_min_role('editor'));
  CREATE POLICY "musicos360_inv_update" ON public.invoices
    FOR UPDATE USING (tenant_id IN (SELECT id FROM public.tenants WHERE org_id = public.auth_org_id()) AND public.has_min_role('editor'));
  CREATE POLICY "musicos360_inv_delete" ON public.invoices
    FOR DELETE USING (tenant_id IN (SELECT id FROM public.tenants WHERE org_id = public.auth_org_id()) AND public.has_min_role('manager'));
  RAISE NOTICE 'RLS applied: invoices';
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'SKIP: table invoices does not exist yet';
END $$;


-- ── clients ───────────────────────────────────────────────────────────────────
DO $$ BEGIN
  ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "musicos360_clients_select" ON public.clients;
  DROP POLICY IF EXISTS "musicos360_clients_insert" ON public.clients;
  DROP POLICY IF EXISTS "musicos360_clients_update" ON public.clients;
  DROP POLICY IF EXISTS "musicos360_clients_delete" ON public.clients;
  CREATE POLICY "musicos360_clients_select" ON public.clients
    FOR SELECT USING (tenant_id IN (SELECT id FROM public.tenants WHERE org_id = public.auth_org_id()));
  CREATE POLICY "musicos360_clients_insert" ON public.clients
    FOR INSERT WITH CHECK (tenant_id IN (SELECT id FROM public.tenants WHERE org_id = public.auth_org_id()) AND public.has_min_role('editor'));
  CREATE POLICY "musicos360_clients_update" ON public.clients
    FOR UPDATE USING (tenant_id IN (SELECT id FROM public.tenants WHERE org_id = public.auth_org_id()) AND public.has_min_role('editor'));
  CREATE POLICY "musicos360_clients_delete" ON public.clients
    FOR DELETE USING (tenant_id IN (SELECT id FROM public.tenants WHERE org_id = public.auth_org_id()) AND public.has_min_role('manager'));
  RAISE NOTICE 'RLS applied: clients';
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'SKIP: table clients does not exist yet';
END $$;


-- ── leads ─────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "musicos360_leads_select" ON public.leads;
  DROP POLICY IF EXISTS "musicos360_leads_insert" ON public.leads;
  DROP POLICY IF EXISTS "musicos360_leads_update" ON public.leads;
  DROP POLICY IF EXISTS "musicos360_leads_delete" ON public.leads;
  CREATE POLICY "musicos360_leads_select" ON public.leads
    FOR SELECT USING (tenant_id IN (SELECT id FROM public.tenants WHERE org_id = public.auth_org_id()));
  CREATE POLICY "musicos360_leads_insert" ON public.leads
    FOR INSERT WITH CHECK (tenant_id IN (SELECT id FROM public.tenants WHERE org_id = public.auth_org_id()) AND public.has_min_role('editor'));
  CREATE POLICY "musicos360_leads_update" ON public.leads
    FOR UPDATE USING (tenant_id IN (SELECT id FROM public.tenants WHERE org_id = public.auth_org_id()) AND public.has_min_role('editor'));
  CREATE POLICY "musicos360_leads_delete" ON public.leads
    FOR DELETE USING (tenant_id IN (SELECT id FROM public.tenants WHERE org_id = public.auth_org_id()) AND public.has_min_role('manager'));
  RAISE NOTICE 'RLS applied: leads';
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'SKIP: table leads does not exist yet';
END $$;


-- ── lead_interactions ─────────────────────────────────────────────────────────
DO $$ BEGIN
  ALTER TABLE public.lead_interactions ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "musicos360_li_select" ON public.lead_interactions;
  DROP POLICY IF EXISTS "musicos360_li_insert" ON public.lead_interactions;
  DROP POLICY IF EXISTS "musicos360_li_delete" ON public.lead_interactions;
  CREATE POLICY "musicos360_li_select" ON public.lead_interactions
    FOR SELECT USING (tenant_id IN (SELECT id FROM public.tenants WHERE org_id = public.auth_org_id()));
  CREATE POLICY "musicos360_li_insert" ON public.lead_interactions
    FOR INSERT WITH CHECK (tenant_id IN (SELECT id FROM public.tenants WHERE org_id = public.auth_org_id()) AND public.has_min_role('editor'));
  CREATE POLICY "musicos360_li_delete" ON public.lead_interactions
    FOR DELETE USING (tenant_id IN (SELECT id FROM public.tenants WHERE org_id = public.auth_org_id()) AND public.has_min_role('manager'));
  RAISE NOTICE 'RLS applied: lead_interactions';
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'SKIP: table lead_interactions does not exist yet';
END $$;


-- ── campaigns ─────────────────────────────────────────────────────────────────
DO $$ BEGIN
  ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "musicos360_camp_select" ON public.campaigns;
  DROP POLICY IF EXISTS "musicos360_camp_insert" ON public.campaigns;
  DROP POLICY IF EXISTS "musicos360_camp_update" ON public.campaigns;
  DROP POLICY IF EXISTS "musicos360_camp_delete" ON public.campaigns;
  CREATE POLICY "musicos360_camp_select" ON public.campaigns
    FOR SELECT USING (tenant_id IN (SELECT id FROM public.tenants WHERE org_id = public.auth_org_id()));
  CREATE POLICY "musicos360_camp_insert" ON public.campaigns
    FOR INSERT WITH CHECK (tenant_id IN (SELECT id FROM public.tenants WHERE org_id = public.auth_org_id()) AND public.has_min_role('editor'));
  CREATE POLICY "musicos360_camp_update" ON public.campaigns
    FOR UPDATE USING (tenant_id IN (SELECT id FROM public.tenants WHERE org_id = public.auth_org_id()) AND public.has_min_role('editor'));
  CREATE POLICY "musicos360_camp_delete" ON public.campaigns
    FOR DELETE USING (tenant_id IN (SELECT id FROM public.tenants WHERE org_id = public.auth_org_id()) AND public.has_min_role('manager'));
  RAISE NOTICE 'RLS applied: campaigns';
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'SKIP: table campaigns does not exist yet';
END $$;


-- ── events ────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "musicos360_events_select" ON public.events;
  DROP POLICY IF EXISTS "musicos360_events_insert" ON public.events;
  DROP POLICY IF EXISTS "musicos360_events_update" ON public.events;
  DROP POLICY IF EXISTS "musicos360_events_delete" ON public.events;
  CREATE POLICY "musicos360_events_select" ON public.events
    FOR SELECT USING (tenant_id IN (SELECT id FROM public.tenants WHERE org_id = public.auth_org_id()));
  CREATE POLICY "musicos360_events_insert" ON public.events
    FOR INSERT WITH CHECK (tenant_id IN (SELECT id FROM public.tenants WHERE org_id = public.auth_org_id()) AND public.has_min_role('editor'));
  CREATE POLICY "musicos360_events_update" ON public.events
    FOR UPDATE USING (tenant_id IN (SELECT id FROM public.tenants WHERE org_id = public.auth_org_id()) AND public.has_min_role('editor'));
  CREATE POLICY "musicos360_events_delete" ON public.events
    FOR DELETE USING (tenant_id IN (SELECT id FROM public.tenants WHERE org_id = public.auth_org_id()) AND public.has_min_role('manager'));
  RAISE NOTICE 'RLS applied: events';
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'SKIP: table events does not exist yet';
END $$;


-- ── projects ──────────────────────────────────────────────────────────────────
DO $$ BEGIN
  ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "musicos360_proj_select" ON public.projects;
  DROP POLICY IF EXISTS "musicos360_proj_insert" ON public.projects;
  DROP POLICY IF EXISTS "musicos360_proj_update" ON public.projects;
  DROP POLICY IF EXISTS "musicos360_proj_delete" ON public.projects;
  CREATE POLICY "musicos360_proj_select" ON public.projects
    FOR SELECT USING (tenant_id IN (SELECT id FROM public.tenants WHERE org_id = public.auth_org_id()));
  CREATE POLICY "musicos360_proj_insert" ON public.projects
    FOR INSERT WITH CHECK (tenant_id IN (SELECT id FROM public.tenants WHERE org_id = public.auth_org_id()) AND public.has_min_role('editor'));
  CREATE POLICY "musicos360_proj_update" ON public.projects
    FOR UPDATE USING (tenant_id IN (SELECT id FROM public.tenants WHERE org_id = public.auth_org_id()) AND public.has_min_role('editor'));
  CREATE POLICY "musicos360_proj_delete" ON public.projects
    FOR DELETE USING (tenant_id IN (SELECT id FROM public.tenants WHERE org_id = public.auth_org_id()) AND public.has_min_role('manager'));
  RAISE NOTICE 'RLS applied: projects';
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'SKIP: table projects does not exist yet';
END $$;


-- ── releases ──────────────────────────────────────────────────────────────────
DO $$ BEGIN
  ALTER TABLE public.releases ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "musicos360_rel_select" ON public.releases;
  DROP POLICY IF EXISTS "musicos360_rel_insert" ON public.releases;
  DROP POLICY IF EXISTS "musicos360_rel_update" ON public.releases;
  DROP POLICY IF EXISTS "musicos360_rel_delete" ON public.releases;
  CREATE POLICY "musicos360_rel_select" ON public.releases
    FOR SELECT USING (tenant_id IN (SELECT id FROM public.tenants WHERE org_id = public.auth_org_id()));
  CREATE POLICY "musicos360_rel_insert" ON public.releases
    FOR INSERT WITH CHECK (tenant_id IN (SELECT id FROM public.tenants WHERE org_id = public.auth_org_id()) AND public.has_min_role('editor'));
  CREATE POLICY "musicos360_rel_update" ON public.releases
    FOR UPDATE USING (tenant_id IN (SELECT id FROM public.tenants WHERE org_id = public.auth_org_id()) AND public.has_min_role('editor'));
  CREATE POLICY "musicos360_rel_delete" ON public.releases
    FOR DELETE USING (tenant_id IN (SELECT id FROM public.tenants WHERE org_id = public.auth_org_id()) AND public.has_min_role('manager'));
  RAISE NOTICE 'RLS applied: releases';
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'SKIP: table releases does not exist yet';
END $$;


-- ── shares ────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  ALTER TABLE public.shares ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "musicos360_shares_select" ON public.shares;
  DROP POLICY IF EXISTS "musicos360_shares_insert" ON public.shares;
  DROP POLICY IF EXISTS "musicos360_shares_update" ON public.shares;
  DROP POLICY IF EXISTS "musicos360_shares_delete" ON public.shares;
  CREATE POLICY "musicos360_shares_select" ON public.shares
    FOR SELECT USING (tenant_id IN (SELECT id FROM public.tenants WHERE org_id = public.auth_org_id()));
  CREATE POLICY "musicos360_shares_insert" ON public.shares
    FOR INSERT WITH CHECK (tenant_id IN (SELECT id FROM public.tenants WHERE org_id = public.auth_org_id()) AND public.has_min_role('editor'));
  CREATE POLICY "musicos360_shares_update" ON public.shares
    FOR UPDATE USING (tenant_id IN (SELECT id FROM public.tenants WHERE org_id = public.auth_org_id()) AND public.has_min_role('manager'));
  CREATE POLICY "musicos360_shares_delete" ON public.shares
    FOR DELETE USING (tenant_id IN (SELECT id FROM public.tenants WHERE org_id = public.auth_org_id()) AND public.has_min_role('admin'));
  RAISE NOTICE 'RLS applied: shares';
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'SKIP: table shares does not exist yet';
END $$;


-- ── audit_log (immutable — no UPDATE/DELETE via RLS) ──────────────────────────
DO $$ BEGIN
  ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "musicos360_audit_select" ON public.audit_log;
  DROP POLICY IF EXISTS "musicos360_audit_insert" ON public.audit_log;
  CREATE POLICY "musicos360_audit_select" ON public.audit_log
    FOR SELECT USING (
      tenant_id IN (SELECT id FROM public.tenants WHERE org_id = public.auth_org_id())
      AND public.has_min_role('manager')
    );
  CREATE POLICY "musicos360_audit_insert" ON public.audit_log
    FOR INSERT WITH CHECK (
      tenant_id IN (SELECT id FROM public.tenants WHERE org_id = public.auth_org_id())
    );
  RAISE NOTICE 'RLS applied: audit_log';
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'SKIP: table audit_log does not exist yet';
END $$;


-- ── notifications (each user sees only their own) ─────────────────────────────
DO $$ BEGIN
  ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "musicos360_notif_select" ON public.notifications;
  DROP POLICY IF EXISTS "musicos360_notif_insert" ON public.notifications;
  CREATE POLICY "musicos360_notif_select" ON public.notifications
    FOR SELECT USING (
      tenant_id IN (SELECT id FROM public.tenants WHERE org_id = public.auth_org_id())
      AND user_id = auth.uid()
    );
  CREATE POLICY "musicos360_notif_insert" ON public.notifications
    FOR INSERT WITH CHECK (
      tenant_id IN (SELECT id FROM public.tenants WHERE org_id = public.auth_org_id())
      AND public.has_min_role('manager')
    );
  RAISE NOTICE 'RLS applied: notifications';
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'SKIP: table notifications does not exist yet';
END $$;


-- =============================================================================
-- STEP 3 — Access grants
-- service_role bypasses RLS by Supabase design — use it only in migrations.
-- The authenticated role relies on RLS as its only barrier.
-- =============================================================================

DO $$ BEGIN
  GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
  GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;
  RAISE NOTICE 'Grants applied to the authenticated role';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'SKIP: failed to apply grants — %', SQLERRM;
END $$;


-- =============================================================================
-- END — Re-run this script after every schema migration.
-- The functions (STEP 1) are idempotent via CREATE OR REPLACE.
-- The DO blocks (STEP 2) skip missing tables with a NOTICE.
-- =============================================================================
