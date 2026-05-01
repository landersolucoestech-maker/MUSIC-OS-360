import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type StatusType = 
  | "active" | "ativo" | "ativa"
  | "pending" | "pendente" 
  | "confirmed" | "confirmado" | "confirmada"
  | "cancelled" | "cancelado" | "cancelada"
  | "executed" | "executado" | "executada"
  | "registered" | "registrado" | "registrada"
  | "analysis" | "em_analise" | "analise"
  | "rejected" | "rejeitado" | "rejeitada"
  | "expired" | "expirado" | "expirada" | "vencido" | "vencida"
  | "negotiation" | "negociacao" | "em_negociacao"
  | "proposal" | "proposta"
  | "lead" | "cliente_ativo" | "inativo"
  | "contratado" | "parceiro" | "independente"
  | "agendado" | "concluido" | "concluida"
  | "aprovado" | "aprovada"
  | "em_revisao" | "em_andamento" | "atrasada"
  | "rascunho" | "em_producao"
  | "disponivel" | "em_uso" | "emprestado" | "manutencao" | "danificado" | "descartado"
  | "pausada"
  | string;

interface StatusBadgeProps {
  status: StatusType;
  label?: string;
  className?: string;
}

const statusStyles: Record<string, string> = {
  // Success states (green)
  active: "bg-status-active text-primary-foreground",
  ativo: "bg-status-active text-primary-foreground",
  ativa: "bg-status-active text-primary-foreground",
  executed: "bg-status-executed text-primary-foreground",
  executado: "bg-status-executed text-primary-foreground",
  executada: "bg-status-executed text-primary-foreground",
  registered: "bg-status-registered text-primary-foreground",
  registrado: "bg-status-registered text-primary-foreground",
  registrada: "bg-status-registered text-primary-foreground",
  concluido: "bg-status-active text-primary-foreground",
  concluida: "bg-status-active text-primary-foreground",
  aprovado: "bg-status-active text-primary-foreground",
  aprovada: "bg-status-active text-primary-foreground",
  cliente_ativo: "bg-status-active text-primary-foreground",
  contratado: "bg-status-active text-primary-foreground",
  disponivel: "bg-status-active text-primary-foreground",
  
  // Warning states (amber/yellow)
  pending: "bg-status-pending text-primary-foreground",
  pendente: "bg-status-pending text-primary-foreground",
  analysis: "bg-status-analysis text-primary-foreground",
  em_analise: "bg-status-analysis text-primary-foreground",
  analise: "bg-status-analysis text-primary-foreground",
  negotiation: "bg-status-negotiation text-primary-foreground",
  negociacao: "bg-status-negotiation text-primary-foreground",
  em_negociacao: "bg-status-negotiation text-primary-foreground",
  em_revisao: "bg-status-pending text-primary-foreground",
  em_andamento: "bg-status-pending text-primary-foreground",
  em_producao: "bg-status-pending text-primary-foreground",
  agendado: "bg-status-pending text-primary-foreground",
  vencendo: "bg-status-pending text-primary-foreground",
  lead: "bg-status-pending text-primary-foreground",
  parceiro: "bg-status-pending text-primary-foreground",
  em_uso: "bg-status-pending text-primary-foreground",
  emprestado: "bg-status-pending text-primary-foreground",
  manutencao: "bg-status-pending text-primary-foreground",
  programado: "bg-status-pending text-primary-foreground",
  pausada: "bg-status-pending text-primary-foreground",
  
  // Info states (blue)
  confirmed: "bg-status-confirmed text-primary-foreground",
  confirmado: "bg-status-confirmed text-primary-foreground",
  confirmada: "bg-status-confirmed text-primary-foreground",
  proposal: "bg-status-proposal text-primary-foreground",
  proposta: "bg-status-proposal text-primary-foreground",
  independente: "bg-status-confirmed text-primary-foreground",
  
  // Error/Danger states (red)
  cancelled: "bg-status-cancelled text-primary-foreground",
  cancelado: "bg-status-cancelled text-primary-foreground",
  cancelada: "bg-status-cancelled text-primary-foreground",
  rejected: "bg-status-rejected text-primary-foreground",
  rejeitado: "bg-status-rejected text-primary-foreground",
  rejeitada: "bg-status-rejected text-primary-foreground",
  expired: "bg-status-expired text-primary-foreground",
  expirado: "bg-status-expired text-primary-foreground",
  expirada: "bg-status-expired text-primary-foreground",
  vencido: "bg-status-expired text-primary-foreground",
  vencida: "bg-status-expired text-primary-foreground",
  inativo: "bg-status-cancelled text-primary-foreground",
  atrasada: "bg-status-cancelled text-primary-foreground",
  danificado: "bg-status-cancelled text-primary-foreground",
  descartado: "bg-status-cancelled text-primary-foreground",
  
  // Neutral states
  rascunho: "bg-muted text-muted-foreground",
};

const statusLabels: Record<string, string> = {
  active: "Ativo",
  ativo: "Ativo",
  ativa: "Ativa",
  pending: "Pendente",
  pendente: "Pendente",
  confirmed: "Confirmado",
  confirmado: "Confirmado",
  confirmada: "Confirmada",
  cancelled: "Cancelado",
  cancelado: "Cancelado",
  cancelada: "Cancelada",
  executed: "Executado",
  executado: "Executado",
  executada: "Executada",
  registered: "Registrado",
  registrado: "Registrado",
  registrada: "Registrada",
  analysis: "Em Análise",
  em_analise: "Em Análise",
  analise: "Em Análise",
  rejected: "Rejeitado",
  rejeitado: "Rejeitado",
  rejeitada: "Rejeitada",
  expired: "Expirado",
  expirado: "Expirado",
  expirada: "Expirada",
  vencido: "Vencido",
  vencida: "Vencida",
  vencendo: "Vencendo",
  negotiation: "Em Negociação",
  negociacao: "Em Negociação",
  em_negociacao: "Em Negociação",
  proposal: "Proposta Enviada",
  proposta: "Proposta Enviada",
  lead: "Lead",
  cliente_ativo: "Cliente Ativo",
  inativo: "Inativo",
  contratado: "Contratado",
  parceiro: "Parceiro",
  independente: "Independente",
  agendado: "Agendado",
  concluido: "Concluído",
  concluida: "Concluída",
  aprovado: "Aprovado",
  aprovada: "Aprovada",
  em_revisao: "Em Revisão",
  em_andamento: "Em Andamento",
  em_producao: "Em Produção",
  atrasada: "Atrasada",
  rascunho: "Rascunho",
  disponivel: "Disponível",
  em_uso: "Em Uso",
  emprestado: "Emprestado",
  manutencao: "Em Manutenção",
  danificado: "Danificado",
  descartado: "Descartado",
  programado: "Programado",
  pausada: "Pausada",
};

export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  const normalizedStatus = status?.toLowerCase().replace(/ /g, "_") || "";
  const style = statusStyles[normalizedStatus] || "bg-muted text-muted-foreground";
  const displayLabel = label || statusLabels[normalizedStatus] || status;

  return (
    <Badge className={cn(style, "hover:opacity-90", className)}>
      {displayLabel}
    </Badge>
  );
}

// Priority Badge Component
type PriorityType = "alta" | "media" | "baixa" | "high" | "medium" | "low" | string;

interface PriorityBadgeProps {
  priority: PriorityType;
  label?: string;
  className?: string;
}

const priorityStyles: Record<string, string> = {
  alta: "bg-priority-high text-primary-foreground",
  high: "bg-priority-high text-primary-foreground",
  media: "bg-priority-medium text-primary-foreground",
  medium: "bg-priority-medium text-primary-foreground",
  baixa: "bg-priority-low text-primary-foreground",
  low: "bg-priority-low text-primary-foreground",
};

const priorityLabels: Record<string, string> = {
  alta: "Alta",
  high: "Alta",
  media: "Média",
  medium: "Média",
  baixa: "Baixa",
  low: "Baixa",
};

export function PriorityBadge({ priority, label, className }: PriorityBadgeProps) {
  const normalizedPriority = priority?.toLowerCase() || "";
  const style = priorityStyles[normalizedPriority] || "bg-muted text-muted-foreground";
  const displayLabel = label || priorityLabels[normalizedPriority] || priority;

  return (
    <Badge className={cn(style, "hover:opacity-90", className)}>
      {displayLabel}
    </Badge>
  );
}

// Priority Indicator (small dot)
export function PriorityIndicator({ priority }: { priority: PriorityType }) {
  const normalizedPriority = priority?.toLowerCase() || "";
  const colors: Record<string, string> = {
    alta: "bg-priority-high",
    high: "bg-priority-high",
    media: "bg-priority-medium",
    medium: "bg-priority-medium",
    baixa: "bg-priority-low",
    low: "bg-priority-low",
  };
  
  return (
    <span className={cn("w-2 h-2 rounded-full inline-block", colors[normalizedPriority] || "bg-muted")} />
  );
}
