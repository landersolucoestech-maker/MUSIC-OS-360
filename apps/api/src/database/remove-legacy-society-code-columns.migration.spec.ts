import * as fs from 'fs';
import * as path from 'path';

/**
 * remove-legacy-society-code-columns.migration.spec.ts
 *
 * Guarda permanente (auditoria 2026-07-18 Rodada 8): a migration remove
 * definitivamente `cod_abramus`/`cod_ecad`/`abramus_protocol` de
 * works/phonograms, com validação fail-fast de que tudo já está em
 * external_identifiers antes de dropar qualquer coluna.
 */
const migrationSrc = fs.readFileSync(
  path.resolve(__dirname, 'migrations/20260718000016_RemoveLegacySocietyCodeColumns.ts'),
  'utf8',
);

describe('RemoveLegacySocietyCodeColumns20260718000016', () => {
  it('remove cod_abramus/cod_ecad/abramus_protocol de works e phonograms', () => {
    expect(migrationSrc).toMatch(/ALTER TABLE works[\s\S]*DROP COLUMN IF EXISTS cod_abramus/);
    expect(migrationSrc).toMatch(/ALTER TABLE works[\s\S]*DROP COLUMN IF EXISTS cod_ecad/);
    expect(migrationSrc).toMatch(/ALTER TABLE works[\s\S]*DROP COLUMN IF EXISTS abramus_protocol/);
    expect(migrationSrc).toMatch(/ALTER TABLE phonograms[\s\S]*DROP COLUMN IF EXISTS cod_abramus/);
    expect(migrationSrc).toMatch(/ALTER TABLE phonograms[\s\S]*DROP COLUMN IF EXISTS cod_ecad/);
    expect(migrationSrc).toMatch(/ALTER TABLE phonograms[\s\S]*DROP COLUMN IF EXISTS abramus_protocol/);
  });

  it('validates fail-fast (NOT EXISTS in external_identifiers) before dropping any column', () => {
    expect(migrationSrc).toMatch(/assertFullyMigrated/);
    expect(migrationSrc).toMatch(/NOT EXISTS/);
    expect(migrationSrc).toMatch(/throw new Error/);
  });

  it('creates no per-society column (never cod_ubc/cod_sbacem/...)', () => {
    expect(migrationSrc).not.toMatch(/cod_ubc|cod_sbacem|cod_socinpro|cod_assim|cod_amar|cod_sicam/i);
  });

  it('does not use DROP ... CASCADE', () => {
    expect(migrationSrc).not.toMatch(/DROP\s+\w+[^;]*CASCADE/i);
  });

  it('has an honest down() — rehydrates only when there is exactly one identifier (HAVING COUNT(*) = 1)', () => {
    expect(migrationSrc).toMatch(/async down/);
    expect(migrationSrc).toMatch(/HAVING COUNT\(\*\) = 1/);
  });
});
