import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 20240601000001_WorkflowTransitions
 *
 * Creates the `workflow_transitions` table to persist the history of
 * Workflow Engine state transitions.
 *
 * Rollback: down() drops the table and indexes.
 */
export class WorkflowTransitions20240601000001 implements MigrationInterface {
  name = 'WorkflowTransitions20240601000001';

  async up(queryRunner: QueryRunner): Promise<void> {

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "workflow_transitions" (
        "id"          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id"   UUID        NOT NULL,
        "entity_type" VARCHAR(100) NOT NULL,
        "entity_id"   UUID        NOT NULL,
        "from_status" VARCHAR(100) NOT NULL,
        "to_status"   VARCHAR(100) NOT NULL,
        "actor_id"    VARCHAR(255) NOT NULL,
        "actor_role"  VARCHAR(100),
        "reason"      TEXT,
        "metadata"    JSONB       NOT NULL DEFAULT '{}',
        "created_at"  TIMESTAMP   NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_wf_transitions_tenant_type_entity"
        ON "workflow_transitions" ("tenant_id", "entity_type", "entity_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_wf_transitions_tenant"
        ON "workflow_transitions" ("tenant_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_wf_transitions_entity"
        ON "workflow_transitions" ("entity_type", "entity_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_wf_transitions_created_at"
        ON "workflow_transitions" ("created_at" DESC)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_wf_transitions_created_at"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_wf_transitions_entity"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_wf_transitions_tenant"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_wf_transitions_tenant_type_entity"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "workflow_transitions"`);
  }
}
