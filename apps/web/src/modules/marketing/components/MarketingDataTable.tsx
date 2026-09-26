/**
 * Generic, typed data table with loading skeletons and an empty slot.
 * Pages declare columns; rendering, hover and click behavior stay consistent.
 */

import { cn } from "@/shared/lib/utils";
import { ListSectionHeader } from "@/shared/components/ListSectionHeader";
import { SortableTableHead } from "@/shared/components/SortableTableHead";
import { isActionsColumn, nextTableSortState, sortTableRows, type TableSortState } from "@/shared/lib/table-sort";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/table";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { Skeleton } from "@/shared/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/ui/alert-dialog";
import { Trash2 } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

export interface Column<T> {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  sortValue?: (row: T) => unknown;
  sortable?: boolean;
  className?: string;
  headerClassName?: string;
}

interface MarketingDataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  isLoading?: boolean;
  empty?: ReactNode;
  title?: string;
  description?: string;
  /** Optional footer (e.g. pagination) rendered inside the white card. */
  footer?: React.ReactNode;
  selection?: {
    selectedIds: string[];
    onToggle: (id: string) => void;
    onToggleAll: (ids: string[]) => void;
    onBulkDelete?: (ids: string[]) => void;
  };
}

export function MarketingDataTable<T>({
  columns,
  rows,
  getRowKey,
  onRowClick,
  isLoading,
  empty,
  title,
  description,
  footer,
  selection,
}: MarketingDataTableProps<T>) {
  const [sortState, setSortState] = useState<TableSortState>(null);
  const [bulkDeleteIds, setBulkDeleteIds] = useState<string[]>([]);

  const sortedRows = useMemo(
    () =>
      sortTableRows(rows, sortState, (row, key) => {
        const column = columns.find((col) => col.key === key);
        if (column?.sortValue) return column.sortValue(row);
        return (row as Record<string, unknown>)[key];
      }),
    [columns, rows, sortState],
  );

  if (isLoading) {
    return (
      <div className="space-y-2 py-2" aria-busy="true" aria-label="Carregando">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-11 w-full" />
        ))}
      </div>
    );
  }

  if (rows.length === 0 && empty) {
    return <>{empty}</>;
  }

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      {title && description && (
        <ListSectionHeader
          title={title}
          count={rows.length}
          description={description}
          action={selection && rows.length > 0 ? (
            <div className="flex flex-wrap items-center justify-end gap-3">
              {selection.selectedIds.length > 0 && selection.onBulkDelete && (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="h-8 text-xs gap-1.5"
                  onClick={() => setBulkDeleteIds(rows.map(getRowKey).filter((id) => selection.selectedIds.includes(id)))}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Excluir selecionados
                </Button>
              )}
              <Checkbox
                checked={rows.length > 0 && rows.every((row) => selection.selectedIds.includes(getRowKey(row)))}
                onCheckedChange={() => selection.onToggleAll(rows.map(getRowKey))}
                aria-label="Selecionar todos"
              />
              <span className="text-xs text-muted-foreground">
                {selection.selectedIds.length > 0 ? `${rows.filter((row) => selection.selectedIds.includes(getRowKey(row))).length} selecionado(s)` : "Selecionar todos"}
              </span>
            </div>
          ) : undefined}
        />
      )}
      <Table>
        <TableHeader>
          <TableRow>
            {selection && <TableHead className="w-8"></TableHead>}
            {columns.map((col) => {
              const sortable = col.sortable ?? !isActionsColumn(col.header || col.key);

              return (
                <SortableTableHead
                  key={col.key}
                  sortKey={col.key}
                  sortState={sortState}
                  onSort={(key) => setSortState((current) => nextTableSortState(current, key))}
                  disabled={!sortable}
                  className={cn("text-xs", col.headerClassName)}
                  align={col.headerClassName?.includes("text-right") ? "right" : col.headerClassName?.includes("text-center") ? "center" : "left"}
                >
                  {col.header}
                </SortableTableHead>
              );
            })}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedRows.map((row) => (
            <TableRow
              key={getRowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={cn(onRowClick && "cursor-pointer")}
            >
              {selection && (
                <TableCell onClick={(event) => event.stopPropagation()}>
                  <Checkbox
                    checked={selection.selectedIds.includes(getRowKey(row))}
                    onCheckedChange={() => selection.onToggle(getRowKey(row))}
                    aria-label="Selecionar linha"
                  />
                </TableCell>
              )}
              {columns.map((col) => (
                <TableCell key={col.key} className={cn("text-sm", col.className)}>
                  {col.cell(row)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {footer}
      <AlertDialog open={bulkDeleteIds.length > 0} onOpenChange={(open) => !open && setBulkDeleteIds([])}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir selecionados?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acao remove {bulkDeleteIds.length} registro(s) selecionado(s). Deseja continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                selection?.onBulkDelete?.(bulkDeleteIds);
                setBulkDeleteIds([]);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
