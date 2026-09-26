import * as fs from 'fs';
import * as path from 'path';

/**
 * Permanent guard (2026-07-19 audit): physical rebuild of `events`
 * in the real form's order (SchedulerFormModal) — titulo/tipo are the
 * first real fields. This migration does NOT interfere with the active
 * `data`→`starts_at` dual-write phase (C3/E2): it only reorders columns.
 */
const migrationSrc = fs.readFileSync(
  path.resolve(__dirname, 'migrations/20260719000007_RebuildEventsInCanonicalFormOrder.ts'),
  'utf8',
);

describe('RebuildEventsInCanonicalFormOrder20260719000007', () => {
  it('titulo/tipo come right after id/tenant_id, and data/starts_at sit side by side', () => {
    const block = migrationSrc.split('newColumns = `')[1].split('`;')[0];
    const idIdx = block.indexOf('id ');
    const tenantIdx = block.indexOf('tenant_id ');
    const tituloIdx = block.indexOf('titulo ');
    const dataIdx = block.search(/\bdata\s+timestamp/);
    const startsAtIdx = block.indexOf('starts_at');
    expect(tenantIdx).toBeGreaterThan(idIdx);
    expect(tituloIdx).toBeGreaterThan(tenantIdx);
    expect(startsAtIdx).toBeGreaterThan(dataIdx);
    expect(startsAtIdx - dataIdx).toBeLessThan(120);
  });

  it('neither renames nor drops data/starts_at (active dual-write phase preserved)', () => {
    expect(migrationSrc).not.toMatch(/DROP COLUMN\s+"?(data|starts_at)"?/i);
    expect(migrationSrc).not.toMatch(/RENAME COLUMN\s+"?(data|starts_at)"?/i);
    expect(migrationSrc.match(/starts_at/g)?.length).toBeGreaterThanOrEqual(4);
  });

  it('drops valor (proven orphan) with fail-fast validation', () => {
    expect(migrationSrc).not.toMatch(/newColumns = `[^`]*\bvalor\b(?!_cache)/);
    expect(migrationSrc).toMatch(/count\(valor\)::int AS non_null/);
    expect(migrationSrc).toMatch(/column presumed orphaned, but real data exists/);
  });

  it('no functional field appears after metadata/created_at/updated_at/deleted_at', () => {
    const block = migrationSrc.split('newColumns = `')[1].split('`;')[0];
    const deletedAtIdx = block.indexOf('deleted_at');
    const afterDeletedAt = block.slice(deletedAtIdx + 'deleted_at'.length).trim();
    expect(afterDeletedAt.replace(/timestamp,?/, '').trim()).toBe('');
  });

  it('does not use DROP ... CASCADE', () => {
    expect(migrationSrc).not.toMatch(/DROP\s+\w+[^;]*CASCADE/i);
  });

  it('recria a FK dependente (financial_transactions), RLS + policies, valida contagem e possui down() honesto', () => {
    expect(migrationSrc.match(/ALTER TABLE financial_transactions DROP CONSTRAINT/g)?.length).toBeGreaterThanOrEqual(1);
    expect(migrationSrc.match(/ALTER TABLE financial_transactions ADD CONSTRAINT/g)?.length).toBeGreaterThanOrEqual(1);
    expect(migrationSrc).toMatch(/ENABLE ROW LEVEL SECURITY/);
    expect(migrationSrc).toMatch(/FORCE ROW LEVEL SECURITY/);
    expect(migrationSrc.match(/count mismatch/g)?.length).toBeGreaterThanOrEqual(2);
    expect(migrationSrc).toMatch(/async down/);
  });
});
