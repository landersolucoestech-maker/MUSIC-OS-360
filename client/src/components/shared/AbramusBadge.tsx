import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ShieldCheck } from "lucide-react";

interface AbramusBadgeProps {
  origem?: string | null;
  sincronizadoEm?: string | null;
  variant?: "default" | "compact";
  className?: string;
}

function formatSyncDate(value?: string | null): string {
  if (!value) return "Data desconhecida";
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return value;
  }
}

export function AbramusBadge({
  origem,
  sincronizadoEm,
  variant = "default",
  className,
}: AbramusBadgeProps) {
  if (origem !== "abramus") return null;

  const tooltipText = sincronizadoEm
    ? `Origem ABRAMUS — última sincronização em ${formatSyncDate(sincronizadoEm)}`
    : "Origem ABRAMUS — registro importado da ABRAMUS";

  const badge = (
    <Badge
      variant="outline"
      className={
        "gap-1 border-blue-400 text-blue-700 bg-blue-50 hover:bg-blue-100 dark:border-blue-500 dark:text-blue-300 dark:bg-blue-950/40 dark:hover:bg-blue-950/60 " +
        (variant === "compact" ? "px-1.5 py-0 text-[10px] " : "text-xs ") +
        (className ?? "")
      }
      data-testid="badge-origem-abramus"
    >
      <ShieldCheck className={variant === "compact" ? "h-3 w-3" : "h-3.5 w-3.5"} />
      ABRAMUS
    </Badge>
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className="inline-flex"
          data-testid="tooltip-origem-abramus-trigger"
        >
          {badge}
        </span>
      </TooltipTrigger>
      <TooltipContent>
        <span data-testid="text-origem-abramus-tooltip">{tooltipText}</span>
      </TooltipContent>
    </Tooltip>
  );
}
