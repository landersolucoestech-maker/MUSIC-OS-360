import * as React from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { compareTableValues, isActionsColumn, type TableSortDirection } from "@/shared/lib/table-sort";

type TableSortContextValue = {
  index: number | null;
  direction: TableSortDirection | null;
  setSort: (index: number) => void;
};

const TableSortContext = React.createContext<TableSortContextValue | null>(null);

function isArtistPage() {
  return typeof window !== "undefined" && window.location.pathname.includes("/artists");
}

function getNodeText(node: React.ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(getNodeText).join(" ");
  if (React.isValidElement<{ children?: React.ReactNode }>(node)) {
    return getNodeText(node.props.children);
  }
  return "";
}

function getCellText(row: React.ReactNode, index: number): string {
  if (!React.isValidElement<{ children?: React.ReactNode }>(row)) return "";
  const cells = React.Children.toArray(row.props.children);
  return getNodeText(cells[index]).trim();
}

function hasInteractiveSortControl(node: React.ReactNode): boolean {
  if (node === null || node === undefined || typeof node === "boolean") return false;
  if (typeof node === "string" || typeof node === "number") return false;
  if (Array.isArray(node)) return node.some(hasInteractiveSortControl);
  if (React.isValidElement<{ children?: React.ReactNode }>(node)) {
    if (typeof node.type === "string" && ["button", "input", "select", "textarea"].includes(node.type)) return true;
    if (node.props && typeof node.props === "object") {
      const props = node.props as Record<string, unknown>;
      if (props.role === "button" || props.role === "checkbox" || props["data-no-sort"] === "true") return true;
    }
    return hasInteractiveSortControl(node.props.children);
  }
  return false;
}

const tableHeadClassName = cn(
  "h-9 px-4 text-left align-middle",
  "font-sans text-xs font-medium leading-4 tracking-normal text-muted-foreground",
  "whitespace-nowrap",
  "first:pl-4 last:pr-4",
  "[&:has([role=checkbox])]:pr-2",
);

const tableCellClassName = cn(
  "px-4 py-2.5 align-middle",
  "font-sans text-sm font-normal leading-5 tracking-normal",
  "first:pl-4 last:pr-4",
  "[&:has([role=checkbox])]:pr-2",
  "[&_.inline-flex]:align-middle",
);

const Table = React.forwardRef<HTMLTableElement, React.HTMLAttributes<HTMLTableElement>>(
  ({ className, ...props }, ref) => {
    const [sort, setSortState] = React.useState<{ index: number; direction: TableSortDirection } | null>(null);
    const contextValue = React.useMemo<TableSortContextValue>(
      () => ({
        index: sort?.index ?? null,
        direction: sort?.direction ?? null,
        setSort: (index) => {
          setSortState((current) => {
            if (current?.index === index) {
              return { index, direction: current.direction === "asc" ? "desc" : "asc" };
            }
            return { index, direction: "asc" };
          });
        },
      }),
      [sort],
    );

    return (
      <TableSortContext.Provider value={contextValue}>
        <div className="relative w-full overflow-auto">
          <table
            ref={ref}
            data-shared-table="true"
            className={cn(
              "w-full caption-bottom border-separate border-spacing-0 text-sm",
              "font-sans",
              "[&_td]:tabular-nums [&_th]:whitespace-nowrap",
              "[&_td>*]:align-middle [&_th>*]:align-middle",
              className,
            )}
            {...props}
          />
        </div>
      </TableSortContext.Provider>
    );
  },
);
Table.displayName = "Table";

const TableHeader = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <thead ref={ref} className={cn("[&_tr]:border-b [&_tr]:border-border/60", className)} {...props} />
  ),
);
TableHeader.displayName = "TableHeader";

const TableBody = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, children, ...props }, ref) => {
    const sortContext = React.useContext(TableSortContext);
    const sortedChildren = React.useMemo(() => {
      if (!sortContext?.direction || sortContext.index === null || isArtistPage()) return children;
      const direction = sortContext.direction === "asc" ? 1 : -1;
      return React.Children.toArray(children).sort((a, b) => (
        compareTableValues(getCellText(a, sortContext.index as number), getCellText(b, sortContext.index as number)) * direction
      ));
    }, [children, sortContext?.direction, sortContext?.index]);

    return (
      <tbody ref={ref} className={cn("[&_tr:last-child]:border-0", className)} {...props}>
        {sortedChildren}
      </tbody>
    );
  },
);
TableBody.displayName = "TableBody";

const TableFooter = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <tfoot
      ref={ref}
      className={cn(
        "border-t border-border/60 bg-muted/30 font-medium [&>tr]:last:border-b-0",
        className,
      )}
      {...props}
    />
  ),
);
TableFooter.displayName = "TableFooter";

const TableRow = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(
  ({ className, ...props }, ref) => (
    <tr
      ref={ref}
      className={cn(
        "border-b border-border/50 transition-colors duration-100",
        "data-[state=selected]:bg-muted/60",
        "hover:bg-muted/40",
        className,
      )}
      {...props}
    />
  ),
);
TableRow.displayName = "TableRow";

const TableHead = React.forwardRef<HTMLTableCellElement, React.ThHTMLAttributes<HTMLTableCellElement>>(
  ({ className, children, onClick, ...props }, forwardedRef) => {
    const localRef = React.useRef<HTMLTableCellElement | null>(null);
    const sortContext = React.useContext(TableSortContext);
    const label = getNodeText(children).trim();
    const noSort = (props as Record<string, unknown>)["data-no-sort"] === "true";
    const sortable = Boolean(label) && !isActionsColumn(label) && !isArtistPage() && !noSort && !hasInteractiveSortControl(children);
    const active = sortable && sortContext?.index === localRef.current?.cellIndex;
    const direction = active ? sortContext?.direction : null;
    const Icon = direction === "asc" ? ArrowUp : direction === "desc" ? ArrowDown : ArrowUpDown;

    const setRefs = React.useCallback((node: HTMLTableCellElement | null) => {
      localRef.current = node;
      if (typeof forwardedRef === "function") forwardedRef(node);
      else if (forwardedRef) forwardedRef.current = node;
    }, [forwardedRef]);

    if (!sortable) {
      return (
        <th
          ref={setRefs}
          className={cn(tableHeadClassName, className)}
          onClick={onClick}
          {...props}
        >
          {children}
        </th>
      );
    }

    const align = className?.toString().includes("text-right")
      ? "right"
      : className?.toString().includes("text-center")
      ? "center"
      : "left";

    return (
      <th
        ref={setRefs}
        className={cn(tableHeadClassName, className)}
        aria-sort={direction ? (direction === "asc" ? "ascending" : "descending") : "none"}
        {...props}
      >
        <button
          type="button"
          className={cn(
            "inline-flex max-w-full items-center gap-1.5 rounded-sm text-left font-sans text-xs font-medium leading-4 tracking-normal transition-colors",
            "hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            active && "text-foreground",
            align === "center" && "mx-auto justify-center text-center",
            align === "right" && "ml-auto justify-end text-right",
          )}
          onClick={(event) => {
            onClick?.(event as unknown as React.MouseEvent<HTMLTableCellElement>);
            sortContext?.setSort(localRef.current?.cellIndex ?? 0);
          }}
          title={direction === "asc" ? "Ordenação crescente" : direction === "desc" ? "Ordenação decrescente" : "Ordenar coluna"}
        >
          <span className="truncate">{children}</span>
          <Icon className={cn("h-3.5 w-3.5 shrink-0", active ? "opacity-100" : "opacity-55")} />
        </button>
      </th>
    );
  },
);
TableHead.displayName = "TableHead";

const TableCell = React.forwardRef<HTMLTableCellElement, React.TdHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => (
    <td
      ref={ref}
      className={cn(tableCellClassName, className)}
      {...props}
    />
  ),
);
TableCell.displayName = "TableCell";

const TableCaption = React.forwardRef<HTMLTableCaptionElement, React.HTMLAttributes<HTMLTableCaptionElement>>(
  ({ className, ...props }, ref) => (
    <caption
      ref={ref}
      className={cn("mt-4 text-xs text-muted-foreground", className)}
      {...props}
    />
  ),
);
TableCaption.displayName = "TableCaption";

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
  tableHeadClassName,
  tableCellClassName,
};
