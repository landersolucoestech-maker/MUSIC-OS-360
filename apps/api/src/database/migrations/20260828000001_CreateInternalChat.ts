import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Internal Chat (team <-> team) — a schema isolated from the Service Center
 * (`conversations`/`conversation_messages`, team <-> external public).
 * The participant is identified by `auth_user_id` (org_members), with no phone
 * nor any external channel identifier.
 */
export class CreateInternalChat20260828000001 implements MigrationInterface {
  name = 'CreateInternalChat20260828000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE internal_conversation_type AS ENUM ('direct', 'group');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS internal_conversations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        org_id UUID NOT NULL,
        type internal_conversation_type NOT NULL DEFAULT 'direct',
        name VARCHAR(255),
        created_by VARCHAR(255) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        deleted_at TIMESTAMPTZ
      );
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_internal_conversations_tenant ON internal_conversations (tenant_id);`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS internal_conversation_participants (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        conversation_id UUID NOT NULL REFERENCES internal_conversations(id) ON DELETE CASCADE,
        tenant_id UUID NOT NULL,
        auth_user_id VARCHAR(255) NOT NULL,
        joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        last_read_at TIMESTAMPTZ,
        CONSTRAINT uq_internal_conversation_participant UNIQUE (conversation_id, auth_user_id)
      );
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_internal_conversation_participants_user ON internal_conversation_participants (tenant_id, auth_user_id);`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS internal_messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        conversation_id UUID NOT NULL REFERENCES internal_conversations(id) ON DELETE CASCADE,
        tenant_id UUID NOT NULL,
        sender_auth_user_id VARCHAR(255) NOT NULL,
        body TEXT NOT NULL DEFAULT '',
        attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        edited_at TIMESTAMPTZ,
        deleted_at TIMESTAMPTZ
      );
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_internal_messages_conv ON internal_messages (conversation_id, created_at);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_internal_messages_tenant ON internal_messages (tenant_id);`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS internal_messages CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS internal_conversation_participants CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS internal_conversations CASCADE;`);
    await queryRunner.query(`DROP TYPE IF EXISTS internal_conversation_type;`);
  }
}
