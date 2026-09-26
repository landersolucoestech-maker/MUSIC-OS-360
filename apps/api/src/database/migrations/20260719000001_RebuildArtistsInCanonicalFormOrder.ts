import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Physical rebuild of `artists` in the canonical order of the real form
 * (ArtistaFormModal / artist-form.definition.ts) — 2026-07-19 audit.
 *
 * PostgreSQL does not allow ALTER COLUMN POSITION; the only way to change the
 * physical order is to create a replacement table with the correct order, copy the
 * data column by column (never `SELECT *`), swap the names in a transaction and
 * recreate the whole dependency chain (constraints, indexes, RLS, policies,
 * grants, owner, and the FKs that 8 other tables keep pointing to
 * `artists`).
 *
 * Canonical order (id/tenant_id → functional fields in the exact form
 * order, with photo/avatar as the first functional field → undisplayed technical
 * relation (contrato_id) → legacy/pass-through fields not
 * visible in the current form → control (metadata) → auditing → soft
 * delete). `org_slug` is removed in this migration: a proven orphan (never read
 * nor written by any real flow — exhaustive grep in apps/api and apps/web).
 */
export class RebuildArtistsInCanonicalFormOrder20260719000001 implements MigrationInterface {
  name = 'RebuildArtistsInCanonicalFormOrder20260719000001';

  private readonly newColumns = `
    id                                    uuid NOT NULL DEFAULT gen_random_uuid(),
    tenant_id                             uuid NOT NULL,
    foto_url                              text,
    nome_artistico                        varchar(255) NOT NULL,
    genero_musical                        varchar(100),
    especialidades                        jsonb NOT NULL DEFAULT '[]'::jsonb,
    documentos_pessoais_url               text,
    presskit_url                          text,
    observacoes                           text,
    nome_civil                            varchar(255),
    data_nascimento                       date,
    cpf_cnpj_encrypted                    text,
    rg                                    varchar(30),
    genero                                varchar(30),
    endereco                              varchar(300),
    telefone_encrypted                    text,
    email_encrypted                       text,
    banco                                 varchar(100),
    agencia                               varchar(30),
    conta                                 varchar(40),
    chave_pix                             varchar(150),
    titular_conta                         varchar(150),
    spotify_url                           text,
    instagram                             text,
    youtube_url                           text,
    tiktok                                text,
    soundcloud_url                        text,
    apple_music_url                       text,
    deezer_url                            text,
    tipo_perfil                           varchar(30),
    contatos_vinculados                   jsonb,
    distribuidoras_gerais                 jsonb,
    notas_internas                        text,
    contrato_id                           uuid,
    slug_artistico                        varchar(160),
    tags_musicais                         jsonb,
    fase_carreira                         varchar(60),
    tipo                                  varchar(50) NOT NULL DEFAULT 'solo',
    status                                varchar(50) NOT NULL DEFAULT 'em_negociacao',
    status_cadastro                       varchar(50) NOT NULL DEFAULT 'ativo',
    spotify_ouvintes                      integer,
    youtube_inscritos                     integer,
    deezer_fas                            integer,
    apple_music_albuns                    integer,
    soundcloud_seguidores                 integer,
    instagram_seguidores                  integer,
    tiktok_seguidores                     integer,
    relacionamentos                       jsonb,
    empresario_id                         varchar(64),
    empresario_nome                       varchar(150),
    empresario_telefone                   varchar(30),
    empresario_email                      varchar(150),
    gravadora_id                          varchar(64),
    gravadora_nome                        varchar(150),
    gravadora_telefone                    varchar(30),
    gravadora_email                       varchar(150),
    gravadora_responsavel_id              varchar(64),
    gravadora_responsavel_nome            varchar(150),
    gravadora_responsavel_telefone        varchar(30),
    gravadora_responsavel_email           varchar(150),
    distribuidoras_selecionadas           jsonb,
    distribuidoras_emails                 jsonb,
    distribuidoras_empresa_selecionadas   jsonb,
    distribuidoras_empresa_emails         jsonb,
    contatos_equipe                       jsonb,
    manager_nome                          varchar(255),
    manager_contato_encrypted             text,
    produtor_executivo                    varchar(255),
    agencia_booking                       varchar(255),
    label_parceira                        varchar(255),
    galeria_urls                          jsonb NOT NULL DEFAULT '[]'::jsonb,
    documentos                            jsonb NOT NULL DEFAULT '[]'::jsonb,
    metadata                              jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at                            timestamp NOT NULL DEFAULT now(),
    updated_at                            timestamp NOT NULL DEFAULT now(),
    created_by                            varchar(255),
    updated_by                            varchar(255),
    deleted_at                            timestamp
  `;

  // Columns in the ORIGINAL order — used for the INSERT...SELECT (never SELECT *).
  private readonly copyColumns = [
    'id', 'tenant_id', 'foto_url', 'nome_artistico', 'genero_musical', 'especialidades',
    'documentos_pessoais_url', 'presskit_url', 'observacoes', 'nome_civil', 'data_nascimento',
    'cpf_cnpj_encrypted', 'rg', 'genero', 'endereco', 'telefone_encrypted', 'email_encrypted',
    'banco', 'agencia', 'conta', 'chave_pix', 'titular_conta', 'spotify_url', 'instagram',
    'youtube_url', 'tiktok', 'soundcloud_url', 'apple_music_url', 'deezer_url', 'tipo_perfil',
    'contatos_vinculados', 'distribuidoras_gerais', 'notas_internas', 'contrato_id',
    'slug_artistico', 'tags_musicais', 'fase_carreira', 'tipo', 'status', 'status_cadastro',
    'spotify_ouvintes', 'youtube_inscritos', 'deezer_fas', 'apple_music_albuns',
    'soundcloud_seguidores', 'instagram_seguidores', 'tiktok_seguidores', 'relacionamentos',
    'empresario_id', 'empresario_nome', 'empresario_telefone', 'empresario_email',
    'gravadora_id', 'gravadora_nome', 'gravadora_telefone', 'gravadora_email',
    'gravadora_responsavel_id', 'gravadora_responsavel_nome', 'gravadora_responsavel_telefone',
    'gravadora_responsavel_email', 'distribuidoras_selecionadas', 'distribuidoras_emails',
    'distribuidoras_empresa_selecionadas', 'distribuidoras_empresa_emails', 'contatos_equipe',
    'manager_nome', 'manager_contato_encrypted', 'produtor_executivo', 'agencia_booking',
    'label_parceira', 'galeria_urls', 'documentos', 'metadata', 'created_at', 'updated_at',
    'created_by', 'updated_by', 'deleted_at',
  ].join(', ');

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 0. Fail-fast validation: org_slug must be genuinely empty before removal.
    const [{ non_null }] = await queryRunner.query(`SELECT count(org_slug)::int AS non_null FROM artists`);
    if (Number(non_null) > 0) {
      throw new Error(
        `RebuildArtistsInCanonicalFormOrder: artists.org_slug tem ${non_null} valor(es) não-nulo(s) — ` +
        `coluna presumida órfã, mas há dado real. Migration abortada.`,
      );
    }
    const [{ total }] = await queryRunner.query(`SELECT count(*)::int AS total FROM artists`);

    // 1. Replacement table with the canonical order.
    await queryRunner.query(`CREATE TABLE artists_new (${this.newColumns})`);

    // 2. Copies the data column by column (never SELECT *).
    await queryRunner.query(`INSERT INTO artists_new (${this.copyColumns}) SELECT ${this.copyColumns} FROM artists`);

    // 3. Valida contagem antes de trocar.
    const [{ c: newCount }] = await queryRunner.query(`SELECT count(*)::int AS c FROM artists_new`);
    if (Number(newCount) !== Number(total)) {
      throw new Error(
        `RebuildArtistsInCanonicalFormOrder: contagem divergente após cópia ` +
        `(original=${total}, nova=${newCount}) — migration abortada, artists_new não trocada.`,
      );
    }

    // 4. Constraints/indexes on the new table — names with a temporary suffix because
    // index/constraint names are unique per SCHEMA in Postgres (not per
    // table), and the old table still exists at this point. Renamed to the
    // canonical names (without suffix) right after the swap in step 6.
    await queryRunner.query(`ALTER TABLE artists_new ADD CONSTRAINT artists_new_pkey PRIMARY KEY (id)`);
    await queryRunner.query(`ALTER TABLE artists_new ADD CONSTRAINT uq_artists_tenant_id_id_new UNIQUE (tenant_id, id)`);
    await queryRunner.query(`CREATE INDEX idx_artists_tenant_id_new ON artists_new (tenant_id)`);
    await queryRunner.query(`CREATE INDEX idx_artists_tenant_status_new ON artists_new (tenant_id, status)`);
    await queryRunner.query(`CREATE INDEX idx_artists_tenant_deleted_new ON artists_new (tenant_id, deleted_at)`);
    await queryRunner.query(`CREATE INDEX idx_artists_tenant_active_new ON artists_new (tenant_id, deleted_at, created_at DESC) WHERE (deleted_at IS NULL)`);
    await queryRunner.query(`CREATE INDEX idx_artists_status_new ON artists_new (tenant_id, status) WHERE (deleted_at IS NULL)`);
    await queryRunner.query(`CREATE INDEX idx_artists_name_trgm_new ON artists_new USING gin (nome_artistico gin_trgm_ops)`);

    // 5. Drop the FKs of other tables pointing to artists — they must be
    // recreated after the swap (constraints reference the relation's OID, not its name).
    await queryRunner.query(`ALTER TABLE artist_platform_profiles DROP CONSTRAINT "FK_artist_platform_profiles_artist"`);
    await queryRunner.query(`ALTER TABLE works DROP CONSTRAINT fk_works_artista_id`);
    await queryRunner.query(`ALTER TABLE phonograms DROP CONSTRAINT fk_phonograms_artista_id`);
    await queryRunner.query(`ALTER TABLE contracts DROP CONSTRAINT fk_contracts_artista_id`);
    await queryRunner.query(`ALTER TABLE releases DROP CONSTRAINT fk_releases_artista_id`);
    await queryRunner.query(`ALTER TABLE counterparties DROP CONSTRAINT fk_counterparties_artist`);
    await queryRunner.query(`ALTER TABLE transaction_allocations DROP CONSTRAINT fk_txalloc_artist`);
    await queryRunner.query(`ALTER TABLE performance_metric_entries DROP CONSTRAINT fk_metric_artist`);

    // 6. Swap (rename), without CASCADE. Frees the canonical names by first renaming
    // those of the old table, then promotes those of the new table to these names.
    await queryRunner.query(`ALTER TABLE artists RENAME TO artists_old`);
    await queryRunner.query(`ALTER TABLE artists_old RENAME CONSTRAINT artists_pkey TO artists_old_pkey`);
    await queryRunner.query(`ALTER TABLE artists_old RENAME CONSTRAINT uq_artists_tenant_id_id TO uq_artists_tenant_id_id_old`);
    await queryRunner.query(`ALTER INDEX idx_artists_tenant_id RENAME TO idx_artists_tenant_id_old`);
    await queryRunner.query(`ALTER INDEX idx_artists_tenant_status RENAME TO idx_artists_tenant_status_old`);
    await queryRunner.query(`ALTER INDEX idx_artists_tenant_deleted RENAME TO idx_artists_tenant_deleted_old`);
    await queryRunner.query(`ALTER INDEX idx_artists_tenant_active RENAME TO idx_artists_tenant_active_old`);
    await queryRunner.query(`ALTER INDEX idx_artists_status RENAME TO idx_artists_status_old`);
    await queryRunner.query(`ALTER INDEX idx_artists_name_trgm RENAME TO idx_artists_name_trgm_old`);

    await queryRunner.query(`ALTER TABLE artists_new RENAME TO artists`);
    await queryRunner.query(`ALTER INDEX artists_new_pkey RENAME TO artists_pkey`);
    await queryRunner.query(`ALTER TABLE artists RENAME CONSTRAINT uq_artists_tenant_id_id_new TO uq_artists_tenant_id_id`);
    await queryRunner.query(`ALTER INDEX idx_artists_tenant_id_new RENAME TO idx_artists_tenant_id`);
    await queryRunner.query(`ALTER INDEX idx_artists_tenant_status_new RENAME TO idx_artists_tenant_status`);
    await queryRunner.query(`ALTER INDEX idx_artists_tenant_deleted_new RENAME TO idx_artists_tenant_deleted`);
    await queryRunner.query(`ALTER INDEX idx_artists_tenant_active_new RENAME TO idx_artists_tenant_active`);
    await queryRunner.query(`ALTER INDEX idx_artists_status_new RENAME TO idx_artists_status`);
    await queryRunner.query(`ALTER INDEX idx_artists_name_trgm_new RENAME TO idx_artists_name_trgm`);

    // 7. Recreates the FKs of the 8 dependent tables, now pointing to the new artists.
    await queryRunner.query(`ALTER TABLE artist_platform_profiles ADD CONSTRAINT "FK_artist_platform_profiles_artist" FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE CASCADE`);
    await queryRunner.query(`ALTER TABLE works ADD CONSTRAINT fk_works_artista_id FOREIGN KEY (artista_id) REFERENCES artists(id) ON DELETE SET NULL`);
    await queryRunner.query(`ALTER TABLE phonograms ADD CONSTRAINT fk_phonograms_artista_id FOREIGN KEY (artista_id) REFERENCES artists(id) ON DELETE SET NULL`);
    await queryRunner.query(`ALTER TABLE contracts ADD CONSTRAINT fk_contracts_artista_id FOREIGN KEY (artista_id) REFERENCES artists(id) ON DELETE SET NULL`);
    await queryRunner.query(`ALTER TABLE releases ADD CONSTRAINT fk_releases_artista_id FOREIGN KEY (artista_id) REFERENCES artists(id) ON DELETE SET NULL`);
    await queryRunner.query(`ALTER TABLE counterparties ADD CONSTRAINT fk_counterparties_artist FOREIGN KEY (tenant_id, artist_id) REFERENCES artists(tenant_id, id)`);
    await queryRunner.query(`ALTER TABLE transaction_allocations ADD CONSTRAINT fk_txalloc_artist FOREIGN KEY (tenant_id, artist_id) REFERENCES artists(tenant_id, id)`);
    await queryRunner.query(`ALTER TABLE performance_metric_entries ADD CONSTRAINT fk_metric_artist FOREIGN KEY (tenant_id, artist_id) REFERENCES artists(tenant_id, id)`);

    // 8. RLS + policies (identical to the old table's).
    await queryRunner.query(`ALTER TABLE artists ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE artists FORCE ROW LEVEL SECURITY`);
    await queryRunner.query(`
      CREATE POLICY super_admin_full_access ON artists
        AS PERMISSIVE FOR ALL TO authenticated
        USING (app_is_super_admin()) WITH CHECK (app_is_super_admin())
    `);
    await queryRunner.query(`
      CREATE POLICY tenant_isolation ON artists
        AS PERMISSIVE FOR ALL TO authenticated
        USING (tenant_id = private_get_tenant_id()) WITH CHECK (tenant_id = private_get_tenant_id())
    `);

    // 9. Owner + grants identical to the old table's.
    await queryRunner.query(`ALTER TABLE artists OWNER TO musicos_migrator`);
    await queryRunner.query(`GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON artists TO musicos_migrator`);

    // 10. Removes the old table only after everything was validated and recreated.
    await queryRunner.query(`DROP TABLE artists_old`);

    // 11. Statistics updated for the new physical layout.
    await queryRunner.query(`ANALYZE artists`);
  }

  // ORIGINAL (pre-migration) order/types — to revert honestly.
  private readonly originalColumns = `
    id                                    uuid NOT NULL DEFAULT gen_random_uuid(),
    tenant_id                             uuid NOT NULL,
    nome_artistico                        varchar(255) NOT NULL,
    nome_civil                            varchar(255),
    tipo                                  varchar(50) NOT NULL DEFAULT 'solo',
    status                                varchar(50) NOT NULL DEFAULT 'em_negociacao',
    status_cadastro                       varchar(50) NOT NULL DEFAULT 'ativo',
    genero_musical                        varchar(100),
    email_encrypted                       text,
    telefone_encrypted                    text,
    cpf_cnpj_encrypted                    text,
    foto_url                              text,
    galeria_urls                          jsonb NOT NULL DEFAULT '[]'::jsonb,
    documentos                            jsonb NOT NULL DEFAULT '[]'::jsonb,
    observacoes                           text,
    manager_nome                          varchar(255),
    manager_contato_encrypted             text,
    produtor_executivo                    varchar(255),
    agencia_booking                       varchar(255),
    label_parceira                        varchar(255),
    especialidades                        jsonb NOT NULL DEFAULT '[]'::jsonb,
    spotify_url                           text,
    youtube_url                           text,
    deezer_url                            text,
    apple_music_url                       text,
    soundcloud_url                        text,
    contrato_id                           uuid,
    org_slug                              varchar(100),
    slug_artistico                        varchar(160),
    tags_musicais                         jsonb,
    fase_carreira                         varchar(60),
    data_nascimento                       date,
    rg                                    varchar(30),
    genero                                varchar(30),
    endereco                              varchar(300),
    banco                                 varchar(100),
    agencia                               varchar(30),
    conta                                 varchar(40),
    chave_pix                             varchar(150),
    titular_conta                         varchar(150),
    instagram                             text,
    tiktok                                text,
    spotify_ouvintes                      integer,
    youtube_inscritos                     integer,
    deezer_fas                            integer,
    apple_music_albuns                    integer,
    soundcloud_seguidores                 integer,
    instagram_seguidores                  integer,
    tiktok_seguidores                     integer,
    relacionamentos                       jsonb,
    tipo_perfil                           varchar(30),
    empresario_id                         varchar(64),
    empresario_nome                       varchar(150),
    empresario_telefone                   varchar(30),
    empresario_email                      varchar(150),
    gravadora_id                          varchar(64),
    gravadora_nome                        varchar(150),
    gravadora_telefone                    varchar(30),
    gravadora_email                       varchar(150),
    gravadora_responsavel_id              varchar(64),
    gravadora_responsavel_nome            varchar(150),
    gravadora_responsavel_telefone        varchar(30),
    gravadora_responsavel_email           varchar(150),
    distribuidoras_selecionadas           jsonb,
    distribuidoras_emails                 jsonb,
    distribuidoras_empresa_selecionadas   jsonb,
    distribuidoras_empresa_emails         jsonb,
    distribuidoras_gerais                 jsonb,
    contatos_vinculados                   jsonb,
    contatos_equipe                       jsonb,
    notas_internas                        text,
    documentos_pessoais_url               text,
    presskit_url                          text,
    metadata                              jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at                            timestamp NOT NULL DEFAULT now(),
    updated_at                            timestamp NOT NULL DEFAULT now(),
    deleted_at                            timestamp,
    created_by                            varchar(255),
    updated_by                            varchar(255)
  `;

  public async down(queryRunner: QueryRunner): Promise<void> {
    const [{ total }] = await queryRunner.query(`SELECT count(*)::int AS total FROM artists`);

    await queryRunner.query(`CREATE TABLE artists_restore (${this.originalColumns})`);
    // org_slug no longer exists in `artists` (removed in up()) — always NULL on reversal.
    await queryRunner.query(`INSERT INTO artists_restore (${this.copyColumns}) SELECT ${this.copyColumns} FROM artists`);

    const [{ c: restoredCount }] = await queryRunner.query(`SELECT count(*)::int AS c FROM artists_restore`);
    if (Number(restoredCount) !== Number(total)) {
      throw new Error(
        `RebuildArtistsInCanonicalFormOrder.down: contagem divergente (original=${total}, ` +
        `restaurada=${restoredCount}) — down abortado, artists não trocada.`,
      );
    }

    await queryRunner.query(`ALTER TABLE artists_restore ADD CONSTRAINT artists_restore_pkey PRIMARY KEY (id)`);
    await queryRunner.query(`ALTER TABLE artists_restore ADD CONSTRAINT uq_artists_tenant_id_id_restore UNIQUE (tenant_id, id)`);
    await queryRunner.query(`CREATE INDEX idx_artists_tenant_id_restore ON artists_restore (tenant_id)`);
    await queryRunner.query(`CREATE INDEX idx_artists_tenant_status_restore ON artists_restore (tenant_id, status)`);
    await queryRunner.query(`CREATE INDEX idx_artists_tenant_deleted_restore ON artists_restore (tenant_id, deleted_at)`);
    await queryRunner.query(`CREATE INDEX idx_artists_tenant_active_restore ON artists_restore (tenant_id, deleted_at, created_at DESC) WHERE (deleted_at IS NULL)`);
    await queryRunner.query(`CREATE INDEX idx_artists_status_restore ON artists_restore (tenant_id, status) WHERE (deleted_at IS NULL)`);
    await queryRunner.query(`CREATE INDEX idx_artists_name_trgm_restore ON artists_restore USING gin (nome_artistico gin_trgm_ops)`);

    await queryRunner.query(`ALTER TABLE artist_platform_profiles DROP CONSTRAINT "FK_artist_platform_profiles_artist"`);
    await queryRunner.query(`ALTER TABLE works DROP CONSTRAINT fk_works_artista_id`);
    await queryRunner.query(`ALTER TABLE phonograms DROP CONSTRAINT fk_phonograms_artista_id`);
    await queryRunner.query(`ALTER TABLE contracts DROP CONSTRAINT fk_contracts_artista_id`);
    await queryRunner.query(`ALTER TABLE releases DROP CONSTRAINT fk_releases_artista_id`);
    await queryRunner.query(`ALTER TABLE counterparties DROP CONSTRAINT fk_counterparties_artist`);
    await queryRunner.query(`ALTER TABLE transaction_allocations DROP CONSTRAINT fk_txalloc_artist`);
    await queryRunner.query(`ALTER TABLE performance_metric_entries DROP CONSTRAINT fk_metric_artist`);

    await queryRunner.query(`ALTER TABLE artists RENAME TO artists_canonical`);
    await queryRunner.query(`ALTER TABLE artists_canonical RENAME CONSTRAINT artists_pkey TO artists_canonical_pkey`);
    await queryRunner.query(`ALTER TABLE artists_canonical RENAME CONSTRAINT uq_artists_tenant_id_id TO uq_artists_tenant_id_id_canonical`);
    await queryRunner.query(`ALTER INDEX idx_artists_tenant_id RENAME TO idx_artists_tenant_id_canonical`);
    await queryRunner.query(`ALTER INDEX idx_artists_tenant_status RENAME TO idx_artists_tenant_status_canonical`);
    await queryRunner.query(`ALTER INDEX idx_artists_tenant_deleted RENAME TO idx_artists_tenant_deleted_canonical`);
    await queryRunner.query(`ALTER INDEX idx_artists_tenant_active RENAME TO idx_artists_tenant_active_canonical`);
    await queryRunner.query(`ALTER INDEX idx_artists_status RENAME TO idx_artists_status_canonical`);
    await queryRunner.query(`ALTER INDEX idx_artists_name_trgm RENAME TO idx_artists_name_trgm_canonical`);

    await queryRunner.query(`ALTER TABLE artists_restore RENAME TO artists`);
    await queryRunner.query(`ALTER INDEX artists_restore_pkey RENAME TO artists_pkey`);
    await queryRunner.query(`ALTER TABLE artists RENAME CONSTRAINT uq_artists_tenant_id_id_restore TO uq_artists_tenant_id_id`);
    await queryRunner.query(`ALTER INDEX idx_artists_tenant_id_restore RENAME TO idx_artists_tenant_id`);
    await queryRunner.query(`ALTER INDEX idx_artists_tenant_status_restore RENAME TO idx_artists_tenant_status`);
    await queryRunner.query(`ALTER INDEX idx_artists_tenant_deleted_restore RENAME TO idx_artists_tenant_deleted`);
    await queryRunner.query(`ALTER INDEX idx_artists_tenant_active_restore RENAME TO idx_artists_tenant_active`);
    await queryRunner.query(`ALTER INDEX idx_artists_status_restore RENAME TO idx_artists_status`);
    await queryRunner.query(`ALTER INDEX idx_artists_name_trgm_restore RENAME TO idx_artists_name_trgm`);

    await queryRunner.query(`ALTER TABLE artist_platform_profiles ADD CONSTRAINT "FK_artist_platform_profiles_artist" FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE CASCADE`);
    await queryRunner.query(`ALTER TABLE works ADD CONSTRAINT fk_works_artista_id FOREIGN KEY (artista_id) REFERENCES artists(id) ON DELETE SET NULL`);
    await queryRunner.query(`ALTER TABLE phonograms ADD CONSTRAINT fk_phonograms_artista_id FOREIGN KEY (artista_id) REFERENCES artists(id) ON DELETE SET NULL`);
    await queryRunner.query(`ALTER TABLE contracts ADD CONSTRAINT fk_contracts_artista_id FOREIGN KEY (artista_id) REFERENCES artists(id) ON DELETE SET NULL`);
    await queryRunner.query(`ALTER TABLE releases ADD CONSTRAINT fk_releases_artista_id FOREIGN KEY (artista_id) REFERENCES artists(id) ON DELETE SET NULL`);
    await queryRunner.query(`ALTER TABLE counterparties ADD CONSTRAINT fk_counterparties_artist FOREIGN KEY (tenant_id, artist_id) REFERENCES artists(tenant_id, id)`);
    await queryRunner.query(`ALTER TABLE transaction_allocations ADD CONSTRAINT fk_txalloc_artist FOREIGN KEY (tenant_id, artist_id) REFERENCES artists(tenant_id, id)`);
    await queryRunner.query(`ALTER TABLE performance_metric_entries ADD CONSTRAINT fk_metric_artist FOREIGN KEY (tenant_id, artist_id) REFERENCES artists(tenant_id, id)`);

    await queryRunner.query(`ALTER TABLE artists ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE artists FORCE ROW LEVEL SECURITY`);
    await queryRunner.query(`
      CREATE POLICY super_admin_full_access ON artists
        AS PERMISSIVE FOR ALL TO authenticated
        USING (app_is_super_admin()) WITH CHECK (app_is_super_admin())
    `);
    await queryRunner.query(`
      CREATE POLICY tenant_isolation ON artists
        AS PERMISSIVE FOR ALL TO authenticated
        USING (tenant_id = private_get_tenant_id()) WITH CHECK (tenant_id = private_get_tenant_id())
    `);

    await queryRunner.query(`ALTER TABLE artists OWNER TO musicos_migrator`);
    await queryRunner.query(`GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON artists TO musicos_migrator`);

    await queryRunner.query(`DROP TABLE artists_canonical`);
    await queryRunner.query(`ANALYZE artists`);
  }
}
