import { RlsPoliciesSkillRunsWorkflowExecutions20260613000012 } from './migrations/20260613000012_RlsPoliciesSkillRunsWorkflowExecutions';

describe('RlsPoliciesSkillRunsWorkflowExecutions20260613000012', () => {
  function queryRunner() {
    return { query: jest.fn(async (_sql: string) => undefined) };
  }

  it('creates only default RLS on the two authorized tables', async () => {
    const qr = queryRunner();
    await new RlsPoliciesSkillRunsWorkflowExecutions20260613000012().up(qr as never);
    const sql = qr.query.mock.calls.map(([statement]) => statement).join('\n');

    expect(sql).toContain('ALTER TABLE "skill_runs" ENABLE ROW LEVEL SECURITY');
    expect(sql).toContain('ALTER TABLE "workflow_executions" ENABLE ROW LEVEL SECURITY');
    expect(sql.match(/CREATE POLICY "tenant_isolation"/g)).toHaveLength(2);
    expect(sql.match(/USING \(tenant_id = private_get_tenant_id\(\)\)/g)).toHaveLength(2);
    expect(sql.match(/WITH CHECK \(tenant_id = private_get_tenant_id\(\)\)/g)).toHaveLength(2);
    expect(sql).not.toMatch(/FORCE ROW LEVEL SECURITY|current_setting|auth\.uid|tenant_id::text/i);
    expect(sql).not.toMatch(/skill_run_logs|workflow_execution_logs/i);
  });

  it('remove policies e desabilita RLS de forma reversivel', async () => {
    const qr = queryRunner();
    await new RlsPoliciesSkillRunsWorkflowExecutions20260613000012().down(qr as never);
    const sql = qr.query.mock.calls.map(([statement]) => statement).join('\n');

    expect(sql).toContain('DROP POLICY IF EXISTS "tenant_isolation" ON "skill_runs"');
    expect(sql).toContain('DROP POLICY IF EXISTS "tenant_isolation" ON "workflow_executions"');
    expect(sql).toContain('ALTER TABLE "skill_runs" DISABLE ROW LEVEL SECURITY');
    expect(sql).toContain('ALTER TABLE "workflow_executions" DISABLE ROW LEVEL SECURITY');
  });
});
