import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Physical rebuild of `rights_holders` — 2026-07-19 audit.
 *
 * There is no real visual form (`rights_holders` is an internal record of the
 * `registry` module — ABRAMUS/ECAD sync, with no page of its own in the
 * frontend). The canonical order follows `CreateRightsHolderDto`, the only contract
 * actually exercised (`RightsHoldersService.create()`), which already matched
 * the physical order, except for two points:
 *
 * 1. `email_encrypted`/`phone_encrypted` do not exist in the DTO and are never
 *    written by `RightsHoldersService` nor any other module — proven
 *    orphans, removed (same criterion as artists.org_slug).
 * 2. The audit block was `created_at, updated_at, deleted_at,
 *    created_by, updated_by`; fixed to the canonical pattern
 *    `created_at, updated_at, created_by, updated_by, deleted_at`.
 */
export class RebuildRightsHoldersInCanonicalFormOrder20260719000013 implements MigrationInterface {
  name = 'RebuildRightsHoldersInCanonicalFormOrder20260719000013';

  private readonly newColumns = `
    id                    uuid NOT NULL DEFAULT gen_random_uuid(),
    tenant_id             uuid NOT NULL,
    legal_name            varchar(255) NOT NULL,
    artistic_name         varchar(255),
    document_type         varchar(20),
    document_number       varchar(30),
    country               varchar(2),
    ipi_cae               varchar(20),
    society               varchar(50),
    society_member_code   varchar(100),
    holder_type           varchar(50) NOT NULL DEFAULT 'OTHER',
    metadata              jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at            timestamp NOT NULL DEFAULT now(),
    updated_at            timestamp NOT NULL DEFAULT now(),
    created_by            varchar(255),
    updated_by            varchar(255),
    deleted_at            timestamp
  `;

  private readonly copyColumns = [
    'id', 'tenant_id', 'legal_name', 'artistic_name', 'document_type', 'document_number',
    'country', 'ipi_cae', 'society', 'society_member_code', 'holder_type', 'metadata',
    'created_at', 'updated_at', 'created_by', 'updated_by', 'deleted_at',
  ].join(', ');

  private readonly holderTypeCheck =
    `CHECK (((holder_type)::text = ANY ((ARRAY['AUTHOR'::character varying, 'COMPOSER'::character varying, ` +
    `'PUBLISHER'::character varying, 'INTERPRETER'::character varying, 'MUSICIAN'::character varying, ` +
    `'PHONOGRAPHIC_PRODUCER'::character varying, 'LABEL'::character varying, 'ARRANGER'::character varying, ` +
    `'ADAPTER'::character varying, 'TRANSLATOR'::character varying, 'OTHER'::character varying])::text[])))`;

  public async up(queryRunner: QueryRunner): Promise<void> {
    const [{ non_null }] = await queryRunner.query(`SELECT count(email_encrypted)::int + count(phone_encrypted)::int AS non_null FROM rights_holders`);
    if (Number(non_null) > 0) {
      throw new Error(
        `RebuildRightsHoldersInCanonicalFormOrder: rights_holders.(email_encrypted/phone_encrypted) têm ${non_null} ` +
        `valor(es) não-nulo(s) — colunas presumidas órfãs, mas há dado real. Migration abortada.`,
      );
    }
    const [{ total }] = await queryRunner.query(`SELECT count(*)::int AS total FROM rights_holders`);

    await queryRunner.query(`CREATE TABLE rights_holders_new (${this.newColumns})`);
    await queryRunner.query(`INSERT INTO rights_holders_new (${this.copyColumns}) SELECT ${this.copyColumns} FROM rights_holders`);

    const [{ c: newCount }] = await queryRunner.query(`SELECT count(*)::int AS c FROM rights_holders_new`);
    if (Number(newCount) !== Number(total)) {
      throw new Error(`RebuildRightsHoldersInCanonicalFormOrder: contagem divergente (original=${total}, nova=${newCount}) — abortada.`);
    }

    await queryRunner.query(`ALTER TABLE rights_holders_new ADD CONSTRAINT rights_holders_new_pkey PRIMARY KEY (id)`);
    await queryRunner.query(`ALTER TABLE rights_holders_new ADD CONSTRAINT chk_rights_holders_holder_type_new ${this.holderTypeCheck}`);
    await queryRunner.query(`CREATE INDEX idx_rights_holders_tenant_new ON rights_holders_new (tenant_id)`);
    await queryRunner.query(`CREATE INDEX idx_rights_holders_type_new ON rights_holders_new (tenant_id, holder_type)`);
    await queryRunner.query(`CREATE UNIQUE INDEX uq_rights_holders_tenant_doc_new ON rights_holders_new (tenant_id, document_number) WHERE (document_number IS NOT NULL AND deleted_at IS NULL)`);

    await queryRunner.query(`ALTER TABLE rights_holders RENAME TO rights_holders_old`);
    await queryRunner.query(`ALTER TABLE rights_holders_old RENAME CONSTRAINT rights_holders_pkey TO rights_holders_old_pkey`);
    await queryRunner.query(`ALTER TABLE rights_holders_old RENAME CONSTRAINT chk_rights_holders_holder_type TO chk_rights_holders_holder_type_old`);
    await queryRunner.query(`ALTER INDEX idx_rights_holders_tenant RENAME TO idx_rights_holders_tenant_old`);
    await queryRunner.query(`ALTER INDEX idx_rights_holders_type RENAME TO idx_rights_holders_type_old`);
    await queryRunner.query(`ALTER INDEX uq_rights_holders_tenant_doc RENAME TO uq_rights_holders_tenant_doc_old`);

    await queryRunner.query(`ALTER TABLE rights_holders_new RENAME TO rights_holders`);
    await queryRunner.query(`ALTER INDEX rights_holders_new_pkey RENAME TO rights_holders_pkey`);
    await queryRunner.query(`ALTER TABLE rights_holders RENAME CONSTRAINT chk_rights_holders_holder_type_new TO chk_rights_holders_holder_type`);
    await queryRunner.query(`ALTER INDEX idx_rights_holders_tenant_new RENAME TO idx_rights_holders_tenant`);
    await queryRunner.query(`ALTER INDEX idx_rights_holders_type_new RENAME TO idx_rights_holders_type`);
    await queryRunner.query(`ALTER INDEX uq_rights_holders_tenant_doc_new RENAME TO uq_rights_holders_tenant_doc`);

    await queryRunner.query(`ALTER TABLE rights_holders ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE rights_holders FORCE ROW LEVEL SECURITY`);
    await queryRunner.query(`
      CREATE POLICY tenant_isolation ON rights_holders
        AS PERMISSIVE FOR ALL TO authenticated
        USING (tenant_id = private_get_tenant_id()) WITH CHECK (tenant_id = private_get_tenant_id())
    `);

    await queryRunner.query(`ALTER TABLE rights_holders OWNER TO musicos_migrator`);
    await queryRunner.query(`GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON rights_holders TO musicos_migrator`);

    await queryRunner.query(`DROP TABLE rights_holders_old`);
    await queryRunner.query(`ANALYZE rights_holders`);
  }

  private readonly originalColumns = `
    id                    uuid NOT NULL DEFAULT gen_random_uuid(),
    tenant_id             uuid NOT NULL,
    legal_name            varchar(255) NOT NULL,
    artistic_name         varchar(255),
    document_type         varchar(20),
    document_number       varchar(30),
    email_encrypted       text,
    phone_encrypted       text,
    country               varchar(2),
    ipi_cae               varchar(20),
    society               varchar(50),
    society_member_code   varchar(100),
    holder_type           varchar(50) NOT NULL DEFAULT 'OTHER',
    metadata              jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at            timestamp NOT NULL DEFAULT now(),
    updated_at            timestamp NOT NULL DEFAULT now(),
    deleted_at            timestamp,
    created_by            varchar(255),
    updated_by            varchar(255)
  `;

  private readonly restoreCopyColumns = [
    'id', 'tenant_id', 'legal_name', 'artistic_name', 'document_type', 'document_number',
    'country', 'ipi_cae', 'society', 'society_member_code', 'holder_type', 'metadata',
    'created_at', 'updated_at', 'deleted_at', 'created_by', 'updated_by',
  ].join(', ');

  public async down(queryRunner: QueryRunner): Promise<void> {
    const [{ total }] = await queryRunner.query(`SELECT count(*)::int AS total FROM rights_holders`);

    await queryRunner.query(`CREATE TABLE rights_holders_restore (${this.originalColumns})`);
    // email_encrypted/phone_encrypted no longer exist (removed in up(),
    // proven orphans) — always NULL on reversal, same pattern as
    // org_slug in RebuildArtistsInCanonicalFormOrder20260719000001.
    await queryRunner.query(`INSERT INTO rights_holders_restore (${this.restoreCopyColumns}) SELECT ${this.restoreCopyColumns} FROM rights_holders`);

    const [{ c: restoredCount }] = await queryRunner.query(`SELECT count(*)::int AS c FROM rights_holders_restore`);
    if (Number(restoredCount) !== Number(total)) {
      throw new Error(`RebuildRightsHoldersInCanonicalFormOrder.down: contagem divergente (original=${total}, restaurada=${restoredCount}) — abortado.`);
    }

    await queryRunner.query(`ALTER TABLE rights_holders_restore ADD CONSTRAINT rights_holders_restore_pkey PRIMARY KEY (id)`);
    await queryRunner.query(`ALTER TABLE rights_holders_restore ADD CONSTRAINT chk_rights_holders_holder_type_restore ${this.holderTypeCheck}`);
    await queryRunner.query(`CREATE INDEX idx_rights_holders_tenant_restore ON rights_holders_restore (tenant_id)`);
    await queryRunner.query(`CREATE INDEX idx_rights_holders_type_restore ON rights_holders_restore (tenant_id, holder_type)`);
    await queryRunner.query(`CREATE UNIQUE INDEX uq_rights_holders_tenant_doc_restore ON rights_holders_restore (tenant_id, document_number) WHERE (document_number IS NOT NULL AND deleted_at IS NULL)`);

    await queryRunner.query(`ALTER TABLE rights_holders RENAME TO rights_holders_canonical`);
    await queryRunner.query(`ALTER TABLE rights_holders_canonical RENAME CONSTRAINT rights_holders_pkey TO rights_holders_canonical_pkey`);
    await queryRunner.query(`ALTER TABLE rights_holders_canonical RENAME CONSTRAINT chk_rights_holders_holder_type TO chk_rights_holders_holder_type_canonical`);
    await queryRunner.query(`ALTER INDEX idx_rights_holders_tenant RENAME TO idx_rights_holders_tenant_canonical`);
    await queryRunner.query(`ALTER INDEX idx_rights_holders_type RENAME TO idx_rights_holders_type_canonical`);
    await queryRunner.query(`ALTER INDEX uq_rights_holders_tenant_doc RENAME TO uq_rights_holders_tenant_doc_canonical`);

    await queryRunner.query(`ALTER TABLE rights_holders_restore RENAME TO rights_holders`);
    await queryRunner.query(`ALTER INDEX rights_holders_restore_pkey RENAME TO rights_holders_pkey`);
    await queryRunner.query(`ALTER TABLE rights_holders RENAME CONSTRAINT chk_rights_holders_holder_type_restore TO chk_rights_holders_holder_type`);
    await queryRunner.query(`ALTER INDEX idx_rights_holders_tenant_restore RENAME TO idx_rights_holders_tenant`);
    await queryRunner.query(`ALTER INDEX idx_rights_holders_type_restore RENAME TO idx_rights_holders_type`);
    await queryRunner.query(`ALTER INDEX uq_rights_holders_tenant_doc_restore RENAME TO uq_rights_holders_tenant_doc`);

    await queryRunner.query(`ALTER TABLE rights_holders ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE rights_holders FORCE ROW LEVEL SECURITY`);
    await queryRunner.query(`
      CREATE POLICY tenant_isolation ON rights_holders
        AS PERMISSIVE FOR ALL TO authenticated
        USING (tenant_id = private_get_tenant_id()) WITH CHECK (tenant_id = private_get_tenant_id())
    `);

    await queryRunner.query(`ALTER TABLE rights_holders OWNER TO musicos_migrator`);
    await queryRunner.query(`GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON rights_holders TO musicos_migrator`);

    await queryRunner.query(`DROP TABLE rights_holders_canonical`);
    await queryRunner.query(`ANALYZE rights_holders`);
  }
}
