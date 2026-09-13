import type {
  EmployeeStatusValue,
  EmployeeContractType,
  LeaveType,
  LeaveRequestStatusValue,
} from "@/shared/types/enums";

export type { EmployeeStatusValue, EmployeeContractType, LeaveType, LeaveRequestStatusValue };

export interface Employee {
  id: string;
  user_id?: string;
  nome: string;
  cargo?: string | null;
  departamento?: string | null;
  salario?: number | string | null;
  tipo_contrato?: EmployeeContractType | string | null;
  data_admissao?: string | null;
  status?: EmployeeStatusValue | string | null;
  vinculo_usuario_id?: string | null;
  email?: string | null;
  telefone?: string | null;
  cpf?: string | null;
  observacoes?: string | null;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export type EmployeeInsert = Omit<Employee, "id" | "user_id" | "created_at" | "updated_at">;
export type EmployeeUpdate = Partial<EmployeeInsert>;

export interface PayrollEntry {
  id: string;
  user_id?: string;
  funcionario_id?: string | null;
  periodo?: string | null;
  mes_referencia?: string | null;
  salario_bruto?: number | null;
  descontos?: number | null;
  bonus?: number | null;
  salario_liquido?: number | null;
  data_pagamento?: string | null;
  status?: string | null;
  observacoes?: string | null;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export type PayrollEntryInsert = Omit<PayrollEntry, "id" | "user_id" | "created_at" | "updated_at">;
export type PayrollEntryUpdate = Partial<PayrollEntryInsert>;

export interface LeaveRequest {
  id: string;
  user_id?: string;
  funcionario_id?: string | null;
  type?: LeaveType | string | null;
  start_date?: string | null;
  end_date?: string | null;
  dias_totais?: number | null;
  status?: LeaveRequestStatusValue | string | null;
  motivo?: string | null;
  observacoes?: string | null;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export type LeaveRequestInsert = Omit<LeaveRequest, "id" | "user_id" | "created_at" | "updated_at">;
export type LeaveRequestUpdate = Partial<LeaveRequestInsert>;

export interface EmployeeDocument {
  id: string;
  user_id?: string;
  funcionario_id?: string | null;
  tipo_documento?: string | null;
  nome_arquivo?: string | null;
  url_arquivo?: string | null;
  descricao?: string | null;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export type EmployeeDocumentInsert = Omit<EmployeeDocument, "id" | "user_id" | "created_at" | "updated_at">;
export type EmployeeDocumentUpdate = Partial<EmployeeDocumentInsert>;
