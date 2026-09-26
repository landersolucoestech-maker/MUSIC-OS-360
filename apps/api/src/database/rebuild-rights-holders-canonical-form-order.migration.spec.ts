import * as fs from 'fs';
import * as path from 'path';

/**
 * Guarda permanente (auditoria 2026-07-19): reconstrução física de
 * `rights_holders` — sem formulário visual (registro interno do módulo
 * registry). Ordem segue CreateRightsHolderDto.
 */
const migrationSrc = fs.readFileSync(
  path.resolve(__dirname, 'migrations/20260719000013_RebuildRightsHoldersInCanonicalFormOrder.ts'),
  'utf8',
);

describe('RebuildRightsHoldersInCanonicalFormOrder20260719000013', () => {
  it('legal_name/artistic_name come right after id/tenant_id (DTO order)', () => {
    const block = migrationSrc.split('newColumns = `')[1].split('`;')[0];
    const idIdx = block.indexOf('id ');
    const tenantIdx = block.indexOf('tenant_id ');
    const legalIdx = block.indexOf('legal_name ');
    const artisticIdx = block.indexOf('artistic_name ');
    expect(tenantIdx).toBeGreaterThan(idIdx);
    expect(legalIdx).toBeGreaterThan(tenantIdx);
    expect(artisticIdx).toBeGreaterThan(legalIdx);
  });

  it('drops email_encrypted/phone_encrypted (proven orphans) with fail-fast validation', () => {
    const block = migrationSrc.split('newColumns = `')[1].split('`;')[0];
    expect(block).not.toMatch(/email_encrypted|phone_encrypted/);
    expect(migrationSrc).toMatch(/count\(email_encrypted\)::int \+ count\(phone_encrypted\)::int/);
    expect(migrationSrc).toMatch(/presumidas órfãs, mas há dado real/);
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
    expect(afterDeletedAt.replace(/timestamp,?/, '').trim()).toBe('');
  });

  it('does not use DROP ... CASCADE', () => {
    expect(migrationSrc).not.toMatch(/DROP\s+\w+[^;]*CASCADE/i);
  });

  it('recreates the holder_type CHECK, the partial unique index, RLS + policy and has an honest down()', () => {
    expect(migrationSrc).toMatch(/chk_rights_holders_holder_type/);
    expect(migrationSrc).toMatch(/uq_rights_holders_tenant_doc/);
    expect(migrationSrc).toMatch(/ENABLE ROW LEVEL SECURITY/);
    expect(migrationSrc).toMatch(/FORCE ROW LEVEL SECURITY/);
    expect(migrationSrc.match(/contagem divergente/g)?.length).toBeGreaterThanOrEqual(2);
    expect(migrationSrc).toMatch(/async down/);
  });
});
