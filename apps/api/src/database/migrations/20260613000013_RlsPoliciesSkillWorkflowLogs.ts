import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * PHASE 3T — Closes the main RLS track: protects the child logs by tenant
 * INHERITANCE via a real FK to the already tenantized and protected parent (PHASE 3R).
 *
 *   skill_run_logs.skill_run_id        → skill_runs.id          (RLS ON)
 *   workflow_execution_logs.execution_id → workflow_executions.id (RLS ON, tenant NOT NULL)
 *
 * Does, per table:
 *   1. Real FK ON DELETE CASCADE (logs are children of the parent) — 3S pre-check = 0 orphans;
 *      ADD ... NOT VALID + VALIDATE (short lock), idempotent via a pg_constraint guard.
 *   2. ENABLE ROW LEVEL SECURITY (no-op if already active). Does NOT enable FORCE.
 *   3. `tenant_isolation` policy via EXISTS on the parent, using the portable pattern
 *      private_get_tenant_id() — no current_setting, no auth.uid, no ::text cast.
 *
 * Idempotent and reversible. Does NOT change skill_runs/workflow_executions nor any
 * other table. Does not harmonize legacy policies.
 */
export class RlsPoliciesSkillWorkflowLogs20260613000013 implements MigrationInterface {
  name = 'RlsPoliciesSkillWorkflowLogs20260613000013';

  // [tabela, coluna_fk, parent, nome_fk]
  private static readonly SPECS: ReadonlyArray<[string, string, string, string]> = [
    ['skill_run_logs', 'skill_run_id', 'skill_runs', 'fk_skill_run_logs_skill_run'],
    ['workflow_execution_logs', 'execution_id', 'workflow_executions', 'fk_workflow_execution_logs_execution'],
  ];
  private static readonly POLICY = 'tenant_isolation';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [table, col, parent, fk] of RlsPoliciesSkillWorkflowLogs20260613000013.SPECS) {
      // 1. FK real ON DELETE CASCADE (idempotente).
      await queryRunner.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '${fk}' AND conrelid = 'public.${table}'::regclass) THEN
            ALTER TABLE "${table}" ADD CONSTRAINT "${fk}"
              FOREIGN KEY ("${col}") REFERENCES "${parent}" ("id") ON DELETE CASCADE NOT VALID;
            ALTER TABLE "${table}" VALIDATE CONSTRAINT "${fk}";
          END IF;
        END $$;
      `);

      // 2. ENABLE RLS (sem FORCE).
      await queryRunner.query(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`);

      // 3. policy por EXISTS no parent tenantizado.
      const expr =
        `EXISTS (SELECT 1 FROM ${parent} p WHERE p.id = ${table}.${col} AND p.tenant_id = private_get_tenant_id())`;
      await queryRunner.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_policy
            WHERE polname = '${RlsPoliciesSkillWorkflowLogs20260613000013.POLICY}'
              AND polrelid = 'public.${table}'::regclass
          ) THEN
            CREATE POLICY "${RlsPoliciesSkillWorkflowLogs20260613000013.POLICY}"
              ON "${table}"
              USING (${expr})
              WITH CHECK (${expr});
          END IF;
        END $$;
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const [table, , , fk] of RlsPoliciesSkillWorkflowLogs20260613000013.SPECS) {
      await queryRunner.query(
        `DROP POLICY IF EXISTS "${RlsPoliciesSkillWorkflowLogs20260613000013.POLICY}" ON "${table}"`,
      );
      await queryRunner.query(`ALTER TABLE "${table}" DISABLE ROW LEVEL SECURITY`);
      await queryRunner.query(`ALTER TABLE "${table}" DROP CONSTRAINT IF EXISTS "${fk}"`);
    }
  }
}
