import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 20260928000008_CanonicalizeHrToEnglish
 *
 * Technical-language mandate (technical = English, UX = PT-BR): the Portuguese
 * technical names of the HR tables (employees, payroll_entries, leave_requests).
 *
 * Columns the application maps:
 *   employees.cargo -> job_title, departamento -> department,
 *     tipo_contrato -> contract_type, salario -> salary,
 *     data_admissao -> hired_at, data_demissao -> terminated_at,
 *     telefone_encrypted -> phone_encrypted, observacoes -> notes,
 *     vinculo_usuario_id -> linked_user_id
 *   payroll_entries.competencia -> reference_month, salario_bruto -> gross_salary,
 *     descontos -> deductions, salario_liquido -> net_salary,
 *     data_pagamento -> payment_date, pago_em -> paid_at, arquivo_url -> file_url,
 *     observacoes -> notes
 *   leave_requests.motivo -> reason, aprovado_por -> approved_by,
 *     documento_url -> document_url, dias_totais -> total_days, observacoes -> notes
 *
 * Form-field columns added by 20260712000003 that no code path reads or writes
 * (their data, if any, is kept; product/security decision pending, see the
 * canonical naming map): employees.data_nascimento -> birth_date,
 * endereco -> address (rg is a Brazilian legal document term and keeps its name).
 *
 * Unmapped mirrors of a mapped canonical column (same concept, never kept in
 * sync by the application) get a `legacy_` name until a data reconciliation
 * decides whether to drop them (blocker in the canonical naming map):
 *   employees.nome_completo -> legacy_full_name (name), setor -> legacy_sector
 *     (department), salario_base -> legacy_base_salary (salary)
 *   payroll_entries.funcionario_id -> legacy_employee_id (employee_id),
 *     mes_referencia -> legacy_reference_month (reference_month)
 *   leave_requests.funcionario_id -> legacy_employee_id (employee_id)
 *
 * Unique index: payroll_entries_employee_id_competencia_key ->
 *   payroll_entries_employee_id_reference_month_key
 *
 * Persisted technical values (PT-BR labels live in the web UI):
 *   employees.contract_type: CLT/clt -> clt, PJ/pj -> pj (Brazilian legal
 *     regimes), Freelancer/autonomo -> freelancer, Estágio/estagio -> internship,
 *     Temporário/temporario -> temporary
 *   leave_requests.type: férias/ferias -> vacation, licença médica -> sick_leave,
 *     licença maternidade -> maternity_leave, licença paternidade -> paternity_leave,
 *     falta justificada -> excused_absence, falta injustificada -> unexcused_absence,
 *     day off -> day_off, folga compensatória -> compensatory_time_off
 *
 * No index, view, function or policy references the renamed columns (checked
 * against a freshly migrated catalog). Every step is guarded, so the migration
 * is idempotent, and down() restores the previous names and values (values
 * return to the lowercase slugs the backend default already used).
 */
const COLUMNS: ReadonlyArray<[table: string, from: string, to: string]> = [
  ['employees', 'cargo', 'job_title'],
  ['employees', 'departamento', 'department'],
  ['employees', 'tipo_contrato', 'contract_type'],
  ['employees', 'salario', 'salary'],
  ['employees', 'data_admissao', 'hired_at'],
  ['employees', 'data_demissao', 'terminated_at'],
  ['employees', 'telefone_encrypted', 'phone_encrypted'],
  ['employees', 'observacoes', 'notes'],
  ['employees', 'vinculo_usuario_id', 'linked_user_id'],
  ['employees', 'data_nascimento', 'birth_date'],
  ['employees', 'endereco', 'address'],
  ['employees', 'nome_completo', 'legacy_full_name'],
  ['employees', 'setor', 'legacy_sector'],
  ['employees', 'salario_base', 'legacy_base_salary'],
  ['payroll_entries', 'competencia', 'reference_month'],
  ['payroll_entries', 'salario_bruto', 'gross_salary'],
  ['payroll_entries', 'descontos', 'deductions'],
  ['payroll_entries', 'salario_liquido', 'net_salary'],
  ['payroll_entries', 'data_pagamento', 'payment_date'],
  ['payroll_entries', 'pago_em', 'paid_at'],
  ['payroll_entries', 'arquivo_url', 'file_url'],
  ['payroll_entries', 'observacoes', 'notes'],
  ['payroll_entries', 'funcionario_id', 'legacy_employee_id'],
  ['payroll_entries', 'mes_referencia', 'legacy_reference_month'],
  ['leave_requests', 'motivo', 'reason'],
  ['leave_requests', 'aprovado_por', 'approved_by'],
  ['leave_requests', 'documento_url', 'document_url'],
  ['leave_requests', 'dias_totais', 'total_days'],
  ['leave_requests', 'observacoes', 'notes'],
  ['leave_requests', 'funcionario_id', 'legacy_employee_id'],
];

const CONTRACT_TYPES: ReadonlyArray<[legacy: string[], canonical: string, down: string]> = [
  [['CLT', 'Clt'], 'clt', 'clt'],
  [['PJ', 'Pj'], 'pj', 'pj'],
  [['Freelancer', 'autonomo', 'Autônomo'], 'freelancer', 'autonomo'],
  [['Estágio', 'estagio', 'Estagio'], 'internship', 'estagio'],
  [['Temporário', 'temporario', 'Temporario'], 'temporary', 'temporario'],
];

const LEAVE_TYPES: ReadonlyArray<[legacy: string[], canonical: string, down: string]> = [
  [['férias', 'ferias', 'Férias'], 'vacation', 'ferias'],
  [['licença médica', 'licenca_medica', 'Licença médica'], 'sick_leave', 'licenca_medica'],
  [['licença maternidade', 'licenca_maternidade'], 'maternity_leave', 'licenca_maternidade'],
  [['licença paternidade', 'licenca_paternidade'], 'paternity_leave', 'licenca_paternidade'],
  [['falta justificada', 'falta_justificada'], 'excused_absence', 'falta_justificada'],
  [['falta injustificada', 'falta_injustificada'], 'unexcused_absence', 'falta_injustificada'],
  [['day off'], 'day_off', 'day_off'],
  [['folga compensatória', 'folga_compensatoria'], 'compensatory_time_off', 'folga_compensatoria'],
];

function renameColumn(table: string, from: string, to: string): string {
  return `
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = '${table}' AND column_name = '${from}'
      ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = '${table}' AND column_name = '${to}'
      ) THEN
        ALTER TABLE "${table}" RENAME COLUMN "${from}" TO "${to}";
      END IF;
    END $$;`;
}

function renameIndex(from: string, to: string): string {
  return `
    DO $$
    BEGIN
      IF to_regclass('public.${from}') IS NOT NULL AND to_regclass('public.${to}') IS NULL THEN
        ALTER INDEX "${from}" RENAME TO "${to}";
      END IF;
    END $$;`;
}

function remap(table: string, column: string, from: string[], to: string): string {
  const sources = from.map((v) => `'${v.replace(/'/g, "''")}'`).join(', ');
  return `UPDATE "${table}" SET "${column}" = '${to}' WHERE "${column}" IN (${sources});`;
}

export class CanonicalizeHrToEnglish20260928000008 implements MigrationInterface {
  name = 'CanonicalizeHrToEnglish20260928000008';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [table, from, to] of COLUMNS) await queryRunner.query(renameColumn(table, from, to));
    await queryRunner.query(renameIndex(
      'payroll_entries_employee_id_competencia_key', 'payroll_entries_employee_id_reference_month_key',
    ));
    for (const [legacy, canonical] of CONTRACT_TYPES) {
      await queryRunner.query(remap('employees', 'contract_type', legacy, canonical));
    }
    for (const [legacy, canonical] of LEAVE_TYPES) {
      await queryRunner.query(remap('leave_requests', 'type', legacy, canonical));
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const [, canonical, down] of LEAVE_TYPES) {
      await queryRunner.query(remap('leave_requests', 'type', [canonical], down));
    }
    for (const [, canonical, down] of CONTRACT_TYPES) {
      await queryRunner.query(remap('employees', 'contract_type', [canonical], down));
    }
    await queryRunner.query(renameIndex(
      'payroll_entries_employee_id_reference_month_key', 'payroll_entries_employee_id_competencia_key',
    ));
    for (const [table, from, to] of [...COLUMNS].reverse()) await queryRunner.query(renameColumn(table, to, from));
  }
}
