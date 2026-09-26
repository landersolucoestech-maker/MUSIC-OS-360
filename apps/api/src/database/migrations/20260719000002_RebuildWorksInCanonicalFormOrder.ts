import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Physical rebuild of `works` in the canonical order of the real form
 * (ObraFormModal) — 2026-07-19 audit. Same pattern as
 * RebuildArtistsInCanonicalFormOrder20260719000001: PostgreSQL has no ALTER
 * COLUMN POSITION, so the only way to reorder is to create a replacement
 * table, copy the data column by column, swap via RENAME (never
 * CASCADE) and recreate the whole dependency chain.
 *
 * Real visual order of the form ("Vincular a Projeto Concluído" appears first,
 * before "Dados Principais da Obra"): projeto_id, cod_entidade, cod_ecad,
 * iswc, titulo, genero, idioma, duracao, instrumental, criada_por_ia, status,
 * tipo_ia, ia_harmonia, ia_melodia, ia_letra, outros_titulos,
 * referencias_conexas, letra_completa. `isrc` does NOT appear in this form
 * (it identifies phonograms, not works) — it goes to the legacy block.
 */
export class RebuildWorksInCanonicalFormOrder20260719000002 implements MigrationInterface {
  name = 'RebuildWorksInCanonicalFormOrder20260719000002';

  private readonly newColumns = `
    id                                  uuid NOT NULL DEFAULT gen_random_uuid(),
    tenant_id                           uuid NOT NULL,
    projeto_id                          uuid,
    cod_entidade                        varchar(100),
    cod_ecad                            varchar(100),
    iswc                                varchar(20),
    titulo                              varchar(500) NOT NULL,
    genero                              varchar(100),
    idioma                              varchar(20),
    duracao                             varchar(20),
    instrumental                        varchar(10),
    criada_por_ia                       boolean,
    status                              varchar(50) NOT NULL DEFAULT 'pendente',
    tipo_ia                             varchar(50),
    ia_harmonia                         jsonb,
    ia_melodia                          jsonb,
    ia_letra                            jsonb,
    outros_titulos                      jsonb,
    referencias_conexas                 jsonb,
    letra_completa                      text,
    artista_id                          uuid,
    tipo                                varchar(100) NOT NULL,
    tipo_obra                           varchar(50),
    compositor                          varchar(255),
    compositores                        jsonb,
    editora                             varchar(255),
    letristas                           jsonb,
    isrc                                varchar(20),
    alternative_titles                  jsonb,
    language                            varchar(10),
    lyrics                              text,
    is_instrumental                     boolean,
    duration_seconds                    integer,
    registry_status                     varchar(50),
    external_reference                  varchar(255),
    ai_used                             boolean,
    ai_tools                            jsonb,
    ai_prompts                          jsonb,
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
    'id', 'tenant_id', 'projeto_id', 'cod_entidade', 'cod_ecad', 'iswc', 'titulo', 'genero',
    'idioma', 'duracao', 'instrumental', 'criada_por_ia', 'status', 'tipo_ia', 'ia_harmonia',
    'ia_melodia', 'ia_letra', 'outros_titulos', 'referencias_conexas', 'letra_completa',
    'artista_id', 'tipo', 'tipo_obra', 'compositor', 'compositores', 'editora', 'letristas',
    'isrc', 'alternative_titles', 'language', 'lyrics', 'is_instrumental', 'duration_seconds',
    'registry_status', 'external_reference', 'ai_used', 'ai_tools', 'ai_prompts',
    'origem_externa', 'origem_externa_id', 'origem_externa_sincronizado_em', 'metadata',
    'created_at', 'updated_at', 'created_by', 'updated_by', 'deleted_at',
  ].join(', ');

  private readonly registryStatusCheck = `((registry_status IS NULL) OR ((registry_status)::text = ANY ((ARRAY['DRAFT'::character varying, 'READY_FOR_VALIDATION'::character varying, 'VALIDATED'::character varying, 'READY_TO_SUBMIT'::character varying, 'SUBMITTED'::character varying, 'PROCESSING'::character varying, 'APPROVED'::character varying, 'REJECTED'::character varying, 'REQUIRES_CORRECTION'::character varying, 'FAILED'::character varying, 'ARCHIVED'::character varying])::text[])))`;

  public async up(queryRunner: QueryRunner): Promise<void> {
    const [{ total }] = await queryRunner.query(`SELECT count(*)::int AS total FROM works`);

    await queryRunner.query(`CREATE TABLE works_new (${this.newColumns})`);
    await queryRunner.query(`INSERT INTO works_new (${this.copyColumns}) SELECT ${this.copyColumns} FROM works`);

    const [{ c: newCount }] = await queryRunner.query(`SELECT count(*)::int AS c FROM works_new`);
    if (Number(newCount) !== Number(total)) {
      throw new Error(`RebuildWorksInCanonicalFormOrder: count mismatch (original=${total}, new=${newCount}) — aborted.`);
    }

    await queryRunner.query(`ALTER TABLE works_new ADD CONSTRAINT works_new_pkey PRIMARY KEY (id)`);
    await queryRunner.query(`ALTER TABLE works_new ADD CONSTRAINT chk_works_registry_status_new CHECK (${this.registryStatusCheck})`);
    await queryRunner.query(`CREATE INDEX idx_works_tenant_id_new ON works_new (tenant_id)`);
    await queryRunner.query(`CREATE INDEX idx_works_tenant_status_new ON works_new (tenant_id, status)`);
    await queryRunner.query(`CREATE INDEX idx_works_isrc_new ON works_new (isrc)`);
    await queryRunner.query(`CREATE INDEX idx_works_iswc_new ON works_new (iswc)`);
    await queryRunner.query(`CREATE INDEX idx_works_tenant_active_new ON works_new (tenant_id, deleted_at, created_at DESC) WHERE (deleted_at IS NULL)`);
    await queryRunner.query(`CREATE INDEX idx_works_artista_id_new ON works_new (artista_id)`);
    await queryRunner.query(`CREATE INDEX idx_works_registry_status_new ON works_new (tenant_id, registry_status)`);

    // FKs of other tables pointing to works — they must be recreated after the swap.
    await queryRunner.query(`ALTER TABLE release_works DROP CONSTRAINT "FK_release_works_work"`);
    await queryRunner.query(`ALTER TABLE phonograms DROP CONSTRAINT fk_phonograms_obra_id`);
    await queryRunner.query(`ALTER TABLE shares DROP CONSTRAINT fk_shares_obra_id`);
    await queryRunner.query(`ALTER TABLE work_participants DROP CONSTRAINT work_participants_work_id_fkey`);

    // release_works.tenant_isolation references `works` in an EXISTS subquery — the
    // policy stays bound to the relation's OID and blocks DROP TABLE works_old if
    // it is not recreated after the swap.
    await queryRunner.query(`DROP POLICY tenant_isolation ON release_works`);

    await queryRunner.query(`ALTER TABLE works RENAME TO works_old`);
    await queryRunner.query(`ALTER TABLE works_old RENAME CONSTRAINT works_pkey TO works_old_pkey`);
    await queryRunner.query(`ALTER TABLE works_old RENAME CONSTRAINT chk_works_registry_status TO chk_works_registry_status_old`);
    await queryRunner.query(`ALTER INDEX idx_works_tenant_id RENAME TO idx_works_tenant_id_old`);
    await queryRunner.query(`ALTER INDEX idx_works_tenant_status RENAME TO idx_works_tenant_status_old`);
    await queryRunner.query(`ALTER INDEX idx_works_isrc RENAME TO idx_works_isrc_old`);
    await queryRunner.query(`ALTER INDEX idx_works_iswc RENAME TO idx_works_iswc_old`);
    await queryRunner.query(`ALTER INDEX idx_works_tenant_active RENAME TO idx_works_tenant_active_old`);
    await queryRunner.query(`ALTER INDEX idx_works_artista_id RENAME TO idx_works_artista_id_old`);
    await queryRunner.query(`ALTER INDEX idx_works_registry_status RENAME TO idx_works_registry_status_old`);

    await queryRunner.query(`ALTER TABLE works_new RENAME TO works`);
    await queryRunner.query(`ALTER INDEX works_new_pkey RENAME TO works_pkey`);
    await queryRunner.query(`ALTER TABLE works RENAME CONSTRAINT chk_works_registry_status_new TO chk_works_registry_status`);
    await queryRunner.query(`ALTER INDEX idx_works_tenant_id_new RENAME TO idx_works_tenant_id`);
    await queryRunner.query(`ALTER INDEX idx_works_tenant_status_new RENAME TO idx_works_tenant_status`);
    await queryRunner.query(`ALTER INDEX idx_works_isrc_new RENAME TO idx_works_isrc`);
    await queryRunner.query(`ALTER INDEX idx_works_iswc_new RENAME TO idx_works_iswc`);
    await queryRunner.query(`ALTER INDEX idx_works_tenant_active_new RENAME TO idx_works_tenant_active`);
    await queryRunner.query(`ALTER INDEX idx_works_artista_id_new RENAME TO idx_works_artista_id`);
    await queryRunner.query(`ALTER INDEX idx_works_registry_status_new RENAME TO idx_works_registry_status`);

    await queryRunner.query(`ALTER TABLE works ADD CONSTRAINT fk_works_artista_id FOREIGN KEY (artista_id) REFERENCES artists(id) ON DELETE SET NULL`);
    await queryRunner.query(`ALTER TABLE release_works ADD CONSTRAINT "FK_release_works_work" FOREIGN KEY (work_id) REFERENCES works(id) ON DELETE CASCADE`);
    await queryRunner.query(`ALTER TABLE phonograms ADD CONSTRAINT fk_phonograms_obra_id FOREIGN KEY (obra_id) REFERENCES works(id) ON DELETE SET NULL`);
    await queryRunner.query(`ALTER TABLE shares ADD CONSTRAINT fk_shares_obra_id FOREIGN KEY (obra_id) REFERENCES works(id) ON DELETE SET NULL`);
    await queryRunner.query(`ALTER TABLE work_participants ADD CONSTRAINT work_participants_work_id_fkey FOREIGN KEY (work_id) REFERENCES works(id) ON DELETE CASCADE`);

    // Recreates the release_works policy (identical — only rebound to the new works OID).
    await queryRunner.query(`
      CREATE POLICY tenant_isolation ON release_works
        AS PERMISSIVE FOR ALL TO authenticated
        USING (
          EXISTS (SELECT 1 FROM releases r WHERE r.id = release_works.release_id AND r.tenant_id = private_get_tenant_id())
          AND EXISTS (SELECT 1 FROM works w WHERE w.id = release_works.work_id AND w.tenant_id = private_get_tenant_id())
        )
        WITH CHECK (
          EXISTS (SELECT 1 FROM releases r WHERE r.id = release_works.release_id AND r.tenant_id = private_get_tenant_id())
          AND EXISTS (SELECT 1 FROM works w WHERE w.id = release_works.work_id AND w.tenant_id = private_get_tenant_id())
        )
    `);

    await queryRunner.query(`ALTER TABLE works ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE works FORCE ROW LEVEL SECURITY`);
    await queryRunner.query(`
      CREATE POLICY super_admin_full_access ON works
        AS PERMISSIVE FOR ALL TO authenticated
        USING (app_is_super_admin()) WITH CHECK (app_is_super_admin())
    `);
    await queryRunner.query(`
      CREATE POLICY tenant_isolation ON works
        AS PERMISSIVE FOR ALL TO authenticated
        USING (tenant_id = private_get_tenant_id()) WITH CHECK (tenant_id = private_get_tenant_id())
    `);

    await queryRunner.query(`ALTER TABLE works OWNER TO musicos_migrator`);
    await queryRunner.query(`GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON works TO musicos_migrator`);

    await queryRunner.query(`DROP TABLE works_old`);
    await queryRunner.query(`ANALYZE works`);
  }

  // ORIGINAL (pre-migration) order/types — to revert honestly.
  private readonly originalColumns = `
    id                                  uuid NOT NULL DEFAULT gen_random_uuid(),
    tenant_id                           uuid NOT NULL,
    titulo                              varchar(500) NOT NULL,
    compositor                          varchar(255),
    compositores                        jsonb,
    editora                             varchar(255),
    isrc                                varchar(20),
    iswc                                varchar(20),
    tipo                                varchar(100) NOT NULL,
    genero                              varchar(100),
    status                              varchar(50) NOT NULL DEFAULT 'pendente',
    duracao                             varchar(20),
    origem_externa                      varchar(100),
    origem_externa_id                   varchar(255),
    origem_externa_sincronizado_em      timestamp,
    metadata                            jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at                          timestamp NOT NULL DEFAULT now(),
    updated_at                          timestamp NOT NULL DEFAULT now(),
    deleted_at                          timestamp,
    created_by                          varchar(255),
    updated_by                          varchar(255),
    artista_id                          uuid,
    alternative_titles                  jsonb,
    language                            varchar(10),
    lyrics                              text,
    is_instrumental                     boolean,
    duration_seconds                    integer,
    registry_status                     varchar(50),
    external_reference                  varchar(255),
    ai_used                             boolean,
    ai_tools                            jsonb,
    ai_prompts                          jsonb,
    idioma                              varchar(20),
    instrumental                        varchar(10),
    criada_por_ia                       boolean,
    tipo_ia                             varchar(50),
    ia_harmonia                         jsonb,
    ia_melodia                          jsonb,
    ia_letra                            jsonb,
    outros_titulos                      jsonb,
    referencias_conexas                 jsonb,
    letra_completa                      text,
    letristas                           jsonb,
    projeto_id                          uuid,
    tipo_obra                           varchar(50),
    cod_ecad                            varchar(100),
    cod_entidade                        varchar(100)
  `;

  public async down(queryRunner: QueryRunner): Promise<void> {
    const [{ total }] = await queryRunner.query(`SELECT count(*)::int AS total FROM works`);

    await queryRunner.query(`CREATE TABLE works_restore (${this.originalColumns})`);
    await queryRunner.query(`INSERT INTO works_restore (${this.copyColumns}) SELECT ${this.copyColumns} FROM works`);

    const [{ c: restoredCount }] = await queryRunner.query(`SELECT count(*)::int AS c FROM works_restore`);
    if (Number(restoredCount) !== Number(total)) {
      throw new Error(`RebuildWorksInCanonicalFormOrder.down: count mismatch (original=${total}, restored=${restoredCount}) — aborted.`);
    }

    await queryRunner.query(`ALTER TABLE works_restore ADD CONSTRAINT works_restore_pkey PRIMARY KEY (id)`);
    await queryRunner.query(`ALTER TABLE works_restore ADD CONSTRAINT chk_works_registry_status_restore CHECK (${this.registryStatusCheck})`);
    await queryRunner.query(`CREATE INDEX idx_works_tenant_id_restore ON works_restore (tenant_id)`);
    await queryRunner.query(`CREATE INDEX idx_works_tenant_status_restore ON works_restore (tenant_id, status)`);
    await queryRunner.query(`CREATE INDEX idx_works_isrc_restore ON works_restore (isrc)`);
    await queryRunner.query(`CREATE INDEX idx_works_iswc_restore ON works_restore (iswc)`);
    await queryRunner.query(`CREATE INDEX idx_works_tenant_active_restore ON works_restore (tenant_id, deleted_at, created_at DESC) WHERE (deleted_at IS NULL)`);
    await queryRunner.query(`CREATE INDEX idx_works_artista_id_restore ON works_restore (artista_id)`);
    await queryRunner.query(`CREATE INDEX idx_works_registry_status_restore ON works_restore (tenant_id, registry_status)`);

    await queryRunner.query(`ALTER TABLE release_works DROP CONSTRAINT "FK_release_works_work"`);
    await queryRunner.query(`ALTER TABLE phonograms DROP CONSTRAINT fk_phonograms_obra_id`);
    await queryRunner.query(`ALTER TABLE shares DROP CONSTRAINT fk_shares_obra_id`);
    await queryRunner.query(`ALTER TABLE work_participants DROP CONSTRAINT work_participants_work_id_fkey`);
    await queryRunner.query(`DROP POLICY tenant_isolation ON release_works`);

    await queryRunner.query(`ALTER TABLE works RENAME TO works_canonical`);
    await queryRunner.query(`ALTER TABLE works_canonical RENAME CONSTRAINT works_pkey TO works_canonical_pkey`);
    await queryRunner.query(`ALTER TABLE works_canonical RENAME CONSTRAINT chk_works_registry_status TO chk_works_registry_status_canonical`);
    await queryRunner.query(`ALTER INDEX idx_works_tenant_id RENAME TO idx_works_tenant_id_canonical`);
    await queryRunner.query(`ALTER INDEX idx_works_tenant_status RENAME TO idx_works_tenant_status_canonical`);
    await queryRunner.query(`ALTER INDEX idx_works_isrc RENAME TO idx_works_isrc_canonical`);
    await queryRunner.query(`ALTER INDEX idx_works_iswc RENAME TO idx_works_iswc_canonical`);
    await queryRunner.query(`ALTER INDEX idx_works_tenant_active RENAME TO idx_works_tenant_active_canonical`);
    await queryRunner.query(`ALTER INDEX idx_works_artista_id RENAME TO idx_works_artista_id_canonical`);
    await queryRunner.query(`ALTER INDEX idx_works_registry_status RENAME TO idx_works_registry_status_canonical`);

    await queryRunner.query(`ALTER TABLE works_restore RENAME TO works`);
    await queryRunner.query(`ALTER INDEX works_restore_pkey RENAME TO works_pkey`);
    await queryRunner.query(`ALTER TABLE works RENAME CONSTRAINT chk_works_registry_status_restore TO chk_works_registry_status`);
    await queryRunner.query(`ALTER INDEX idx_works_tenant_id_restore RENAME TO idx_works_tenant_id`);
    await queryRunner.query(`ALTER INDEX idx_works_tenant_status_restore RENAME TO idx_works_tenant_status`);
    await queryRunner.query(`ALTER INDEX idx_works_isrc_restore RENAME TO idx_works_isrc`);
    await queryRunner.query(`ALTER INDEX idx_works_iswc_restore RENAME TO idx_works_iswc`);
    await queryRunner.query(`ALTER INDEX idx_works_tenant_active_restore RENAME TO idx_works_tenant_active`);
    await queryRunner.query(`ALTER INDEX idx_works_artista_id_restore RENAME TO idx_works_artista_id`);
    await queryRunner.query(`ALTER INDEX idx_works_registry_status_restore RENAME TO idx_works_registry_status`);

    await queryRunner.query(`ALTER TABLE works ADD CONSTRAINT fk_works_artista_id FOREIGN KEY (artista_id) REFERENCES artists(id) ON DELETE SET NULL`);
    await queryRunner.query(`ALTER TABLE release_works ADD CONSTRAINT "FK_release_works_work" FOREIGN KEY (work_id) REFERENCES works(id) ON DELETE CASCADE`);
    await queryRunner.query(`ALTER TABLE phonograms ADD CONSTRAINT fk_phonograms_obra_id FOREIGN KEY (obra_id) REFERENCES works(id) ON DELETE SET NULL`);
    await queryRunner.query(`ALTER TABLE shares ADD CONSTRAINT fk_shares_obra_id FOREIGN KEY (obra_id) REFERENCES works(id) ON DELETE SET NULL`);
    await queryRunner.query(`ALTER TABLE work_participants ADD CONSTRAINT work_participants_work_id_fkey FOREIGN KEY (work_id) REFERENCES works(id) ON DELETE CASCADE`);

    await queryRunner.query(`
      CREATE POLICY tenant_isolation ON release_works
        AS PERMISSIVE FOR ALL TO authenticated
        USING (
          EXISTS (SELECT 1 FROM releases r WHERE r.id = release_works.release_id AND r.tenant_id = private_get_tenant_id())
          AND EXISTS (SELECT 1 FROM works w WHERE w.id = release_works.work_id AND w.tenant_id = private_get_tenant_id())
        )
        WITH CHECK (
          EXISTS (SELECT 1 FROM releases r WHERE r.id = release_works.release_id AND r.tenant_id = private_get_tenant_id())
          AND EXISTS (SELECT 1 FROM works w WHERE w.id = release_works.work_id AND w.tenant_id = private_get_tenant_id())
        )
    `);

    await queryRunner.query(`ALTER TABLE works ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE works FORCE ROW LEVEL SECURITY`);
    await queryRunner.query(`
      CREATE POLICY super_admin_full_access ON works
        AS PERMISSIVE FOR ALL TO authenticated
        USING (app_is_super_admin()) WITH CHECK (app_is_super_admin())
    `);
    await queryRunner.query(`
      CREATE POLICY tenant_isolation ON works
        AS PERMISSIVE FOR ALL TO authenticated
        USING (tenant_id = private_get_tenant_id()) WITH CHECK (tenant_id = private_get_tenant_id())
    `);

    await queryRunner.query(`ALTER TABLE works OWNER TO musicos_migrator`);
    await queryRunner.query(`GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON works TO musicos_migrator`);

    await queryRunner.query(`DROP TABLE works_canonical`);
    await queryRunner.query(`ANALYZE works`);
  }
}
