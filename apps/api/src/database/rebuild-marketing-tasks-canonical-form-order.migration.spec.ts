import * as fs from 'fs';
import * as path from 'path';

/**
 * Permanent guard (2026-07-19 audit): physical rebuild of
 * `marketing_tasks` in the order of CreateMarketingTaskDto/taskCreateFields.
 */
const migrationSrc = fs.readFileSync(
  path.resolve(__dirname, 'migrations/20260719000009_RebuildMarketingTasksInCanonicalFormOrder.ts'),
  'utf8',
);

describe('RebuildMarketingTasksInCanonicalFormOrder20260719000009', () => {
  it('marketing_project_id (parent FK) comes right after id/tenant_id, followed by title', () => {
    const block = migrationSrc.split('newColumns = `')[1].split('`;')[0];
    const idIdx = block.indexOf('id ');
    const tenantIdx = block.indexOf('tenant_id ');
    const parentIdx = block.indexOf('marketing_project_id');
    const titleIdx = block.indexOf('title ');
    expect(tenantIdx).toBeGreaterThan(idIdx);
    expect(parentIdx).toBeGreaterThan(tenantIdx);
    expect(titleIdx).toBeGreaterThan(parentIdx);
  });

  it('completed_at (business-derived) comes right after status, and task_key (control, service-generated) sits with metadata', () => {
    const block = migrationSrc.split('newColumns = `')[1].split('`;')[0];
    const statusIdx = block.search(/\bstatus\s+varchar/);
    const completedIdx = block.indexOf('completed_at');
    const dependenciesIdx = block.indexOf('dependencies');
    const taskKeyIdx = block.indexOf('task_key');
    const metadataIdx = block.search(/\bmetadata\s+jsonb/);
    expect(completedIdx).toBeGreaterThan(statusIdx);
    expect(completedIdx - statusIdx).toBeLessThan(80);
    expect(taskKeyIdx).toBeGreaterThan(dependenciesIdx);
    expect(metadataIdx).toBeGreaterThan(taskKeyIdx);
  });

  it('no functional field appears after metadata/created_at/updated_at/deleted_at', () => {
    const block = migrationSrc.split('newColumns = `')[1].split('`;')[0];
    const deletedAtIdx = block.indexOf('deleted_at');
    const afterDeletedAt = block.slice(deletedAtIdx + 'deleted_at'.length).trim();
    expect(afterDeletedAt.replace(/timestamptz,?/, '').trim()).toBe('');
  });

  it('does not use DROP ... CASCADE', () => {
    expect(migrationSrc).not.toMatch(/DROP\s+\w+[^;]*CASCADE/i);
  });

  it('recreates the 2 CHECK constraints, the unique index (tenant/project/task_key), RLS + policy and has an honest down()', () => {
    expect(migrationSrc).toMatch(/chk_marketing_tasks_status/);
    expect(migrationSrc).toMatch(/chk_marketing_tasks_priority/);
    expect(migrationSrc).toMatch(/uq_marketing_tasks_project_key/);
    expect(migrationSrc).toMatch(/ENABLE ROW LEVEL SECURITY/);
    expect(migrationSrc).toMatch(/FORCE ROW LEVEL SECURITY/);
    expect(migrationSrc.match(/count mismatch/g)?.length).toBeGreaterThanOrEqual(2);
    expect(migrationSrc).toMatch(/async down/);
  });
});
