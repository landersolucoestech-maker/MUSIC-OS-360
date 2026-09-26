import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Removes `artists.tipo` (the artist's lineup: solo/band/duo/trio/group/
 * collective) — product decision (Artists Schema 15): the concept stopped
 * being part of the Artist domain; it was neither normalized nor replaced.
 *
 * Audit before the drop (2026-08-21):
 *   - ArtistEntity never had `tipo` as a real business property beyond
 *     its own storage (no read/filter/display used the
 *     value) — confirmed by exhaustive grep in apps/api and apps/web.
 *   - No CHECK constraint, index, view, function or trigger references
 *     `artists.tipo` in any existing migration.
 *   - The only write consumer outside `ArtistsService.create()` itself
 *     was `LeadEventsHandler` (lead→artist conversion, always wrote
 *     'solo') — removed along with it in this part's code cleanup.
 *   - The operational seed (`03_operational_seed.ts`) and ~9 verify/smoke
 *     scripts also wrote/sent 'solo' — all adjusted.
 *
 * down() recreates the column with the original type/default/nullability (see
 * RebuildArtistsInCanonicalFormOrder20260719000001.originalColumns:
 * `tipo varchar(50) NOT NULL DEFAULT 'solo'`) — but restores no data, since
 * 100% of the real rows in DEV had the same value 'solo' (no
 * variation to preserve).
 */
export class DropArtistTipoColumn20260821000002 implements MigrationInterface {
  name = 'DropArtistTipoColumn20260821000002';

  async up(qr: QueryRunner): Promise<void> {
    await qr.query(`
      ALTER TABLE public."artists"
        DROP COLUMN IF EXISTS "tipo"
    `);
  }

  async down(qr: QueryRunner): Promise<void> {
    await qr.query(`
      ALTER TABLE public."artists"
        ADD COLUMN IF NOT EXISTS "tipo" varchar(50) NOT NULL DEFAULT 'solo'
    `);
  }
}
