import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Form ↔ database sync: Users (Settings).
 *
 * Confirmed finding (2026-07-18 audit): UsuarioFormModal.tsx sends
 * full_name/phone/cargo via useUsuarios() -> storage.update("usuarios", ...)
 * -> PATCH /users/:id -> UpdateUserDto. `phone` never had a column nor a DTO
 * field — updating the phone always failed (whitelist) or was
 * discarded. `full_name` and `cargo` were fixed only in the
 * hook/DTO (full_name -> the already existing fullName; cargo -> the already existing role,
 * dual-write of role_id); neither needs a new column.
 */
export class OrgMembersPhoneColumn20260718000014 implements MigrationInterface {
  name = 'OrgMembersPhoneColumn20260718000014';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "org_members"
        ADD COLUMN IF NOT EXISTS "phone" varchar(30)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "org_members"
        DROP COLUMN IF EXISTS "phone"
    `);
  }
}
