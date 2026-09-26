import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Physical rebuild of `releases` in the canonical order of the real form
 * (LancamentoFormModal) — 2026-07-19 audit. Same pattern as the previous ones.
 *
 * Real visual order: "Metadata" section (title, type, main artist,
 * genre, language) → "Copyright Info" (label, copyright, upc) →
 * distributor/release date (Release Preferences) → cover/platforms/
 * global isrc/assets/schedule (Track Upload/Preview) → notes/remarks
 * (Notes) → status (controlled by the system, not directly editable).
 *
 * `release_works.tenant_isolation` has an EXISTS subquery referencing
 * `releases` (same situation as `works` in migration 20260719000002) — the
 * policy must be dropped and recreated in the swap.
 */
export class RebuildReleasesInCanonicalFormOrder20260719000004 implements MigrationInterface {
  name = 'RebuildReleasesInCanonicalFormOrder20260719000004';

  private readonly newColumns = `
    id                  uuid NOT NULL DEFAULT gen_random_uuid(),
    tenant_id           uuid NOT NULL,
    titulo              varchar(500) NOT NULL,
    tipo                varchar(100) NOT NULL DEFAULT 'single',
    artista_id          uuid,
    genero              varchar(100),
    idioma              varchar(50),
    gravadora           varchar(255),
    copyright           varchar(255),
    upc                 varchar(20),
    distribuidora       varchar(255),
    data_lancamento     timestamp,
    capa_url            text,
    plataformas         jsonb NOT NULL DEFAULT '[]'::jsonb,
    isrc_global         varchar(50),
    assets              jsonb,
    cronograma          jsonb,
    notas_internas      text,
    observacoes         text,
    status              varchar(50) NOT NULL DEFAULT 'planejamento',
    metadata            jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at          timestamp NOT NULL DEFAULT now(),
    updated_at          timestamp NOT NULL DEFAULT now(),
    created_by          varchar(255),
    updated_by          varchar(255),
    deleted_at          timestamp
  `;

  private readonly copyColumns = [
    'id', 'tenant_id', 'titulo', 'tipo', 'artista_id', 'genero', 'idioma', 'gravadora',
    'copyright', 'upc', 'distribuidora', 'data_lancamento', 'capa_url', 'plataformas',
    'isrc_global', 'assets', 'cronograma', 'notas_internas', 'observacoes', 'status',
    'metadata', 'created_at', 'updated_at', 'created_by', 'updated_by', 'deleted_at',
  ].join(', ');

  private readonly releaseWorksPolicySql = (worksTable = 'works') => `
    CREATE POLICY tenant_isolation ON release_works
      AS PERMISSIVE FOR ALL TO authenticated
      USING (
        EXISTS (SELECT 1 FROM releases r WHERE r.id = release_works.release_id AND r.tenant_id = private_get_tenant_id())
        AND EXISTS (SELECT 1 FROM ${worksTable} w WHERE w.id = release_works.work_id AND w.tenant_id = private_get_tenant_id())
      )
      WITH CHECK (
        EXISTS (SELECT 1 FROM releases r WHERE r.id = release_works.release_id AND r.tenant_id = private_get_tenant_id())
        AND EXISTS (SELECT 1 FROM ${worksTable} w WHERE w.id = release_works.work_id AND w.tenant_id = private_get_tenant_id())
      )
  `;

  public async up(queryRunner: QueryRunner): Promise<void> {
    const [{ total }] = await queryRunner.query(`SELECT count(*)::int AS total FROM releases`);

    await queryRunner.query(`CREATE TABLE releases_new (${this.newColumns})`);
    await queryRunner.query(`INSERT INTO releases_new (${this.copyColumns}) SELECT ${this.copyColumns} FROM releases`);

    const [{ c: newCount }] = await queryRunner.query(`SELECT count(*)::int AS c FROM releases_new`);
    if (Number(newCount) !== Number(total)) {
      throw new Error(`RebuildReleasesInCanonicalFormOrder: contagem divergente (original=${total}, nova=${newCount}) — abortada.`);
    }

    await queryRunner.query(`ALTER TABLE releases_new ADD CONSTRAINT releases_new_pkey PRIMARY KEY (id)`);
    await queryRunner.query(`ALTER TABLE releases_new ADD CONSTRAINT uq_releases_tenant_id_id_new UNIQUE (tenant_id, id)`);
    await queryRunner.query(`ALTER TABLE releases_new ADD CONSTRAINT fk_releases_artista_id_new FOREIGN KEY (artista_id) REFERENCES artists(id) ON DELETE SET NULL`);
    await queryRunner.query(`CREATE INDEX idx_releases_tenant_id_new ON releases_new (tenant_id)`);
    await queryRunner.query(`CREATE INDEX idx_releases_artista_id_new ON releases_new (artista_id)`);
    await queryRunner.query(`CREATE INDEX idx_releases_tenant_active_new ON releases_new (tenant_id, deleted_at, created_at DESC) WHERE (deleted_at IS NULL)`);

    await queryRunner.query(`DROP POLICY tenant_isolation ON release_works`);
    await queryRunner.query(`ALTER TABLE release_works DROP CONSTRAINT "FK_release_works_release"`);
    await queryRunner.query(`ALTER TABLE transaction_allocations DROP CONSTRAINT fk_txalloc_release`);
    await queryRunner.query(`ALTER TABLE performance_metric_entries DROP CONSTRAINT fk_metric_release`);

    await queryRunner.query(`ALTER TABLE releases RENAME TO releases_old`);
    await queryRunner.query(`ALTER TABLE releases_old RENAME CONSTRAINT releases_pkey TO releases_old_pkey`);
    await queryRunner.query(`ALTER TABLE releases_old RENAME CONSTRAINT uq_releases_tenant_id_id TO uq_releases_tenant_id_id_old`);
    await queryRunner.query(`ALTER TABLE releases_old RENAME CONSTRAINT fk_releases_artista_id TO fk_releases_artista_id_old`);
    await queryRunner.query(`ALTER INDEX idx_releases_tenant_id RENAME TO idx_releases_tenant_id_old`);
    await queryRunner.query(`ALTER INDEX idx_releases_artista_id RENAME TO idx_releases_artista_id_old`);
    await queryRunner.query(`ALTER INDEX idx_releases_tenant_active RENAME TO idx_releases_tenant_active_old`);

    await queryRunner.query(`ALTER TABLE releases_new RENAME TO releases`);
    await queryRunner.query(`ALTER INDEX releases_new_pkey RENAME TO releases_pkey`);
    await queryRunner.query(`ALTER TABLE releases RENAME CONSTRAINT uq_releases_tenant_id_id_new TO uq_releases_tenant_id_id`);
    await queryRunner.query(`ALTER TABLE releases RENAME CONSTRAINT fk_releases_artista_id_new TO fk_releases_artista_id`);
    await queryRunner.query(`ALTER INDEX idx_releases_tenant_id_new RENAME TO idx_releases_tenant_id`);
    await queryRunner.query(`ALTER INDEX idx_releases_artista_id_new RENAME TO idx_releases_artista_id`);
    await queryRunner.query(`ALTER INDEX idx_releases_tenant_active_new RENAME TO idx_releases_tenant_active`);

    await queryRunner.query(`ALTER TABLE release_works ADD CONSTRAINT "FK_release_works_release" FOREIGN KEY (release_id) REFERENCES releases(id) ON DELETE CASCADE`);
    await queryRunner.query(`ALTER TABLE transaction_allocations ADD CONSTRAINT fk_txalloc_release FOREIGN KEY (tenant_id, release_id) REFERENCES releases(tenant_id, id)`);
    await queryRunner.query(`ALTER TABLE performance_metric_entries ADD CONSTRAINT fk_metric_release FOREIGN KEY (tenant_id, release_id) REFERENCES releases(tenant_id, id)`);
    await queryRunner.query(this.releaseWorksPolicySql());

    await queryRunner.query(`ALTER TABLE releases ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE releases FORCE ROW LEVEL SECURITY`);
    await queryRunner.query(`
      CREATE POLICY super_admin_full_access ON releases
        AS PERMISSIVE FOR ALL TO authenticated
        USING (app_is_super_admin()) WITH CHECK (app_is_super_admin())
    `);
    await queryRunner.query(`
      CREATE POLICY tenant_isolation ON releases
        AS PERMISSIVE FOR ALL TO authenticated
        USING (tenant_id = private_get_tenant_id()) WITH CHECK (tenant_id = private_get_tenant_id())
    `);

    await queryRunner.query(`ALTER TABLE releases OWNER TO musicos_migrator`);
    await queryRunner.query(`GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON releases TO musicos_migrator`);

    await queryRunner.query(`DROP TABLE releases_old`);
    await queryRunner.query(`ANALYZE releases`);
  }

  private readonly originalColumns = `
    id                  uuid NOT NULL DEFAULT gen_random_uuid(),
    tenant_id           uuid NOT NULL,
    artista_id          uuid,
    titulo              varchar(500) NOT NULL,
    tipo                varchar(100) NOT NULL DEFAULT 'single',
    status              varchar(50) NOT NULL DEFAULT 'planejamento',
    distribuidora       varchar(255),
    upc                 varchar(20),
    data_lancamento     timestamp,
    plataformas         jsonb NOT NULL DEFAULT '[]'::jsonb,
    capa_url            text,
    metadata            jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at          timestamp NOT NULL DEFAULT now(),
    updated_at          timestamp NOT NULL DEFAULT now(),
    deleted_at          timestamp,
    created_by          varchar(255),
    updated_by          varchar(255),
    isrc_global         varchar(50),
    notas_internas      text,
    observacoes         text,
    gravadora           varchar(255),
    copyright           varchar(255),
    genero              varchar(100),
    idioma              varchar(50),
    assets              jsonb,
    cronograma          jsonb
  `;

  public async down(queryRunner: QueryRunner): Promise<void> {
    const [{ total }] = await queryRunner.query(`SELECT count(*)::int AS total FROM releases`);

    await queryRunner.query(`CREATE TABLE releases_restore (${this.originalColumns})`);
    await queryRunner.query(`INSERT INTO releases_restore (${this.copyColumns}) SELECT ${this.copyColumns} FROM releases`);

    const [{ c: restoredCount }] = await queryRunner.query(`SELECT count(*)::int AS c FROM releases_restore`);
    if (Number(restoredCount) !== Number(total)) {
      throw new Error(`RebuildReleasesInCanonicalFormOrder.down: contagem divergente (original=${total}, restaurada=${restoredCount}) — abortado.`);
    }

    await queryRunner.query(`ALTER TABLE releases_restore ADD CONSTRAINT releases_restore_pkey PRIMARY KEY (id)`);
    await queryRunner.query(`ALTER TABLE releases_restore ADD CONSTRAINT uq_releases_tenant_id_id_restore UNIQUE (tenant_id, id)`);
    await queryRunner.query(`ALTER TABLE releases_restore ADD CONSTRAINT fk_releases_artista_id_restore FOREIGN KEY (artista_id) REFERENCES artists(id) ON DELETE SET NULL`);
    await queryRunner.query(`CREATE INDEX idx_releases_tenant_id_restore ON releases_restore (tenant_id)`);
    await queryRunner.query(`CREATE INDEX idx_releases_artista_id_restore ON releases_restore (artista_id)`);
    await queryRunner.query(`CREATE INDEX idx_releases_tenant_active_restore ON releases_restore (tenant_id, deleted_at, created_at DESC) WHERE (deleted_at IS NULL)`);

    await queryRunner.query(`DROP POLICY tenant_isolation ON release_works`);
    await queryRunner.query(`ALTER TABLE release_works DROP CONSTRAINT "FK_release_works_release"`);
    await queryRunner.query(`ALTER TABLE transaction_allocations DROP CONSTRAINT fk_txalloc_release`);
    await queryRunner.query(`ALTER TABLE performance_metric_entries DROP CONSTRAINT fk_metric_release`);

    await queryRunner.query(`ALTER TABLE releases RENAME TO releases_canonical`);
    await queryRunner.query(`ALTER TABLE releases_canonical RENAME CONSTRAINT releases_pkey TO releases_canonical_pkey`);
    await queryRunner.query(`ALTER TABLE releases_canonical RENAME CONSTRAINT uq_releases_tenant_id_id TO uq_releases_tenant_id_id_canonical`);
    await queryRunner.query(`ALTER TABLE releases_canonical RENAME CONSTRAINT fk_releases_artista_id TO fk_releases_artista_id_canonical`);
    await queryRunner.query(`ALTER INDEX idx_releases_tenant_id RENAME TO idx_releases_tenant_id_canonical`);
    await queryRunner.query(`ALTER INDEX idx_releases_artista_id RENAME TO idx_releases_artista_id_canonical`);
    await queryRunner.query(`ALTER INDEX idx_releases_tenant_active RENAME TO idx_releases_tenant_active_canonical`);

    await queryRunner.query(`ALTER TABLE releases_restore RENAME TO releases`);
    await queryRunner.query(`ALTER INDEX releases_restore_pkey RENAME TO releases_pkey`);
    await queryRunner.query(`ALTER TABLE releases RENAME CONSTRAINT uq_releases_tenant_id_id_restore TO uq_releases_tenant_id_id`);
    await queryRunner.query(`ALTER TABLE releases RENAME CONSTRAINT fk_releases_artista_id_restore TO fk_releases_artista_id`);
    await queryRunner.query(`ALTER INDEX idx_releases_tenant_id_restore RENAME TO idx_releases_tenant_id`);
    await queryRunner.query(`ALTER INDEX idx_releases_artista_id_restore RENAME TO idx_releases_artista_id`);
    await queryRunner.query(`ALTER INDEX idx_releases_tenant_active_restore RENAME TO idx_releases_tenant_active`);

    await queryRunner.query(`ALTER TABLE release_works ADD CONSTRAINT "FK_release_works_release" FOREIGN KEY (release_id) REFERENCES releases(id) ON DELETE CASCADE`);
    await queryRunner.query(`ALTER TABLE transaction_allocations ADD CONSTRAINT fk_txalloc_release FOREIGN KEY (tenant_id, release_id) REFERENCES releases(tenant_id, id)`);
    await queryRunner.query(`ALTER TABLE performance_metric_entries ADD CONSTRAINT fk_metric_release FOREIGN KEY (tenant_id, release_id) REFERENCES releases(tenant_id, id)`);
    await queryRunner.query(this.releaseWorksPolicySql());

    await queryRunner.query(`ALTER TABLE releases ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE releases FORCE ROW LEVEL SECURITY`);
    await queryRunner.query(`
      CREATE POLICY super_admin_full_access ON releases
        AS PERMISSIVE FOR ALL TO authenticated
        USING (app_is_super_admin()) WITH CHECK (app_is_super_admin())
    `);
    await queryRunner.query(`
      CREATE POLICY tenant_isolation ON releases
        AS PERMISSIVE FOR ALL TO authenticated
        USING (tenant_id = private_get_tenant_id()) WITH CHECK (tenant_id = private_get_tenant_id())
    `);

    await queryRunner.query(`ALTER TABLE releases OWNER TO musicos_migrator`);
    await queryRunner.query(`GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON releases TO musicos_migrator`);

    await queryRunner.query(`DROP TABLE releases_canonical`);
    await queryRunner.query(`ANALYZE releases`);
  }
}
