import { Badge, type BadgeVariant } from "@/shared/ui/badge";
import { cn } from "@/shared/lib/utils";
import { STATUS_LABELS_PT_BR_BY_DOMAIN, statusLabelPtBr, type StatusDomain } from "@music-os-360/types";

/**
 * StatusBadge — semantic resolver over the single `Badge` component.
 *
 * Converts a status (a string from any module) into one of the 5 canonical variants
 * (success | info | warning | danger | neutral). No color is defined here —
 * all styling lives in the `Badge` cva. Screens must use this component
 * (or `<Badge variant=...>`) instead of manual color classes.
 */

// ── Semantic map status → variant ───────────────────────────────────────────
// When the same term appears in different domains, we use the most
// common meaning; screens that need another variant pass `variant` explicitly.
const SUCCESS = [
  "active", "ativo", "ativa", "executed", "registered", "concluido", "aprovado",
  "publicado", "pago",
  "recorded", "finished", "delivered", "signed", "resolved",
  "conectado", "confirmed", "available",
];
const INFO = [
  "em_andamento", "proposal", "recording", "editing", "post_production",
  "partially_signed", "open", "in_progress",
  "producao", "reserved",
];
const WARNING = [
  "pending", "pendente", "metadata_pending", "assets_pending",
  "analysis", "negotiation", "in_negotiation", "agendado", "agendada",
  "scheduled", "lead", "pausado", "onboarding", "planejamento",
  "waiting_customer", "pending_signature",
  "review", "revisao", "in_use", "on_loan", "maintenance",
];
const DANGER = [
  "cancelled", "cancelado", "rejected", "rejeitado", "expired", "inativo",
  "inactive", "atrasado", "failed", "damaged", "discarded",
];
const NEUTRAL = [
  "rascunho", "draft", "closed", "not_started", "archived", "arquivado", "backlog",
];

function buildMap(list: string[], variant: BadgeVariant): Record<string, BadgeVariant> {
  return Object.fromEntries(list.map((k) => [k, variant]));
}

const statusVariants: Record<string, BadgeVariant> = {
  ...buildMap(SUCCESS, "success"),
  ...buildMap(INFO, "info"),
  ...buildMap(WARNING, "warning"),
  ...buildMap(DANGER, "danger"),
  ...buildMap(NEUTRAL, "neutral"),
};

const statusLabels: Record<string, string> = {
  active: "Ativo", ativo: "Ativo", ativa: "Ativa",
  pending: "Pendente", pendente: "Pendente", metadata_pending: "Pendente", assets_pending: "Pendente",
  confirmed: "Confirmado", cancelled: "Cancelado", cancelado: "Cancelado",
  executed: "Executado", registered: "Registrado", analysis: "Em Análise",
  rejected: "Rejeitado", rejeitado: "Rejeitado", expired: "Expirado",
  negotiation: "Em Negociação", in_negotiation: "Em Negociação",
  proposal: "Proposta Enviada", lead: "Lead", inativo: "Inativo", inactive: "Inativo",
  signed: "Contratado",
  agendado: "Agendado", concluido: "Concluído", aprovado: "Aprovado", em_andamento: "Em Andamento", rascunho: "Rascunho",
  planejamento: "Planejamento", publicado: "Publicado",
  pago: "Pago",
};

/**
 * Canonical (English) status values of every shared enum → PT-BR label, for
 * callers that do not pass a domain. Domain-specific wording wins when a
 * `domain` is given; the legacy/PT keys above keep precedence here.
 */
const canonicalStatusLabels: Record<string, string> = Object.values(STATUS_LABELS_PT_BR_BY_DOMAIN).reduce<Record<string, string>>(
  (acc, labels) => {
    for (const [value, label] of Object.entries(labels)) acc[value] ??= label;
    return acc;
  },
  {},
);

/** Copy for a status value that no map knows — never the raw technical value. */
export const UNKNOWN_STATUS_LABEL = "Status não reconhecido";

function normalizeKey(status: string | null | undefined): string {
  return status?.toLowerCase().replace(/ /g, "_") || "";
}

/** Resolves a status (any module) to one of the 5 canonical variants. */
export function statusToVariant(status: string | null | undefined): BadgeVariant {
  return statusVariants[normalizeKey(status)] ?? "neutral";
}

/**
 * PT-BR label of a status. With a `domain`, the canonical label of that enum
 * is used; otherwise the legacy map, then any canonical label. An unknown
 * value never reaches the UI raw (no English "Under Review" prettifying).
 */
export function statusLabel(status: string | null | undefined, domain?: StatusDomain): string {
  if (!status) return "—";
  const key = normalizeKey(status);
  return (
    (domain ? statusLabelPtBr(domain, key) : null) ??
    statusLabels[key] ??
    canonicalStatusLabels[key] ??
    UNKNOWN_STATUS_LABEL
  );
}

interface StatusBadgeProps {
  status: string;
  label?: string;
  /** Status enum the value belongs to (exact PT-BR wording, e.g. contract "signed" = "Assinado"). */
  domain?: StatusDomain;
  /** Overrides the resolved variant (use when the context requires it). */
  variant?: BadgeVariant;
  className?: string;
}

export function StatusBadge({ status, label, domain, variant, className }: StatusBadgeProps) {
  const resolved = variant ?? statusToVariant(status);
  return (
    <Badge variant={resolved} className={className}>
      {label || statusLabel(status, domain)}
    </Badge>
  );
}

// ─── Priority Badge ─────────────────────────────────────────────────────────

type PriorityType = "high" | "medium" | "low" | "normal" | "urgent" | "critical" | string;

interface PriorityBadgeProps {
  priority: PriorityType;
  label?: string;
  variant?: BadgeVariant;
  className?: string;
}

const priorityVariants: Record<string, BadgeVariant> = {
  critical: "danger", urgent: "danger",
  high: "danger",
  medium: "warning", normal: "warning",
  low: "success",
};

const priorityLabels: Record<string, string> = {
  critical: "Crítica", urgent: "Urgente",
  high: "Alta",
  medium: "Média", normal: "Normal",
  low: "Baixa",
};

export function PriorityBadge({ priority, label, variant, className }: PriorityBadgeProps) {
  const key = priority?.toLowerCase() || "";
  const resolved = variant ?? priorityVariants[key] ?? "neutral";
  return (
    <Badge variant={resolved} className={className}>
      {label || priorityLabels[key] || "Prioridade não reconhecida"}
    </Badge>
  );
}

// ─── Priority Indicator (dot) ────────────────────────────────────────────────

export function PriorityIndicator({ priority }: { priority: PriorityType }) {
  const key = priority?.toLowerCase() || "";
  const colors: Record<string, string> = {
    critical: "bg-red-500", urgent: "bg-red-500",
    high: "bg-red-500",
    medium: "bg-yellow-500", normal: "bg-yellow-500",
    low: "bg-green-500",
  };
  return (
    <span className={cn("w-1.5 h-1.5 rounded-full inline-block shrink-0", colors[key] || "bg-slate-400")} />
  );
}
