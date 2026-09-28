// ============================================================================
// HRViewModals — VIEW (read-only) modals of the HR module:
// Employees, Payroll and Vacations/Absences. They follow the
// informational pattern (label + value, no inputs) of the other ViewModals of the system,
// so they do not look like edit forms.
// ============================================================================

import type { ReactNode, ComponentType } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Badge } from "@/shared/ui/badge";
import { formatCurrency, formatDateDashes, getMonetarySemanticClass } from "@/shared/lib/format-utils";
import { useEntityById } from "@/shared/hooks/useEntityLookup";
import { EMPLOYEE_STATUS_LABELS_PT_BR, PAYROLL_STATUS_LABELS_PT_BR, type EmployeeStatus, type PayrollStatus } from "@music-os-360/types";
import { contractTypeLabel, leaveStatusLabel, leaveTypeLabel } from "@/modules/hr/constants";
import type { Employee, PayrollEntry, LeaveRequest } from "@/modules/hr/types/hr.types";

const employeeStatusLabel = (value?: string | null) =>
  (value && EMPLOYEE_STATUS_LABELS_PT_BR[value as EmployeeStatus]) || (value ? "Status desconhecido" : "—");
const payrollStatusLabel = (value?: string | null) =>
  (value && PAYROLL_STATUS_LABELS_PT_BR[value as PayrollStatus]) || (value ? "Status desconhecido" : "—");

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="border-b pb-1 text-sm font-semibold tracking-wider text-muted-foreground">{title}</h3>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function Row({
  label,
  value,
  icon: Icon,
  full,
}: {
  label: string;
  value: ReactNode;
  icon?: ComponentType<{ className?: string }>;
  full?: boolean;
}) {
  const isEmpty = value == null || value === "" || value === "—";
  return (
    <div className={`space-y-1 ${full ? "sm:col-span-2" : ""}`}>
      <p className="flex items-center gap-1.5 text-xs font-medium tracking-wider text-muted-foreground">
        {Icon && <Icon className="h-3.5 w-3.5 shrink-0" />}
        {label}
      </p>
      <p className={isEmpty ? "text-sm italic text-muted-foreground" : "text-sm text-foreground break-words"}>
        {isEmpty ? "—" : value}
      </p>
    </div>
  );
}

function ViewShell({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-6 pt-2">{children}</div>
      </DialogContent>
    </Dialog>
  );
}

// ── Employee ──────────────────────────────────────────────────────────────────

export function EmployeeViewModal({
  open,
  onOpenChange,
  employee,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee?: Employee | null;
}) {
  if (!employee) return null;
  return (
    <ViewShell
      open={open}
      onOpenChange={onOpenChange}
      title={employee.name || "Funcionário"}
      description="Detalhes do funcionário"
    >
      <Section title="Dados Pessoais">
        <Row label="Nome completo" value={employee.name} />
        <Row label="CPF" value={employee.cpf} />
        <Row label="E-mail" value={employee.email} />
        <Row label="Telefone" value={employee.phone} />
      </Section>
      <Section title="Dados Profissionais">
        <Row label="Cargo" value={employee.job_title} />
        <Row label="Setor" value={employee.department || "—"} />
        <Row label="Tipo de contrato" value={contractTypeLabel(employee.contract_type as string | null)} />
        <Row label="Data de admissão" value={formatDateDashes(employee.hired_at)} />
        <Row label="Salário base" value={<span className={getMonetarySemanticClass("neutral")}>{formatCurrency(employee.salary != null ? Number(employee.salary) : null)}</span>} />
        <Row
          label="Status"
          value={
            employee.status ? (
              <Badge variant={employee.status === "active" ? "success" : "neutral"}>
                {employeeStatusLabel(employee.status as string)}
              </Badge>
            ) : (
              "—"
            )
          }
        />
      </Section>
      {employee.notes ? (
        <Section title="Observações">
          <Row label="Observações" value={employee.notes} full />
        </Section>
      ) : null}
    </ViewShell>
  );
}

// ── Payroll ───────────────────────────────────────────────────────────────────

export function PayrollViewModal({
  open,
  onOpenChange,
  record,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record?: PayrollEntry | null;
}) {
  const { entity: employee } = useEntityById<Employee>("employees", record?.employee_id);
  if (!record) return null;
  return (
    <ViewShell
      open={open}
      onOpenChange={onOpenChange}
      title="Registro de Folha de Pagamento"
      description={record.reference_month || record.reference_month || "Detalhes do pagamento"}
    >
      <Section title="Identificação">
        <Row label="Funcionário" value={employee?.name} />
        <Row label="Período" value={record.reference_month || record.reference_month} />
      </Section>
      <Section title="Valores">
        <Row label="Salário bruto" value={<span className={getMonetarySemanticClass("neutral")}>{formatCurrency(record.gross_salary != null ? Number(record.gross_salary) : null)}</span>} />
        <Row label="Descontos" value={<span className={getMonetarySemanticClass("negative")}>{formatCurrency(-Number(record.deductions || 0))}</span>} />
        <Row label="Bônus" value={<span className={getMonetarySemanticClass("neutral")}>{formatCurrency(record.bonus != null ? Number(record.bonus) : null)}</span>} />
        <Row label="Salário líquido" value={<span className={getMonetarySemanticClass("neutral")}>{formatCurrency(record.net_salary != null ? Number(record.net_salary) : null)}</span>} />
      </Section>
      <Section title="Pagamento">
        <Row label="Data de pagamento" value={formatDateDashes(record.payment_date)} />
        <Row
          label="Status"
          value={
            record.status ? (
              <Badge variant={record.status === "paid" ? "success" : record.status === "cancelled" ? "danger" : "warning"}>
                {payrollStatusLabel(record.status)}
              </Badge>
            ) : (
              "—"
            )
          }
        />
      </Section>
      {record.notes ? (
        <Section title="Observações">
          <Row label="Observações" value={record.notes} full />
        </Section>
      ) : null}
    </ViewShell>
  );
}

// ── Vacations and absences ────────────────────────────────────────────────────

export function LeaveRequestViewModal({
  open,
  onOpenChange,
  leaveRequest,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leaveRequest?: LeaveRequest | null;
}) {
  const { entity: employee } = useEntityById<Employee>("employees", leaveRequest?.employee_id);
  if (!leaveRequest) return null;
  return (
    <ViewShell
      open={open}
      onOpenChange={onOpenChange}
      title="Férias / Ausência"
      description={leaveTypeLabel(leaveRequest.type as string)}
    >
      <Section title="Identificação">
        <Row label="Funcionário" value={employee?.name} />
        <Row label="Tipo" value={leaveTypeLabel(leaveRequest.type as string)} />
      </Section>
      <Section title="Período">
        <Row label="Data de início" value={formatDateDashes(leaveRequest.start_date)} />
        <Row label="Data de término" value={formatDateDashes(leaveRequest.end_date)} />
        <Row label="Dias totais" value={leaveRequest.total_days != null ? String(leaveRequest.total_days) : "—"} />
        <Row
          label="Status"
          value={
            leaveRequest.status ? (
              <Badge variant={leaveRequest.status === "approved" ? "success" : leaveRequest.status === "rejected" ? "danger" : "warning"}>
                {leaveStatusLabel(leaveRequest.status as string)}
              </Badge>
            ) : (
              "—"
            )
          }
        />
      </Section>
      {(leaveRequest.reason || leaveRequest.notes) ? (
        <Section title="Detalhes">
          {leaveRequest.reason ? <Row label="Motivo" value={leaveRequest.reason} full /> : null}
          {leaveRequest.notes ? <Row label="Observações" value={leaveRequest.notes} full /> : null}
        </Section>
      ) : null}
    </ViewShell>
  );
}
