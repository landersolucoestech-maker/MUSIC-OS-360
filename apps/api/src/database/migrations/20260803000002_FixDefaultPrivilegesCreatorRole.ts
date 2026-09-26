import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 20260803000002_FixDefaultPrivilegesCreatorRole
 *
 * Part 80 — fixes an incorrect assumption of the previous migration
 * (20260802000001_GrantMusicosAppOnAllTables): it configured
 * `ALTER DEFAULT PRIVILEGES FOR ROLE musicos_migrator`, expecting it to
 * protect every future tenant-scoped table. It protects nothing: Postgres
 * applies default privileges to the role that actually runs CREATE TABLE,
 * not to the final owner. Every migration in this project runs via DATABASE_URL
 * connected as `postgres` (confirmed with SELECT current_user in this
 * Part) — each migration's `ALTER TABLE ... OWNER TO musicos_migrator`
 * only changes the owner AFTER creation; it does not rewrite default privileges.
 *
 * Concrete proof: migration 20260803000001_CreateClientAttachments created
 * `client_attachments` following the usual pattern (RLS + OWNER TO
 * musicos_migrator) and, even so, `musicos_app` ended up without any grant —
 * it would be the same silent "column/relation does not exist" as in Parts 78/79
 * on the first real read of the table, only this time the cause is a missing
 * SELECT, not schema drift.
 *
 * Fixes the source of truth: default privileges on the role that REALLY creates
 * the objects (postgres). Future migrations now inherit the grants
 * automatically, without requiring an explicit GRANT per table — but each
 * migration still grants explicitly for safety (defense in
 * depth, the same pattern already used in every RebuildXInCanonicalFormOrder).
 */
export class FixDefaultPrivilegesCreatorRole20260803000002 implements MigrationInterface {
  name = 'FixDefaultPrivilegesCreatorRole20260803000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const [{ current_user: creatorRole }] = await queryRunner.query(`SELECT current_user`);

    await queryRunner.query(`
      ALTER DEFAULT PRIVILEGES FOR ROLE "${creatorRole}" IN SCHEMA public
        GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO musicos_app
    `);
    await queryRunner.query(`
      ALTER DEFAULT PRIVILEGES FOR ROLE "${creatorRole}" IN SCHEMA public
        GRANT USAGE, SELECT ON SEQUENCES TO musicos_app
    `);

    // Retroactively fixes the table created by the immediately
    // preceding migration, before this fix existed.
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'client_attachments') THEN
          EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.client_attachments TO musicos_app';
        END IF;
      END $$
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const [{ current_user: creatorRole }] = await queryRunner.query(`SELECT current_user`);
    await queryRunner.query(`
      ALTER DEFAULT PRIVILEGES FOR ROLE "${creatorRole}" IN SCHEMA public
        REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLES FROM musicos_app
    `);
    await queryRunner.query(`
      ALTER DEFAULT PRIVILEGES FOR ROLE "${creatorRole}" IN SCHEMA public
        REVOKE USAGE, SELECT ON SEQUENCES FROM musicos_app
    `);
    await queryRunner.query(`REVOKE ALL ON TABLE public.client_attachments FROM musicos_app`);
  }
}
