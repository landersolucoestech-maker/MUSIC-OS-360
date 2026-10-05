import { Badge, type BadgeVariant } from "@/shared/ui/badge";
import { cn } from "@/shared/lib/utils";

// `kind` is accepted for call-site readability (capture/editing/approval/final)
// but does not change rendering — the label/variant map is keyed by `value`.
type Props = { value?: string | null; kind?: string; className?: string };

const labels: Record<string, string> = {
  recorded: "Gravada", recording: "Em Gravação", scheduled: "Agendada", pending: "Pendente",
  editing: "Em Edição", finished: "Finalizada", not_started: "Não Iniciada",
  review: "Em Revisão", approved: "Aprovado", rejected: "Reprovado", revision_requested: "Revisão solicitada",
  planned: "Planejado", production: "Em Produção", published: "Publicado", archived: "Arquivado",
  delivered: "Finalizado", draft: "Planejado", post_production: "Em Edição", approval: "Em Revisão",
};

const variants: Record<string, BadgeVariant> = {
  recorded: "success", finished: "success", approved: "success", published: "success", delivered: "success",
  editing: "info", post_production: "info", recording: "info", production: "info",
  scheduled: "warning", pending: "warning", review: "warning", revision_requested: "warning", approval: "warning",
  not_started: "neutral", planned: "neutral", draft: "neutral", archived: "neutral",
  rejected: "danger", cancelled: "danger",
};

export function audiovisualStatusLabel(value?: string | null) {
  if (!value) return "—";
  return labels[value] ?? value;
}

export function AudiovisualStatusBadge({ value, className }: Props) {
  const variant = value ? variants[value] ?? "neutral" : "neutral";
  return (
    <Badge variant={variant} className={cn("inline-flex min-w-[90px] justify-center whitespace-nowrap", className)}>
      {audiovisualStatusLabel(value)}
    </Badge>
  );
}
