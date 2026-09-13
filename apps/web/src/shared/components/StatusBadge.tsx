import { Badge, type BadgeVariant } from "@/shared/ui/badge";
import { cn } from "@/shared/lib/utils";

/**
 * StatusBadge — resolver semântico sobre o componente único `Badge`.
 *
 * Converte um status (string de qualquer módulo) em um dos 5 variants canônicos
 * (success | info | warning | danger | neutral). Nenhuma cor é definida aqui —
 * toda a estilização vive no cva de `Badge`. Telas devem usar este componente
 * (ou `<Badge variant=...>`) em vez de classes de cor manuais.
 */

// ── Mapa semântico status → variant ─────────────────────────────────────────
// Quando o mesmo termo aparece em domínios diferentes, usamos o sentido mais
// comum; telas que precisem de outro variant passam `variant` explicitamente.
const SUCCESS = [
  "active", "ativo", "ativa", "executed", "executado", "executada",
  "registered", "registrado", "registrada", "concluido", "concluida",
  "aprovado", "aprovada", "cliente_ativo", "contratado", "exclusivo",
  "disponivel", "vigente", "assinado", "em_vigor", "publicado", "pago",
  "distribuido", "recorded", "finished", "delivered", "signed", "resolved",
  "conectado", "confirmed", "confirmado", "confirmada",
];
const INFO = [
  "em_andamento", "em_execucao", "processando", "proposal", "proposta",
  "parceiro", "a_receber", "recording", "editing", "post_production",
  "partially_signed", "open", "aberto", "in_progress",
  "aguardando_distribuicao", "aguardando_assinatura", "producao",
];
const WARNING = [
  "pending", "pendente", "metadata_pending", "assets_pending",
  "analysis", "em_analise", "analise", "negotiation", "negociacao",
  "em_negociacao", "in_negotiation", "em_revisao", "em_producao", "agendado", "agendada",
  "scheduled", "vencendo", "lead", "em_uso", "emprestado", "manutencao",
  "programado", "pausada", "pausado", "onboarding", "planejamento",
  "aguardando", "waiting_customer", "pending_signature",
  "ajustes_solicitados", "review", "revisao",
];
const DANGER = [
  "cancelled", "cancelado", "cancelada", "rejected", "rejeitado", "rejeitada",
  "reprovado", "expired", "expirado", "expirada", "vencido", "vencida",
  "rescindido", "rescindida", "inativo", "inactive", "atrasada", "atrasado", "danificado",
  "descartado", "falhou", "failed", "bloqueada", "desconectado",
];
const NEUTRAL = [
  "rascunho", "planejado", "draft", "independente", "encerrado", "fechado",
  "closed", "not_started", "archived", "arquivado", "backlog", "ideia",
  "sem_contrato",
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
  confirmed: "Confirmado", confirmado: "Confirmado", confirmada: "Confirmada",
  cancelled: "Cancelado", cancelado: "Cancelado", cancelada: "Cancelada",
  executed: "Executado", executado: "Executado", executada: "Executada",
  registered: "Registrado", registrado: "Registrado", registrada: "Registrada",
  analysis: "Em Análise", em_analise: "Em Análise", analise: "Em Análise",
  rejected: "Rejeitado", rejeitado: "Rejeitado", rejeitada: "Rejeitada",
  expired: "Expirado", expirado: "Expirado", expirada: "Expirada",
  vencido: "Vencido", vencida: "Vencida", vencendo: "Vencendo",
  negotiation: "Em Negociação", negociacao: "Em Negociação", em_negociacao: "Em Negociação", in_negotiation: "Em Negociação",
  proposal: "Proposta Enviada", proposta: "Proposta Enviada",
  lead: "Lead", cliente_ativo: "Cliente Ativo", inativo: "Inativo", inactive: "Inativo",
  contratado: "Contratado", signed: "Contratado", parceiro: "Parceiro", independente: "Independente", exclusivo: "Exclusivo",
  agendado: "Agendado", concluido: "Concluído", concluida: "Concluída",
  aprovado: "Aprovado", aprovada: "Aprovada",
  em_revisao: "Em Revisão", em_andamento: "Em Andamento", em_execucao: "Em Execução", em_producao: "Em Produção",
  atrasada: "Atrasada", rascunho: "Rascunho",
  disponivel: "Disponível", em_uso: "Em Uso", emprestado: "Emprestado",
  manutencao: "Em Manutenção", danificado: "Danificado", descartado: "Descartado",
  programado: "Programado", pausada: "Pausada",
  planejado: "Planejado", planejamento: "Planejamento", publicado: "Publicado",
  aguardando_distribuicao: "Aguardando Distribuição",
  aguardando_assinatura: "Aguardando Assinatura",
  rescindido: "Rescindido", rescindida: "Rescindida",
  vigente: "Vigente", assinado: "Assinado", em_vigor: "Em Vigor",
  pago: "Pago", a_receber: "A Receber", distribuido: "Distribuído",
  processando: "Processando", aguardando: "Aguardando", falhou: "Falhou",
  encerrado: "Encerrado",
};

function normalizeKey(status: string | null | undefined): string {
  return status?.toLowerCase().replace(/ /g, "_") || "";
}

/** Resolve um status (qualquer módulo) para um dos 5 variants canônicos. */
export function statusToVariant(status: string | null | undefined): BadgeVariant {
  return statusVariants[normalizeKey(status)] ?? "neutral";
}

/** Rótulo legível para um status conhecido (fallback: prettify do próprio valor). */
export function statusLabel(status: string | null | undefined): string {
  const key = normalizeKey(status);
  return (
    statusLabels[key] ||
    (status ?? "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

interface StatusBadgeProps {
  status: string;
  label?: string;
  /** Sobrescreve o variant resolvido (use quando o contexto exigir). */
  variant?: BadgeVariant;
  className?: string;
}

export function StatusBadge({ status, label, variant, className }: StatusBadgeProps) {
  const resolved = variant ?? statusToVariant(status);
  return (
    <Badge variant={resolved} className={className}>
      {label || statusLabel(status)}
    </Badge>
  );
}

// ─── Priority Badge ─────────────────────────────────────────────────────────

type PriorityType = "alta" | "media" | "baixa" | "high" | "medium" | "low" | "urgente" | "critical" | string;

interface PriorityBadgeProps {
  priority: PriorityType;
  label?: string;
  variant?: BadgeVariant;
  className?: string;
}

const priorityVariants: Record<string, BadgeVariant> = {
  critical: "danger", urgente: "danger",
  alta: "danger", high: "danger",
  media: "warning", medium: "warning",
  baixa: "success", low: "success",
};

const priorityLabels: Record<string, string> = {
  critical: "Crítica", urgente: "Urgente",
  alta: "Alta", high: "Alta",
  media: "Média", medium: "Média",
  baixa: "Baixa", low: "Baixa",
};

export function PriorityBadge({ priority, label, variant, className }: PriorityBadgeProps) {
  const key = priority?.toLowerCase() || "";
  const resolved = variant ?? priorityVariants[key] ?? "neutral";
  return (
    <Badge variant={resolved} className={className}>
      {label || priorityLabels[key] || priority}
    </Badge>
  );
}

// ─── Priority Indicator (dot) ────────────────────────────────────────────────

export function PriorityIndicator({ priority }: { priority: PriorityType }) {
  const key = priority?.toLowerCase() || "";
  const colors: Record<string, string> = {
    critical: "bg-red-500", urgente: "bg-red-500",
    alta: "bg-red-500", high: "bg-red-500",
    media: "bg-yellow-500", medium: "bg-yellow-500",
    baixa: "bg-green-500", low: "bg-green-500",
  };
  return (
    <span className={cn("w-1.5 h-1.5 rounded-full inline-block shrink-0", colors[key] || "bg-slate-400")} />
  );
}
