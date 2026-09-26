import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Removes 9 physical `artists` columns orphaned since migration
 * ArtistsFormFieldColumns20260712000001, which created them intending to give
 * each form field its own column. That intention was never
 * completed: the service (`ArtistsService`) kept (or went back to) persisting
 * these same fields in `metadata` (jsonb), via METADATA_FIELDS derived from
 * `report-form-contracts.ts`. `ArtistEntity` never mapped these 9 columns —
 * no TypeORM SELECT/INSERT/UPDATE touches them.
 *
 * Audit (Metrics 09/10/11, Artists Schema 11 — 2026-08-21), exhaustive
 * grep in apps/api and apps/web, including automation handlers outside the
 * artists module (leads/contracts/external-data): zero reads/writes outside
 * migrations, the `verify-canonical-column-order.ts` script (it only checks
 * physical order) and the schema dumps (drizzle/, migrations-complete.sql).
 *
 * Physical vs metadata comparison on real DEV before this drop (3 active
 * artists, total population, not a sample):
 *   - spotify_ouvintes, youtube_inscritos, deezer_fas, instagram_seguidores,
 *     tiktok_seguidores, apple_music_albuns, soundcloud_seguidores: 0 non-null
 *     values on EITHER side, across all 3 artists.
 *   - instagram/tiktok: 1 artist (Dj Stay) has a value on both sides; tiktok
 *     identical; instagram differs only by a trailing slash
 *     ("...djstayofc/" vs "...djstayofc") — the same handle, no distinct historical
 *     data stuck in the physical column.
 * No row had physical data missing from metadata (physical_only = 0 on
 * all 9 columns) — there is no DATA_MIGRATION_REQUIRED.
 *
 * `status_cadastro` was audited and INTENTIONALLY KEPT — unlike
 * the 9 above, IT IS mapped by ArtistEntity (a real @Column) and is written by
 * a real automation outside the artists module: `LeadEventsHandler` (leads
 * module) creates the lead-conversion ArtistEntity with an explicit
 * `status_cadastro: ArtistStatusCadastro.ATIVO`. Dropping the column
 * without also removing the entity's `@Column`/`ArtistStatusCadastro` and that
 * write would break the lead→artist conversion at runtime. Out of scope
 * for this "safe right now" cleanup — a separate, deliberate decision.
 *
 * `tipo`/`status` (the two other columns with "status" in the name) are also NOT
 * touched here — a previous audit confirmed CANONICAL for both.
 *
 * down() recreates the 9 columns with the original type/default/nullability
 * (see RebuildArtistsInCanonicalFormOrder20260719000001.originalColumns) —
 * but restores no data, since none was lost (nothing outside metadata).
 */
export class RemoveArtistLegacyMetricColumns20260821000001
  implements MigrationInterface
{
  name = 'RemoveArtistLegacyMetricColumns20260821000001';

  async up(qr: QueryRunner): Promise<void> {
    await qr.query(`
      ALTER TABLE public."artists"
        DROP COLUMN IF EXISTS "spotify_ouvintes",
        DROP COLUMN IF EXISTS "youtube_inscritos",
        DROP COLUMN IF EXISTS "deezer_fas",
        DROP COLUMN IF EXISTS "instagram_seguidores",
        DROP COLUMN IF EXISTS "tiktok_seguidores",
        DROP COLUMN IF EXISTS "apple_music_albuns",
        DROP COLUMN IF EXISTS "soundcloud_seguidores",
        DROP COLUMN IF EXISTS "instagram",
        DROP COLUMN IF EXISTS "tiktok"
    `);
  }

  async down(qr: QueryRunner): Promise<void> {
    await qr.query(`
      ALTER TABLE public."artists"
        ADD COLUMN IF NOT EXISTS "spotify_ouvintes" integer,
        ADD COLUMN IF NOT EXISTS "youtube_inscritos" integer,
        ADD COLUMN IF NOT EXISTS "deezer_fas" integer,
        ADD COLUMN IF NOT EXISTS "instagram_seguidores" integer,
        ADD COLUMN IF NOT EXISTS "tiktok_seguidores" integer,
        ADD COLUMN IF NOT EXISTS "apple_music_albuns" integer,
        ADD COLUMN IF NOT EXISTS "soundcloud_seguidores" integer,
        ADD COLUMN IF NOT EXISTS "instagram" text,
        ADD COLUMN IF NOT EXISTS "tiktok" text
    `);
  }
}
