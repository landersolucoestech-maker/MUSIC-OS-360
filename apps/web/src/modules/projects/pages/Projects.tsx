import { useState, useMemo, useEffect } from "react";
import { tallyProjectStatuses } from "../lib/project-status";
import { captureError } from "@/shared/lib/error-logger";
import { useSearchParams, useNavigate } from "react-router-dom";
import { runBulkAction, reportBulkResult } from "@/shared/hooks/useBulkAction";
import { MainLayout } from "@/shared/components/MainLayout";
import { MetricCard } from "@/shared/components/MetricCard";
import { ListSectionHeader } from "@/shared/components/ListSectionHeader";
import { TablePagination } from "@/shared/ui/table-pagination";
import { Card, CardContent } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Badge } from "@/shared/ui/badge";
import { StatusBadge } from "@/shared/components/StatusBadge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Clock, TrendingUp, FileText, LayoutGrid, Search, Play, Folder, Loader2, PlusCircle, MoreHorizontal, Eye, Pencil, Trash2, Music } from "lucide-react";
import { Checkbox } from "@/shared/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/shared/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { ProjectFormModal } from "@/modules/projects/components/ProjectFormModal";
import { ProjectViewModal } from "@/modules/projects/components/ProjectViewModal";
import { DeleteConfirmModal } from "@/shared/components/DeleteConfirmModal";
import { RequirePermission } from "@/shared/components/RequirePermission";
import { EmptyState } from "@/shared/components/EmptyState";
import { UnavailableState } from "@/shared/components/UnavailableState";
import { useProjects } from "@/modules/projects/hooks/useProjects";
import { useProjectsPaginated, useProjectsStats } from "@/modules/projects/hooks/useProjectsPaginated";
import { useDebounce } from "@/shared/hooks/useDebounce";
import type { Artist } from "@/modules/artist/hooks/useArtists";
import { wireToArtist, type ArtistWireRecord } from "@/modules/artist/services/artist.mapper";
import { useEntityById } from "@/shared/hooks/useEntityLookup";
import { AsyncEntityCombobox } from "@/shared/components/AsyncEntityCombobox";
import { storage } from "@/shared/lib/storage";
import type { ProjectWithRelationsExtended } from "@/modules/projects/types/projects-extensions";
import { getFirstTrackInfo, parseTracksFromProject } from "@/modules/projects/lib/track-helpers";
import { safeImageSrc } from "@/shared/lib/safe-url";

// In mock mode (and over HTTP — /projects does not join the artist) the
// backend does not return the embedded `artist` relation. Inject it manually
// from the id→artist map — used both in the full list (deep link,
// genre dropdown) and in the current page coming from the backend.
function withArtist<T extends { artist_id?: string | null; artist?: unknown }>(
  list: T[],
  artistsById: Record<string, any>,
): T[] {
  return list.map(p => ({
    ...p,
    artist: p.artist ?? (p.artist_id ? artistsById[p.artist_id] : undefined),
  }));
}

export default function Projects() {
  const navigate = useNavigate();
  // Task J: full list (useProjects() without a filter) used
  // ONLY to populate the genre dropdown — a "distinct values
  // for a filter" case still pending a dedicated endpoint
  // (equivalent to /works/stats/genres), so it is still subject to the
  // tenant cap of 50 in this specific options list; it does not affect the table (Task
  // H, paginated) nor the search/filter itself (server-side). The deep link and the
  // per-row artist name, which WERE the real risks of wrong/
  // missing data, were migrated below to a direct lookup by ID.
  const { projects: rawProjects, isLoading, deleteProject } = useProjects();

  const [formModal, setFormModal] = useState<{ open: boolean; mode: "create" | "edit"; project?: any }>({ open: false, mode: "create" });
  const [viewModal, setViewModal] = useState<{ open: boolean; project?: any }>({ open: false });
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; project?: any }>({ open: false });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [artistFilter, setArtistFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [genreFilter, setGenreFilter] = useState("all");

  const [searchParams, setSearchParams] = useSearchParams();
  const projectIdParam = searchParams.get("project");

  // Auto-open the view modal when arriving with ?project=:id (e.g. from an
  // Work link) — fetches DIRECTLY by ID (GET /projects/:id), it does not depend on the
  // project being among the first 50 loaded by useProjects() without
  // filtro (Task J).
  const { entity: deepLinkProject } = useEntityById<ProjectWithRelationsExtended>("projects", projectIdParam ?? undefined);
  useEffect(() => {
    if (!projectIdParam || !deepLinkProject) return;
    setViewModal({ open: true, project: deepLinkProject });
    const next = new URLSearchParams(searchParams);
    next.delete("project");
    setSearchParams(next, { replace: true });
  }, [searchParams, projectIdParam, deepLinkProject, setSearchParams]);

  // Canonical genre resolver: direct field wins; fallback to first track only.
  // Used only to populate the genre dropdown (full list) — the
  // filtering itself now happens on the backend, over the `music_genre`
  // column directly (which is already the same value persisted as a shortcut on create/edit,
  // ver migration 20260719000005).
  const getProjectGenre = (p: ProjectWithRelationsExtended): string => {
    if (p.music_genre) return (p.music_genre as string).trim().toLowerCase();
    const tracks = parseTracksFromProject(p);
    return (tracks[0]?.genre || "").trim().toLowerCase();
  };

  const genres = useMemo(() => {
    const set = new Set<string>();
    (rawProjects as ProjectWithRelationsExtended[]).forEach(p => {
      const g = getProjectGenre(p);
      if (g) set.add(g);
    });
    return Array.from(set).sort();
  }, [rawProjects]);

  const debouncedSearch = useDebounce(searchTerm, 300);

  // Task H: real server-side pagination — the page changes the request (it never
  // slices an already-downloaded list), and goes back to page 0 when a filter
  // changes (otherwise page 5 of a filter that has only 2 pages gets stuck).
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  useEffect(() => { setPage(0); }, [debouncedSearch, statusFilter, artistFilter, typeFilter, genreFilter]);

  const {
    projects: pageItems,
    total,
    isLoading: isLoadingPage,
    error: pageError,
    refetch: refetchPage,
  } = useProjectsPaginated({
    page,
    pageSize,
    search: debouncedSearch || undefined,
    status: statusFilter !== "all" ? statusFilter : undefined,
    type: typeFilter !== "all" ? typeFilter : undefined,
    artistId: artistFilter !== "all" ? artistFilter : undefined,
    genre: genreFilter !== "all" ? genreFilter : undefined,
  });

  // Task J: per-row artist name, resolved by direct ID (GET
  // /artists/:id) only for the projects of the current page — previously it injected
  // from useArtists() without a filter, truncated to the first 50 artists
  // of the tenant (silently hiding the name of any artist beyond
  // desse cap).
  const [resolvedArtistsMap, setResolvedArtistsMap] = useState<Record<string, Artist>>({});
  const pageArtistIds = useMemo(
    () => Array.from(new Set((pageItems as ProjectWithRelationsExtended[]).map(p => p.artist_id).filter((id): id is string => !!id))),
    [pageItems],
  );
  useEffect(() => {
    if (pageArtistIds.length === 0) return;
    let cancelled = false;
    Promise.all(pageArtistIds.map((id) => storage.findById<ArtistWireRecord>("artists", id)))
      .then((results) => {
        if (cancelled) return;
        const map: Record<string, Artist> = {};
        results.forEach((a, i) => { if (a) map[pageArtistIds[i]] = wireToArtist(a); });
        setResolvedArtistsMap((prev) => ({ ...prev, ...map }));
      })
      .catch((err: unknown) => captureError(err instanceof Error ? err : new Error(String(err)), { extra: { source: "Projects.resolveArtists" } }));
    return () => { cancelled = true; };
  }, [pageArtistIds]);

  const pageProjects = useMemo<ProjectWithRelationsExtended[]>(
    () => withArtist(pageItems as ProjectWithRelationsExtended[], resolvedArtistsMap),
    [pageItems, resolvedArtistsMap],
  );

  // KPIs: count per status OVER THE WHOLE TENANT (not the current page)
  // — GET /projects/stats, aggregated in the database.
  const { stats: projectsStats } = useProjectsStats();

  const handleDelete = () => {
    if (deleteModal.project) {
      deleteProject.mutate(deleteModal.project.id);
      setDeleteModal({ open: false });
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    const ids = selectedIds;
    setSelectedIds([]);
    const result = await runBulkAction(ids, (id) => deleteProject.mutateAsync(id));
    reportBulkResult(result, "excluído", "projeto");
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === pageProjects.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(pageProjects.map(p => p.id));
    }
  };

  const getStatusBadge = (status: string) => {
    if (!status) return <Badge variant="neutral">—</Badge>;
    return <StatusBadge status={status} />;
  };

  const headerActions = (
    <RequirePermission module="projects" action="write">
      <Button
        size="sm"
        className="h-8 text-xs gap-1.5"
        onClick={() => setFormModal({ open: true, mode: "create" })}
        data-testid="button-new-project"
      >
        <PlusCircle className="h-3.5 w-3.5" />
        Novo Projeto
      </Button>
    </RequirePermission>
  );

  // Partition by status (bucket = raw status, no grouping) — each
  // project falls into exactly one bucket coming from GET /projects/stats.
  const tally = tallyProjectStatuses(projectsStats.byGroup);
  const metrics = {
    active: tally.active,
    completed: tally.completed,
    drafts: tally.drafts,
    total: projectsStats.total,
  };

  return (
    <>
    {isLoading || isLoadingPage ? (
      <MainLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </MainLayout>
    ) : (
    <MainLayout title="Projetos" description="Gestão completa de projetos musicais" actions={headerActions}>
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <MetricCard title="Projetos Ativos" value={metrics.active} description="em desenvolvimento" icon={Clock} accent="primary" />
          <MetricCard title="Concluídos" value={metrics.completed} description="projetos finalizados" icon={TrendingUp} accent="success" />
          <MetricCard title="Rascunhos" value={metrics.drafts} description="em planejamento" icon={FileText} accent="warning" />
          <MetricCard title="Total de Projetos" value={metrics.total} description="cadastrados no sistema" icon={LayoutGrid} accent="primary" />
        </div>

        <div className="flex items-center gap-2 flex-wrap rounded-lg bg-muted/30 p-3">
          <div className="relative flex-1 min-w-[300px]">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por música, artista, compositor, intérprete, produtor, gênero..."
              className="pl-10 h-8 text-sm bg-card border-border"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-auto min-w-[126px] shrink-0 h-8 text-sm bg-card border-border">
              <SelectValue placeholder="Todos Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Status</SelectItem>
              <SelectItem value="cancelled">Cancelado</SelectItem>
              <SelectItem value="completed">Concluído</SelectItem>
              <SelectItem value="in_progress">Em Andamento</SelectItem>
              <SelectItem value="planning">Planejamento</SelectItem>
            </SelectContent>
          </Select>
          {/* Task J: server-side search (AsyncEntityCombobox) — previously it populated
              the Select with useArtists() without a filter, truncated to the first
              50 artists of the tenant. */}
          <div className="flex items-center gap-1 shrink-0">
            <div className="h-8 w-[160px]">
              <AsyncEntityCombobox<ArtistWireRecord>
                table="artists"
                getLabel={(a) => a.stage_name?.trim() || "Sem nome"}
                value={artistFilter !== "all" ? artistFilter : null}
                onChange={(id) => setArtistFilter(id)}
                placeholder="Todos Artista"
                searchPlaceholder="Buscar artista..."
                data-testid="select-filter-artist"
              />
            </div>
            {artistFilter !== "all" && (
              <Button variant="ghost" size="sm" onClick={() => setArtistFilter("all")} data-testid="button-clear-artist-filter">
                ×
              </Button>
            )}
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-auto min-w-[126px] shrink-0 h-8 text-sm bg-card border-border">
              <SelectValue placeholder="Todos Tipo de..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Tipo de...</SelectItem>
              <SelectItem value="album">Álbum</SelectItem>
              <SelectItem value="ep">EP</SelectItem>
              <SelectItem value="single">Single</SelectItem>
              <SelectItem value="tour">Turnê</SelectItem>
            </SelectContent>
          </Select>
          <Select value={genreFilter} onValueChange={setGenreFilter}>
            <SelectTrigger className="w-auto min-w-[126px] shrink-0 h-8 text-sm bg-card border-border">
              <SelectValue placeholder="Todos Gênero" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Gênero</SelectItem>
              {genres.map(g => (
                <SelectItem key={g} value={g.toLowerCase()}>{g.charAt(0).toUpperCase() + g.slice(1)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Card className="bg-card border-border">
          <CardContent>
            <ListSectionHeader
              title="Lista de Projetos"
              count={total}
              description="Acompanhe o desenvolvimento de todos os projetos musicais"
              action={
                <div className="flex flex-wrap items-center justify-end gap-3">
                  <Checkbox
                    checked={selectedIds.length === pageProjects.length && pageProjects.length > 0}
                    onCheckedChange={toggleSelectAll}
                    data-testid="checkbox-select-all"
                    aria-label="Selecionar todos"
                  />
                  <span className="text-xs text-muted-foreground">
                    {selectedIds.length > 0 ? `${selectedIds.length} projeto(s) selecionado(s)` : "Selecionar todos"}
                  </span>
                  {selectedIds.length > 0 && (
                    <Button
                      variant="destructive"
                      size="sm"
                      className="gap-2"
                      onClick={handleBulkDelete}
                      data-testid="button-bulk-delete"
                    >
                      <Trash2 className="h-4 w-4" />
                      Excluir selecionados ({selectedIds.length})
                    </Button>
                  )}
                </div>
              }
            />

            {pageProjects.length > 0 ? (
              <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[36px]"></TableHead>
                    <TableHead>Título da Música</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Compositores</TableHead>
                    <TableHead>Intérpretes</TableHead>
                    <TableHead>Produtores</TableHead>
                    <TableHead>Gênero</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageProjects.map((project) => {
                    const info = getFirstTrackInfo(project);
                    return (
                      <TableRow key={project.id} data-testid={`row-project-${project.id}`} className={selectedIds.includes(project.id) ? "bg-muted/20" : ""}>
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.includes(project.id)}
                            onCheckedChange={() => toggleSelect(project.id)}
                            data-testid={`checkbox-select-${project.id}`}
                            aria-label={`Selecionar ${project.title}`}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            {(() => {
                              const cover = (project.photoUrl ?? project.cover_url) as string | undefined;
                              return (
                                <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md bg-muted flex items-center justify-center">
                                  {cover ? (
                                    <img src={safeImageSrc(cover)} alt={project.title} className="h-full w-full object-cover" />
                                  ) : (
                                    <Music className="h-4 w-4 text-muted-foreground" />
                                  )}
                                </div>
                              );
                            })()}
                            <div className="min-w-0">
                              <p className="font-medium truncate" data-testid={`text-title-${project.id}`}>{project.title}</p>
                              {project.artist?.stage_name && (
                                <p className="text-xs text-muted-foreground truncate">{project.artist.stage_name}</p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="capitalize text-sm">{project.type || "—"}</TableCell>
                        <TableCell className="text-sm max-w-[140px] truncate" data-testid={`text-composers-${project.id}`}>{info.composers || "—"}</TableCell>
                        <TableCell className="text-sm max-w-[140px] truncate" data-testid={`text-performers-${project.id}`}>{info.performers || "—"}</TableCell>
                        <TableCell className="text-sm max-w-[140px] truncate" data-testid={`text-producers-${project.id}`}>{info.producers || "—"}</TableCell>
                        <TableCell className="capitalize text-sm" data-testid={`text-genre-${project.id}`}>{info.genre || "—"}</TableCell>
                        <TableCell>{getStatusBadge(project.status ?? "")}</TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" data-testid={`button-actions-${project.id}`}>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setViewModal({ open: true, project })} data-testid={`button-view-${project.id}`}>
                                <Eye className="h-4 w-4 mr-2" /> Ver
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setFormModal({ open: true, mode: "edit", project })} data-testid={`button-edit-${project.id}`}>
                                <Pencil className="h-4 w-4 mr-2" /> Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setDeleteModal({ open: true, project })} className="text-destructive" data-testid={`button-delete-${project.id}`}>
                                <Trash2 className="h-4 w-4 mr-2" /> Excluir
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
                total={total}
                page={page}
                pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
                itemLabel="projetos"
              />
              </>
            ) : pageError && total === 0 ? (
              <UnavailableState onRetry={() => refetchPage()} />
            ) : (
              <EmptyState
                icon={Folder}
                title="Nenhum projeto cadastrado"
                description="Comece criando seu primeiro projeto musical"
                actionLabel="Novo Projeto"
                onAction={() => setFormModal({ open: true, mode: "create" })}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
    )}

      {/* Outside the isLoading gate on purpose — same bug as /artists
          (Task C): ProjectFormModal calls useProjects() again only for
          the mutations, the same query as the isLoading above. */}
      <ProjectFormModal key={formModal.mode === "create" ? "create" : (formModal.project?.id ?? "edit")} open={formModal.open} onOpenChange={(open) => setFormModal(prev => ({ ...prev, open }))} project={formModal.project} mode={formModal.mode} onCompleted={(id) => navigate(`/music-registration?newWork=${id}`)} />
      <ProjectViewModal open={viewModal.open} onOpenChange={(open) => setViewModal({ ...viewModal, open })} project={viewModal.project} />
      <DeleteConfirmModal open={deleteModal.open} onOpenChange={(open) => setDeleteModal({ ...deleteModal, open })} title="Excluir Projeto" description={`Tem certeza que deseja excluir o projeto "${deleteModal.project?.title}"?`} onConfirm={handleDelete} />
    </>
  );
}
