import { Badge, type BadgeVariant } from "@/shared/ui/badge";
import { differenceInDays, parseISO } from "date-fns";
import type { MockRow } from "@/shared/types/database";

export type ContractLifecycleState = "ativo" | "vencendo" | "sem_contrato" | "em_negociacao";

type ContratoLike = MockRow & {
  status?: string | null;
  end_date?: string | null;
};

const ATIVO_STATUSES = new Set(["active", "signed", "in_force"]);
const NEGOCIACAO_STATUSES = new Set(["em_negociacao", "negociacao", "draft", "under_review"]);

export function getContractLifecycleState(contratos: ContratoLike[] | undefined | null): ContractLifecycleState {
  if (!contratos || contratos.length === 0) return "sem_contrato";

  const hoje = new Date();
  let temAtivo = false;
  let temVencendo = false;
  let temNegociacao = false;

  for (const c of contratos) {
    const status = (c.status || "").toLowerCase();

    if (NEGOCIACAO_STATUSES.has(status)) {
      temNegociacao = true;
      continue;
    }

    if (status === "expiring") {
      temVencendo = true;
      temAtivo = true;
      continue;
    }

    if (!ATIVO_STATUSES.has(status)) continue;

    temAtivo = true;

    if (c.end_date) {
      try {
        const dias = differenceInDays(parseISO(c.end_date), hoje);
        if (dias >= 0 && dias <= 30) temVencendo = true;
      } catch {
        /* ignore parse errors */
      }
    }
  }

  if (temVencendo) return "vencendo";
  if (temAtivo) return "ativo";
  if (temNegociacao) return "em_negociacao";
  return "sem_contrato";
}

function getDiasVencendo(contratos: ContratoLike[] | undefined | null): number | null {
  if (!contratos) return null;
  const hoje = new Date();
  let menor: number | null = null;
  for (const c of contratos) {
    const status = (c.status || "").toLowerCase();
    if (!ATIVO_STATUSES.has(status) && status !== "expiring") continue;
    if (!c.end_date) continue;
    try {
      const dias = differenceInDays(parseISO(c.end_date), hoje);
      if (dias >= 0 && dias <= 30) {
        if (menor === null || dias < menor) menor = dias;
      }
    } catch { /* ignore */ }
  }
  return menor;
}

interface ContractStatusBadgeProps {
  contratos?: ContratoLike[] | null;
  situacao?: ContractLifecycleState;
  className?: string;
  "data-testid"?: string;
}

export function ContractStatusBadge({
  contratos,
  situacao,
  className,
  ...rest
}: ContractStatusBadgeProps) {
  const resolved = situacao ?? getContractLifecycleState(contratos);

  let label: string;
  let variant: BadgeVariant;

  switch (resolved) {
    case "ativo":
      label = "Contrato ativo";
      variant = "success";
      break;
    case "vencendo": {
      const dias = contratos ? getDiasVencendo(contratos) : null;
      label = dias !== null ? `Contrato vencendo em ${dias} dia${dias === 1 ? "" : "s"}` : "Contrato vencendo";
      variant = "warning";
      break;
    }
    case "em_negociacao":
      label = "Em negociação";
      variant = "warning";
      break;
    case "sem_contrato":
    default:
      label = "Sem contrato ativo";
      variant = "neutral";
      break;
  }

  return (
    <Badge
      variant={variant}
      className={className}
      data-testid={rest["data-testid"]}
    >
      {label}
    </Badge>
  );
}
