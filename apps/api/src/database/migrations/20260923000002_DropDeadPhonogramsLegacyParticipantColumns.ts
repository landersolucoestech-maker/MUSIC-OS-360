import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Naming-closure Phase 2 audit (mechanical PT-column census +
 * producer/consumer trace) found 3 dead legacy participant-listing
 * columns on phonograms, superseded by structured participant data
 * (phonograms.participacao, jsonb) the real product form actually
 * writes to:
 *
 *   - phonograms.compositores/interpretes/produtores (three separate
 *     `text` columns) -- not present in CreatePhonogramDto
 *     (forbidNonWhitelisted would reject them outright), zero writers
 *     anywhere in apps/api or apps/web. FonogramaFormModal.tsx writes
 *     structured participant data into phonograms.participacao (jsonb)
 *     instead -- confirmed live via report-form-contracts.ts's
 *     PHONOGRAMS_CONTRACT (col('participacao')).
 *
 *     Also confirmed dead via the Reports bulk-import engine: all three
 *     are declared `ro()` in PHONOGRAMS_CONTRACT (`importable: false`),
 *     and ImportMapperService.build() resolves uploaded file headers
 *     exclusively against `def.importableColumns` (the ro()-excluded
 *     list) -- so no import file, however crafted, can route data into
 *     these three columns either. Zero writers confirmed across every
 *     path: real form, DTO, and bulk import.
 *
 * IMPORTANT — works.compositor (singular varchar) is explicitly NOT
 * included here, despite looking equally dead by the same form/DTO
 * trace: it IS `col()`-declared (importable) in WORKS_CONTRACT, and the
 * Reports bulk-import engine writes raw SQL INSERTs against
 * importableColumns directly, bypassing CreateWorkDto entirely -- a
 * real, if secondary, writer path this audit initially missed. A
 * pre-existing guard test (work-participants-normalization.spec.ts)
 * already asserts this column must stay ("writer real via bulk-import
 * (Reports)"), which is what caught the mistake before this migration
 * was ever applied to DEV.
 *
 * Zero non-null rows confirmed on all 3 columns on DEV before dropping.
 * Plain DROP COLUMN, zero data loss. down() re-adds them nullable (no
 * data to restore).
 */
export class DropDeadPhonogramsLegacyParticipantColumns20260923000002 implements MigrationInterface {
  name = 'DropDeadPhonogramsLegacyParticipantColumns20260923000002';

  public async up(qr: QueryRunner): Promise<void> {
    for (const col of ['compositores', 'interpretes', 'produtores']) {
      await qr.query(`
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'phonograms' AND column_name = '${col}'
          ) THEN
            ALTER TABLE "phonograms" DROP COLUMN "${col}";
          END IF;
        END $$;
      `);
    }
  }

  public async down(qr: QueryRunner): Promise<void> {
    for (const col of ['compositores', 'interpretes', 'produtores']) {
      await qr.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'phonograms' AND column_name = '${col}'
          ) THEN
            ALTER TABLE "phonograms" ADD COLUMN "${col}" text;
          END IF;
        END $$;
      `);
    }
  }
}
