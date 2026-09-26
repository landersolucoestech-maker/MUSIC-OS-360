import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Creates the M2M join table `release_works` (ReleaseEntity @ManyToMany WorkEntity).
 * The relation already exists in the entities (entities.ts), but the physical table was never
 * created by a migration — only in the consolidated dump. This migration materializes the
 * table in a reversible, non-destructive way.
 *
 * Keys: composite PK (release_id, work_id). FKs with ON DELETE CASCADE so that
 * removing a release/work automatically cleans up the links. Index on the inverse
 * side (work_id) for Work → Releases navigation.
 */
export class CreateReleaseWorksJoinTable20260613000001 implements MigrationInterface {
  name = 'CreateReleaseWorksJoinTable20260613000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "release_works" (
        "release_id" uuid NOT NULL,
        "work_id" uuid NOT NULL,
        CONSTRAINT "PK_release_works" PRIMARY KEY ("release_id", "work_id"),
        CONSTRAINT "FK_release_works_release"
          FOREIGN KEY ("release_id") REFERENCES "releases"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_release_works_work"
          FOREIGN KEY ("work_id") REFERENCES "works"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_release_works_work"
      ON "release_works" ("work_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_release_works_release"
      ON "release_works" ("release_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_release_works_release"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_release_works_work"');
    await queryRunner.query('DROP TABLE IF EXISTS "release_works"');
  }
}
