/**
 * hr-legacy-fields.ts — CZ-030 deploy-skew compatibility for the HR contract.
 *
 * The canonical HR request fields are English. A web build released before
 * CZ-030 sends Portuguese field names (and, for payroll and leave requests,
 * names that only the form used: funcionario_id, mes_referencia, ...) and
 * Portuguese display labels as contract/leave type values. They are accepted
 * as deprecated input, moved/mapped here — the only place that knows this
 * vocabulary — and never reach persistence. Responses are canonical.
 */
import type { DeprecatedFieldAliases } from '../../common/compat/deprecated-field-aliases.util';

export const EMPLOYEE_DEPRECATED_FIELDS: DeprecatedFieldAliases = {
  cargo: 'job_title',
  departamento: 'department',
  tipo_contrato: 'contract_type',
  salario: 'salary',
  data_admissao: 'hired_at',
  data_demissao: 'terminated_at',
  telefone: 'phone',
  observacoes: 'notes',
  vinculo_usuario_id: 'linked_user_id',
};

export const PAYROLL_DEPRECATED_FIELDS: DeprecatedFieldAliases = {
  funcionario_id: 'employee_id',
  competencia: 'reference_month',
  mes_referencia: 'reference_month',
  salario_bruto: 'gross_salary',
  descontos: 'deductions',
  salario_liquido: 'net_salary',
  data_pagamento: 'payment_date',
  pago_em: 'paid_at',
  arquivo_url: 'file_url',
  observacoes: 'notes',
};

export const LEAVE_REQUEST_DEPRECATED_FIELDS: DeprecatedFieldAliases = {
  funcionario_id: 'employee_id',
  dias_totais: 'total_days',
  motivo: 'reason',
  aprovado_por: 'approved_by',
  documento_url: 'document_url',
  observacoes: 'notes',
};

/** Canonical employee contract types (clt/pj are Brazilian legal regimes). */
export const CONTRACT_TYPES = ['clt', 'pj', 'freelancer', 'internship', 'temporary'] as const;

export const LEGACY_CONTRACT_TYPES: Readonly<Record<string, (typeof CONTRACT_TYPES)[number]>> = {
  CLT: 'clt',
  PJ: 'pj',
  Freelancer: 'freelancer',
  autonomo: 'freelancer',
  'Estágio': 'internship',
  estagio: 'internship',
  'Temporário': 'temporary',
  temporario: 'temporary',
};

export const LEAVE_TYPES = [
  'vacation', 'sick_leave', 'maternity_leave', 'paternity_leave',
  'excused_absence', 'unexcused_absence', 'day_off', 'compensatory_time_off',
] as const;

export const LEGACY_LEAVE_TYPES: Readonly<Record<string, (typeof LEAVE_TYPES)[number]>> = {
  'férias': 'vacation',
  ferias: 'vacation',
  'licença médica': 'sick_leave',
  'licença maternidade': 'maternity_leave',
  'licença paternidade': 'paternity_leave',
  'falta justificada': 'excused_absence',
  'falta injustificada': 'unexcused_absence',
  'day off': 'day_off',
  'folga compensatória': 'compensatory_time_off',
};

export function canonicalContractType(value: unknown): unknown {
  return typeof value === 'string' ? (Object.prototype.hasOwnProperty.call(LEGACY_CONTRACT_TYPES, value) ? LEGACY_CONTRACT_TYPES[value] : value) : value;
}

export function canonicalLeaveType(value: unknown): unknown {
  return typeof value === 'string' ? (Object.prototype.hasOwnProperty.call(LEGACY_LEAVE_TYPES, value) ? LEGACY_LEAVE_TYPES[value] : value) : value;
}
