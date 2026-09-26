import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Product correction over the previous migration (RemoveLegacySocietyCodeColumns
 * 20260718000016): the real determination is narrower than what Round 8 had
 * mandated —
 *
 *   - `cod_ecad` KEEPS existing as its own column (ECAD is a central,
 *     mandatory entity, not one among several alternative societies —
 *     it should not have been removed).
 *   - `cod_abramus` was genuinely wrong, but not because it should become
 *     a generic list (`external_identifiers`) — the field is still
 *     ONE simple column, only with the wrong name: the value may be a
 *     code at ABRAMUS, UBC, SOCINPRO, among other collective
 *     management societies, so the correct canonical name is `cod_entidade`.
 *
 * Since `cod_ecad`/`cod_abramus` were already physically removed by
 * 20260718000016 (a migration already applied and recorded — not rewritten, to
 * preserve a faithful history of what was executed), this migration is the
 * follow-up fix: it recreates `cod_ecad` and creates `cod_entidade` (replacement for
 * `cod_abramus`), restoring the data from `external_identifiers`
 * (which had already been populated by BackfillLegacySocietyCodesToExternalIdentifiers
 * 20260718000015 before the removal) whenever exactly one matching record
 * exists per entity.
 */
export class RestoreEcadAddEntityCodeColumn20260718000017 implements MigrationInterface {
  name = 'RestoreEcadAddEntityCodeColumn20260718000017';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE works
        ADD COLUMN IF NOT EXISTS cod_ecad VARCHAR(100),
        ADD COLUMN IF NOT EXISTS cod_entidade VARCHAR(100)
    `);
    await queryRunner.query(`
      ALTER TABLE phonograms
        ADD COLUMN IF NOT EXISTS cod_ecad VARCHAR(100),
        ADD COLUMN IF NOT EXISTS cod_entidade VARCHAR(100)
    `);

    // Restores values from external_identifiers, only when there is
    // EXACTLY ONE identifier of that type per entity (no arbitrary choice
    // among multiple).
    const restore = async (
      table: 'works' | 'phonograms',
      entityType: 'WORK' | 'RECORDING',
      column: 'cod_ecad' | 'cod_entidade',
      identifierType: 'ECAD_WORK_CODE' | 'ABRAMUS_PROTOCOL',
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
    await restore('works', 'WORK', 'cod_ecad', 'ECAD_WORK_CODE');
    await restore('works', 'WORK', 'cod_entidade', 'ABRAMUS_PROTOCOL');
    await restore('phonograms', 'RECORDING', 'cod_ecad', 'ECAD_WORK_CODE');
    await restore('phonograms', 'RECORDING', 'cod_entidade', 'ABRAMUS_PROTOCOL');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE works
        DROP COLUMN IF EXISTS cod_ecad,
        DROP COLUMN IF EXISTS cod_entidade
    `);
    await queryRunner.query(`
      ALTER TABLE phonograms
        DROP COLUMN IF EXISTS cod_ecad,
        DROP COLUMN IF EXISTS cod_entidade
    `);
  }
}
