import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Physical rebuild of `shares` — 2026-07-19 audit. A pure order
 * rebuild (no column removal).
 *
 * `shares` serves TWO real domains simultaneously in the same physical table:
 *
 * 1. Ownership/registration (ABRAMUS/ECAD submission): obra_id, fonograma_id,
 *    titular_nome, titular_doc, papel (legacy EN aliases holderName/
 *    holderDoc/role/workId/trackId in CreateShareDto, resolved by
 *    `SharesService.toColumns()`) + the "Registry Fields Phase 1" fields
 *    (migration 20260601000001): rights_holder_id, publisher_id, role,
 *    territory, instrument, credited_name, is_primary, is_featured,
 *    start_date, end_date. `rights_holder_id` has a real backfill (migration
 *    20260601000002); `role`/`territory`/`credited_name`/`is_primary` have
 *    real readers in `society-payload-builder.service.ts`/
 *    `entity-validators.ts` (fallback `s.role ?? s.papel`). None of these 10
 *    fields has a visual form — kept as a technical/reserved block
 *    (same criterion as `financial_project_id` in marketing_projects/
 *    audiovisual_projects), not removed.
 *
 * 2. Financial share (the real form `SharePendenteFormModal.tsx`, EXACT keys
 *    documented in `CreateShareDto`): share_type → percentual/
 *    status (common to both sections, form position) → acordo_notas/
 *    acordo_url/observacoes → direcao → lancamento_id/detentor/destinatario/
 *    tipo ("Release Interno" branch) OR nome_musica/artista_externo/
 *    artista_projeto_id/artista_id/pagador/pagador_contato/origem_acordo/
 *    data_prevista/documentos ("Share Externo a Receber" branch, mutually
 *    exclusive — the same physical row accommodates both formats) → versao/
 *    historico (only on creation).
 */
export class RebuildSharesInCanonicalFormOrder20260719000014 implements MigrationInterface {
  name = 'RebuildSharesInCanonicalFormOrder20260719000014';

  private readonly newColumns = `
    id                    uuid NOT NULL DEFAULT gen_random_uuid(),
    tenant_id             uuid NOT NULL,
    obra_id               uuid,
    fonograma_id          uuid,
    titular_nome          varchar(255),
    titular_doc           varchar(50),
    papel                 varchar(100) NOT NULL DEFAULT 'autor',
    rights_holder_id      uuid,
    publisher_id          uuid,
    role                  varchar(50),
    territory             varchar(10),
    instrument            varchar(100),
    credited_name         varchar(255),
    is_primary            boolean,
    is_featured           boolean,
    start_date            timestamp,
    end_date              timestamp,
    share_type            varchar(30),
    percentual            numeric,
    status                varchar(50) NOT NULL DEFAULT 'ativo',
    acordo_notas          text,
    acordo_url            text,
    observacoes           text,
    direcao               varchar(20),
    lancamento_id         uuid,
    nome_musica           varchar(500),
    detentor              varchar(255),
    destinatario          varchar(255),
    tipo                  varchar(100),
    artista_externo       varchar(255),
    artista_projeto_id    uuid,
    artista_id            uuid,
    pagador               varchar(255),
    pagador_contato       varchar(255),
    origem_acordo         varchar(255),
    data_prevista         date,
    documentos            text,
    versao                integer,
    historico             jsonb,
    metadata              jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at            timestamp NOT NULL DEFAULT now(),
    updated_at            timestamp NOT NULL DEFAULT now(),
    deleted_at            timestamp
  `;

  private readonly copyColumns = [
    'id', 'tenant_id', 'obra_id', 'fonograma_id', 'titular_nome', 'titular_doc', 'papel',
    'rights_holder_id', 'publisher_id', 'role', 'territory', 'instrument', 'credited_name',
    'is_primary', 'is_featured', 'start_date', 'end_date', 'share_type', 'percentual', 'status',
    'acordo_notas', 'acordo_url', 'observacoes', 'direcao', 'lancamento_id', 'nome_musica',
    'detentor', 'destinatario', 'tipo', 'artista_externo', 'artista_projeto_id', 'artista_id',
    'pagador', 'pagador_contato', 'origem_acordo', 'data_prevista', 'documentos', 'versao',
    'historico', 'metadata', 'created_at', 'updated_at', 'deleted_at',
  ].join(', ');

  public async up(queryRunner: QueryRunner): Promise<void> {
    const [{ total }] = await queryRunner.query(`SELECT count(*)::int AS total FROM shares`);

    await queryRunner.query(`CREATE TABLE shares_new (${this.newColumns})`);
    await queryRunner.query(`INSERT INTO shares_new (${this.copyColumns}) SELECT ${this.copyColumns} FROM shares`);

    const [{ c: newCount }] = await queryRunner.query(`SELECT count(*)::int AS c FROM shares_new`);
    if (Number(newCount) !== Number(total)) {
      throw new Error(`RebuildSharesInCanonicalFormOrder: count mismatch (original=${total}, new=${newCount}) — aborted.`);
    }

    await queryRunner.query(`ALTER TABLE shares_new ADD CONSTRAINT shares_new_pkey PRIMARY KEY (id)`);
    await queryRunner.query(`ALTER TABLE shares_new ADD CONSTRAINT fk_shares_obra_id_new FOREIGN KEY (obra_id) REFERENCES works(id) ON DELETE SET NULL`);
    await queryRunner.query(`CREATE INDEX idx_shares_tenant_id_new ON shares_new (tenant_id)`);
    await queryRunner.query(`CREATE INDEX idx_shares_obra_id_new ON shares_new (obra_id)`);
    await queryRunner.query(`CREATE INDEX idx_shares_rights_holder_new ON shares_new (rights_holder_id)`);
    await queryRunner.query(`CREATE INDEX idx_shares_publisher_new ON shares_new (publisher_id)`);

    await queryRunner.query(`ALTER TABLE shares RENAME TO shares_old`);
    await queryRunner.query(`ALTER TABLE shares_old RENAME CONSTRAINT shares_pkey TO shares_old_pkey`);
    await queryRunner.query(`ALTER TABLE shares_old RENAME CONSTRAINT fk_shares_obra_id TO fk_shares_obra_id_old`);
    await queryRunner.query(`ALTER INDEX idx_shares_tenant_id RENAME TO idx_shares_tenant_id_old`);
    await queryRunner.query(`ALTER INDEX idx_shares_obra_id RENAME TO idx_shares_obra_id_old`);
    await queryRunner.query(`ALTER INDEX idx_shares_rights_holder RENAME TO idx_shares_rights_holder_old`);
    await queryRunner.query(`ALTER INDEX idx_shares_publisher RENAME TO idx_shares_publisher_old`);

    await queryRunner.query(`ALTER TABLE shares_new RENAME TO shares`);
    await queryRunner.query(`ALTER INDEX shares_new_pkey RENAME TO shares_pkey`);
    await queryRunner.query(`ALTER TABLE shares RENAME CONSTRAINT fk_shares_obra_id_new TO fk_shares_obra_id`);
    await queryRunner.query(`ALTER INDEX idx_shares_tenant_id_new RENAME TO idx_shares_tenant_id`);
    await queryRunner.query(`ALTER INDEX idx_shares_obra_id_new RENAME TO idx_shares_obra_id`);
    await queryRunner.query(`ALTER INDEX idx_shares_rights_holder_new RENAME TO idx_shares_rights_holder`);
    await queryRunner.query(`ALTER INDEX idx_shares_publisher_new RENAME TO idx_shares_publisher`);

    await queryRunner.query(`ALTER TABLE shares ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE shares FORCE ROW LEVEL SECURITY`);
    await queryRunner.query(`
      CREATE POLICY super_admin_full_access ON shares
        AS PERMISSIVE FOR ALL TO authenticated
        USING (app_is_super_admin()) WITH CHECK (app_is_super_admin())
    `);
    await queryRunner.query(`
      CREATE POLICY tenant_isolation ON shares
        AS PERMISSIVE FOR ALL TO authenticated
        USING (tenant_id = private_get_tenant_id()) WITH CHECK (tenant_id = private_get_tenant_id())
    `);

    await queryRunner.query(`ALTER TABLE shares OWNER TO musicos_migrator`);
    await queryRunner.query(`GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON shares TO musicos_migrator`);

    await queryRunner.query(`DROP TABLE shares_old`);
    await queryRunner.query(`ANALYZE shares`);
  }

  private readonly originalColumns = `
    id                    uuid NOT NULL DEFAULT gen_random_uuid(),
    tenant_id             uuid NOT NULL,
    obra_id               uuid,
    fonograma_id          uuid,
    titular_nome          varchar(255),
    titular_doc           varchar(50),
    papel                 varchar(100) NOT NULL DEFAULT 'autor',
    percentual            numeric,
    status                varchar(50) NOT NULL DEFAULT 'ativo',
    metadata              jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at            timestamp NOT NULL DEFAULT now(),
    updated_at            timestamp NOT NULL DEFAULT now(),
    deleted_at            timestamp,
    rights_holder_id      uuid,
    publisher_id          uuid,
    role                  varchar(50),
    territory             varchar(10),
    instrument            varchar(100),
    credited_name         varchar(255),
    is_primary            boolean,
    is_featured           boolean,
    start_date            timestamp,
    end_date              timestamp,
    share_type            varchar(30),
    direcao               varchar(20),
    lancamento_id         uuid,
    nome_musica           varchar(500),
    detentor              varchar(255),
    destinatario          varchar(255),
    tipo                  varchar(100),
    artista_externo       varchar(255),
    artista_projeto_id    uuid,
    artista_id            uuid,
    pagador               varchar(255),
    pagador_contato       varchar(255),
    origem_acordo         varchar(255),
    data_prevista         date,
    documentos            text,
    acordo_notas          text,
    acordo_url            text,
    observacoes           text,
    versao                integer,
    historico             jsonb
  `;

  public async down(queryRunner: QueryRunner): Promise<void> {
    const [{ total }] = await queryRunner.query(`SELECT count(*)::int AS total FROM shares`);

    await queryRunner.query(`CREATE TABLE shares_restore (${this.originalColumns})`);
    await queryRunner.query(`INSERT INTO shares_restore (${this.copyColumns}) SELECT ${this.copyColumns} FROM shares`);

    const [{ c: restoredCount }] = await queryRunner.query(`SELECT count(*)::int AS c FROM shares_restore`);
    if (Number(restoredCount) !== Number(total)) {
      throw new Error(`RebuildSharesInCanonicalFormOrder.down: count mismatch (original=${total}, restored=${restoredCount}) — aborted.`);
    }

    await queryRunner.query(`ALTER TABLE shares_restore ADD CONSTRAINT shares_restore_pkey PRIMARY KEY (id)`);
    await queryRunner.query(`ALTER TABLE shares_restore ADD CONSTRAINT fk_shares_obra_id_restore FOREIGN KEY (obra_id) REFERENCES works(id) ON DELETE SET NULL`);
    await queryRunner.query(`CREATE INDEX idx_shares_tenant_id_restore ON shares_restore (tenant_id)`);
    await queryRunner.query(`CREATE INDEX idx_shares_obra_id_restore ON shares_restore (obra_id)`);
    await queryRunner.query(`CREATE INDEX idx_shares_rights_holder_restore ON shares_restore (rights_holder_id)`);
    await queryRunner.query(`CREATE INDEX idx_shares_publisher_restore ON shares_restore (publisher_id)`);

    await queryRunner.query(`ALTER TABLE shares RENAME TO shares_canonical`);
    await queryRunner.query(`ALTER TABLE shares_canonical RENAME CONSTRAINT shares_pkey TO shares_canonical_pkey`);
    await queryRunner.query(`ALTER TABLE shares_canonical RENAME CONSTRAINT fk_shares_obra_id TO fk_shares_obra_id_canonical`);
    await queryRunner.query(`ALTER INDEX idx_shares_tenant_id RENAME TO idx_shares_tenant_id_canonical`);
    await queryRunner.query(`ALTER INDEX idx_shares_obra_id RENAME TO idx_shares_obra_id_canonical`);
    await queryRunner.query(`ALTER INDEX idx_shares_rights_holder RENAME TO idx_shares_rights_holder_canonical`);
    await queryRunner.query(`ALTER INDEX idx_shares_publisher RENAME TO idx_shares_publisher_canonical`);

    await queryRunner.query(`ALTER TABLE shares_restore RENAME TO shares`);
    await queryRunner.query(`ALTER INDEX shares_restore_pkey RENAME TO shares_pkey`);
    await queryRunner.query(`ALTER TABLE shares RENAME CONSTRAINT fk_shares_obra_id_restore TO fk_shares_obra_id`);
    await queryRunner.query(`ALTER INDEX idx_shares_tenant_id_restore RENAME TO idx_shares_tenant_id`);
    await queryRunner.query(`ALTER INDEX idx_shares_obra_id_restore RENAME TO idx_shares_obra_id`);
    await queryRunner.query(`ALTER INDEX idx_shares_rights_holder_restore RENAME TO idx_shares_rights_holder`);
    await queryRunner.query(`ALTER INDEX idx_shares_publisher_restore RENAME TO idx_shares_publisher`);

    await queryRunner.query(`ALTER TABLE shares ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE shares FORCE ROW LEVEL SECURITY`);
    await queryRunner.query(`
      CREATE POLICY super_admin_full_access ON shares
        AS PERMISSIVE FOR ALL TO authenticated
        USING (app_is_super_admin()) WITH CHECK (app_is_super_admin())
    `);
    await queryRunner.query(`
      CREATE POLICY tenant_isolation ON shares
        AS PERMISSIVE FOR ALL TO authenticated
        USING (tenant_id = private_get_tenant_id()) WITH CHECK (tenant_id = private_get_tenant_id())
    `);

    await queryRunner.query(`ALTER TABLE shares OWNER TO musicos_migrator`);
    await queryRunner.query(`GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON shares TO musicos_migrator`);

    await queryRunner.query(`DROP TABLE shares_canonical`);
    await queryRunner.query(`ANALYZE shares`);
  }
}
