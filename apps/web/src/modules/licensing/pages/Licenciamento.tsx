import { useState, useMemo, useEffect } from "react";
import { storage } from "@/shared/lib/storage";
import { runBulkAction, reportBulkResult } from "@/shared/hooks/useBulkAction";
import { MainLayout } from "@/shared/components/MainLayout";
import { MetricCard } from "@/shared/components/MetricCard";
import { ListSectionHeader } from "@/shared/components/ListSectionHeader";
import { TablePagination } from "@/shared/ui/table-pagination";
import { useDebounce } from "@/shared/hooks/useDebounce";
import { Card, CardContent } from "@/shared/ui/card";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { Input } from "@/shared/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { FileText, Music, Clock, DollarSign, PlusCircle, Search, Loader2, MoreHorizontal, Eye, Pencil, Trash2, Shield } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/shared/ui/dropdown-menu";
import { LicencaFormModal } from "@/modules/licensing/components/LicencaFormModal";
import { LicencaViewModal } from "@/modules/licensing/components/LicencaViewModal";
import { DeleteConfirmModal } from "@/shared/components/DeleteConfirmModal";
import { RequirePermission } from "@/shared/components/RequirePermission";
import { EmptyState } from "@/shared/components/EmptyState";
import { UnavailableState } from "@/shared/components/UnavailableState";
import { useLicencas } from "@/modules/licensing/hooks/useLicencas";
import { useLicencasPaginated, useLicencasStats } from "@/modules/licensing/hooks/useLicencasPaginated";
import { formatRemuneration, obraArtistaLabel, midiaLabel } from "@/modules/licensing/lib/licenca-format";
import type { Work } from "@/modules/catalog/types/catalog.types";
import { formatCurrency } from "@/shared/lib/format-utils";
import { FeatureGate } from '@/shared/components/FeatureGate';

const getStatusBadge = (status: string) => {
  switch (status) {
    case "ativa": return <Badge variant="success">Ativa</Badge>;
    case "negociacao": return <Badge variant="warning">Em Negociação</Badge>;
    case "proposta": return <Badge variant="info">Proposta Enviada</Badge>;
    case "expirada": return <Badge variant="danger">Expirada</Badge>;
    default: return <Badge variant="neutral">{status?.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}</Badge>;
  }
};

export default function Licenciamento() {
  // Task H: useLicencas() (fetch-all) remains only for mutations (delete) and the
  // initial isLoading gate — the tables below now read from
  // useLicencasPaginated() (server-side, one page at a time).
  const { licencas, isLoading, deleteLicenca } = useLicencas();

  const [activeTab, setActiveTab] = useState("catalogo");
  const [licencaModal, setLicencaModal] = useState<{ open: boolean; mode: "create" | "edit"; licenca?: any }>({ open: false, mode: "create" });
  const [viewModal, setViewModal] = useState<{ open: boolean; licenca?: any }>({ open: false });
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; licenca?: any }>({ open: false });
  const [bulkDeleteModal, setBulkDeleteModal] = useState<{ open: boolean; ids: string[] }>({ open: false, ids: [] });

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [midiaFilter, setMidiaFilter] = useState("all");
  const [selectedLicencaIds, setSelectedLicencaIds] = useState<string[]>([]);

  const hasActiveFilters = searchTerm !== "" || statusFilter !== "all" || midiaFilter !== "all";
  const debouncedSearch = useDebounce(searchTerm, 300);

  // Task H: real server-side pagination — the page changes the request (it never
  // slices an already-downloaded list). Only the "catalogo" tab has media search/filter;
  // "propostas"/"ativas" are a fixed status applied on the backend.
  // Since only the active tab is rendered at a time, a single paginated call
  // is enough — it is the `status` filter that changes with `activeTab`.
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  useEffect(() => { setPage(0); }, [debouncedSearch, statusFilter, midiaFilter, activeTab]);

  const tabStatus =
    activeTab === "propostas" ? "negociacao,proposta" :
    activeTab === "ativas" ? "ativa" :
    (statusFilter !== "all" ? statusFilter : undefined);

  const {
    licencas: pageItems,
    total,
    isLoading: isLoadingPage,
    error: pageError,
    refetch: refetchPage,
  } = useLicencasPaginated({
    page,
    pageSize,
    search: activeTab === "catalogo" ? (debouncedSearch || undefined) : undefined,
    status: tabStatus,
    midia: activeTab === "catalogo" && midiaFilter !== "all" ? midiaFilter : undefined,
  });

  // Task J: per-row work title/client name, resolved by direct ID
  // (GET /works/:id, GET /clients/:id) only for the records of the
  // current page — previously it scanned useObras()/an unfiltered client
  // listing, truncated to the first 50 of the tenant.
  const [resolvedObras, setResolvedObras] = useState<Record<string, Work>>({});
  const [resolvedClientes, setResolvedClientes] = useState<Record<string, { id: string; name: string }>>({});
  const licencaObraIds = useMemo(
    () => Array.from(new Set(pageItems.map((l: any) => l.work_id).filter(Boolean))) as string[],
    [pageItems],
  );
  const licencaClientIds = useMemo(
    () => Array.from(new Set(pageItems.map((l: any) => l.client_id).filter(Boolean))) as string[],
    [pageItems],
  );
  useEffect(() => {
    if (licencaObraIds.length === 0) return;
    let cancelled = false;
    Promise.all(licencaObraIds.map((id) => storage.findById<Work & { id: string }>("obras", id)))
      .then((results) => {
        if (cancelled) return;
        const map: Record<string, Work> = {};
        results.forEach((o, i) => { if (o) map[licencaObraIds[i]] = o; });
        setResolvedObras((prev) => ({ ...prev, ...map }));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [licencaObraIds]);
  useEffect(() => {
    if (licencaClientIds.length === 0) return;
    let cancelled = false;
    Promise.all(licencaClientIds.map((id) => storage.findById<{ id: string; name: string }>("clientes", id)))
      .then((results) => {
        if (cancelled) return;
        const map: Record<string, { id: string; name: string }> = {};
        results.forEach((c, i) => { if (c) map[licencaClientIds[i]] = c; });
        setResolvedClientes((prev) => ({ ...prev, ...map }));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [licencaClientIds]);

  const obraTitleDe = (l: any) => (l.work_id ? resolvedObras[l.work_id]?.title ?? null : null);
  const artistaDe = (l: any) => (l.work_id ? obraArtistaLabel(resolvedObras[l.work_id]) : "");
  const clienteNomeDe = (l: any) => (l.client_id ? resolvedClientes[l.client_id]?.name ?? null : null);

  // KPIs: count + value sum per status OVER THE WHOLE TENANT (not the
  // current page) — GET /licenses/stats, aggregated in the database.
  const { stats } = useLicencasStats();

  const toggleSelectLicenca = (id: string) => {
    setSelectedLicencaIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };

  const toggleSelectLicencas = (rows: any[]) => {
    const ids = rows.map((row) => row.id);
    const allSelected = ids.length > 0 && ids.every((id) => selectedLicencaIds.includes(id));
    setSelectedLicencaIds((current) => {
      if (allSelected) return current.filter((id) => !ids.includes(id));
      return Array.from(new Set([...current, ...ids]));
    });
  };

  const renderSelectAction = (rows: any[], testId: string) => {
    if (rows.length === 0) return undefined;
    const allSelected = rows.every((row) => selectedLicencaIds.includes(row.id));
    const selectedCount = rows.filter((row) => selectedLicencaIds.includes(row.id)).length;
    return (
      <div className="flex flex-wrap items-center justify-end gap-3">
        {selectedCount > 0 && (
          <Button
            type="button"
            variant="destructive"
            size="sm"
            className="h-8 text-xs gap-1.5"
            onClick={() => setBulkDeleteModal({ open: true, ids: rows.filter((row) => selectedLicencaIds.includes(row.id)).map((row) => row.id) })}
            data-testid={`${testId}-delete-selected`}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Excluir selecionadas
          </Button>
        )}
        <Checkbox
          checked={allSelected}
          onCheckedChange={() => toggleSelectLicencas(rows)}
          aria-label="Selecionar todas as licenças"
          data-testid={testId}
        />
        <span className="text-xs text-muted-foreground">
          {selectedCount > 0 ? `${selectedCount} selecionada(s)` : "Selecionar todos"}
        </span>
      </div>
    );
  };

  const clearFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
    setMidiaFilter("all");
  };

  const handleDelete = () => {
    if (deleteModal.licenca) {
      deleteLicenca.mutate(deleteModal.licenca.id);
      setDeleteModal({ open: false });
    }
  };

  const handleBulkDelete = async () => {
    const ids = bulkDeleteModal.ids;
    setSelectedLicencaIds((current) => current.filter((id) => !ids.includes(id)));
    setBulkDeleteModal({ open: false, ids: [] });
    const result = await runBulkAction(ids, (id) => deleteLicenca.mutateAsync(id));
    reportBulkResult(result, "excluída", "licença");
  };

  const metricas = useMemo(() => ({
    total: stats.total,
    ativas: stats.byGroup["ativa"] ?? 0,
    propostas: (stats.byGroup["negociacao"] ?? 0) + (stats.byGroup["proposta"] ?? 0),
    expiradas: stats.byGroup["expirada"] ?? 0,
    valorTotal: stats.sumByGroup?.["ativa"] ?? 0,
  }), [stats]);

  const headerActions = (
    <RequirePermission module="licensing" action="write">
      <Button size="sm" className="h-8 text-xs gap-1.5" onClick={() => setLicencaModal({ open: true, mode: "create" })} data-testid="button-nova-licenca">
        <PlusCircle className="h-3.5 w-3.5" />Nova Licença
      </Button>
    </RequirePermission>
  );

  return (
    <FeatureGate feature="moduleLicensing" featureName="Licenciamento" requiredPlan="enterprise">
    <>
    {isLoading || isLoadingPage ? (
      <MainLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </MainLayout>
    ) : (
    <MainLayout title="Licenciamento" description="Gestão de licenças e sincronização" actions={headerActions}>
      <div className="space-y-6">

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <MetricCard title="Total Licenças" value={metricas.total} icon={FileText} accent="primary" />
          <MetricCard title="Licenças Ativas" value={metricas.ativas} icon={Music} accent="success" />
          <MetricCard title="Em Negociação" value={metricas.propostas} icon={Clock} accent="warning" />
          <MetricCard title="Expirado" value={metricas.expiradas} icon={Shield} accent="destructive" />
          <MetricCard title="Valor Total" value={formatCurrency(metricas.valorTotal)} icon={DollarSign} accent="primary" />
        </div>

        <div className="flex items-center gap-2">
          <Button variant={activeTab === "catalogo" ? "default" : "outline"} size="sm" onClick={() => setActiveTab("catalogo")} className={activeTab === "catalogo" ? "bg-muted text-foreground hover:bg-muted" : ""}>Catálogo de Licenças</Button>
          <Button variant={activeTab === "propostas" ? "default" : "outline"} size="sm" onClick={() => setActiveTab("propostas")} className={activeTab === "propostas" ? "bg-muted text-foreground hover:bg-muted" : ""}>Propostas</Button>
          <Button variant={activeTab === "ativas" ? "default" : "outline"} size="sm" onClick={() => setActiveTab("ativas")} className={activeTab === "ativas" ? "bg-muted text-foreground hover:bg-muted" : ""}>Licenças Ativas</Button>
        </div>

        {activeTab === "catalogo" && (
          <>
            <div className="flex flex-wrap items-center gap-3 rounded-lg bg-muted/30 p-3">
              <div className="relative min-w-[240px] flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por título, artista, obra, cliente..."
                  className="pl-10 h-8 text-sm bg-card border-border"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-8 w-auto min-w-[126px] shrink-0 bg-card border-border text-sm"><SelectValue placeholder="Todos Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos Status</SelectItem>
                  <SelectItem value="ativa">Ativa</SelectItem>
                  <SelectItem value="negociacao">Em Negociação</SelectItem>
                  <SelectItem value="proposta">Proposta Enviada</SelectItem>
                  <SelectItem value="expirada">Expirada</SelectItem>
                </SelectContent>
              </Select>
              <Select value={midiaFilter} onValueChange={setMidiaFilter}>
                <SelectTrigger className="h-8 w-auto min-w-[132px] shrink-0 bg-card border-border text-sm"><SelectValue placeholder="Todas Mídias" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas Mídias</SelectItem>
                  <SelectItem value="tv">TV</SelectItem>
                  <SelectItem value="streaming">Streaming</SelectItem>
                  <SelectItem value="radio">Rádio</SelectItem>
                  <SelectItem value="games">Games</SelectItem>
                  <SelectItem value="digital">Digital</SelectItem>
                </SelectContent>
              </Select>
              {hasActiveFilters && (
                <Button variant="outline" size="sm" onClick={clearFilters}>Limpar</Button>
              )}
            </div>

            <Card>
              <CardContent className="p-6 space-y-4">
              {pageItems.length > 0 ? (
                <>
                <ListSectionHeader
                  title="Lista de Licenças"
                  count={total}
                  description="Acompanhe licenças, clientes, mídias e valores contratados"
                  action={renderSelectAction(pageItems, "checkbox-select-all-licencas")}
                />
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8"></TableHead>
                      <TableHead>Título</TableHead>
                      <TableHead>Artista/Obra</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Mídia</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pageItems.map((licenca) => (
                      <TableRow key={licenca.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedLicencaIds.includes(licenca.id)}
                            onCheckedChange={() => toggleSelectLicenca(licenca.id)}
                            aria-label={`Selecionar licença ${licenca.title || licenca.id}`}
                            data-testid={`checkbox-licenca-${licenca.id}`}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{licenca.title || "—"}</TableCell>
                        <TableCell>
                          <div className="min-w-0">
                            <p className="font-medium truncate">{obraTitleDe(licenca) ?? "—"}</p>
                            {artistaDe(licenca) && <p className="text-xs text-muted-foreground truncate">{artistaDe(licenca)}</p>}
                          </div>
                        </TableCell>
                        <TableCell>{clienteNomeDe(licenca) ?? "—"}</TableCell>
                        <TableCell>{licenca.midia_destino ? <Badge variant="neutral">{midiaLabel(licenca.midia_destino)}</Badge> : "—"}</TableCell>
                        <TableCell className="font-semibold text-success">{formatRemuneration(licenca)}</TableCell>
                        <TableCell>{getStatusBadge(licenca.status ?? "")}</TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setViewModal({ open: true, licenca })}>
                                <Eye className="h-4 w-4 mr-2" />
                                Ver
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setLicencaModal({ open: true, mode: "edit", licenca })}>
                                <Pencil className="h-4 w-4 mr-2" />
                                Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setDeleteModal({ open: true, licenca })} className="text-destructive">
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
                  total={total}
                  page={page}
                  pageSize={pageSize}
                  onPageChange={setPage}
                  onPageSizeChange={setPageSize}
                  itemLabel="licenças"
                />
                </>
              ) : pageError && total === 0 ? (
                <UnavailableState onRetry={() => refetchPage()} />
              ) : (
                <EmptyState
                  icon={FileText}
                  title="Nenhuma licença cadastrada"
                  description="Comece criando sua primeira licença de sync"
                  actionLabel="Nova Licença"
                  onAction={() => setLicencaModal({ open: true, mode: "create" })}
                />
              )}
              </CardContent>
            </Card>
          </>
        )}

        {activeTab === "propostas" && (
          <Card>
            <CardContent className="p-6">
              <ListSectionHeader
                title="Propostas em Andamento"
                count={total}
                description="Acompanhe propostas de licenciamento em negociação e aguardando resposta"
                action={renderSelectAction(pageItems, "checkbox-select-all-propostas")}
              />
              {pageItems.length > 0 ? (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8"></TableHead>
                        <TableHead>Título</TableHead>
                        <TableHead>Artista/Obra</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Mídia</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pageItems.map((licenca) => (
                        <TableRow key={licenca.id}>
                          <TableCell>
                            <Checkbox
                              checked={selectedLicencaIds.includes(licenca.id)}
                              onCheckedChange={() => toggleSelectLicenca(licenca.id)}
                              aria-label={`Selecionar licença ${licenca.title || licenca.id}`}
                              data-testid={`checkbox-proposta-${licenca.id}`}
                            />
                          </TableCell>
                          <TableCell className="font-medium">{licenca.title || "—"}</TableCell>
                          <TableCell>
                            <div className="min-w-0">
                              <p className="font-medium truncate">{obraTitleDe(licenca) ?? "—"}</p>
                              {artistaDe(licenca) && <p className="text-xs text-muted-foreground truncate">{artistaDe(licenca)}</p>}
                            </div>
                          </TableCell>
                          <TableCell>{clienteNomeDe(licenca) ?? "—"}</TableCell>
                          <TableCell>{licenca.midia_destino ? <Badge variant="neutral">{midiaLabel(licenca.midia_destino)}</Badge> : "—"}</TableCell>
                          <TableCell className="font-semibold text-success">{formatRemuneration(licenca)}</TableCell>
                          <TableCell>{getStatusBadge(licenca.status ?? "")}</TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => setViewModal({ open: true, licenca })}>
                                  <Eye className="h-4 w-4 mr-2" />
                                  Ver
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setLicencaModal({ open: true, mode: "edit", licenca })}>
                                  <Pencil className="h-4 w-4 mr-2" />
                                  Editar
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setDeleteModal({ open: true, licenca })} className="text-destructive">
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
                    total={total}
                    page={page}
                    pageSize={pageSize}
                    onPageChange={setPage}
                    onPageSizeChange={setPageSize}
                    itemLabel="propostas"
                  />
                </>
              ) : pageError && total === 0 ? (
                <UnavailableState onRetry={() => refetchPage()} />
              ) : (
                <EmptyState
                  icon={Clock}
                  title="Nenhuma proposta em andamento"
                  description="As propostas aparecerão aqui quando criadas"
                />
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === "ativas" && (
          <Card>
            <CardContent className="p-6">
              <ListSectionHeader
                title="Licenças Ativas"
                count={total}
                description="Acompanhe licenças ativas, clientes, mídias, vigência e valores"
                action={renderSelectAction(pageItems, "checkbox-select-all-ativas")}
              />
              {pageItems.length > 0 ? (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8"></TableHead>
                        <TableHead>Título</TableHead>
                        <TableHead>Artista/Obra</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Mídia</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pageItems.map((licenca) => (
                        <TableRow key={licenca.id}>
                          <TableCell>
                            <Checkbox
                              checked={selectedLicencaIds.includes(licenca.id)}
                              onCheckedChange={() => toggleSelectLicenca(licenca.id)}
                              aria-label={`Selecionar licença ${licenca.title || licenca.id}`}
                              data-testid={`checkbox-ativa-${licenca.id}`}
                            />
                          </TableCell>
                          <TableCell className="font-medium">{licenca.title || "—"}</TableCell>
                          <TableCell>
                            <div className="min-w-0">
                              <p className="font-medium truncate">{obraTitleDe(licenca) ?? "—"}</p>
                              {artistaDe(licenca) && <p className="text-xs text-muted-foreground truncate">{artistaDe(licenca)}</p>}
                            </div>
                          </TableCell>
                          <TableCell>{clienteNomeDe(licenca) ?? "—"}</TableCell>
                          <TableCell>{licenca.midia_destino ? <Badge variant="neutral">{midiaLabel(licenca.midia_destino)}</Badge> : "—"}</TableCell>
                          <TableCell className="font-semibold text-success">{formatRemuneration(licenca)}</TableCell>
                          <TableCell>{getStatusBadge(licenca.status ?? "")}</TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => setViewModal({ open: true, licenca })}>
                                  <Eye className="h-4 w-4 mr-2" />
                                  Ver
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setLicencaModal({ open: true, mode: "edit", licenca })}>
                                  <Pencil className="h-4 w-4 mr-2" />
                                  Editar
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setDeleteModal({ open: true, licenca })} className="text-destructive">
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
                    total={total}
                    page={page}
                    pageSize={pageSize}
                    onPageChange={setPage}
                    onPageSizeChange={setPageSize}
                    itemLabel="licenças"
                  />
                </>
              ) : pageError && total === 0 ? (
                <UnavailableState onRetry={() => refetchPage()} />
              ) : (
                <EmptyState
                  icon={Music}
                  title="Nenhuma licença ativa"
                  description="As licenças ativas aparecerão aqui"
                />
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
    )}

      {/* Outside the isLoading gate on purpose — same bug as /artistas
          (Task C): LicencaFormModal calls useLicencas() again only for the
          create/update mutations, the same query as the isLoading above.
          Mounting it only after isLoading turned false created a new observer
          on that query; on error (backend down), refetchOnMount
          reopened isLoading, the gate unmounted the modal again — an infinite
          loading loop. Keeping them always mounted breaks the cycle. */}
      <LicencaFormModal open={licencaModal.open} onOpenChange={(open) => setLicencaModal({ ...licencaModal, open })} licenca={licencaModal.licenca} mode={licencaModal.mode} />
      <LicencaViewModal open={viewModal.open} onOpenChange={(open) => setViewModal({ ...viewModal, open })} licenca={viewModal.licenca} />
      <DeleteConfirmModal open={deleteModal.open} onOpenChange={(open) => setDeleteModal({ ...deleteModal, open })} title="Excluir Licença" description={`Tem certeza que deseja excluir "${deleteModal.licenca?.title}"?`} onConfirm={handleDelete} />
      <DeleteConfirmModal open={bulkDeleteModal.open} onOpenChange={(open) => setBulkDeleteModal({ ...bulkDeleteModal, open })} title="Excluir licenças selecionadas" description={`Tem certeza que deseja excluir ${bulkDeleteModal.ids.length} licenca(s) selecionada(s)?`} onConfirm={handleBulkDelete} />
    </>
    </FeatureGate>
  );
}
