import { WorkflowExecutionTenantNotNull20260613000011 } from './migrations/20260613000011_WorkflowExecutionTenantNotNull';

describe('WorkflowExecutionTenantNotNull20260613000011', () => {
  it('up refuses NULLs and applies only SET NOT NULL', async () => {
    const query = jest.fn(async (_sql: string) => undefined);
    await new WorkflowExecutionTenantNotNull20260613000011().up({ query } as never);

    const sql = String(query.mock.calls[0]?.[0]);
    expect(sql).toContain('WHERE tenant_id IS NULL');
    expect(sql).toContain('ALTER COLUMN tenant_id SET NOT NULL');
    expect(sql).not.toMatch(/ROW LEVEL SECURITY|CREATE POLICY|CREATE INDEX|FOREIGN KEY/i);
  });

  it('down removes only NOT NULL', async () => {
    const query = jest.fn(async (_sql: string) => undefined);
    await new WorkflowExecutionTenantNotNull20260613000011().down({ query } as never);

    expect(String(query.mock.calls[0]?.[0])).toContain(
      'ALTER COLUMN tenant_id DROP NOT NULL',
    );
  });
});
