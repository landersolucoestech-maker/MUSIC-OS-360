import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
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
import { Music, FileText, Clock, CheckCircle, Upload, PlusCircle, Search, Disc, Loader2, MoreHorizontal, Eye, Pencil, Trash2, LinkIcon } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/shared/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { SortableTableHead } from "@/shared/components/SortableTableHead";
import { nextTableSortState, sortTableRows, type TableSortState } from "@/shared/lib/table-sort";
import { ObraFormModal, ObraTipoBadge } from "@/modules/catalog/components/ObraFormModal";
import { ObraViewModal } from "@/modules/catalog/components/ObraViewModal";
import { ObraTipoSelectorModal, type TipoObra } from "@/modules/catalog/components/ObraTipoSelectorModal";
import { FonogramaFormModal } from "@/modules/catalog/components/FonogramaFormModal";
import { FonogramaViewModal } from "@/modules/catalog/components/FonogramaViewModal";
import { DeleteConfirmModal } from "@/shared/components/DeleteConfirmModal";
import { RequirePermission } from "@/shared/components/RequirePermission";
import { ContractFormModal } from "@/modules/contracts/components/ContractFormModal";
import { toast } from "sonner";
import { runBulkAction, reportBulkResult } from "@/shared/hooks/useBulkAction";
import { EmptyState } from "@/shared/components/EmptyState";
import { UnavailableState } from "@/shared/components/UnavailableState";
import { useObras } from "@/modules/catalog/hooks/useObras";
import { useFonogramas } from "@/modules/catalog/hooks/useFonogramas";
import { useEntityById } from "@/shared/hooks/useEntityLookup";
import { storage } from "@/shared/lib/storage";
import type { ProjectWithRelations } from "@/modules/projects/hooks/useProjects";
import {
  useObrasPaginated, useObrasStats, useObrasGeneros,
  useFonogramasPaginated, useFonogramasStats, useFonogramasGeneros,
} from "@/modules/catalog/hooks/useCatalogPaginated";
import type { Obra, Fonograma } from "@/modules/catalog/types/catalog.types";
import { projetoToObraSeed } from "@/modules/catalog/mappers";
import { parseMusicasFromProjeto } from "@/modules/projects/lib/musica-helpers";
import { useProjects } from "@/modules/projects/hooks/useProjects";
import { useSignedArtists } from "@/modules/artist/hooks/useSignedArtists";




const statusObraLabel = (s: string): string => {
  if (s === "registered") return "Registrado";
  if (s === "under_review" || s === "in_review") return "Em Análise";
  if (s === "rejected") return "Rejeitado";
  return "Pendente";
};

const getFonogramaGenero = (fonograma: Pick<Fonograma, "genero_musical">): string =>
  (fonograma.genero_musical ?? "").toString().trim();

const getFonogramaGeneroDisplay = (fonograma: Pick<Fonograma, "genero_musical">): string =>
  getFonogramaGenero(fonograma) || "Não informado";

const getObraGeneroDisplay = (obra: Pick<Obra, "genero">): string =>
  (obra.genero ?? "").toString().trim() || "Não informado";

const getSortText = (value: unknown): string => {
  if (Array.isArray(value)) return value.filter(Boolean).join(", ");
  return (value ?? "").toString();
};

const getFonogramaSortValue = (fonograma: Fonograma, key: string): unknown => {
  if (key === "genero_musical") return getFonogramaGeneroDisplay(fonograma);
  if (key === "title") return fonograma.title ?? "";
  return getSortText((fonograma as Record<string, unknown>)[key]);
};

const getObraSortValue = (obra: Obra, key: string): unknown => {
  if (key === "genero") return getObraGeneroDisplay(obra);
  if (key === "title") return obra.title ?? "";
  return getSortText((obra as Record<string, unknown>)[key]);
};

export default function RegistroMusicas() {
  const navigate = useNavigate();
  const { obras, isLoading: loadingObras, deleteObra, addObra } = useObras();
  const { fonogramas, isLoading: loadingFonogramas, deleteFonograma, addFonograma } = useFonogramas();
  const { projects: allProjetos } = useProjects();
  const { artists: artistasAssinados } = useSignedArtists();
  const [activeTab, setActiveTab] = useState("obras");
  const [selectedObraIds, setSelectedObraIds] = useState<string[]>([]);
  const toggleSelectAllObras = () => {
    if (selectedObraIds.length === obrasPg.pageItems.length && obrasPg.pageItems.length > 0) {
      setSelectedObraIds([]);
    } else {
      setSelectedObraIds(obrasPg.pageItems.map((o) => o.id));
    }
  };
  const toggleSelectObra = (id: string) => setSelectedObraIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const handleBulkDeleteObras = async () => {
    if (selectedObraIds.length === 0) return;
    const ids = selectedObraIds;
    setSelectedObraIds([]);
    const result = await runBulkAction(ids, (id) => deleteObra.mutateAsync(id));
    reportBulkResult(result, "excluída", "obra");
  };

  const [selectedFonogramaIds, setSelectedFonogramaIds] = useState<string[]>([]);
  const toggleSelectAllFonogramas = () => {
    if (selectedFonogramaIds.length === fonogramasPg.pageItems.length && fonogramasPg.pageItems.length > 0) {
      setSelectedFonogramaIds([]);
    } else {
      setSelectedFonogramaIds(fonogramasPg.pageItems.map((f) => f.id));
    }
  };
  const toggleSelectFonograma = (id: string) => setSelectedFonogramaIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const handleBulkDeleteFonogramas = async () => {
    if (selectedFonogramaIds.length === 0) return;
    const ids = selectedFonogramaIds;
    setSelectedFonogramaIds([]);
    const result = await runBulkAction(ids, (id) => deleteFonograma.mutateAsync(id));
    reportBulkResult(result, "excluído", "fonograma");
  };
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all-status");
  const [genreFilter, setGenreFilter] = useState("all-genre");
  const [fonogramaSort, setFonogramaSort] = useState<TableSortState>(null);
  const [obraSort, setObraSort] = useState<TableSortState>(null);
  const [tipoObraFilter, setTipoObraFilter] = useState("all-tipos");
  const [projetoFilter, setProjetoFilter] = useState("all-projetos");
  const [obraVinculadaFilter, setObraVinculadaFilter] = useState("all-obras");
  const [ecadFilter, setEcadFilter] = useState("all-ecad");
  const [fonogramaEcadFilter, setFonogramaEcadFilter] = useState("all-ecad");
  const [obraModal, setObraModal] = useState<{ open: boolean; mode: "create" | "edit"; obra?: Obra; tipoObra?: TipoObra }>({
    open: false,
    mode: "create",
    obra: undefined,
    tipoObra: undefined,
  });
  const [obraTipoSelectorOpen, setObraTipoSelectorOpen] = useState(false);
  const [pendingProjectId, setPendingProjectId] = useState<string | null>(null);
  const [obraViewModal, setObraViewModal] = useState<{ open: boolean; obra?: Obra }>({ open: false });
  const [fonogramaModal, setFonogramaModal] = useState<{ open: boolean; mode: "create" | "edit"; fonograma?: Fonograma }>({
    open: false,
    mode: "create",
    fonograma: undefined
  });
  const [fonogramaViewModal, setFonogramaViewModal] = useState<{ open: boolean; fonograma?: Fonograma }>({ open: false });
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; item?: Obra | Fonograma; type?: string }>({ open: false, item: undefined, type: undefined });
  const [contratoModal, setContratoModal] = useState<{ open: boolean; prefill?: { title: string; notes: string } }>({ open: false });

  // Apply incoming ?projeto=:id (and optional ?obra=:id) coming from the Projetos screen
  const [searchParams, setSearchParams] = useSearchParams();
  const obraParam = searchParams.get("obra");
  const editObraParam = searchParams.get("editObra");
  const fonogramaParam = searchParams.get("fonograma");
  // Deep-link resolution DIRETO por ID (Task J) — antes escaneava obras/
  // fonogramas de useObras()/useFonogramas() sem filtro, truncados nos
  // primeiros 50 do tenant; GET /works/:id e /phonograms/:id alcançam
  // qualquer registro do tenant.
  const { entity: deepLinkObra, isLoading: loadingDeepLinkObra } = useEntityById<Obra>("obras", obraParam ?? undefined);
  const { entity: deepLinkEditObra, isLoading: loadingDeepLinkEditObra } = useEntityById<Obra>("obras", editObraParam ?? undefined);
  const { entity: deepLinkFonograma, isLoading: loadingDeepLinkFonograma } = useEntityById<Fonograma>("fonogramas", fonogramaParam ?? undefined);

  useEffect(() => {
    const projetoParam = searchParams.get("projeto");
    const newObraParam = searchParams.get("newObra");
    if (!projetoParam && !newObraParam && !obraParam && !editObraParam && !fonogramaParam) return;

    // If we still need to resolve an obra/fonograma but data are loading,
    // wait so we don't clear the URL before having a chance to open the modal.
    if (obraParam && loadingDeepLinkObra) return;
    if (editObraParam && loadingDeepLinkEditObra) return;
    if (fonogramaParam && loadingDeepLinkFonograma) return;

    const next = new URLSearchParams(searchParams);
    let consumed = false;

    if (newObraParam) {
      setActiveTab("obras");
      setProjetoFilter(newObraParam);
      setPendingProjectId(newObraParam);
      setObraTipoSelectorOpen(true);
      next.delete("newObra");
      consumed = true;
    }

    if (projetoParam) {
      setActiveTab("obras");
      setProjetoFilter(projetoParam);
      next.delete("projeto");
      consumed = true;
    }

    if (obraParam) {
      if (deepLinkObra) {
        setActiveTab("obras");
        setObraViewModal({ open: true, obra: deepLinkObra });
      }
      // Whether or not the obra was found, drop the param so we don't loop.
      next.delete("obra");
      consumed = true;
    }

    if (editObraParam) {
      if (deepLinkEditObra) {
        setActiveTab("obras");
        setObraModal({ open: true, mode: "edit", obra: deepLinkEditObra });
      }
      next.delete("editObra");
      consumed = true;
    }

    if (fonogramaParam) {
      if (deepLinkFonograma) {
        setActiveTab("fonogramas");
        setFonogramaModal({ open: true, mode: "edit", fonograma: deepLinkFonograma });
      }
      next.delete("fonograma");
      consumed = true;
    }

    if (consumed) {
      setSearchParams(next, { replace: true });
    }
  }, [
    searchParams, obraParam, editObraParam, fonogramaParam,
    deepLinkObra, deepLinkEditObra, deepLinkFonograma,
    loadingDeepLinkObra, loadingDeepLinkEditObra, loadingDeepLinkFonograma,
    setSearchParams,
  ]);

  const collator = useMemo(() => new Intl.Collator("pt-BR", { sensitivity: "base" }), []);

  // Sort continua client-side (só ordena a página atual) — busca/filtros/
  // paginação em si são server-side (Task H); reordenar por coluna em todo
  // o tenant exigiria mapear cada SortableTableHead pra uma coluna real no
  // backend, fora do escopo desta migração (limitação documentada).
  const toggleFonogramaSort = (key: string) => {
    setFonogramaSort((current) => nextTableSortState(current, key));
  };
  const toggleObraSort = (key: string) => {
    setObraSort((current) => nextTableSortState(current, key));
  };

  const debouncedSearch = useDebounce(searchTerm, 300);
  const [obraPage, setObraPage] = useState(0);
  const [obraPageSize, setObraPageSize] = useState(10);
  const [fonogramaPage, setFonogramaPage] = useState(0);
  const [fonogramaPageSize, setFonogramaPageSize] = useState(10);
  useEffect(() => {
    setObraPage(0);
    setFonogramaPage(0);
  }, [debouncedSearch, statusFilter, genreFilter, tipoObraFilter, projetoFilter, obraVinculadaFilter, ecadFilter, fonogramaEcadFilter]);

  const {
    obras: obraPageItems, total: obraTotal, isLoading: isLoadingObraPage, error: obraPageError, refetch: refetchObraPage,
  } = useObrasPaginated({
    page: obraPage, pageSize: obraPageSize, search: debouncedSearch || undefined,
    status: statusFilter !== "all-status" ? statusFilter : undefined,
    tipoObra: tipoObraFilter !== "all-tipos" ? tipoObraFilter : undefined,
    genero: genreFilter !== "all-genre" ? genreFilter : undefined,
    projectId: projetoFilter !== "all-projetos" ? projetoFilter : undefined,
    ecad: ecadFilter !== "all-ecad" ? (ecadFilter as "com-ecad" | "sem-ecad") : undefined,
    enabled: activeTab === "obras",
  });
  const obrasPg = useMemo(() => ({
    pageItems: obraSort ? sortTableRows(obraPageItems, obraSort, getObraSortValue) : obraPageItems,
    total: obraTotal,
    page: obraPage,
    pageSize: obraPageSize,
    setPage: setObraPage,
    setPageSize: setObraPageSize,
  }), [obraPageItems, obraSort, obraTotal, obraPage, obraPageSize]);

  const {
    fonogramas: fonogramaPageItems, total: fonogramaTotal, isLoading: isLoadingFonogramaPage, error: fonogramaPageError, refetch: refetchFonogramaPage,
  } = useFonogramasPaginated({
    page: fonogramaPage, pageSize: fonogramaPageSize, search: debouncedSearch || undefined,
    status: statusFilter !== "all-status" ? statusFilter : undefined,
    genero: genreFilter !== "all-genre" ? genreFilter : undefined,
    obraVinculada: obraVinculadaFilter !== "all-obras" ? (obraVinculadaFilter as "com-obra" | "sem-obra") : undefined,
    ecad: fonogramaEcadFilter !== "all-ecad" ? (fonogramaEcadFilter as "com-ecad" | "sem-ecad") : undefined,
    enabled: activeTab === "fonogramas",
  });
  const fonogramasPg = useMemo(() => ({
    pageItems: fonogramaSort ? sortTableRows(fonogramaPageItems, fonogramaSort, getFonogramaSortValue) : fonogramaPageItems,
    total: fonogramaTotal,
    page: fonogramaPage,
    pageSize: fonogramaPageSize,
    setPage: setFonogramaPage,
    setPageSize: setFonogramaPageSize,
  }), [fonogramaPageItems, fonogramaSort, fonogramaTotal, fonogramaPage, fonogramaPageSize]);

  const isLoading = loadingObras || loadingFonogramas ||
    (activeTab === "fonogramas" ? isLoadingFonogramaPage : isLoadingObraPage);

  const { generos: obrasGeneros } = useObrasGeneros();
  const { generos: fonogramasGeneros } = useFonogramasGeneros();
  const generosUnicos = activeTab === "fonogramas" ? fonogramasGeneros : obrasGeneros;

  const projetosDisponiveis = useMemo(() => {
    const map = new Map<string, string>();
    allProjetos.forEach((p) => {
      if (p?.id && p?.title) map.set(p.id, p.title);
    });
    obras.forEach((o) => {
      if (o.projetos?.id && o.projetos?.title && !map.has(o.projetos.id)) {
        map.set(o.projetos.id, o.projetos.title);
      }
    });
    return Array.from(map.entries()).map(([id, title]) => ({ id, title }));
  }, [obras, allProjetos]);

  // Metrics — agregação exata do tenant inteiro (GROUP BY status), nunca
  // calculada só sobre a página/lista atualmente carregada (Task H).
  const { stats: obrasStats } = useObrasStats();
  const { stats: fonogramasStats } = useFonogramasStats();
  const activeStats = activeTab === "fonogramas" ? fonogramasStats : obrasStats;
  const pendentes = activeStats.byGroup["pending"] ?? 0;
  const emAnalise = (activeStats.byGroup["under_review"] ?? 0) + (activeStats.byGroup["in_review"] ?? 0);
  const registrados = activeStats.byGroup["registered"] ?? 0;
  const total = activeStats.total;
  const taxaAprovacao = total > 0 ? Math.round((registrados / total) * 100) : 0;

  const handleDelete = () => {
    if (deleteModal.item) {
      if (deleteModal.type === "fonograma") {
        deleteFonograma.mutate(deleteModal.item.id);
      } else {
        deleteObra.mutate(deleteModal.item.id);
      }
      setDeleteModal({ open: false, item: undefined, type: undefined });
    }
  };

  const headerActions = (
    <>
      <RequirePermission module="catalog" action="write">
        <Button
          size="sm"
          className="h-8 text-xs gap-1.5"
          onClick={() => activeTab === "fonogramas"
            ? setFonogramaModal({ open: true, mode: "create" })
            : setObraTipoSelectorOpen(true)
          }
          data-testid="button-nova-obra"
        >
          <PlusCircle className="h-3.5 w-3.5" />
          {activeTab === "fonogramas" ? "Novo Fonograma" : "Nova Obra"}
        </Button>
      </RequirePermission>
    </>
  );

  return (
    <>
    {isLoading ? (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </MainLayout>
    ) : (
    <MainLayout title="Registro de Músicas" description="Registro e controle de obras musicais e fonogramas" actions={headerActions}>
      <div className="space-y-6">

        {/* Metrics */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <MetricCard
            title={activeTab === "fonogramas" ? "Total de Fonogramas" : "Total de Obras"}
            value={total}
            description="registrados no sistema"
            icon={activeTab === "fonogramas" ? Disc : Music}
            accent="primary"
          />
          <MetricCard title="Pendentes de Registro" value={pendentes} description="aguardando análise" icon={FileText} accent="warning" />
          <MetricCard title="Em Análise" value={emAnalise} description="aguardando aprovação" icon={Clock} accent="warning" />
          <MetricCard title="Registro Aceito" value={registrados} description="aprovados" icon={CheckCircle} accent="success" />
          <MetricCard title="Taxa de Aprovação" value={`${taxaAprovacao}%`} description={activeTab === "fonogramas" ? "fonogramas aprovados" : "obras aprovadas"} icon={CheckCircle} accent="primary" />
        </div>


        {/* Tabs */}
        <div className="flex items-center gap-2">
          <Button 
            variant={activeTab === "obras" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab("obras")}
            className={activeTab === "obras" ? "gap-2 bg-muted text-foreground hover:bg-muted" : "gap-2"}
          >
            <Music className="h-4 w-4" />
            Obras
          </Button>
          <Button 
            variant={activeTab === "fonogramas" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab("fonogramas")}
            className={activeTab === "fonogramas" ? "gap-2 bg-muted text-foreground hover:bg-muted" : "gap-2"}
          >
            <Disc className="h-4 w-4" />
            Fonogramas
          </Button>
        </div>

        {/* Search and Filters */}
        <div className="flex items-center gap-4 rounded-lg bg-muted/30 p-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={activeTab === "fonogramas" ? "Buscar por título, compositor, intérprete, ISRC..." : "Buscar por título, compositor, ISWC, gênero..."}
              className="pl-10 h-8 text-sm bg-card border-border"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          {activeTab === "obras" && projetosDisponiveis.length > 0 && (
            <Select value={projetoFilter} onValueChange={setProjetoFilter}>
              <SelectTrigger className="w-auto min-w-[150px] shrink-0 h-8 text-sm bg-card border-border" data-testid="select-filter-projeto">
                <SelectValue placeholder="Todos Projetos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all-projetos">Todos Projetos</SelectItem>
                <SelectItem value="no-projeto">Sem projeto vinculado</SelectItem>
                {projetosDisponiveis.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {activeTab === "obras" && (
            <Select value={ecadFilter} onValueChange={setEcadFilter} data-testid="select-filter-ecad">
              <SelectTrigger className="w-auto min-w-[126px] shrink-0 h-8 text-sm bg-card border-border" data-testid="trigger-filter-ecad">
                <SelectValue placeholder="Todos ECAD" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all-ecad">Todos ECAD</SelectItem>
                <SelectItem value="com-ecad">Com ECAD</SelectItem>
                <SelectItem value="sem-ecad">Sem ECAD</SelectItem>
              </SelectContent>
            </Select>
          )}
          {activeTab === "obras" && (
            <Select value={tipoObraFilter} onValueChange={setTipoObraFilter} data-testid="select-filter-type-obra">
              <SelectTrigger className="w-auto min-w-[126px] shrink-0 h-8 text-sm bg-card border-border" data-testid="trigger-filter-type-obra">
                <SelectValue placeholder="Todos Tipos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all-tipos">Todos Tipos</SelectItem>
                <SelectItem value="autoral">Autoral</SelectItem>
                <SelectItem value="referencia">Referência</SelectItem>
              </SelectContent>
            </Select>
          )}
          {activeTab === "fonogramas" && (
            <Select value={obraVinculadaFilter} onValueChange={setObraVinculadaFilter} data-testid="select-filter-obra-vinculada">
              <SelectTrigger className="w-auto min-w-[160px] shrink-0 h-8 text-sm bg-card border-border" data-testid="trigger-filter-obra-vinculada">
                <SelectValue placeholder="Todos os Fonogramas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all-obras">Todos os Fonogramas</SelectItem>
                <SelectItem value="sem-obra">Sem obra vinculada</SelectItem>
                <SelectItem value="com-obra">Com obra vinculada</SelectItem>
              </SelectContent>
            </Select>
          )}
          {activeTab === "fonogramas" && (
            <Select value={fonogramaEcadFilter} onValueChange={setFonogramaEcadFilter} data-testid="select-filter-fonograma-ecad">
              <SelectTrigger className="w-auto min-w-[126px] shrink-0 h-8 text-sm bg-card border-border" data-testid="trigger-filter-fonograma-ecad">
                <SelectValue placeholder="Todos ECAD" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all-ecad">Todos ECAD</SelectItem>
                <SelectItem value="com-ecad">Com ECAD</SelectItem>
                <SelectItem value="sem-ecad">Sem ECAD</SelectItem>
              </SelectContent>
            </Select>
          )}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-auto min-w-[126px] shrink-0 h-8 text-sm bg-card border-border">
              <SelectValue placeholder="Todos Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all-status">Todos Status</SelectItem>
              <SelectItem value="pending">Pendente</SelectItem>
              <SelectItem value="under_review">Em Análise</SelectItem>
              <SelectItem value="registered">Registrado</SelectItem>
            </SelectContent>
          </Select>
          <Select value={genreFilter} onValueChange={setGenreFilter}>
            <SelectTrigger className="w-auto min-w-[132px] shrink-0 h-8 text-sm bg-card border-border">
              <SelectValue placeholder="Todos Gêneros" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all-genre">Todos Gêneros</SelectItem>
              {generosUnicos.map(g => (
                <SelectItem key={g} value={g.toLowerCase()}>
                  {g.charAt(0).toUpperCase() + g.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {(searchTerm !== "" || statusFilter !== "all-status" || genreFilter !== "all-genre" || tipoObraFilter !== "all-tipos" || projetoFilter !== "all-projetos" || obraVinculadaFilter !== "all-obras" || ecadFilter !== "all-ecad" || fonogramaEcadFilter !== "all-ecad") && (
            <Button variant="outline" onClick={() => { setSearchTerm(""); setStatusFilter("all-status"); setGenreFilter("all-genre"); setTipoObraFilter("all-tipos"); setProjetoFilter("all-projetos"); setObraVinculadaFilter("all-obras"); setEcadFilter("all-ecad"); setFonogramaEcadFilter("all-ecad"); }} data-testid="button-limpar-filtros">
              Limpar
            </Button>
          )}
        </div>

        {/* Content - Fonogramas */}
        {activeTab === "fonogramas" && (
          <Card className="bg-card border-border">
            <CardContent>
              <ListSectionHeader
                title="Fonogramas Registrados"
                count={fonogramaTotal}
                description="Catálogo completo de gravações registradas"
                action={fonogramaTotal > 0 ? (
                  <div className="flex flex-wrap items-center justify-end gap-3">
                    <Checkbox
                      checked={selectedFonogramaIds.length === fonogramasPg.pageItems.length && fonogramasPg.pageItems.length > 0}
                      onCheckedChange={() => toggleSelectAllFonogramas()}
                      aria-label="Selecionar todos"
                      data-testid="checkbox-select-all-fonogramas"
                    />
                    <span className="text-xs text-muted-foreground">
                      {selectedFonogramaIds.length > 0 ? `${selectedFonogramaIds.length} fonograma(s) selecionado(s)` : "Selecionar todos"}
                    </span>
                    {selectedFonogramaIds.length > 0 && (
                      <Button variant="destructive" size="sm" className="gap-1 h-7 text-xs" onClick={handleBulkDeleteFonogramas} data-testid="button-bulk-delete-fonogramas">
                        <Trash2 className="h-3.5 w-3.5" />
                        Excluir ({selectedFonogramaIds.length})
                      </Button>
                    )}
                  </div>
                ) : undefined}
              />

              {fonogramasPg.pageItems.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8"></TableHead>
                        <SortableTableHead sortKey="title" sortState={fonogramaSort} onSort={toggleFonogramaSort} className="min-w-[180px]">Título</SortableTableHead>
                        <SortableTableHead sortKey="status" sortState={fonogramaSort} onSort={toggleFonogramaSort} className="min-w-[112px]">Status</SortableTableHead>
                        <SortableTableHead sortKey="cod_entidade" sortState={fonogramaSort} onSort={toggleFonogramaSort} className="min-w-[120px]">Cód. Sociedade</SortableTableHead>
                        <SortableTableHead sortKey="cod_ecad" sortState={fonogramaSort} onSort={toggleFonogramaSort} className="min-w-[120px]">Cód. ECAD</SortableTableHead>
                        <SortableTableHead sortKey="isrc" sortState={fonogramaSort} onSort={toggleFonogramaSort}>ISRC</SortableTableHead>
                        <SortableTableHead sortKey="compositores" sortState={fonogramaSort} onSort={toggleFonogramaSort} className="min-w-[130px]">Compositores</SortableTableHead>
                        <SortableTableHead sortKey="interpretes" sortState={fonogramaSort} onSort={toggleFonogramaSort} className="min-w-[120px]">Intérpretes</SortableTableHead>
                        <SortableTableHead sortKey="produtores" sortState={fonogramaSort} onSort={toggleFonogramaSort} className="min-w-[120px]">Produtor</SortableTableHead>
                        <SortableTableHead sortKey="genero_musical" sortState={fonogramaSort} onSort={toggleFonogramaSort} className="min-w-[120px]">Gênero</SortableTableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {fonogramasPg.pageItems.map((fonograma) => (
                        <TableRow key={fonograma.id}>
                          <TableCell className="py-3">
                            <Checkbox
                              checked={selectedFonogramaIds.includes(fonograma.id)}
                              onCheckedChange={() => toggleSelectFonograma(fonograma.id)}
                              data-testid={`checkbox-fonograma-${fonograma.id}`}
                            />
                          </TableCell>
                          <TableCell className="py-3">
                            <span className="font-medium block truncate" data-testid={`text-fonograma-title-${fonograma.id}`}>{fonograma.title}</span>
                            {!fonograma.work_id && (
                              <Badge
                                variant="warning"
                                className="mt-1 text-xs gap-1"
                                data-testid={`badge-sem-obra-${fonograma.id}`}
                              >
                                <LinkIcon className="h-3 w-3" />
                                Sem obra vinculada
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="py-3">
                            <Badge
                              variant={fonograma.status === "registered" ? "success" : "warning"}
                              className="text-xs"
                            >
                              {fonograma.status === "registered" ? "Registrado" : fonograma.status === "under_review" ? "Em Análise" : "Pendente"}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-3 text-sm">{fonograma.cod_entidade || "-"}</TableCell>
                          <TableCell className="py-3 text-sm">{fonograma.cod_ecad || "-"}</TableCell>
                          <TableCell className="py-3 text-sm">{fonograma.isrc || "-"}</TableCell>
                          <TableCell className="py-3 text-sm max-w-[140px] truncate" title={fonograma.compositores || undefined}>{fonograma.compositores || "-"}</TableCell>
                          <TableCell className="py-3 text-sm max-w-[120px] truncate" title={fonograma.interpretes || undefined}>{fonograma.interpretes || "-"}</TableCell>
                          <TableCell className="py-3 text-sm max-w-[120px] truncate" title={fonograma.produtores || undefined}>{fonograma.produtores || "-"}</TableCell>
                          <TableCell className="py-3 text-sm max-w-[120px] truncate" title={getFonogramaGeneroDisplay(fonograma)}>
                            {getFonogramaGenero(fonograma) ? (
                              getFonogramaGenero(fonograma)
                            ) : (
                              <span className="text-muted-foreground">Não informado</span>
                            )}
                          </TableCell>
                          <TableCell className="py-3 text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => setFonogramaViewModal({ open: true, fonograma })}>
                                  <Eye className="h-4 w-4 mr-2" />
                                  Ver
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setFonogramaModal({ open: true, mode: "edit", fonograma })}>
                                  <Pencil className="h-4 w-4 mr-2" />
                                  Editar
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  disabled={fonograma.status === "under_review"}
                                  title={fonograma.status === "under_review" ? "Fonograma em análise — aguarde a conclusão antes de criar um lançamento" : undefined}
                                  onClick={() => navigate("/lancamentos")}
                                >
                                  <Upload className="h-4 w-4 mr-2" />
                                  Fazer Lançamento
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => setDeleteModal({ open: true, item: fonograma, type: "fonograma" })}
                                  className="text-destructive"
                                >
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
                    total={fonogramasPg.total}
                    page={fonogramasPg.page}
                    pageSize={fonogramasPg.pageSize}
                    onPageChange={fonogramasPg.setPage}
                    onPageSizeChange={fonogramasPg.setPageSize}
                    itemLabel="fonogramas"
                  />
                </div>
              ) : fonogramaPageError && fonogramaTotal === 0 ? (
                <UnavailableState onRetry={() => refetchFonogramaPage()} />
              ) : (
                <EmptyState
                  icon={Disc}
                  title="Nenhum fonograma cadastrado"
                  description="Comece registrando seu primeiro fonograma"
                  actionLabel="Novo Fonograma"
                  onAction={() => setFonogramaModal({ open: true, mode: "create" })}
                />
              )}
            </CardContent>
          </Card>
        )}

        {/* Content - Obras */}
        {activeTab === "obras" && (
          <Card className="bg-card border-border">
            <CardContent>
              <ListSectionHeader
                title="Obras Registradas"
                count={obraTotal}
                description="Catálogo completo de obras musicais registradas"
                action={obraTotal > 0 ? (
                  <div className="flex flex-wrap items-center justify-end gap-3">
                    <Checkbox
                      checked={selectedObraIds.length === obrasPg.pageItems.length && obrasPg.pageItems.length > 0}
                      onCheckedChange={() => toggleSelectAllObras()}
                      aria-label="Selecionar todos"
                      data-testid="checkbox-select-all-obras"
                    />
                    <span className="text-xs text-muted-foreground">
                      {selectedObraIds.length > 0 ? `${selectedObraIds.length} obra(s) selecionada(s)` : "Selecionar todos"}
                    </span>
                    {selectedObraIds.length > 0 && (
                      <Button variant="destructive" size="sm" className="gap-1 h-7 text-xs" onClick={handleBulkDeleteObras} data-testid="button-bulk-delete-obras">
                        <Trash2 className="h-3.5 w-3.5" />
                        Excluir ({selectedObraIds.length})
                      </Button>
                    )}
                  </div>
                ) : undefined}
              />

              {obrasPg.pageItems.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8"></TableHead>
                        <SortableTableHead sortKey="title" sortState={obraSort} onSort={toggleObraSort}>Título</SortableTableHead>
                        <SortableTableHead sortKey="status" sortState={obraSort} onSort={toggleObraSort} className="min-w-[112px]">Status</SortableTableHead>
                        <SortableTableHead sortKey="tipo_obra" sortState={obraSort} onSort={toggleObraSort} className="min-w-[112px]">Tipo</SortableTableHead>
                        <SortableTableHead sortKey="cod_entidade" sortState={obraSort} onSort={toggleObraSort}>Cód. Sociedade</SortableTableHead>
                        <SortableTableHead sortKey="cod_ecad" sortState={obraSort} onSort={toggleObraSort}>Cód. ECAD</SortableTableHead>
                        <SortableTableHead sortKey="iswc" sortState={obraSort} onSort={toggleObraSort}>ISWC</SortableTableHead>
                        <SortableTableHead sortKey="compositores" sortState={obraSort} onSort={toggleObraSort}>Compositores</SortableTableHead>
                        <SortableTableHead sortKey="editora" sortState={obraSort} onSort={toggleObraSort}>Editora</SortableTableHead>
                        <SortableTableHead sortKey="genero" sortState={obraSort} onSort={toggleObraSort}>Gênero</SortableTableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {obrasPg.pageItems.map((obra) => (
                        <TableRow key={obra.id}>
                          <TableCell className="py-3">
                            <Checkbox
                              checked={selectedObraIds.includes(obra.id)}
                              onCheckedChange={() => toggleSelectObra(obra.id)}
                              data-testid={`checkbox-obra-${obra.id}`}
                            />
                          </TableCell>
                          <TableCell className="py-3">
                            <span className="font-medium block truncate" data-testid={`text-obra-title-${obra.id}`}>{obra.title}</span>
                          </TableCell>
                          <TableCell className="py-3">
                            <Badge
                              variant={obra.status === "registered" ? "success" : "warning"}
                              className="text-xs"
                            >
                              {obra.status === "registered" ? "Registrado" : obra.status === "under_review" ? "Em Análise" : "Pendente"}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-3">
                            <ObraTipoBadge type={obra.tipo_obra as string | null | undefined} />
                          </TableCell>
                          <TableCell className="py-3 text-sm">{obra.cod_entidade || "-"}</TableCell>
                          <TableCell className="py-3 text-sm">{obra.cod_ecad || "-"}</TableCell>
                          <TableCell className="py-3 text-sm">{obra.iswc || "-"}</TableCell>
                          <TableCell className="py-3 text-sm max-w-[140px] truncate">{obra.compositores || "-"}</TableCell>
                          <TableCell className="py-3 text-sm max-w-[120px] truncate">{obra.editora || "-"}</TableCell>
                          <TableCell className="py-3 text-sm">{obra.genero || "-"}</TableCell>
                          <TableCell className="py-3 text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => setObraViewModal({ open: true, obra })}>
                                  <Eye className="h-4 w-4 mr-2" />
                                  Ver
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setObraModal({ open: true, mode: "edit", obra })}>
                                  <Pencil className="h-4 w-4 mr-2" />
                                  Editar
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  disabled={obra.status === "under_review"}
                                  title={obra.status === "under_review" ? "Obra em análise — aguarde a conclusão antes de registrar um fonograma" : undefined}
                                  onClick={() => {
                                    setActiveTab("fonogramas");
                                    setFonogramaModal({ open: true, mode: "create", fonograma: { id: "", work_id: obra.id } as Fonograma });
                                  }}
                                >
                                  <Disc className="h-4 w-4 mr-2" />
                                  Registrar Fonograma
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => setDeleteModal({ open: true, item: obra, type: "obra" })}
                                  className="text-destructive"
                                >
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
                    total={obrasPg.total}
                    page={obrasPg.page}
                    pageSize={obrasPg.pageSize}
                    onPageChange={obrasPg.setPage}
                    onPageSizeChange={obrasPg.setPageSize}
                    itemLabel="obras"
                  />
                </div>
              ) : obraPageError && obraTotal === 0 ? (
                <UnavailableState onRetry={() => refetchObraPage()} />
              ) : (
                <EmptyState
                  icon={Music}
                  title="Nenhuma obra cadastrada"
                  description="Comece registrando sua primeira obra musical"
                  actionLabel="Nova Obra"
                  onAction={() => setObraTipoSelectorOpen(true)}
                />
              )}
            </CardContent>
          </Card>
        )}

      </div>

      {/* Modals */}
      <ObraTipoSelectorModal
        open={obraTipoSelectorOpen}
        onOpenChange={(v) => { setObraTipoSelectorOpen(v); if (!v) setPendingProjectId(null); }}
        onSelect={async (type) => {
          let obraSeed: Record<string, unknown> | undefined;
          if (pendingProjectId) {
            // Busca DIRETO por ID (GET /projects/:id) — não depende do projeto
            // estar entre os primeiros 50 carregados por useProjects() sem
            // filtro (Task J).
            const projeto = await storage.findById<ProjectWithRelations>("projects", pendingProjectId);
            if (projeto) {
              const musicas = parseMusicasFromProjeto(projeto);
              obraSeed = projetoToObraSeed(projeto, musicas[0] ?? null);
            } else {
              obraSeed = { project_id: pendingProjectId };
            }
          }
          setObraModal({ open: true, mode: "create", obra: obraSeed as Obra | undefined, tipoObra: type });
          setPendingProjectId(null);
        }}
      />
    </MainLayout>
    )}

      {/* Fora do gate de isLoading de propósito — mesmo bug de /artistas
          (Task C): ObraFormModal/FonogramaFormModal chamam useObras()/
          useFonogramas() de novo só para as mutations, as mesmas queries do
          isLoading acima. Montá-los só depois do isLoading virar false criava
          observers novos nessas queries; em erro (backend fora do ar),
          refetchOnMount reabria isLoading, o gate desmontava os modais de
          novo — loop infinito de loading. Mantê-los sempre montados quebra
          o ciclo. */}
      <ObraFormModal
        open={obraModal.open}
        onOpenChange={(open) => setObraModal({ ...obraModal, open })}
        mode={obraModal.mode}
        obra={obraModal.obra}
        tipoObra={obraModal.tipoObra}
        onSaved={(info) => setContratoModal({ open: true, prefill: info })}
      />
      <ObraViewModal
        open={obraViewModal.open}
        onOpenChange={(open) => setObraViewModal({ ...obraViewModal, open })}
        obra={obraViewModal.obra}
      />
      <FonogramaFormModal
        open={fonogramaModal.open}
        onOpenChange={(open) => setFonogramaModal({ ...fonogramaModal, open })}
        mode={fonogramaModal.mode}
        fonograma={fonogramaModal.fonograma as import("@/modules/catalog/components/FonogramaFormModal").FonogramaFormInput | null | undefined}
        onSaved={(info) => setContratoModal({ open: true, prefill: info })}
      />
      <FonogramaViewModal
        open={fonogramaViewModal.open}
        onOpenChange={(open) => setFonogramaViewModal({ ...fonogramaViewModal, open })}
        fonograma={fonogramaViewModal.fonograma as unknown as import("@/modules/catalog/components/FonogramaViewModal").FonogramaViewData | null | undefined}
      />
      <DeleteConfirmModal
        open={deleteModal.open}
        onOpenChange={(open) => setDeleteModal({ ...deleteModal, open })}
        onConfirm={handleDelete}
        title={deleteModal.type === "fonograma" ? "Excluir Fonograma" : "Excluir Obra"}
        description={`Tem certeza que deseja excluir ${deleteModal.type === "fonograma" ? "este fonograma" : "esta obra"}? Esta ação não pode ser desfeita.`}
      />
      <ContractFormModal
        open={contratoModal.open}
        onOpenChange={(open) => setContratoModal({ ...contratoModal, open })}
        mode="create"
        prefill={contratoModal.prefill}
      />
    </>
  );
}
