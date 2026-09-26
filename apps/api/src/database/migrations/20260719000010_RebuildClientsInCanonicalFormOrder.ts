import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Physical rebuild of `clients` in the canonical order of the real form
 * (ContatoFormModal — "Contact = Client", Phase 3 unification decision) —
 * 2026-07-19 audit. Same pattern as the previous ones.
 *
 * Real visual order: "Classificação do Contato" (tipo_pessoa → categoria →
 * perfil) → "Dados da Pessoa Física/Jurídica" (foto/nome_pf/cpf or
 * razao_social/nome_fantasia/cnpj, email/telefone/instagram/funcao — cpf/
 * cnpj/email/telefone are always encrypted, never in plain text:
 * cpf_cnpj_encrypted/email_encrypted/telefone_encrypted) → "Endereço"
 * (logradouro/numero/complemento/bairro/cidade/estado/cep, with
 * endereco_completo derived on submit — buildEnderecoCompleto) →
 * "Classificação" (status_contato/prioridade_contato) → "Responsável"
 * (legal entities only: responsavel_nome/cargo/email/telefone) → "Anexos" →
 * "Observações" → "Histórico de Interações" (interacoes, always
 * last). `nome` is derived (nome_pf or razao_social, computed by
 * ClientsService itself for search/response), positioned next to the
 * identity. `status` (the business ClientStatus, distinct from
 * status_contato) has no visible field in the active form — legacy/
 * reserved, kept (accepted by the DTO, default 'ativo').
 *
 * `segmento`/`endereco`/`responsavel`/`prioridade`/`cpf`/`cnpj` are
 * removed: proven orphans. The first four never appear in
 * `ClientsService.FIELDS` (the real write whitelist) nor in the form —
 * the homonymous names used by `useClientes()` (legacy adapter) are
 * fields of a local view model translated to the real names before
 * any API call; they never reach these columns. `cpf`/`cnpj` (plain
 * text) are never written by security design — the only real way to
 * persist a CPF/CNPJ is via `cpf_cnpj_encrypted`; the service explicitly
 * excludes `cpf`/`cnpj` from the final object and `mapClient()` always overwrites
 * those keys in the response with the decrypted value, so the physical
 * column is never actually read OR written.
 *
 * `categoria`/`perfil` fixed to NOT NULL: required by
 * `CreateClientDto` (no `@IsOptional()`) — empty table in DEV, no risk.
 */
export class RebuildClientsInCanonicalFormOrder20260719000010 implements MigrationInterface {
  name = 'RebuildClientsInCanonicalFormOrder20260719000010';

  private readonly newColumns = `
    id                    uuid NOT NULL DEFAULT gen_random_uuid(),
    tenant_id             uuid NOT NULL,
    tipo_pessoa           varchar(50) NOT NULL DEFAULT 'pessoa_juridica',
    categoria             varchar(100) NOT NULL,
    perfil                varchar(100) NOT NULL,
    nome                  varchar(255) NOT NULL,
    foto                  text,
    nome_pf               varchar(255),
    razao_social          varchar(255),
    nome_fantasia         varchar(255),
    cpf_cnpj_encrypted    text,
    email_encrypted       text,
    telefone_encrypted    text,
    instagram             varchar(255),
    funcao                varchar(100),
    logradouro            varchar(255),
    numero                varchar(20),
    complemento           varchar(100),
    bairro                varchar(120),
    cidade                varchar(100),
    estado                varchar(2),
    cep                   varchar(15),
    endereco_completo     varchar(500),
    status_contato        varchar(40),
    prioridade_contato    varchar(40),
    responsavel_nome      varchar(150),
    responsavel_cargo     varchar(100),
    responsavel_email     varchar(150),
    responsavel_telefone  varchar(30),
    attachments           jsonb,
    observacoes           text,
    interacoes            jsonb,
    status                varchar(50) NOT NULL DEFAULT 'ativo',
    metadata              jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at            timestamp NOT NULL DEFAULT now(),
    updated_at            timestamp NOT NULL DEFAULT now(),
    created_by            varchar(255),
    updated_by            varchar(255),
    deleted_at            timestamp
  `;

  private readonly copyColumns = [
    'id', 'tenant_id', 'tipo_pessoa', 'categoria', 'perfil', 'nome', 'foto', 'nome_pf',
    'razao_social', 'nome_fantasia', 'cpf_cnpj_encrypted', 'email_encrypted',
    'telefone_encrypted', 'instagram', 'funcao', 'logradouro', 'numero', 'complemento',
    'bairro', 'cidade', 'estado', 'cep', 'endereco_completo', 'status_contato',
    'prioridade_contato', 'responsavel_nome', 'responsavel_cargo', 'responsavel_email',
    'responsavel_telefone', 'attachments', 'observacoes', 'interacoes', 'status', 'metadata',
    'created_at', 'updated_at', 'created_by', 'updated_by', 'deleted_at',
  ].join(', ');

  public async up(queryRunner: QueryRunner): Promise<void> {
    const [{ non_null }] = await queryRunner.query(`
      SELECT count(segmento)::int + count(endereco)::int + count(responsavel)::int +
             count(prioridade)::int + count(cpf)::int + count(cnpj)::int AS non_null
      FROM clients
    `);
    if (Number(non_null) > 0) {
      throw new Error(
        `RebuildClientsInCanonicalFormOrder: clients.(segmento/endereco/responsavel/prioridade/cpf/cnpj) ` +
        `have ${non_null} non-null value(s) — columns presumed orphaned, but real data exists. Migration aborted.`,
      );
    }
    const [{ non_null: null_required }] = await queryRunner.query(`
      SELECT count(*)::int AS non_null FROM clients WHERE categoria IS NULL OR perfil IS NULL
    `);
    if (Number(null_required) > 0) {
      throw new Error(
        `RebuildClientsInCanonicalFormOrder: ${null_required} row(s) with NULL categoria/perfil — ` +
        `it is not safe to apply NOT NULL. Migration aborted.`,
      );
    }
    const [{ total }] = await queryRunner.query(`SELECT count(*)::int AS total FROM clients`);

    await queryRunner.query(`CREATE TABLE clients_new (${this.newColumns})`);
    await queryRunner.query(`INSERT INTO clients_new (${this.copyColumns}) SELECT ${this.copyColumns} FROM clients`);

    const [{ c: newCount }] = await queryRunner.query(`SELECT count(*)::int AS c FROM clients_new`);
    if (Number(newCount) !== Number(total)) {
      throw new Error(`RebuildClientsInCanonicalFormOrder: count mismatch (original=${total}, new=${newCount}) — aborted.`);
    }

    await queryRunner.query(`ALTER TABLE clients_new ADD CONSTRAINT clients_new_pkey PRIMARY KEY (id)`);
    await queryRunner.query(`ALTER TABLE clients_new ADD CONSTRAINT uq_clients_tenant_id_id_new UNIQUE (tenant_id, id)`);
    await queryRunner.query(`CREATE INDEX idx_clients_tenant_id_new ON clients_new (tenant_id)`);
    await queryRunner.query(`CREATE INDEX idx_clients_tenant_status_new ON clients_new (tenant_id, status)`);
    await queryRunner.query(`CREATE INDEX idx_clients_tenant_active_new ON clients_new (tenant_id, deleted_at, created_at DESC) WHERE (deleted_at IS NULL)`);

    await queryRunner.query(`ALTER TABLE counterparties DROP CONSTRAINT fk_counterparties_client`);

    await queryRunner.query(`ALTER TABLE clients RENAME TO clients_old`);
    await queryRunner.query(`ALTER TABLE clients_old RENAME CONSTRAINT clients_pkey TO clients_old_pkey`);
    await queryRunner.query(`ALTER TABLE clients_old RENAME CONSTRAINT uq_clients_tenant_id_id TO uq_clients_tenant_id_id_old`);
    await queryRunner.query(`ALTER INDEX idx_clients_tenant_id RENAME TO idx_clients_tenant_id_old`);
    await queryRunner.query(`ALTER INDEX idx_clients_tenant_status RENAME TO idx_clients_tenant_status_old`);
    await queryRunner.query(`ALTER INDEX idx_clients_tenant_active RENAME TO idx_clients_tenant_active_old`);

    await queryRunner.query(`ALTER TABLE clients_new RENAME TO clients`);
    await queryRunner.query(`ALTER INDEX clients_new_pkey RENAME TO clients_pkey`);
    await queryRunner.query(`ALTER TABLE clients RENAME CONSTRAINT uq_clients_tenant_id_id_new TO uq_clients_tenant_id_id`);
    await queryRunner.query(`ALTER INDEX idx_clients_tenant_id_new RENAME TO idx_clients_tenant_id`);
    await queryRunner.query(`ALTER INDEX idx_clients_tenant_status_new RENAME TO idx_clients_tenant_status`);
    await queryRunner.query(`ALTER INDEX idx_clients_tenant_active_new RENAME TO idx_clients_tenant_active`);

    await queryRunner.query(`ALTER TABLE counterparties ADD CONSTRAINT fk_counterparties_client FOREIGN KEY (tenant_id, client_id) REFERENCES clients(tenant_id, id)`);

    await queryRunner.query(`ALTER TABLE clients ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE clients FORCE ROW LEVEL SECURITY`);
    await queryRunner.query(`
      CREATE POLICY super_admin_full_access ON clients
        AS PERMISSIVE FOR ALL TO authenticated
        USING (app_is_super_admin()) WITH CHECK (app_is_super_admin())
    `);
    await queryRunner.query(`
      CREATE POLICY tenant_isolation ON clients
        AS PERMISSIVE FOR ALL TO authenticated
        USING (tenant_id = private_get_tenant_id()) WITH CHECK (tenant_id = private_get_tenant_id())
    `);

    await queryRunner.query(`ALTER TABLE clients OWNER TO musicos_migrator`);
    await queryRunner.query(`GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON clients TO musicos_migrator`);

    await queryRunner.query(`DROP TABLE clients_old`);
    await queryRunner.query(`ANALYZE clients`);
  }

  private readonly originalColumns = `
    id                    uuid NOT NULL DEFAULT gen_random_uuid(),
    tenant_id             uuid NOT NULL,
    nome                  varchar(255) NOT NULL,
    segmento              varchar(100),
    tipo_pessoa           varchar(50) NOT NULL DEFAULT 'pessoa_juridica',
    cpf_cnpj_encrypted    text,
    responsavel           varchar(255),
    email_encrypted       text,
    telefone_encrypted    text,
    endereco              varchar(500),
    cidade                varchar(100),
    estado                varchar(2),
    status                varchar(50) NOT NULL DEFAULT 'ativo',
    observacoes           text,
    metadata              jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at            timestamp NOT NULL DEFAULT now(),
    updated_at            timestamp NOT NULL DEFAULT now(),
    deleted_at            timestamp,
    created_by            varchar(255),
    updated_by            varchar(255),
    nome_pf               varchar(255),
    cpf                   varchar(20),
    cnpj                  varchar(25),
    funcao                varchar(100),
    instagram             varchar(255),
    foto                  text,
    razao_social          varchar(255),
    nome_fantasia         varchar(255),
    categoria             varchar(100),
    perfil                varchar(100),
    cep                   varchar(15),
    logradouro            varchar(255),
    numero                varchar(20),
    complemento           varchar(100),
    bairro                varchar(120),
    status_contato        varchar(40),
    prioridade_contato    varchar(40),
    prioridade            varchar(40),
    responsavel_nome      varchar(150),
    responsavel_email     varchar(150),
    responsavel_telefone  varchar(30),
    responsavel_cargo     varchar(100),
    interacoes            jsonb,
    attachments           jsonb,
    endereco_completo     varchar(500)
  `;

  private readonly restoreCopyColumns = [
    'id', 'tenant_id', 'nome', 'tipo_pessoa', 'cpf_cnpj_encrypted', 'email_encrypted',
    'telefone_encrypted', 'cidade', 'estado', 'status', 'observacoes', 'metadata', 'created_at',
    'updated_at', 'deleted_at', 'created_by', 'updated_by', 'nome_pf', 'funcao', 'instagram',
    'foto', 'razao_social', 'nome_fantasia', 'categoria', 'perfil', 'cep', 'logradouro',
    'numero', 'complemento', 'bairro', 'status_contato', 'prioridade_contato',
    'responsavel_nome', 'responsavel_email', 'responsavel_telefone', 'responsavel_cargo',
    'interacoes', 'attachments', 'endereco_completo',
  ].join(', ');

  public async down(queryRunner: QueryRunner): Promise<void> {
    const [{ total }] = await queryRunner.query(`SELECT count(*)::int AS total FROM clients`);

    await queryRunner.query(`CREATE TABLE clients_restore (${this.originalColumns})`);
    // segmento/endereco/responsavel/prioridade/cpf/cnpj no longer exist
    // (removed in up(), proven orphans) — always NULL on reversal,
    // same pattern as org_slug in RebuildArtistsInCanonicalFormOrder20260719000001.
    await queryRunner.query(`INSERT INTO clients_restore (${this.restoreCopyColumns}) SELECT ${this.restoreCopyColumns} FROM clients`);

    const [{ c: restoredCount }] = await queryRunner.query(`SELECT count(*)::int AS c FROM clients_restore`);
    if (Number(restoredCount) !== Number(total)) {
      throw new Error(`RebuildClientsInCanonicalFormOrder.down: count mismatch (original=${total}, restored=${restoredCount}) — aborted.`);
    }

    await queryRunner.query(`ALTER TABLE clients_restore ADD CONSTRAINT clients_restore_pkey PRIMARY KEY (id)`);
    await queryRunner.query(`ALTER TABLE clients_restore ADD CONSTRAINT uq_clients_tenant_id_id_restore UNIQUE (tenant_id, id)`);
    await queryRunner.query(`CREATE INDEX idx_clients_tenant_id_restore ON clients_restore (tenant_id)`);
    await queryRunner.query(`CREATE INDEX idx_clients_tenant_status_restore ON clients_restore (tenant_id, status)`);
    await queryRunner.query(`CREATE INDEX idx_clients_tenant_active_restore ON clients_restore (tenant_id, deleted_at, created_at DESC) WHERE (deleted_at IS NULL)`);

    await queryRunner.query(`ALTER TABLE counterparties DROP CONSTRAINT fk_counterparties_client`);

    await queryRunner.query(`ALTER TABLE clients RENAME TO clients_canonical`);
    await queryRunner.query(`ALTER TABLE clients_canonical RENAME CONSTRAINT clients_pkey TO clients_canonical_pkey`);
    await queryRunner.query(`ALTER TABLE clients_canonical RENAME CONSTRAINT uq_clients_tenant_id_id TO uq_clients_tenant_id_id_canonical`);
    await queryRunner.query(`ALTER INDEX idx_clients_tenant_id RENAME TO idx_clients_tenant_id_canonical`);
    await queryRunner.query(`ALTER INDEX idx_clients_tenant_status RENAME TO idx_clients_tenant_status_canonical`);
    await queryRunner.query(`ALTER INDEX idx_clients_tenant_active RENAME TO idx_clients_tenant_active_canonical`);

    await queryRunner.query(`ALTER TABLE clients_restore RENAME TO clients`);
    await queryRunner.query(`ALTER INDEX clients_restore_pkey RENAME TO clients_pkey`);
    await queryRunner.query(`ALTER TABLE clients RENAME CONSTRAINT uq_clients_tenant_id_id_restore TO uq_clients_tenant_id_id`);
    await queryRunner.query(`ALTER INDEX idx_clients_tenant_id_restore RENAME TO idx_clients_tenant_id`);
    await queryRunner.query(`ALTER INDEX idx_clients_tenant_status_restore RENAME TO idx_clients_tenant_status`);
    await queryRunner.query(`ALTER INDEX idx_clients_tenant_active_restore RENAME TO idx_clients_tenant_active`);

    await queryRunner.query(`ALTER TABLE counterparties ADD CONSTRAINT fk_counterparties_client FOREIGN KEY (tenant_id, client_id) REFERENCES clients(tenant_id, id)`);

    await queryRunner.query(`ALTER TABLE clients ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE clients FORCE ROW LEVEL SECURITY`);
    await queryRunner.query(`
      CREATE POLICY super_admin_full_access ON clients
        AS PERMISSIVE FOR ALL TO authenticated
        USING (app_is_super_admin()) WITH CHECK (app_is_super_admin())
    `);
    await queryRunner.query(`
      CREATE POLICY tenant_isolation ON clients
        AS PERMISSIVE FOR ALL TO authenticated
        USING (tenant_id = private_get_tenant_id()) WITH CHECK (tenant_id = private_get_tenant_id())
    `);

    await queryRunner.query(`ALTER TABLE clients OWNER TO musicos_migrator`);
    await queryRunner.query(`GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON clients TO musicos_migrator`);

    await queryRunner.query(`DROP TABLE clients_canonical`);
    await queryRunner.query(`ANALYZE clients`);
  }
}
