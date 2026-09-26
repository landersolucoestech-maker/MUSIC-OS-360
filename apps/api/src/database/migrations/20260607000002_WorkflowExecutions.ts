import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Slice 4 — Execution persistence of the Workflow Automation Engine.
 * Creates workflow_executions + workflow_execution_logs (full traceability
 * of every rule trigger → actions → result), without changing the existing engine.
 */
export class WorkflowExecutions20260607000002 implements MigrationInterface {
  name = 'WorkflowExecutions20260607000002';

  async up(qr: QueryRunner): Promise<void> {
    await qr.query(`
      CREATE TABLE IF NOT EXISTS workflow_executions (
        id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id         uuid,
        rule_id           varchar(150) NOT NULL,
        rule_name         varchar(255) NOT NULL,
        event_type        varchar(100) NOT NULL,
        correlation_id    varchar(255),
        status            varchar(20) NOT NULL DEFAULT 'running',
        actions_total     integer NOT NULL DEFAULT 0,
        actions_succeeded integer NOT NULL DEFAULT 0,
        actions_failed    integer NOT NULL DEFAULT 0,
        error_message     text,
        started_at        timestamp,
        finished_at       timestamp,
        created_at        timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await qr.query(`CREATE INDEX IF NOT EXISTS idx_wf_exec_tenant ON workflow_executions (tenant_id);`);
    await qr.query(`CREATE INDEX IF NOT EXISTS idx_wf_exec_tenant_rule ON workflow_executions (tenant_id, rule_id);`);
    await qr.query(`CREATE INDEX IF NOT EXISTS idx_wf_exec_tenant_status ON workflow_executions (tenant_id, status);`);
    await qr.query(`CREATE INDEX IF NOT EXISTS idx_wf_exec_correlation ON workflow_executions (correlation_id);`);
    await qr.query(`CREATE INDEX IF NOT EXISTS idx_wf_exec_event ON workflow_executions (event_type);`);

    await qr.query(`
      CREATE TABLE IF NOT EXISTS workflow_execution_logs (
        id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        execution_id  uuid NOT NULL,
        action_type   varchar(30) NOT NULL,
        status        varchar(20) NOT NULL,
        message       text,
        payload       jsonb,
        created_at    timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await qr.query(`CREATE INDEX IF NOT EXISTS idx_wf_exec_logs_exec ON workflow_execution_logs (execution_id);`);
  }

  async down(qr: QueryRunner): Promise<void> {
    await qr.query(`DROP TABLE IF EXISTS workflow_execution_logs;`);
    await qr.query(`DROP TABLE IF EXISTS workflow_executions;`);
  }
}
