import { useState, useMemo, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { storage } from "@/shared/lib/storage";
import { runBulkAction, reportBulkResult } from "@/shared/hooks/useBulkAction";
import { MainLayout } from "@/shared/components/MainLayout";
import { ListSectionHeader } from "@/shared/components/ListSectionHeader";
import { Card, CardContent } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/ui/avatar";
import { Checkbox } from "@/shared/ui/checkbox";
import { Input } from "@/shared/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import {
  Users, Phone, Mail, Sparkles, Music,
  CheckCircle, Search, PlusCircle, Pencil, Trash2,
  MoreVertical, X,
} from "lucide-react";
import { SiInstagram, SiTiktok, SiYoutube, SiSpotify, SiSoundcloud, SiApplemusic } from "react-icons/si";
import { DeezerIcon } from "@/shared/ui/deezer-icon";

import { useArtists, type Artist } from "@/modules/artist/hooks/useArtists";
import { ArtistPlatformMetrics } from "@/modules/artist/components/ArtistPlatformMetrics";
import { useSignedArtists } from "@/modules/artist/hooks/useSignedArtists";
import { useArtistsPaginated, useArtistsVinculoStats, useMusicGenres } from "@/modules/artist/hooks/useArtistsPaginated";
import { useDebounce } from "@/shared/hooks/useDebounce";
import { StatusBadge } from "@/shared/components/StatusBadge";
import { EmptyState } from "@/shared/components/EmptyState";
import { UnavailableState } from "@/shared/components/UnavailableState";
import { MetricCard } from "@/shared/components/MetricCard";
import { TablePagination } from "@/shared/ui/table-pagination";
import { ArtistVision360Modal } from "@/modules/artist/components/ArtistVision360Modal";
import { ArtistFormModal } from "@/modules/artist/components/ArtistFormModal";
import { DeleteConfirmModal } from "@/shared/components/DeleteConfirmModal";
import { ArtistasSkeleton } from "@/shared/components/PageSkeletons";
import { toast } from "sonner";
import { SPECIALTY_LABELS } from "@/modules/artist/mappers";
import { wireToArtist, type ArtistWireRecord } from "@/modules/artist/services/artist.mapper";
import { ArtistRelationshipType } from "@music-os-360/types";
import {
  parseArtistImportRow,
  formValuesToArtistPayload,
} from "@/modules/artist/forms/artist-form.definition";
import { RequirePermission } from "@/shared/components/RequirePermission";

const getXLSX = () => import("xlsx");

// Task H: relationship type (exclusive/partner/independent) comes ready
// from the backend (ArtistsService.list()/vinculoStats() — classification by
// active contract done server-side, against the whole tenant, not just the
// loaded page).
const RELATIONSHIP_BADGE: Record<ArtistRelationshipType, { label: string; status: string }> = {
  [ArtistRelationshipType.EXCLUSIVE]:   { label: "Exclusivo",    status: "exclusivo" },
  [ArtistRelationshipType.PARTNER]:     { label: "Parceiro",     status: "parceiro" },
  [ArtistRelationshipType.INDEPENDENT]: { label: "Independente", status: "sem_contrato" },
};

const PROFILE_LABELS: Record<string, string> = {
  independente: "Independente",
  gravadora: "Gravadora",
  editora: "Editora",
  com_empresario: "Com Empresário",
};

export default function Artists() {
  const navigate = useNavigate();
  const { id: editIdFromUrl } = useParams<{ id?: string }>();
  const { artists: signedArtists } = useSignedArtists();
  const { artists: allArtists, deleteArtist, addArtist, isLoading: allArtistsLoading } = useArtists();
  const excelInputRef = useRef<HTMLInputElement>(null);

  const isLoading = allArtistsLoading;

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [genreFilter, setGenreFilter] = useState<string>("todos");
  const [profileFilter, setProfileFilter] = useState<string>("todos");

  const [createModal, setCreateModal] = useState(false);
  const [editModal, setEditModal] = useState<{ open: boolean; artist?: Artist }>({ open: false });
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; artist?: Artist }>({ open: false });
  const [vision360Modal, setVision360Modal] = useState<{ open: boolean; artist?: Artist }>({ open: false });
  const [selectedArtists, setSelectedArtists] = useState<string[]>([]);

  const debouncedSearch = useDebounce(searchTerm, 300);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  useEffect(() => {
    setPage(0);
  }, [debouncedSearch, statusFilter, genreFilter]);

  const {
    artists: pageItemsRaw, total, isLoading: isLoadingPage, error: pageError, refetch: refetchPage,
  } = useArtistsPaginated({
    page, pageSize, search: debouncedSearch || undefined,
    vinculo: statusFilter !== "todos" ? (statusFilter as ArtistRelationshipType) : undefined,
    genero: genreFilter !== "todos" ? genreFilter : undefined,
  });

  // profileFilter (tipo_perfil) is not a mapped column on the TypeORM entity —
  // client-side refinement applied only over the already-loaded page
  // (documented limitation; doesn't affect total/pagination, which stay exact).
  const pageItems = useMemo(() => {
    if (profileFilter === "todos") return pageItemsRaw;
    return pageItemsRaw.filter(
      (a) => ((a.profileType as string | null | undefined) || "independente") === profileFilter,
    );
  }, [pageItemsRaw, profileFilter]);

  const { stats: relationshipStats } = useArtistsVinculoStats();
  const { genres: uniqueGenres } = useMusicGenres();

  const handleDelete = () => {
    if (deleteModal.artist) {
      deleteArtist.mutate(deleteModal.artist.id);
      setDeleteModal({ open: false });
    }
  };

  const handleExcelImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const XLSX = await getXLSX();
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: "array" });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const data: Record<string, unknown>[] = XLSX.utils.sheet_to_json(worksheet);
      if (data.length === 0) {
        toast.error("Arquivo Excel vazio");
        return;
      }
      let importedCount = 0;
      for (const row of data) {
        // Iterates the single Create form definition: same fields, same
        // persistence conversion used by the modal's submit.
        const values = parseArtistImportRow(row);
        if (!values) continue;
        const payload = formValuesToArtistPayload(values);
        await addArtist.mutateAsync(payload as any);
        importedCount++;
      }
      toast.success(`${importedCount} artista(s) importado(s) com sucesso!`);
    } catch {
      toast.error("Erro ao importar arquivo Excel. Verifique se o formato está correto.");
    } finally {
      if (excelInputRef.current) excelInputRef.current.value = "";
    }
  };

  const clearFilters = () => {
    setSearchTerm("");
    setStatusFilter("todos");
    setProfileFilter("todos");
    setGenreFilter("todos");
  };

  const hasActiveFilters = searchTerm !== "" || statusFilter !== "todos" || genreFilter !== "todos" || profileFilter !== "todos";

  const getInitials = (name: string) =>
    name.split(" ").map((n) => n[0]).join("").substring(0, 2).toUpperCase();

  const toggleSelectAll = () => {
    if (selectedArtists.length === pageItems.length) {
      setSelectedArtists([]);
    } else {
      setSelectedArtists(pageItems.map((a) => a.id));
    }
  };

  const toggleSelectArtist = (id: string) => {
    setSelectedArtists((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]
    );
  };

  const handleBulkDelete = async () => {
    if (selectedArtists.length === 0) return;
    const ids = selectedArtists;
    setSelectedArtists([]);
    const result = await runBulkAction(ids, (id) => deleteArtist.mutateAsync(id));
    reportBulkResult(result, "excluído", "artista");
  };

  useEffect(() => {
    if (!editIdFromUrl || isLoading) return;
    const found =
      allArtists.find((a) => a.id === editIdFromUrl) ||
      signedArtists.find((a) => a.id === editIdFromUrl);
    if (found) {
      setEditModal({ open: true, artist: found });
      return;
    }
    // Task I: artist outside the first batch loaded by useArtists() with no
    // filter — fetches directly by ID instead of never resolving the deep link.
    let cancelled = false;
    storage.findById<ArtistWireRecord>("artistas", editIdFromUrl).then((entity) => {
      if (cancelled || !entity) return;
      setEditModal({ open: true, artist: wireToArtist(entity) });
    });
    return () => { cancelled = true; };
  }, [editIdFromUrl, isLoading, allArtists, signedArtists]);

  return (
    <>
    {isLoading || isLoadingPage ? <ArtistasSkeleton /> : (
    <MainLayout
      title="Artistas"
      description="Visão geral de todos os artistas"
      actions={
        <>
          <input
            ref={excelInputRef}
            type="file"
            accept=".xlsx"
            className="hidden"
            onChange={handleExcelImport}
            data-testid="input-import-excel"
          />
          <RequirePermission module="artists" action="write">
            <Button
              size="sm"
              className="h-8 text-xs gap-1.5"
              onClick={() => setCreateModal(true)}
              data-testid="button-new-artist"
            >
              <PlusCircle className="h-3.5 w-3.5" />
              Novo Artista
            </Button>
          </RequirePermission>
        </>
      }
    >
      <div className="space-y-6">
        {/* ── KPI Stats ── */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title="Total de Artistas"
            value={relationshipStats.total}
            description="no casting"
            icon={Users}
            accent="primary"
          />
          <MetricCard
            title="Artistas Exclusivos"
            value={relationshipStats.exclusive}
            description="contrato exclusivo ativo"
            icon={Sparkles}
            accent="primary"
          />
          <MetricCard
            title="Artistas Parceiros"
            value={relationshipStats.partner}
            description="vínculo não exclusivo"
            icon={Music}
            accent="warning"
          />
          <MetricCard
            title="Independentes"
            value={relationshipStats.independent}
            description="sem contrato ativo"
            icon={CheckCircle}
            accent="success"
          />
        </div>

        {/* ── Filter Bar ── */}
        <div className="flex flex-wrap items-center gap-3 rounded-lg bg-muted/30 p-3">
          <div className="relative min-w-[240px] flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, email, gênero…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-8 text-sm bg-card border-border"
            />
          </div>
          <div className="ml-auto flex flex-wrap items-center justify-end gap-3">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-auto min-w-[142px] shrink-0 h-8 text-sm bg-card border-border">
                <SelectValue placeholder="Todos os artistas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os artistas</SelectItem>
                <SelectItem value={ArtistRelationshipType.EXCLUSIVE}>Exclusivo</SelectItem>
                <SelectItem value={ArtistRelationshipType.PARTNER}>Parceiro</SelectItem>
                <SelectItem value={ArtistRelationshipType.INDEPENDENT}>Independente</SelectItem>
              </SelectContent>
            </Select>
            <Select value={profileFilter} onValueChange={setProfileFilter}>
              <SelectTrigger className="w-auto min-w-[138px] shrink-0 h-8 text-sm bg-card border-border">
                <SelectValue placeholder="Todos os Perfis" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os Perfis</SelectItem>
                {Object.entries(PROFILE_LABELS).sort(([, a], [, b]) => a.localeCompare(b, "pt-BR")).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={genreFilter} onValueChange={setGenreFilter}>
              <SelectTrigger className="w-auto min-w-[132px] shrink-0 h-8 text-sm bg-card border-border">
                <SelectValue placeholder="Todos Gêneros" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos Gêneros</SelectItem>
                {uniqueGenres.map((g) => (
                  <SelectItem key={g} value={g}>{g.charAt(0).toUpperCase() + g.slice(1)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" className="h-8 text-xs gap-1.5 text-muted-foreground" onClick={clearFilters}>
              <X className="h-3 w-3" />
              Limpar
            </Button>
          )}
          {hasActiveFilters && (
            <span className="text-xs text-muted-foreground ml-auto" data-testid="text-artist-count">
              {total} de {relationshipStats.total} artistas
            </span>
          )}
        </div>

        <Card>
          <CardContent className="p-6 space-y-4">
            <ListSectionHeader
              title="Lista de Artistas"
              count={total}
              description="Acompanhe artistas, vínculos, perfis, gêneros e status de contrato"
              action={
                <div className="flex flex-wrap items-center justify-end gap-3">
                  <Checkbox
                    checked={selectedArtists.length === pageItems.length && pageItems.length > 0}
                    onCheckedChange={toggleSelectAll}
                  />
                  <span className="text-xs text-muted-foreground">
                    {selectedArtists.length > 0
                      ? `${selectedArtists.length} artista(s) selecionado(s)`
                      : "Selecionar todos"}
                  </span>
                  {selectedArtists.length > 0 && (
                    <Button
                      variant="destructive"
                      size="sm"
                      className="h-7 text-xs gap-1.5"
                      onClick={handleBulkDelete}
                      data-testid="button-bulk-delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Excluir ({selectedArtists.length})
                    </Button>
                  )}
                </div>
              }
            />

            {/* ── Artists List ── */}
            <div className="space-y-3">
          {pageItems.length === 0 ? (
            pageError && total === 0 ? (
              <UnavailableState onRetry={() => refetchPage()} />
            ) : (
              <EmptyState
                icon={Users}
                title={hasActiveFilters ? "Nenhum resultado" : "Nenhum artista cadastrado"}
                description={
                  hasActiveFilters
                    ? "Nenhum artista corresponde aos filtros aplicados. Tente ajustar a busca."
                    : "Cadastre um contato como artista no CRM e assine um contrato para que ele apareça aqui."
                }
                actionLabel={hasActiveFilters ? undefined : "Criar Artista"}
                onAction={hasActiveFilters ? undefined : () => setCreateModal(true)}
              />
            )
          ) : (
            pageItems.map((artist) => {
              const relationship = RELATIONSHIP_BADGE[artist.vinculo ?? ArtistRelationshipType.INDEPENDENT];

              return (
                <div key={artist.id}>
                  <Card className="group duration-200" data-testid={`card-artist-${artist.id}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4">
                        {/* Checkbox */}
                        <div className="pt-1">
                          <Checkbox
                            checked={selectedArtists.includes(artist.id)}
                            onCheckedChange={() => toggleSelectArtist(artist.id)}
                          />
                        </div>

                        {/* Avatar */}
                        <Avatar className="h-12 w-12 shrink-0">
                          {artist.photoUrl && (
                            <AvatarImage src={artist.photoUrl} alt={artist.stageName} className="object-cover" />
                          )}
                          <AvatarFallback className="bg-primary/10 border border-primary/20 text-primary text-sm font-semibold">
                            {getInitials(artist.stageName)}
                          </AvatarFallback>
                        </Avatar>

                        <div className="flex-1 min-w-0">
                          <div className="grid grid-cols-1 lg:grid-cols-[0.6fr_auto_1.4fr] gap-4">

                            {/* Col 1: Identity */}
                            <div className="space-y-2">
                              <div className="flex items-start gap-2 flex-wrap">
                                <h3 className="font-semibold text-sm leading-tight text-foreground">
                                  {artist.stageName}
                                </h3>
                                <StatusBadge status={relationship.status} label={relationship.label} />
                              </div>
                              {Array.isArray(artist.specialties) && artist.specialties.length > 0 && (
                                <p className="text-[11px] text-muted-foreground leading-tight">
                                  {artist.specialties.map((e: string) => SPECIALTY_LABELS[e] ?? e).join(" · ")}
                                </p>
                              )}
                              {artist.musicGenre && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-border text-muted-foreground h-5">
                                  {artist.musicGenre}
                                </Badge>
                              )}
                              <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1.5">
                                  <Phone className="h-3 w-3" />
                                  {artist.phone || "Não informado"}
                                </span>
                                <span className="flex items-center gap-1.5">
                                  <Mail className="h-3 w-3" />
                                  {artist.email || "Não informado"}
                                </span>
                              </div>
                            </div>

                            {/* Col 2: Social + Stats */}
                            <div className="space-y-3">
                              {/* Social links */}
                              <div>
                                <p className="text-xs font-medium text-muted-foreground mb-1.5">Redes</p>
                                <div className="flex items-center gap-2">
                                  {(() => {
                                    const links = [
                                      { url: artist.instagramUrl, icon: <SiInstagram className="h-4 w-4" />, label: "Instagram" },
                                      { url: artist.tiktokUrl, icon: <SiTiktok className="h-4 w-4" />, label: "TikTok" },
                                      { url: artist.youtubeUrl, icon: <SiYoutube className="h-4 w-4" />, label: "YouTube" },
                                      { url: artist.spotifyUrl, icon: <SiSpotify className="h-4 w-4" />, label: "Spotify" },
                                      { url: artist.deezerUrl, icon: <DeezerIcon className="h-4 w-4" />, label: "Deezer" },
                                      { url: artist.appleMusicUrl, icon: <SiApplemusic className="h-4 w-4" />, label: "Apple Music" },
                                      { url: artist.soundcloudUrl, icon: <SiSoundcloud className="h-4 w-4" />, label: "SoundCloud" },
                                    ];
                                    return links.map(({ url, icon, label }) =>
                                      url ? (
                                        <a
                                          key={label}
                                          href={url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          title={label}
                                          onClick={(e) => e.stopPropagation()}
                                          className="text-muted-foreground hover:text-primary transition-colors"
                                        >
                                          {icon}
                                        </a>
                                      ) : (
                                        <span key={label} title={`${label} não cadastrado`} className="text-muted-foreground/25">
                                          {icon}
                                        </span>
                                      )
                                    );
                                  })()}
                                </div>
                              </div>

                            </div>

                            {/* Col 3: Profile type + Actions */}
                            <div className="flex items-start justify-between gap-3">
                              <div className="space-y-0.5 text-xs">
                                {(() => {
                                  const tp = artist.profileType as string | null | undefined;
                                  if (tp === "com_empresario") {
                                    return (
                                      <>
                                        <p className="font-medium text-foreground"><span className="text-muted-foreground font-normal">Artista:</span> Com Empresário</p>
                                        {artist.managerName && (
                                          <p className="text-muted-foreground">{artist.managerName}</p>
                                        )}
                                        {artist.managerPhone && (
                                          <p className="text-muted-foreground">{artist.managerPhone}</p>
                                        )}
                                        {artist.managerEmail && (
                                          <p className="text-muted-foreground">{artist.managerEmail}</p>
                                        )}
                                      </>
                                    );
                                  }
                                  if (tp === "gravadora" || tp === "editora") {
                                    const label = tp === "gravadora" ? "Gravadora" : "Editora";
                                    return (
                                      <>
                                        <p className="font-medium text-foreground"><span className="text-muted-foreground font-normal">Artista:</span> {label}</p>
                                        {artist.labelName && (
                                          <p className="text-muted-foreground">{artist.labelName}</p>
                                        )}
                                        {artist.labelResponsibleName && (
                                          <p className="text-muted-foreground">{artist.labelResponsibleName}</p>
                                        )}
                                        {artist.labelPhone && (
                                          <p className="text-muted-foreground">{artist.labelPhone}</p>
                                        )}
                                      </>
                                    );
                                  }
                                  return <p className="font-medium text-foreground"><span className="text-muted-foreground font-normal">Artista:</span> Independente</p>;
                                })()}
                              </div>

                              {/* Actions */}
                              <div className="flex items-center gap-1 ml-auto shrink-0">
                                <Button
                                  size="sm"
                                  className="h-7 text-xs gap-1.5"
                                  onClick={() => setVision360Modal({ open: true, artist: artist as any })}
                                  data-testid={`button-vision360-${artist.id}`}
                                >
                                  <Sparkles className="h-3.5 w-3.5" />
                                  Visão 360°
                                </Button>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 w-7 p-0"
                                      data-testid={`button-menu-${artist.id}`}
                                    >
                                      <MoreVertical className="h-3.5 w-3.5" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <RequirePermission module="artists" action="write">
                                      <DropdownMenuItem
                                        onClick={() => setEditModal({ open: true, artist })}
                                        data-testid={`menu-edit-${artist.id}`}
                                      >
                                        <Pencil className="h-3.5 w-3.5 mr-2" />
                                        Editar
                                      </DropdownMenuItem>
                                    </RequirePermission>
                                    <DropdownMenuSeparator />
                                    <RequirePermission module="artists" action="delete">
                                      <DropdownMenuItem
                                        className="text-destructive focus:text-destructive"
                                        onClick={() => setDeleteModal({ open: true, artist: artist as any })}
                                        data-testid={`menu-delete-${artist.id}`}
                                      >
                                        <Trash2 className="h-3.5 w-3.5 mr-2" />
                                        Excluir
                                      </DropdownMenuItem>
                                    </RequirePermission>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <ArtistPlatformMetrics
                    artistId={artist.id}
                    spotifyUrl={artist.spotifyUrl ?? null}
                    youtubeUrl={artist.youtubeUrl ?? null}
                    instagramUrl={artist.instagramUrl ?? null}
                    tiktokUrl={artist.tiktokUrl ?? null}
                    deezerUrl={artist.deezerUrl ?? null}
                    appleMusicUrl={artist.appleMusicUrl ?? null}
                    soundcloudUrl={artist.soundcloudUrl ?? null}
                  />
                </div>
              );
            })
          )}
          {pageItems.length > 0 && (
            <TablePagination
              total={total}
              page={page}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              itemLabel="artistas"
            />
          )}
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
    )}

      {/* Deliberately outside the isLoading gate: ArtistFormModal uses
          useArtists() internally (for the mutations). Mounting it only after
          isLoading became false created a new observer on the same query;
          with the query always in error (backend down), refetchOnMount
          flipped the status back to "pending", isLoading became true again,
          the gate unmounted the modal — an infinite skeleton loop on every
          retry (~12s). Keeping it always mounted breaks the cycle. */}
      <ArtistFormModal open={createModal} onOpenChange={setCreateModal} />
      <ArtistFormModal
        open={editModal.open}
        onOpenChange={(open) => {
          setEditModal((prev) => ({ ...prev, open }));
          if (!open && editIdFromUrl) navigate("/artistas");
        }}
        artist={editModal.artist}
      />
      <DeleteConfirmModal
        open={deleteModal.open}
        onOpenChange={(open) => setDeleteModal({ ...deleteModal, open })}
        title="Excluir Artista"
        description="Tem certeza que deseja excluir este artista? Esta ação não pode ser desfeita."
        onConfirm={handleDelete}
      />
      <ArtistVision360Modal
        open={vision360Modal.open}
        onOpenChange={(open) => setVision360Modal({ ...vision360Modal, open })}
        artista={vision360Modal.artist as any}
      />
    </>
  );
}
