import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Physical rebuild of `leave_requests` — 2026-07-19 audit.
 *
 * Real form: `FeriasAusenciasFormModal.tsx`. `CreateLeaveRequestDto`
 * explicitly documents the funcionario_id/employee_id pair as mirrored
 * aliases ("the form sends funcionario_id; employee_id is the legacy
 * alias. The service requires one of the two and mirrors both."). `motivo` and
 * `documento_url` are accepted by the DTO and written by
 * `HrService.createLeaveRequest()` whenever the caller sends them, but have
 * no visual field in the current form — kept as a legacy zone (same
 * criterion as `employees.departamento`/`salario`), not removed. Zero
 * columns removed.
 *
 * The original order had the whole "form fields" block (2nd era)
 * after the audit block. A pure order rebuild: functional fields in
 * visual order (funcionario_id → tipo → data_inicio → data_fim →
 * dias_totais → status → aprovado_por → observacoes) → legacy next
 * to the matching real field → metadata → auditing (`created_at,
 * updated_at, created_by, deleted_at` — there is no `updated_by` in this
 * table, a pre-existing gap not invented here).
 */
export class RebuildLeaveRequestsInCanonicalFormOrder20260719000025 implements MigrationInterface {
  name = 'RebuildLeaveRequestsInCanonicalFormOrder20260719000025';

  private readonly newColumns = `
    id             uuid NOT NULL DEFAULT gen_random_uuid(),
    tenant_id      uuid NOT NULL,
    funcionario_id uuid,
    employee_id    uuid NOT NULL,
    tipo           varchar(100) NOT NULL,
    data_inicio    timestamp NOT NULL,
    data_fim       timestamp NOT NULL,
    dias_totais    integer,
    status         varchar(50) NOT NULL DEFAULT 'pendente',
    aprovado_por   varchar(255),
    observacoes    text,
    motivo         text,
    documento_url  text,
    metadata       jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at     timestamp NOT NULL DEFAULT now(),
    updated_at     timestamp NOT NULL DEFAULT now(),
    created_by     varchar(255),
    deleted_at     timestamp
  `;

  private readonly copyColumns = [
    'id', 'tenant_id', 'funcionario_id', 'employee_id', 'tipo', 'data_inicio', 'data_fim',
    'dias_totais', 'status', 'aprovado_por', 'observacoes', 'motivo', 'documento_url',
    'metadata', 'created_at', 'updated_at', 'created_by', 'deleted_at',
  ].join(', ');

  public async up(queryRunner: QueryRunner): Promise<void> {
    const [{ total }] = await queryRunner.query(`SELECT count(*)::int AS total FROM leave_requests`);

    await queryRunner.query(`CREATE TABLE leave_requests_new (${this.newColumns})`);
    await queryRunner.query(`INSERT INTO leave_requests_new (${this.copyColumns}) SELECT ${this.copyColumns} FROM leave_requests`);

    const [{ c: newCount }] = await queryRunner.query(`SELECT count(*)::int AS c FROM leave_requests_new`);
    if (Number(newCount) !== Number(total)) {
      throw new Error(`RebuildLeaveRequestsInCanonicalFormOrder: count mismatch (original=${total}, new=${newCount}) — aborted.`);
    }

    await queryRunner.query(`ALTER TABLE leave_requests_new ADD CONSTRAINT leave_requests_new_pkey PRIMARY KEY (id)`);
    await queryRunner.query(`ALTER TABLE leave_requests_new ADD CONSTRAINT fk_leave_requests_employee_id_new FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE RESTRICT`);
    await queryRunner.query(`CREATE INDEX idx_leave_tenant_id_new ON leave_requests_new (tenant_id)`);
    await queryRunner.query(`CREATE INDEX idx_leave_employee_id_new ON leave_requests_new (employee_id)`);

    await queryRunner.query(`ALTER TABLE leave_requests RENAME TO leave_requests_old`);
    await queryRunner.query(`ALTER TABLE leave_requests_old RENAME CONSTRAINT leave_requests_pkey TO leave_requests_old_pkey`);
    await queryRunner.query(`ALTER TABLE leave_requests_old RENAME CONSTRAINT fk_leave_requests_employee_id TO fk_leave_requests_employee_id_old`);
    await queryRunner.query(`ALTER INDEX idx_leave_tenant_id RENAME TO idx_leave_tenant_id_old`);
    await queryRunner.query(`ALTER INDEX idx_leave_employee_id RENAME TO idx_leave_employee_id_old`);

    await queryRunner.query(`ALTER TABLE leave_requests_new RENAME TO leave_requests`);
    await queryRunner.query(`ALTER INDEX leave_requests_new_pkey RENAME TO leave_requests_pkey`);
    await queryRunner.query(`ALTER TABLE leave_requests RENAME CONSTRAINT fk_leave_requests_employee_id_new TO fk_leave_requests_employee_id`);
    await queryRunner.query(`ALTER INDEX idx_leave_tenant_id_new RENAME TO idx_leave_tenant_id`);
    await queryRunner.query(`ALTER INDEX idx_leave_employee_id_new RENAME TO idx_leave_employee_id`);

    await queryRunner.query(`ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE leave_requests FORCE ROW LEVEL SECURITY`);
    await queryRunner.query(`
      CREATE POLICY tenant_isolation ON leave_requests
        AS PERMISSIVE FOR ALL TO authenticated
        USING (tenant_id = private_get_tenant_id()) WITH CHECK (tenant_id = private_get_tenant_id())
    `);
    await queryRunner.query(`
      CREATE POLICY super_admin_full_access ON leave_requests
        AS PERMISSIVE FOR ALL TO authenticated
        USING (app_is_super_admin()) WITH CHECK (app_is_super_admin())
    `);

    await queryRunner.query(`ALTER TABLE leave_requests OWNER TO musicos_migrator`);
    await queryRunner.query(`GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON leave_requests TO musicos_migrator`);

    await queryRunner.query(`DROP TABLE leave_requests_old`);
    await queryRunner.query(`ANALYZE leave_requests`);
  }

  private readonly originalColumns = `
    id             uuid NOT NULL DEFAULT gen_random_uuid(),
    tenant_id      uuid NOT NULL,
    employee_id    uuid NOT NULL,
    tipo           varchar(100) NOT NULL,
    data_inicio    timestamp NOT NULL,
    data_fim       timestamp NOT NULL,
    status         varchar(50) NOT NULL DEFAULT 'pendente',
    motivo         text,
    aprovado_por   varchar(255),
    metadata       jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at     timestamp NOT NULL DEFAULT now(),
    updated_at     timestamp NOT NULL DEFAULT now(),
    deleted_at     timestamp,
    documento_url  text,
    created_by     varchar(255),
    funcionario_id uuid,
    dias_totais    integer,
    observacoes    text
  `;

  private readonly restoreCopyColumns = [
    'id', 'tenant_id', 'employee_id', 'tipo', 'data_inicio', 'data_fim', 'status', 'motivo',
    'aprovado_por', 'metadata', 'created_at', 'updated_at', 'deleted_at', 'documento_url',
    'created_by', 'funcionario_id', 'dias_totais', 'observacoes',
  ].join(', ');

  public async down(queryRunner: QueryRunner): Promise<void> {
    const [{ total }] = await queryRunner.query(`SELECT count(*)::int AS total FROM leave_requests`);

    await queryRunner.query(`CREATE TABLE leave_requests_restore (${this.originalColumns})`);
    await queryRunner.query(`INSERT INTO leave_requests_restore (${this.restoreCopyColumns}) SELECT ${this.restoreCopyColumns} FROM leave_requests`);

    const [{ c: restoredCount }] = await queryRunner.query(`SELECT count(*)::int AS c FROM leave_requests_restore`);
    if (Number(restoredCount) !== Number(total)) {
      throw new Error(`RebuildLeaveRequestsInCanonicalFormOrder.down: count mismatch (original=${total}, restored=${restoredCount}) — aborted.`);
    }

    await queryRunner.query(`ALTER TABLE leave_requests_restore ADD CONSTRAINT leave_requests_restore_pkey PRIMARY KEY (id)`);
    await queryRunner.query(`ALTER TABLE leave_requests_restore ADD CONSTRAINT fk_leave_requests_employee_id_restore FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE RESTRICT`);
    await queryRunner.query(`CREATE INDEX idx_leave_tenant_id_restore ON leave_requests_restore (tenant_id)`);
    await queryRunner.query(`CREATE INDEX idx_leave_employee_id_restore ON leave_requests_restore (employee_id)`);

    await queryRunner.query(`ALTER TABLE leave_requests RENAME TO leave_requests_canonical`);
    await queryRunner.query(`ALTER TABLE leave_requests_canonical RENAME CONSTRAINT leave_requests_pkey TO leave_requests_canonical_pkey`);
    await queryRunner.query(`ALTER TABLE leave_requests_canonical RENAME CONSTRAINT fk_leave_requests_employee_id TO fk_leave_requests_employee_id_canonical`);
    await queryRunner.query(`ALTER INDEX idx_leave_tenant_id RENAME TO idx_leave_tenant_id_canonical`);
    await queryRunner.query(`ALTER INDEX idx_leave_employee_id RENAME TO idx_leave_employee_id_canonical`);

    await queryRunner.query(`ALTER TABLE leave_requests_restore RENAME TO leave_requests`);
    await queryRunner.query(`ALTER INDEX leave_requests_restore_pkey RENAME TO leave_requests_pkey`);
    await queryRunner.query(`ALTER TABLE leave_requests RENAME CONSTRAINT fk_leave_requests_employee_id_restore TO fk_leave_requests_employee_id`);
    await queryRunner.query(`ALTER INDEX idx_leave_tenant_id_restore RENAME TO idx_leave_tenant_id`);
    await queryRunner.query(`ALTER INDEX idx_leave_employee_id_restore RENAME TO idx_leave_employee_id`);

    await queryRunner.query(`ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE leave_requests FORCE ROW LEVEL SECURITY`);
    await queryRunner.query(`
      CREATE POLICY tenant_isolation ON leave_requests
        AS PERMISSIVE FOR ALL TO authenticated
        USING (tenant_id = private_get_tenant_id()) WITH CHECK (tenant_id = private_get_tenant_id())
    `);
    await queryRunner.query(`
      CREATE POLICY super_admin_full_access ON leave_requests
        AS PERMISSIVE FOR ALL TO authenticated
        USING (app_is_super_admin()) WITH CHECK (app_is_super_admin())
    `);

    await queryRunner.query(`ALTER TABLE leave_requests OWNER TO musicos_migrator`);
    await queryRunner.query(`GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON leave_requests TO musicos_migrator`);

    await queryRunner.query(`DROP TABLE leave_requests_canonical`);
    await queryRunner.query(`ANALYZE leave_requests`);
  }
}
