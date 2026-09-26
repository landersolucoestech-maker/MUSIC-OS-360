import * as fs from 'fs';
import * as path from 'path';

/**
 * Permanent guard (2026-07-19 audit): physical rebuild of
 * `org_members`. No real creation form (invite flow via
 * UsersService); `phone` (stuck after the audit block) goes back to the functional
 * zone; `role_id`/`department_id`/`position_id`/`org_id` are technical
 * relations repositioned before the audit block.
 */
const migrationSrc = fs.readFileSync(
  path.resolve(__dirname, 'migrations/20260719000020_RebuildOrgMembersInCanonicalFormOrder.ts'),
  'utf8',
);

describe('RebuildOrgMembersInCanonicalFormOrder20260719000020', () => {
  const block = () => migrationSrc.split('newColumns = `')[1].split('`;')[0];

  it('email/full_name/phone/role/is_active sit in the functional zone, before the technical relations', () => {
    const b = block();
    const emailIdx = b.indexOf('email');
    const fullNameIdx = b.indexOf('full_name');
    const phoneIdx = b.indexOf('phone');
    const roleIdx = b.search(/\brole\s+varchar/);
    const isActiveIdx = b.indexOf('is_active');
    const orgIdIdx = b.indexOf('org_id');
    const roleIdIdx = b.indexOf('role_id');
    expect(fullNameIdx).toBeGreaterThan(emailIdx);
    expect(phoneIdx).toBeGreaterThan(fullNameIdx);
    expect(roleIdx).toBeGreaterThan(phoneIdx);
    expect(isActiveIdx).toBeGreaterThan(roleIdx);
    expect(orgIdIdx).toBeGreaterThan(isActiveIdx);
    expect(roleIdIdx).toBeGreaterThan(orgIdIdx);
  });

  it('technical relations (org_id/role_id/department_id/position_id) come before joined_at and the audit block', () => {
    const b = block();
    const positionIdIdx = b.indexOf('position_id');
    const joinedAtIdx = b.indexOf('joined_at');
    const createdAtIdx = b.indexOf('created_at');
    expect(joinedAtIdx).toBeGreaterThan(positionIdIdx);
    expect(createdAtIdx).toBeGreaterThan(joinedAtIdx);
  });

  it('the audit block is created_at -> updated_at -> created_by -> updated_by -> deleted_at', () => {
    const b = block();
    const createdAtIdx = b.indexOf('created_at');
    const updatedAtIdx = b.indexOf('updated_at');
    const createdByIdx = b.indexOf('created_by');
    const updatedByIdx = b.indexOf('updated_by');
    const deletedAtIdx = b.indexOf('deleted_at');
    expect(updatedAtIdx).toBeGreaterThan(createdAtIdx);
    expect(createdByIdx).toBeGreaterThan(updatedAtIdx);
    expect(updatedByIdx).toBeGreaterThan(createdByIdx);
    expect(deletedAtIdx).toBeGreaterThan(updatedByIdx);
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

  it('drops and recreates the dependent FK (membership_job_functions) and the 3 own FKs (role/department/position)', () => {
    expect(migrationSrc).toMatch(/ALTER TABLE membership_job_functions DROP CONSTRAINT fk_mjf_membership/);
    expect(migrationSrc.match(/FOREIGN KEY \(membership_id\) REFERENCES org_members\(id\) ON DELETE CASCADE/g)?.length).toBeGreaterThanOrEqual(2);
    expect(migrationSrc.match(/FOREIGN KEY \(role_id\) REFERENCES roles\(id\) ON DELETE RESTRICT/g)?.length).toBeGreaterThanOrEqual(2);
    expect(migrationSrc.match(/FOREIGN KEY \(department_id\) REFERENCES departments\(id\) ON DELETE SET NULL/g)?.length).toBeGreaterThanOrEqual(2);
    expect(migrationSrc.match(/FOREIGN KEY \(position_id\) REFERENCES positions\(id\) ON DELETE SET NULL/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it('recria RLS + as duas policies (tenant_isolation, super_admin_full_access) e possui down() honesto', () => {
    expect(migrationSrc).toMatch(/ENABLE ROW LEVEL SECURITY/);
    expect(migrationSrc).toMatch(/FORCE ROW LEVEL SECURITY/);
    expect(migrationSrc.match(/CREATE POLICY tenant_isolation/g)?.length).toBeGreaterThanOrEqual(2);
    expect(migrationSrc.match(/CREATE POLICY super_admin_full_access/g)?.length).toBeGreaterThanOrEqual(2);
    expect(migrationSrc.match(/count mismatch/g)?.length).toBeGreaterThanOrEqual(2);
    expect(migrationSrc).toMatch(/async down/);
  });
});
