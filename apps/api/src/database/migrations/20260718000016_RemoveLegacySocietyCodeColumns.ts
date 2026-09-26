import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Removes the fixed per-society physical columns (`cod_abramus`, `cod_ecad` in
 * `works`/`phonograms`) and the orphan column `abramus_protocol` (never written by
 * any real flow — `RegistryFieldsPhase1` 20260601000001) — audit
 * Round 8, 2026-07-18: the platform is not exclusive to one collective
 * management society (ABRAMUS/ECAD/UBC/SBACEM/AMAR/SICAM/SOCINPRO/ASSIM/...) and
 * cannot have one canonical column per society.
 *
 * The replacement — `external_identifiers` (generic, existing since
 * 20260601000002) — was already backfilled from the legacy values by
 * migration BackfillLegacySocietyCodesToExternalIdentifiers20260718000015.
 * Before removing any column, this migration validates that EVERY non-null
 * value in cod_abramus/cod_ecad has a matching row in
 * external_identifiers (same tenant_id/entity_type/entity_id/identifier_type/
 * identifier_value) — aborts with an error (fail-fast) if it finds any orphan
 * (unmigrated) value, without trying to fix it silently.
 *
 * Does not use CASCADE. No index/constraint/FK references these columns
 * (confirmed by an exhaustive search of the existing migrations).
 */
export class RemoveLegacySocietyCodeColumns20260718000016 implements MigrationInterface {
  name = 'RemoveLegacySocietyCodeColumns20260718000016';

  private async assertFullyMigrated(
    queryRunner: QueryRunner,
    table: 'works' | 'phonograms',
    entityType: 'WORK' | 'RECORDING',
    column: 'cod_abramus' | 'cod_ecad',
    identifierType: 'ABRAMUS_PROTOCOL' | 'ECAD_WORK_CODE',
  ): Promise<void> {
    const orphans = await queryRunner.query(`
      SELECT t.id, t.tenant_id, t.${column} AS value
      FROM ${table} t
      WHERE t.${column} IS NOT NULL AND btrim(t.${column}) <> ''
        AND NOT EXISTS (
          SELECT 1 FROM external_identifiers ei
          WHERE ei.tenant_id = t.tenant_id
            AND ei.entity_type = '${entityType}'
            AND ei.entity_id = t.id
            AND ei.identifier_type = '${identifierType}'
            AND ei.identifier_value = t.${column}
        )
    `);
    if (orphans.length > 0) {
      throw new Error(
        `RemoveLegacySocietyCodeColumns: ${orphans.length} valor(es) de ${table}.${column} sem ` +
        `correspondência em external_identifiers (identifier_type=${identifierType}) — migration abortada. ` +
        `Exemplo: id=${orphans[0].id} tenant_id=${orphans[0].tenant_id} value=${orphans[0].value}`,
      );
    }
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1-4. Fail-fast validation: every non-null cod_abramus/cod_ecad is already in external_identifiers.
    await this.assertFullyMigrated(queryRunner, 'works', 'WORK', 'cod_abramus', 'ABRAMUS_PROTOCOL');
    await this.assertFullyMigrated(queryRunner, 'works', 'WORK', 'cod_ecad', 'ECAD_WORK_CODE');
    await this.assertFullyMigrated(queryRunner, 'phonograms', 'RECORDING', 'cod_abramus', 'ABRAMUS_PROTOCOL');
    await this.assertFullyMigrated(queryRunner, 'phonograms', 'RECORDING', 'cod_ecad', 'ECAD_WORK_CODE');

    // 5-6. No index/constraint/CHECK depends on these columns (confirmed by an
    // exhaustive search). abramus_protocol never had real data written (verified:
    // no DTO/service/frontend ever read or wrote this column).
    await queryRunner.query(`
      ALTER TABLE works
        DROP COLUMN IF EXISTS cod_abramus,
        DROP COLUMN IF EXISTS cod_ecad,
        DROP COLUMN IF EXISTS abramus_protocol
    `);
    await queryRunner.query(`
      ALTER TABLE phonograms
        DROP COLUMN IF EXISTS cod_abramus,
        DROP COLUMN IF EXISTS cod_ecad,
        DROP COLUMN IF EXISTS abramus_protocol
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE works
        ADD COLUMN IF NOT EXISTS cod_abramus VARCHAR(100),
        ADD COLUMN IF NOT EXISTS cod_ecad VARCHAR(100),
        ADD COLUMN IF NOT EXISTS abramus_protocol VARCHAR(100)
    `);
    await queryRunner.query(`
      ALTER TABLE phonograms
        ADD COLUMN IF NOT EXISTS cod_abramus VARCHAR(100),
        ADD COLUMN IF NOT EXISTS cod_ecad VARCHAR(100),
        ADD COLUMN IF NOT EXISTS abramus_protocol VARCHAR(100)
    `);

    // Honest reversal: only rehydrates the column when there is EXACTLY ONE
    // matching identifier (no CASCADE, no arbitrary choice
    // among multiple records when the work/phonogram has more than one).
    const restore = async (
      table: 'works' | 'phonograms',
      entityType: 'WORK' | 'RECORDING',
      column: 'cod_abramus' | 'cod_ecad',
      identifierType: 'ABRAMUS_PROTOCOL' | 'ECAD_WORK_CODE',
    ) => {
      await queryRunner.query(`
        UPDATE ${table} t
        SET ${column} = single.identifier_value
        FROM (
          SELECT entity_id, tenant_id, MIN(identifier_value) AS identifier_value
          FROM external_identifiers
          WHERE entity_type = '${entityType}' AND identifier_type = '${identifierType}'
          GROUP BY entity_id, tenant_id
          HAVING COUNT(*) = 1
        ) single
        WHERE t.id = single.entity_id AND t.tenant_id = single.tenant_id
      `);
    };
    await restore('works', 'WORK', 'cod_abramus', 'ABRAMUS_PROTOCOL');
    await restore('works', 'WORK', 'cod_ecad', 'ECAD_WORK_CODE');
    await restore('phonograms', 'RECORDING', 'cod_abramus', 'ABRAMUS_PROTOCOL');
    await restore('phonograms', 'RECORDING', 'cod_ecad', 'ECAD_WORK_CODE');
  }
}
