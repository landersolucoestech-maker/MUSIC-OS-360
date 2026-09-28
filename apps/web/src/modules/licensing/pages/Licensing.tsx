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
import { LicenseFormModal } from "@/modules/licensing/components/LicenseFormModal";
import { LicenseViewModal } from "@/modules/licensing/components/LicenseViewModal";
import { DeleteConfirmModal } from "@/shared/components/DeleteConfirmModal";
import { RequirePermission } from "@/shared/components/RequirePermission";
import { EmptyState } from "@/shared/components/EmptyState";
import { UnavailableState } from "@/shared/components/UnavailableState";
import { useLicenses } from "@/modules/licensing/hooks/useLicenses";
import { useLicensesPaginated, useLicensesStats } from "@/modules/licensing/hooks/useLicensesPaginated";
import { LICENSE_STATUS_VALUES, formatRemuneration, workArtistLabel, mediaLabel, licenseStatusLabel, licenseStatusVariant } from "@/modules/licensing/lib/license-format";
import type { Work } from "@/modules/catalog/types/catalog.types";
import { formatCurrency } from "@/shared/lib/format-utils";
import { FeatureGate } from '@/shared/components/FeatureGate';
import { LicenseStatus } from "@music-os-360/types";

const getStatusBadge = (status?: string | null) => (
  <Badge variant={licenseStatusVariant(status)}>{licenseStatusLabel(status)}</Badge>
);

export default function Licensing() {
  // Task H: useLicenses() (fetch-all) remains only for mutations (delete) and the
  // initial isLoading gate — the tables below now read from
  // useLicensesPaginated() (server-side, one page at a time).
  const { licenses, isLoading, deleteLicense } = useLicenses();

  const [activeTab, setActiveTab] = useState("catalog");
  const [licenseModal, setLicenseModal] = useState<{ open: boolean; mode: "create" | "edit"; licenca?: any }>({ open: false, mode: "create" });
  const [viewModal, setViewModal] = useState<{ open: boolean; licenca?: any }>({ open: false });
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; licenca?: any }>({ open: false });
  const [bulkDeleteModal, setBulkDeleteModal] = useState<{ open: boolean; ids: string[] }>({ open: false, ids: [] });

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [mediaFilter, setMediaFilter] = useState("all");
  const [selectedLicenseIds, setSelectedLicenseIds] = useState<string[]>([]);

  const hasActiveFilters = searchTerm !== "" || statusFilter !== "all" || mediaFilter !== "all";
  const debouncedSearch = useDebounce(searchTerm, 300);

  // Task H: real server-side pagination — the page changes the request (it never
  // slices an already-downloaded list). Only the "catalog" tab has media search/filter;
  // "proposals"/"active" are a fixed status applied on the backend.
  // Since only the active tab is rendered at a time, a single paginated call
  // is enough — it is the `status` filter that changes with `activeTab`.
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  useEffect(() => { setPage(0); }, [debouncedSearch, statusFilter, mediaFilter, activeTab]);

  const tabStatus =
    activeTab === "proposals" ? `${LicenseStatus.NEGOTIATION},${LicenseStatus.PROPOSAL}` :
    activeTab === "active" ? LicenseStatus.ACTIVE :
    (statusFilter !== "all" ? statusFilter : undefined);

  const {
    licenses: pageItems,
    total,
    isLoading: isLoadingPage,
    error: pageError,
    refetch: refetchPage,
  } = useLicensesPaginated({
    page,
    pageSize,
    search: activeTab === "catalog" ? (debouncedSearch || undefined) : undefined,
    status: tabStatus,
    targetMedia: activeTab === "catalog" && mediaFilter !== "all" ? mediaFilter : undefined,
  });

  // Task J: per-row work title/client name, resolved by direct ID
  // (GET /works/:id, GET /clients/:id) only for the records of the
  // current page — previously it scanned useWorks()/an unfiltered client
  // listing, truncated to the first 50 of the tenant.
  const [resolvedWorks, setResolvedWorks] = useState<Record<string, Work>>({});
  const [resolvedClients, setResolvedClients] = useState<Record<string, { id: string; name: string }>>({});
  const licenseWorkIds = useMemo(
    () => Array.from(new Set(pageItems.map((l: any) => l.work_id).filter(Boolean))) as string[],
    [pageItems],
  );
  const licenseClientIds = useMemo(
    () => Array.from(new Set(pageItems.map((l: any) => l.client_id).filter(Boolean))) as string[],
    [pageItems],
  );
  useEffect(() => {
    if (licenseWorkIds.length === 0) return;
    let cancelled = false;
    Promise.all(licenseWorkIds.map((id) => storage.findById<Work & { id: string }>("works", id)))
      .then((results) => {
        if (cancelled) return;
        const map: Record<string, Work> = {};
        results.forEach((o, i) => { if (o) map[licenseWorkIds[i]] = o; });
        setResolvedWorks((prev) => ({ ...prev, ...map }));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [licenseWorkIds]);
  useEffect(() => {
    if (licenseClientIds.length === 0) return;
    let cancelled = false;
    Promise.all(licenseClientIds.map((id) => storage.findById<{ id: string; name: string }>("clients", id)))
      .then((results) => {
        if (cancelled) return;
        const map: Record<string, { id: string; name: string }> = {};
        results.forEach((c, i) => { if (c) map[licenseClientIds[i]] = c; });
        setResolvedClients((prev) => ({ ...prev, ...map }));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [licenseClientIds]);

  const workTitleOf = (l: any) => (l.work_id ? resolvedWorks[l.work_id]?.title ?? null : null);
  const artistOf = (l: any) => (l.work_id ? workArtistLabel(resolvedWorks[l.work_id]) : "");
  const clientNameOf = (l: any) => (l.client_id ? resolvedClients[l.client_id]?.name ?? null : null);

  // KPIs: count + value sum per status OVER THE WHOLE TENANT (not the
  // current page) — GET /licenses/stats, aggregated in the database.
  const { stats } = useLicensesStats();

  const toggleSelectLicense = (id: string) => {
    setSelectedLicenseIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };

  const toggleSelectLicenses = (rows: any[]) => {
    const ids = rows.map((row) => row.id);
    const allSelected = ids.length > 0 && ids.every((id) => selectedLicenseIds.includes(id));
    setSelectedLicenseIds((current) => {
      if (allSelected) return current.filter((id) => !ids.includes(id));
      return Array.from(new Set([...current, ...ids]));
    });
  };

  const renderSelectAction = (rows: any[], testId: string) => {
    if (rows.length === 0) return undefined;
    const allSelected = rows.every((row) => selectedLicenseIds.includes(row.id));
    const selectedCount = rows.filter((row) => selectedLicenseIds.includes(row.id)).length;
    return (
      <div className="flex flex-wrap items-center justify-end gap-3">
        {selectedCount > 0 && (
          <Button
            type="button"
            variant="destructive"
            size="sm"
            className="h-8 text-xs gap-1.5"
            onClick={() => setBulkDeleteModal({ open: true, ids: rows.filter((row) => selectedLicenseIds.includes(row.id)).map((row) => row.id) })}
            data-testid={`${testId}-delete-selected`}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Excluir selecionadas
          </Button>
        )}
        <Checkbox
          checked={allSelected}
          onCheckedChange={() => toggleSelectLicenses(rows)}
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
    setMediaFilter("all");
  };

  const handleDelete = () => {
    if (deleteModal.licenca) {
      deleteLicense.mutate(deleteModal.licenca.id);
      setDeleteModal({ open: false });
    }
  };

  const handleBulkDelete = async () => {
    const ids = bulkDeleteModal.ids;
    setSelectedLicenseIds((current) => current.filter((id) => !ids.includes(id)));
    setBulkDeleteModal({ open: false, ids: [] });
    const result = await runBulkAction(ids, (id) => deleteLicense.mutateAsync(id));
    reportBulkResult(result, "excluída", "licença");
  };

  const metrics = useMemo(() => ({
    total: stats.total,
    active: stats.byGroup[LicenseStatus.ACTIVE] ?? 0,
    proposals: (stats.byGroup[LicenseStatus.NEGOTIATION] ?? 0) + (stats.byGroup[LicenseStatus.PROPOSAL] ?? 0),
    expired: stats.byGroup[LicenseStatus.EXPIRED] ?? 0,
    activeTotalAmount: stats.sumByGroup?.[LicenseStatus.ACTIVE] ?? 0,
  }), [stats]);

  const headerActions = (
    <RequirePermission module="licensing" action="write">
      <Button size="sm" className="h-8 text-xs gap-1.5" onClick={() => setLicenseModal({ open: true, mode: "create" })} data-testid="button-nova-licenca">
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
          <MetricCard title="Total Licenças" value={metrics.total} icon={FileText} accent="primary" />
          <MetricCard title="Licenças Ativas" value={metrics.active} icon={Music} accent="success" />
          <MetricCard title="Em Negociação" value={metrics.proposals} icon={Clock} accent="warning" />
          <MetricCard title="Expirado" value={metrics.expired} icon={Shield} accent="destructive" />
          <MetricCard title="Valor Total" value={formatCurrency(metrics.activeTotalAmount)} icon={DollarSign} accent="primary" />
        </div>

        <div className="flex items-center gap-2">
          <Button variant={activeTab === "catalog" ? "default" : "outline"} size="sm" onClick={() => setActiveTab("catalog")} className={activeTab === "catalog" ? "bg-muted text-foreground hover:bg-muted" : ""}>Catálogo de Licenças</Button>
          <Button variant={activeTab === "proposals" ? "default" : "outline"} size="sm" onClick={() => setActiveTab("proposals")} className={activeTab === "proposals" ? "bg-muted text-foreground hover:bg-muted" : ""}>Propostas</Button>
          <Button variant={activeTab === "active" ? "default" : "outline"} size="sm" onClick={() => setActiveTab("active")} className={activeTab === "active" ? "bg-muted text-foreground hover:bg-muted" : ""}>Licenças Ativas</Button>
        </div>

        {activeTab === "catalog" && (
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
                  {LICENSE_STATUS_VALUES.map((value) => (
                    <SelectItem key={value} value={value}>{licenseStatusLabel(value)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={mediaFilter} onValueChange={setMediaFilter}>
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
                    {pageItems.map((license) => (
                      <TableRow key={license.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedLicenseIds.includes(license.id)}
                            onCheckedChange={() => toggleSelectLicense(license.id)}
                            aria-label={`Selecionar licença ${license.title || license.id}`}
                            data-testid={`checkbox-licenca-${license.id}`}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{license.title || "—"}</TableCell>
                        <TableCell>
                          <div className="min-w-0">
                            <p className="font-medium truncate">{workTitleOf(license) ?? "—"}</p>
                            {artistOf(license) && <p className="text-xs text-muted-foreground truncate">{artistOf(license)}</p>}
                          </div>
                        </TableCell>
                        <TableCell>{clientNameOf(license) ?? "—"}</TableCell>
                        <TableCell>{license.target_media ? <Badge variant="neutral">{mediaLabel(license.target_media)}</Badge> : "—"}</TableCell>
                        <TableCell className="font-semibold text-success">{formatRemuneration(license)}</TableCell>
                        <TableCell>{getStatusBadge(license.status ?? "")}</TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setViewModal({ open: true, licenca: license })}>
                                <Eye className="h-4 w-4 mr-2" />
                                Ver
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setLicenseModal({ open: true, mode: "edit", licenca: license })}>
                                <Pencil className="h-4 w-4 mr-2" />
                                Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setDeleteModal({ open: true, licenca: license })} className="text-destructive">
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
                  onAction={() => setLicenseModal({ open: true, mode: "create" })}
                />
              )}
              </CardContent>
            </Card>
          </>
        )}

        {activeTab === "proposals" && (
          <Card>
            <CardContent className="p-6">
              <ListSectionHeader
                title="Propostas em Andamento"
                count={total}
                description="Acompanhe propostas de licenciamento em negociação e aguardando resposta"
                action={renderSelectAction(pageItems, "checkbox-select-all-proposals")}
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
                      {pageItems.map((license) => (
                        <TableRow key={license.id}>
                          <TableCell>
                            <Checkbox
                              checked={selectedLicenseIds.includes(license.id)}
                              onCheckedChange={() => toggleSelectLicense(license.id)}
                              aria-label={`Selecionar licença ${license.title || license.id}`}
                              data-testid={`checkbox-proposal-${license.id}`}
                            />
                          </TableCell>
                          <TableCell className="font-medium">{license.title || "—"}</TableCell>
                          <TableCell>
                            <div className="min-w-0">
                              <p className="font-medium truncate">{workTitleOf(license) ?? "—"}</p>
                              {artistOf(license) && <p className="text-xs text-muted-foreground truncate">{artistOf(license)}</p>}
                            </div>
                          </TableCell>
                          <TableCell>{clientNameOf(license) ?? "—"}</TableCell>
                          <TableCell>{license.target_media ? <Badge variant="neutral">{mediaLabel(license.target_media)}</Badge> : "—"}</TableCell>
                          <TableCell className="font-semibold text-success">{formatRemuneration(license)}</TableCell>
                          <TableCell>{getStatusBadge(license.status ?? "")}</TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => setViewModal({ open: true, licenca: license })}>
                                  <Eye className="h-4 w-4 mr-2" />
                                  Ver
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setLicenseModal({ open: true, mode: "edit", licenca: license })}>
                                  <Pencil className="h-4 w-4 mr-2" />
                                  Editar
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setDeleteModal({ open: true, licenca: license })} className="text-destructive">
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

        {activeTab === "active" && (
          <Card>
            <CardContent className="p-6">
              <ListSectionHeader
                title="Licenças Ativas"
                count={total}
                description="Acompanhe licenças ativas, clientes, mídias, vigência e valores"
                action={renderSelectAction(pageItems, "checkbox-select-all-active")}
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
                      {pageItems.map((license) => (
                        <TableRow key={license.id}>
                          <TableCell>
                            <Checkbox
                              checked={selectedLicenseIds.includes(license.id)}
                              onCheckedChange={() => toggleSelectLicense(license.id)}
                              aria-label={`Selecionar licença ${license.title || license.id}`}
                              data-testid={`checkbox-ativa-${license.id}`}
                            />
                          </TableCell>
                          <TableCell className="font-medium">{license.title || "—"}</TableCell>
                          <TableCell>
                            <div className="min-w-0">
                              <p className="font-medium truncate">{workTitleOf(license) ?? "—"}</p>
                              {artistOf(license) && <p className="text-xs text-muted-foreground truncate">{artistOf(license)}</p>}
                            </div>
                          </TableCell>
                          <TableCell>{clientNameOf(license) ?? "—"}</TableCell>
                          <TableCell>{license.target_media ? <Badge variant="neutral">{mediaLabel(license.target_media)}</Badge> : "—"}</TableCell>
                          <TableCell className="font-semibold text-success">{formatRemuneration(license)}</TableCell>
                          <TableCell>{getStatusBadge(license.status ?? "")}</TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => setViewModal({ open: true, licenca: license })}>
                                  <Eye className="h-4 w-4 mr-2" />
                                  Ver
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setLicenseModal({ open: true, mode: "edit", licenca: license })}>
                                  <Pencil className="h-4 w-4 mr-2" />
                                  Editar
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setDeleteModal({ open: true, licenca: license })} className="text-destructive">
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

      {/* Outside the isLoading gate on purpose — same bug as /artists
          (Task C): LicenseFormModal calls useLicenses() again only for the
          create/update mutations, the same query as the isLoading above.
          Mounting it only after isLoading turned false created a new observer
          on that query; on error (backend down), refetchOnMount
          reopened isLoading, the gate unmounted the modal again — an infinite
          loading loop. Keeping them always mounted breaks the cycle. */}
      <LicenseFormModal open={licenseModal.open} onOpenChange={(open) => setLicenseModal({ ...licenseModal, open })} licenca={licenseModal.licenca} mode={licenseModal.mode} />
      <LicenseViewModal open={viewModal.open} onOpenChange={(open) => setViewModal({ ...viewModal, open })} licenca={viewModal.licenca} />
      <DeleteConfirmModal open={deleteModal.open} onOpenChange={(open) => setDeleteModal({ ...deleteModal, open })} title="Excluir Licença" description={`Tem certeza que deseja excluir "${deleteModal.licenca?.title}"?`} onConfirm={handleDelete} />
      <DeleteConfirmModal open={bulkDeleteModal.open} onOpenChange={(open) => setBulkDeleteModal({ ...bulkDeleteModal, open })} title="Excluir licenças selecionadas" description={`Tem certeza que deseja excluir ${bulkDeleteModal.ids.length} licenca(s) selecionada(s)?`} onConfirm={handleBulkDelete} />
    </>
    </FeatureGate>
  );
}
