import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Physical rebuild of `takedowns` in the canonical order of the real form
 * (TakedownFormModal) — 2026-07-19 audit.
 *
 * Real visual order: title/type/affected work/artist/status/priority →
 * platform/URL of the infringing content → reason/identification date/
 * description/evidence/notes. `plataforma` (original NOT NULL column,
 * used as the fallback of `titulo` in `TakedownsService.create()`) is
 * visually the form's second section, not the first — moved to
 * that position.
 *
 * `url`/`resposta`/`obra_id`/`artista_id` are removed: proven orphans
 * — none is in `CreateTakedownDto`/`QueryTakedownDto`; `artista_id` only
 * appears in a dead filter in `TakedownsService.list()` (a property that
 * `QueryTakedownDto` never declares — the ValidationPipe discards it before it
 * gets there, making the filter unreachable). Superseded by
 * `obra_afetada`/`artista` (free text) and `url_infracao`.
 */
export class RebuildTakedownsInCanonicalFormOrder20260719000016 implements MigrationInterface {
  name = 'RebuildTakedownsInCanonicalFormOrder20260719000016';

  private readonly newColumns = `
    id                    uuid NOT NULL DEFAULT gen_random_uuid(),
    tenant_id             uuid NOT NULL,
    titulo                varchar(255) NOT NULL,
    tipo                  varchar(30),
    obra_afetada          varchar(500),
    artista               varchar(255),
    status                varchar(50) NOT NULL DEFAULT 'pendente',
    prioridade            varchar(20),
    plataforma            varchar(100) NOT NULL,
    url_infracao          text,
    motivo                text,
    data_identificacao    date,
    descricao             text,
    evidencias            text,
    observacoes           text,
    metadata              jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at            timestamp NOT NULL DEFAULT now(),
    updated_at            timestamp NOT NULL DEFAULT now(),
    created_by            varchar(255),
    deleted_at            timestamp
  `;

  private readonly copyColumns = [
    'id', 'tenant_id', 'titulo', 'tipo', 'obra_afetada', 'artista', 'status', 'prioridade',
    'plataforma', 'url_infracao', 'motivo', 'data_identificacao', 'descricao', 'evidencias',
    'observacoes', 'metadata', 'created_at', 'updated_at', 'created_by', 'deleted_at',
  ].join(', ');

  public async up(queryRunner: QueryRunner): Promise<void> {
    const [{ non_null }] = await queryRunner.query(`
      SELECT count(url)::int + count(resposta)::int + count(obra_id)::int + count(artista_id)::int AS non_null
      FROM takedowns
    `);
    if (Number(non_null) > 0) {
      throw new Error(
        `RebuildTakedownsInCanonicalFormOrder: takedowns.(url/resposta/obra_id/artista_id) têm ${non_null} ` +
        `valor(es) não-nulo(s) — colunas presumidas órfãs, mas há dado real. Migration abortada.`,
      );
    }
    const [{ total }] = await queryRunner.query(`SELECT count(*)::int AS total FROM takedowns`);

    await queryRunner.query(`CREATE TABLE takedowns_new (${this.newColumns})`);
    await queryRunner.query(`INSERT INTO takedowns_new (${this.copyColumns}) SELECT ${this.copyColumns} FROM takedowns`);

    const [{ c: newCount }] = await queryRunner.query(`SELECT count(*)::int AS c FROM takedowns_new`);
    if (Number(newCount) !== Number(total)) {
      throw new Error(`RebuildTakedownsInCanonicalFormOrder: contagem divergente (original=${total}, nova=${newCount}) — abortada.`);
    }

    await queryRunner.query(`ALTER TABLE takedowns_new ADD CONSTRAINT takedowns_new_pkey PRIMARY KEY (id)`);
    await queryRunner.query(`CREATE INDEX idx_takedowns_tenant_id_new ON takedowns_new (tenant_id)`);
    await queryRunner.query(`CREATE INDEX idx_takedowns_tenant_status_new ON takedowns_new (tenant_id, status)`);

    await queryRunner.query(`ALTER TABLE takedowns RENAME TO takedowns_old`);
    await queryRunner.query(`ALTER TABLE takedowns_old RENAME CONSTRAINT takedowns_pkey TO takedowns_old_pkey`);
    await queryRunner.query(`ALTER INDEX idx_takedowns_tenant_id RENAME TO idx_takedowns_tenant_id_old`);
    await queryRunner.query(`ALTER INDEX idx_takedowns_tenant_status RENAME TO idx_takedowns_tenant_status_old`);

    await queryRunner.query(`ALTER TABLE takedowns_new RENAME TO takedowns`);
    await queryRunner.query(`ALTER INDEX takedowns_new_pkey RENAME TO takedowns_pkey`);
    await queryRunner.query(`ALTER INDEX idx_takedowns_tenant_id_new RENAME TO idx_takedowns_tenant_id`);
    await queryRunner.query(`ALTER INDEX idx_takedowns_tenant_status_new RENAME TO idx_takedowns_tenant_status`);

    await queryRunner.query(`ALTER TABLE takedowns ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE takedowns FORCE ROW LEVEL SECURITY`);
    await queryRunner.query(`
      CREATE POLICY super_admin_full_access ON takedowns
        AS PERMISSIVE FOR ALL TO authenticated
        USING (app_is_super_admin()) WITH CHECK (app_is_super_admin())
    `);
    await queryRunner.query(`
      CREATE POLICY tenant_isolation ON takedowns
        AS PERMISSIVE FOR ALL TO authenticated
        USING (tenant_id = private_get_tenant_id()) WITH CHECK (tenant_id = private_get_tenant_id())
    `);

    await queryRunner.query(`ALTER TABLE takedowns OWNER TO musicos_migrator`);
    await queryRunner.query(`GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON takedowns TO musicos_migrator`);

    await queryRunner.query(`DROP TABLE takedowns_old`);
    await queryRunner.query(`ANALYZE takedowns`);
  }

  private readonly originalColumns = `
    id                    uuid NOT NULL DEFAULT gen_random_uuid(),
    tenant_id             uuid NOT NULL,
    titulo                varchar(255) NOT NULL,
    plataforma            varchar(100) NOT NULL,
    url                   text,
    status                varchar(50) NOT NULL DEFAULT 'pendente',
    obra_id               uuid,
    artista_id            uuid,
    motivo                text,
    resposta              text,
    metadata              jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at            timestamp NOT NULL DEFAULT now(),
    updated_at            timestamp NOT NULL DEFAULT now(),
    deleted_at            timestamp,
    created_by            varchar(255),
    tipo                  varchar(30),
    obra_afetada          varchar(500),
    artista               varchar(255),
    prioridade            varchar(20),
    url_infracao          text,
    descricao             text,
    evidencias            text,
    data_identificacao    date,
    observacoes           text
  `;

  private readonly restoreCopyColumns = [
    'id', 'tenant_id', 'titulo', 'plataforma', 'status', 'motivo', 'metadata', 'created_at',
    'updated_at', 'deleted_at', 'created_by', 'tipo', 'obra_afetada', 'artista', 'prioridade',
    'url_infracao', 'descricao', 'evidencias', 'data_identificacao', 'observacoes',
  ].join(', ');

  public async down(queryRunner: QueryRunner): Promise<void> {
    const [{ total }] = await queryRunner.query(`SELECT count(*)::int AS total FROM takedowns`);

    await queryRunner.query(`CREATE TABLE takedowns_restore (${this.originalColumns})`);
    // url/resposta/obra_id/artista_id no longer exist (removed in up(),
    // proven orphans) — always NULL on reversal, same pattern as
    // org_slug in RebuildArtistsInCanonicalFormOrder20260719000001.
    await queryRunner.query(`INSERT INTO takedowns_restore (${this.restoreCopyColumns}) SELECT ${this.restoreCopyColumns} FROM takedowns`);

    const [{ c: restoredCount }] = await queryRunner.query(`SELECT count(*)::int AS c FROM takedowns_restore`);
    if (Number(restoredCount) !== Number(total)) {
      throw new Error(`RebuildTakedownsInCanonicalFormOrder.down: contagem divergente (original=${total}, restaurada=${restoredCount}) — abortado.`);
    }

    await queryRunner.query(`ALTER TABLE takedowns_restore ADD CONSTRAINT takedowns_restore_pkey PRIMARY KEY (id)`);
    await queryRunner.query(`CREATE INDEX idx_takedowns_tenant_id_restore ON takedowns_restore (tenant_id)`);
    await queryRunner.query(`CREATE INDEX idx_takedowns_tenant_status_restore ON takedowns_restore (tenant_id, status)`);

    await queryRunner.query(`ALTER TABLE takedowns RENAME TO takedowns_canonical`);
    await queryRunner.query(`ALTER TABLE takedowns_canonical RENAME CONSTRAINT takedowns_pkey TO takedowns_canonical_pkey`);
    await queryRunner.query(`ALTER INDEX idx_takedowns_tenant_id RENAME TO idx_takedowns_tenant_id_canonical`);
    await queryRunner.query(`ALTER INDEX idx_takedowns_tenant_status RENAME TO idx_takedowns_tenant_status_canonical`);

    await queryRunner.query(`ALTER TABLE takedowns_restore RENAME TO takedowns`);
    await queryRunner.query(`ALTER INDEX takedowns_restore_pkey RENAME TO takedowns_pkey`);
    await queryRunner.query(`ALTER INDEX idx_takedowns_tenant_id_restore RENAME TO idx_takedowns_tenant_id`);
    await queryRunner.query(`ALTER INDEX idx_takedowns_tenant_status_restore RENAME TO idx_takedowns_tenant_status`);

    await queryRunner.query(`ALTER TABLE takedowns ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE takedowns FORCE ROW LEVEL SECURITY`);
    await queryRunner.query(`
      CREATE POLICY super_admin_full_access ON takedowns
        AS PERMISSIVE FOR ALL TO authenticated
        USING (app_is_super_admin()) WITH CHECK (app_is_super_admin())
    `);
    await queryRunner.query(`
      CREATE POLICY tenant_isolation ON takedowns
        AS PERMISSIVE FOR ALL TO authenticated
        USING (tenant_id = private_get_tenant_id()) WITH CHECK (tenant_id = private_get_tenant_id())
    `);

    await queryRunner.query(`ALTER TABLE takedowns OWNER TO musicos_migrator`);
    await queryRunner.query(`GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON takedowns TO musicos_migrator`);

    await queryRunner.query(`DROP TABLE takedowns_canonical`);
    await queryRunner.query(`ANALYZE takedowns`);
  }
}
