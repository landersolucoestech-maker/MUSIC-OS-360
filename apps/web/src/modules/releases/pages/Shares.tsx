import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { MainLayout } from "@/shared/components/MainLayout";
import { ListSectionHeader } from "@/shared/components/ListSectionHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/shared/ui/card";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { TablePagination } from "@/shared/ui/table-pagination";
import { useDebounce } from "@/shared/hooks/useDebounce";
import { Checkbox } from "@/shared/ui/checkbox";
import {
  Share2, ArrowDownLeft, CheckCircle, ArrowUpRight, Send,
  Plus, Search, Loader2, MoreHorizontal, Eye, Pencil, Trash2,
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/shared/ui/dropdown-menu";
import { toast } from "sonner";
import { runBulkAction, reportBulkResult } from "@/shared/hooks/useBulkAction";
import { getExpectedUpdatedAt, handleConcurrencyConflict } from "@/shared/hooks/useConcurrencyConflict";
import { EmptyState } from "@/shared/components/EmptyState";
import { UnavailableState } from "@/shared/components/UnavailableState";
import { ShareViewModal } from "@/modules/releases/components/ShareViewModal";
import { ShareFormModal } from "@/modules/releases/components/ShareFormModal";
import { DeleteConfirmModal } from "@/shared/components/DeleteConfirmModal";
import { useShares } from "@/modules/releases/hooks/useShares";
import { useSharesPaginated, useSharesStats } from "@/modules/releases/hooks/useSharesPaginated";
import { useReleases } from "@/modules/releases/hooks/useReleases";
import { storage } from "@/shared/lib/storage";
import { resolveShareType, shareTypeLabel, shareStatusBadge, isPendingShareStatus, shareFunctionLabel, SHARE_DIRECTION_LABELS, SHARE_FORM_STATUS_OPTIONS, SHARE_FUNCTION_OPTIONS, SHARE_TYPE_OPTIONS } from "@/modules/releases/lib/share-format";
import { ShareStatus } from "@music-os-360/types";
import { SHARE_FOR_RELEASE_PARAM } from "@/modules/releases/services/share-from-release";
import type { Share } from "@/modules/releases/types";

const ALL_FILTER = "all";

export default function Shares() {
  const { deleteShare, updateShare } = useShares();
  const { releases, isLoading: loadingReleases } = useReleases();

  const [searchTerm, setSearchTerm] = useState("");
  const [directionFilter, setDirectionFilter] = useState(ALL_FILTER);
  const [statusFilter, setStatusFilter] = useState(ALL_FILTER);
  const [typeFilter, setTypeFilter] = useState(ALL_FILTER);
  const [shareTypeFilter, setShareTypeFilter] = useState(ALL_FILTER);
  const [viewModal, setViewModal] = useState<{ open: boolean; share?: any }>({ open: false });
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; share?: any }>({ open: false });
  const [formModal, setFormModal] = useState<{ open: boolean; share?: any; initialReleaseId?: string }>({ open: false });

  // Opens the form with a release preselected when coming from the Releases flow.
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    const relId = searchParams.get(SHARE_FOR_RELEASE_PARAM);
    if (!relId) return;
    setFormModal({ open: true, initialReleaseId: relId });
    setSearchParams((prev) => { prev.delete(SHARE_FOR_RELEASE_PARAM); return prev; }, { replace: true });
  }, [searchParams, setSearchParams]);

  const debouncedSearch = useDebounce(searchTerm, 300);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  useEffect(() => {
    setPage(0);
  }, [debouncedSearch, directionFilter, statusFilter, typeFilter, shareTypeFilter]);

  const {
    shares: pageShares, total, isLoading: isLoadingPage, error: pageError, refetch: refetchPage,
  } = useSharesPaginated({
    page, pageSize, search: debouncedSearch || undefined,
    direction: directionFilter !== ALL_FILTER ? directionFilter : undefined,
    status: statusFilter !== ALL_FILTER ? statusFilter : undefined,
    type: typeFilter !== ALL_FILTER ? typeFilter : undefined,
    shareType: shareTypeFilter !== ALL_FILTER ? shareTypeFilter : undefined,
  });

  const isLoading = loadingReleases || isLoadingPage;

  // ── KPI counts — exact aggregation of the whole tenant (GET /shares/stats),
  // never computed only over the loaded page (Task H). ──────────────────────
  const { kpis: shareKpis } = useSharesStats();
  const { toReceive, received, toSend, sent } = shareKpis;

  const filteredShares = pageShares;
  const sharesPg = { pageItems: filteredShares, total, page, pageSize, setPage, setPageSize };

  // Task J: work title/artist name per row, resolved directly by ID
  // (GET /works/:id, /artists/:id) only for the records of the current
  // page — it used to scan useWorks()/useArtistas() without a filter, truncated
  // to the first 50 of the tenant.
  type WorkLabel = { title?: string | null; composer_name?: string | null };
  type ArtistLabel = { stage_name?: string | null };
  const [resolvedWorks, setResolvedWorks] = useState<Record<string, WorkLabel>>({});
  const [resolvedArtists, setResolvedArtists] = useState<Record<string, ArtistLabel>>({});
  const shareWorkIds = useMemo(
    () => Array.from(new Set(pageShares.map((s: any) => s.work_id).filter(Boolean))) as string[],
    [pageShares],
  );
  const shareArtistIds = useMemo(
    () => Array.from(new Set(pageShares.map((s: any) => s.artist_id).filter(Boolean))) as string[],
    [pageShares],
  );
  useEffect(() => {
    if (shareWorkIds.length === 0) return;
    let cancelled = false;
    Promise.all(shareWorkIds.map((id) => storage.findById<WorkLabel & { id: string }>("works", id)))
      .then((results) => {
        if (cancelled) return;
        const map: Record<string, WorkLabel> = {};
        results.forEach((o, i) => { if (o) map[shareWorkIds[i]] = o; });
        setResolvedWorks((prev) => ({ ...prev, ...map }));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [shareWorkIds]);
  useEffect(() => {
    if (shareArtistIds.length === 0) return;
    let cancelled = false;
    Promise.all(shareArtistIds.map((id) => storage.findById<ArtistLabel & { id: string }>("artists", id)))
      .then((results) => {
        if (cancelled) return;
        const map: Record<string, ArtistLabel> = {};
        results.forEach((a, i) => { if (a) map[shareArtistIds[i]] = a; });
        setResolvedArtists((prev) => ({ ...prev, ...map }));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [shareArtistIds]);

  const handleClearFilters = () => {
    setSearchTerm("");
    setDirectionFilter(ALL_FILTER);
    setStatusFilter(ALL_FILTER);
    setTypeFilter(ALL_FILTER);
    setShareTypeFilter(ALL_FILTER);
  };

  const handleDelete = () => {
    if (deleteModal.share) {
      deleteShare.mutate(deleteModal.share.id);
      setDeleteModal({ open: false });
    }
  };

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelect = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const toggleAll = () =>
    setSelectedIds(
      selectedIds.size === filteredShares.length
        ? new Set()
        : new Set(filteredShares.map((s: any) => s.id)),
    );

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    setSelectedIds(new Set());
    const result = await runBulkAction(ids, (id) => deleteShare.mutateAsync(id));
    reportBulkResult(result, "excluído", "share");
  };

  const handleRegisterSettlement = async (share: any, newStatus: typeof ShareStatus.RECEIVED | typeof ShareStatus.SENT) => {
    try {
      await updateShare.mutateAsync({
        id: share.id,
        status: newStatus,
        settled_amount: share.total_amount,
        expectedUpdatedAt: getExpectedUpdatedAt(share),
      });
      toast.success(newStatus === ShareStatus.RECEIVED ? "Recebimento registrado!" : "Envio registrado!");
    } catch (err) {
      if (handleConcurrencyConflict(err, "share")) return;
    }
  };

  const headerActions = (
    <>
      <Button
        size="sm"
        className="h-8 text-xs gap-1.5"
        onClick={() => setFormModal({ open: true })}
        data-testid="button-register-pending-share"
      >
        <Plus className="h-3.5 w-3.5" />
        Registrar Share
      </Button>
    </>
  );

  const hasActiveFilters =
    searchTerm !== "" ||
    directionFilter !== ALL_FILTER ||
    statusFilter !== ALL_FILTER ||
    typeFilter !== ALL_FILTER ||
    shareTypeFilter !== ALL_FILTER;

  return (
    <>
    {isLoading ? (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </MainLayout>
    ) : (
    <MainLayout title="Gestão de Shares" actions={headerActions}>
      <div className="space-y-6">

        {/* ── KPIs ──────────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-info/10 rounded-lg">
                  <ArrowDownLeft className="h-5 w-5 text-info" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">A Receber</p>
                  <p className="text-2xl font-bold text-foreground" data-testid="metric-to-receive">{toReceive}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500/10 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Recebidos</p>
                  <p className="text-2xl font-bold text-foreground" data-testid="metric-received">{received}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-500/10 rounded-lg">
                  <ArrowUpRight className="h-5 w-5 text-orange-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">A Enviar</p>
                  <p className="text-2xl font-bold text-foreground" data-testid="metric-to-send">{toSend}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Send className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Enviados</p>
                  <p className="text-2xl font-bold text-foreground" data-testid="metric-sent">{sent}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Filters ───────────────────────────────────────────────────────── */}
        <Card className="border-0 shadow-none bg-muted/30">
          <CardContent className="p-3">
            <div className="flex flex-wrap gap-3">
              <div className="relative flex-1 min-w-48">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar obra ou detentor..."
                  className="pl-9 h-8 text-sm bg-card border-border"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  data-testid="input-search"
                />
              </div>
              <Select value={shareTypeFilter} onValueChange={setShareTypeFilter}>
                <SelectTrigger className="w-auto min-w-[140px] h-8 text-sm bg-card border-border" data-testid="select-share-type-filter">
                  <SelectValue placeholder="Tipo de share" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_FILTER}>Todos os tipos</SelectItem>
                  {SHARE_TYPE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={directionFilter} onValueChange={setDirectionFilter}>
                <SelectTrigger className="w-auto min-w-[140px] h-8 text-sm bg-card border-border" data-testid="select-direction">
                  <SelectValue placeholder="Direção" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_FILTER}>Todas as direções</SelectItem>
                  <SelectItem value="receivable">{SHARE_DIRECTION_LABELS.receivable}</SelectItem>
                  <SelectItem value="payable">{SHARE_DIRECTION_LABELS.payable}</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-auto min-w-[140px] h-8 text-sm bg-card border-border" data-testid="select-status">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_FILTER}>Todos os status</SelectItem>
                  {SHARE_FORM_STATUS_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-auto min-w-[140px] h-8 text-sm bg-card border-border" data-testid="select-type">
                  <SelectValue placeholder="Função" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_FILTER}>Todas as funções</SelectItem>
                  {SHARE_FUNCTION_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={handleClearFilters} data-testid="button-clear-filters">
                  Limpar filtros
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ── Table ─────────────────────────────────────────────────────────── */}
        <Card>
          <CardContent className="p-0">
            <ListSectionHeader
              title="Shares Cadastrados"
              count={total}
              description="Acompanhe participações e percentuais vinculados aos lançamentos"
              className="px-6 pt-6"
              action={total > 0 ? (
                <div className="flex flex-wrap items-center justify-end gap-3">
                  <Checkbox
                    checked={selectedIds.size === filteredShares.length && filteredShares.length > 0}
                    onCheckedChange={toggleAll}
                    data-testid="checkbox-select-all-shares"
                  />
                  <span className="text-xs text-muted-foreground">
                    {selectedIds.size > 0 ? `${selectedIds.size} selecionado(s)` : "Selecionar todos"}
                  </span>
                  {selectedIds.size > 0 && (
                    <Button
                      variant="destructive"
                      size="sm"
                      className="h-7 text-xs gap-1"
                      onClick={handleBulkDelete}
                      data-testid="button-bulk-delete-shares"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Excluir selecionados
                    </Button>
                  )}
                </div>
              ) : undefined}
            />
            {filteredShares.length > 0 ? (
              <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8 pl-6" />
                    <TableHead>Lançamento / Música</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Detentor</TableHead>
                    <TableHead>Função</TableHead>
                    <TableHead className="text-center">%</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sharesPg.pageItems.map((share: any) => {
                    const work = share.work_id ? resolvedWorks[share.work_id] : undefined;
                    const release = releases.find((l: any) => l.id === share.release_id);
                    const artist = share.artist_id ? resolvedArtists[share.artist_id] : undefined;
                    const holderName = artist?.stage_name || share.holder || "—";
                    const sType = resolveShareType(share as Share & Record<string, unknown>);
                    const isPending = isPendingShareStatus(share.status);

                    return (
                      <TableRow key={share.id} data-testid={`row-share-${share.id}`}>
                        <TableCell className="w-8 pl-6">
                          <Checkbox
                            checked={selectedIds.has(share.id)}
                            onCheckedChange={() => toggleSelect(share.id)}
                            data-testid={`checkbox-share-${share.id}`}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-primary/10 rounded-md flex items-center justify-center shrink-0">
                              <Share2 className="h-3.5 w-3.5 text-primary" />
                            </div>
                            <div>
                              <p className="font-medium text-foreground text-sm">{work?.title ?? release?.title ?? share.music_title ?? (share.work_id ? "Obra não encontrada" : "—")}</p>
                              <p className="text-xs text-muted-foreground">{work?.composer_name ?? ""}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={sType === "internal_release" ? "info" : "success"} className="text-xs">
                            {shareTypeLabel(sType)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-foreground text-sm">{holderName}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {shareFunctionLabel(share.type)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center text-foreground text-sm">
                          {share.percentage != null ? `${share.percentage}%` : "—"}
                        </TableCell>
                        <TableCell>{shareStatusBadge(share.status)}</TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" data-testid={`button-actions-${share.id}`}>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                data-testid={`button-ver-${share.id}`}
                                onClick={() => setViewModal({ open: true, share })}
                              >
                                <Eye className="h-4 w-4 mr-2" />
                                Visualizar
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                data-testid={`button-editar-${share.id}`}
                                onClick={() => setFormModal({ open: true, share })}
                              >
                                <Pencil className="h-4 w-4 mr-2" />
                                Editar
                              </DropdownMenuItem>
                              {isPending && share.direction === "receivable" && (
                                <DropdownMenuItem
                                  data-testid={`button-receber-${share.id}`}
                                  onClick={() => handleRegisterSettlement(share, ShareStatus.RECEIVED)}
                                >
                                  <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
                                  Registrar Recebimento
                                </DropdownMenuItem>
                              )}
                              {isPending && share.direction === "payable" && (
                                <DropdownMenuItem
                                  data-testid={`button-enviar-${share.id}`}
                                  onClick={() => handleRegisterSettlement(share, ShareStatus.SENT)}
                                >
                                  <Send className="h-4 w-4 mr-2 text-orange-600" />
                                  Registrar Envio
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                data-testid={`button-excluir-${share.id}`}
                                className="text-destructive"
                                onClick={() => setDeleteModal({ open: true, share })}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <TablePagination
                total={sharesPg.total}
                page={sharesPg.page}
                pageSize={sharesPg.pageSize}
                onPageChange={sharesPg.setPage}
                onPageSizeChange={sharesPg.setPageSize}
                itemLabel="shares"
              />
              </>
            ) : pageError && total === 0 ? (
              <UnavailableState onRetry={() => refetchPage()} />
            ) : (
              <EmptyState
                icon={Share2}
                title="Nenhum share encontrado"
                description={hasActiveFilters ? "Tente ajustar os filtros de busca" : "Registre o primeiro share para começar"}
                action={!hasActiveFilters ? { label: "Registrar Share", onClick: () => setFormModal({ open: true }) } : undefined}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
    )}

      {/* Outside the isLoading gate on purpose — same bug as /artists
          (Task C): ShareFormModal calls useShares() again only for
          the mutations, the same query as the isLoading above. See Artistas.tsx
          for the full explanation of the loop. */}
      <ShareViewModal
        open={viewModal.open}
        onOpenChange={(open) => setViewModal({ ...viewModal, open })}
        share={viewModal.share}
      />

      <DeleteConfirmModal
        open={deleteModal.open}
        onOpenChange={(open) => setDeleteModal({ ...deleteModal, open })}
        onConfirm={handleDelete}
        title="Excluir Share"
        description="Tem certeza que deseja excluir este share? Esta ação não pode ser desfeita."
      />

      <ShareFormModal
        open={formModal.open}
        onOpenChange={(open) => setFormModal({ ...formModal, open })}
        share={formModal.share}
        initialReleaseId={formModal.initialReleaseId}
      />
    </>
  );
}
