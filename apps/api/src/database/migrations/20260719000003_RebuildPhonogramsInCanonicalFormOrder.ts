import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Physical rebuild of `phonograms` in the canonical order of the real form
 * (FonogramaFormModal) — 2026-07-19 audit. Same pattern as
 * RebuildWorksInCanonicalFormOrder20260719000002.
 *
 * Real visual order: "Título da Obra Vinculada" (obra_id) is the first section
 * of the form; `titulo`/`observacoes` have no visible input of their own (titulo is
 * inherited from the linked work or filled only programmatically) but they are
 * identity fields of the record, positioned right after the section they
 * belong to. "Participação" (producer/performer/musician — `participacao`
 * jsonb) and "Upload de Áudio" (`arquivo_audio` jsonb) are real, visible
 * sections. `compositores`/`interpretes`/`produtores` (free text) are
 * derived legacy fields without their own input — they go to the legacy block.
 */
export class RebuildPhonogramsInCanonicalFormOrder20260719000003 implements MigrationInterface {
  name = 'RebuildPhonogramsInCanonicalFormOrder20260719000003';

  private readonly newColumns = `
    id                                  uuid NOT NULL DEFAULT gen_random_uuid(),
    tenant_id                           uuid NOT NULL,
    obra_id                             uuid,
    titulo                              varchar(500) NOT NULL,
    cod_entidade                        varchar(100),
    cod_ecad                            varchar(100),
    agregadora                          varchar(100),
    isrc                                varchar(20),
    isrc_pais                           varchar(5),
    isrc_registrante                    varchar(10),
    isrc_ano                            varchar(4),
    isrc_designacao                     varchar(10),
    criada_por_ia                       boolean,
    instrumental                        boolean,
    emissao                             date,
    gravacao_original                   date,
    data_lancamento                     date,
    duracao                             varchar(20),
    duracao_min                         integer,
    duracao_seg                         integer,
    genero_musical                      varchar(100),
    midia                               varchar(50),
    nacional                            boolean,
    pub_simultanea                      boolean,
    pais_origem                         varchar(100),
    pais_publicacao                     varchar(100),
    classificacao                       varchar(50),
    status                              varchar(50) NOT NULL DEFAULT 'pendente',
    participacao                        jsonb,
    arquivo_audio                       jsonb,
    observacoes                         text,
    artista_id                          uuid,
    tipo                                varchar(100) NOT NULL,
    compositores                        text,
    interpretes                         text,
    produtores                          text,
    gravadora                           varchar(255),
    version_title                       varchar(255),
    recording_date                      timestamp,
    release_date                        timestamp,
    phonographic_producer_id            uuid,
    main_artist_id                      uuid,
    label_id                            uuid,
    copyright_year                      integer,
    copyright_owner                     varchar(255),
    country_of_recording                varchar(2),
    audio_file_id                       uuid,
    duration_seconds                    integer,
    registry_status                     varchar(50),
    external_reference                  varchar(255),
    origem_externa                      varchar(100),
    origem_externa_id                   varchar(255),
    origem_externa_sincronizado_em      timestamp,
    metadata                            jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at                          timestamp NOT NULL DEFAULT now(),
    updated_at                          timestamp NOT NULL DEFAULT now(),
    created_by                          varchar(255),
    updated_by                          varchar(255),
    deleted_at                          timestamp
  `;

  private readonly copyColumns = [
    'id', 'tenant_id', 'obra_id', 'titulo', 'cod_entidade', 'cod_ecad', 'agregadora', 'isrc',
    'isrc_pais', 'isrc_registrante', 'isrc_ano', 'isrc_designacao', 'criada_por_ia',
    'instrumental', 'emissao', 'gravacao_original', 'data_lancamento', 'duracao', 'duracao_min',
    'duracao_seg', 'genero_musical', 'midia', 'nacional', 'pub_simultanea', 'pais_origem',
    'pais_publicacao', 'classificacao', 'status', 'participacao', 'arquivo_audio', 'observacoes',
    'artista_id', 'tipo', 'compositores', 'interpretes', 'produtores', 'gravadora',
    'version_title', 'recording_date', 'release_date', 'phonographic_producer_id',
    'main_artist_id', 'label_id', 'copyright_year', 'copyright_owner', 'country_of_recording',
    'audio_file_id', 'duration_seconds', 'registry_status', 'external_reference',
    'origem_externa', 'origem_externa_id', 'origem_externa_sincronizado_em', 'metadata',
    'created_at', 'updated_at', 'created_by', 'updated_by', 'deleted_at',
  ].join(', ');

  private readonly registryStatusCheck = `((registry_status IS NULL) OR ((registry_status)::text = ANY ((ARRAY['DRAFT'::character varying, 'READY_FOR_VALIDATION'::character varying, 'VALIDATED'::character varying, 'READY_TO_SUBMIT'::character varying, 'SUBMITTED'::character varying, 'PROCESSING'::character varying, 'APPROVED'::character varying, 'REJECTED'::character varying, 'REQUIRES_CORRECTION'::character varying, 'FAILED'::character varying, 'ARCHIVED'::character varying])::text[])))`;

  public async up(queryRunner: QueryRunner): Promise<void> {
    const [{ total }] = await queryRunner.query(`SELECT count(*)::int AS total FROM phonograms`);

    await queryRunner.query(`CREATE TABLE phonograms_new (${this.newColumns})`);
    await queryRunner.query(`INSERT INTO phonograms_new (${this.copyColumns}) SELECT ${this.copyColumns} FROM phonograms`);

    const [{ c: newCount }] = await queryRunner.query(`SELECT count(*)::int AS c FROM phonograms_new`);
    if (Number(newCount) !== Number(total)) {
      throw new Error(`RebuildPhonogramsInCanonicalFormOrder: count mismatch (original=${total}, new=${newCount}) — aborted.`);
    }

    await queryRunner.query(`ALTER TABLE phonograms_new ADD CONSTRAINT phonograms_new_pkey PRIMARY KEY (id)`);
    await queryRunner.query(`ALTER TABLE phonograms_new ADD CONSTRAINT uq_phonograms_tenant_id_id_new UNIQUE (tenant_id, id)`);
    await queryRunner.query(`ALTER TABLE phonograms_new ADD CONSTRAINT chk_phonograms_registry_status_new CHECK (${this.registryStatusCheck})`);
    await queryRunner.query(`ALTER TABLE phonograms_new ADD CONSTRAINT fk_phonograms_artista_id_new FOREIGN KEY (artista_id) REFERENCES artists(id) ON DELETE SET NULL`);
    await queryRunner.query(`ALTER TABLE phonograms_new ADD CONSTRAINT fk_phonograms_obra_id_new FOREIGN KEY (obra_id) REFERENCES works(id) ON DELETE SET NULL`);
    await queryRunner.query(`CREATE INDEX idx_phonograms_tenant_id_new ON phonograms_new (tenant_id)`);
    await queryRunner.query(`CREATE INDEX idx_phonograms_obra_id_new ON phonograms_new (obra_id)`);
    await queryRunner.query(`CREATE INDEX idx_phonograms_artista_id_new ON phonograms_new (artista_id)`);
    await queryRunner.query(`CREATE INDEX idx_phonograms_isrc_new ON phonograms_new (isrc)`);
    await queryRunner.query(`CREATE INDEX idx_phonograms_tenant_active_new ON phonograms_new (tenant_id, deleted_at, created_at DESC) WHERE (deleted_at IS NULL)`);
    await queryRunner.query(`CREATE INDEX idx_phonograms_registry_status_new ON phonograms_new (tenant_id, registry_status)`);
    await queryRunner.query(`CREATE INDEX idx_phonograms_producer_new ON phonograms_new (phonographic_producer_id)`);
    await queryRunner.query(`CREATE INDEX idx_phonograms_audio_file_new ON phonograms_new (audio_file_id)`);

    await queryRunner.query(`ALTER TABLE transaction_allocations DROP CONSTRAINT fk_txalloc_phonogram`);
    await queryRunner.query(`ALTER TABLE performance_metric_entries DROP CONSTRAINT fk_metric_phonogram`);

    await queryRunner.query(`ALTER TABLE phonograms RENAME TO phonograms_old`);
    await queryRunner.query(`ALTER TABLE phonograms_old RENAME CONSTRAINT phonograms_pkey TO phonograms_old_pkey`);
    await queryRunner.query(`ALTER TABLE phonograms_old RENAME CONSTRAINT uq_phonograms_tenant_id_id TO uq_phonograms_tenant_id_id_old`);
    await queryRunner.query(`ALTER TABLE phonograms_old RENAME CONSTRAINT chk_phonograms_registry_status TO chk_phonograms_registry_status_old`);
    await queryRunner.query(`ALTER TABLE phonograms_old RENAME CONSTRAINT fk_phonograms_artista_id TO fk_phonograms_artista_id_old`);
    await queryRunner.query(`ALTER TABLE phonograms_old RENAME CONSTRAINT fk_phonograms_obra_id TO fk_phonograms_obra_id_old`);
    await queryRunner.query(`ALTER INDEX idx_phonograms_tenant_id RENAME TO idx_phonograms_tenant_id_old`);
    await queryRunner.query(`ALTER INDEX idx_phonograms_obra_id RENAME TO idx_phonograms_obra_id_old`);
    await queryRunner.query(`ALTER INDEX idx_phonograms_artista_id RENAME TO idx_phonograms_artista_id_old`);
    await queryRunner.query(`ALTER INDEX idx_phonograms_isrc RENAME TO idx_phonograms_isrc_old`);
    await queryRunner.query(`ALTER INDEX idx_phonograms_tenant_active RENAME TO idx_phonograms_tenant_active_old`);
    await queryRunner.query(`ALTER INDEX idx_phonograms_registry_status RENAME TO idx_phonograms_registry_status_old`);
    await queryRunner.query(`ALTER INDEX idx_phonograms_producer RENAME TO idx_phonograms_producer_old`);
    await queryRunner.query(`ALTER INDEX idx_phonograms_audio_file RENAME TO idx_phonograms_audio_file_old`);

    await queryRunner.query(`ALTER TABLE phonograms_new RENAME TO phonograms`);
    await queryRunner.query(`ALTER INDEX phonograms_new_pkey RENAME TO phonograms_pkey`);
    await queryRunner.query(`ALTER TABLE phonograms RENAME CONSTRAINT uq_phonograms_tenant_id_id_new TO uq_phonograms_tenant_id_id`);
    await queryRunner.query(`ALTER TABLE phonograms RENAME CONSTRAINT chk_phonograms_registry_status_new TO chk_phonograms_registry_status`);
    await queryRunner.query(`ALTER TABLE phonograms RENAME CONSTRAINT fk_phonograms_artista_id_new TO fk_phonograms_artista_id`);
    await queryRunner.query(`ALTER TABLE phonograms RENAME CONSTRAINT fk_phonograms_obra_id_new TO fk_phonograms_obra_id`);
    await queryRunner.query(`ALTER INDEX idx_phonograms_tenant_id_new RENAME TO idx_phonograms_tenant_id`);
    await queryRunner.query(`ALTER INDEX idx_phonograms_obra_id_new RENAME TO idx_phonograms_obra_id`);
    await queryRunner.query(`ALTER INDEX idx_phonograms_artista_id_new RENAME TO idx_phonograms_artista_id`);
    await queryRunner.query(`ALTER INDEX idx_phonograms_isrc_new RENAME TO idx_phonograms_isrc`);
    await queryRunner.query(`ALTER INDEX idx_phonograms_tenant_active_new RENAME TO idx_phonograms_tenant_active`);
    await queryRunner.query(`ALTER INDEX idx_phonograms_registry_status_new RENAME TO idx_phonograms_registry_status`);
    await queryRunner.query(`ALTER INDEX idx_phonograms_producer_new RENAME TO idx_phonograms_producer`);
    await queryRunner.query(`ALTER INDEX idx_phonograms_audio_file_new RENAME TO idx_phonograms_audio_file`);

    await queryRunner.query(`ALTER TABLE transaction_allocations ADD CONSTRAINT fk_txalloc_phonogram FOREIGN KEY (tenant_id, phonogram_id) REFERENCES phonograms(tenant_id, id)`);
    await queryRunner.query(`ALTER TABLE performance_metric_entries ADD CONSTRAINT fk_metric_phonogram FOREIGN KEY (tenant_id, phonogram_id) REFERENCES phonograms(tenant_id, id)`);

    await queryRunner.query(`ALTER TABLE phonograms ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE phonograms FORCE ROW LEVEL SECURITY`);
    await queryRunner.query(`
      CREATE POLICY super_admin_full_access ON phonograms
        AS PERMISSIVE FOR ALL TO authenticated
        USING (app_is_super_admin()) WITH CHECK (app_is_super_admin())
    `);
    await queryRunner.query(`
      CREATE POLICY tenant_isolation ON phonograms
        AS PERMISSIVE FOR ALL TO authenticated
        USING (tenant_id = private_get_tenant_id()) WITH CHECK (tenant_id = private_get_tenant_id())
    `);

    await queryRunner.query(`ALTER TABLE phonograms OWNER TO musicos_migrator`);
    await queryRunner.query(`GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON phonograms TO musicos_migrator`);

    await queryRunner.query(`DROP TABLE phonograms_old`);
    await queryRunner.query(`ANALYZE phonograms`);
  }

  // ORIGINAL (pre-migration) order/types — to revert honestly.
  private readonly originalColumns = `
    id                                  uuid NOT NULL DEFAULT gen_random_uuid(),
    tenant_id                           uuid NOT NULL,
    titulo                              varchar(500) NOT NULL,
    obra_id                             uuid,
    artista_id                          uuid,
    isrc                                varchar(20),
    duracao                             varchar(20),
    tipo                                varchar(100) NOT NULL,
    status                              varchar(50) NOT NULL DEFAULT 'pendente',
    compositores                        text,
    interpretes                         text,
    produtores                          text,
    gravadora                           varchar(255),
    origem_externa                      varchar(100),
    origem_externa_id                   varchar(255),
    origem_externa_sincronizado_em      timestamp,
    metadata                            jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at                          timestamp NOT NULL DEFAULT now(),
    updated_at                          timestamp NOT NULL DEFAULT now(),
    deleted_at                          timestamp,
    created_by                          varchar(255),
    updated_by                          varchar(255),
    version_title                       varchar(255),
    recording_date                      timestamp,
    release_date                        timestamp,
    phonographic_producer_id            uuid,
    main_artist_id                      uuid,
    label_id                            uuid,
    copyright_year                      integer,
    copyright_owner                     varchar(255),
    country_of_recording                varchar(2),
    audio_file_id                       uuid,
    duration_seconds                    integer,
    registry_status                     varchar(50),
    external_reference                  varchar(255),
    genero_musical                      varchar(100),
    agregadora                          varchar(100),
    isrc_pais                           varchar(5),
    isrc_registrante                    varchar(10),
    isrc_ano                            varchar(4),
    isrc_designacao                     varchar(10),
    criada_por_ia                       boolean,
    instrumental                        boolean,
    nacional                            boolean,
    pub_simultanea                      boolean,
    emissao                             date,
    gravacao_original                   date,
    data_lancamento                     date,
    duracao_min                         integer,
    duracao_seg                         integer,
    midia                               varchar(50),
    classificacao                       varchar(50),
    pais_origem                         varchar(100),
    pais_publicacao                     varchar(100),
    observacoes                         text,
    participacao                        jsonb,
    arquivo_audio                       jsonb,
    cod_ecad                            varchar(100),
    cod_entidade                        varchar(100)
  `;

  public async down(queryRunner: QueryRunner): Promise<void> {
    const [{ total }] = await queryRunner.query(`SELECT count(*)::int AS total FROM phonograms`);

    await queryRunner.query(`CREATE TABLE phonograms_restore (${this.originalColumns})`);
    await queryRunner.query(`INSERT INTO phonograms_restore (${this.copyColumns}) SELECT ${this.copyColumns} FROM phonograms`);

    const [{ c: restoredCount }] = await queryRunner.query(`SELECT count(*)::int AS c FROM phonograms_restore`);
    if (Number(restoredCount) !== Number(total)) {
      throw new Error(`RebuildPhonogramsInCanonicalFormOrder.down: count mismatch (original=${total}, restored=${restoredCount}) — aborted.`);
    }

    await queryRunner.query(`ALTER TABLE phonograms_restore ADD CONSTRAINT phonograms_restore_pkey PRIMARY KEY (id)`);
    await queryRunner.query(`ALTER TABLE phonograms_restore ADD CONSTRAINT uq_phonograms_tenant_id_id_restore UNIQUE (tenant_id, id)`);
    await queryRunner.query(`ALTER TABLE phonograms_restore ADD CONSTRAINT chk_phonograms_registry_status_restore CHECK (${this.registryStatusCheck})`);
    await queryRunner.query(`ALTER TABLE phonograms_restore ADD CONSTRAINT fk_phonograms_artista_id_restore FOREIGN KEY (artista_id) REFERENCES artists(id) ON DELETE SET NULL`);
    await queryRunner.query(`ALTER TABLE phonograms_restore ADD CONSTRAINT fk_phonograms_obra_id_restore FOREIGN KEY (obra_id) REFERENCES works(id) ON DELETE SET NULL`);
    await queryRunner.query(`CREATE INDEX idx_phonograms_tenant_id_restore ON phonograms_restore (tenant_id)`);
    await queryRunner.query(`CREATE INDEX idx_phonograms_obra_id_restore ON phonograms_restore (obra_id)`);
    await queryRunner.query(`CREATE INDEX idx_phonograms_artista_id_restore ON phonograms_restore (artista_id)`);
    await queryRunner.query(`CREATE INDEX idx_phonograms_isrc_restore ON phonograms_restore (isrc)`);
    await queryRunner.query(`CREATE INDEX idx_phonograms_tenant_active_restore ON phonograms_restore (tenant_id, deleted_at, created_at DESC) WHERE (deleted_at IS NULL)`);
    await queryRunner.query(`CREATE INDEX idx_phonograms_registry_status_restore ON phonograms_restore (tenant_id, registry_status)`);
    await queryRunner.query(`CREATE INDEX idx_phonograms_producer_restore ON phonograms_restore (phonographic_producer_id)`);
    await queryRunner.query(`CREATE INDEX idx_phonograms_audio_file_restore ON phonograms_restore (audio_file_id)`);

    await queryRunner.query(`ALTER TABLE transaction_allocations DROP CONSTRAINT fk_txalloc_phonogram`);
    await queryRunner.query(`ALTER TABLE performance_metric_entries DROP CONSTRAINT fk_metric_phonogram`);

    await queryRunner.query(`ALTER TABLE phonograms RENAME TO phonograms_canonical`);
    await queryRunner.query(`ALTER TABLE phonograms_canonical RENAME CONSTRAINT phonograms_pkey TO phonograms_canonical_pkey`);
    await queryRunner.query(`ALTER TABLE phonograms_canonical RENAME CONSTRAINT uq_phonograms_tenant_id_id TO uq_phonograms_tenant_id_id_canonical`);
    await queryRunner.query(`ALTER TABLE phonograms_canonical RENAME CONSTRAINT chk_phonograms_registry_status TO chk_phonograms_registry_status_canonical`);
    await queryRunner.query(`ALTER TABLE phonograms_canonical RENAME CONSTRAINT fk_phonograms_artista_id TO fk_phonograms_artista_id_canonical`);
    await queryRunner.query(`ALTER TABLE phonograms_canonical RENAME CONSTRAINT fk_phonograms_obra_id TO fk_phonograms_obra_id_canonical`);
    await queryRunner.query(`ALTER INDEX idx_phonograms_tenant_id RENAME TO idx_phonograms_tenant_id_canonical`);
    await queryRunner.query(`ALTER INDEX idx_phonograms_obra_id RENAME TO idx_phonograms_obra_id_canonical`);
    await queryRunner.query(`ALTER INDEX idx_phonograms_artista_id RENAME TO idx_phonograms_artista_id_canonical`);
    await queryRunner.query(`ALTER INDEX idx_phonograms_isrc RENAME TO idx_phonograms_isrc_canonical`);
    await queryRunner.query(`ALTER INDEX idx_phonograms_tenant_active RENAME TO idx_phonograms_tenant_active_canonical`);
    await queryRunner.query(`ALTER INDEX idx_phonograms_registry_status RENAME TO idx_phonograms_registry_status_canonical`);
    await queryRunner.query(`ALTER INDEX idx_phonograms_producer RENAME TO idx_phonograms_producer_canonical`);
    await queryRunner.query(`ALTER INDEX idx_phonograms_audio_file RENAME TO idx_phonograms_audio_file_canonical`);

    await queryRunner.query(`ALTER TABLE phonograms_restore RENAME TO phonograms`);
    await queryRunner.query(`ALTER INDEX phonograms_restore_pkey RENAME TO phonograms_pkey`);
    await queryRunner.query(`ALTER TABLE phonograms RENAME CONSTRAINT uq_phonograms_tenant_id_id_restore TO uq_phonograms_tenant_id_id`);
    await queryRunner.query(`ALTER TABLE phonograms RENAME CONSTRAINT chk_phonograms_registry_status_restore TO chk_phonograms_registry_status`);
    await queryRunner.query(`ALTER TABLE phonograms RENAME CONSTRAINT fk_phonograms_artista_id_restore TO fk_phonograms_artista_id`);
    await queryRunner.query(`ALTER TABLE phonograms RENAME CONSTRAINT fk_phonograms_obra_id_restore TO fk_phonograms_obra_id`);
    await queryRunner.query(`ALTER INDEX idx_phonograms_tenant_id_restore RENAME TO idx_phonograms_tenant_id`);
    await queryRunner.query(`ALTER INDEX idx_phonograms_obra_id_restore RENAME TO idx_phonograms_obra_id`);
    await queryRunner.query(`ALTER INDEX idx_phonograms_artista_id_restore RENAME TO idx_phonograms_artista_id`);
    await queryRunner.query(`ALTER INDEX idx_phonograms_isrc_restore RENAME TO idx_phonograms_isrc`);
    await queryRunner.query(`ALTER INDEX idx_phonograms_tenant_active_restore RENAME TO idx_phonograms_tenant_active`);
    await queryRunner.query(`ALTER INDEX idx_phonograms_registry_status_restore RENAME TO idx_phonograms_registry_status`);
    await queryRunner.query(`ALTER INDEX idx_phonograms_producer_restore RENAME TO idx_phonograms_producer`);
    await queryRunner.query(`ALTER INDEX idx_phonograms_audio_file_restore RENAME TO idx_phonograms_audio_file`);

    await queryRunner.query(`ALTER TABLE transaction_allocations ADD CONSTRAINT fk_txalloc_phonogram FOREIGN KEY (tenant_id, phonogram_id) REFERENCES phonograms(tenant_id, id)`);
    await queryRunner.query(`ALTER TABLE performance_metric_entries ADD CONSTRAINT fk_metric_phonogram FOREIGN KEY (tenant_id, phonogram_id) REFERENCES phonograms(tenant_id, id)`);

    await queryRunner.query(`ALTER TABLE phonograms ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE phonograms FORCE ROW LEVEL SECURITY`);
    await queryRunner.query(`
      CREATE POLICY super_admin_full_access ON phonograms
        AS PERMISSIVE FOR ALL TO authenticated
        USING (app_is_super_admin()) WITH CHECK (app_is_super_admin())
    `);
    await queryRunner.query(`
      CREATE POLICY tenant_isolation ON phonograms
        AS PERMISSIVE FOR ALL TO authenticated
        USING (tenant_id = private_get_tenant_id()) WITH CHECK (tenant_id = private_get_tenant_id())
    `);

    await queryRunner.query(`ALTER TABLE phonograms OWNER TO musicos_migrator`);
    await queryRunner.query(`GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON phonograms TO musicos_migrator`);

    await queryRunner.query(`DROP TABLE phonograms_canonical`);
    await queryRunner.query(`ANALYZE phonograms`);
  }
}
