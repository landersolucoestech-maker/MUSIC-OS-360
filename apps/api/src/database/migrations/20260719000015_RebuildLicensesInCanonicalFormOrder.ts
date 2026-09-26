import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Physical rebuild of `licenses` — 2026-07-19 audit. A pure order
 * rebuild (no column removal — all accepted by
 * `CreateLicenseDto` and persisted directly by `LicensingService.create()`
 * via the DTO spread).
 *
 * The order already matched `CreateLicenseDto` (the only real source) almost
 * entirely: titulo → obra_id/obra_musical/artista (work identity) →
 * cliente_id/cliente → projeto → tipo/tipo_uso/midia_destino/territorio →
 * status → data_inicio/data_fim → valor/moeda → observacoes →
 * remuneration_type/artista_id (form fields, a later migration
 * — they were after deleted_at, fixed). Audit block fixed from
 * `created_by, updated_by, created_at, updated_at, deleted_at` to the
 * canonical pattern `created_at, updated_at, created_by, updated_by,
 * deleted_at`.
 */
export class RebuildLicensesInCanonicalFormOrder20260719000015 implements MigrationInterface {
  name = 'RebuildLicensesInCanonicalFormOrder20260719000015';

  private readonly newColumns = `
    id                  uuid NOT NULL DEFAULT gen_random_uuid(),
    tenant_id           uuid NOT NULL,
    titulo              varchar(500) NOT NULL,
    obra_id             uuid,
    obra_musical        varchar(255),
    artista             varchar(255),
    cliente_id          uuid,
    cliente             varchar(255),
    projeto             varchar(255),
    tipo                varchar(100),
    tipo_uso            varchar(255),
    midia_destino       varchar(255),
    territorio          varchar(150),
    status              varchar(50) NOT NULL DEFAULT 'pendente',
    data_inicio         date,
    data_fim            date,
    valor               numeric,
    moeda               varchar(10) NOT NULL DEFAULT 'BRL',
    observacoes         text,
    remuneration_type   varchar(50),
    artista_id          uuid,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    created_by          varchar(255),
    updated_by          varchar(255),
    deleted_at          timestamptz
  `;

  private readonly copyColumns = [
    'id', 'tenant_id', 'titulo', 'obra_id', 'obra_musical', 'artista', 'cliente_id', 'cliente',
    'projeto', 'tipo', 'tipo_uso', 'midia_destino', 'territorio', 'status', 'data_inicio',
    'data_fim', 'valor', 'moeda', 'observacoes', 'remuneration_type', 'artista_id', 'created_at',
    'updated_at', 'created_by', 'updated_by', 'deleted_at',
  ].join(', ');

  public async up(queryRunner: QueryRunner): Promise<void> {
    const [{ total }] = await queryRunner.query(`SELECT count(*)::int AS total FROM licenses`);

    await queryRunner.query(`CREATE TABLE licenses_new (${this.newColumns})`);
    await queryRunner.query(`INSERT INTO licenses_new (${this.copyColumns}) SELECT ${this.copyColumns} FROM licenses`);

    const [{ c: newCount }] = await queryRunner.query(`SELECT count(*)::int AS c FROM licenses_new`);
    if (Number(newCount) !== Number(total)) {
      throw new Error(`RebuildLicensesInCanonicalFormOrder: contagem divergente (original=${total}, nova=${newCount}) — abortada.`);
    }

    await queryRunner.query(`ALTER TABLE licenses_new ADD CONSTRAINT licenses_new_pkey PRIMARY KEY (id)`);
    await queryRunner.query(`CREATE INDEX idx_licenses_tenant_new ON licenses_new (tenant_id)`);
    await queryRunner.query(`CREATE INDEX idx_licenses_tenant_status_new ON licenses_new (tenant_id, status)`);
    await queryRunner.query(`CREATE INDEX idx_licenses_tenant_obra_new ON licenses_new (tenant_id, obra_id)`);
    await queryRunner.query(`CREATE INDEX idx_licenses_tenant_deleted_new ON licenses_new (tenant_id, deleted_at)`);

    await queryRunner.query(`ALTER TABLE licenses RENAME TO licenses_old`);
    await queryRunner.query(`ALTER TABLE licenses_old RENAME CONSTRAINT licenses_pkey TO licenses_old_pkey`);
    await queryRunner.query(`ALTER INDEX idx_licenses_tenant RENAME TO idx_licenses_tenant_old`);
    await queryRunner.query(`ALTER INDEX idx_licenses_tenant_status RENAME TO idx_licenses_tenant_status_old`);
    await queryRunner.query(`ALTER INDEX idx_licenses_tenant_obra RENAME TO idx_licenses_tenant_obra_old`);
    await queryRunner.query(`ALTER INDEX idx_licenses_tenant_deleted RENAME TO idx_licenses_tenant_deleted_old`);

    await queryRunner.query(`ALTER TABLE licenses_new RENAME TO licenses`);
    await queryRunner.query(`ALTER INDEX licenses_new_pkey RENAME TO licenses_pkey`);
    await queryRunner.query(`ALTER INDEX idx_licenses_tenant_new RENAME TO idx_licenses_tenant`);
    await queryRunner.query(`ALTER INDEX idx_licenses_tenant_status_new RENAME TO idx_licenses_tenant_status`);
    await queryRunner.query(`ALTER INDEX idx_licenses_tenant_obra_new RENAME TO idx_licenses_tenant_obra`);
    await queryRunner.query(`ALTER INDEX idx_licenses_tenant_deleted_new RENAME TO idx_licenses_tenant_deleted`);

    await queryRunner.query(`ALTER TABLE licenses ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE licenses FORCE ROW LEVEL SECURITY`);
    await queryRunner.query(`
      CREATE POLICY tenant_isolation ON licenses
        AS PERMISSIVE FOR ALL TO authenticated
        USING (tenant_id = private_get_tenant_id()) WITH CHECK (tenant_id = private_get_tenant_id())
    `);

    await queryRunner.query(`ALTER TABLE licenses OWNER TO musicos_migrator`);
    await queryRunner.query(`GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON licenses TO musicos_migrator`);

    await queryRunner.query(`DROP TABLE licenses_old`);
    await queryRunner.query(`ANALYZE licenses`);
  }

  private readonly originalColumns = `
    id                  uuid NOT NULL DEFAULT gen_random_uuid(),
    tenant_id           uuid NOT NULL,
    titulo              varchar(500) NOT NULL,
    obra_id             uuid,
    obra_musical        varchar(255),
    artista             varchar(255),
    cliente_id          uuid,
    cliente             varchar(255),
    projeto             varchar(255),
    tipo                varchar(100),
    tipo_uso            varchar(255),
    midia_destino       varchar(255),
    territorio          varchar(150),
    status              varchar(50) NOT NULL DEFAULT 'pendente',
    data_inicio         date,
    data_fim            date,
    valor               numeric,
    moeda               varchar(10) NOT NULL DEFAULT 'BRL',
    observacoes         text,
    created_by          varchar(255),
    updated_by          varchar(255),
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    deleted_at          timestamptz,
    remuneration_type   varchar(50),
    artista_id          uuid
  `;

  public async down(queryRunner: QueryRunner): Promise<void> {
    const [{ total }] = await queryRunner.query(`SELECT count(*)::int AS total FROM licenses`);

    await queryRunner.query(`CREATE TABLE licenses_restore (${this.originalColumns})`);
    await queryRunner.query(`INSERT INTO licenses_restore (${this.copyColumns}) SELECT ${this.copyColumns} FROM licenses`);

    const [{ c: restoredCount }] = await queryRunner.query(`SELECT count(*)::int AS c FROM licenses_restore`);
    if (Number(restoredCount) !== Number(total)) {
      throw new Error(`RebuildLicensesInCanonicalFormOrder.down: contagem divergente (original=${total}, restaurada=${restoredCount}) — abortado.`);
    }

    await queryRunner.query(`ALTER TABLE licenses_restore ADD CONSTRAINT licenses_restore_pkey PRIMARY KEY (id)`);
    await queryRunner.query(`CREATE INDEX idx_licenses_tenant_restore ON licenses_restore (tenant_id)`);
    await queryRunner.query(`CREATE INDEX idx_licenses_tenant_status_restore ON licenses_restore (tenant_id, status)`);
    await queryRunner.query(`CREATE INDEX idx_licenses_tenant_obra_restore ON licenses_restore (tenant_id, obra_id)`);
    await queryRunner.query(`CREATE INDEX idx_licenses_tenant_deleted_restore ON licenses_restore (tenant_id, deleted_at)`);

    await queryRunner.query(`ALTER TABLE licenses RENAME TO licenses_canonical`);
    await queryRunner.query(`ALTER TABLE licenses_canonical RENAME CONSTRAINT licenses_pkey TO licenses_canonical_pkey`);
    await queryRunner.query(`ALTER INDEX idx_licenses_tenant RENAME TO idx_licenses_tenant_canonical`);
    await queryRunner.query(`ALTER INDEX idx_licenses_tenant_status RENAME TO idx_licenses_tenant_status_canonical`);
    await queryRunner.query(`ALTER INDEX idx_licenses_tenant_obra RENAME TO idx_licenses_tenant_obra_canonical`);
    await queryRunner.query(`ALTER INDEX idx_licenses_tenant_deleted RENAME TO idx_licenses_tenant_deleted_canonical`);

    await queryRunner.query(`ALTER TABLE licenses_restore RENAME TO licenses`);
    await queryRunner.query(`ALTER INDEX licenses_restore_pkey RENAME TO licenses_pkey`);
    await queryRunner.query(`ALTER INDEX idx_licenses_tenant_restore RENAME TO idx_licenses_tenant`);
    await queryRunner.query(`ALTER INDEX idx_licenses_tenant_status_restore RENAME TO idx_licenses_tenant_status`);
    await queryRunner.query(`ALTER INDEX idx_licenses_tenant_obra_restore RENAME TO idx_licenses_tenant_obra`);
    await queryRunner.query(`ALTER INDEX idx_licenses_tenant_deleted_restore RENAME TO idx_licenses_tenant_deleted`);

    await queryRunner.query(`ALTER TABLE licenses ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE licenses FORCE ROW LEVEL SECURITY`);
    await queryRunner.query(`
      CREATE POLICY tenant_isolation ON licenses
        AS PERMISSIVE FOR ALL TO authenticated
        USING (tenant_id = private_get_tenant_id()) WITH CHECK (tenant_id = private_get_tenant_id())
    `);

    await queryRunner.query(`ALTER TABLE licenses OWNER TO musicos_migrator`);
    await queryRunner.query(`GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON licenses TO musicos_migrator`);

    await queryRunner.query(`DROP TABLE licenses_canonical`);
    await queryRunner.query(`ANALYZE licenses`);
  }
}
