import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Forensic audit (2026-09-20) determined artists.genero (personal gender,
 * created by 20260712000001_ArtistsFormFieldColumns.ts -- a DIFFERENT
 * concept from music genre; see 20260918000048_RenameGeneroMusicalToMusicGenreOnArtists's
 * own header for that distinction) is a dead physical column, not a
 * decision-pending one:
 *  - ArtistEntity has no @Column for it -- the create-artist DTO's `genero`
 *    field is one of REPORT_FORM_CONTRACTS.artists' metadata-mapped fields
 *    (apps/api/src/modules/artists/artists.service.ts's METADATA_FIELDS,
 *    derived from report-form-contracts.ts's meta('genero')), so both
 *    create() and update() route it into `metadata.genero`, never into this
 *    physical column. Zero write path.
 *  - report-form-contracts.ts reads it via meta('genero') too -- metadata,
 *    not the physical column via col(). Zero read path.
 *  - No raw SQL, view, function, or trigger anywhere in the repository or
 *    live database references this column (grepped repo-wide; queried
 *    information_schema.views / pg_proc / pg_trigger live against DEV).
 *  - Live DEV: 4/4 artists rows, 0 with a non-null value in this column
 *    (re-verified immediately before this migration, in its own
 *    precondition check -- not assumed from an earlier audit pass).
 *
 * Authorized per this session's explicit destructive-change conditions
 * (0 non-null values confirmed; no consumer found; Entity doesn't map it;
 * no raw SQL uses it; no later migration depends on it -- the only other
 * migration referencing this column, 20260719000001_
 * RebuildArtistsInCanonicalFormOrder, predates this one and merely
 * snapshotted the column as part of the canonical order at that point in
 * history, same as how 20260712000001 added it -- it does not require the
 * column to persist forever; DEV has a working nightly backup per
 * .github/workflows/backup.yml).
 *
 * Precondition-checked, not a blind DROP: verifies live non-null count is
 * exactly 0 immediately before dropping, and aborts (no DROP) otherwise --
 * so this migration is safe to re-run against any environment (fresh DB
 * that already lacks the column: to_regclass-equivalent column check makes
 * it a no-op; DEV or any environment where the column still has data: safe
 * abort, not data loss).
 *
 * apps/api/scripts/verify-canonical-column-order.ts's CANONICAL_ORDER.artists
 * entry is updated in the same commit to remove 'genero' -- Postgres
 * recomputes information_schema.columns.ordinal_position to skip dropped
 * columns for the remaining ones, so no physical reordering/rebuild is
 * needed, only removing the now-nonexistent name from the reference list.
 */
export class DropDeadArtistsGeneroColumn20260920000003 implements MigrationInterface {
  name = 'DropDeadArtistsGeneroColumn20260920000003';

  public async up(qr: QueryRunner): Promise<void> {
    const col = await qr.query(`
      SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'artists' AND column_name = 'genero'
    `);
    if (col.length === 0) return; // already absent on this environment -- nothing to do

    const nonNull = await qr.query(`SELECT count(*)::int AS n FROM "artists" WHERE "genero" IS NOT NULL`);
    const n = nonNull[0]?.n ?? 0;
    if (n > 0) {
      throw new Error(
        `DropDeadArtistsGeneroColumn: artists.genero has ${n} non-null value(s) on this environment. ` +
          'Aborting -- this migration only drops the column when confirmed empty. This column is a ' +
          'different concept from music_genre (personal gender vs. musical genre, see ' +
          '20260918000048_RenameGeneroMusicalToMusicGenreOnArtists) -- investigate whether this ' +
          'environment has real data here before deciding how to proceed.',
      );
    }

    await qr.query(`ALTER TABLE "artists" DROP COLUMN IF EXISTS "genero"`);
  }

  public async down(qr: QueryRunner): Promise<void> {
    await qr.query(`ALTER TABLE "artists" ADD COLUMN IF NOT EXISTS "genero" varchar(30)`);
  }
}
