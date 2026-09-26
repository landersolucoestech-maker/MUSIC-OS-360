import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Physical rebuild of `leads` in the canonical order of the real form
 * (LeadFormModal) — 2026-07-19 audit. Same pattern as the previous ones.
 *
 * Real visual order: "Dados do Contato" (nome/empresa/email/telefone→whatsapp/
 * instagram/website→payload_servico/endereco→payload_servico/cidade/estado)
 * → "Classificação do Lead" (tipo_lead→tipo_cliente/servico→tipo_servico/
 * other fields→payload_servico) → "Origem e Gestão Comercial" (origem_lead/
 * campanha_marketing→dados_internos_crm/data_entrada→payload_servico/
 * responsavel/status_lead→status/prioridade/proximo_follow_up/valor_estimado/
 * temperatura) → Event/Campaign/Influencer/Manager details
 * (conditional, all inside payload_servico — no dedicated column) →
 * "Anexos" (uploads). `pais`/`probabilidade_fechamento` are accepted by the DTO
 * but have no visible field in the active form — legacy/reserved. `nome_artistico`/
 * `telefone_encrypted`/`cliente_id`/`fonte`/`tags` are written only by
 * `submitPublicArtistApplication` (the public artist sign-up form,
 * another real flow) or by the lead conversion handler — technical
 * relations/fields, not from the main CRM form.
 *
 * `tipoServico`/`origemLead`/`probabilidadeFechamento` renamed to
 * snake_case (tipo_servico/origem_lead/probabilidade_fechamento) — the
 * entity's previous comment already flagged the inconsistency as
 * "normalization is left for a future phase" (migration 20260528000002); this is
 * that phase. `score`/`pipeline_stage` removed: proven orphans — zero
 * readers/writers in the whole leads domain (frontend or backend).
 */
export class RebuildLeadsInCanonicalFormOrder20260719000011 implements MigrationInterface {
  name = 'RebuildLeadsInCanonicalFormOrder20260719000011';

  private readonly newColumns = `
    id                       uuid NOT NULL DEFAULT gen_random_uuid(),
    tenant_id                uuid NOT NULL,
    nome                     varchar(255) NOT NULL,
    nome_completo            varchar(255),
    empresa                  varchar(255),
    email_encrypted          text,
    whatsapp                 varchar(50),
    instagram                varchar(255),
    cidade                   varchar(120),
    estado                   varchar(80),
    tipo_cliente             varchar(80),
    tipo_servico             varchar(120),
    payload_servico          jsonb NOT NULL DEFAULT '{}'::jsonb,
    origem_lead              varchar(120),
    responsavel              varchar(255),
    status                   varchar(50) NOT NULL DEFAULT 'novo',
    prioridade               varchar(40),
    proximo_follow_up        timestamptz,
    valor_estimado           numeric,
    temperatura              varchar(40),
    dados_internos_crm       jsonb NOT NULL DEFAULT '{}'::jsonb,
    uploads                  jsonb,
    pais                     varchar(80),
    probabilidade_fechamento numeric,
    nome_artistico           varchar(255),
    telefone_encrypted       text,
    cliente_id               uuid,
    fonte                    varchar(100),
    tags                     text[] NOT NULL DEFAULT '{}',
    metadata                 jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at               timestamp NOT NULL DEFAULT now(),
    updated_at               timestamp NOT NULL DEFAULT now(),
    created_by               varchar(255),
    updated_by               varchar(255),
    deleted_at               timestamp
  `;

  private readonly copyColumns = [
    'id', 'tenant_id', 'nome', 'nome_completo', 'empresa', 'email_encrypted', 'whatsapp',
    'instagram', 'cidade', 'estado', 'tipo_cliente',
  ].join(', ') + ', "tipoServico" AS tipo_servico, payload_servico, "origemLead" AS origem_lead, ' + [
    'responsavel', 'status', 'prioridade', 'proximo_follow_up', 'valor_estimado', 'temperatura',
    'dados_internos_crm', 'uploads', 'pais',
  ].join(', ') + ', "probabilidadeFechamento" AS probabilidade_fechamento, ' + [
    'nome_artistico', 'telefone_encrypted', 'cliente_id', 'fonte', 'tags', 'metadata',
    'created_at', 'updated_at', 'created_by', 'updated_by', 'deleted_at',
  ].join(', ');

  private readonly insertColumns = [
    'id', 'tenant_id', 'nome', 'nome_completo', 'empresa', 'email_encrypted', 'whatsapp',
    'instagram', 'cidade', 'estado', 'tipo_cliente', 'tipo_servico', 'payload_servico',
    'origem_lead', 'responsavel', 'status', 'prioridade', 'proximo_follow_up', 'valor_estimado',
    'temperatura', 'dados_internos_crm', 'uploads', 'pais', 'probabilidade_fechamento',
    'nome_artistico', 'telefone_encrypted', 'cliente_id', 'fonte', 'tags', 'metadata',
    'created_at', 'updated_at', 'created_by', 'updated_by', 'deleted_at',
  ].join(', ');

  public async up(queryRunner: QueryRunner): Promise<void> {
    const [{ non_null }] = await queryRunner.query(`SELECT count(score)::int + count(pipeline_stage)::int AS non_null FROM leads`);
    if (Number(non_null) > 0) {
      throw new Error(
        `RebuildLeadsInCanonicalFormOrder: leads.(score/pipeline_stage) têm ${non_null} valor(es) não-nulo(s) — ` +
        `colunas presumidas órfãs, mas há dado real. Migration abortada.`,
      );
    }
    const [{ total }] = await queryRunner.query(`SELECT count(*)::int AS total FROM leads`);

    await queryRunner.query(`CREATE TABLE leads_new (${this.newColumns})`);
    await queryRunner.query(`INSERT INTO leads_new (${this.insertColumns}) SELECT ${this.copyColumns} FROM leads`);

    const [{ c: newCount }] = await queryRunner.query(`SELECT count(*)::int AS c FROM leads_new`);
    if (Number(newCount) !== Number(total)) {
      throw new Error(`RebuildLeadsInCanonicalFormOrder: contagem divergente (original=${total}, nova=${newCount}) — abortada.`);
    }

    await queryRunner.query(`ALTER TABLE leads_new ADD CONSTRAINT leads_new_pkey PRIMARY KEY (id)`);
    await queryRunner.query(`CREATE INDEX idx_leads_tenant_id_new ON leads_new (tenant_id)`);
    await queryRunner.query(`CREATE INDEX idx_leads_tenant_status_new ON leads_new (tenant_id, status)`);
    await queryRunner.query(`CREATE INDEX idx_leads_cliente_id_new ON leads_new (cliente_id)`);
    await queryRunner.query(`CREATE INDEX idx_leads_tenant_active_new ON leads_new (tenant_id, deleted_at, created_at DESC) WHERE (deleted_at IS NULL)`);
    await queryRunner.query(`CREATE INDEX idx_leads_status_new ON leads_new (tenant_id, status) WHERE (deleted_at IS NULL)`);
    await queryRunner.query(`CREATE INDEX idx_leads_tiposervico_new ON leads_new (tenant_id, tipo_servico)`);
    await queryRunner.query(`CREATE INDEX idx_leads_responsavel_new ON leads_new (tenant_id, responsavel)`);
    await queryRunner.query(`CREATE INDEX idx_leads_origemlead_new ON leads_new (tenant_id, origem_lead)`);
    await queryRunner.query(`CREATE INDEX idx_leads_cidade_new ON leads_new (tenant_id, cidade)`);
    await queryRunner.query(`CREATE INDEX idx_leads_estado_new ON leads_new (tenant_id, estado)`);
    await queryRunner.query(`CREATE INDEX idx_leads_tags_new ON leads_new USING gin (tags)`);
    await queryRunner.query(`CREATE INDEX idx_leads_payload_servico_new ON leads_new USING gin (payload_servico)`);
    await queryRunner.query(`CREATE UNIQUE INDEX ux_leads_id_tenant_new ON leads_new (id, tenant_id)`);

    await queryRunner.query(`ALTER TABLE conversations DROP CONSTRAINT conversations_contact_id_fkey`);
    await queryRunner.query(`ALTER TABLE form_submissions DROP CONSTRAINT form_submissions_lead_id_fkey`);
    await queryRunner.query(`ALTER TABLE lead_uploads DROP CONSTRAINT lead_uploads_lead_id_fkey`);
    await queryRunner.query(`ALTER TABLE lead_uploads DROP CONSTRAINT fk_lead_uploads_lead_tenant`);
    await queryRunner.query(`ALTER TABLE lead_interactions DROP CONSTRAINT fk_lead_interactions_lead_id`);

    await queryRunner.query(`ALTER TABLE leads RENAME TO leads_old`);
    await queryRunner.query(`ALTER TABLE leads_old RENAME CONSTRAINT leads_pkey TO leads_old_pkey`);
    await queryRunner.query(`ALTER INDEX idx_leads_tenant_id RENAME TO idx_leads_tenant_id_old`);
    await queryRunner.query(`ALTER INDEX idx_leads_tenant_status RENAME TO idx_leads_tenant_status_old`);
    await queryRunner.query(`ALTER INDEX idx_leads_cliente_id RENAME TO idx_leads_cliente_id_old`);
    await queryRunner.query(`ALTER INDEX idx_leads_tenant_active RENAME TO idx_leads_tenant_active_old`);
    await queryRunner.query(`ALTER INDEX idx_leads_status RENAME TO idx_leads_status_old`);
    await queryRunner.query(`ALTER INDEX idx_leads_tiposervico RENAME TO idx_leads_tiposervico_old`);
    await queryRunner.query(`ALTER INDEX idx_leads_responsavel RENAME TO idx_leads_responsavel_old`);
    await queryRunner.query(`ALTER INDEX idx_leads_origemlead RENAME TO idx_leads_origemlead_old`);
    await queryRunner.query(`ALTER INDEX idx_leads_cidade RENAME TO idx_leads_cidade_old`);
    await queryRunner.query(`ALTER INDEX idx_leads_estado RENAME TO idx_leads_estado_old`);
    await queryRunner.query(`ALTER INDEX idx_leads_tags RENAME TO idx_leads_tags_old`);
    await queryRunner.query(`ALTER INDEX idx_leads_payload_servico RENAME TO idx_leads_payload_servico_old`);
    await queryRunner.query(`ALTER INDEX ux_leads_id_tenant RENAME TO ux_leads_id_tenant_old`);

    await queryRunner.query(`ALTER TABLE leads_new RENAME TO leads`);
    await queryRunner.query(`ALTER INDEX leads_new_pkey RENAME TO leads_pkey`);
    await queryRunner.query(`ALTER INDEX idx_leads_tenant_id_new RENAME TO idx_leads_tenant_id`);
    await queryRunner.query(`ALTER INDEX idx_leads_tenant_status_new RENAME TO idx_leads_tenant_status`);
    await queryRunner.query(`ALTER INDEX idx_leads_cliente_id_new RENAME TO idx_leads_cliente_id`);
    await queryRunner.query(`ALTER INDEX idx_leads_tenant_active_new RENAME TO idx_leads_tenant_active`);
    await queryRunner.query(`ALTER INDEX idx_leads_status_new RENAME TO idx_leads_status`);
    await queryRunner.query(`ALTER INDEX idx_leads_tiposervico_new RENAME TO idx_leads_tiposervico`);
    await queryRunner.query(`ALTER INDEX idx_leads_responsavel_new RENAME TO idx_leads_responsavel`);
    await queryRunner.query(`ALTER INDEX idx_leads_origemlead_new RENAME TO idx_leads_origemlead`);
    await queryRunner.query(`ALTER INDEX idx_leads_cidade_new RENAME TO idx_leads_cidade`);
    await queryRunner.query(`ALTER INDEX idx_leads_estado_new RENAME TO idx_leads_estado`);
    await queryRunner.query(`ALTER INDEX idx_leads_tags_new RENAME TO idx_leads_tags`);
    await queryRunner.query(`ALTER INDEX idx_leads_payload_servico_new RENAME TO idx_leads_payload_servico`);
    await queryRunner.query(`ALTER INDEX ux_leads_id_tenant_new RENAME TO ux_leads_id_tenant`);

    await queryRunner.query(`ALTER TABLE conversations ADD CONSTRAINT conversations_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES leads(id) ON DELETE SET NULL`);
    await queryRunner.query(`ALTER TABLE form_submissions ADD CONSTRAINT form_submissions_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL`);
    await queryRunner.query(`ALTER TABLE lead_uploads ADD CONSTRAINT lead_uploads_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE`);
    await queryRunner.query(`ALTER TABLE lead_uploads ADD CONSTRAINT fk_lead_uploads_lead_tenant FOREIGN KEY (lead_id, tenant_id) REFERENCES leads(id, tenant_id) ON DELETE CASCADE`);
    await queryRunner.query(`ALTER TABLE lead_interactions ADD CONSTRAINT fk_lead_interactions_lead_id FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE`);

    await queryRunner.query(`ALTER TABLE leads ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE leads FORCE ROW LEVEL SECURITY`);
    await queryRunner.query(`
      CREATE POLICY super_admin_full_access ON leads
        AS PERMISSIVE FOR ALL TO authenticated
        USING (app_is_super_admin()) WITH CHECK (app_is_super_admin())
    `);
    await queryRunner.query(`
      CREATE POLICY tenant_isolation ON leads
        AS PERMISSIVE FOR ALL TO authenticated
        USING (tenant_id = private_get_tenant_id()) WITH CHECK (tenant_id = private_get_tenant_id())
    `);

    await queryRunner.query(`ALTER TABLE leads OWNER TO musicos_migrator`);
    await queryRunner.query(`GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON leads TO musicos_migrator`);

    await queryRunner.query(`DROP TABLE leads_old`);
    await queryRunner.query(`ANALYZE leads`);
  }

  private readonly originalColumns = `
    id                       uuid NOT NULL DEFAULT gen_random_uuid(),
    tenant_id                uuid NOT NULL,
    cliente_id               uuid,
    nome                     varchar(255) NOT NULL,
    email_encrypted          text,
    telefone_encrypted       text,
    empresa                  varchar(255),
    status                   varchar(50) NOT NULL DEFAULT 'novo',
    score                    integer NOT NULL DEFAULT 0,
    fonte                    varchar(100),
    pipeline_stage           varchar(100),
    metadata                 jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at               timestamp NOT NULL DEFAULT now(),
    updated_at               timestamp NOT NULL DEFAULT now(),
    deleted_at               timestamp,
    created_by               varchar(255),
    updated_by               varchar(255),
    nome_completo            varchar(255),
    nome_artistico           varchar(255),
    whatsapp                 varchar(50),
    instagram                varchar(255),
    cidade                   varchar(120),
    estado                   varchar(80),
    pais                     varchar(80),
    tipo_cliente             varchar(80),
    "tipoServico"            varchar(120),
    payload_servico          jsonb NOT NULL DEFAULT '{}'::jsonb,
    dados_internos_crm       jsonb NOT NULL DEFAULT '{}'::jsonb,
    responsavel              varchar(255),
    prioridade               varchar(40),
    temperatura              varchar(40),
    "origemLead"             varchar(120),
    valor_estimado           numeric,
    "probabilidadeFechamento" numeric,
    proximo_follow_up        timestamptz,
    tags                     text[] NOT NULL DEFAULT '{}',
    uploads                  jsonb
  `;

  public async down(queryRunner: QueryRunner): Promise<void> {
    const [{ total }] = await queryRunner.query(`SELECT count(*)::int AS total FROM leads`);

    await queryRunner.query(`CREATE TABLE leads_restore (${this.originalColumns})`);

    const restoreInsertColumns = [
      'id', 'tenant_id', 'cliente_id', 'nome', 'email_encrypted', 'telefone_encrypted', 'empresa',
      'status', 'fonte', 'metadata', 'created_at', 'updated_at', 'deleted_at', 'created_by',
      'updated_by', 'nome_completo', 'nome_artistico', 'whatsapp', 'instagram', 'cidade', 'estado',
      'pais', 'tipo_cliente', '"tipoServico"', 'payload_servico', 'dados_internos_crm',
      'responsavel', 'prioridade', 'temperatura', '"origemLead"', 'valor_estimado',
      '"probabilidadeFechamento"', 'proximo_follow_up', 'tags', 'uploads',
    ].join(', ');
    const restoreSelectColumns = [
      'id', 'tenant_id', 'cliente_id', 'nome', 'email_encrypted', 'telefone_encrypted', 'empresa',
      'status', 'fonte', 'metadata', 'created_at', 'updated_at', 'deleted_at', 'created_by',
      'updated_by', 'nome_completo', 'nome_artistico', 'whatsapp', 'instagram', 'cidade', 'estado',
      'pais', 'tipo_cliente', 'tipo_servico AS "tipoServico"', 'payload_servico',
      'dados_internos_crm', 'responsavel', 'prioridade', 'temperatura',
      'origem_lead AS "origemLead"', 'valor_estimado',
      'probabilidade_fechamento AS "probabilidadeFechamento"', 'proximo_follow_up', 'tags',
      'uploads',
    ].join(', ');
    // score/pipeline_stage no longer exist (removed in up(), proven
    // orphans) — always the default value on reversal, same pattern as org_slug in
    // RebuildArtistsInCanonicalFormOrder20260719000001.
    await queryRunner.query(`INSERT INTO leads_restore (${restoreInsertColumns}) SELECT ${restoreSelectColumns} FROM leads`);

    const [{ c: restoredCount }] = await queryRunner.query(`SELECT count(*)::int AS c FROM leads_restore`);
    if (Number(restoredCount) !== Number(total)) {
      throw new Error(`RebuildLeadsInCanonicalFormOrder.down: contagem divergente (original=${total}, restaurada=${restoredCount}) — abortado.`);
    }

    await queryRunner.query(`ALTER TABLE leads_restore ADD CONSTRAINT leads_restore_pkey PRIMARY KEY (id)`);
    await queryRunner.query(`CREATE INDEX idx_leads_tenant_id_restore ON leads_restore (tenant_id)`);
    await queryRunner.query(`CREATE INDEX idx_leads_tenant_status_restore ON leads_restore (tenant_id, status)`);
    await queryRunner.query(`CREATE INDEX idx_leads_cliente_id_restore ON leads_restore (cliente_id)`);
    await queryRunner.query(`CREATE INDEX idx_leads_tenant_active_restore ON leads_restore (tenant_id, deleted_at, created_at DESC) WHERE (deleted_at IS NULL)`);
    await queryRunner.query(`CREATE INDEX idx_leads_status_restore ON leads_restore (tenant_id, status) WHERE (deleted_at IS NULL)`);
    await queryRunner.query(`CREATE INDEX idx_leads_tiposervico_restore ON leads_restore (tenant_id, "tipoServico")`);
    await queryRunner.query(`CREATE INDEX idx_leads_responsavel_restore ON leads_restore (tenant_id, responsavel)`);
    await queryRunner.query(`CREATE INDEX idx_leads_origemlead_restore ON leads_restore (tenant_id, "origemLead")`);
    await queryRunner.query(`CREATE INDEX idx_leads_cidade_restore ON leads_restore (tenant_id, cidade)`);
    await queryRunner.query(`CREATE INDEX idx_leads_estado_restore ON leads_restore (tenant_id, estado)`);
    await queryRunner.query(`CREATE INDEX idx_leads_tags_restore ON leads_restore USING gin (tags)`);
    await queryRunner.query(`CREATE INDEX idx_leads_payload_servico_restore ON leads_restore USING gin (payload_servico)`);
    await queryRunner.query(`CREATE UNIQUE INDEX ux_leads_id_tenant_restore ON leads_restore (id, tenant_id)`);

    await queryRunner.query(`ALTER TABLE conversations DROP CONSTRAINT conversations_contact_id_fkey`);
    await queryRunner.query(`ALTER TABLE form_submissions DROP CONSTRAINT form_submissions_lead_id_fkey`);
    await queryRunner.query(`ALTER TABLE lead_uploads DROP CONSTRAINT lead_uploads_lead_id_fkey`);
    await queryRunner.query(`ALTER TABLE lead_uploads DROP CONSTRAINT fk_lead_uploads_lead_tenant`);
    await queryRunner.query(`ALTER TABLE lead_interactions DROP CONSTRAINT fk_lead_interactions_lead_id`);

    await queryRunner.query(`ALTER TABLE leads RENAME TO leads_canonical`);
    await queryRunner.query(`ALTER TABLE leads_canonical RENAME CONSTRAINT leads_pkey TO leads_canonical_pkey`);
    await queryRunner.query(`ALTER INDEX idx_leads_tenant_id RENAME TO idx_leads_tenant_id_canonical`);
    await queryRunner.query(`ALTER INDEX idx_leads_tenant_status RENAME TO idx_leads_tenant_status_canonical`);
    await queryRunner.query(`ALTER INDEX idx_leads_cliente_id RENAME TO idx_leads_cliente_id_canonical`);
    await queryRunner.query(`ALTER INDEX idx_leads_tenant_active RENAME TO idx_leads_tenant_active_canonical`);
    await queryRunner.query(`ALTER INDEX idx_leads_status RENAME TO idx_leads_status_canonical`);
    await queryRunner.query(`ALTER INDEX idx_leads_tiposervico RENAME TO idx_leads_tiposervico_canonical`);
    await queryRunner.query(`ALTER INDEX idx_leads_responsavel RENAME TO idx_leads_responsavel_canonical`);
    await queryRunner.query(`ALTER INDEX idx_leads_origemlead RENAME TO idx_leads_origemlead_canonical`);
    await queryRunner.query(`ALTER INDEX idx_leads_cidade RENAME TO idx_leads_cidade_canonical`);
    await queryRunner.query(`ALTER INDEX idx_leads_estado RENAME TO idx_leads_estado_canonical`);
    await queryRunner.query(`ALTER INDEX idx_leads_tags RENAME TO idx_leads_tags_canonical`);
    await queryRunner.query(`ALTER INDEX idx_leads_payload_servico RENAME TO idx_leads_payload_servico_canonical`);
    await queryRunner.query(`ALTER INDEX ux_leads_id_tenant RENAME TO ux_leads_id_tenant_canonical`);

    await queryRunner.query(`ALTER TABLE leads_restore RENAME TO leads`);
    await queryRunner.query(`ALTER INDEX leads_restore_pkey RENAME TO leads_pkey`);
    await queryRunner.query(`ALTER INDEX idx_leads_tenant_id_restore RENAME TO idx_leads_tenant_id`);
    await queryRunner.query(`ALTER INDEX idx_leads_tenant_status_restore RENAME TO idx_leads_tenant_status`);
    await queryRunner.query(`ALTER INDEX idx_leads_cliente_id_restore RENAME TO idx_leads_cliente_id`);
    await queryRunner.query(`ALTER INDEX idx_leads_tenant_active_restore RENAME TO idx_leads_tenant_active`);
    await queryRunner.query(`ALTER INDEX idx_leads_status_restore RENAME TO idx_leads_status`);
    await queryRunner.query(`ALTER INDEX idx_leads_tiposervico_restore RENAME TO idx_leads_tiposervico`);
    await queryRunner.query(`ALTER INDEX idx_leads_responsavel_restore RENAME TO idx_leads_responsavel`);
    await queryRunner.query(`ALTER INDEX idx_leads_origemlead_restore RENAME TO idx_leads_origemlead`);
    await queryRunner.query(`ALTER INDEX idx_leads_cidade_restore RENAME TO idx_leads_cidade`);
    await queryRunner.query(`ALTER INDEX idx_leads_estado_restore RENAME TO idx_leads_estado`);
    await queryRunner.query(`ALTER INDEX idx_leads_tags_restore RENAME TO idx_leads_tags`);
    await queryRunner.query(`ALTER INDEX idx_leads_payload_servico_restore RENAME TO idx_leads_payload_servico`);
    await queryRunner.query(`ALTER INDEX ux_leads_id_tenant_restore RENAME TO ux_leads_id_tenant`);

    await queryRunner.query(`ALTER TABLE conversations ADD CONSTRAINT conversations_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES leads(id) ON DELETE SET NULL`);
    await queryRunner.query(`ALTER TABLE form_submissions ADD CONSTRAINT form_submissions_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL`);
    await queryRunner.query(`ALTER TABLE lead_uploads ADD CONSTRAINT lead_uploads_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE`);
    await queryRunner.query(`ALTER TABLE lead_uploads ADD CONSTRAINT fk_lead_uploads_lead_tenant FOREIGN KEY (lead_id, tenant_id) REFERENCES leads(id, tenant_id) ON DELETE CASCADE`);
    await queryRunner.query(`ALTER TABLE lead_interactions ADD CONSTRAINT fk_lead_interactions_lead_id FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE`);

    await queryRunner.query(`ALTER TABLE leads ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE leads FORCE ROW LEVEL SECURITY`);
    await queryRunner.query(`
      CREATE POLICY super_admin_full_access ON leads
        AS PERMISSIVE FOR ALL TO authenticated
        USING (app_is_super_admin()) WITH CHECK (app_is_super_admin())
    `);
    await queryRunner.query(`
      CREATE POLICY tenant_isolation ON leads
        AS PERMISSIVE FOR ALL TO authenticated
        USING (tenant_id = private_get_tenant_id()) WITH CHECK (tenant_id = private_get_tenant_id())
    `);

    await queryRunner.query(`ALTER TABLE leads OWNER TO musicos_migrator`);
    await queryRunner.query(`GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON leads TO musicos_migrator`);

    await queryRunner.query(`DROP TABLE leads_canonical`);
    await queryRunner.query(`ANALYZE leads`);
  }
}
