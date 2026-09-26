import * as fs from 'fs';
import * as path from 'path';

/**
 * restore-ecad-add-entity-code-column.migration.spec.ts
 *
 * Permanent guard (product correction over Round 8, 2026-07-18):
 * `cod_ecad` keeps existing as its own column (ECAD is a central, mandatory
 * entity — it should not have been removed). `cod_abramus` was
 * correctly renamed to `cod_entidade` (still ONE simple
 * column — the value may be a code at any collective management
 * society: ABRAMUS, UBC, SOCINPRO, among others).
 */
const migrationSrc = fs.readFileSync(
  path.resolve(__dirname, 'migrations/20260718000017_RestoreEcadAddEntityCodeColumn.ts'),
  'utf8',
);

describe('RestoreEcadAddEntityCodeColumn20260718000017', () => {
  it('recreates cod_ecad and creates cod_entidade on works and phonograms', () => {
    expect(migrationSrc).toMatch(/ALTER TABLE works[\s\S]*ADD COLUMN IF NOT EXISTS cod_ecad/);
    expect(migrationSrc).toMatch(/ALTER TABLE works[\s\S]*ADD COLUMN IF NOT EXISTS cod_entidade/);
    expect(migrationSrc).toMatch(/ALTER TABLE phonograms[\s\S]*ADD COLUMN IF NOT EXISTS cod_ecad/);
    expect(migrationSrc).toMatch(/ALTER TABLE phonograms[\s\S]*ADD COLUMN IF NOT EXISTS cod_entidade/);
  });

  it('recreates neither cod_abramus nor per-society columns', () => {
    expect(migrationSrc).not.toMatch(/ADD COLUMN[^;]*cod_abramus/);
    expect(migrationSrc).not.toMatch(/cod_ubc|cod_sbacem|cod_socinpro|cod_assim|cod_amar|cod_sicam/i);
  });

  it('restores external_identifiers values only when there is exactly one identifier (HAVING COUNT(*) = 1)', () => {
    expect(migrationSrc).toMatch(/HAVING COUNT\(\*\) = 1/);
  });

  it('does not use DROP ... CASCADE and has a down() that drops the columns', () => {
    expect(migrationSrc).not.toMatch(/DROP\s+\w+[^;]*CASCADE/i);
    expect(migrationSrc).toMatch(/async down/);
    expect(migrationSrc).toMatch(/DROP COLUMN IF EXISTS cod_ecad/);
    expect(migrationSrc).toMatch(/DROP COLUMN IF EXISTS cod_entidade/);
  });
});
