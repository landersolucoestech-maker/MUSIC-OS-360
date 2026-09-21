import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * WorksService.create() had `const type = dto.type ?? dto.tipo_obra ??
 * 'composicao'` -- proven this session to ALWAYS evaluate to `dto.tipo_obra`
 * in real usage, because the real form (registro-musicas.mapper.ts's
 * formToObraPayload) never sends a `type` key at all, only `tipo_obra`
 * ('autoral'|'referencia', the catalog-origin classification from
 * ObraTipoSelectorModal.tsx -- a different concept from `type`, the
 * ABRAMUS/ECAD musical-work-type classification e.g. 'composicao'). Every
 * work created through the real product UI therefore had 'autoral' or
 * 'referencia' silently written into `type` instead of a real registry
 * classification. Fixed in code (works.service.ts no longer falls back to
 * tipo_obra); this migration corrects any row that already has the leaked
 * value.
 *
 * DEV confirmed 0 affected rows (1 total row, type='composicao' already) --
 * this migration is defensive for any other environment where the bug had
 * more opportunity to write bad data. `tipo_obra` itself is untouched; this
 * only corrects `type`.
 */
export class FixWorksTypeTipoObraCollision20260921000001 implements MigrationInterface {
  name = 'FixWorksTypeTipoObraCollision20260921000001';

  public async up(qr: QueryRunner): Promise<void> {
    const tableExists = await qr.query(`
      SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'works'
    `);
    if (tableExists.length === 0) return;

    const result = await qr.query(`
      UPDATE "works" SET "type" = 'composicao'
       WHERE "type" IN ('autoral', 'referencia')
      RETURNING id
    `);
    if (result.length > 0) {
      // eslint-disable-next-line no-console
      console.log(`[FixWorksTypeTipoObraCollision] corrected ${result.length} row(s) where type held a leaked tipo_obra value`);
    }
  }

  public async down(_qr: QueryRunner): Promise<void> {
    // Intentionally a no-op: the corrected value ('composicao') is strictly
    // more correct than the bug's leaked value, and which rows were touched
    // (and what their original tipo_obra-shaped type value was) is not
    // recoverable without a snapshot -- there is no safe, non-destructive
    // reversal.
  }
}
