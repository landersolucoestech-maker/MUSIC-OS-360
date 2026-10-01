import { MigrationInterface, QueryRunner } from 'typeorm';
import { assertMigrationRoleBypassesRls } from '../migration-guards';

/**
 * 20260930000033_RenameVideomakerJobFunctionSlugToVideographer
 *
 * Technical-language mandate (technical = English, UX = PT-BR): seed 05 created the default job function
 * `videomaker` per tenant. `slug` is a technical identifier (the PT-BR text "Videomaker" lives in `name`), and
 * the canonical English spelling used everywhere else (audiovisual_projects.videographer) is `videographer`.
 * Nothing in the API or web reads job_functions slugs (the org chart grants no permission - seed 05 header).
 *
 * Renames only the SEEDED row (slug = 'videomaker' AND name = 'Videomaker', live) and only when the tenant has no
 * live row with the target slug, so uq_job_functions_tenant_slug is never violated and a tenant's own custom
 * function is never touched. Idempotent; down() reverses under the same guards. Nothing is dropped.
 */
function renameSlug(from: string, to: string): string {
  return `UPDATE "job_functions" t SET "slug" = '${to}'
     WHERE t."slug" = '${from}' AND t."name" = 'Videomaker' AND t."deleted_at" IS NULL
       AND NOT EXISTS (
         SELECT 1 FROM "job_functions" o WHERE o."tenant_id" = t."tenant_id" AND o."slug" = '${to}' AND o."deleted_at" IS NULL
       )`;
}

export class RenameVideomakerJobFunctionSlugToVideographer20260930000033 implements MigrationInterface {
  name = 'RenameVideomakerJobFunctionSlugToVideographer20260930000033';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await assertMigrationRoleBypassesRls(queryRunner, this.name);
    await queryRunner.query(`SET LOCAL lock_timeout = '15s'`);
    await queryRunner.query(renameSlug('videomaker', 'videographer'));
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await assertMigrationRoleBypassesRls(queryRunner, this.name);
    await queryRunner.query(`SET LOCAL lock_timeout = '15s'`);
    await queryRunner.query(renameSlug('videographer', 'videomaker'));
  }
}
