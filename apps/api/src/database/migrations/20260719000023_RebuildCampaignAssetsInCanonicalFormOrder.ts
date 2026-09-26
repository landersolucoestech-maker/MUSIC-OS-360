import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Physical rebuild of `campaign_assets` — 2026-07-19 audit.
 *
 * `CreateCampaignAssetDto`/`CampaignOperationsService.addAsset()` match
 * name/asset_type/file_url/description. `file_size`/`mime_type` NEVER
 * appear in the DTO nor are written by any service (full grep in
 * apps/api/src/modules/campaigns — zero occurrences) — proven orphans,
 * removed (same criterion as rights_holders.email_encrypted). `created_by`
 * was BEFORE created_at — moved to the end of the audit block
 * (there is no updated_at/updated_by in this table — assets are only
 * added/soft-deleted, never edited).
 */
export class RebuildCampaignAssetsInCanonicalFormOrder20260719000023 implements MigrationInterface {
  name = 'RebuildCampaignAssetsInCanonicalFormOrder20260719000023';

  private readonly newColumns = `
    id           uuid NOT NULL DEFAULT gen_random_uuid(),
    tenant_id    uuid NOT NULL,
    campaign_id  uuid NOT NULL,
    name         varchar(500) NOT NULL,
    asset_type   varchar(50) NOT NULL,
    file_url     text NOT NULL,
    description  text,
    metadata     jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at   timestamptz NOT NULL DEFAULT now(),
    created_by   varchar(255),
    deleted_at   timestamptz
  `;

  private readonly copyColumns = [
    'id', 'tenant_id', 'campaign_id', 'name', 'asset_type', 'file_url', 'description',
    'metadata', 'created_at', 'created_by', 'deleted_at',
  ].join(', ');

  public async up(queryRunner: QueryRunner): Promise<void> {
    const [{ non_null }] = await queryRunner.query(`SELECT count(file_size)::int + count(mime_type)::int AS non_null FROM campaign_assets`);
    if (Number(non_null) > 0) {
      throw new Error(
        `RebuildCampaignAssetsInCanonicalFormOrder: campaign_assets.(file_size/mime_type) têm ${non_null} ` +
        `valor(es) não-nulo(s) — colunas presumidas órfãs, mas há dado real. Migration abortada.`,
      );
    }
    const [{ total }] = await queryRunner.query(`SELECT count(*)::int AS total FROM campaign_assets`);

    await queryRunner.query(`CREATE TABLE campaign_assets_new (${this.newColumns})`);
    await queryRunner.query(`INSERT INTO campaign_assets_new (${this.copyColumns}) SELECT ${this.copyColumns} FROM campaign_assets`);

    const [{ c: newCount }] = await queryRunner.query(`SELECT count(*)::int AS c FROM campaign_assets_new`);
    if (Number(newCount) !== Number(total)) {
      throw new Error(`RebuildCampaignAssetsInCanonicalFormOrder: contagem divergente (original=${total}, nova=${newCount}) — abortada.`);
    }

    await queryRunner.query(`ALTER TABLE campaign_assets_new ADD CONSTRAINT campaign_assets_new_pkey PRIMARY KEY (id)`);
    await queryRunner.query(`ALTER TABLE campaign_assets_new ADD CONSTRAINT campaign_assets_new_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE`);
    await queryRunner.query(`ALTER TABLE campaign_assets_new ADD CONSTRAINT fk_campaign_assets_campaign_tenant_new FOREIGN KEY (campaign_id, tenant_id) REFERENCES campaigns(id, tenant_id) ON DELETE CASCADE`);
    await queryRunner.query(`CREATE INDEX idx_campaign_assets_campaign_new ON campaign_assets_new (tenant_id, campaign_id)`);

    await queryRunner.query(`ALTER TABLE campaign_assets RENAME TO campaign_assets_old`);
    await queryRunner.query(`ALTER TABLE campaign_assets_old RENAME CONSTRAINT campaign_assets_pkey TO campaign_assets_old_pkey`);
    await queryRunner.query(`ALTER TABLE campaign_assets_old RENAME CONSTRAINT campaign_assets_campaign_id_fkey TO campaign_assets_old_campaign_id_fkey`);
    await queryRunner.query(`ALTER TABLE campaign_assets_old RENAME CONSTRAINT fk_campaign_assets_campaign_tenant TO fk_campaign_assets_campaign_tenant_old`);
    await queryRunner.query(`ALTER INDEX idx_campaign_assets_campaign RENAME TO idx_campaign_assets_campaign_old`);

    await queryRunner.query(`ALTER TABLE campaign_assets_new RENAME TO campaign_assets`);
    await queryRunner.query(`ALTER INDEX campaign_assets_new_pkey RENAME TO campaign_assets_pkey`);
    await queryRunner.query(`ALTER TABLE campaign_assets RENAME CONSTRAINT campaign_assets_new_campaign_id_fkey TO campaign_assets_campaign_id_fkey`);
    await queryRunner.query(`ALTER TABLE campaign_assets RENAME CONSTRAINT fk_campaign_assets_campaign_tenant_new TO fk_campaign_assets_campaign_tenant`);
    await queryRunner.query(`ALTER INDEX idx_campaign_assets_campaign_new RENAME TO idx_campaign_assets_campaign`);

    await queryRunner.query(`ALTER TABLE campaign_assets ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE campaign_assets FORCE ROW LEVEL SECURITY`);
    await queryRunner.query(`
      CREATE POLICY campaign_assets_tenant_select ON campaign_assets
        AS PERMISSIVE FOR SELECT TO authenticated, musicos_app
        USING (tenant_id = (SELECT app_current_tenant_id()))
    `);
    await queryRunner.query(`
      CREATE POLICY campaign_assets_tenant_insert ON campaign_assets
        AS PERMISSIVE FOR INSERT TO authenticated, musicos_app
        WITH CHECK (tenant_id = (SELECT app_current_tenant_id()))
    `);
    await queryRunner.query(`
      CREATE POLICY campaign_assets_tenant_update ON campaign_assets
        AS PERMISSIVE FOR UPDATE TO authenticated, musicos_app
        USING (tenant_id = (SELECT app_current_tenant_id()))
        WITH CHECK (tenant_id = (SELECT app_current_tenant_id()))
    `);
    await queryRunner.query(`
      CREATE POLICY campaign_assets_tenant_delete ON campaign_assets
        AS PERMISSIVE FOR DELETE TO authenticated, musicos_app
        USING (tenant_id = (SELECT app_current_tenant_id()))
    `);
    await queryRunner.query(`
      CREATE POLICY tenant_isolation ON campaign_assets
        AS PERMISSIVE FOR ALL TO public
        USING (tenant_id = (current_setting('app.current_tenant_id', true))::uuid)
    `);

    await queryRunner.query(`ALTER TABLE campaign_assets OWNER TO musicos_migrator`);
    await queryRunner.query(`GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON campaign_assets TO musicos_migrator`);

    await queryRunner.query(`DROP TABLE campaign_assets_old`);
    await queryRunner.query(`ANALYZE campaign_assets`);
  }

  private readonly originalColumns = `
    id           uuid NOT NULL DEFAULT gen_random_uuid(),
    tenant_id    uuid NOT NULL,
    campaign_id  uuid NOT NULL,
    name         varchar(500) NOT NULL,
    asset_type   varchar(50) NOT NULL,
    file_url     text NOT NULL,
    file_size    bigint,
    mime_type    varchar(255),
    description  text,
    metadata     jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_by   varchar(255),
    created_at   timestamptz NOT NULL DEFAULT now(),
    deleted_at   timestamptz
  `;

  private readonly restoreCopyColumns = [
    'id', 'tenant_id', 'campaign_id', 'name', 'asset_type', 'file_url', 'description',
    'metadata', 'created_by', 'created_at', 'deleted_at',
  ].join(', ');

  public async down(queryRunner: QueryRunner): Promise<void> {
    const [{ total }] = await queryRunner.query(`SELECT count(*)::int AS total FROM campaign_assets`);

    await queryRunner.query(`CREATE TABLE campaign_assets_restore (${this.originalColumns})`);
    // file_size/mime_type no longer exist (removed in up(), proven
    // orphans) — always NULL on reversal, same pattern as
    // rights_holders.email_encrypted/phone_encrypted.
    await queryRunner.query(`INSERT INTO campaign_assets_restore (${this.restoreCopyColumns}) SELECT ${this.restoreCopyColumns} FROM campaign_assets`);

    const [{ c: restoredCount }] = await queryRunner.query(`SELECT count(*)::int AS c FROM campaign_assets_restore`);
    if (Number(restoredCount) !== Number(total)) {
      throw new Error(`RebuildCampaignAssetsInCanonicalFormOrder.down: contagem divergente (original=${total}, restaurada=${restoredCount}) — abortado.`);
    }

    await queryRunner.query(`ALTER TABLE campaign_assets_restore ADD CONSTRAINT campaign_assets_restore_pkey PRIMARY KEY (id)`);
    await queryRunner.query(`ALTER TABLE campaign_assets_restore ADD CONSTRAINT campaign_assets_restore_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE`);
    await queryRunner.query(`ALTER TABLE campaign_assets_restore ADD CONSTRAINT fk_campaign_assets_campaign_tenant_restore FOREIGN KEY (campaign_id, tenant_id) REFERENCES campaigns(id, tenant_id) ON DELETE CASCADE`);
    await queryRunner.query(`CREATE INDEX idx_campaign_assets_campaign_restore ON campaign_assets_restore (tenant_id, campaign_id)`);

    await queryRunner.query(`ALTER TABLE campaign_assets RENAME TO campaign_assets_canonical`);
    await queryRunner.query(`ALTER TABLE campaign_assets_canonical RENAME CONSTRAINT campaign_assets_pkey TO campaign_assets_canonical_pkey`);
    await queryRunner.query(`ALTER TABLE campaign_assets_canonical RENAME CONSTRAINT campaign_assets_campaign_id_fkey TO campaign_assets_canonical_campaign_id_fkey`);
    await queryRunner.query(`ALTER TABLE campaign_assets_canonical RENAME CONSTRAINT fk_campaign_assets_campaign_tenant TO fk_campaign_assets_campaign_tenant_canonical`);
    await queryRunner.query(`ALTER INDEX idx_campaign_assets_campaign RENAME TO idx_campaign_assets_campaign_canonical`);

    await queryRunner.query(`ALTER TABLE campaign_assets_restore RENAME TO campaign_assets`);
    await queryRunner.query(`ALTER INDEX campaign_assets_restore_pkey RENAME TO campaign_assets_pkey`);
    await queryRunner.query(`ALTER TABLE campaign_assets RENAME CONSTRAINT campaign_assets_restore_campaign_id_fkey TO campaign_assets_campaign_id_fkey`);
    await queryRunner.query(`ALTER TABLE campaign_assets RENAME CONSTRAINT fk_campaign_assets_campaign_tenant_restore TO fk_campaign_assets_campaign_tenant`);
    await queryRunner.query(`ALTER INDEX idx_campaign_assets_campaign_restore RENAME TO idx_campaign_assets_campaign`);

    await queryRunner.query(`ALTER TABLE campaign_assets ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE campaign_assets FORCE ROW LEVEL SECURITY`);
    await queryRunner.query(`
      CREATE POLICY campaign_assets_tenant_select ON campaign_assets
        AS PERMISSIVE FOR SELECT TO authenticated, musicos_app
        USING (tenant_id = (SELECT app_current_tenant_id()))
    `);
    await queryRunner.query(`
      CREATE POLICY campaign_assets_tenant_insert ON campaign_assets
        AS PERMISSIVE FOR INSERT TO authenticated, musicos_app
        WITH CHECK (tenant_id = (SELECT app_current_tenant_id()))
    `);
    await queryRunner.query(`
      CREATE POLICY campaign_assets_tenant_update ON campaign_assets
        AS PERMISSIVE FOR UPDATE TO authenticated, musicos_app
        USING (tenant_id = (SELECT app_current_tenant_id()))
        WITH CHECK (tenant_id = (SELECT app_current_tenant_id()))
    `);
    await queryRunner.query(`
      CREATE POLICY campaign_assets_tenant_delete ON campaign_assets
        AS PERMISSIVE FOR DELETE TO authenticated, musicos_app
        USING (tenant_id = (SELECT app_current_tenant_id()))
    `);
    await queryRunner.query(`
      CREATE POLICY tenant_isolation ON campaign_assets
        AS PERMISSIVE FOR ALL TO public
        USING (tenant_id = (current_setting('app.current_tenant_id', true))::uuid)
    `);

    await queryRunner.query(`ALTER TABLE campaign_assets OWNER TO musicos_migrator`);
    await queryRunner.query(`GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON campaign_assets TO musicos_migrator`);

    await queryRunner.query(`DROP TABLE campaign_assets_canonical`);
    await queryRunner.query(`ANALYZE campaign_assets`);
  }
}
