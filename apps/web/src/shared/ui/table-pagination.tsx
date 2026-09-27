import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";

export interface TablePaginationProps {
  /** Total number of items (after filters). */
  total: number;
  /** Current page (0-based). */
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
  /** Plural label of the item, e.g. "produções", "contatos". */
  itemLabel?: string;
  className?: string;
}

/**
 * Standard system table pagination — functional and consistent across every page.
 */
export function TablePagination({
  total,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
  itemLabel = "itens",
  className,
}: TablePaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(page, totalPages - 1);
  const from = total === 0 ? 0 : current * pageSize + 1;
  const to = Math.min(total, (current + 1) * pageSize);

  const navBtn =
    "inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-card text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40";

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 text-xs text-muted-foreground",
        className,
      )}
    >
      <span>
        {from}–{to} de {total} {itemLabel}
      </span>

      <div className="flex items-center gap-4">
        {onPageSizeChange && (
          <div className="flex items-center gap-2">
            <span>Linhas por página:</span>
            <Select value={String(pageSize)} onValueChange={(v) => onPageSizeChange(Number(v))}>
              <SelectTrigger className="h-8 w-[72px] border-border bg-card text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pageSizeOptions.map((opt) => (
                  <SelectItem key={opt} value={String(opt)} className="text-xs">
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <span className="tabular-nums">
          Página {current + 1} de {totalPages}
        </span>

        <div className="flex items-center gap-1">
          <button
            type="button"
            className={navBtn}
            onClick={() => onPageChange(0)}
            disabled={current === 0}
            aria-label="Primeira página"
          >
            <ChevronsLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            className={navBtn}
            onClick={() => onPageChange(Math.max(0, current - 1))}
            disabled={current === 0}
            aria-label="Página anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            className={navBtn}
            onClick={() => onPageChange(Math.min(totalPages - 1, current + 1))}
            disabled={current >= totalPages - 1}
            aria-label="Próxima página"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            className={navBtn}
            onClick={() => onPageChange(totalPages - 1)}
            disabled={current >= totalPages - 1}
            aria-label="Última página"
          >
            <ChevronsRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
