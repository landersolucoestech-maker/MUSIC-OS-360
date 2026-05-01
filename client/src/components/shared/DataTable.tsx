import { useState, useMemo, ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Search, 
  ChevronLeft, 
  ChevronRight, 
  ChevronsLeft, 
  ChevronsRight,
  RefreshCw,
  MoreHorizontal 
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type Column<T> = {
  key: keyof T | string;
  label: string;
  render?: (item: T) => ReactNode;
  sortable?: boolean;
  className?: string;
};

export type Filter = {
  key: string;
  label: string;
  options: { value: string; label: string }[];
};

export type Action<T> = {
  label: string;
  icon?: ReactNode;
  onClick: (item: T) => void;
  variant?: "default" | "destructive";
};

type DataTableProps<T> = {
  data: T[];
  columns: Column<T>[];
  title?: string;
  description?: string;
  filters?: Filter[];
  actions?: Action<T>[];
  searchable?: boolean;
  searchPlaceholder?: string;
  selectable?: boolean;
  onSelectionChange?: (selectedIds: string[]) => void;
  isLoading?: boolean;
  emptyIcon?: ReactNode;
  emptyMessage?: string;
  emptyDescription?: string;
  pageSize?: number;
  onRefresh?: () => void;
  getId?: (item: T) => string;
};

export function DataTable<T extends Record<string, unknown>>({
  data,
  columns,
  title,
  description,
  filters = [],
  actions = [],
  searchable = true,
  searchPlaceholder = "Buscar...",
  selectable = false,
  onSelectionChange,
  isLoading = false,
  emptyIcon,
  emptyMessage = "Nenhum item encontrado",
  emptyDescription,
  pageSize = 10,
  onRefresh,
  getId = (item) => String(item.id),
}: DataTableProps<T>) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" } | null>(null);

  // Filter and search
  const filteredData = useMemo(() => {
    let result = [...data];

    // Apply search
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter((item) =>
        columns.some((col) => {
          const value = item[col.key as keyof T];
          return value && String(value).toLowerCase().includes(term);
        })
      );
    }

    // Apply filters
    Object.entries(filterValues).forEach(([key, value]) => {
      if (value && value !== "todos") {
        result = result.filter((item) => String(item[key as keyof T]) === value);
      }
    });

    // Apply sorting
    if (sortConfig) {
      result.sort((a, b) => {
        const aVal = a[sortConfig.key as keyof T];
        const bVal = b[sortConfig.key as keyof T];
        
        if (aVal === bVal) return 0;
        if (aVal === null || aVal === undefined) return 1;
        if (bVal === null || bVal === undefined) return -1;
        
        const comparison = aVal < bVal ? -1 : 1;
        return sortConfig.direction === "asc" ? comparison : -comparison;
      });
    }

    return result;
  }, [data, searchTerm, filterValues, columns, sortConfig]);

  // Pagination
  const totalPages = Math.ceil(filteredData.length / pageSize);
  const paginatedData = useMemo(() => {
    const start = currentPage * pageSize;
    return filteredData.slice(start, start + pageSize);
  }, [filteredData, currentPage, pageSize]);

  // Reset page when filters change
  useMemo(() => {
    setCurrentPage(0);
  }, [searchTerm, filterValues]);

  // Selection handlers
  const handleSelectAll = () => {
    if (selectedIds.length === paginatedData.length) {
      setSelectedIds([]);
      onSelectionChange?.([]);
    } else {
      const newIds = paginatedData.map(getId);
      setSelectedIds(newIds);
      onSelectionChange?.(newIds);
    }
  };

  const handleSelectItem = (id: string) => {
    const newIds = selectedIds.includes(id)
      ? selectedIds.filter((i) => i !== id)
      : [...selectedIds, id];
    setSelectedIds(newIds);
    onSelectionChange?.(newIds);
  };

  const handleSort = (key: string) => {
    setSortConfig((prev) => {
      if (prev?.key === key) {
        return prev.direction === "asc" 
          ? { key, direction: "desc" } 
          : null;
      }
      return { key, direction: "asc" };
    });
  };

  const clearFilters = () => {
    setSearchTerm("");
    setFilterValues({});
  };

  const hasActiveFilters = searchTerm !== "" || Object.values(filterValues).some(v => v && v !== "todos");

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 p-4 bg-muted/30 rounded-lg">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-8 w-20 rounded" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      {(title || description) && (
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              {title && <CardTitle className="text-lg">{title}</CardTitle>}
              {description && (
                <CardDescription>
                  {filteredData.length} {description}
                </CardDescription>
              )}
            </div>
            {onRefresh && (
              <Button variant="ghost" size="icon" onClick={onRefresh}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardHeader>
      )}

      <CardContent className="space-y-4">
        {/* Search and Filters */}
        {(searchable || filters.length > 0) && (
          <div className="flex flex-wrap items-center gap-3">
            {searchable && (
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={searchPlaceholder}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-card border-border"
                />
              </div>
            )}
            
            {filters.map((filter) => (
              <Select
                key={filter.key}
                value={filterValues[filter.key] || "todos"}
                onValueChange={(value) =>
                  setFilterValues((prev) => ({ ...prev, [filter.key]: value }))
                }
              >
                <SelectTrigger className="w-[160px] bg-card border-border">
                  <SelectValue placeholder={filter.label} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {filter.options.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ))}

            {hasActiveFilters && (
              <Button variant="outline" size="sm" onClick={clearFilters}>
                Limpar
              </Button>
            )}
          </div>
        )}

        {/* Select All (when selectable) */}
        {selectable && paginatedData.length > 0 && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Checkbox
              checked={selectedIds.length === paginatedData.length && paginatedData.length > 0}
              onCheckedChange={handleSelectAll}
            />
            <span>
              {selectedIds.length > 0 
                ? `${selectedIds.length} selecionado(s)` 
                : "Selecionar todos"}
            </span>
          </div>
        )}

        {/* Data List */}
        {paginatedData.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            {emptyIcon && <div className="mb-4 flex justify-center opacity-50">{emptyIcon}</div>}
            <p>{hasActiveFilters ? "Nenhum resultado para os filtros aplicados" : emptyMessage}</p>
            {emptyDescription && <p className="text-sm mt-2">{emptyDescription}</p>}
          </div>
        ) : (
          <div className="space-y-2">
            {paginatedData.map((item) => (
              <div
                key={getId(item)}
                className="flex items-center gap-4 p-4 bg-muted/30 rounded-lg border border-transparent hover:border-primary/20 transition-all duration-200"
              >
                {selectable && (
                  <Checkbox
                    checked={selectedIds.includes(getId(item))}
                    onCheckedChange={() => handleSelectItem(getId(item))}
                  />
                )}

                {columns.map((col) => (
                  <div key={String(col.key)} className={col.className || "flex-1"}>
                    {col.render 
                      ? col.render(item) 
                      : String(item[col.key as keyof T] ?? "-")}
                  </div>
                ))}

                {actions.length > 0 && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {actions.map((action) => (
                        <DropdownMenuItem
                          key={action.label}
                          onClick={() => action.onClick(item)}
                          className={action.variant === "destructive" ? "text-destructive" : ""}
                        >
                          {action.icon && <span className="mr-2">{action.icon}</span>}
                          {action.label}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-4 border-t">
            <span className="text-sm text-muted-foreground">
              Página {currentPage + 1} de {totalPages}
            </span>
            
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentPage(0)}
                disabled={currentPage === 0}
              >
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                disabled={currentPage === 0}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={currentPage === totalPages - 1}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentPage(totalPages - 1)}
                disabled={currentPage === totalPages - 1}
              >
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
