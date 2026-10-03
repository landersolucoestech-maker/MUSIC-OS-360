-- =============================================================================
-- MUSIC OS 360 — Supabase Custom Access Token Hook
-- =============================================================================
--
-- PURPOSE:
--   Automatically enrich every JWT issued/refreshed by Supabase with the
--   user's org_id and role, read live from the org_members table.
--
-- RESULT: every JWT carries:
--   {
--     "app_metadata": {
--       "org_id": "<organization-uuid>",
--       "role":   "viewer | editor | manager | admin | owner | super_admin"
--     }
--   }
--
-- COMPATIBILITY:
--   • JwtAuthGuard  — reads app_metadata.org_id → request.auth.orgId
--   • TenantGuard   — lookup tenants WHERE org_id = :orgId
--   • RolesGuard    — currentMember.role from the DB
--   • RLS           — auth.jwt()->'app_metadata'->>'org_id'
--   • Frontend      — AuthContext mapSupabaseUser reads app_metadata.org_id
--
-- HOW TO ENABLE (after running this script in the Supabase SQL Editor):
--   1. Dashboard → Authentication → Hooks
--   2. "Custom Access Token" → Enable
--   3. Schema: public   Function: custom_access_token_hook
--   4. Save
--
-- The hook fires on:
--   • signInWithPassword / signInWithOAuth / signInWithMagicLink
--   • refreshSession / auto-refresh (persistSession=true)
--   • getSession (when the token has expired and is refreshed)
-- =============================================================================

-- ─── 1. Hook function ─────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_claims               jsonb;
  v_user_id              text;
  v_requested_tenant_id  text;
  v_tenant_id            uuid;
  v_role                 text;
  v_app_meta             jsonb;
BEGIN
  v_claims    := event -> 'claims';
  v_user_id   := event ->> 'user_id';

  -- ─── Look up the user's most recent active membership ───────────────────────
  -- app_metadata.org_id explicitly selects the current tenant.
  -- The selection is only accepted when an active membership and tenant exist.
  SELECT u.raw_app_meta_data ->> 'org_id'
    INTO v_requested_tenant_id
    FROM auth.users u
   WHERE u.id::text = v_user_id;

  SELECT om.tenant_id, om.role
    INTO v_tenant_id, v_role
    FROM public.org_members om
    JOIN public.tenants t ON t.id = om.tenant_id
   WHERE om.auth_user_id = v_user_id
     AND om.is_active     = true
     AND om.tenant_id::text = v_requested_tenant_id
     AND t.active = true
     AND t.deleted_at IS NULL
   ORDER BY om.joined_at DESC NULLS LAST, om.id DESC
   LIMIT 1;

  -- ─── Inject into app_metadata (merge, do not overwrite) ─────────────────────
  -- Keeps any fields already present in app_metadata.
  IF v_tenant_id IS NOT NULL THEN
    v_app_meta := COALESCE(v_claims -> 'app_metadata', '{}'::jsonb)
                  || jsonb_build_object(
                       'org_id', v_tenant_id::text,
                       'role',   COALESCE(v_role, 'viewer')
                     );
    v_claims := jsonb_set(v_claims, '{app_metadata}', v_app_meta);
  END IF;

  RETURN jsonb_set(event, '{claims}', v_claims);

EXCEPTION WHEN OTHERS THEN
  -- Never block login when the query fails (e.g. the table does not exist yet).
  -- The JWT is issued without the extra claims — safe, but without tenant isolation.
  RAISE WARNING '[musicos360:jwt_hook] Failed to enrich JWT for user %: % — JWT issued without app_metadata',
    v_user_id, SQLERRM;
  RETURN event;
END;
$$;


-- ─── 2. Permissions ───────────────────────────────────────────────────────────
-- supabase_auth_admin is the internal Supabase role that invokes the hook.

GRANT USAGE    ON SCHEMA public                                      TO supabase_auth_admin;
GRANT EXECUTE  ON FUNCTION public.custom_access_token_hook(jsonb)    TO supabase_auth_admin;

-- Explicitly revoke from non-privileged roles for safety.
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) FROM authenticated, anon, public;


-- ─── 3. (Optional) Allow the hook to read org_members without RLS ────────────
-- SECURITY DEFINER already bypasses RLS because the function runs as its owner (postgres).
-- If the function owner is not postgres, add:
--   ALTER FUNCTION public.custom_access_token_hook(jsonb) OWNER TO postgres;


-- ─── 4. Post-activation check ─────────────────────────────────────────────────
-- After enabling the hook in the Dashboard and logging in, run in the SQL Editor:
--
--   SELECT auth.jwt() -> 'app_metadata';
--   -- Must return: {"org_id": "<uuid>", "role": "<role>"}
--
-- To check a specific token without logging in:
--   SELECT public.custom_access_token_hook(
--     jsonb_build_object(
--       'user_id', '<user-uuid>',
--       'claims',  '{}'::jsonb
--     )
--   );
