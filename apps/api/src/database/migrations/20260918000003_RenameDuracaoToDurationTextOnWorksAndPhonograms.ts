import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 20260918000003_RenameDuracaoToDurationTextOnWorksAndPhonograms
 *
 * Naming-normalization mandate — resolves the `duracao`/`duration`
 * collision on `works`/`phonograms` FROM REPOSITORY EVIDENCE (not a
 * product decision):
 *
 * `duracao` (varchar(20)) is a human-entered "MM:SS" duration string —
 * confirmed by tracing every real consumer: FonogramaFormModal.tsx /
 * ObraFormModal.tsx build it by concatenating two separate
 * minutes/seconds number inputs (data-testid="input-duracao-minutos" /
 * "-segundos") into a single "M:SS" string; FonogramaViewModal.tsx /
 * ObraViewModal.tsx / LancamentoViewModal.tsx / DetectionDetailModal.tsx
 * display it verbatim under the label "Duração"; test fixtures use
 * values like "03:30"/"04:20". This is unambiguously a *formatted text*
 * representation of a track/work's duration.
 *
 * This is a DIFFERENT representation from the pre-existing `duration`
 * DTO field already handled by PhonogramsService.buildEntityPayload
 * (`out['duration_seconds'] = input['duration_seconds'] ??
 * input['duration']`) — a raw numeric seconds value, explicitly scoped
 * out of a prior migration ("fora do escopo do C2.2"). Renaming
 * `duracao` to `duration` would have collided with that existing,
 * differently-shaped field. Canonical name chosen to disambiguate the
 * two representations of the same concept: `duration_text` (DB) /
 * `durationText` (DTO/frontend) for the formatted string,
 * `duration`/`duration_seconds` (unchanged) for the numeric one.
 *
 * `phonograms.duracao_min`/`duracao_seg` (a separate, still-open
 * question about their relationship to `duration_seconds` — flagged in
 * the original naming-normalization discovery log §9 as
 * REQUIRES_REVIEW, different granularity/possibly different concept)
 * are explicitly NOT touched by this migration.
 *
 * `RENAME COLUMN` is metadata-only in Postgres (no rewrite, no data
 * movement). Guarded with `IF EXISTS` so this is safe to re-run and a
 * no-op if a table doesn't have the column.
 */
export class RenameDuracaoToDurationTextOnWorksAndPhonograms20260918000003 implements MigrationInterface {
  name = 'RenameDuracaoToDurationTextOnWorksAndPhonograms20260918000003';

  private readonly tables = ['works', 'phonograms'];

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of this.tables) {
      await queryRunner.query(`
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = '${table}' AND column_name = 'duracao'
          ) THEN
            ALTER TABLE "${table}" RENAME COLUMN "duracao" TO "duration_text";
          END IF;
        END $$;
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of this.tables) {
      await queryRunner.query(`
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = '${table}' AND column_name = 'duration_text'
          ) THEN
            ALTER TABLE "${table}" RENAME COLUMN "duration_text" TO "duracao";
          END IF;
        END $$;
      `);
    }
  }
}
