import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 20260918000042_RenameMetaValorValorAtualOnArtistGoals
 *
 * Cluster G (naming-normalization mandate):
 * artist_goals.meta_valor -> target_value (the goal's target),
 * artist_goals.valor_atual -> current_value (the goal's current
 * progress). Direct DTO passthrough (ArtistGoalsService.create/update
 * spread `...dto` straight onto the entity, no explicit mapping).
 *
 * `RENAME COLUMN` is metadata-only in Postgres (no rewrite, no data
 * movement). Guarded with `IF EXISTS` so this is safe to re-run and a
 * no-op if the columns are already renamed or absent.
 */
export class RenameMetaValorValorAtualOnArtistGoals20260918000042 implements MigrationInterface {
  name = 'RenameMetaValorValorAtualOnArtistGoals20260918000042';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'artist_goals' AND column_name = 'meta_valor'
        ) THEN
          ALTER TABLE "artist_goals" RENAME COLUMN "meta_valor" TO "target_value";
        END IF;
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'artist_goals' AND column_name = 'valor_atual'
        ) THEN
          ALTER TABLE "artist_goals" RENAME COLUMN "valor_atual" TO "current_value";
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'artist_goals' AND column_name = 'target_value'
        ) THEN
          ALTER TABLE "artist_goals" RENAME COLUMN "target_value" TO "meta_valor";
        END IF;
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'artist_goals' AND column_name = 'current_value'
        ) THEN
          ALTER TABLE "artist_goals" RENAME COLUMN "current_value" TO "valor_atual";
        END IF;
      END $$;
    `);
  }
}
