import { ServerCrash, RotateCcw } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/lib/utils";

interface UnavailableStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}

/**
 * Explicit unavailability state — use when a query failed and
 * there is no valid cached data (`error && data.length === 0`).
 *
 * Distinct from <EmptyState/> on purpose: a genuinely empty table and a
 * backend that is down must not look the same to the user (see
 * Task F — "Nenhum registro"/"R$ 0,00" masking real unavailability).
 */
export function UnavailableState({
  title = "Não foi possível carregar os dados",
  description = "A API não respondeu. Verifique sua conexão e tente novamente.",
  onRetry,
  className,
}: UnavailableStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center py-16 text-center",
        className,
      )}
    >
      <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-5 mb-5">
        <ServerCrash className="h-7 w-7 text-destructive" />
      </div>
      <h3 className="text-sm font-semibold text-foreground mb-1.5">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-xs leading-relaxed mb-5">
        {description}
      </p>
      {onRetry && (
        <Button size="sm" variant="outline" onClick={onRetry}>
          <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
          Tentar novamente
        </Button>
      )}
    </div>
  );
}

/** Discreet banner for when there is valid cached data but the most
 * recent refresh failed — keeps the displayed data, only flags the problem. */
export function StaleDataNotice({ onRetry }: { onRetry?: () => void }) {
  return (
    <div
      role="status"
      className="flex items-center justify-between gap-3 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning-foreground"
    >
      <span className="flex items-center gap-1.5">
        <ServerCrash className="h-3.5 w-3.5 shrink-0" />
        Não foi possível atualizar — exibindo os últimos dados carregados.
      </span>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="shrink-0 font-medium underline underline-offset-2 hover:no-underline"
        >
          Tentar novamente
        </button>
      )}
    </div>
  );
}
