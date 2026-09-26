import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 5 / C6 — fixes the contamination between financial fields (detentor,
 * artista_externo, pagador, destinatario) and the ownership fields used
 * by the ABRAMUS/ECAD submission (titular_nome, percentual).
 *
 * `titular_nome`/`percentual` were NOT NULL without a default, which forced
 * shares.service.ts::create() to derive `titular_nome` from an unrelated financial
 * field (or use the literal 'N/D') whenever the financial
 * form (SharePendenteFormModal) created a share without registration data.
 * That contaminated the submission payload sent to copyright societies.
 *
 * This migration only relaxes the NOT NULL constraint — it does not change the type,
 * precision, scale nor any other behavior of the `percentual` column
 * (numeric(7,4), no transformer, returned as a string by TypeORM).
 */
export class MakeShareRegistryFieldsNullable20260715000001 implements MigrationInterface {
  name = 'MakeShareRegistryFieldsNullable20260715000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "shares"
        ALTER COLUMN "titular_nome" DROP NOT NULL,
        ALTER COLUMN "percentual" DROP NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const [{ bad_count: badCount }] = await queryRunner.query(`
      SELECT count(*)::int AS bad_count
      FROM "shares"
      WHERE "titular_nome" IS NULL OR "percentual" IS NULL
    `);

    if (badCount > 0) {
      throw new Error(
        `Rollback abortado: ${badCount} linha(s) em "shares" possuem titular_nome ` +
        `ou percentual NULL. Restaurar NOT NULL exigiria inventar dado nessas ` +
        `linhas (o que esta migration foi feita para eliminar). Resolva ` +
        `manualmente os registros afetados antes de reverter — nenhuma alteração foi feita.`,
      );
    }

    await queryRunner.query(`
      ALTER TABLE "shares"
        ALTER COLUMN "titular_nome" SET NOT NULL,
        ALTER COLUMN "percentual" SET NOT NULL
    `);
  }
}
