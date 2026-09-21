import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * phonograms.instrumental was already boolean-typed correctly (unlike
 * works.instrumental, a varchar('sim'|'nao') form field kept separate from
 * works.is_instrumental via derivation -- see work-registry-fields.util.ts)
 * -- only its name was Portuguese. No registry payload reads it
 * (buildRecordingPayload's returned `recording` object has no
 * is_instrumental field), so this is a pure naming closure, not a
 * functional fix. Plain rename, no type change, no data transformation.
 */
export class RenamePhonogramInstrumentalToEnglish20260921000002 implements MigrationInterface {
  name = 'RenamePhonogramInstrumentalToEnglish20260921000002';

  public async up(qr: QueryRunner): Promise<void> {
    await qr.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'phonograms' AND column_name = 'instrumental'
        ) THEN
          ALTER TABLE "phonograms" RENAME COLUMN "instrumental" TO "is_instrumental";
        END IF;
      END $$;
    `);
  }

  public async down(qr: QueryRunner): Promise<void> {
    await qr.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'phonograms' AND column_name = 'is_instrumental'
        ) THEN
          ALTER TABLE "phonograms" RENAME COLUMN "is_instrumental" TO "instrumental";
        END IF;
      END $$;
    `);
  }
}
