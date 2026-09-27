import { useEffect, useMemo, useState } from "react";
import { runBulkAction, reportBulkResult } from "@/shared/hooks/useBulkAction";
import { MainLayout } from "@/shared/components/MainLayout";
import { MetricCard } from "@/shared/components/MetricCard";
import { ListSectionHeader } from "@/shared/components/ListSectionHeader";
import { TablePagination } from "@/shared/ui/table-pagination";
import { Card, CardContent } from "@/shared/ui/card";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { Input } from "@/shared/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { AlertTriangle, Clock, CheckCircle, Upload, PlusCircle, Search, Loader2, MoreHorizontal, Eye, Pencil, Trash2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/shared/ui/dropdown-menu";
import { TakedownFormModal } from "@/modules/monitoring/components/TakedownFormModal";
import { TakedownViewModal } from "@/modules/monitoring/components/TakedownViewModal";
import { DeleteConfirmModal } from "@/shared/components/DeleteConfirmModal";
import { EmptyState } from "@/shared/components/EmptyState";
import { UnavailableState } from "@/shared/components/UnavailableState";
import { useTakedowns } from "@/modules/monitoring/hooks/useTakedowns";
import { useTakedownsPaginated, useTakedownsStats } from "@/modules/monitoring/hooks/useTakedownsPaginated";
import { useDebounce } from "@/shared/hooks/useDebounce";
import { formatTakedownDate, normalizeTakedown, statusBadge, typeBadge, isResolved, isPending, isInProgress } from "@/modules/monitoring/lib/takedown-format";
import { FeatureGate } from '@/shared/components/FeatureGate';

export default function Takedowns() {
  // Task H: the old hook (downloads everything) stays only for mutations (delete) — the
  // table and the KPIs below no longer use `takedowns`.
  const { isLoading, deleteTakedown } = useTakedowns();
  const [activeTab, setActiveTab] = useState("todos");
  const [takedownModal, setTakedownModal] = useState<{ open: boolean; mode: "create" | "edit"; takedown?: any }>({ open: false, mode: "create" });
  const [viewModal, setViewModal] = useState<{ open: boolean; takedown?: any }>({ open: false });
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; takedown?: any }>({ open: false });
  const [bulkDeleteModal, setBulkDeleteModal] = useState<{ open: boolean; ids: string[] }>({ open: false, ids: [] });
  const [selectedTakedownIds, setSelectedTakedownIds] = useState<string[]>([]);

  // Filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [platformFilter, setPlatformFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const debouncedSearch = useDebounce(searchTerm, 300);

  const hasActiveFilters = searchTerm !== "" || platformFilter !== "all" || statusFilter !== "all";

  // The tab (all/pending/resolved) and the Status select are two independent
  // filters that were always combined with AND (see the previous version:
  // matchesTab && matchesStatus). The backend only accepts a single `status`
  // value at a time, so we resolve the intersection here: if the tab asks for
  // "pendentes" (status=pendente) and the select asks for a different status, the
  // intersection is empty — no status combination satisfies
  // both, so we do not even call the API (equivalent to the former
  // filteredRows.length===0).
  const tabStatus = activeTab === "pendentes" ? "pending" : activeTab === "resolvidos" ? "completed" : undefined;
  const statusContradiction = tabStatus !== undefined && statusFilter !== "all" && statusFilter !== tabStatus;
  const effectiveStatus = statusContradiction ? undefined : (tabStatus ?? (statusFilter !== "all" ? statusFilter : undefined));

  // Task H: real server-side pagination — the page changes the request (it never
  // slices an already-downloaded list), and goes back to page 0 when a filter
  // changes (otherwise page 5 of a filter with only 2 pages gets stuck).
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  useEffect(() => { setPage(0); }, [debouncedSearch, activeTab, statusFilter, platformFilter]);

  const {
    takedowns: pageRows,
    total,
    isLoading: isLoadingPage,
    error: pageError,
    refetch: refetchPage,
  } = useTakedownsPaginated({
    page,
    pageSize,
    search: debouncedSearch || undefined,
    status: effectiveStatus,
    plataforma: platformFilter !== "all" ? platformFilter : undefined,
  });

  // KPIs: count per status OVER THE WHOLE TENANT (not the current page) —
  // GET /takedowns/stats, aggregated in the database. The bucket mapping
  // (pendente/em_andamento/concluído) is the same as always, except it now
  // iterates over {status: count} (few entries) instead of the full list.
  const { stats: takedownsStats } = useTakedownsStats();
  const metrics = useMemo(() => {
    let pending = 0, resolvidos = 0, emAndamento = 0;
    for (const [status, count] of Object.entries(takedownsStats.byGroup)) {
      if (isPending(status)) pending += count;
      else if (isResolved(status)) resolvidos += count;
      else if (isInProgress(status)) emAndamento += count;
    }
    return { total: takedownsStats.total, pendentes: pending, resolvidos, emAndamento };
  }, [takedownsStats]);

  // The table renders the current page returned by the backend directly
  // (statusContradiction forces an empty page without a round trip).
  const rows = useMemo(
    () => (statusContradiction ? [] : pageRows).map(t => ({ raw: t, n: normalizeTakedown(t) })),
    [pageRows, statusContradiction],
  );
  const effectiveTotal = statusContradiction ? 0 : total;

  const clearFilters = () => {
    setSearchTerm("");
    setPlatformFilter("all");
    setStatusFilter("all");
  };

  const handleDelete = () => {
    if (deleteModal.takedown) {
      deleteTakedown.mutate(deleteModal.takedown.id);
      setDeleteModal({ open: false });
    }
  };

  const toggleSelectTakedown = (id: string) => {
    setSelectedTakedownIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };

  // Task H: "select all" operates on the current page (server-side),
  // no longer on the whole filtered list downloaded on the client.
  const toggleSelectAllTakedowns = () => {
    const ids = rows.map(({ n }) => n.id);
    const allSelected = ids.length > 0 && ids.every((id) => selectedTakedownIds.includes(id));
    setSelectedTakedownIds((current) => {
      if (allSelected) return current.filter((id) => !ids.includes(id));
      return Array.from(new Set([...current, ...ids]));
    });
  };

  const handleBulkDelete = async () => {
    const ids = bulkDeleteModal.ids;
    setSelectedTakedownIds((current) => current.filter((id) => !ids.includes(id)));
    setBulkDeleteModal({ open: false, ids: [] });
    const result = await runBulkAction(ids, (id) => deleteTakedown.mutateAsync(id));
    reportBulkResult(result, "excluído", "takedown");
  };

  const selectedPageCount = rows.filter(({ n }) => selectedTakedownIds.includes(n.id)).length;
  const allPageSelected = rows.length > 0 && rows.every(({ n }) => selectedTakedownIds.includes(n.id));

  const headerActions = (
    <Button size="sm" className="h-8 text-xs gap-1.5" onClick={() => setTakedownModal({ open: true, mode: "create" })} data-testid="button-novo-takedown">
      <PlusCircle className="h-3.5 w-3.5" />
      Novo Takedown
    </Button>
  );

  return (
    <FeatureGate feature="moduleMonitoring" featureName="Monitoramento">
    <>
    {isLoading || isLoadingPage ? (
      <MainLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </MainLayout>
    ) : (
    <MainLayout title="Takedowns" description="Gerencie solicitações de remoção e claims" actions={headerActions}>
      <div className="space-y-6">

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <MetricCard title="Total" value={metrics.total} icon={AlertTriangle} accent="primary" />
          <MetricCard title="Pendentes" value={metrics.pendentes} icon={Clock} accent="warning" />
          <MetricCard title="Em Andamento" value={metrics.emAndamento} icon={Upload} accent="primary" />
          <MetricCard title="Resolvidos" value={metrics.resolvidos} icon={CheckCircle} accent="success" />
        </div>

        <div className="flex items-center gap-2">
          <Button variant={activeTab === "todos" ? "default" : "outline"} size="sm" onClick={() => setActiveTab("todos")} className={activeTab === "todos" ? "bg-muted text-foreground hover:bg-muted" : ""}>Todos</Button>
          <Button variant={activeTab === "pendentes" ? "default" : "outline"} size="sm" onClick={() => setActiveTab("pendentes")} className={activeTab === "pendentes" ? "bg-muted text-foreground hover:bg-muted" : ""}>Pendentes</Button>
          <Button variant={activeTab === "resolvidos" ? "default" : "outline"} size="sm" onClick={() => setActiveTab("resolvidos")} className={activeTab === "resolvidos" ? "bg-muted text-foreground hover:bg-muted" : ""}>Resolvidos</Button>
        </div>

        <div className="flex flex-wrap items-center gap-3 rounded-lg bg-muted/30 p-3">
          <div className="relative min-w-[240px] flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por título, motivo, plataforma..."
              className="h-8 pl-10 bg-card border-border text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Select value={platformFilter} onValueChange={setPlatformFilter}>
            <SelectTrigger className="h-8 w-auto min-w-[132px] shrink-0 bg-card border-border text-sm">
              <SelectValue placeholder="Plataforma" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="youtube">YouTube</SelectItem>
              <SelectItem value="tiktok">TikTok</SelectItem>
              <SelectItem value="spotify">Spotify</SelectItem>
              <SelectItem value="apple podcasts">Apple Podcasts</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-8 w-auto min-w-[126px] shrink-0 bg-card border-border text-sm">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="pending">Pendente</SelectItem>
              <SelectItem value="in_progress">Em Andamento</SelectItem>
              <SelectItem value="completed">Concluído</SelectItem>
              <SelectItem value="rejected">Rejeitado</SelectItem>
            </SelectContent>
          </Select>
          {hasActiveFilters && (
            <Button variant="outline" size="sm" onClick={clearFilters}>
              Limpar
            </Button>
          )}
        </div>

        <Card>
          <CardContent className="p-6 space-y-4">
            {rows.length === 0 ? (
              pageError && effectiveTotal === 0 ? (
                <UnavailableState onRetry={() => refetchPage()} />
              ) : (
                <EmptyState
                  icon={AlertTriangle}
                  title="Nenhum takedown encontrado"
                  description="Adicione um novo takedown para gerenciar solicitações de remoção e claims."
                  action={{ label: "Novo Takedown", onClick: () => setTakedownModal({ open: true, mode: "create" }) }}
                />
              )
            ) : (
              <>
              <ListSectionHeader
                title="Lista de Takedowns"
                count={effectiveTotal}
                action={
                  <div className="flex flex-wrap items-center justify-end gap-3">
                    {selectedPageCount > 0 && (
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="h-8 text-xs gap-1.5"
                        onClick={() => setBulkDeleteModal({ open: true, ids: rows.filter(({ n }) => selectedTakedownIds.includes(n.id)).map(({ n }) => n.id) })}
                        data-testid="button-delete-selected-takedowns"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Excluir selecionados
                      </Button>
                    )}
                    <Checkbox
                      checked={allPageSelected}
                      onCheckedChange={toggleSelectAllTakedowns}
                      aria-label="Selecionar todos os takedowns"
                      data-testid="checkbox-select-all-takedowns"
                    />
                    <span className="text-xs text-muted-foreground">
                      {selectedPageCount > 0 ? `${selectedPageCount} selecionado(s)` : "Selecionar todos"}
                    </span>
                  </div>
                }
                description="Acompanhe solicitações de remoção, claims, plataformas e status"
              />
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead>Título</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Plataforma</TableHead>
                    <TableHead>Motivo</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                    {rows.map(({ raw: takedown, n }) => (
                    <TableRow key={n.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedTakedownIds.includes(n.id)}
                          onCheckedChange={() => toggleSelectTakedown(n.id)}
                          aria-label={`Selecionar takedown ${n.title || n.id}`}
                          data-testid={`checkbox-takedown-${n.id}`}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{n.title || "—"}</TableCell>
                      <TableCell>{typeBadge(n.type)}</TableCell>
                      <TableCell>{n.plataforma ? <Badge variant="neutral">{n.plataforma}</Badge> : "—"}</TableCell>
                      <TableCell>{n.motivo || "—"}</TableCell>
                      <TableCell>{formatTakedownDate(n.data) ?? "—"}</TableCell>
                      <TableCell>{statusBadge(n.status)}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setViewModal({ open: true, takedown })}>
                              <Eye className="h-4 w-4 mr-2" />
                              Ver
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setTakedownModal({ open: true, mode: "edit", takedown })}>
                              <Pencil className="h-4 w-4 mr-2" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setDeleteModal({ open: true, takedown })} className="text-destructive">
                              <Trash2 className="h-4 w-4 mr-2" />
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <TablePagination
                total={effectiveTotal}
                page={page}
                pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
                itemLabel="takedowns"
              />
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
    )}

      {/* Outside the isLoading gate on purpose — same bug as /artists
          (Task C): TakedownFormModal calls useTakedowns() again only for
          the mutations, the same query as the isLoading above. */}
      <TakedownFormModal open={takedownModal.open} onOpenChange={(open) => setTakedownModal({ ...takedownModal, open })} takedown={takedownModal.takedown} mode={takedownModal.mode} />
      <TakedownViewModal open={viewModal.open} onOpenChange={(open) => setViewModal({ ...viewModal, open })} takedown={viewModal.takedown} />
      <DeleteConfirmModal open={deleteModal.open} onOpenChange={(open) => setDeleteModal({ ...deleteModal, open })} title="Excluir Takedown" description={`Tem certeza que deseja excluir "${deleteModal.takedown?.title}"?`} onConfirm={handleDelete} />
      <DeleteConfirmModal open={bulkDeleteModal.open} onOpenChange={(open) => setBulkDeleteModal({ ...bulkDeleteModal, open })} title="Excluir takedowns selecionados" description={`Tem certeza que deseja excluir ${bulkDeleteModal.ids.length} takedown(s) selecionado(s)?`} onConfirm={handleBulkDelete} />
    </>
    </FeatureGate>
  );
}
