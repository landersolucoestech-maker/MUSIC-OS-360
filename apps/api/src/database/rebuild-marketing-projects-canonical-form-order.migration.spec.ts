import * as fs from 'fs';
import * as path from 'path';

/**
 * Guarda permanente (auditoria 2026-07-19): reconstrução física de
 * `marketing_projects`. Sem formulário visual real (projectFields nunca é
 * importado) — ordem segue CreateMarketingProjectDto.
 */
const migrationSrc = fs.readFileSync(
  path.resolve(__dirname, 'migrations/20260719000008_RebuildMarketingProjectsInCanonicalFormOrder.ts'),
  'utf8',
);

describe('RebuildMarketingProjectsInCanonicalFormOrder20260719000008', () => {
  it('type/title come right after id/tenant_id, following the DTO order', () => {
    const block = migrationSrc.split('newColumns = `')[1].split('`;')[0];
    const idIdx = block.indexOf('id ');
    const tenantIdx = block.indexOf('tenant_id ');
    const typeIdx = block.search(/\btype\s+varchar/);
    const titleIdx = block.indexOf('title ');
    expect(tenantIdx).toBeGreaterThan(idIdx);
    expect(typeIdx).toBeGreaterThan(tenantIdx);
    expect(titleIdx).toBeGreaterThan(typeIdx);
  });

  it('financial_project_id sits with the technical relations (before starts_at), not after deleted_at', () => {
    const block = migrationSrc.split('newColumns = `')[1].split('`;')[0];
    const campaignIdx = block.indexOf('campaign_id');
    const financialIdx = block.indexOf('financial_project_id');
    const startsAtIdx = block.indexOf('starts_at');
    expect(financialIdx).toBeGreaterThan(campaignIdx);
    expect(startsAtIdx).toBeGreaterThan(financialIdx);
  });

  it('drops organization_id (proven orphan) with fail-fast validation', () => {
    expect(migrationSrc).not.toMatch(/newColumns = `[^`]*organization_id/);
    expect(migrationSrc).toMatch(/count\(organization_id\)::int AS non_null/);
    expect(migrationSrc).toMatch(/presumida órfã, mas há dado real/);
  });

  it('the audit block is created_at -> updated_at -> created_by -> updated_by -> deleted_at', () => {
    const block = migrationSrc.split('newColumns = `')[1].split('`;')[0];
    const createdAtIdx = block.indexOf('created_at');
    const updatedAtIdx = block.indexOf('updated_at');
    const createdByIdx = block.indexOf('created_by');
    const updatedByIdx = block.indexOf('updated_by');
    const deletedAtIdx = block.indexOf('deleted_at');
    expect(updatedAtIdx).toBeGreaterThan(createdAtIdx);
    expect(createdByIdx).toBeGreaterThan(updatedAtIdx);
    expect(updatedByIdx).toBeGreaterThan(createdByIdx);
    expect(deletedAtIdx).toBeGreaterThan(updatedByIdx);
    const afterDeletedAt = block.slice(deletedAtIdx + 'deleted_at'.length).trim();
    expect(afterDeletedAt.replace(/timestamptz,?/, '').trim()).toBe('');
  });

  it('does not use DROP ... CASCADE', () => {
    expect(migrationSrc).not.toMatch(/DROP\s+\w+[^;]*CASCADE/i);
  });

  it('recria os 3 CHECK constraints, a FK financeira, RLS + policy e possui down() honesto', () => {
    expect(migrationSrc).toMatch(/chk_marketing_projects_type/);
    expect(migrationSrc).toMatch(/chk_marketing_projects_status/);
    expect(migrationSrc).toMatch(/chk_marketing_projects_priority/);
    expect(migrationSrc).toMatch(/fk_marketing_projects_financial_project/);
    expect(migrationSrc).toMatch(/ENABLE ROW LEVEL SECURITY/);
    expect(migrationSrc).toMatch(/FORCE ROW LEVEL SECURITY/);
    expect(migrationSrc.match(/contagem divergente/g)?.length).toBeGreaterThanOrEqual(2);
    expect(migrationSrc).toMatch(/async down/);
  });
});
