import type {
  EmployeeStatusValue,
  EmployeeContractType,
  LeaveType,
  LeaveRequestStatusValue,
} from "@/shared/types/enums";

export type { EmployeeStatusValue, EmployeeContractType, LeaveType, LeaveRequestStatusValue };

export interface Employee {
  id: string;
  name: string;
  job_title?: string | null;
  department?: string | null;
  salary?: number | string | null;
  contract_type?: EmployeeContractType | string | null;
  hired_at?: string | null;
  terminated_at?: string | null;
  status?: EmployeeStatusValue | string | null;
  linked_user_id?: string | null;
  email?: string | null;
  phone?: string | null;
  cpf?: string | null;
  notes?: string | null;
  documents?: unknown[];
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export type EmployeeInsert = Omit<Employee, "id" | "created_at" | "updated_at">;
export type EmployeeUpdate = Partial<EmployeeInsert>;

export interface PayrollEntry {
  id: string;
  employee_id?: string | null;
  reference_month?: string | null;
  gross_salary?: number | string | null;
  deductions?: number | string | null;
  bonus?: number | string | null;
  net_salary?: number | string | null;
  payment_date?: string | null;
  paid_at?: string | null;
  status?: string | null;
  notes?: string | null;
  file_url?: string | null;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export type PayrollEntryInsert = Omit<PayrollEntry, "id" | "created_at" | "updated_at">;
export type PayrollEntryUpdate = Partial<PayrollEntryInsert>;

export interface LeaveRequest {
  id: string;
  employee_id?: string | null;
  type?: LeaveType | string | null;
  start_date?: string | null;
  end_date?: string | null;
  total_days?: number | null;
  status?: LeaveRequestStatusValue | string | null;
  reason?: string | null;
  notes?: string | null;
  approved_by?: string | null;
  document_url?: string | null;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export type LeaveRequestInsert = Omit<LeaveRequest, "id" | "created_at" | "updated_at">;
export type LeaveRequestUpdate = Partial<LeaveRequestInsert>;
