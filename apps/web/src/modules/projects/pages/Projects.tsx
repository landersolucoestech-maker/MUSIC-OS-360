import { useState, useMemo, useEffect } from "react";
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
import { getFirstMusicaInfo, parseMusicasFromProjeto } from "@/modules/projects/lib/musica-helpers";

// In mock mode (and over HTTP — /projects não faz join de artista) o
// backend não devolve a relação `artistas` embutida. Injeta manualmente a
// partir do id→artista map — usado tanto na lista completa (deep-link,
// dropdown de gêneros) quanto na página atual vinda do backend.
function withArtista<T extends { artist_id?: string | null; artistas?: unknown }>(
  list: T[],
  artistasById: Record<string, any>,
): T[] {
  return list.map(p => ({
    ...p,
    artistas: p.artistas ?? (p.artist_id ? artistasById[p.artist_id] : undefined),
  }));
}

export default function Projects() {
  const navigate = useNavigate();
  // Task J: lista completa (rawProjetos/useProjects() sem filtro) usada
  // APENAS para popular o dropdown de gêneros — um caso de "valores
  // distintos para filtro" ainda pendente de um endpoint dedicado
  // (equivalente a /works/stats/generos), então continua sujeito ao cap de
  // 50 do tenant nessa lista específica de opções; não afeta a tabela (Task
  // H, paginada) nem a busca/filtro em si (server-side). Deep-link e o nome
  // do artista por linha, que ERAM os riscos reais de dado incorreto/
  // ausente, foram migrados abaixo para busca direta por ID.
  const { projects: rawProjetos, isLoading, deleteProject: deleteProjeto } = useProjects();

  const [formModal, setFormModal] = useState<{ open: boolean; mode: "create" | "edit"; projeto?: any }>({ open: false, mode: "create" });
  const [viewModal, setViewModal] = useState<{ open: boolean; projeto?: any }>({ open: false });
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; projeto?: any }>({ open: false });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [artistaFilter, setArtistaFilter] = useState("all");
  const [tipoFilter, setTipoFilter] = useState("all");
  const [generoFilter, setGeneroFilter] = useState("all");

  const [searchParams, setSearchParams] = useSearchParams();
  const projectIdParam = searchParams.get("projeto");

  // Auto-open the view modal when arriving with ?projeto=:id (e.g. from an
  // Obra link) — busca DIRETO por ID (GET /projects/:id), não depende do
  // projeto estar entre os primeiros 50 carregados por useProjects() sem
  // filtro (Task J).
  const { entity: deepLinkProjeto } = useEntityById<ProjectWithRelationsExtended>("projects", projectIdParam ?? undefined);
  useEffect(() => {
    if (!projectIdParam || !deepLinkProjeto) return;
    setViewModal({ open: true, projeto: deepLinkProjeto });
    const next = new URLSearchParams(searchParams);
    next.delete("projeto");
    setSearchParams(next, { replace: true });
  }, [searchParams, projectIdParam, deepLinkProjeto, setSearchParams]);

  // Canonical genre resolver: direct field wins; fallback to first track only.
  // Usado só para popular o dropdown de gêneros (lista completa) — a
  // filtragem em si agora acontece no backend, sobre a coluna `genero`
  // direta (que já é o mesmo valor persistido como atalho na criação/edição,
  // ver migration 20260719000005).
  const getProjetoGenero = (p: ProjectWithRelationsExtended): string => {
    if (p.genero) return (p.genero as string).trim().toLowerCase();
    const musicas = parseMusicasFromProjeto(p);
    return (musicas[0]?.genero || "").trim().toLowerCase();
  };

  const generos = useMemo(() => {
    const set = new Set<string>();
    (rawProjetos as ProjectWithRelationsExtended[]).forEach(p => {
      const g = getProjetoGenero(p);
      if (g) set.add(g);
    });
    return Array.from(set).sort();
  }, [rawProjetos]);

  const debouncedSearch = useDebounce(searchTerm, 300);

  // Task H: paginação real server-side — a página muda de request (nunca
  // recorta uma lista já baixada), e volta pra página 0 quando um filtro
  // muda (senão a página 5 de um filtro que só tem 2 páginas fica presa).
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  useEffect(() => { setPage(0); }, [debouncedSearch, statusFilter, artistaFilter, tipoFilter, generoFilter]);

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
    type: tipoFilter !== "all" ? tipoFilter : undefined,
    artistId: artistaFilter !== "all" ? artistaFilter : undefined,
    genero: generoFilter !== "all" ? generoFilter : undefined,
  });

  // Task J: nome do artista por linha, resolvido por ID direto (GET
  // /artists/:id) só para os projetos da página atual — antes injetava a
  // partir de useArtistas() sem filtro, truncado nos primeiros 50 artistas
  // do tenant (silenciosamente ocultava o nome de qualquer artista além
  // desse cap).
  const [resolvedArtistasMap, setResolvedArtistasMap] = useState<Record<string, Artist>>({});
  const pageArtistaIds = useMemo(
    () => Array.from(new Set((pageItems as ProjectWithRelationsExtended[]).map(p => p.artist_id).filter((id): id is string => !!id))),
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
        setResolvedArtistasMap((prev) => ({ ...prev, ...map }));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [pageArtistaIds]);

  const pageProjetos = useMemo<ProjectWithRelationsExtended[]>(
    () => withArtista(pageItems as ProjectWithRelationsExtended[], resolvedArtistasMap),
    [pageItems, resolvedArtistasMap],
  );

  // KPIs: contagem por status SOBRE O TENANT INTEIRO (não a página atual)
  // — GET /projects/stats, agregado no banco.
  const { stats: projetosStats } = useProjectsStats();

  const handleDelete = () => {
    if (deleteModal.projeto) {
      deleteProjeto.mutate(deleteModal.projeto.id);
      setDeleteModal({ open: false });
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    const ids = selectedIds;
    setSelectedIds([]);
    const result = await runBulkAction(ids, (id) => deleteProjeto.mutateAsync(id));
    reportBulkResult(result, "excluído", "projeto");
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === pageProjetos.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(pageProjetos.map(p => p.id));
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
        data-testid="button-novo-projeto"
      >
        <PlusCircle className="h-3.5 w-3.5" />
        Novo Projeto
      </Button>
    </RequirePermission>
  );

  // Partição por status (bucket = status bruto, sem agrupamento) — cada
  // projeto cai em exatamente um bucket vindo de GET /projects/stats.
  const tally = { in_progress: 0, completed: 0, planning: 0 };
  for (const [status, count] of Object.entries(projetosStats.byGroup)) {
    if (status in tally) tally[status as keyof typeof tally] += count;
  }
  const metricas = {
    ativos: tally.in_progress,
    concluidos: tally.completed,
    rascunhos: tally.planning,
    total: projetosStats.total,
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
          <MetricCard title="Projetos Ativos" value={metricas.ativos} description="em desenvolvimento" icon={Clock} accent="primary" />
          <MetricCard title="Concluídos" value={metricas.concluidos} description="projetos finalizados" icon={TrendingUp} accent="success" />
          <MetricCard title="Rascunhos" value={metricas.rascunhos} description="em planejamento" icon={FileText} accent="warning" />
          <MetricCard title="Total de Projetos" value={metricas.total} description="cadastrados no sistema" icon={LayoutGrid} accent="primary" />
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
          {/* Task J: busca server-side (AsyncEntityCombobox) — antes populava
              o Select com useArtistas() sem filtro, truncado nos primeiros
              50 artistas do tenant. */}
          <div className="flex items-center gap-1 shrink-0">
            <div className="h-8 w-[160px]">
              <AsyncEntityCombobox<Artist>
                table="artistas"
                getLabel={(a) => a.stageName ?? ""}
                value={artistaFilter !== "all" ? artistaFilter : null}
                onChange={(id) => setArtistaFilter(id)}
                placeholder="Todos Artista"
                searchPlaceholder="Buscar artista..."
                data-testid="select-filter-artista"
              />
            </div>
            {artistaFilter !== "all" && (
              <Button variant="ghost" size="sm" onClick={() => setArtistaFilter("all")} data-testid="button-limpar-filtro-artista">
                ×
              </Button>
            )}
          </div>
          <Select value={tipoFilter} onValueChange={setTipoFilter}>
            <SelectTrigger className="w-auto min-w-[126px] shrink-0 h-8 text-sm bg-card border-border">
              <SelectValue placeholder="Todos Tipo de..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Tipo de...</SelectItem>
              <SelectItem value="album">Álbum</SelectItem>
              <SelectItem value="ep">EP</SelectItem>
              <SelectItem value="single">Single</SelectItem>
              <SelectItem value="turne">Turnê</SelectItem>
            </SelectContent>
          </Select>
          <Select value={generoFilter} onValueChange={setGeneroFilter}>
            <SelectTrigger className="w-auto min-w-[126px] shrink-0 h-8 text-sm bg-card border-border">
              <SelectValue placeholder="Todos Gênero" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Gênero</SelectItem>
              {generos.map(g => (
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
                    checked={selectedIds.length === pageProjetos.length && pageProjetos.length > 0}
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

            {pageProjetos.length > 0 ? (
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
                  {pageProjetos.map((project) => {
                    const info = getFirstMusicaInfo(project);
                    return (
                      <TableRow key={project.id} data-testid={`row-projeto-${project.id}`} className={selectedIds.includes(project.id) ? "bg-muted/20" : ""}>
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
                              const capa = (project.capa_url ?? project.photoUrl ?? project.cover_url) as string | undefined;
                              return (
                                <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md bg-muted flex items-center justify-center">
                                  {capa ? (
                                    <img src={capa} alt={project.title} className="h-full w-full object-cover" />
                                  ) : (
                                    <Music className="h-4 w-4 text-muted-foreground" />
                                  )}
                                </div>
                              );
                            })()}
                            <div className="min-w-0">
                              <p className="font-medium truncate" data-testid={`text-title-${project.id}`}>{project.title}</p>
                              {project.artistas?.nome_artistico && (
                                <p className="text-xs text-muted-foreground truncate">{project.artistas.nome_artistico}</p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="capitalize text-sm">{project.type || "—"}</TableCell>
                        <TableCell className="text-sm max-w-[140px] truncate" data-testid={`text-compositores-${project.id}`}>{info.compositores || "—"}</TableCell>
                        <TableCell className="text-sm max-w-[140px] truncate" data-testid={`text-interpretes-${project.id}`}>{info.interpretes || "—"}</TableCell>
                        <TableCell className="text-sm max-w-[140px] truncate" data-testid={`text-produtores-${project.id}`}>{info.produtores || "—"}</TableCell>
                        <TableCell className="capitalize text-sm" data-testid={`text-genero-${project.id}`}>{info.genero || "—"}</TableCell>
                        <TableCell>{getStatusBadge(project.status ?? "")}</TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" data-testid={`button-actions-${project.id}`}>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setViewModal({ open: true, projeto: project })} data-testid={`button-view-${project.id}`}>
                                <Eye className="h-4 w-4 mr-2" /> Ver
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setFormModal({ open: true, mode: "edit", projeto: project })} data-testid={`button-edit-${project.id}`}>
                                <Pencil className="h-4 w-4 mr-2" /> Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setDeleteModal({ open: true, projeto: project })} className="text-destructive" data-testid={`button-delete-${project.id}`}>
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

      {/* Fora do gate de isLoading de propósito — mesmo bug de /artistas
          (Task C): ProjectFormModal chama useProjects() de novo só para
          as mutations, a mesma query do isLoading acima. */}
      <ProjectFormModal key={formModal.mode === "create" ? "create" : (formModal.projeto?.id ?? "edit")} open={formModal.open} onOpenChange={(open) => setFormModal(prev => ({ ...prev, open }))} projeto={formModal.projeto} mode={formModal.mode} onConcluido={(id) => navigate(`/registro-musicas?newObra=${id}`)} />
      <ProjectViewModal open={viewModal.open} onOpenChange={(open) => setViewModal({ ...viewModal, open })} projeto={viewModal.projeto} />
      <DeleteConfirmModal open={deleteModal.open} onOpenChange={(open) => setDeleteModal({ ...deleteModal, open })} title="Excluir Projeto" description={`Tem certeza que deseja excluir o projeto "${deleteModal.projeto?.title}"?`} onConfirm={handleDelete} />
    </>
  );
}
