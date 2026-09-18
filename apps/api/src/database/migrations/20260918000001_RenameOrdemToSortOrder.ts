import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 20260918000001_RenameOrdemToSortOrder
 *
 * Naming-normalization mandate (generic-noun sub-concept `ordem` ->
 * `sort_order`): 3 tables carry a purely-internal sequencing integer column
 * named `ordem` — `work_participants`, `project_tracks`,
 * `project_track_participants`. None of the three ever exposes this field
 * through a DTO/API response shape (verified by tracing works.service.ts /
 * projects.service.ts hydrate/replace methods: the outgoing
 * ParticipanteResponse/MusicaResponse shapes never include `ordem`), so
 * this rename has zero API-contract/frontend impact — the only consumers
 * are internal service code, the reports export/import subsystem's field
 * registry, and tests.
 *
 * Rest of the schema already uses `sort_order` for the identical
 * "display/sequencing position" concept on other tables (e.g.
 * contract_service_types, knowledge_categories) — these 3 were the
 * outliers.
 *
 * `RENAME COLUMN` is metadata-only in Postgres (no rewrite, no data
 * movement). Guarded with `IF EXISTS` so this is safe to re-run and a
 * no-op if a table doesn't have the column.
 */
export class RenameOrdemToSortOrder20260918000001 implements MigrationInterface {
  name = 'RenameOrdemToSortOrder20260918000001';

  private readonly tables = ['work_participants', 'project_tracks', 'project_track_participants'];

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of this.tables) {
      await queryRunner.query(`
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = '${table}' AND column_name = 'ordem'
          ) THEN
            ALTER TABLE "${table}" RENAME COLUMN "ordem" TO "sort_order";
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
            WHERE table_name = '${table}' AND column_name = 'sort_order'
          ) THEN
            ALTER TABLE "${table}" RENAME COLUMN "sort_order" TO "ordem";
          END IF;
        END $$;
      `);
    }
  }
}
