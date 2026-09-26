import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Completes the generalization of links to collective management societies
 * (ABRAMUS/ECAD/UBC/SBACEM/...) that was already PARTIALLY built in the
 * system since 2026-06-01 (`RegistryRightsHoldersIdentifiers`), but never
 * had the legacy data migrated there.
 *
 * Evidence that the generalization was already the product direction — not an
 * invention of this migration: `society-payload-builder.service.ts` (real,
 * active code of the Registry module) already reads `work.cod_abramus`/`cod_ecad` and
 * converts them on the fly into the generic format when building the society
 * submission payload:
 *
 *   if (work.cod_abramus) legacy.push({ provider: 'ABRAMUS', type: 'ABRAMUS_PROTOCOL', value: work.cod_abramus });
 *   if (work.cod_ecad)    legacy.push({ provider: 'ECAD',    type: 'ECAD_WORK_CODE',   value: work.cod_ecad });
 *
 * This migration does the same conversion, but persisting into `external_identifiers`
 * (the already existing generic, extensible table, with a CHECK that already supports
 * ABRAMUS/ECAD/CISAC/IFPI/PRO_MUSICA/ISRC/INTERNAL/OTHER — not one column
 * per society). It does not remove `works.cod_abramus`/`cod_ecad`/`phonograms.cod_abramus`/
 * `cod_ecad` in this round: those columns are still the only field exposed in the
 * active interactive form (ObraFormModal.tsx), in the official Reports
 * contract (WORKS_CONTRACT) and in the real integration module with the external
 * ABRAMUS API (`abramus.service.ts`) — removing them first requires redesigning the
 * form to support multiple societies per work (a product/UX
 * decision, not a bug fix; see docs).
 *
 * Idempotent (ON CONFLICT DO NOTHING on the already existing UNIQUE
 * `uq_ext_id_entity_value`). Does not use CASCADE. Removes no column.
 */
export class BackfillLegacySocietyCodesToExternalIdentifiers20260718000015 implements MigrationInterface {
  name = 'BackfillLegacySocietyCodesToExternalIdentifiers20260718000015';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const [{ before }] = await queryRunner.query(`
      SELECT count(*)::int AS before FROM external_identifiers
      WHERE identifier_type IN ('ABRAMUS_PROTOCOL', 'ECAD_WORK_CODE')
    `);

    await queryRunner.query(`
      INSERT INTO external_identifiers (tenant_id, entity_type, entity_id, provider, identifier_type, identifier_value, is_primary)
      SELECT tenant_id, 'WORK', id, 'ABRAMUS', 'ABRAMUS_PROTOCOL', cod_abramus, true
      FROM works WHERE cod_abramus IS NOT NULL AND btrim(cod_abramus) <> ''
      ON CONFLICT (tenant_id, entity_type, entity_id, identifier_type, identifier_value) DO NOTHING
    `);
    await queryRunner.query(`
      INSERT INTO external_identifiers (tenant_id, entity_type, entity_id, provider, identifier_type, identifier_value, is_primary)
      SELECT tenant_id, 'WORK', id, 'ECAD', 'ECAD_WORK_CODE', cod_ecad, true
      FROM works WHERE cod_ecad IS NOT NULL AND btrim(cod_ecad) <> ''
      ON CONFLICT (tenant_id, entity_type, entity_id, identifier_type, identifier_value) DO NOTHING
    `);
    await queryRunner.query(`
      INSERT INTO external_identifiers (tenant_id, entity_type, entity_id, provider, identifier_type, identifier_value, is_primary)
      SELECT tenant_id, 'RECORDING', id, 'ABRAMUS', 'ABRAMUS_PROTOCOL', cod_abramus, true
      FROM phonograms WHERE cod_abramus IS NOT NULL AND btrim(cod_abramus) <> ''
      ON CONFLICT (tenant_id, entity_type, entity_id, identifier_type, identifier_value) DO NOTHING
    `);
    await queryRunner.query(`
      INSERT INTO external_identifiers (tenant_id, entity_type, entity_id, provider, identifier_type, identifier_value, is_primary)
      SELECT tenant_id, 'RECORDING', id, 'ECAD', 'ECAD_WORK_CODE', cod_ecad, true
      FROM phonograms WHERE cod_ecad IS NOT NULL AND btrim(cod_ecad) <> ''
      ON CONFLICT (tenant_id, entity_type, entity_id, identifier_type, identifier_value) DO NOTHING
    `);

    const [{ after }] = await queryRunner.query(`
      SELECT count(*)::int AS after FROM external_identifiers
      WHERE identifier_type IN ('ABRAMUS_PROTOCOL', 'ECAD_WORK_CODE')
    `);
    // There must never be FEWER rows than existed before running — the INSERT
    // only adds (ON CONFLICT DO NOTHING is idempotent, never removes).
    if (Number(after) < Number(before)) {
      throw new Error(
        `BackfillLegacySocietyCodesToExternalIdentifiers: contagem de external_identifiers ` +
        `diminuiu (antes=${before}, depois=${after}) — migration abortada.`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Removes only what this migration may have inserted (heuristic: same
    // value already present in the legacy columns) — does not delete links
    // created by other flows (e.g. manual registration through the Registry screen).
    await queryRunner.query(`
      DELETE FROM external_identifiers ei
      WHERE ei.identifier_type = 'ABRAMUS_PROTOCOL'
        AND ei.entity_type = 'WORK'
        AND EXISTS (SELECT 1 FROM works w WHERE w.id = ei.entity_id AND w.cod_abramus = ei.identifier_value)
    `);
    await queryRunner.query(`
      DELETE FROM external_identifiers ei
      WHERE ei.identifier_type = 'ECAD_WORK_CODE'
        AND ei.entity_type = 'WORK'
        AND EXISTS (SELECT 1 FROM works w WHERE w.id = ei.entity_id AND w.cod_ecad = ei.identifier_value)
    `);
    await queryRunner.query(`
      DELETE FROM external_identifiers ei
      WHERE ei.identifier_type = 'ABRAMUS_PROTOCOL'
        AND ei.entity_type = 'RECORDING'
        AND EXISTS (SELECT 1 FROM phonograms p WHERE p.id = ei.entity_id AND p.cod_abramus = ei.identifier_value)
    `);
    await queryRunner.query(`
      DELETE FROM external_identifiers ei
      WHERE ei.identifier_type = 'ECAD_WORK_CODE'
        AND ei.entity_type = 'RECORDING'
        AND EXISTS (SELECT 1 FROM phonograms p WHERE p.id = ei.entity_id AND p.cod_ecad = ei.identifier_value)
    `);
  }
}
