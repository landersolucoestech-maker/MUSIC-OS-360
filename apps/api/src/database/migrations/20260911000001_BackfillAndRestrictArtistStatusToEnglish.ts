import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `artists.status` (`ArtistStatus`) and `artists.status_cadastro`
 * (`ArtistStatusCadastro`) in packages/types/src/enums.ts are plain
 * `varchar(50)` with no CHECK constraint, currently holding PT-BR values.
 * Same atomic deploy model and single-migration backfill+restrict pattern as
 * `20260910000003_BackfillAndRestrictArtistGoalStatusToEnglish.ts` — see that
 * file for the full rationale.
 */
export class BackfillAndRestrictArtistStatusToEnglish20260911000001
  implements MigrationInterface
{
  name = 'BackfillAndRestrictArtistStatusToEnglish20260911000001';

  private readonly statusPtToEn: Array<[string, string]> = [
    ['contratado', 'signed'],
    ['ativo', 'active'],
    ['inativo', 'inactive'],
    ['prospecto', 'prospect'],
    ['desligado', 'terminated'],
    ['suspenso', 'suspended'],
    ['ex_artista', 'former_artist'],
    ['em_negociacao', 'in_negotiation'],
  ];

  private readonly statusCadastroPtToEn: Array<[string, string]> = [
    ['ativo', 'active'],
    ['inativo', 'inactive'],
    ['suspenso', 'suspended'],
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [pt, en] of this.statusPtToEn) {
      const [{ affected }] = await queryRunner.query(
        `WITH updated AS (
           UPDATE artists SET status = $2, updated_at = now()
           WHERE status = $1
           RETURNING id
         )
         SELECT count(*)::int AS affected FROM updated`,
        [pt, en],
      );
      // eslint-disable-next-line no-console
      console.log(
        `[BackfillAndRestrictArtistStatusToEnglish] artists.status '${pt}' -> '${en}': ${affected} row(s)`,
      );
    }

    for (const [pt, en] of this.statusCadastroPtToEn) {
      const [{ affected }] = await queryRunner.query(
        `WITH updated AS (
           UPDATE artists SET status_cadastro = $2, updated_at = now()
           WHERE status_cadastro = $1
           RETURNING id
         )
         SELECT count(*)::int AS affected FROM updated`,
        [pt, en],
      );
      // eslint-disable-next-line no-console
      console.log(
        `[BackfillAndRestrictArtistStatusToEnglish] artists.status_cadastro '${pt}' -> '${en}': ${affected} row(s)`,
      );
    }

    const invalidStatus: Array<{ status: string }> = await queryRunner.query(
      `SELECT DISTINCT status
       FROM "artists"
       WHERE status NOT IN ('signed', 'active', 'inactive', 'prospect', 'terminated', 'suspended', 'former_artist', 'in_negotiation', 'onboarding')`,
    );
    if (invalidStatus.length > 0) {
      const invalidValues = invalidStatus.map((row) => row.status).join(', ');
      throw new Error(
        `BackfillAndRestrictArtistStatusToEnglish20260911000001: cannot add CHECK constraint, ` +
          `"artists"."status" contains rows with unexpected values after backfill: [${invalidValues}]. ` +
          `Fix or migrate this data before re-running this migration.`,
      );
    }

    const invalidStatusCadastro: Array<{ status_cadastro: string }> = await queryRunner.query(
      `SELECT DISTINCT status_cadastro
       FROM "artists"
       WHERE status_cadastro NOT IN ('active', 'inactive', 'suspended')`,
    );
    if (invalidStatusCadastro.length > 0) {
      const invalidValues = invalidStatusCadastro.map((row) => row.status_cadastro).join(', ');
      throw new Error(
        `BackfillAndRestrictArtistStatusToEnglish20260911000001: cannot add CHECK constraint, ` +
          `"artists"."status_cadastro" contains rows with unexpected values after backfill: [${invalidValues}]. ` +
          `Fix or migrate this data before re-running this migration.`,
      );
    }

    // Column DEFAULTs still held the old PT-BR values ('em_negociacao',
    // 'ativo') — any INSERT relying on them (no explicit status/
    // status_cadastro) would violate the CHECK constraints added below.
    await queryRunner.query(`ALTER TABLE "artists" ALTER COLUMN "status" SET DEFAULT 'in_negotiation'`);
    await queryRunner.query(`ALTER TABLE "artists" ALTER COLUMN "status_cadastro" SET DEFAULT 'active'`);

    await queryRunner.query(`
      ALTER TABLE "artists"
      ADD CONSTRAINT "chk_artists_status"
      CHECK ("status" IN ('signed', 'active', 'inactive', 'prospect', 'terminated', 'suspended', 'former_artist', 'in_negotiation', 'onboarding'))
    `);
    await queryRunner.query(`
      ALTER TABLE "artists"
      ADD CONSTRAINT "chk_artists_status_cadastro"
      CHECK ("status_cadastro" IN ('active', 'inactive', 'suspended'))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "artists" DROP CONSTRAINT IF EXISTS "chk_artists_status"`);
    await queryRunner.query(`ALTER TABLE "artists" DROP CONSTRAINT IF EXISTS "chk_artists_status_cadastro"`);
    await queryRunner.query(`ALTER TABLE "artists" ALTER COLUMN "status" SET DEFAULT 'em_negociacao'`);
    await queryRunner.query(`ALTER TABLE "artists" ALTER COLUMN "status_cadastro" SET DEFAULT 'ativo'`);

    for (const [pt, en] of this.statusPtToEn) {
      await queryRunner.query(
        `UPDATE artists SET status = $1, updated_at = now() WHERE status = $2`,
        [pt, en],
      );
    }
    for (const [pt, en] of this.statusCadastroPtToEn) {
      await queryRunner.query(
        `UPDATE artists SET status_cadastro = $1, updated_at = now() WHERE status_cadastro = $2`,
        [pt, en],
      );
    }
  }
}
