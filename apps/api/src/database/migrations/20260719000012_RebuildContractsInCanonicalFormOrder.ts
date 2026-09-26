import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Physical rebuild of `contracts` — 2026-07-19 audit. Same pattern
 * as the previous ones. A pure order rebuild (no column removal): ALL
 * columns have a proven real writer — `artista_id`/`cliente_id`/
 * `exclusivo`/`autentique_doc_id` have no visible field in EITHER of the two
 * active forms (ContratoWizard.tsx — main flow in Contratos.tsx;
 * ContratoFormModal.tsx — flow used in RegistroMusicas.tsx), but they are
 * accepted by `CreateContractDto`/persisted by `ContractsService` and
 * `artista_id` is also written by `contract-events.handler.ts` — DTO-
 * supported and reachable via the real API, same criterion as
 * `projects.orcamento`/`audiovisual_projects.slug` (legacy/reserved,
 * kept).
 *
 * Real order combining the two forms: `template_id` (ContratoWizard's 1st
 * step) → titulo/tipo/status (the wizard's final review) →
 * artista_id/cliente_id (technical relations, no active picker) →
 * lancamento_id (real field in ContratoFormModal) → data_inicio/data_fim →
 * valor (the real "Valor do Contrato/Serviço" field in ContratoFormModal) →
 * exclusivo (legacy/reserved) → observacoes → arquivo_url (real in
 * ContratoFormModal) → autentique_doc_id (legacy/reserved) →
 * signing_platform (real, the wizard's "Signatários" step) → versoes (real,
 * written by ContratoFormModal when replacing the file) → signers (real, both
 * forms) → control/auditing. `signers`/`template_id` were after
 * created_by/updated_by (later migrations) — fixed.
 */
export class RebuildContractsInCanonicalFormOrder20260719000012 implements MigrationInterface {
  name = 'RebuildContractsInCanonicalFormOrder20260719000012';

  private readonly newColumns = `
    id                  uuid NOT NULL DEFAULT gen_random_uuid(),
    tenant_id           uuid NOT NULL,
    template_id         uuid,
    titulo              varchar(500) NOT NULL,
    tipo                varchar(100) NOT NULL,
    status              varchar(50) NOT NULL DEFAULT 'rascunho',
    artista_id          uuid,
    cliente_id          uuid,
    lancamento_id       uuid,
    data_inicio         timestamp,
    data_fim            timestamp,
    valor               numeric,
    exclusivo           boolean NOT NULL DEFAULT false,
    observacoes         text,
    arquivo_url         text,
    autentique_doc_id   varchar(255),
    signing_platform    varchar(100),
    versoes             jsonb NOT NULL DEFAULT '[]'::jsonb,
    signers             jsonb,
    metadata            jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at          timestamp NOT NULL DEFAULT now(),
    updated_at          timestamp NOT NULL DEFAULT now(),
    created_by          varchar(255),
    updated_by          varchar(255),
    deleted_at          timestamp
  `;

  private readonly copyColumns = [
    'id', 'tenant_id', 'template_id', 'titulo', 'tipo', 'status', 'artista_id', 'cliente_id',
    'lancamento_id', 'data_inicio', 'data_fim', 'valor', 'exclusivo', 'observacoes',
    'arquivo_url', 'autentique_doc_id', 'signing_platform', 'versoes', 'signers', 'metadata',
    'created_at', 'updated_at', 'created_by', 'updated_by', 'deleted_at',
  ].join(', ');

  public async up(queryRunner: QueryRunner): Promise<void> {
    const [{ total }] = await queryRunner.query(`SELECT count(*)::int AS total FROM contracts`);

    await queryRunner.query(`CREATE TABLE contracts_new (${this.newColumns})`);
    await queryRunner.query(`INSERT INTO contracts_new (${this.copyColumns}) SELECT ${this.copyColumns} FROM contracts`);

    const [{ c: newCount }] = await queryRunner.query(`SELECT count(*)::int AS c FROM contracts_new`);
    if (Number(newCount) !== Number(total)) {
      throw new Error(`RebuildContractsInCanonicalFormOrder: contagem divergente (original=${total}, nova=${newCount}) — abortada.`);
    }

    await queryRunner.query(`ALTER TABLE contracts_new ADD CONSTRAINT contracts_new_pkey PRIMARY KEY (id)`);
    await queryRunner.query(`ALTER TABLE contracts_new ADD CONSTRAINT uq_contracts_tenant_id_id_new UNIQUE (tenant_id, id)`);
    await queryRunner.query(`CREATE UNIQUE INDEX ux_contracts_id_tenant_new ON contracts_new (id, tenant_id)`);
    await queryRunner.query(`ALTER TABLE contracts_new ADD CONSTRAINT fk_contracts_artista_id_new FOREIGN KEY (artista_id) REFERENCES artists(id) ON DELETE SET NULL`);
    await queryRunner.query(`CREATE INDEX idx_contracts_tenant_id_new ON contracts_new (tenant_id)`);
    await queryRunner.query(`CREATE INDEX idx_contracts_tenant_status_new ON contracts_new (tenant_id, status)`);
    await queryRunner.query(`CREATE INDEX idx_contracts_artista_id_new ON contracts_new (artista_id)`);
    await queryRunner.query(`CREATE INDEX idx_contracts_data_fim_new ON contracts_new (data_fim)`);
    await queryRunner.query(`CREATE INDEX idx_contracts_tenant_active_new ON contracts_new (tenant_id, deleted_at, created_at DESC) WHERE (deleted_at IS NULL)`);
    await queryRunner.query(`CREATE INDEX idx_contracts_status_new ON contracts_new (tenant_id, status) WHERE (deleted_at IS NULL)`);

    await queryRunner.query(`ALTER TABLE financial_transactions DROP CONSTRAINT fk_fintx_contract`);
    await queryRunner.query(`ALTER TABLE contact_contracts DROP CONSTRAINT fk_contact_contracts_contract_tenant`);

    await queryRunner.query(`ALTER TABLE contracts RENAME TO contracts_old`);
    await queryRunner.query(`ALTER TABLE contracts_old RENAME CONSTRAINT contracts_pkey TO contracts_old_pkey`);
    await queryRunner.query(`ALTER TABLE contracts_old RENAME CONSTRAINT uq_contracts_tenant_id_id TO uq_contracts_tenant_id_id_old`);
    await queryRunner.query(`ALTER INDEX ux_contracts_id_tenant RENAME TO ux_contracts_id_tenant_old`);
    await queryRunner.query(`ALTER TABLE contracts_old RENAME CONSTRAINT fk_contracts_artista_id TO fk_contracts_artista_id_old`);
    await queryRunner.query(`ALTER INDEX idx_contracts_tenant_id RENAME TO idx_contracts_tenant_id_old`);
    await queryRunner.query(`ALTER INDEX idx_contracts_tenant_status RENAME TO idx_contracts_tenant_status_old`);
    await queryRunner.query(`ALTER INDEX idx_contracts_artista_id RENAME TO idx_contracts_artista_id_old`);
    await queryRunner.query(`ALTER INDEX idx_contracts_data_fim RENAME TO idx_contracts_data_fim_old`);
    await queryRunner.query(`ALTER INDEX idx_contracts_tenant_active RENAME TO idx_contracts_tenant_active_old`);
    await queryRunner.query(`ALTER INDEX idx_contracts_status RENAME TO idx_contracts_status_old`);

    await queryRunner.query(`ALTER TABLE contracts_new RENAME TO contracts`);
    await queryRunner.query(`ALTER INDEX contracts_new_pkey RENAME TO contracts_pkey`);
    await queryRunner.query(`ALTER TABLE contracts RENAME CONSTRAINT uq_contracts_tenant_id_id_new TO uq_contracts_tenant_id_id`);
    await queryRunner.query(`ALTER INDEX ux_contracts_id_tenant_new RENAME TO ux_contracts_id_tenant`);
    await queryRunner.query(`ALTER TABLE contracts RENAME CONSTRAINT fk_contracts_artista_id_new TO fk_contracts_artista_id`);
    await queryRunner.query(`ALTER INDEX idx_contracts_tenant_id_new RENAME TO idx_contracts_tenant_id`);
    await queryRunner.query(`ALTER INDEX idx_contracts_tenant_status_new RENAME TO idx_contracts_tenant_status`);
    await queryRunner.query(`ALTER INDEX idx_contracts_artista_id_new RENAME TO idx_contracts_artista_id`);
    await queryRunner.query(`ALTER INDEX idx_contracts_data_fim_new RENAME TO idx_contracts_data_fim`);
    await queryRunner.query(`ALTER INDEX idx_contracts_tenant_active_new RENAME TO idx_contracts_tenant_active`);
    await queryRunner.query(`ALTER INDEX idx_contracts_status_new RENAME TO idx_contracts_status`);

    await queryRunner.query(`ALTER TABLE financial_transactions ADD CONSTRAINT fk_fintx_contract FOREIGN KEY (tenant_id, contract_id) REFERENCES contracts(tenant_id, id)`);
    await queryRunner.query(`ALTER TABLE contact_contracts ADD CONSTRAINT fk_contact_contracts_contract_tenant FOREIGN KEY (contract_id, tenant_id) REFERENCES contracts(id, tenant_id)`);

    await queryRunner.query(`ALTER TABLE contracts ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE contracts FORCE ROW LEVEL SECURITY`);
    await queryRunner.query(`
      CREATE POLICY super_admin_full_access ON contracts
        AS PERMISSIVE FOR ALL TO authenticated
        USING (app_is_super_admin()) WITH CHECK (app_is_super_admin())
    `);
    await queryRunner.query(`
      CREATE POLICY tenant_isolation ON contracts
        AS PERMISSIVE FOR ALL TO authenticated
        USING (tenant_id = private_get_tenant_id()) WITH CHECK (tenant_id = private_get_tenant_id())
    `);

    await queryRunner.query(`ALTER TABLE contracts OWNER TO musicos_migrator`);
    await queryRunner.query(`GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON contracts TO musicos_migrator`);

    await queryRunner.query(`DROP TABLE contracts_old`);
    await queryRunner.query(`ANALYZE contracts`);
  }

  private readonly originalColumns = `
    id                  uuid NOT NULL DEFAULT gen_random_uuid(),
    tenant_id           uuid NOT NULL,
    titulo              varchar(500) NOT NULL,
    tipo                varchar(100) NOT NULL,
    status              varchar(50) NOT NULL DEFAULT 'rascunho',
    artista_id          uuid,
    cliente_id          uuid,
    lancamento_id       uuid,
    data_inicio         timestamp,
    data_fim            timestamp,
    valor               numeric,
    exclusivo           boolean NOT NULL DEFAULT false,
    observacoes         text,
    arquivo_url         text,
    autentique_doc_id   varchar(255),
    signing_platform    varchar(100),
    versoes             jsonb NOT NULL DEFAULT '[]'::jsonb,
    metadata            jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at          timestamp NOT NULL DEFAULT now(),
    updated_at          timestamp NOT NULL DEFAULT now(),
    deleted_at          timestamp,
    created_by          varchar(255),
    updated_by          varchar(255),
    template_id         uuid,
    signers             jsonb
  `;

  public async down(queryRunner: QueryRunner): Promise<void> {
    const [{ total }] = await queryRunner.query(`SELECT count(*)::int AS total FROM contracts`);

    await queryRunner.query(`CREATE TABLE contracts_restore (${this.originalColumns})`);
    await queryRunner.query(`INSERT INTO contracts_restore (${this.copyColumns}) SELECT ${this.copyColumns} FROM contracts`);

    const [{ c: restoredCount }] = await queryRunner.query(`SELECT count(*)::int AS c FROM contracts_restore`);
    if (Number(restoredCount) !== Number(total)) {
      throw new Error(`RebuildContractsInCanonicalFormOrder.down: contagem divergente (original=${total}, restaurada=${restoredCount}) — abortado.`);
    }

    await queryRunner.query(`ALTER TABLE contracts_restore ADD CONSTRAINT contracts_restore_pkey PRIMARY KEY (id)`);
    await queryRunner.query(`ALTER TABLE contracts_restore ADD CONSTRAINT uq_contracts_tenant_id_id_restore UNIQUE (tenant_id, id)`);
    await queryRunner.query(`CREATE UNIQUE INDEX ux_contracts_id_tenant_restore ON contracts_restore (id, tenant_id)`);
    await queryRunner.query(`ALTER TABLE contracts_restore ADD CONSTRAINT fk_contracts_artista_id_restore FOREIGN KEY (artista_id) REFERENCES artists(id) ON DELETE SET NULL`);
    await queryRunner.query(`CREATE INDEX idx_contracts_tenant_id_restore ON contracts_restore (tenant_id)`);
    await queryRunner.query(`CREATE INDEX idx_contracts_tenant_status_restore ON contracts_restore (tenant_id, status)`);
    await queryRunner.query(`CREATE INDEX idx_contracts_artista_id_restore ON contracts_restore (artista_id)`);
    await queryRunner.query(`CREATE INDEX idx_contracts_data_fim_restore ON contracts_restore (data_fim)`);
    await queryRunner.query(`CREATE INDEX idx_contracts_tenant_active_restore ON contracts_restore (tenant_id, deleted_at, created_at DESC) WHERE (deleted_at IS NULL)`);
    await queryRunner.query(`CREATE INDEX idx_contracts_status_restore ON contracts_restore (tenant_id, status) WHERE (deleted_at IS NULL)`);

    await queryRunner.query(`ALTER TABLE financial_transactions DROP CONSTRAINT fk_fintx_contract`);
    await queryRunner.query(`ALTER TABLE contact_contracts DROP CONSTRAINT fk_contact_contracts_contract_tenant`);

    await queryRunner.query(`ALTER TABLE contracts RENAME TO contracts_canonical`);
    await queryRunner.query(`ALTER TABLE contracts_canonical RENAME CONSTRAINT contracts_pkey TO contracts_canonical_pkey`);
    await queryRunner.query(`ALTER TABLE contracts_canonical RENAME CONSTRAINT uq_contracts_tenant_id_id TO uq_contracts_tenant_id_id_canonical`);
    await queryRunner.query(`ALTER INDEX ux_contracts_id_tenant RENAME TO ux_contracts_id_tenant_canonical`);
    await queryRunner.query(`ALTER TABLE contracts_canonical RENAME CONSTRAINT fk_contracts_artista_id TO fk_contracts_artista_id_canonical`);
    await queryRunner.query(`ALTER INDEX idx_contracts_tenant_id RENAME TO idx_contracts_tenant_id_canonical`);
    await queryRunner.query(`ALTER INDEX idx_contracts_tenant_status RENAME TO idx_contracts_tenant_status_canonical`);
    await queryRunner.query(`ALTER INDEX idx_contracts_artista_id RENAME TO idx_contracts_artista_id_canonical`);
    await queryRunner.query(`ALTER INDEX idx_contracts_data_fim RENAME TO idx_contracts_data_fim_canonical`);
    await queryRunner.query(`ALTER INDEX idx_contracts_tenant_active RENAME TO idx_contracts_tenant_active_canonical`);
    await queryRunner.query(`ALTER INDEX idx_contracts_status RENAME TO idx_contracts_status_canonical`);

    await queryRunner.query(`ALTER TABLE contracts_restore RENAME TO contracts`);
    await queryRunner.query(`ALTER INDEX contracts_restore_pkey RENAME TO contracts_pkey`);
    await queryRunner.query(`ALTER TABLE contracts RENAME CONSTRAINT uq_contracts_tenant_id_id_restore TO uq_contracts_tenant_id_id`);
    await queryRunner.query(`ALTER INDEX ux_contracts_id_tenant_restore RENAME TO ux_contracts_id_tenant`);
    await queryRunner.query(`ALTER TABLE contracts RENAME CONSTRAINT fk_contracts_artista_id_restore TO fk_contracts_artista_id`);
    await queryRunner.query(`ALTER INDEX idx_contracts_tenant_id_restore RENAME TO idx_contracts_tenant_id`);
    await queryRunner.query(`ALTER INDEX idx_contracts_tenant_status_restore RENAME TO idx_contracts_tenant_status`);
    await queryRunner.query(`ALTER INDEX idx_contracts_artista_id_restore RENAME TO idx_contracts_artista_id`);
    await queryRunner.query(`ALTER INDEX idx_contracts_data_fim_restore RENAME TO idx_contracts_data_fim`);
    await queryRunner.query(`ALTER INDEX idx_contracts_tenant_active_restore RENAME TO idx_contracts_tenant_active`);
    await queryRunner.query(`ALTER INDEX idx_contracts_status_restore RENAME TO idx_contracts_status`);

    await queryRunner.query(`ALTER TABLE financial_transactions ADD CONSTRAINT fk_fintx_contract FOREIGN KEY (tenant_id, contract_id) REFERENCES contracts(tenant_id, id)`);
    await queryRunner.query(`ALTER TABLE contact_contracts ADD CONSTRAINT fk_contact_contracts_contract_tenant FOREIGN KEY (contract_id, tenant_id) REFERENCES contracts(id, tenant_id)`);

    await queryRunner.query(`ALTER TABLE contracts ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE contracts FORCE ROW LEVEL SECURITY`);
    await queryRunner.query(`
      CREATE POLICY super_admin_full_access ON contracts
        AS PERMISSIVE FOR ALL TO authenticated
        USING (app_is_super_admin()) WITH CHECK (app_is_super_admin())
    `);
    await queryRunner.query(`
      CREATE POLICY tenant_isolation ON contracts
        AS PERMISSIVE FOR ALL TO authenticated
        USING (tenant_id = private_get_tenant_id()) WITH CHECK (tenant_id = private_get_tenant_id())
    `);

    await queryRunner.query(`ALTER TABLE contracts OWNER TO musicos_migrator`);
    await queryRunner.query(`GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON contracts TO musicos_migrator`);

    await queryRunner.query(`DROP TABLE contracts_canonical`);
    await queryRunner.query(`ANALYZE contracts`);
  }
}
