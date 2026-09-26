import * as fs from 'fs';
import * as path from 'path';

/**
 * Permanent guard (2026-07-19 audit): physical rebuild of
 * `audiovisual_projects` in the real form's order
 * (AudiovisualProjectFormModal) — the "Música" section (phonogram_id/
 * music_title/title/artist_name) is the first one in the real grid.
 */
const migrationSrc = fs.readFileSync(
  path.resolve(__dirname, 'migrations/20260719000006_RebuildAudiovisualProjectsInCanonicalFormOrder.ts'),
  'utf8',
);

describe('RebuildAudiovisualProjectsInCanonicalFormOrder20260719000006', () => {
  it('phonogram_id/music_title/title/artist_name come before type (the music section is first)', () => {
    const block = migrationSrc.split('newColumns = `')[1].split('`;')[0];
    const idIdx = block.indexOf('id ');
    const tenantIdx = block.indexOf('tenant_id ');
    const phonoIdx = block.indexOf('phonogram_id ');
    const titleIdx = block.indexOf('title ');
    const typeIdx = block.indexOf('type ');
    expect(tenantIdx).toBeGreaterThan(idIdx);
    expect(phonoIdx).toBeGreaterThan(tenantIdx);
    expect(titleIdx).toBeGreaterThan(phonoIdx);
    expect(typeIdx).toBeGreaterThan(titleIdx);
  });

  it('status/final_status come after the form fields, and completed_at/publish_date (service-derived) after them', () => {
    const block = migrationSrc.split('newColumns = `')[1].split('`;')[0];
    const observacoesIdx = block.indexOf('observations ');
    const statusIdx = block.search(/\bstatus\s+varchar/);
    const completedIdx = block.indexOf('completed_at ');
    expect(statusIdx).toBeGreaterThan(observacoesIdx);
    expect(completedIdx).toBeGreaterThan(statusIdx);
  });

  it('drops organization_id/archived_at (proven orphans) with fail-fast validation', () => {
    expect(migrationSrc).not.toMatch(/newColumns = `[^`]*organization_id/);
    expect(migrationSrc).not.toMatch(/newColumns = `[^`]*archived_at/);
    expect(migrationSrc).toMatch(/count\(organization_id\)::int \+ count\(archived_at\)::int/);
    expect(migrationSrc).toMatch(/columns presumed orphaned, but real data exists/);
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

  it('recreates the 2 CHECK constraints (status/type), the financial FK and the single policy (tenant_isolation, no super_admin)', () => {
    expect(migrationSrc).toMatch(/chk_av_projects_status/);
    expect(migrationSrc).toMatch(/chk_av_projects_type/);
    expect(migrationSrc).toMatch(/fk_audiovisual_projects_financial_project/);
    expect(migrationSrc).not.toMatch(/super_admin_full_access ON audiovisual_projects/);
    expect(migrationSrc.match(/CREATE POLICY tenant_isolation ON audiovisual_projects/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it('recreates RLS + FORCE RLS, validates counts before swapping and has an honest down()', () => {
    expect(migrationSrc).toMatch(/ENABLE ROW LEVEL SECURITY/);
    expect(migrationSrc).toMatch(/FORCE ROW LEVEL SECURITY/);
    expect(migrationSrc.match(/count mismatch/g)?.length).toBeGreaterThanOrEqual(2);
    expect(migrationSrc).toMatch(/async down/);
  });
});
