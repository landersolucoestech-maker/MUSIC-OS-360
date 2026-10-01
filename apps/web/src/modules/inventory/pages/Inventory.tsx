import { useEffect, useState } from "react";
import { runBulkAction, reportBulkResult } from "@/shared/hooks/useBulkAction";
import { MainLayout } from "@/shared/components/MainLayout";
import { MetricCard } from "@/shared/components/MetricCard";
import { ListSectionHeader } from "@/shared/components/ListSectionHeader";
import { TablePagination } from "@/shared/ui/table-pagination";
import { Card, CardContent } from "@/shared/ui/card";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Package, Wrench, CheckCircle, Plus, Search, Monitor, Loader2, MoreHorizontal, Eye, Pencil, Trash2, MapPin, User, DollarSign } from "lucide-react";
import { formatCurrency, formatDate, getMonetarySemanticClass } from "@/shared/lib/format-utils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/shared/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { Checkbox } from "@/shared/ui/checkbox";
import { InventoryFormModal } from "@/modules/inventory/components/InventoryFormModal";
import { InventoryViewModal } from "@/modules/inventory/components/InventoryViewModal";
import { DeleteConfirmModal } from "@/shared/components/DeleteConfirmModal";
import { RequirePermission } from "@/shared/components/RequirePermission";
import { EmptyState } from "@/shared/components/EmptyState";
import { UnavailableState } from "@/shared/components/UnavailableState";
import { useInventory } from "@/modules/inventory/hooks/useInventory";
import { useInventoryPaginated, useInventoryStats } from "@/modules/inventory/hooks/useInventoryPaginated";
import { useDebounce } from "@/shared/hooks/useDebounce";
import { StatusBadge } from "@/shared/components/StatusBadge";
import { InventoryStatus } from "@music-os-360/types";
import { INVENTORY_CATEGORY_OPTIONS } from "@/modules/inventory/constants";
import { FeatureGate } from '@/shared/components/FeatureGate';

// Location dropdown → the storage_location values stored in the database.
// Same translation that existed in the client-side .filter() before the migration.
const LOCAL_FILTER_MAP: Record<string, string> = {
  studio1: "Estúdio 1",
  studio2: "Estúdio 2",
  office: "Escritório",
  stock: "Estoque",
};

export default function Inventory() {
  const { isLoading, deleteInventoryItem, addInventoryItem } = useInventory();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const toggleSelectAll = () => {
    if (selectedIds.length === pageItems.length && pageItems.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(pageItems.map((i: any) => i.id));
    }
  };
  const toggleSelect = (id: string) => setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    const ids = selectedIds;
    setSelectedIds([]);
    const result = await runBulkAction(ids, (id) => deleteInventoryItem.mutateAsync(id));
    reportBulkResult(result, "excluído", "item");
  };
  const [formModal, setFormModal] = useState<{ open: boolean; mode: "create" | "edit"; item?: any }>({ open: false, mode: "create" });
  const [viewModal, setViewModal] = useState<{ open: boolean; item?: any }>({ open: false });
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; item?: any }>({ open: false });
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all-category");
  const [statusFilter, setStatusFilter] = useState("all-status");
  const [localFilter, setLocalFilter] = useState("all-local");
  const debouncedSearch = useDebounce(searchTerm, 300);

  const hasActiveFilters = searchTerm !== "" || categoryFilter !== "all-category" || statusFilter !== "all-status" || localFilter !== "all-local";

  // Task H: real server-side pagination — the page changes the request (it never
  // slices an already-downloaded list), and goes back to page 0 when a filter changes.
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  useEffect(() => { setPage(0); }, [debouncedSearch, categoryFilter, statusFilter, localFilter]);

  const {
    items: pageItems,
    total,
    isLoading: isLoadingPage,
    error: pageError,
    refetch: refetchPage,
  } = useInventoryPaginated({
    page,
    pageSize,
    search: debouncedSearch || undefined,
    status: statusFilter !== "all-status" ? statusFilter : undefined,
    category: categoryFilter !== "all-category" ? categoryFilter : undefined,
    storageLocation: localFilter !== "all-local" ? LOCAL_FILTER_MAP[localFilter] : undefined,
  });

  // KPIs: count per status + asset value sum OVER THE WHOLE
  // TENANT (not the current page) — GET /inventory/stats, aggregated in the database.
  const { stats: inventoryStats } = useInventoryStats();

  const handleClearFilters = () => {
    setSearchTerm("");
    setCategoryFilter("all-category");
    setStatusFilter("all-status");
    setLocalFilter("all-local");
  };

  const handleDelete = () => {
    if (deleteModal.item) {
      deleteInventoryItem.mutate(deleteModal.item.id);
      setDeleteModal({ open: false });
    }
  };

  const metrics = {
    total: inventoryStats.total,
    inUse: inventoryStats.byGroup[InventoryStatus.IN_USE] ?? 0,
    available: inventoryStats.byGroup[InventoryStatus.AVAILABLE] ?? 0,
    inMaintenance: inventoryStats.byGroup[InventoryStatus.MAINTENANCE] ?? 0,
    totalValue: inventoryStats.totalSum ?? 0,
  };

  const headerActions = (
    <RequirePermission module="inventory" action="write">
      <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setFormModal({ open: true, mode: "create" })}><Plus className="h-3.5 w-3.5" />Novo Item</Button>
    </RequirePermission>
  );

  return (
    <FeatureGate feature="moduleInventory" featureName="Estoque & Inventário">
    <>
    {isLoading || isLoadingPage ? (
      <MainLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </MainLayout>
    ) : (
    <MainLayout title="Inventário" description="Controle de equipamentos e patrimônio" actions={headerActions}>
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <MetricCard title="Total de Itens" value={metrics.total} description="equipamentos cadastrados" icon={Package} accent="primary" />
          <MetricCard title="Em Uso" value={metrics.inUse} description="em operação" icon={Package} accent="primary" />
          <MetricCard title="Em Manutenção" value={metrics.inMaintenance} description="equipamentos" icon={Wrench} accent="warning" />
          <MetricCard title="Disponíveis" value={metrics.available} description="prontos para uso" icon={CheckCircle} accent="success" />
          <MetricCard title="Valor Total" value={formatCurrency(metrics.totalValue)} description="patrimônio total" icon={DollarSign} accent="primary" />
        </div>

        <div className="flex items-center gap-4 rounded-lg bg-muted/30 p-3">
          <div className="relative flex-1"><Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Buscar equipamentos por nome, categoria ou local..." className="pl-10 h-8 text-sm bg-card border-border" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}><SelectTrigger className="w-auto min-w-[140px] h-8 text-sm bg-card border-border"><SelectValue placeholder="Todos Categoria" /></SelectTrigger><SelectContent><SelectItem value="all-category">Todos Categoria</SelectItem>{INVENTORY_CATEGORY_OPTIONS.map((category) => <SelectItem key={category} value={category}>{category}</SelectItem>)}</SelectContent></Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-auto min-w-[140px] h-8 text-sm bg-card border-border"><SelectValue placeholder="Todos Status" /></SelectTrigger><SelectContent><SelectItem value="all-status">Todos Status</SelectItem><SelectItem value={InventoryStatus.IN_USE}>Em Uso</SelectItem><SelectItem value={InventoryStatus.AVAILABLE}>Disponível</SelectItem><SelectItem value={InventoryStatus.MAINTENANCE}>Manutenção</SelectItem></SelectContent></Select>
          <Select value={localFilter} onValueChange={setLocalFilter}><SelectTrigger className="w-auto min-w-[140px] h-8 text-sm bg-card border-border"><SelectValue placeholder="Todos Local" /></SelectTrigger><SelectContent><SelectItem value="all-local">Todos Local</SelectItem><SelectItem value="studio1">Estúdio 1</SelectItem><SelectItem value="studio2">Estúdio 2</SelectItem><SelectItem value="office">Escritório</SelectItem><SelectItem value="stock">Estoque</SelectItem></SelectContent></Select>
          {hasActiveFilters && <Button variant="outline" onClick={handleClearFilters}>Limpar</Button>}
        </div>

        <Card className="bg-card border-border">
          <CardContent className="pt-0">
            <ListSectionHeader
              title="Lista de Equipamentos"
              count={total}
              description="Inventário completo de equipamentos e instrumentos"
              action={
                <div className="flex flex-wrap items-center justify-end gap-3">
                  <Checkbox
                    checked={selectedIds.length === pageItems.length && pageItems.length > 0}
                    onCheckedChange={toggleSelectAll}
                    data-testid="checkbox-select-all"
                    aria-label="Selecionar todos"
                  />
                  <span className="text-xs text-muted-foreground">
                    {selectedIds.length > 0 ? `${selectedIds.length} item(ns) selecionado(s)` : "Selecionar todos"}
                  </span>
                  {selectedIds.length > 0 && (
                    <Button variant="destructive" size="sm" className="gap-1 h-7 text-xs" onClick={handleBulkDelete} data-testid="button-bulk-delete">
                      <Trash2 className="h-3.5 w-3.5" />
                      Excluir ({selectedIds.length})
                    </Button>
                  )}
                </div>
              }
            />
            {pageItems.length > 0 ? (
              <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[36px]"></TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Setor</TableHead>
                    <TableHead>Localização</TableHead>
                    <TableHead>Responsável</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-center">Qtd.</TableHead>
                    <TableHead className="text-right">Valor Unit.</TableHead>
                    <TableHead className="text-right">Valor Total</TableHead>
                    <TableHead>Entrada</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageItems.map((item: any) => (
                    <TableRow key={item.id} data-testid={`card-inventory-${item.id}`} className={selectedIds.includes(item.id) ? "bg-muted/20" : ""}>
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.includes(item.id)}
                          onCheckedChange={() => toggleSelect(item.id)}
                          data-testid={`checkbox-inventory-${item.id}`}
                          aria-label={`Selecionar ${item.name}`}
                        />
                      </TableCell>
                      <TableCell className="font-medium" data-testid={`text-inventory-name-${item.id}`}>{item.name}</TableCell>
                      <TableCell>
                        {item.category ? <Badge variant="outline" className="text-xs">{item.category}</Badge> : "—"}
                      </TableCell>
                      <TableCell>
                        {item.sector ? <Badge variant="secondary" className="text-xs">{item.sector}</Badge> : "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">{item.storage_location || "—"}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{item.responsible_person || "—"}</TableCell>
                      <TableCell><StatusBadge status={item.status} domain="inventory" /></TableCell>
                      <TableCell className="text-center">{item.quantity || 1}</TableCell>
                      <TableCell className={`text-right font-medium ${getMonetarySemanticClass("neutral")}`}>{item.unit_price ? formatCurrency(item.unit_price) : "—"}</TableCell>
                      <TableCell className={`text-right font-medium ${getMonetarySemanticClass("neutral")}`}>
                        {item.unit_price ? formatCurrency((Number(item.unit_price) || 0) * (Number(item.quantity) || 1)) : "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">{item.entry_date ? formatDate(item.entry_date) : "—"}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" data-testid={`button-menu-inventory-${item.id}`}>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem data-testid={`button-view-inventory-${item.id}`} onClick={() => setViewModal({ open: true, item })}>
                              <Eye className="h-4 w-4 mr-2" /> Ver
                            </DropdownMenuItem>
                            <DropdownMenuItem data-testid={`button-edit-inventory-${item.id}`} onClick={() => setFormModal({ open: true, mode: "edit", item })}>
                              <Pencil className="h-4 w-4 mr-2" /> Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem data-testid={`button-delete-inventory-${item.id}`} onClick={() => setDeleteModal({ open: true, item })} className="text-destructive">
                              <Trash2 className="h-4 w-4 mr-2" /> Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <TablePagination
                total={total}
                page={page}
                pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
                itemLabel="equipamentos"
              />
              </>
            ) : pageError && total === 0 ? (
              <UnavailableState onRetry={() => refetchPage()} />
            ) : (
              <EmptyState
                icon={Package}
                title="Nenhum equipamento cadastrado"
                description="Comece adicionando seu primeiro item ao inventário"
                actionLabel="Novo Item"
                onAction={() => setFormModal({ open: true, mode: "create" })}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
    )}

      {/* Outside the isLoading gate on purpose — same bug as /artists
          (Task C): InventoryFormModal calls useInventory() again only
          for the mutations, the same query as the isLoading above. */}
      <InventoryViewModal open={viewModal.open} onOpenChange={(open) => setViewModal({ ...viewModal, open })} item={viewModal.item} />
      <InventoryFormModal open={formModal.open} onOpenChange={(open) => setFormModal({ ...formModal, open })} item={formModal.item} mode={formModal.mode} />
      <DeleteConfirmModal open={deleteModal.open} onOpenChange={(open) => setDeleteModal({ ...deleteModal, open })} title="Excluir Item" description={`Tem certeza que deseja excluir "${deleteModal.item?.name}"?`} onConfirm={handleDelete} />
    </>
    </FeatureGate>
  );
}
