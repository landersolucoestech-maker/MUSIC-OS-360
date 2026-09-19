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
import { InventarioFormModal } from "@/modules/inventory/components/InventarioFormModal";
import { InventarioViewModal } from "@/modules/inventory/components/InventarioViewModal";
import { DeleteConfirmModal } from "@/shared/components/DeleteConfirmModal";
import { RequirePermission } from "@/shared/components/RequirePermission";
import { EmptyState } from "@/shared/components/EmptyState";
import { UnavailableState } from "@/shared/components/UnavailableState";
import { useInventario } from "@/modules/inventory/hooks/useInventario";
import { useInventarioPaginated, useInventarioStats } from "@/modules/inventory/hooks/useInventarioPaginated";
import { useDebounce } from "@/shared/hooks/useDebounce";
import { StatusBadge } from "@/shared/components/StatusBadge";
import { FeatureGate } from '@/shared/components/FeatureGate';

// Filtros do dropdown → valores reais gravados no banco (status/localizacao).
// Mesma tradução que existia no .filter() client-side antes da migração.
const STATUS_FILTER_MAP: Record<string, string> = {
  "em-uso": "em_uso",
  disponivel: "disponivel",
  manutencao: "manutencao",
};
const LOCAL_FILTER_MAP: Record<string, string> = {
  estudio1: "Estúdio 1",
  estudio2: "Estúdio 2",
  escritorio: "Escritório",
  estoque: "Estoque",
};

export default function Inventario() {
  const { isLoading, deleteInventario, addInventario } = useInventario();
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
    const result = await runBulkAction(ids, (id) => deleteInventario.mutateAsync(id));
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

  // Task H: paginação real server-side — a página muda de request (nunca
  // recorta uma lista já baixada), e volta pra página 0 quando um filtro muda.
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  useEffect(() => { setPage(0); }, [debouncedSearch, categoryFilter, statusFilter, localFilter]);

  const {
    inventario: pageItems,
    total,
    isLoading: isLoadingPage,
    error: pageError,
    refetch: refetchPage,
  } = useInventarioPaginated({
    page,
    pageSize,
    search: debouncedSearch || undefined,
    status: statusFilter !== "all-status" ? STATUS_FILTER_MAP[statusFilter] : undefined,
    category: categoryFilter !== "all-category" ? categoryFilter : undefined,
    localizacao: localFilter !== "all-local" ? LOCAL_FILTER_MAP[localFilter] : undefined,
  });

  // KPIs: contagem por status + soma de valor patrimonial SOBRE O TENANT
  // INTEIRO (não a página atual) — GET /inventory/stats, agregado no banco.
  const { stats: inventarioStats } = useInventarioStats();

  const handleClearFilters = () => {
    setSearchTerm("");
    setCategoryFilter("all-category");
    setStatusFilter("all-status");
    setLocalFilter("all-local");
  };

  const handleDelete = () => {
    if (deleteModal.item) {
      deleteInventario.mutate(deleteModal.item.id);
      setDeleteModal({ open: false });
    }
  };

  const metricas = {
    total: inventarioStats.total,
    emUso: inventarioStats.byGroup["em_uso"] ?? 0,
    disponiveis: inventarioStats.byGroup["disponivel"] ?? 0,
    emManutencao: inventarioStats.byGroup["manutencao"] ?? 0,
    valorTotal: inventarioStats.totalSum ?? 0,
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
          <MetricCard title="Total de Itens" value={metricas.total} description="equipamentos cadastrados" icon={Package} accent="primary" />
          <MetricCard title="Em Uso" value={metricas.emUso} description="em operação" icon={Package} accent="primary" />
          <MetricCard title="Em Manutenção" value={metricas.emManutencao} description="equipamentos" icon={Wrench} accent="warning" />
          <MetricCard title="Disponíveis" value={metricas.disponiveis} description="prontos para uso" icon={CheckCircle} accent="success" />
          <MetricCard title="Valor Total" value={formatCurrency(metricas.valorTotal)} description="patrimônio total" icon={DollarSign} accent="primary" />
        </div>

        <div className="flex items-center gap-4 rounded-lg bg-muted/30 p-3">
          <div className="relative flex-1"><Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Buscar equipamentos por nome, categoria ou local..." className="pl-10 h-8 text-sm bg-card border-border" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}><SelectTrigger className="w-auto min-w-[140px] h-8 text-sm bg-card border-border"><SelectValue placeholder="Todos Categoria" /></SelectTrigger><SelectContent><SelectItem value="all-category">Todos Categoria</SelectItem><SelectItem value="áudio">Áudio</SelectItem><SelectItem value="vídeo">Vídeo</SelectItem><SelectItem value="computador">Computador</SelectItem><SelectItem value="iluminação">Iluminação</SelectItem><SelectItem value="estrutura">Estrutura</SelectItem></SelectContent></Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-auto min-w-[140px] h-8 text-sm bg-card border-border"><SelectValue placeholder="Todos Status" /></SelectTrigger><SelectContent><SelectItem value="all-status">Todos Status</SelectItem><SelectItem value="em-uso">Em Uso</SelectItem><SelectItem value="disponivel">Disponível</SelectItem><SelectItem value="manutencao">Manutenção</SelectItem></SelectContent></Select>
          <Select value={localFilter} onValueChange={setLocalFilter}><SelectTrigger className="w-auto min-w-[140px] h-8 text-sm bg-card border-border"><SelectValue placeholder="Todos Local" /></SelectTrigger><SelectContent><SelectItem value="all-local">Todos Local</SelectItem><SelectItem value="estudio1">Estúdio 1</SelectItem><SelectItem value="estudio2">Estúdio 2</SelectItem><SelectItem value="escritorio">Escritório</SelectItem><SelectItem value="estoque">Estoque</SelectItem></SelectContent></Select>
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
                    <TableRow key={item.id} data-testid={`card-inventario-${item.id}`} className={selectedIds.includes(item.id) ? "bg-muted/20" : ""}>
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.includes(item.id)}
                          onCheckedChange={() => toggleSelect(item.id)}
                          data-testid={`checkbox-inventario-${item.id}`}
                          aria-label={`Selecionar ${item.nome}`}
                        />
                      </TableCell>
                      <TableCell className="font-medium" data-testid={`text-inventario-nome-${item.id}`}>{item.nome}</TableCell>
                      <TableCell>
                        {item.category ? <Badge variant="outline" className="text-xs">{item.category}</Badge> : "—"}
                      </TableCell>
                      <TableCell>
                        {item.setor ? <Badge variant="secondary" className="text-xs">{item.setor}</Badge> : "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">{item.localizacao || "—"}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{item.responsavel || "—"}</TableCell>
                      <TableCell><StatusBadge status={item.status} /></TableCell>
                      <TableCell className="text-center">{item.quantidade || 1}</TableCell>
                      <TableCell className={`text-right font-medium ${getMonetarySemanticClass("neutral")}`}>{item.valor_unitario ? formatCurrency(item.valor_unitario) : "—"}</TableCell>
                      <TableCell className={`text-right font-medium ${getMonetarySemanticClass("neutral")}`}>
                        {item.valor_unitario ? formatCurrency((Number(item.valor_unitario) || 0) * (Number(item.quantidade) || 1)) : "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">{item.dataEntrada ? formatDate(item.dataEntrada) : "—"}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" data-testid={`button-menu-inventario-${item.id}`}>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem data-testid={`button-ver-inventario-${item.id}`} onClick={() => setViewModal({ open: true, item })}>
                              <Eye className="h-4 w-4 mr-2" /> Ver
                            </DropdownMenuItem>
                            <DropdownMenuItem data-testid={`button-editar-inventario-${item.id}`} onClick={() => setFormModal({ open: true, mode: "edit", item })}>
                              <Pencil className="h-4 w-4 mr-2" /> Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem data-testid={`button-excluir-inventario-${item.id}`} onClick={() => setDeleteModal({ open: true, item })} className="text-destructive">
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

      {/* Fora do gate de isLoading de propósito — mesmo bug de /artistas
          (Task C): InventarioFormModal chama useInventario() de novo só
          para as mutations, a mesma query do isLoading acima. */}
      <InventarioViewModal open={viewModal.open} onOpenChange={(open) => setViewModal({ ...viewModal, open })} item={viewModal.item} />
      <InventarioFormModal open={formModal.open} onOpenChange={(open) => setFormModal({ ...formModal, open })} item={formModal.item} mode={formModal.mode} />
      <DeleteConfirmModal open={deleteModal.open} onOpenChange={(open) => setDeleteModal({ ...deleteModal, open })} title="Excluir Item" description={`Tem certeza que deseja excluir "${deleteModal.item?.nome}"?`} onConfirm={handleDelete} />
    </>
    </FeatureGate>
  );
}
