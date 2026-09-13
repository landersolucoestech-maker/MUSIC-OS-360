import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 20260913000001_RenameSharePartyFieldsToEnglish
 *
 * Naming-normalization mandate: the last 8 live PT-BR column names on
 * `shares` (missed by the earlier tipo/data_inicio/data_fim/artista_id/
 * obra_id rename waves — 20260905000003..8) get their English canonical
 * name here:
 *   titular_nome   -> holder_name
 *   titular_doc    -> holder_document
 *   papel          -> party_role   (NOT `role` — `shares.role`, added by
 *                                    20260601000001_RegistryFieldsPhase1,
 *                                    is a distinct, already-English,
 *                                    live ABRAMUS/ECAD registry-role
 *                                    concept read via `s.role ?? s.papel`
 *                                    in entity-validators.ts and
 *                                    society-payload-builder.service.ts;
 *                                    reusing `role` for this rename would
 *                                    collide with that column/property and
 *                                    silently corrupt the fallback.
 *                                    `party_role` distinguishes the party's
 *                                    role within the split from that
 *                                    registry-submission role without
 *                                    touching the existing column at all.)
 *   percentual     -> percentage
 *   direcao        -> direction
 *   nome_musica    -> music_title
 *   detentor       -> holder
 *   destinatario   -> recipient
 *
 * `RENAME COLUMN` is metadata-only in Postgres (no rewrite, no data
 * movement). Guarded with `IF EXISTS` so this is safe to re-run and a
 * no-op if the column is already renamed or absent.
 */
export class RenameSharePartyFieldsToEnglish20260913000001 implements MigrationInterface {
  name = 'RenameSharePartyFieldsToEnglish20260913000001';

  private readonly renames: Array<[from: string, to: string]> = [
    ['titular_nome', 'holder_name'],
    ['titular_doc', 'holder_document'],
    ['papel', 'party_role'],
    ['percentual', 'percentage'],
    ['direcao', 'direction'],
    ['nome_musica', 'music_title'],
    ['detentor', 'holder'],
    ['destinatario', 'recipient'],
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [from, to] of this.renames) {
      await queryRunner.query(`
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'shares' AND column_name = '${from}'
          ) THEN
            ALTER TABLE "shares" RENAME COLUMN "${from}" TO "${to}";
          END IF;
        END $$;
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const [from, to] of this.renames) {
      await queryRunner.query(`
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'shares' AND column_name = '${to}'
          ) THEN
            ALTER TABLE "shares" RENAME COLUMN "${to}" TO "${from}";
          END IF;
        END $$;
      `);
    }
  }
}
