import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Physical rebuild of `musicchat_automation_settings` — 2026-07-19
 * audit. Real form: `MusicChatAutomationSettings.tsx`
 * (Settings → MusicChat). The order already matched
 * `UpdateMusicChatAutomationSettingsDto` (enabled → welcome_message →
 * main_menu_message → menu_options → templates → required_fields →
 * optional_fields → invalid_option_message → absence_message →
 * out_of_hours_message → closing_message → return_to_menu_rule →
 * escalation_rules → notification_channels → supervisor_user_id →
 * manager_user_id), except for `updated_by`, which was BEFORE
 * created_at/updated_at (violating the rule that no audit control field
 * appears before the timestamp block). Fixed to
 * created_at, updated_at, updated_by (there is no created_by/deleted_at
 * in this table — a singleton settings row per tenant, no soft delete). Zero
 * columns removed.
 */
export class RebuildMusicchatAutomationSettingsInCanonicalFormOrder20260719000021 implements MigrationInterface {
  name = 'RebuildMusicchatAutomationSettingsInCanonicalFormOrder20260719000021';

  private readonly newColumns = `
    id                      uuid NOT NULL DEFAULT gen_random_uuid(),
    tenant_id               uuid NOT NULL,
    enabled                 boolean NOT NULL DEFAULT true,
    welcome_message         text NOT NULL,
    main_menu_message       text NOT NULL,
    menu_options            jsonb NOT NULL DEFAULT '[]'::jsonb,
    templates               jsonb NOT NULL DEFAULT '[]'::jsonb,
    required_fields         jsonb NOT NULL DEFAULT '[]'::jsonb,
    optional_fields         jsonb NOT NULL DEFAULT '[]'::jsonb,
    invalid_option_message  text NOT NULL,
    absence_message         text NOT NULL,
    out_of_hours_message    text NOT NULL,
    closing_message         text NOT NULL,
    return_to_menu_rule     jsonb NOT NULL DEFAULT '{}'::jsonb,
    escalation_rules        jsonb NOT NULL DEFAULT '[]'::jsonb,
    notification_channels   jsonb NOT NULL DEFAULT '{}'::jsonb,
    supervisor_user_id      varchar,
    manager_user_id         varchar,
    created_at              timestamptz NOT NULL DEFAULT now(),
    updated_at              timestamptz NOT NULL DEFAULT now(),
    updated_by              varchar
  `;

  private readonly copyColumns = [
    'id', 'tenant_id', 'enabled', 'welcome_message', 'main_menu_message', 'menu_options',
    'templates', 'required_fields', 'optional_fields', 'invalid_option_message',
    'absence_message', 'out_of_hours_message', 'closing_message', 'return_to_menu_rule',
    'escalation_rules', 'notification_channels', 'supervisor_user_id', 'manager_user_id',
    'created_at', 'updated_at', 'updated_by',
  ].join(', ');

  public async up(queryRunner: QueryRunner): Promise<void> {
    const [{ total }] = await queryRunner.query(`SELECT count(*)::int AS total FROM musicchat_automation_settings`);

    await queryRunner.query(`CREATE TABLE musicchat_automation_settings_new (${this.newColumns})`);
    await queryRunner.query(`INSERT INTO musicchat_automation_settings_new (${this.copyColumns}) SELECT ${this.copyColumns} FROM musicchat_automation_settings`);

    const [{ c: newCount }] = await queryRunner.query(`SELECT count(*)::int AS c FROM musicchat_automation_settings_new`);
    if (Number(newCount) !== Number(total)) {
      throw new Error(`RebuildMusicchatAutomationSettingsInCanonicalFormOrder: count mismatch (original=${total}, new=${newCount}) — aborted.`);
    }

    await queryRunner.query(`ALTER TABLE musicchat_automation_settings_new ADD CONSTRAINT musicchat_automation_settings_new_pkey PRIMARY KEY (id)`);
    await queryRunner.query(`ALTER TABLE musicchat_automation_settings_new ADD CONSTRAINT musicchat_automation_settings_new_tenant_id_key UNIQUE (tenant_id)`);

    await queryRunner.query(`ALTER TABLE musicchat_automation_settings RENAME TO musicchat_automation_settings_old`);
    await queryRunner.query(`ALTER TABLE musicchat_automation_settings_old RENAME CONSTRAINT musicchat_automation_settings_pkey TO musicchat_automation_settings_old_pkey`);
    await queryRunner.query(`ALTER TABLE musicchat_automation_settings_old RENAME CONSTRAINT musicchat_automation_settings_tenant_id_key TO musicchat_automation_settings_old_tenant_id_key`);

    await queryRunner.query(`ALTER TABLE musicchat_automation_settings_new RENAME TO musicchat_automation_settings`);
    await queryRunner.query(`ALTER INDEX musicchat_automation_settings_new_pkey RENAME TO musicchat_automation_settings_pkey`);
    await queryRunner.query(`ALTER TABLE musicchat_automation_settings RENAME CONSTRAINT musicchat_automation_settings_new_tenant_id_key TO musicchat_automation_settings_tenant_id_key`);

    await queryRunner.query(`ALTER TABLE musicchat_automation_settings ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE musicchat_automation_settings FORCE ROW LEVEL SECURITY`);
    await queryRunner.query(`
      CREATE POLICY tenant_isolation ON musicchat_automation_settings
        AS PERMISSIVE FOR ALL TO public
        USING (tenant_id = private_get_tenant_id()) WITH CHECK (tenant_id = private_get_tenant_id())
    `);

    await queryRunner.query(`ALTER TABLE musicchat_automation_settings OWNER TO musicos_migrator`);
    await queryRunner.query(`GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON musicchat_automation_settings TO musicos_migrator`);

    await queryRunner.query(`DROP TABLE musicchat_automation_settings_old`);
    await queryRunner.query(`ANALYZE musicchat_automation_settings`);
  }

  private readonly originalColumns = `
    id                      uuid NOT NULL DEFAULT gen_random_uuid(),
    tenant_id               uuid NOT NULL,
    enabled                 boolean NOT NULL DEFAULT true,
    welcome_message         text NOT NULL,
    main_menu_message       text NOT NULL,
    menu_options            jsonb NOT NULL DEFAULT '[]'::jsonb,
    templates               jsonb NOT NULL DEFAULT '[]'::jsonb,
    required_fields         jsonb NOT NULL DEFAULT '[]'::jsonb,
    optional_fields         jsonb NOT NULL DEFAULT '[]'::jsonb,
    invalid_option_message  text NOT NULL,
    absence_message         text NOT NULL,
    out_of_hours_message    text NOT NULL,
    closing_message         text NOT NULL,
    return_to_menu_rule     jsonb NOT NULL DEFAULT '{}'::jsonb,
    escalation_rules        jsonb NOT NULL DEFAULT '[]'::jsonb,
    notification_channels   jsonb NOT NULL DEFAULT '{}'::jsonb,
    supervisor_user_id      varchar,
    manager_user_id         varchar,
    updated_by              varchar,
    created_at              timestamptz NOT NULL DEFAULT now(),
    updated_at              timestamptz NOT NULL DEFAULT now()
  `;

  public async down(queryRunner: QueryRunner): Promise<void> {
    const [{ total }] = await queryRunner.query(`SELECT count(*)::int AS total FROM musicchat_automation_settings`);

    await queryRunner.query(`CREATE TABLE musicchat_automation_settings_restore (${this.originalColumns})`);
    await queryRunner.query(`INSERT INTO musicchat_automation_settings_restore (${this.copyColumns}) SELECT ${this.copyColumns} FROM musicchat_automation_settings`);

    const [{ c: restoredCount }] = await queryRunner.query(`SELECT count(*)::int AS c FROM musicchat_automation_settings_restore`);
    if (Number(restoredCount) !== Number(total)) {
      throw new Error(`RebuildMusicchatAutomationSettingsInCanonicalFormOrder.down: count mismatch (original=${total}, restored=${restoredCount}) — aborted.`);
    }

    await queryRunner.query(`ALTER TABLE musicchat_automation_settings_restore ADD CONSTRAINT musicchat_automation_settings_restore_pkey PRIMARY KEY (id)`);
    await queryRunner.query(`ALTER TABLE musicchat_automation_settings_restore ADD CONSTRAINT musicchat_automation_settings_restore_tenant_id_key UNIQUE (tenant_id)`);

    await queryRunner.query(`ALTER TABLE musicchat_automation_settings RENAME TO musicchat_automation_settings_canonical`);
    await queryRunner.query(`ALTER TABLE musicchat_automation_settings_canonical RENAME CONSTRAINT musicchat_automation_settings_pkey TO musicchat_automation_settings_canonical_pkey`);
    await queryRunner.query(`ALTER TABLE musicchat_automation_settings_canonical RENAME CONSTRAINT musicchat_automation_settings_tenant_id_key TO musicchat_automation_settings_canonical_tenant_id_key`);

    await queryRunner.query(`ALTER TABLE musicchat_automation_settings_restore RENAME TO musicchat_automation_settings`);
    await queryRunner.query(`ALTER INDEX musicchat_automation_settings_restore_pkey RENAME TO musicchat_automation_settings_pkey`);
    await queryRunner.query(`ALTER TABLE musicchat_automation_settings RENAME CONSTRAINT musicchat_automation_settings_restore_tenant_id_key TO musicchat_automation_settings_tenant_id_key`);

    await queryRunner.query(`ALTER TABLE musicchat_automation_settings ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE musicchat_automation_settings FORCE ROW LEVEL SECURITY`);
    await queryRunner.query(`
      CREATE POLICY tenant_isolation ON musicchat_automation_settings
        AS PERMISSIVE FOR ALL TO public
        USING (tenant_id = private_get_tenant_id()) WITH CHECK (tenant_id = private_get_tenant_id())
    `);

    await queryRunner.query(`ALTER TABLE musicchat_automation_settings OWNER TO musicos_migrator`);
    await queryRunner.query(`GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON musicchat_automation_settings TO musicos_migrator`);

    await queryRunner.query(`DROP TABLE musicchat_automation_settings_canonical`);
    await queryRunner.query(`ANALYZE musicchat_automation_settings`);
  }
}
