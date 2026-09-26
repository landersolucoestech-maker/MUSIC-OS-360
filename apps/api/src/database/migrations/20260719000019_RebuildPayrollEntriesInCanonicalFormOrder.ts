import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Physical rebuild of `payroll_entries` — 2026-07-19 audit.
 *
 * Real form: `FolhaPagamentoFormModal.tsx`. `CreatePayrollEntryDto`
 * explicitly documents the funcionario_id/employee_id and
 * mes_referencia/competencia pairs as mirrored aliases ("the form sends
 * funcionario_id/mes_referencia; employee_id/competencia are the legacy
 * aliases. The service requires one of each pair and mirrors both.") —
 * `HrService.createPayroll()` always writes both of each pair. No
 * column is an orphan: `arquivo_url`/`pago_em` have no visual field in the current form,
 * but are accepted by the DTO and written by `HrService` whenever the caller
 * sends them — kept as a legacy zone, only repositioned.
 *
 * The original order had the whole "form fields" block (2nd era) after
 * the audit block. A pure order rebuild (zero removal): functional
 * fields in visual order → legacy next to the matching real field
 * → arquivo_url/pago_em (no visual field) → metadata → auditing. There are
 * no `created_by`/`updated_by` in this table — a pre-existing gap, not
 * invented here.
 */
export class RebuildPayrollEntriesInCanonicalFormOrder20260719000019 implements MigrationInterface {
  name = 'RebuildPayrollEntriesInCanonicalFormOrder20260719000019';

  private readonly newColumns = `
    id               uuid NOT NULL DEFAULT gen_random_uuid(),
    tenant_id        uuid NOT NULL,
    funcionario_id   uuid,
    employee_id      uuid NOT NULL,
    mes_referencia   varchar(20),
    competencia      varchar(7) NOT NULL,
    salario_bruto    numeric(15,2) NOT NULL,
    descontos        numeric(15,2) NOT NULL DEFAULT 0,
    bonus            numeric(15,2),
    salario_liquido  numeric(15,2) NOT NULL,
    data_pagamento   date,
    status           varchar(50) NOT NULL DEFAULT 'pendente',
    observacoes      text,
    arquivo_url      text,
    pago_em          timestamp,
    metadata         jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at       timestamp NOT NULL DEFAULT now(),
    updated_at       timestamp NOT NULL DEFAULT now(),
    deleted_at       timestamp
  `;

  private readonly copyColumns = [
    'id', 'tenant_id', 'funcionario_id', 'employee_id', 'mes_referencia', 'competencia',
    'salario_bruto', 'descontos', 'bonus', 'salario_liquido', 'data_pagamento', 'status',
    'observacoes', 'arquivo_url', 'pago_em', 'metadata', 'created_at', 'updated_at', 'deleted_at',
  ].join(', ');

  public async up(queryRunner: QueryRunner): Promise<void> {
    const [{ total }] = await queryRunner.query(`SELECT count(*)::int AS total FROM payroll_entries`);

    await queryRunner.query(`CREATE TABLE payroll_entries_new (${this.newColumns})`);
    await queryRunner.query(`INSERT INTO payroll_entries_new (${this.copyColumns}) SELECT ${this.copyColumns} FROM payroll_entries`);

    const [{ c: newCount }] = await queryRunner.query(`SELECT count(*)::int AS c FROM payroll_entries_new`);
    if (Number(newCount) !== Number(total)) {
      throw new Error(`RebuildPayrollEntriesInCanonicalFormOrder: count mismatch (original=${total}, new=${newCount}) — aborted.`);
    }

    await queryRunner.query(`ALTER TABLE payroll_entries_new ADD CONSTRAINT payroll_entries_new_pkey PRIMARY KEY (id)`);
    await queryRunner.query(`ALTER TABLE payroll_entries_new ADD CONSTRAINT fk_payroll_entries_employee_id_new FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE RESTRICT`);
    await queryRunner.query(`CREATE INDEX idx_payroll_tenant_id_new ON payroll_entries_new (tenant_id)`);
    await queryRunner.query(`CREATE INDEX idx_payroll_employee_id_new ON payroll_entries_new (employee_id)`);
    await queryRunner.query(`CREATE UNIQUE INDEX payroll_entries_employee_id_competencia_key_new ON payroll_entries_new (employee_id, competencia)`);

    await queryRunner.query(`ALTER TABLE payroll_entries RENAME TO payroll_entries_old`);
    await queryRunner.query(`ALTER TABLE payroll_entries_old RENAME CONSTRAINT payroll_entries_pkey TO payroll_entries_old_pkey`);
    await queryRunner.query(`ALTER TABLE payroll_entries_old RENAME CONSTRAINT fk_payroll_entries_employee_id TO fk_payroll_entries_employee_id_old`);
    await queryRunner.query(`ALTER INDEX idx_payroll_tenant_id RENAME TO idx_payroll_tenant_id_old`);
    await queryRunner.query(`ALTER INDEX idx_payroll_employee_id RENAME TO idx_payroll_employee_id_old`);
    await queryRunner.query(`ALTER INDEX payroll_entries_employee_id_competencia_key RENAME TO payroll_entries_employee_id_competencia_key_old`);

    await queryRunner.query(`ALTER TABLE payroll_entries_new RENAME TO payroll_entries`);
    await queryRunner.query(`ALTER INDEX payroll_entries_new_pkey RENAME TO payroll_entries_pkey`);
    await queryRunner.query(`ALTER TABLE payroll_entries RENAME CONSTRAINT fk_payroll_entries_employee_id_new TO fk_payroll_entries_employee_id`);
    await queryRunner.query(`ALTER INDEX idx_payroll_tenant_id_new RENAME TO idx_payroll_tenant_id`);
    await queryRunner.query(`ALTER INDEX idx_payroll_employee_id_new RENAME TO idx_payroll_employee_id`);
    await queryRunner.query(`ALTER INDEX payroll_entries_employee_id_competencia_key_new RENAME TO payroll_entries_employee_id_competencia_key`);

    await queryRunner.query(`ALTER TABLE payroll_entries ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE payroll_entries FORCE ROW LEVEL SECURITY`);
    await queryRunner.query(`
      CREATE POLICY tenant_isolation ON payroll_entries
        AS PERMISSIVE FOR ALL TO authenticated
        USING (tenant_id = private_get_tenant_id()) WITH CHECK (tenant_id = private_get_tenant_id())
    `);
    await queryRunner.query(`
      CREATE POLICY super_admin_full_access ON payroll_entries
        AS PERMISSIVE FOR ALL TO authenticated
        USING (app_is_super_admin()) WITH CHECK (app_is_super_admin())
    `);

    await queryRunner.query(`ALTER TABLE payroll_entries OWNER TO musicos_migrator`);
    await queryRunner.query(`GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON payroll_entries TO musicos_migrator`);

    await queryRunner.query(`DROP TABLE payroll_entries_old`);
    await queryRunner.query(`ANALYZE payroll_entries`);
  }

  private readonly originalColumns = `
    id               uuid NOT NULL DEFAULT gen_random_uuid(),
    tenant_id        uuid NOT NULL,
    employee_id      uuid NOT NULL,
    competencia      varchar(7) NOT NULL,
    salario_bruto    numeric(15,2) NOT NULL,
    descontos        numeric(15,2) NOT NULL DEFAULT 0,
    salario_liquido  numeric(15,2) NOT NULL,
    status           varchar(50) NOT NULL DEFAULT 'pendente',
    arquivo_url      text,
    pago_em          timestamp,
    metadata         jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at       timestamp NOT NULL DEFAULT now(),
    updated_at       timestamp NOT NULL DEFAULT now(),
    deleted_at       timestamp,
    funcionario_id   uuid,
    mes_referencia   varchar(20),
    bonus            numeric(15,2),
    data_pagamento   date,
    observacoes      text
  `;

  private readonly restoreCopyColumns = [
    'id', 'tenant_id', 'employee_id', 'competencia', 'salario_bruto', 'descontos',
    'salario_liquido', 'status', 'arquivo_url', 'pago_em', 'metadata', 'created_at',
    'updated_at', 'deleted_at', 'funcionario_id', 'mes_referencia', 'bonus',
    'data_pagamento', 'observacoes',
  ].join(', ');

  public async down(queryRunner: QueryRunner): Promise<void> {
    const [{ total }] = await queryRunner.query(`SELECT count(*)::int AS total FROM payroll_entries`);

    await queryRunner.query(`CREATE TABLE payroll_entries_restore (${this.originalColumns})`);
    await queryRunner.query(`INSERT INTO payroll_entries_restore (${this.restoreCopyColumns}) SELECT ${this.restoreCopyColumns} FROM payroll_entries`);

    const [{ c: restoredCount }] = await queryRunner.query(`SELECT count(*)::int AS c FROM payroll_entries_restore`);
    if (Number(restoredCount) !== Number(total)) {
      throw new Error(`RebuildPayrollEntriesInCanonicalFormOrder.down: count mismatch (original=${total}, restored=${restoredCount}) — aborted.`);
    }

    await queryRunner.query(`ALTER TABLE payroll_entries_restore ADD CONSTRAINT payroll_entries_restore_pkey PRIMARY KEY (id)`);
    await queryRunner.query(`ALTER TABLE payroll_entries_restore ADD CONSTRAINT fk_payroll_entries_employee_id_restore FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE RESTRICT`);
    await queryRunner.query(`CREATE INDEX idx_payroll_tenant_id_restore ON payroll_entries_restore (tenant_id)`);
    await queryRunner.query(`CREATE INDEX idx_payroll_employee_id_restore ON payroll_entries_restore (employee_id)`);
    await queryRunner.query(`CREATE UNIQUE INDEX payroll_entries_employee_id_competencia_key_restore ON payroll_entries_restore (employee_id, competencia)`);

    await queryRunner.query(`ALTER TABLE payroll_entries RENAME TO payroll_entries_canonical`);
    await queryRunner.query(`ALTER TABLE payroll_entries_canonical RENAME CONSTRAINT payroll_entries_pkey TO payroll_entries_canonical_pkey`);
    await queryRunner.query(`ALTER TABLE payroll_entries_canonical RENAME CONSTRAINT fk_payroll_entries_employee_id TO fk_payroll_entries_employee_id_canonical`);
    await queryRunner.query(`ALTER INDEX idx_payroll_tenant_id RENAME TO idx_payroll_tenant_id_canonical`);
    await queryRunner.query(`ALTER INDEX idx_payroll_employee_id RENAME TO idx_payroll_employee_id_canonical`);
    await queryRunner.query(`ALTER INDEX payroll_entries_employee_id_competencia_key RENAME TO payroll_entries_employee_id_competencia_key_canonical`);

    await queryRunner.query(`ALTER TABLE payroll_entries_restore RENAME TO payroll_entries`);
    await queryRunner.query(`ALTER INDEX payroll_entries_restore_pkey RENAME TO payroll_entries_pkey`);
    await queryRunner.query(`ALTER TABLE payroll_entries RENAME CONSTRAINT fk_payroll_entries_employee_id_restore TO fk_payroll_entries_employee_id`);
    await queryRunner.query(`ALTER INDEX idx_payroll_tenant_id_restore RENAME TO idx_payroll_tenant_id`);
    await queryRunner.query(`ALTER INDEX idx_payroll_employee_id_restore RENAME TO idx_payroll_employee_id`);
    await queryRunner.query(`ALTER INDEX payroll_entries_employee_id_competencia_key_restore RENAME TO payroll_entries_employee_id_competencia_key`);

    await queryRunner.query(`ALTER TABLE payroll_entries ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE payroll_entries FORCE ROW LEVEL SECURITY`);
    await queryRunner.query(`
      CREATE POLICY tenant_isolation ON payroll_entries
        AS PERMISSIVE FOR ALL TO authenticated
        USING (tenant_id = private_get_tenant_id()) WITH CHECK (tenant_id = private_get_tenant_id())
    `);
    await queryRunner.query(`
      CREATE POLICY super_admin_full_access ON payroll_entries
        AS PERMISSIVE FOR ALL TO authenticated
        USING (app_is_super_admin()) WITH CHECK (app_is_super_admin())
    `);

    await queryRunner.query(`ALTER TABLE payroll_entries OWNER TO musicos_migrator`);
    await queryRunner.query(`GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON payroll_entries TO musicos_migrator`);

    await queryRunner.query(`DROP TABLE payroll_entries_canonical`);
    await queryRunner.query(`ANALYZE payroll_entries`);
  }
}
