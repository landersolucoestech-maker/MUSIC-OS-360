import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Part 77 — the "RebuildXInCanonicalFormOrder" migration series (2026-07-19,
 * 25 files) recreated dozens of tables from scratch (`DROP`/`CREATE`), always
 * granting to `musicos_migrator` (the role that runs migrations),
 * but NEVER re-granting anything to `musicos_app` (the role used by the
 * application's normal traffic, via APP_DATABASE_URL). The result: 114 of the ~120
 * tables in `public` became "permission denied" for `musicos_app` —
 * not an RLS problem (which restricts ROWS), but a missing GRANT (which
 * blocks the whole table). That explained both the 500 on /auth/context
 * and any real domain page hanging after login.
 *
 * Two-part fix:
 *   1) retroactively grants what is needed on every table present today;
 *   2) `ALTER DEFAULT PRIVILEGES FOR ROLE musicos_migrator` ensures that
 *      FUTURE TABLES created by rebuilds/migrations are born with the
 *      right grant — without it, the next "physical rebuild" repeats the
 *      same problem.
 *
 * Audit/log tables (never edited nor deleted by the application)
 * receive only SELECT+INSERT, preserving the same policy already used in
 * `rbac_error_logs` (20260621000001) — GRANT is defense in depth,
 * RLS remains the real row control.
 */

const READ_WRITE_TABLES = [
  'activity_logs', 'ai_jobs', 'artist_goals', 'artist_platform_profiles', 'artists',
  'asset_usage_logs', 'asset_versions', 'assets', 'audiovisual_approvals',
  'audiovisual_assets', 'audiovisual_briefings', 'audiovisual_deliverables',
  'audiovisual_production_days', 'audiovisual_projects', 'audiovisual_shots',
  'audiovisual_tasks', 'audiovisual_team_members', 'billing_plans', 'billing_settings',
  'billing_subscriptions', 'briefings', 'campaign_assets', 'campaign_tasks', 'campaigns',
  'clients', 'content_detections', 'contract_templates', 'contracts',
  'conversation_messages', 'conversation_notes', 'conversations', 'departments',
  'ecad_reports', 'employees', 'events', 'external_identifiers', 'financial_rules',
  'form_submissions', 'forms', 'integrations', 'inventory_items', 'invoices',
  'job_functions', 'lead_interactions', 'leads', 'leave_requests', 'licenses',
  'marketing_asset_approvals', 'marketing_asset_versions', 'marketing_assets',
  'marketing_content_posts', 'marketing_projects', 'marketing_strategies',
  'marketing_strategy_actions', 'marketing_strategy_initiatives',
  'marketing_strategy_objectives', 'marketing_tasks', 'membership_job_functions',
  'musicchat_automation_notifications', 'musicchat_automation_settings',
  'notifications', 'oauth_connections', 'org_members', 'organizations',
  'payroll_entries', 'permission_aliases', 'permission_groups', 'phonograms',
  'pipeline_opportunities', 'pipeline_stages', 'pipelines', 'positions',
  'project_assets', 'project_track_participants', 'project_tracks', 'projects',
  'release_works', 'releases', 'rights_holders', 'shares', 'society_accounts',
  'society_payload_snapshots', 'society_submissions', 'society_sync_jobs',
  'society_validation_errors', 'support_tickets', 'takedowns', 'task_assets',
  'tenant_billing_state', 'tenants', 'transactions', 'uploads', 'users',
  'work_participants', 'workflow_executions', 'workflow_transitions', 'works',
] as const;

/** Log/audit — the application only reads and inserts, never edits nor deletes. */
const APPEND_ONLY_TABLES = [
  'audit_logs', 'financial_category_audit_logs', 'domain_event_log',
  'rbac_decision_logs', 'rbac_decision_logs_2026_06', 'rbac_decision_logs_2026_07',
  'rbac_decision_logs_2026_08', 'rbac_decision_logs_2026_09', 'rbac_decision_logs_default',
  'skill_run_logs', 'society_submission_events', 'musicchat_automation_events',
  'workflow_execution_logs', 'payment_events', 'webhook_events',
] as const;

export class GrantMusicosAppOnAllTables20260802000001 implements MigrationInterface {
  name = 'GrantMusicosAppOnAllTables20260802000001';

  async up(qr: QueryRunner): Promise<void> {
    for (const table of READ_WRITE_TABLES) {
      await qr.query(`
        DO $$
        BEGIN
          IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = '${table}') THEN
            EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."${table}" TO musicos_app';
          END IF;
        END $$;
      `);
    }

    for (const table of APPEND_ONLY_TABLES) {
      await qr.query(`
        DO $$
        BEGIN
          IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = '${table}') THEN
            EXECUTE 'GRANT SELECT, INSERT ON TABLE public."${table}" TO musicos_app';
          END IF;
        END $$;
      `);
    }

    // Sequences: needed for serial/identity columns (most
    // tables use UUID + gen_random_uuid(), but granting is harmless where
    // it does not apply and avoids the same bug class for what still uses serial).
    await qr.query(`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO musicos_app`);

    // Prevention: any future table created by musicos_migrator (the role
    // used by all migrations) is born with the right grant — without it,
    // the next "physical rebuild" reintroduces exactly this bug.
    await qr.query(`
      ALTER DEFAULT PRIVILEGES FOR ROLE musicos_migrator IN SCHEMA public
        GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO musicos_app
    `);
    await qr.query(`
      ALTER DEFAULT PRIVILEGES FOR ROLE musicos_migrator IN SCHEMA public
        GRANT USAGE, SELECT ON SEQUENCES TO musicos_app
    `);
  }

  async down(qr: QueryRunner): Promise<void> {
    await qr.query(`
      ALTER DEFAULT PRIVILEGES FOR ROLE musicos_migrator IN SCHEMA public
        REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLES FROM musicos_app
    `);
    await qr.query(`
      ALTER DEFAULT PRIVILEGES FOR ROLE musicos_migrator IN SCHEMA public
        REVOKE USAGE, SELECT ON SEQUENCES FROM musicos_app
    `);

    for (const table of [...READ_WRITE_TABLES, ...APPEND_ONLY_TABLES]) {
      await qr.query(`
        DO $$
        BEGIN
          IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = '${table}') THEN
            EXECUTE 'REVOKE ALL ON TABLE public."${table}" FROM musicos_app';
          END IF;
        END $$;
      `);
    }
  }
}
