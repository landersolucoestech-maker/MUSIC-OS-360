// ============================================================================
// RHViewModals — modais de VISUALIZAÇÃO (somente leitura) do módulo RH:
// Funcionários, Folha de Pagamento e Férias/Ausências. Seguem o padrão
// informativo (label + valor, sem inputs) dos demais ViewModals do sistema,
// para não parecerem formulários de edição.
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
import type { Employee, PayrollEntry, LeaveRequest } from "@/modules/rh/types/hr.types";

function humanize(value?: string | null): string {
  if (!value) return "—";
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

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

// ── Funcionário ─────────────────────────────────────────────────────────────

export function EmployeeViewModal({
  open,
  onOpenChange,
  funcionario,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  funcionario?: Employee | null;
}) {
  if (!funcionario) return null;
  return (
    <ViewShell
      open={open}
      onOpenChange={onOpenChange}
      title={funcionario.nome || "Funcionário"}
      description="Detalhes do funcionário"
    >
      <Section title="Dados Pessoais">
        <Row label="Nome completo" value={funcionario.nome} />
        <Row label="CPF" value={funcionario.cpf} />
        <Row label="E-mail" value={funcionario.email} />
        <Row label="Telefone" value={funcionario.telefone} />
      </Section>
      <Section title="Dados Profissionais">
        <Row label="Cargo" value={funcionario.cargo} />
        <Row label="Setor" value={humanize(funcionario.departamento)} />
        <Row label="Tipo de contrato" value={humanize(funcionario.tipo_contrato as string)} />
        <Row label="Data de admissão" value={formatDateDashes(funcionario.data_admissao)} />
        <Row label="Salário base" value={<span className={getMonetarySemanticClass("neutral")}>{formatCurrency(funcionario.salario != null ? Number(funcionario.salario) : null)}</span>} />
        <Row
          label="Status"
          value={
            funcionario.status ? (
              <Badge variant={funcionario.status === "active" ? "success" : "neutral"}>
                {humanize(funcionario.status as string)}
              </Badge>
            ) : (
              "—"
            )
          }
        />
      </Section>
      {funcionario.observacoes ? (
        <Section title="Observações">
          <Row label="Observações" value={funcionario.observacoes} full />
        </Section>
      ) : null}
    </ViewShell>
  );
}

// ── Folha de Pagamento ──────────────────────────────────────────────────────

export function PayrollViewModal({
  open,
  onOpenChange,
  registro,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  registro?: PayrollEntry | null;
}) {
  const { entity: funcionario } = useEntityById<Employee>("funcionarios", registro?.funcionario_id);
  if (!registro) return null;
  return (
    <ViewShell
      open={open}
      onOpenChange={onOpenChange}
      title="Registro de Folha de Pagamento"
      description={registro.periodo || registro.mes_referencia || "Detalhes do pagamento"}
    >
      <Section title="Identificação">
        <Row label="Funcionário" value={funcionario?.nome} />
        <Row label="Período" value={registro.periodo || registro.mes_referencia} />
      </Section>
      <Section title="Valores">
        <Row label="Salário bruto" value={<span className={getMonetarySemanticClass("neutral")}>{formatCurrency(registro.salario_bruto)}</span>} />
        <Row label="Descontos" value={<span className={getMonetarySemanticClass("negative")}>{formatCurrency(-Number(registro.descontos || 0))}</span>} />
        <Row label="Bônus" value={<span className={getMonetarySemanticClass("neutral")}>{formatCurrency(registro.bonus)}</span>} />
        <Row label="Salário líquido" value={<span className={getMonetarySemanticClass("neutral")}>{formatCurrency(registro.salario_liquido)}</span>} />
      </Section>
      <Section title="Pagamento">
        <Row label="Data de pagamento" value={formatDateDashes(registro.data_pagamento)} />
        <Row
          label="Status"
          value={
            registro.status ? (
              <Badge variant={registro.status === "paid" ? "success" : registro.status === "cancelled" ? "danger" : "warning"}>
                {humanize(registro.status)}
              </Badge>
            ) : (
              "—"
            )
          }
        />
      </Section>
      {registro.observacoes ? (
        <Section title="Observações">
          <Row label="Observações" value={registro.observacoes} full />
        </Section>
      ) : null}
    </ViewShell>
  );
}

// ── Férias e Ausências ──────────────────────────────────────────────────────

export function LeaveRequestViewModal({
  open,
  onOpenChange,
  ausencia,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ausencia?: LeaveRequest | null;
}) {
  const { entity: funcionario } = useEntityById<Employee>("funcionarios", ausencia?.funcionario_id);
  if (!ausencia) return null;
  return (
    <ViewShell
      open={open}
      onOpenChange={onOpenChange}
      title="Férias / Ausência"
      description={humanize(ausencia.type as string)}
    >
      <Section title="Identificação">
        <Row label="Funcionário" value={funcionario?.nome} />
        <Row label="Tipo" value={humanize(ausencia.type as string)} />
      </Section>
      <Section title="Período">
        <Row label="Data de início" value={formatDateDashes(ausencia.start_date)} />
        <Row label="Data de término" value={formatDateDashes(ausencia.end_date)} />
        <Row label="Dias totais" value={ausencia.dias_totais != null ? String(ausencia.dias_totais) : "—"} />
        <Row
          label="Status"
          value={
            ausencia.status ? (
              <Badge variant={ausencia.status === "approved" ? "success" : ausencia.status === "rejected" ? "danger" : "warning"}>
                {humanize(ausencia.status as string)}
              </Badge>
            ) : (
              "—"
            )
          }
        />
      </Section>
      {(ausencia.motivo || ausencia.observacoes) ? (
        <Section title="Detalhes">
          {ausencia.motivo ? <Row label="Motivo" value={ausencia.motivo} full /> : null}
          {ausencia.observacoes ? <Row label="Observações" value={ausencia.observacoes} full /> : null}
        </Section>
      ) : null}
    </ViewShell>
  );
}
