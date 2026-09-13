import { useMemo, useState } from "react";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import { MainLayout } from "@/shared/components/MainLayout";
import { ListSectionHeader } from "@/shared/components/ListSectionHeader";
import { DeleteConfirmModal } from "@/shared/components/DeleteConfirmModal";
import { EmptyState } from "@/shared/components/EmptyState";
import { Card, CardContent } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { Input } from "@/shared/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/shared/ui/tabs";
import { DatePickerField } from "@/shared/ui/date-picker-field";
import { Badge, type BadgeVariant } from "@/shared/ui/badge";
import { TablePagination } from "@/shared/ui/table-pagination";
import { usePagination } from "@/shared/hooks/usePagination";
import { EcadIcon } from "@/shared/ui/brand-icons";
import {
  Shield, Search, RefreshCw, Upload, AlertTriangle, X, Trash2,
} from "lucide-react";
import { RightsKPICards } from "../components/RightsKPICards";
import { DetectionsTable, type DetectionRow } from "../components/DetectionsTable";
import { DivergenciasPanel } from "../components/DivergenciasPanel";
import { ResolverDivergenciaModal } from "../components/ResolverDivergenciaModal";
import type { Divergencia } from "../components/DivergenciasPanel";
import { EcadImportModal } from "../components/EcadImportModal";
import { DetectionDetailModal } from "../components/DetectionDetailModal";
import { ECADViewModal, type EcadReportRow } from "@/modules/monitoring/components/ECADViewModal";
import { formatRightsDate } from "../utils/date-format";
import { useDetections } from "@/modules/monitoring/hooks/useDetections";
import { useEcadReports } from "@/modules/monitoring/hooks/useEcadReports";
import { storage } from "@/shared/lib/storage";
import type { ObraWithRelations } from "@/modules/catalog/types/catalog.types";
import type { CatalogObraRef } from "../types";
import { FeatureGate } from '@/shared/components/FeatureGate';

type Tab = "detections" | "ecad" | "divergencias";

const fmtBRL = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);

const STATUS_VARIANT: Record<string, BadgeVariant> = {
  concluido: "success", importado: "info", pendente: "warning", erro: "danger",
};
const STATUS_ECAD_LABEL: Record<string, string> = {
  pendente: "Pendente", importado: "Importado", concluido: "Concluído", erro: "Erro",
};

export default function RightsMonitoring() {
  const [activeTab, setActiveTab] = useState<Tab>("detections");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [pendingBulkDelete, setPendingBulkDelete] = useState<string[] | null>(null);
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [artistaFilter, setArtistFilter] = useState("all");
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [selectedExec, setSelectedExec] = useState<DetectionRow | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedEcad, setSelectedEcad] = useState<EcadReportRow | null>(null);
  const [ecadDetailOpen, setEcadDetailOpen] = useState(false);
  // Resolução de divergências — estado local da sessão (não há campo de
  // resolução persistido no backend de content_detections).
  const [divOverrides, setDivOverrides] = useState<Record<string, Partial<Divergencia>>>({});
  const [selectedDivergencia, setSelectedDivergencia] = useState<Divergencia | null>(null);
  const [resolverOpen, setResolverOpen] = useState(false);

  const { detections, isLoading: loadingDet, deleteDetection, refetch: refetchDet } = useDetections();
  const { reports, isLoading: loadingEcad, refetch: refetchEcad } = useEcadReports();
  const queryClient = useQueryClient();

  // Resolução de catálogo por work_id — SEMPRE por ID (GET /works/:id), nunca
  // varrendo a lista truncada de useObras() (guard no-unbounded-hook-as-picker:
  // detecções/relatórios podem referenciar mais obras do que os ~50 primeiros
  // do tenant). Conjunto de ids é o real vínculo presente nos dados, não uma
  // lista arbitrária.
  const workIds = useMemo(() => {
    const ids = new Set<string>();
    for (const d of detections) if (d.work_id) ids.add(d.work_id);
    for (const r of reports) if (r.work_id) ids.add(r.work_id);
    return [...ids];
  }, [detections, reports]);

  const obraQueries = useQueries({
    queries: workIds.map((id) => ({
      queryKey: ["byId", "obras", id],
      queryFn: () => storage.findById<ObraWithRelations & { id: string }>("obras", id),
      staleTime: 30_000,
    })),
  });
  const loadingObras = obraQueries.some((q) => q.isLoading);

  function handleSync() {
    refetchDet();
    refetchEcad();
    queryClient.invalidateQueries({ queryKey: ["byId", "obras"] });
  }

  // Índice de catálogo por id de obra — enriquecimento real (work_id é o
  // vínculo real de content_detections/ecad_reports; não há join server-side).
  const obraIndex = useMemo(() => {
    const map = new Map<string, CatalogObraRef>();
    obraQueries.forEach((q, i) => {
      const o = q.data;
      if (!o) return;
      map.set(workIds[i], {
        id: o.id,
        title: o.title,
        compositor: o.compositor ?? null,
        compositores: (o.compositores as string | string[] | null) ?? null,
        editora: o.editora ?? null,
        isrc: o.isrc ?? null,
        iswc: o.iswc ?? null,
        cod_ecad: o.cod_ecad ?? null,
        cod_entidade: o.cod_entidade ?? null,
        genero: o.genero ?? null,
        status: (o.status as string) ?? null,
        duracao: o.duracao ?? null,
        artista_nome: o.artistas?.nome_artistico ?? null,
      });
    });
    return map;
  }, [obraQueries, workIds]);

  const artistaOptions = useMemo(() => {
    const names = new Set<string>();
    for (const o of obraIndex.values()) {
      if (o.artista_nome) names.add(o.artista_nome);
    }
    return [...names].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [obraIndex]);

  const enrichedDetections: DetectionRow[] = useMemo(
    () => detections.map((det) => ({ ...det, obra: det.work_id ? obraIndex.get(det.work_id) : undefined })),
    [detections, obraIndex],
  );

  const enrichedReports: EcadReportRow[] = useMemo(
    () => reports.map((r) => ({ ...r, obra: r.work_id ? obraIndex.get(r.work_id) : undefined })),
    [reports, obraIndex],
  );

  const hasActiveFilters = search.trim() !== "" || dateFrom !== "" || dateTo !== "" || artistaFilter !== "all";

  function clearFilters() {
    setSearch("");
    setDateFrom("");
    setDateTo("");
    setArtistFilter("all");
  }

  const filtered = useMemo(() => {
    return enrichedDetections.filter((det) => {
      if (artistaFilter !== "all" && det.obra?.artista_nome !== artistaFilter) return false;
      if (dateFrom) {
        const d = det.detectado_em.split("T")[0];
        if (d < dateFrom) return false;
      }
      if (dateTo) {
        const d = det.detectado_em.split("T")[0];
        if (d > dateTo) return false;
      }
      if (search.trim()) {
        const q = search.toLowerCase();
        const match =
          (det.obra?.title ?? det.titulo_detectado ?? "").toLowerCase().includes(q) ||
          det.plataforma.toLowerCase().includes(q) ||
          det.type.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [enrichedDetections, search, dateFrom, dateTo, artistaFilter]);

  const detectionsPg = usePagination(filtered, 10);

  const completed = filtered.filter((d) => d.status === "completed").length;
  const pending  = filtered.filter((d) => d.status === "pending").length;
  const matched    = filtered.filter((d) => d.obra?.cod_ecad).length;
  const matchRate  = filtered.length > 0 ? Math.round((matched / filtered.length) * 100) : 0;
  const receivedEcadAmount = enrichedReports
    .filter((r) => r.status === "concluido")
    .reduce((s, r) => s + Number(r.valor_liquido ?? r.valor_bruto ?? 0), 0);

  // Divergências dinâmicas: detecções sem obra vinculada, ou vinculadas a uma
  // obra sem cod_ecad cadastrado (sem conciliação ECAD possível).
  const dynamicDivergencias: Divergencia[] = useMemo(() =>
    filtered
      .filter((det) => !det.obra || !det.obra.cod_ecad)
      .map((det) => ({
        id: `div-${det.id}`,
        type: det.obra ? "Obra sem código ECAD" : "Detecção sem obra vinculada",
        descricao: det.obra
          ? `Detecção em "${det.plataforma}" está vinculada à obra "${det.obra.title}", mas ela não possui código ECAD cadastrado.`
          : `Detecção em "${det.plataforma}" (${det.titulo_detectado ?? "sem título"}) não possui obra vinculada no catálogo interno.`,
        obra: det.obra?.title,
        origem: det.plataforma,
        severity: det.obra ? "media" as const : "alta" as const,
        risco_score: det.obra ? 45 : 65,
        data: det.detectado_em.split("T")[0],
        status: "aberta" as const,
      })),
    [filtered],
  );

  const allDivergencias: Divergencia[] = useMemo(() => {
    return dynamicDivergencias.map((d) =>
      divOverrides[d.id] ? { ...d, ...divOverrides[d.id] } : d,
    );
  }, [dynamicDivergencias, divOverrides]);

  const openDivergencias = allDivergencias.filter((d) => d.status !== "resolvida");

  const handleResolveDivergencia = (updated: Divergencia) => {
    setDivOverrides((prev) => ({
      ...prev,
      [updated.id]: {
        status: updated.status,
        observacoes: updated.observacoes,
        data_resolucao: updated.data_resolucao,
        historico: updated.historico,
      },
    }));
  };

  const TABS: { key: Tab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { key: "detections",   label: "Detecções",     icon: <Shield className="h-4 w-4" /> },
    { key: "ecad",         label: "ECAD",          icon: <EcadIcon className="h-4 w-4" />, badge: enrichedReports.length },
    { key: "divergencias", label: "Divergências",  icon: <AlertTriangle className="h-4 w-4" />, badge: openDivergencias.length },
  ];

  function handleViewDetail(det: DetectionRow) {
    setSelectedExec(det);
    setDetailOpen(true);
  }

  function toggleSelect(id: string) {
    setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }
  function toggleSelectAll() {
    setSelectedIds((current) =>
      current.length === detectionsPg.pageItems.length && detectionsPg.pageItems.length > 0
        ? []
        : detectionsPg.pageItems.map((d) => d.id),
    );
  }

  async function handleConfirmBulkDelete() {
    if (!pendingBulkDelete) return;
    await Promise.all(pendingBulkDelete.map((id) => deleteDetection.mutateAsync(id)));
    setSelectedIds([]);
    setPendingBulkDelete(null);
  }

  return (
    <MainLayout
      title="Monitoramento de Direitos"
      description="Detecções de conteúdo, reconciliação com relatórios ECAD e divergências de catálogo"
      actions={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={handleSync} data-testid="button-sync-catalog">
            <RefreshCw className="h-3.5 w-3.5" />Sincronizar
          </Button>
          <Button size="sm" className="h-8 text-xs gap-1.5" onClick={() => setImportModalOpen(true)} data-testid="button-import-ecad">
            <Upload className="h-3.5 w-3.5" />Importar ECAD
          </Button>
        </div>
      }
    >
      <div className="space-y-5">

        <RightsKPICards
          total={filtered.length}
          completed={completed}
          pending={pending}
          divergences={openDivergencias.length}
          matchRate={matchRate}
          receivedEcadAmount={receivedEcadAmount}
          totalEcadReports={enrichedReports.length}
        />

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as Tab)} className="space-y-5">
          <TabsList className="flex h-auto flex-wrap justify-start gap-1">
            {TABS.map((tab) => (
              <TabsTrigger key={tab.key} value={tab.key} className="gap-1.5" data-testid={`tab-${tab.key}`}>
                {tab.icon}
                {tab.label}
                {tab.badge !== undefined && tab.badge > 0 && (
                  <Badge variant="neutral" className="ml-1">{tab.badge}</Badge>
                )}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* ── Detecções ── */}
          <TabsContent value="detections" className="mt-0">
            <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg bg-muted/30 p-3">
              <div className="flex items-center gap-1">
                <DatePickerField value={dateFrom} onChange={setDateFrom} placeholder="Data inicial" className="h-8 w-[126px] shrink-0 bg-card border-border text-sm" data-testid="input-date-from" />
                <span className="text-muted-foreground text-xs px-1">até</span>
                <DatePickerField value={dateTo} onChange={setDateTo} placeholder="Data final" className="h-8 w-[126px] shrink-0 bg-card border-border text-sm" data-testid="input-date-to" />
              </div>
              <div className="relative min-w-[220px] flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input placeholder="Buscar obra, plataforma, type..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 h-8 text-sm bg-card border-border" data-testid="input-search-execucoes" />
              </div>
              <Select value={artistaFilter} onValueChange={setArtistFilter}>
                <SelectTrigger className="h-8 w-auto min-w-[142px] shrink-0 bg-card border-border text-sm" data-testid="select-artista-filter">
                  <SelectValue placeholder="Todos os artistas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os artistas</SelectItem>
                  {artistaOptions.map((a) => (
                    <SelectItem key={a} value={a}>{a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" className="h-8 px-2 gap-1 text-xs text-muted-foreground hover:text-foreground" onClick={clearFilters} data-testid="button-clear-filters">
                  <X className="h-3.5 w-3.5" />Limpar
                </Button>
              )}
            </div>
            <Card className="border-border/60">
              <CardContent className="p-0">
                <ListSectionHeader
                  title="Detecções de Conteúdo"
                  count={detectionsPg.total}
                  description="Conteúdo detectado em plataformas digitais, com conciliação ao catálogo interno e código ECAD."
                  className="px-6 pt-6"
                  action={selectedIds.length > 0 ? (
                    <Button type="button" variant="destructive" size="sm" className="h-8 text-xs gap-1.5" onClick={() => setPendingBulkDelete(selectedIds)} data-testid="button-delete-selected">
                      <Trash2 className="h-3.5 w-3.5" />Excluir selecionadas ({selectedIds.length})
                    </Button>
                  ) : undefined}
                />
                {loadingDet || loadingObras ? (
                  <div className="py-16 text-center text-sm text-muted-foreground">Carregando...</div>
                ) : (
                  <>
                    <div className="px-6 pb-2 flex items-center gap-2">
                      <Checkbox
                        checked={selectedIds.length === detectionsPg.pageItems.length && detectionsPg.pageItems.length > 0}
                        onCheckedChange={toggleSelectAll}
                        aria-label="Selecionar todas as detecções desta página"
                        data-testid="checkbox-select-all-radio-tv"
                      />
                      <span className="text-xs text-muted-foreground">Selecionar página</span>
                    </div>
                    <DetectionsTable
                      detections={detectionsPg.pageItems}
                      onViewDetail={handleViewDetail}
                      selectedIds={selectedIds}
                      onToggleSelect={toggleSelect}
                    />
                    <TablePagination
                      total={detectionsPg.total}
                      page={detectionsPg.page}
                      pageSize={detectionsPg.pageSize}
                      onPageChange={detectionsPg.setPage}
                      onPageSizeChange={detectionsPg.setPageSize}
                      itemLabel="detecções"
                    />
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── ECAD ── */}
          <TabsContent value="ecad" className="mt-0">
            <Card className="border-border/60">
              <CardContent className="p-0">
                <ListSectionHeader
                  title="Relatórios ECAD"
                  count={enrichedReports.length}
                  description="Relatórios de recebimentos externos de direitos, por período e obra."
                  className="px-6 pt-6"
                />
                {loadingEcad ? (
                  <div className="py-16 text-center text-sm text-muted-foreground">Carregando...</div>
                ) : enrichedReports.length === 0 ? (
                  <FeatureGate feature="moduleMonitoring" featureName="Monitoramento">
                    <EmptyState icon={EcadIcon} title="Nenhum relatório ECAD importado" description="Importe relatórios do ECAD para conciliação." />
                  </FeatureGate>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[120px]">Período</TableHead>
                        <TableHead className="hidden md:table-cell">Obra</TableHead>
                        <TableHead className="hidden lg:table-cell w-[132px]">Criado em</TableHead>
                        <TableHead className="text-right w-[132px]">Valor Líquido</TableHead>
                        <TableHead className="w-[112px]">Status</TableHead>
                        <TableHead className="text-right w-[112px]">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {enrichedReports.map((r) => (
                        <FeatureGate key={r.id} feature="moduleMonitoring" featureName="Monitoramento">
                          <TableRow>
                            <TableCell className="font-semibold">{r.periodo}</TableCell>
                            <TableCell className="text-sm text-muted-foreground hidden md:table-cell">{r.obra?.title ?? r.work_id ?? "—"}</TableCell>
                            <TableCell className="text-sm text-muted-foreground hidden lg:table-cell">{formatRightsDate(r.created_at)}</TableCell>
                            <TableCell className="text-right">{fmtBRL(Number(r.valor_liquido ?? r.valor_bruto ?? 0))}</TableCell>
                            <TableCell><Badge variant={STATUS_VARIANT[r.status] ?? "neutral"}>{STATUS_ECAD_LABEL[r.status] ?? r.status}</Badge></TableCell>
                            <TableCell className="text-right">
                              <Button variant="outline" size="sm" onClick={() => { setSelectedEcad(r); setEcadDetailOpen(true); }}>
                                Ver Detalhes
                              </Button>
                            </TableCell>
                          </TableRow>
                        </FeatureGate>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Divergências ── */}
          <TabsContent value="divergencias" className="mt-0">
            <Card className="border-border/60">
              <CardContent className="p-0">
                <DivergenciasPanel
                  divergencias={allDivergencias}
                  onResolve={(d) => { setSelectedDivergencia(d); setResolverOpen(true); }}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Modals */}
        <EcadImportModal open={importModalOpen} onOpenChange={setImportModalOpen} />
        <DetectionDetailModal detection={selectedExec} open={detailOpen} onOpenChange={setDetailOpen} />
        <ECADViewModal report={selectedEcad} open={ecadDetailOpen} onOpenChange={setEcadDetailOpen} />
        <ResolverDivergenciaModal
          divergencia={selectedDivergencia}
          open={resolverOpen}
          onOpenChange={setResolverOpen}
          onSubmit={handleResolveDivergencia}
        />
        <DeleteConfirmModal
          open={Boolean(pendingBulkDelete)}
          onOpenChange={(open) => !open && setPendingBulkDelete(null)}
          title="Excluir detecções selecionadas"
          description="Esta ação remove permanentemente os registros selecionados. Deseja continuar?"
          onConfirm={handleConfirmBulkDelete}
        />

      </div>
    </MainLayout>
  );
}
