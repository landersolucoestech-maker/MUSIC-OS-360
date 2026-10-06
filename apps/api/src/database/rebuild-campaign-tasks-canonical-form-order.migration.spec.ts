import * as fs from 'fs';
import * as path from 'path';

/**
 * Permanent guard (2026-07-19 audit): physical rebuild of
 * `campaign_tasks` — follows CreateCampaignTaskDto; created_by moved to the
 * end of the audit block.
 */
const migrationSrc = fs.readFileSync(
  path.resolve(__dirname, 'migrations/20260719000022_RebuildCampaignTasksInCanonicalFormOrder.ts'),
  'utf8',
);

describe('RebuildCampaignTasksInCanonicalFormOrder20260719000022', () => {
  const block = () => migrationSrc.split('newColumns = `')[1].split('`;')[0];

  it('follows the DTO order: title -> description -> status -> priority -> assigned_to -> due_date -> completed_at', () => {
    const b = block();
    const titleIdx = b.indexOf('title');
    const descIdx = b.indexOf('description');
    const statusIdx = b.search(/\bstatus\s+varchar/);
    const priorityIdx = b.indexOf('priority');
    const assignedIdx = b.indexOf('assigned_to');
    const dueDateIdx = b.indexOf('due_date');
    const completedIdx = b.indexOf('completed_at');
    expect(descIdx).toBeGreaterThan(titleIdx);
    expect(statusIdx).toBeGreaterThan(descIdx);
    expect(priorityIdx).toBeGreaterThan(statusIdx);
    expect(assignedIdx).toBeGreaterThan(priorityIdx);
    expect(dueDateIdx).toBeGreaterThan(assignedIdx);
    expect(completedIdx).toBeGreaterThan(dueDateIdx);
  });

  it('created_by comes after created_at/updated_at (not before)', () => {
    const b = block();
    const createdAtIdx = b.indexOf('created_at');
    const updatedAtIdx = b.indexOf('updated_at');
    const createdByIdx = b.indexOf('created_by');
    expect(updatedAtIdx).toBeGreaterThan(createdAtIdx);
    expect(createdByIdx).toBeGreaterThan(updatedAtIdx);
  });

  it('removes no column (pure order rebuild)', () => {
    const newBlock = block();
    const origBlock = migrationSrc.split('originalColumns = `')[1].split('`;')[0];
    const extractCols = (b: string) => [...b.matchAll(/^\s*(\w+)\s+/gm)].map((m) => m[1]);
    const newCols = new Set(extractCols(newBlock));
    const origCols = new Set(extractCols(origBlock));
    expect(newCols.size).toBe(origCols.size);
    for (const col of origCols) expect(newCols.has(col)).toBe(true);
  });

  it('does not use DROP ... CASCADE', () => {
    expect(migrationSrc).not.toMatch(/DROP\s+\w+[^;]*CASCADE/i);
  });

  it('recreates the FKs to campaigns (simple and composite) and RLS + the 5 policies, with an honest down()', () => {
    expect(migrationSrc.match(/FOREIGN KEY \(campaign_id\) REFERENCES campaigns\(id\) ON DELETE CASCADE/g)?.length).toBeGreaterThanOrEqual(2);
    expect(migrationSrc.match(/FOREIGN KEY \(campaign_id, tenant_id\) REFERENCES campaigns\(id, tenant_id\) ON DELETE CASCADE/g)?.length).toBeGreaterThanOrEqual(2);
    expect(migrationSrc).toMatch(/ENABLE ROW LEVEL SECURITY/);
    expect(migrationSrc).toMatch(/FORCE ROW LEVEL SECURITY/);
    for (const policy of ['campaign_tasks_tenant_select', 'campaign_tasks_tenant_insert', 'campaign_tasks_tenant_update', 'campaign_tasks_tenant_delete', 'tenant_isolation']) {
      expect(migrationSrc.match(new RegExp(`CREATE POLICY ${policy}`, 'g'))?.length).toBeGreaterThanOrEqual(2);
    }
    expect(migrationSrc.match(/count mismatch/g)?.length).toBeGreaterThanOrEqual(2);
    expect(migrationSrc).toMatch(/async down/);
  });
});
