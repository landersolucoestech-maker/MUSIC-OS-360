import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * PHASE 3D — Batch 3C-A: enables RLS and creates the standard portable policy on the 19
 * tables approved by the 3C audit (tenantized, tenant_id NOT NULL uuid,
 * indexed, granted to the app role, no RLS and no policy).
 *
 *   Audiovisual (9): audiovisual_projects, _briefings, _shots, _production_days,
 *                    _team_members, _deliverables, _approvals, _tasks, _assets
 *   Society (8):     rights_holders, external_identifiers, society_accounts,
 *                    society_submissions, society_submission_events,
 *                    society_payload_snapshots, society_validation_errors,
 *                    society_sync_jobs
 *   Others (2):      marketing_content_posts, artist_platform_profiles
 *
 * Applies ONLY:  ENABLE ROW LEVEL SECURITY  +  standard policy
 *   USING      (tenant_id = private_get_tenant_id())
 *   WITH CHECK (tenant_id = private_get_tenant_id())
 *
 * Does NOT enable FORCE RLS (expected state: RLS=ON, FORCE=OFF). Idempotent:
 * ENABLE RLS is a no-op if already active; the policy is only created if it does not exist yet.
 * Does not remove or change existing policies. Same pattern as migrations
 * 20260613000006 and 20260613000007.
 */
export class RlsPoliciesAudiovisualSocietyMarketing20260613000008 implements MigrationInterface {
  name = 'RlsPoliciesAudiovisualSocietyMarketing20260613000008';

  private static readonly TABLES = [
    'audiovisual_projects', 'audiovisual_briefings', 'audiovisual_shots',
    'audiovisual_production_days', 'audiovisual_team_members', 'audiovisual_deliverables',
    'audiovisual_approvals', 'audiovisual_tasks', 'audiovisual_assets',
    'rights_holders', 'external_identifiers', 'society_accounts', 'society_submissions',
    'society_submission_events', 'society_payload_snapshots', 'society_validation_errors',
    'society_sync_jobs',
    'marketing_content_posts', 'artist_platform_profiles',
  ] as const;
  private static readonly POLICY = 'tenant_isolation';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of RlsPoliciesAudiovisualSocietyMarketing20260613000008.TABLES) {
      await queryRunner.query(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`);
      await queryRunner.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_policy
            WHERE polname = '${RlsPoliciesAudiovisualSocietyMarketing20260613000008.POLICY}'
              AND polrelid = 'public.${table}'::regclass
          ) THEN
            CREATE POLICY "${RlsPoliciesAudiovisualSocietyMarketing20260613000008.POLICY}"
              ON "${table}"
              USING (tenant_id = private_get_tenant_id())
              WITH CHECK (tenant_id = private_get_tenant_id());
          END IF;
        END $$;
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Reverts policy + disables RLS (original state: no RLS, no policy).
    for (const table of RlsPoliciesAudiovisualSocietyMarketing20260613000008.TABLES) {
      await queryRunner.query(
        `DROP POLICY IF EXISTS "${RlsPoliciesAudiovisualSocietyMarketing20260613000008.POLICY}" ON "${table}"`,
      );
      await queryRunner.query(`ALTER TABLE "${table}" DISABLE ROW LEVEL SECURITY`);
    }
  }
}
