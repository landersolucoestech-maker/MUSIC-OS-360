import { useCallback, useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { runBulkAction, reportBulkResult } from "@/shared/hooks/useBulkAction";
import { useEditQueryParam } from "@/shared/hooks/useEditQueryParam";
import { storage } from "@/shared/lib/storage";
import { MainLayout } from "@/shared/components/MainLayout";
import { ListSectionHeader } from "@/shared/components/ListSectionHeader";
import { Card, CardContent } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Checkbox } from "@/shared/ui/checkbox";
import { Badge } from "@/shared/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/shared/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/shared/ui/dropdown-menu";
import {
  Music, Radio, Eye, Plus, Search,
  Loader2, Trash2, MoreHorizontal, Pencil, BarChart3,
  CheckCircle2, Timer, Library, Clock, AlertTriangle, Info,
} from "lucide-react";
import { LancamentoFormModal } from "@/modules/releases/components/LancamentoFormModal";
import { LancamentoViewModal } from "@/modules/releases/components/LancamentoViewModal";
import { DeleteConfirmModal } from "@/shared/components/DeleteConfirmModal";
import { EmptyState } from "@/shared/components/EmptyState";
import { UnavailableState } from "@/shared/components/UnavailableState";
import { TablePagination } from "@/shared/ui/table-pagination";
import { useDebounce } from "@/shared/hooks/useDebounce";
import { useLancamentos } from "@/modules/releases/hooks/useLancamentos";
import { useLancamentosPaginated, useLancamentosDistributionStats } from "@/modules/releases/hooks/useLancamentosPaginated";
import { useShares } from "@/modules/releases/hooks/useShares";
import { AsyncEntityCombobox } from "@/shared/components/AsyncEntityCombobox";
import { useImageContrast } from "@/shared/hooks/useImageContrast";
import { contrastText, contrastSubtext, contrastChrome, contrastScrim } from "@/shared/lib/image-contrast";
import { cardStatusClasses, RELEASE_STATUS_OPTIONS } from "@/modules/releases/lib/release-status";
import { formatReleaseDate } from "@/modules/releases/lib/release-format";
import { shareFlowFromReleaseUrl } from "@/modules/releases/services/share-from-release";
import type { Lancamento } from "@/modules/releases/types";
import type { Artist } from "@/modules/artist/types/artist.types";
import { wireToArtist, type ArtistWireRecord } from "@/modules/artist/services/artist.mapper";


function getReleaseArtworkUrl(release: Lancamento & Record<string, unknown>): string | null {
  const metadata = release.metadata as Record<string, unknown> | null | undefined;
  const metadataAssets = metadata?.["assets"] as Record<string, unknown> | null | undefined;
  const directAssets = release.assets as Record<string, unknown> | null | undefined;
  return (
    (release.capa_url as string | null | undefined) ??
    (directAssets?.["capa_url"] as string | null | undefined) ??
    (metadataAssets?.["capa_url"] as string | null | undefined) ??
    null
  );
}

interface Countdown { days: string; hours: string; minutes: string; seconds: string; label: string }
function getCountdown(date: string | null | undefined, now: number): Countdown {
  const empty = { days: "--", hours: "--", minutes: "--", seconds: "--", label: "Data pendente" };
  if (!date) return empty;
  const target = new Date(date).getTime();
  if (Number.isNaN(target)) return empty;
  const diff = Math.max(0, target - now);
  return {
    days: String(Math.floor(diff / 86400000)).padStart(2, "0"),
    hours: String(Math.floor((diff % 86400000) / 3600000)).padStart(2, "0"),
    minutes: String(Math.floor((diff % 3600000) / 60000)).padStart(2, "0"),
    seconds: String(Math.floor((diff % 60000) / 1000)).padStart(2, "0"),
    label: diff === 0 ? "Publicado" : "para o lançamento",
  };
}

interface ReleaseCardProps {
  release: Lancamento & Record<string, unknown>;
  artista?: Artist;
  now: number;
  selected: boolean;
  onToggleSelect: () => void;
  onView: () => void;
  onEdit: () => void;
  onMetrics: () => void;
  onDelete: () => void;
}

/**
 * Card de release com contraste automático: detecta a luminância da capa e adapta
 * texto/badges/chrome para legibilidade tanto sobre capas claras quanto escuras.
 */
function ReleaseCard({ release, artista, now, selected, onToggleSelect, onView, onEdit, onMetrics, onDelete }: ReleaseCardProps) {
  const artworkUrl = getReleaseArtworkUrl(release);
  const { mode } = useImageContrast(artworkUrl);
  const status = cardStatusClasses(release, mode);
  const countdown = getCountdown(release.data_lancamento, now);
  // Countdown só faz sentido enquanto a data de lançamento não chegou.
  const releaseTime = release.data_lancamento ? new Date(release.data_lancamento).getTime() : NaN;
  const showCountdown = !Number.isNaN(releaseTime) && releaseTime > now;
  const releaseType = release.type === "single" ? "Single" : release.type === "ep" ? "EP" : "Album";
  const genre = (release.genero as string | null) ?? artista?.musicGenre ?? "Genre TBA";
  const text = contrastText(mode);
  const subtext = contrastSubtext(mode);
  const chrome = contrastChrome(mode);

  return (
    <Card
      data-testid={`card-lancamento-${release.id}`}
      className="relative flex flex-col overflow-hidden border-border bg-background text-foreground"
    >
      <div className="relative h-96 overflow-hidden">
        {artworkUrl ? (
          <img src={artworkUrl} alt={release.title} className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-muted">
            <Music className="h-20 w-20 text-muted-foreground" />
          </div>
        )}

        {/* Scrim para reforçar contraste do conteúdo na base */}
        <div className={`pointer-events-none absolute inset-0 ${contrastScrim(mode)}`} />

        <div className="absolute left-4 top-4 z-10 flex items-center gap-2">
          <Checkbox
            checked={selected}
            onCheckedChange={onToggleSelect}
            onClick={(event) => event.stopPropagation()}
            aria-label={`Selecionar lançamento ${release.title}`}
            data-testid={`checkbox-lancamento-${release.id}`}
          />
          <Badge className={`border px-2 py-1 text-[10px] font-bold tracking-[0.18em] ${status.className} no-default-hover-elevate no-default-active-elevate`}>
            {status.label}
          </Badge>
        </div>

        <div className="absolute right-4 top-4 z-10">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" className={`h-9 w-9 rounded-full border ${chrome}`} onClick={(e) => e.stopPropagation()}>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 border-border bg-background/95 text-muted-foreground">
              <DropdownMenuItem data-testid={`button-ver-lancamento-${release.id}`} onClick={onView}>
                <Eye className="mr-2 h-4 w-4" /> Ver detalhes
              </DropdownMenuItem>
              <DropdownMenuItem data-testid={`button-editar-lancamento-${release.id}`} onClick={onEdit}>
                <Pencil className="mr-2 h-4 w-4" /> Editar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onMetrics}>
                <BarChart3 className="mr-2 h-4 w-4" /> Métricas
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-muted" />
              <DropdownMenuItem className="text-rose-600 focus:text-rose-700" data-testid={`button-excluir-lancamento-${release.id}`} onClick={onDelete}>
                <Trash2 className="mr-2 h-4 w-4" /> Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="absolute bottom-4 left-4 right-4 z-10">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge className={`border px-2 py-1 text-[10px] font-semibold tracking-[0.16em] ${chrome} no-default-hover-elevate no-default-active-elevate`}>
              {releaseType}
            </Badge>
            <Badge className={`border px-2 py-1 text-[10px] font-semibold tracking-[0.16em] ${chrome} no-default-hover-elevate no-default-active-elevate`}>
              {genre}
            </Badge>
          </div>
          <h3 className={`line-clamp-2 text-2xl font-black leading-tight tracking-normal ${text}`} data-testid={`text-lancamento-title-${release.id}`}>
            {release.title}
          </h3>
          <p className={`mt-1 text-sm font-medium ${subtext}`} data-testid={`text-lancamento-artista-${release.id}`}>
            {artista?.stageName || "Artista não vinculado"}
          </p>
          {showCountdown && (
            <div className={`mt-3 rounded-lg border p-2.5 ${chrome}`}>
              <div className="mb-2 flex items-center justify-between">
                <div className={`flex items-center gap-2 text-[10px] font-semibold tracking-[0.16em] ${subtext}`}>
                  <Timer className="h-3.5 w-3.5" />
                  Tempo restante
                </div>
                <span className={`text-[10px] ${subtext}`}>{countdown.label}</span>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {([
                  ["dias", countdown.days],
                  ["horas", countdown.hours],
                  ["min", countdown.minutes],
                  ["seg", countdown.seconds],
                ] as const).map(([label, value]) => (
                  <div key={label} className={`rounded-md border px-2 py-1.5 text-center ${chrome}`}>
                    <div className={`text-base font-black leading-none ${text}`}>{value}</div>
                    <div className={`mt-1 text-[8px] font-semibold tracking-[0.12em] ${subtext}`}>{label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

export default function Lancamentos() {
  const { lancamentos, isLoading, deleteLancamento, addLancamento } = useLancamentos();
  const { shares, addShare } = useShares();
  const navigate = useNavigate();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const toggleSelectAll = () => {
    if (selectedIds.length === pageItems.length && pageItems.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(pageItems.map((r: any) => r.id));
    }
  };
  const toggleSelect = (id: string) => setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    const ids = selectedIds;
    setSelectedIds([]);
    const result = await runBulkAction(ids, (id) => deleteLancamento.mutateAsync(id));
    reportBulkResult(result, "excluído", "lançamento");
  };
  const [formModal, setFormModal] = useState<{ open: boolean; mode: "create" | "edit"; lancamento?: any }>({ open: false, mode: "create" });
  const [viewModal, setViewModal] = useState<{ open: boolean; lancamento?: any }>({ open: false });
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; lancamento?: any }>({ open: false });
  const [sharePrompt, setSharePrompt] = useState<{ open: boolean; release?: Lancamento }>({ open: false });

  useEditQueryParam(
    "edit",
    lancamentos,
    useCallback((lancamento) => setFormModal({ open: true, mode: "edit", lancamento }), []),
    "lancamentos",
  );

  // Support ?view=<id> to directly open the view modal (e.g., navigated from
  // ContratoViewModal) — busca por ID direto quando o lançamento não está
  // entre os primeiros carregados por useLancamentos() sem filtro (Task I).
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    const viewId = searchParams.get("view");
    if (!viewId) return;
    const target = lancamentos.find((l) => l.id === viewId);
    if (target) {
      setViewModal({ open: true, lancamento: target });
      setSearchParams((prev) => { prev.delete("view"); return prev; }, { replace: true });
      return;
    }
    if (lancamentos.length === 0) return;
    let cancelled = false;
    storage.findById<Lancamento & { id: string }>("lancamentos", viewId).then((found) => {
      if (cancelled || !found) return;
      setViewModal({ open: true, lancamento: found });
      setSearchParams((prev) => { prev.delete("view"); return prev; }, { replace: true });
    });
    return () => { cancelled = true; };
  }, [searchParams, lancamentos, setSearchParams]);

  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("all-type");
  const [statusFilter, setStatusFilter] = useState("all-status");
  const [artistFilter, setArtistFilter] = useState("all-artist");
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  // KPIs operacionais de distribuição — agregação exata do tenant inteiro
  // (GET /releases/stats), nunca calculada só sobre a página carregada (Task H).
  const { kpis: distributionKPIs } = useLancamentosDistributionStats();

  const hasActiveFilters = searchTerm !== "" || typeFilter !== "all-type" || statusFilter !== "all-status" || artistFilter !== "all-artist";

  const debouncedSearch = useDebounce(searchTerm, 300);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(12);
  useEffect(() => {
    setPage(0);
  }, [debouncedSearch, typeFilter, statusFilter, artistFilter]);

  const {
    lancamentos: pageItems, total, isLoading: isLoadingPage, error: pageError, refetch: refetchPage,
  } = useLancamentosPaginated({
    page, pageSize, search: debouncedSearch || undefined,
    status: statusFilter !== "all-status" ? statusFilter : undefined,
    type: typeFilter !== "all-type" ? typeFilter : undefined,
    artistId: artistFilter !== "all-artist" ? artistFilter : undefined,
  });

  // Task J: nome/gênero do artista por card, resolvidos por ID direto (GET
  // /artists/:id) só para os releases da página atual — antes escaneava
  // useArtistas() sem filtro, truncado nos primeiros 50 do tenant.
  const [resolvedArtistas, setResolvedArtistas] = useState<Record<string, Artist>>({});
  const pageArtistaIds = useMemo(
    () => Array.from(new Set(pageItems.map((r) => r.artist_id).filter((id): id is string => !!id))),
    [pageItems],
  );
  useEffect(() => {
    if (pageArtistaIds.length === 0) return;
    let cancelled = false;
    Promise.all(pageArtistaIds.map((id) => storage.findById<ArtistWireRecord>("artistas", id)))
      .then((results) => {
        if (cancelled) return;
        const map: Record<string, Artist> = {};
        results.forEach((a, i) => { if (a) map[pageArtistaIds[i]] = wireToArtist(a); });
        setResolvedArtistas((prev) => ({ ...prev, ...map }));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [pageArtistaIds]);
  const getArtistaById = (id: string | null) => id ? resolvedArtistas[id] : undefined;

  const handleClearFilters = () => {
    setSearchTerm("");
    setTypeFilter("all-type");
    setStatusFilter("all-status");
    setArtistFilter("all-artist");
  };

  const handleDelete = () => {
    if (deleteModal.lancamento) {
      deleteLancamento.mutate(deleteModal.lancamento.id);
      setDeleteModal({ open: false });
    }
  };

  const ensureInitialShare = useCallback(async (release: Lancamento) => {
    if (!release.id || shares.some((share) => share.release_id === release.id)) return;
    // Busca DIRETO por ID — o release recém-criado pode não estar (ainda)
    // no batch resolvido para a página atual (Task J).
    const artistaWire = release.artist_id
      ? await storage.findById<ArtistWireRecord>("artistas", release.artist_id)
      : undefined;
    const artista = artistaWire ? wireToArtist(artistaWire) : undefined;

    await addShare.mutateAsync({
      share_type: "internal_release",
      release_id: release.id,
      artist_id: release.artist_id ?? null,
      music_title: release.title ?? null,
      holder: artista?.stageName ?? release.title ?? "Lancamento",
      recipient: null,
      type: "interprete",
      direction: "a_enviar",
      percentage: 100,
      status: "pendente",
      notes: "Share inicial criado automaticamente após distribuição do lançamento.",
      versao: 1,
      historico: [{
        versao: 1,
        data: new Date().toISOString().split("T")[0],
        acao: "criado_automaticamente",
        descricao: "Share inicial criado pelo fluxo de distribuição automática.",
      }],
    } as never);
  }, [addShare, shares]);

  const handleReleaseCreatedAndDistributed = useCallback(async (release: Lancamento) => {
    await ensureInitialShare(release);
    setSharePrompt({ open: true, release });
  }, [ensureInitialShare]);

  const handleCreateSharesNow = () => {
    const releaseId = sharePrompt.release?.id;
    setSharePrompt({ open: false });
    if (releaseId) navigate(shareFlowFromReleaseUrl(releaseId));
  };

  const headerActions = (
    <Button size="sm" className="gap-2 bg-primary" data-testid="button-novo-lancamento" onClick={() => setFormModal({ open: true, mode: "create" })}>
      <Plus className="h-4 w-4" />
      Novo Lançamento
    </Button>
  );

  return (
    <>
    {isLoading || isLoadingPage ? (
      <MainLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </MainLayout>
    ) : (
    <MainLayout title="Lançamentos" description="Gestão de lançamentos e distribuição" actions={headerActions}>
      <div className="space-y-6">
        {/* KPIs operacionais de distribuição */}
        <TooltipProvider delayDuration={200}>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {([
              { key: "total", label: "Total de Releases", value: distributionKPIs.total, subtitle: "lançamentos cadastrados", icon: Library, color: "text-blue-500", tooltip: "Quantidade total de lançamentos cadastrados no sistema." },
              { key: "distributed", label: "Distribuídos", value: distributionKPIs.distributed, subtitle: "ativos nas plataformas", icon: CheckCircle2, color: "text-green-500", tooltip: "Lançamentos já distribuídos para as plataformas." },
              { key: "pending", label: "Pendentes", value: distributionKPIs.pending, subtitle: "aguardando processamento", icon: Clock, color: "text-yellow-500", tooltip: "Lançamentos aguardando processamento ou validação." },
              { key: "waitingAction", label: "Aguardando Ação", value: distributionKPIs.waitingAction, subtitle: "necessitam intervenção", icon: AlertTriangle, color: "text-red-500", tooltip: "Lançamentos que exigem correção, atualização ou intervenção operacional." },
            ] as const).map((kpi) => (
              <Card key={kpi.key} className="bg-card border-border" data-testid={`kpi-${kpi.key}`}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1 text-sm text-muted-foreground">
                      {kpi.label}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-3 w-3 cursor-help text-muted-foreground/60" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-[220px]">{kpi.tooltip}</TooltipContent>
                      </Tooltip>
                    </span>
                    <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
                  </div>
                  <div className="mt-2">
                    <span className="text-2xl font-bold text-foreground">{kpi.value}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{kpi.subtitle}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TooltipProvider>

        {/* Search, Filters and View Toggle */}
        <div className="flex items-center gap-3 flex-wrap rounded-lg bg-muted/30 p-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por título ou artista..."
              className="pl-10 h-8 text-sm bg-card border-border"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="h-8 w-[126px] shrink-0 bg-card border-border text-sm">
              <SelectValue placeholder="Todos Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all-type">Todos Tipo</SelectItem>
              <SelectItem value="single">Single</SelectItem>
              <SelectItem value="álbum">Álbum</SelectItem>
              <SelectItem value="ep">EP</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-8 w-[142px] shrink-0 bg-card border-border text-sm">
              <SelectValue placeholder="Todos Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all-status">Todos Status</SelectItem>
              {RELEASE_STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {/* Task J: busca server-side (AsyncEntityCombobox) — antes populava o
              Select com useArtistas() sem filtro, truncado nos primeiros 50
              artistas do tenant. "Todos Artistas" volta via o botão Limpar. */}
          <div className="h-8 w-[180px] shrink-0">
            <AsyncEntityCombobox<Artist>
              table="artistas"
              getLabel={(a) => a.stageName ?? ""}
              value={artistFilter !== "all-artist" ? artistFilter : null}
              onChange={(id) => setArtistFilter(id)}
              placeholder="Todos Artistas"
              searchPlaceholder="Buscar artista..."
              data-testid="select-filter-artista"
            />
          </div>
          {hasActiveFilters && (
            <Button variant="outline" size="sm" onClick={handleClearFilters}>Limpar</Button>
          )}
        </div>

        <Card className="bg-card border-border">
            <CardContent>
              <ListSectionHeader
                title="Lista de Lançamentos"
                count={total}
                description="Acompanhe todos os seus lançamentos musicais"
                action={total > 0 ? (
                  <div className="flex flex-wrap items-center justify-end gap-3">
                    <Checkbox
                      checked={selectedIds.length === pageItems.length && pageItems.length > 0}
                      onCheckedChange={toggleSelectAll}
                      aria-label="Selecionar todos os lançamentos"
                      data-testid="checkbox-select-all-lancamentos"
                    />
                    <span className="text-xs text-muted-foreground">
                      {selectedIds.length > 0 ? `${selectedIds.length} lançamento(s) selecionado(s)` : "Selecionar todos"}
                    </span>
                    {selectedIds.length > 0 && (
                      <Button variant="destructive" size="sm" className="gap-1 h-7 text-xs" onClick={handleBulkDelete} data-testid="button-bulk-delete">
                        <Trash2 className="h-3.5 w-3.5" />
                        Excluir ({selectedIds.length})
                      </Button>
                    )}
                  </div>
                ) : undefined}
              />
              {pageItems.length > 0 ? (
                <>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  {pageItems.map((release) => (
                    <ReleaseCard
                      key={release.id}
                      release={release}
                      artista={getArtistaById(release.artist_id ?? null)}
                      now={now}
                      selected={selectedIds.includes(release.id)}
                      onToggleSelect={() => toggleSelect(release.id)}
                      onView={() => setViewModal({ open: true, lancamento: release })}
                      onEdit={() => setFormModal({ open: true, mode: "edit", lancamento: release })}
                      onMetrics={() => navigate(`/marketing/metricas?releaseId=${encodeURIComponent(release.id)}`)}
                      onDelete={() => setDeleteModal({ open: true, lancamento: release })}
                    />
                  ))}
                </div>
                <TablePagination
                  total={total}
                  page={page}
                  pageSize={pageSize}
                  onPageChange={setPage}
                  onPageSizeChange={setPageSize}
                  itemLabel="lançamentos"
                />
                </>
              ) : pageError && total === 0 ? (
                <UnavailableState onRetry={() => refetchPage()} />
              ) : (
                <EmptyState
                  icon={Radio}
                  title="Nenhum lançamento encontrado"
                  description="Tente ajustar os filtros ou crie um novo lançamento"
                  actionLabel="Novo Lançamento"
                  onAction={() => setFormModal({ open: true, mode: "create" })}
                />
              )}
            </CardContent>
          </Card>
      </div>
    </MainLayout>
    )}

      {/* Fora do gate de isLoading de propósito — mesmo bug de /artistas
          (Task C): LancamentoFormModal chama useLancamentos() de novo só
          para as mutations, a mesma query do isLoading acima. */}
      <LancamentoFormModal
        open={formModal.open}
        onOpenChange={(open) => setFormModal({ ...formModal, open })}
        lancamento={formModal.lancamento}
        mode={formModal.mode}
        onCreatedAndDistributed={handleReleaseCreatedAndDistributed}
      />
      <LancamentoViewModal open={viewModal.open} onOpenChange={(open) => setViewModal({ ...viewModal, open })} lancamento={viewModal.lancamento} />
      <DeleteConfirmModal open={deleteModal.open} onOpenChange={(open) => setDeleteModal({ ...deleteModal, open })} title="Excluir Lançamento" description={`Tem certeza que deseja excluir "${deleteModal.lancamento?.title}"?`} onConfirm={handleDelete} />
      <Dialog open={sharePrompt.open} onOpenChange={(open) => setSharePrompt((current) => ({ ...current, open }))}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Compartilhar Lançamento</DialogTitle>
            <DialogDescription>
              Seu lançamento foi distribuído com sucesso. Deseja criar o compartilhamento agora?
            </DialogDescription>
          </DialogHeader>
          {sharePrompt.release && (
            <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
              <p className="font-medium text-foreground">{sharePrompt.release.title}</p>
              {formatReleaseDate(sharePrompt.release.data_lancamento) && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Data de lançamento: {formatReleaseDate(sharePrompt.release.data_lancamento)}
                </p>
              )}
            </div>
          )}
          <DialogFooter className="gap-2 sm:justify-end">
            <Button variant="outline" size="sm" onClick={() => setSharePrompt({ open: false })}>
              Fazer Depois
            </Button>
            <Button size="sm" className="h-8 text-xs gap-1.5" onClick={handleCreateSharesNow}>
              Criar Shares Agora
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
