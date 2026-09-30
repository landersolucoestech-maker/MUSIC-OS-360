import { Badge, type BadgeVariant } from "@/shared/ui/badge";
import { differenceInDays, parseISO } from "date-fns";
import type { MockRow } from "@/shared/types/database";

export type ContractLifecycleState = "active" | "expiring" | "no_contract" | "negotiating";

type ContractLike = MockRow & {
  status?: string | null;
  end_date?: string | null;
};

const ACTIVE_STATUSES = new Set(["active", "signed", "in_force"]);
// `contracts.status` is CHECK-restricted to the English ContractStatus values
// (migration 20260910000010), so the former PT-BR negotiation aliases can no longer occur.
const NEGOTIATION_STATUSES = new Set(["draft", "under_review"]);

export function getContractLifecycleState(contracts: ContractLike[] | undefined | null): ContractLifecycleState {
  if (!contracts || contracts.length === 0) return "no_contract";

  const today = new Date();
  let hasActive = false;
  let hasExpiring = false;
  let hasNegotiation = false;

  for (const c of contracts) {
    const status = (c.status || "").toLowerCase();

    if (NEGOTIATION_STATUSES.has(status)) {
      hasNegotiation = true;
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

  if (hasExpiring) return "expiring";
  if (hasActive) return "active";
  if (hasNegotiation) return "negotiating";
  return "no_contract";
}

function getDaysUntilExpiry(contracts: ContractLike[] | undefined | null): number | null {
  if (!contracts) return null;
  const today = new Date();
  let smallest: number | null = null;
  for (const c of contracts) {
    const status = (c.status || "").toLowerCase();
    if (!ACTIVE_STATUSES.has(status) && status !== "expiring") continue;
    if (!c.end_date) continue;
    try {
      const days = differenceInDays(parseISO(c.end_date), today);
      if (days >= 0 && days <= 30) {
        if (smallest === null || days < smallest) smallest = days;
      }
    } catch { /* ignore */ }
  }
  return smallest;
}

interface ContractStatusBadgeProps {
  contracts?: ContractLike[] | null;
  state?: ContractLifecycleState;
  className?: string;
  "data-testid"?: string;
}

export function ContractStatusBadge({
  contracts,
  state,
  className,
  ...rest
}: ContractStatusBadgeProps) {
  const resolved = state ?? getContractLifecycleState(contracts);

  let label: string;
  let variant: BadgeVariant;

  switch (resolved) {
    case "active":
      label = "Contrato ativo";
      variant = "success";
      break;
    case "expiring": {
      const days = contracts ? getDaysUntilExpiry(contracts) : null;
      label = days !== null ? `Contrato vencendo em ${days} dia${days === 1 ? "" : "s"}` : "Contrato vencendo";
      variant = "warning";
      break;
    }
    case "negotiating":
      label = "Em negociação";
      variant = "warning";
      break;
    case "no_contract":
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
