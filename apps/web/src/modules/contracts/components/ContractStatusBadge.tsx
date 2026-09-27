import { Badge, type BadgeVariant } from "@/shared/ui/badge";
import { differenceInDays, parseISO } from "date-fns";
import type { MockRow } from "@/shared/types/database";

export type ContractLifecycleState = "ativo" | "vencendo" | "sem_contrato" | "em_negociacao";

type ContractLike = MockRow & {
  status?: string | null;
  end_date?: string | null;
};

const ACTIVE_STATUSES = new Set(["active", "signed", "in_force"]);
const NEGOCIACAO_STATUSES = new Set(["em_negociacao", "negociacao", "draft", "under_review"]);

export function getContractLifecycleState(contracts: ContractLike[] | undefined | null): ContractLifecycleState {
  if (!contracts || contracts.length === 0) return "sem_contrato";

  const today = new Date();
  let hasActive = false;
  let hasExpiring = false;
  let temNegociacao = false;

  for (const c of contracts) {
    const status = (c.status || "").toLowerCase();

    if (NEGOCIACAO_STATUSES.has(status)) {
      temNegociacao = true;
      continue;
    }

    if (status === "expiring") {
      hasExpiring = true;
      hasActive = true;
      continue;
    }

    if (!ACTIVE_STATUSES.has(status)) continue;

    hasActive = true;

    if (c.end_date) {
      try {
        const days = differenceInDays(parseISO(c.end_date), today);
        if (days >= 0 && days <= 30) hasExpiring = true;
      } catch {
        /* ignore parse errors */
      }
    }
  }

  if (hasExpiring) return "vencendo";
  if (hasActive) return "ativo";
  if (temNegociacao) return "em_negociacao";
  return "sem_contrato";
}

function getDaysUntilExpiry(contracts: ContractLike[] | undefined | null): number | null {
  if (!contracts) return null;
  const today = new Date();
  let menor: number | null = null;
  for (const c of contracts) {
    const status = (c.status || "").toLowerCase();
    if (!ACTIVE_STATUSES.has(status) && status !== "expiring") continue;
    if (!c.end_date) continue;
    try {
      const days = differenceInDays(parseISO(c.end_date), today);
      if (days >= 0 && days <= 30) {
        if (menor === null || days < menor) menor = days;
      }
    } catch { /* ignore */ }
  }
  return menor;
}

interface ContractStatusBadgeProps {
  contratos?: ContractLike[] | null;
  situacao?: ContractLifecycleState;
  className?: string;
  "data-testid"?: string;
}

export function ContractStatusBadge({
  contratos: contracts,
  situacao,
  className,
  ...rest
}: ContractStatusBadgeProps) {
  const resolved = situacao ?? getContractLifecycleState(contracts);

  let label: string;
  let variant: BadgeVariant;

  switch (resolved) {
    case "ativo":
      label = "Contrato ativo";
      variant = "success";
      break;
    case "vencendo": {
      const days = contracts ? getDaysUntilExpiry(contracts) : null;
      label = days !== null ? `Contrato vencendo em ${days} dia${days === 1 ? "" : "s"}` : "Contrato vencendo";
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
