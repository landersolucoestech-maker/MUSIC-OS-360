import * as fs from 'fs';
import * as path from 'path';

/**
 * backfill-society-codes.migration.spec.ts
 *
 * Permanent guard (2026-07-18 audit — generalization of collective
 * management entities): the migration completes a generalization that was already
 * partially built (`external_identifiers`, 2026-06-01) but never
 * had the legacy data (`works.cod_abramus`/`cod_ecad`,
 * `phonograms.cod_abramus`/`cod_ecad`) migrated. It does not remove the legacy
 * columns (still used by an active form, the Reports contract and the
 * real integration with the ABRAMUS API) — it only populates the generic
 * table, additively and idempotently.
 */
const migrationSrc = fs.readFileSync(
  path.resolve(__dirname, 'migrations/20260718000015_BackfillLegacySocietyCodesToExternalIdentifiers.ts'),
  'utf8',
);

describe('BackfillLegacySocietyCodesToExternalIdentifiers20260718000015', () => {
  it('migrates works.cod_abramus/cod_ecad and phonograms.cod_abramus/cod_ecad to external_identifiers', () => {
    expect(migrationSrc).toMatch(/FROM works WHERE cod_abramus/);
    expect(migrationSrc).toMatch(/FROM works WHERE cod_ecad/);
    expect(migrationSrc).toMatch(/FROM phonograms WHERE cod_abramus/);
    expect(migrationSrc).toMatch(/FROM phonograms WHERE cod_ecad/);
  });

  it('uses the existing generic providers/identifier_types (no per-society column)', () => {
    expect(migrationSrc).toMatch(/'ABRAMUS', 'ABRAMUS_PROTOCOL'/);
    expect(migrationSrc).toMatch(/'ECAD', 'ECAD_WORK_CODE'/);
    expect(migrationSrc).not.toMatch(/cod_ubc|cod_socinpro|cod_sbacem|cod_assim/i);
  });

  it('is idempotent (ON CONFLICT DO NOTHING) and does not use DROP ... CASCADE', () => {
    expect(migrationSrc).toMatch(/ON CONFLICT \(tenant_id, entity_type, entity_id, identifier_type, identifier_value\) DO NOTHING/);
    expect(migrationSrc).not.toMatch(/DROP\s+\w+[^;]*CASCADE/i);
  });

  it('does not drop the legacy columns in this round (additive only)', () => {
    expect(migrationSrc).not.toMatch(/DROP COLUMN.*cod_abramus/i);
    expect(migrationSrc).not.toMatch(/DROP COLUMN.*cod_ecad/i);
  });

  it('aborta se a contagem de external_identifiers diminuir (fail-fast)', () => {
    expect(migrationSrc).toMatch(/if \(Number\(after\) < Number\(before\)\)/);
    expect(migrationSrc).toMatch(/throw new Error/);
  });

  it('has a down() that removes only what matches the legacy columns still present', () => {
    expect(migrationSrc).toMatch(/async down/);
    expect(migrationSrc).toMatch(/DELETE FROM external_identifiers/);
  });
});
