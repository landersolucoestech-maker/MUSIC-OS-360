import * as fs from 'fs';
import * as path from 'path';

/**
 * Guarda permanente (auditoria 2026-07-19): reconstrução física de `events`
 * na ordem do formulário real (SchedulerFormModal) — titulo/tipo são os
 * primeiros campos reais. Esta migration NÃO interfere na fase ativa de
 * dual-write `data`→`starts_at` (C3/E2): apenas reordena colunas.
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
    expect(migrationSrc).toMatch(/presumida órfã, mas há dado real/);
  });

  it('nenhum campo funcional aparece depois de metadata/created_at/updated_at/deleted_at', () => {
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
    expect(migrationSrc.match(/contagem divergente/g)?.length).toBeGreaterThanOrEqual(2);
    expect(migrationSrc).toMatch(/async down/);
  });
});
