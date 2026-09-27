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
import { WorkFormModal, WorkTypeBadge } from "@/modules/catalog/components/WorkFormModal";
import { WorkViewModal } from "@/modules/catalog/components/WorkViewModal";
import { WorkTypeSelectorModal, type WorkType } from "@/modules/catalog/components/WorkTypeSelectorModal";
import { PhonogramFormModal } from "@/modules/catalog/components/PhonogramFormModal";
import { PhonogramViewModal } from "@/modules/catalog/components/PhonogramViewModal";
import { DeleteConfirmModal } from "@/shared/components/DeleteConfirmModal";
import { RequirePermission } from "@/shared/components/RequirePermission";
import { ContractFormModal } from "@/modules/contracts/components/ContractFormModal";
import { toast } from "sonner";
import { runBulkAction, reportBulkResult } from "@/shared/hooks/useBulkAction";
import { EmptyState } from "@/shared/components/EmptyState";
import { UnavailableState } from "@/shared/components/UnavailableState";
import { useWorks } from "@/modules/catalog/hooks/useWorks";
import { usePhonograms } from "@/modules/catalog/hooks/usePhonograms";
import { useEntityById } from "@/shared/hooks/useEntityLookup";
import { storage } from "@/shared/lib/storage";
import type { ProjectWithRelations } from "@/modules/projects/hooks/useProjects";
import {
  useWorksPaginated, useWorksStats, useWorksGenres,
  usePhonogramsPaginated, usePhonogramsStats, usePhonogramsGenres,
} from "@/modules/catalog/hooks/useCatalogPaginated";
import type { Work, Phonogram } from "@/modules/catalog/types/catalog.types";
import { projectToWorkSeed } from "@/modules/catalog/mappers";
import { parseTracksFromProject } from "@/modules/projects/lib/track-helpers";
import { useProjects } from "@/modules/projects/hooks/useProjects";
import { useSignedArtists } from "@/modules/artist/hooks/useSignedArtists";




const workStatusLabel = (s: string): string => {
  if (s === "registered") return "Registrado";
  if (s === "under_review" || s === "in_review") return "Em Análise";
  if (s === "rejected") return "Rejeitado";
  return "Pendente";
};

const getPhonogramGenre = (phonogram: Pick<Phonogram, "music_genre">): string =>
  (phonogram.music_genre ?? "").toString().trim();

const getPhonogramGenreDisplay = (phonogram: Pick<Phonogram, "music_genre">): string =>
  getPhonogramGenre(phonogram) || "Não informado";

const getWorkGenreDisplay = (work: Pick<Work, "music_genre">): string =>
  (work.music_genre ?? "").toString().trim() || "Não informado";

const getSortText = (value: unknown): string => {
  if (Array.isArray(value)) return value.filter(Boolean).join(", ");
  return (value ?? "").toString();
};

const getPhonogramSortValue = (phonogram: Phonogram, key: string): unknown => {
  if (key === "genero_musical") return getPhonogramGenreDisplay(phonogram);
  if (key === "title") return phonogram.title ?? "";
  return getSortText((phonogram as Record<string, unknown>)[key]);
};

const getWorkSortValue = (work: Work, key: string): unknown => {
  if (key === "genero") return getWorkGenreDisplay(work);
  if (key === "title") return work.title ?? "";
  return getSortText((work as Record<string, unknown>)[key]);
};

export default function MusicRegistry() {
  const navigate = useNavigate();
  const { works, isLoading: loadingWorks, deleteWork, addWork } = useWorks();
  const { phonograms, isLoading: loadingPhonograms, deletePhonogram, addPhonogram } = usePhonograms();
  const { projects: allProjects } = useProjects();
  const { artists: signedArtists } = useSignedArtists();
  const [activeTab, setActiveTab] = useState("obras");
  const [selectedWorkIds, setSelectedWorkIds] = useState<string[]>([]);
  const toggleSelectAllWorks = () => {
    if (selectedWorkIds.length === worksPg.pageItems.length && worksPg.pageItems.length > 0) {
      setSelectedWorkIds([]);
    } else {
      setSelectedWorkIds(worksPg.pageItems.map((o) => o.id));
    }
  };
  const toggleSelectWork = (id: string) => setSelectedWorkIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const handleBulkDeleteWorks = async () => {
    if (selectedWorkIds.length === 0) return;
    const ids = selectedWorkIds;
    setSelectedWorkIds([]);
    const result = await runBulkAction(ids, (id) => deleteWork.mutateAsync(id));
    reportBulkResult(result, "excluída", "obra");
  };

  const [selectedPhonogramIds, setSelectedPhonogramIds] = useState<string[]>([]);
  const toggleSelectAllPhonograms = () => {
    if (selectedPhonogramIds.length === phonogramsPg.pageItems.length && phonogramsPg.pageItems.length > 0) {
      setSelectedPhonogramIds([]);
    } else {
      setSelectedPhonogramIds(phonogramsPg.pageItems.map((f) => f.id));
    }
  };
  const toggleSelectPhonogram = (id: string) => setSelectedPhonogramIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const handleBulkDeletePhonograms = async () => {
    if (selectedPhonogramIds.length === 0) return;
    const ids = selectedPhonogramIds;
    setSelectedPhonogramIds([]);
    const result = await runBulkAction(ids, (id) => deletePhonogram.mutateAsync(id));
    reportBulkResult(result, "excluído", "fonograma");
  };
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all-status");
  const [genreFilter, setGenreFilter] = useState("all-genre");
  const [phonogramSort, setPhonogramSort] = useState<TableSortState>(null);
  const [workSort, setWorkSort] = useState<TableSortState>(null);
  const [workTypeFilter, setWorkTypeFilter] = useState("all-tipos");
  const [projectFilter, setProjectFilter] = useState("all-projetos");
  const [linkedWorkFilter, setLinkedWorkFilter] = useState("all-obras");
  const [ecadFilter, setEcadFilter] = useState("all-ecad");
  const [phonogramEcadFilter, setPhonogramEcadFilter] = useState("all-ecad");
  const [workModal, setWorkModal] = useState<{ open: boolean; mode: "create" | "edit"; obra?: Work; tipoObra?: WorkType }>({
    open: false,
    mode: "create",
    obra: undefined,
    tipoObra: undefined,
  });
  const [workTypeSelectorOpen, setWorkTypeSelectorOpen] = useState(false);
  const [pendingProjectId, setPendingProjectId] = useState<string | null>(null);
  const [workViewModal, setWorkViewModal] = useState<{ open: boolean; obra?: Work }>({ open: false });
  const [phonogramModal, setPhonogramModal] = useState<{ open: boolean; mode: "create" | "edit"; fonograma?: Phonogram }>({
    open: false,
    mode: "create",
    fonograma: undefined
  });
  const [phonogramViewModal, setPhonogramViewModal] = useState<{ open: boolean; fonograma?: Phonogram }>({ open: false });
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; item?: Work | Phonogram; type?: string }>({ open: false, item: undefined, type: undefined });
  const [contractModal, setContractModal] = useState<{ open: boolean; prefill?: { title: string; notes: string } }>({ open: false });

  // Apply incoming ?project=:id (and optional ?obra=:id) coming from the Projetos screen
  const [searchParams, setSearchParams] = useSearchParams();
  const workParam = searchParams.get("work");
  const editWorkParam = searchParams.get("editWork");
  const phonogramParam = searchParams.get("phonogram");
  // Deep-link resolution DIRECTLY by ID (Task J) — it used to scan the works/
  // phonograms of an unfiltered useWorks()/usePhonograms(), truncated at the tenant's
  // first 50; GET /works/:id and /phonograms/:id reach
  // any record of the tenant.
  const { entity: deepLinkWork, isLoading: loadingDeepLinkWork } = useEntityById<Work>("obras", workParam ?? undefined);
  const { entity: deepLinkEditWork, isLoading: loadingDeepLinkEditWork } = useEntityById<Work>("obras", editWorkParam ?? undefined);
  const { entity: deepLinkPhonogram, isLoading: loadingDeepLinkPhonogram } = useEntityById<Phonogram>("fonogramas", phonogramParam ?? undefined);

  useEffect(() => {
    const projectParam = searchParams.get("project");
    const newWorkParam = searchParams.get("newWork");
    if (!projectParam && !newWorkParam && !workParam && !editWorkParam && !phonogramParam) return;

    // If we still need to resolve an obra/fonograma but data are loading,
    // wait so we don't clear the URL before having a chance to open the modal.
    if (workParam && loadingDeepLinkWork) return;
    if (editWorkParam && loadingDeepLinkEditWork) return;
    if (phonogramParam && loadingDeepLinkPhonogram) return;

    const next = new URLSearchParams(searchParams);
    let consumed = false;

    if (newWorkParam) {
      setActiveTab("obras");
      setProjectFilter(newWorkParam);
      setPendingProjectId(newWorkParam);
      setWorkTypeSelectorOpen(true);
      next.delete("newWork");
      consumed = true;
    }

    if (projectParam) {
      setActiveTab("obras");
      setProjectFilter(projectParam);
      next.delete("project");
      consumed = true;
    }

    if (workParam) {
      if (deepLinkWork) {
        setActiveTab("obras");
        setWorkViewModal({ open: true, obra: deepLinkWork });
      }
      // Whether or not the obra was found, drop the param so we don't loop.
      next.delete("work");
      consumed = true;
    }

    if (editWorkParam) {
      if (deepLinkEditWork) {
        setActiveTab("obras");
        setWorkModal({ open: true, mode: "edit", obra: deepLinkEditWork });
      }
      next.delete("editWork");
      consumed = true;
    }

    if (phonogramParam) {
      if (deepLinkPhonogram) {
        setActiveTab("fonogramas");
        setPhonogramModal({ open: true, mode: "edit", fonograma: deepLinkPhonogram });
      }
      next.delete("phonogram");
      consumed = true;
    }

    if (consumed) {
      setSearchParams(next, { replace: true });
    }
  }, [
    searchParams, workParam, editWorkParam, phonogramParam,
    deepLinkWork, deepLinkEditWork, deepLinkPhonogram,
    loadingDeepLinkWork, loadingDeepLinkEditWork, loadingDeepLinkPhonogram,
    setSearchParams,
  ]);

  const collator = useMemo(() => new Intl.Collator("pt-BR", { sensitivity: "base" }), []);

  // Sorting remains client-side (it only sorts the current page) — search/filters/
  // pagination themselves are server-side (Task H); sorting by column across the whole
  // tenant would require mapping each SortableTableHead to a real column in the
  // backend, out of this migration's scope (documented limitation).
  const togglePhonogramSort = (key: string) => {
    setPhonogramSort((current) => nextTableSortState(current, key));
  };
  const toggleWorkSort = (key: string) => {
    setWorkSort((current) => nextTableSortState(current, key));
  };

  const debouncedSearch = useDebounce(searchTerm, 300);
  const [workPage, setWorkPage] = useState(0);
  const [workPageSize, setWorkPageSize] = useState(10);
  const [phonogramPage, setPhonogramPage] = useState(0);
  const [phonogramPageSize, setPhonogramPageSize] = useState(10);
  useEffect(() => {
    setWorkPage(0);
    setPhonogramPage(0);
  }, [debouncedSearch, statusFilter, genreFilter, workTypeFilter, projectFilter, linkedWorkFilter, ecadFilter, phonogramEcadFilter]);

  const {
    works: workPageItems, total: workTotal, isLoading: isLoadingWorkPage, error: workPageError, refetch: refetchWorkPage,
  } = useWorksPaginated({
    page: workPage, pageSize: workPageSize, search: debouncedSearch || undefined,
    status: statusFilter !== "all-status" ? statusFilter : undefined,
    tipoObra: workTypeFilter !== "all-tipos" ? workTypeFilter : undefined,
    genero: genreFilter !== "all-genre" ? genreFilter : undefined,
    projectId: projectFilter !== "all-projetos" ? projectFilter : undefined,
    ecad: ecadFilter !== "all-ecad" ? (ecadFilter as "com-ecad" | "sem-ecad") : undefined,
    enabled: activeTab === "obras",
  });
  const worksPg = useMemo(() => ({
    pageItems: workSort ? sortTableRows(workPageItems, workSort, getWorkSortValue) : workPageItems,
    total: workTotal,
    page: workPage,
    pageSize: workPageSize,
    setPage: setWorkPage,
    setPageSize: setWorkPageSize,
  }), [workPageItems, workSort, workTotal, workPage, workPageSize]);

  const {
    phonograms: phonogramPageItems, total: phonogramTotal, isLoading: isLoadingPhonogramPage, error: phonogramPageError, refetch: refetchPhonogramPage,
  } = usePhonogramsPaginated({
    page: phonogramPage, pageSize: phonogramPageSize, search: debouncedSearch || undefined,
    status: statusFilter !== "all-status" ? statusFilter : undefined,
    genero: genreFilter !== "all-genre" ? genreFilter : undefined,
    obraVinculada: linkedWorkFilter !== "all-obras" ? (linkedWorkFilter as "com-obra" | "sem-obra") : undefined,
    ecad: phonogramEcadFilter !== "all-ecad" ? (phonogramEcadFilter as "com-ecad" | "sem-ecad") : undefined,
    enabled: activeTab === "fonogramas",
  });
  const phonogramsPg = useMemo(() => ({
    pageItems: phonogramSort ? sortTableRows(phonogramPageItems, phonogramSort, getPhonogramSortValue) : phonogramPageItems,
    total: phonogramTotal,
    page: phonogramPage,
    pageSize: phonogramPageSize,
    setPage: setPhonogramPage,
    setPageSize: setPhonogramPageSize,
  }), [phonogramPageItems, phonogramSort, phonogramTotal, phonogramPage, phonogramPageSize]);

  const isLoading = loadingWorks || loadingPhonograms ||
    (activeTab === "fonogramas" ? isLoadingPhonogramPage : isLoadingWorkPage);

  const { generos: worksGenres } = useWorksGenres();
  const { generos: phonogramsGenres } = usePhonogramsGenres();
  const uniqueGenres = activeTab === "fonogramas" ? phonogramsGenres : worksGenres;

  const availableProjects = useMemo(() => {
    const map = new Map<string, string>();
    allProjects.forEach((p) => {
      if (p?.id && p?.title) map.set(p.id, p.title);
    });
    works.forEach((o) => {
      if (o.projetos?.id && o.projetos?.title && !map.has(o.projetos.id)) {
        map.set(o.projetos.id, o.projetos.title);
      }
    });
    return Array.from(map.entries()).map(([id, title]) => ({ id, title }));
  }, [works, allProjects]);

  // Metrics — exact aggregation over the whole tenant (GROUP BY status), never
  // computed only over the currently loaded page/list (Task H).
  const { stats: worksStats } = useWorksStats();
  const { stats: phonogramsStats } = usePhonogramsStats();
  const activeStats = activeTab === "fonogramas" ? phonogramsStats : worksStats;
  const pending = activeStats.byGroup["pending"] ?? 0;
  const emAnalise = (activeStats.byGroup["under_review"] ?? 0) + (activeStats.byGroup["in_review"] ?? 0);
  const registrados = activeStats.byGroup["registered"] ?? 0;
  const total = activeStats.total;
  const approvalRate = total > 0 ? Math.round((registrados / total) * 100) : 0;

  const handleDelete = () => {
    if (deleteModal.item) {
      if (deleteModal.type === "fonograma") {
        deletePhonogram.mutate(deleteModal.item.id);
      } else {
        deleteWork.mutate(deleteModal.item.id);
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
            ? setPhonogramModal({ open: true, mode: "create" })
            : setWorkTypeSelectorOpen(true)
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
          <MetricCard title="Pendentes de Registro" value={pending} description="aguardando análise" icon={FileText} accent="warning" />
          <MetricCard title="Em Análise" value={emAnalise} description="aguardando aprovação" icon={Clock} accent="warning" />
          <MetricCard title="Registro Aceito" value={registrados} description="aprovados" icon={CheckCircle} accent="success" />
          <MetricCard title="Taxa de Aprovação" value={`${approvalRate}%`} description={activeTab === "fonogramas" ? "fonogramas aprovados" : "obras aprovadas"} icon={CheckCircle} accent="primary" />
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
          {activeTab === "obras" && availableProjects.length > 0 && (
            <Select value={projectFilter} onValueChange={setProjectFilter}>
              <SelectTrigger className="w-auto min-w-[150px] shrink-0 h-8 text-sm bg-card border-border" data-testid="select-filter-projeto">
                <SelectValue placeholder="Todos Projetos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all-projetos">Todos Projetos</SelectItem>
                <SelectItem value="no-projeto">Sem projeto vinculado</SelectItem>
                {availableProjects.map(p => (
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
            <Select value={workTypeFilter} onValueChange={setWorkTypeFilter} data-testid="select-filter-type-obra">
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
            <Select value={linkedWorkFilter} onValueChange={setLinkedWorkFilter} data-testid="select-filter-obra-vinculada">
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
            <Select value={phonogramEcadFilter} onValueChange={setPhonogramEcadFilter} data-testid="select-filter-fonograma-ecad">
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
              {uniqueGenres.map(g => (
                <SelectItem key={g} value={g.toLowerCase()}>
                  {g.charAt(0).toUpperCase() + g.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {(searchTerm !== "" || statusFilter !== "all-status" || genreFilter !== "all-genre" || workTypeFilter !== "all-tipos" || projectFilter !== "all-projetos" || linkedWorkFilter !== "all-obras" || ecadFilter !== "all-ecad" || phonogramEcadFilter !== "all-ecad") && (
            <Button variant="outline" onClick={() => { setSearchTerm(""); setStatusFilter("all-status"); setGenreFilter("all-genre"); setWorkTypeFilter("all-tipos"); setProjectFilter("all-projetos"); setLinkedWorkFilter("all-obras"); setEcadFilter("all-ecad"); setPhonogramEcadFilter("all-ecad"); }} data-testid="button-limpar-filtros">
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
                count={phonogramTotal}
                description="Catálogo completo de gravações registradas"
                action={phonogramTotal > 0 ? (
                  <div className="flex flex-wrap items-center justify-end gap-3">
                    <Checkbox
                      checked={selectedPhonogramIds.length === phonogramsPg.pageItems.length && phonogramsPg.pageItems.length > 0}
                      onCheckedChange={() => toggleSelectAllPhonograms()}
                      aria-label="Selecionar todos"
                      data-testid="checkbox-select-all-fonogramas"
                    />
                    <span className="text-xs text-muted-foreground">
                      {selectedPhonogramIds.length > 0 ? `${selectedPhonogramIds.length} fonograma(s) selecionado(s)` : "Selecionar todos"}
                    </span>
                    {selectedPhonogramIds.length > 0 && (
                      <Button variant="destructive" size="sm" className="gap-1 h-7 text-xs" onClick={handleBulkDeletePhonograms} data-testid="button-bulk-delete-fonogramas">
                        <Trash2 className="h-3.5 w-3.5" />
                        Excluir ({selectedPhonogramIds.length})
                      </Button>
                    )}
                  </div>
                ) : undefined}
              />

              {phonogramsPg.pageItems.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8"></TableHead>
                        <SortableTableHead sortKey="title" sortState={phonogramSort} onSort={togglePhonogramSort} className="min-w-[180px]">Título</SortableTableHead>
                        <SortableTableHead sortKey="status" sortState={phonogramSort} onSort={togglePhonogramSort} className="min-w-[112px]">Status</SortableTableHead>
                        <SortableTableHead sortKey="cod_entidade" sortState={phonogramSort} onSort={togglePhonogramSort} className="min-w-[120px]">Cód. Sociedade</SortableTableHead>
                        <SortableTableHead sortKey="cod_ecad" sortState={phonogramSort} onSort={togglePhonogramSort} className="min-w-[120px]">Cód. ECAD</SortableTableHead>
                        <SortableTableHead sortKey="isrc" sortState={phonogramSort} onSort={togglePhonogramSort}>ISRC</SortableTableHead>
                        <SortableTableHead sortKey="compositores" sortState={phonogramSort} onSort={togglePhonogramSort} className="min-w-[130px]">Compositores</SortableTableHead>
                        <SortableTableHead sortKey="interpretes" sortState={phonogramSort} onSort={togglePhonogramSort} className="min-w-[120px]">Intérpretes</SortableTableHead>
                        <SortableTableHead sortKey="produtores" sortState={phonogramSort} onSort={togglePhonogramSort} className="min-w-[120px]">Produtor</SortableTableHead>
                        <SortableTableHead sortKey="genero_musical" sortState={phonogramSort} onSort={togglePhonogramSort} className="min-w-[120px]">Gênero</SortableTableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {phonogramsPg.pageItems.map((phonogram) => (
                        <TableRow key={phonogram.id}>
                          <TableCell className="py-3">
                            <Checkbox
                              checked={selectedPhonogramIds.includes(phonogram.id)}
                              onCheckedChange={() => toggleSelectPhonogram(phonogram.id)}
                              data-testid={`checkbox-fonograma-${phonogram.id}`}
                            />
                          </TableCell>
                          <TableCell className="py-3">
                            <span className="font-medium block truncate" data-testid={`text-fonograma-title-${phonogram.id}`}>{phonogram.title}</span>
                            {!phonogram.work_id && (
                              <Badge
                                variant="warning"
                                className="mt-1 text-xs gap-1"
                                data-testid={`badge-sem-obra-${phonogram.id}`}
                              >
                                <LinkIcon className="h-3 w-3" />
                                Sem obra vinculada
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="py-3">
                            <Badge
                              variant={phonogram.status === "registered" ? "success" : "warning"}
                              className="text-xs"
                            >
                              {phonogram.status === "registered" ? "Registrado" : phonogram.status === "under_review" ? "Em Análise" : "Pendente"}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-3 text-sm">{phonogram.cod_entidade || "-"}</TableCell>
                          <TableCell className="py-3 text-sm">{phonogram.cod_ecad || "-"}</TableCell>
                          <TableCell className="py-3 text-sm">{phonogram.isrc || "-"}</TableCell>
                          <TableCell className="py-3 text-sm max-w-[140px] truncate" title={phonogram.compositores || undefined}>{phonogram.compositores || "-"}</TableCell>
                          <TableCell className="py-3 text-sm max-w-[120px] truncate" title={phonogram.interpretes || undefined}>{phonogram.interpretes || "-"}</TableCell>
                          <TableCell className="py-3 text-sm max-w-[120px] truncate" title={phonogram.produtores || undefined}>{phonogram.produtores || "-"}</TableCell>
                          <TableCell className="py-3 text-sm max-w-[120px] truncate" title={getPhonogramGenreDisplay(phonogram)}>
                            {getPhonogramGenre(phonogram) ? (
                              getPhonogramGenre(phonogram)
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
                                <DropdownMenuItem onClick={() => setPhonogramViewModal({ open: true, fonograma: phonogram })}>
                                  <Eye className="h-4 w-4 mr-2" />
                                  Ver
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setPhonogramModal({ open: true, mode: "edit", fonograma: phonogram })}>
                                  <Pencil className="h-4 w-4 mr-2" />
                                  Editar
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  disabled={phonogram.status === "under_review"}
                                  title={phonogram.status === "under_review" ? "Fonograma em análise — aguarde a conclusão antes de criar um lançamento" : undefined}
                                  onClick={() => navigate("/releases")}
                                >
                                  <Upload className="h-4 w-4 mr-2" />
                                  Fazer Lançamento
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => setDeleteModal({ open: true, item: phonogram, type: "fonograma" })}
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
                    total={phonogramsPg.total}
                    page={phonogramsPg.page}
                    pageSize={phonogramsPg.pageSize}
                    onPageChange={phonogramsPg.setPage}
                    onPageSizeChange={phonogramsPg.setPageSize}
                    itemLabel="fonogramas"
                  />
                </div>
              ) : phonogramPageError && phonogramTotal === 0 ? (
                <UnavailableState onRetry={() => refetchPhonogramPage()} />
              ) : (
                <EmptyState
                  icon={Disc}
                  title="Nenhum fonograma cadastrado"
                  description="Comece registrando seu primeiro fonograma"
                  actionLabel="Novo Fonograma"
                  onAction={() => setPhonogramModal({ open: true, mode: "create" })}
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
                count={workTotal}
                description="Catálogo completo de obras musicais registradas"
                action={workTotal > 0 ? (
                  <div className="flex flex-wrap items-center justify-end gap-3">
                    <Checkbox
                      checked={selectedWorkIds.length === worksPg.pageItems.length && worksPg.pageItems.length > 0}
                      onCheckedChange={() => toggleSelectAllWorks()}
                      aria-label="Selecionar todos"
                      data-testid="checkbox-select-all-obras"
                    />
                    <span className="text-xs text-muted-foreground">
                      {selectedWorkIds.length > 0 ? `${selectedWorkIds.length} obra(s) selecionada(s)` : "Selecionar todos"}
                    </span>
                    {selectedWorkIds.length > 0 && (
                      <Button variant="destructive" size="sm" className="gap-1 h-7 text-xs" onClick={handleBulkDeleteWorks} data-testid="button-bulk-delete-obras">
                        <Trash2 className="h-3.5 w-3.5" />
                        Excluir ({selectedWorkIds.length})
                      </Button>
                    )}
                  </div>
                ) : undefined}
              />

              {worksPg.pageItems.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8"></TableHead>
                        <SortableTableHead sortKey="title" sortState={workSort} onSort={toggleWorkSort}>Título</SortableTableHead>
                        <SortableTableHead sortKey="status" sortState={workSort} onSort={toggleWorkSort} className="min-w-[112px]">Status</SortableTableHead>
                        <SortableTableHead sortKey="tipo_obra" sortState={workSort} onSort={toggleWorkSort} className="min-w-[112px]">Tipo</SortableTableHead>
                        <SortableTableHead sortKey="cod_entidade" sortState={workSort} onSort={toggleWorkSort}>Cód. Sociedade</SortableTableHead>
                        <SortableTableHead sortKey="cod_ecad" sortState={workSort} onSort={toggleWorkSort}>Cód. ECAD</SortableTableHead>
                        <SortableTableHead sortKey="iswc" sortState={workSort} onSort={toggleWorkSort}>ISWC</SortableTableHead>
                        <SortableTableHead sortKey="compositores" sortState={workSort} onSort={toggleWorkSort}>Compositores</SortableTableHead>
                        <SortableTableHead sortKey="editora" sortState={workSort} onSort={toggleWorkSort}>Editora</SortableTableHead>
                        <SortableTableHead sortKey="genero" sortState={workSort} onSort={toggleWorkSort}>Gênero</SortableTableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {worksPg.pageItems.map((work) => (
                        <TableRow key={work.id}>
                          <TableCell className="py-3">
                            <Checkbox
                              checked={selectedWorkIds.includes(work.id)}
                              onCheckedChange={() => toggleSelectWork(work.id)}
                              data-testid={`checkbox-obra-${work.id}`}
                            />
                          </TableCell>
                          <TableCell className="py-3">
                            <span className="font-medium block truncate" data-testid={`text-obra-title-${work.id}`}>{work.title}</span>
                          </TableCell>
                          <TableCell className="py-3">
                            <Badge
                              variant={work.status === "registered" ? "success" : "warning"}
                              className="text-xs"
                            >
                              {work.status === "registered" ? "Registrado" : work.status === "under_review" ? "Em Análise" : "Pendente"}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-3">
                            <WorkTypeBadge type={work.tipo_obra as string | null | undefined} />
                          </TableCell>
                          <TableCell className="py-3 text-sm">{work.cod_entidade || "-"}</TableCell>
                          <TableCell className="py-3 text-sm">{work.cod_ecad || "-"}</TableCell>
                          <TableCell className="py-3 text-sm">{work.iswc || "-"}</TableCell>
                          <TableCell className="py-3 text-sm max-w-[140px] truncate">{work.compositores || "-"}</TableCell>
                          <TableCell className="py-3 text-sm max-w-[120px] truncate">{work.editora || "-"}</TableCell>
                          <TableCell className="py-3 text-sm">{work.music_genre || "-"}</TableCell>
                          <TableCell className="py-3 text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => setWorkViewModal({ open: true, obra: work })}>
                                  <Eye className="h-4 w-4 mr-2" />
                                  Ver
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setWorkModal({ open: true, mode: "edit", obra: work })}>
                                  <Pencil className="h-4 w-4 mr-2" />
                                  Editar
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  disabled={work.status === "under_review"}
                                  title={work.status === "under_review" ? "Obra em análise — aguarde a conclusão antes de registrar um fonograma" : undefined}
                                  onClick={() => {
                                    setActiveTab("fonogramas");
                                    setPhonogramModal({ open: true, mode: "create", fonograma: { id: "", work_id: work.id } as Phonogram });
                                  }}
                                >
                                  <Disc className="h-4 w-4 mr-2" />
                                  Registrar Fonograma
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => setDeleteModal({ open: true, item: work, type: "obra" })}
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
                    total={worksPg.total}
                    page={worksPg.page}
                    pageSize={worksPg.pageSize}
                    onPageChange={worksPg.setPage}
                    onPageSizeChange={worksPg.setPageSize}
                    itemLabel="obras"
                  />
                </div>
              ) : workPageError && workTotal === 0 ? (
                <UnavailableState onRetry={() => refetchWorkPage()} />
              ) : (
                <EmptyState
                  icon={Music}
                  title="Nenhuma obra cadastrada"
                  description="Comece registrando sua primeira obra musical"
                  actionLabel="Nova Obra"
                  onAction={() => setWorkTypeSelectorOpen(true)}
                />
              )}
            </CardContent>
          </Card>
        )}

      </div>

      {/* Modals */}
      <WorkTypeSelectorModal
        open={workTypeSelectorOpen}
        onOpenChange={(v) => { setWorkTypeSelectorOpen(v); if (!v) setPendingProjectId(null); }}
        onSelect={async (type) => {
          let workSeed: Record<string, unknown> | undefined;
          if (pendingProjectId) {
            // Fetches DIRECTLY by ID (GET /projects/:id) — does not depend on the project
            // being among the first 50 loaded by an unfiltered useProjects()
            // (Task J).
            const project = await storage.findById<ProjectWithRelations>("projects", pendingProjectId);
            if (project) {
              const tracks = parseTracksFromProject(project);
              workSeed = projectToWorkSeed(project, tracks[0] ?? null);
            } else {
              workSeed = { project_id: pendingProjectId };
            }
          }
          setWorkModal({ open: true, mode: "create", obra: workSeed as Work | undefined, tipoObra: type });
          setPendingProjectId(null);
        }}
      />
    </MainLayout>
    )}

      {/* Outside the isLoading gate on purpose — the same bug as /artists
          (Task C): WorkFormModal/PhonogramFormModal call useWorks()/
          usePhonograms() again only for the mutations, the same queries as the
          isLoading above. Mounting them only after isLoading turned false created
          new observers on those queries; on error (backend down),
          refetchOnMount reopened isLoading, the gate unmounted the modals
          again — an infinite loading loop. Keeping them always mounted breaks
          the cycle. */}
      <WorkFormModal
        open={workModal.open}
        onOpenChange={(open) => setWorkModal({ ...workModal, open })}
        mode={workModal.mode}
        obra={workModal.obra}
        tipoObra={workModal.tipoObra}
        onSaved={(info) => setContractModal({ open: true, prefill: info })}
      />
      <WorkViewModal
        open={workViewModal.open}
        onOpenChange={(open) => setWorkViewModal({ ...workViewModal, open })}
        obra={workViewModal.obra}
      />
      <PhonogramFormModal
        open={phonogramModal.open}
        onOpenChange={(open) => setPhonogramModal({ ...phonogramModal, open })}
        mode={phonogramModal.mode}
        fonograma={phonogramModal.fonograma as import("@/modules/catalog/components/PhonogramFormModal").PhonogramFormInput | null | undefined}
        onSaved={(info) => setContractModal({ open: true, prefill: info })}
      />
      <PhonogramViewModal
        open={phonogramViewModal.open}
        onOpenChange={(open) => setPhonogramViewModal({ ...phonogramViewModal, open })}
        fonograma={phonogramViewModal.fonograma as unknown as import("@/modules/catalog/components/PhonogramViewModal").PhonogramViewData | null | undefined}
      />
      <DeleteConfirmModal
        open={deleteModal.open}
        onOpenChange={(open) => setDeleteModal({ ...deleteModal, open })}
        onConfirm={handleDelete}
        title={deleteModal.type === "fonograma" ? "Excluir Fonograma" : "Excluir Obra"}
        description={`Tem certeza que deseja excluir ${deleteModal.type === "fonograma" ? "este fonograma" : "esta obra"}? Esta ação não pode ser desfeita.`}
      />
      <ContractFormModal
        open={contractModal.open}
        onOpenChange={(open) => setContractModal({ ...contractModal, open })}
        mode="create"
        prefill={contractModal.prefill}
      />
    </>
  );
}
