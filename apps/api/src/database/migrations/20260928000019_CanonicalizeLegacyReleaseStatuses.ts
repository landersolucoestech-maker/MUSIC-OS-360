import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 20260928000019_CanonicalizeLegacyReleaseStatuses
 *
 * Also completes the release `type` census (CZ-038 re-review M-2): besides
 * compilacao/outro (migration 20260928000016) the pre-API app wrote
 * álbum/lp -> album, compilação -> compilation and clipe/vídeo/videoclipe ->
 * video (a type the release-checklist automation already handles).
 * `upc` is backfilled from the legacy metadata.upc where the column is empty
 * (20260928000016 backfilled the other metadata-only fields; forward-only,
 * nothing overwritten, values longer than varchar(20) skipped).
 *
 * CZ-038 follow-up (independent UI review): `releases.status` has no CHECK and
 * rows written by the pre-API app may still hold Portuguese statuses, which
 * the web only tolerated through a display map. Every value with an
 * unambiguous `ReleaseStatus` equivalent is mapped here:
 *   rascunho/em_producao/incompleto -> draft
 *   planejado/programado/aguardando_distribuicao -> scheduled
 *   enviado/analise/em_analise/pendente/pronto_para_envio -> review
 *   aprovado -> approved; publicado/ativo -> released;
 *   distribuido/distribuida -> distributed; cancelado -> cancelled;
 *   arquivado -> archived
 * rejeitado / takedown / take_down / remocao have no ReleaseStatus equivalent
 * (the workflow has no rejected / taken-down state) and are left untouched;
 * adding chk_releases_status waits on that product decision
 * (canonical map blocker BLK-RELEASES-STATUS-CHECK).
 * down() is a no-op: the original Portuguese spelling of each row is not
 * recorded, and every mapped value is a valid status for the old code.
 */
const LEGACY_STATUSES: ReadonlyArray<[legacy: string, canonical: string]> = [
  ['rascunho', 'draft'], ['em_producao', 'draft'], ['incompleto', 'draft'],
  ['planejado', 'scheduled'], ['programado', 'scheduled'], ['aguardando_distribuicao', 'scheduled'],
  ['enviado', 'review'], ['analise', 'review'], ['em_analise', 'review'], ['pendente', 'review'],
  ['pronto_para_envio', 'review'],
  ['aprovado', 'approved'], ['publicado', 'released'], ['ativo', 'released'],
  ['distribuido', 'distributed'], ['distribuida', 'distributed'],
  ['cancelado', 'cancelled'], ['arquivado', 'archived'],
];

const LEGACY_TYPES: ReadonlyArray<[legacy: string, canonical: string]> = [
  ['álbum', 'album'], ['lp', 'album'], ['compilação', 'compilation'],
  ['clipe', 'video'], ['vídeo', 'video'], ['videoclipe', 'video'],
];

export class CanonicalizeLegacyReleaseStatuses20260928000019 implements MigrationInterface {
  name = 'CanonicalizeLegacyReleaseStatuses20260928000019';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [legacy, canonical] of LEGACY_STATUSES) {
      await queryRunner.query(`UPDATE "releases" SET "status" = $1 WHERE lower("status") = $2`, [canonical, legacy]);
    }
    for (const [legacy, canonical] of LEGACY_TYPES) {
      await queryRunner.query(`UPDATE "releases" SET "type" = $1 WHERE lower(trim("type")) = $2`, [canonical, legacy]);
    }
    await queryRunner.query(`
      UPDATE "releases" SET "upc" = NULLIF("metadata"->>'upc', '')
      WHERE "upc" IS NULL AND jsonb_typeof("metadata") = 'object'
        AND "metadata" ? 'upc' AND length("metadata"->>'upc') <= 20`);
  }

  public async down(): Promise<void> {
    // Intentionally empty — see the header.
  }
}
