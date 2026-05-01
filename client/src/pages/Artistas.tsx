import { useState, useMemo, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Users, Phone, Mail, Sparkles, Instagram, Music2, Youtube, Music,
  DollarSign, Calendar, CheckCircle, Search, PlusCircle, Pencil, Trash2, Eye,
  MoreVertical,
} from "lucide-react";
import { useArtistas, type Artista } from "@/hooks/useArtistas";
import { ArtistaPlatformMetrics } from "@/components/forms/ArtistaPlatformMetrics";
import { useArtistasAssinados } from "@/hooks/useArtistasAssinados";
import { useContratos } from "@/hooks/useContratos";
import { useEventos } from "@/hooks/useEventos";
import { useMetrics } from "@/hooks/useMetrics";
import { ContratoStatusBadge, getContratoSituacao } from "@/components/shared/ContratoStatusBadge";
import { formatCurrency } from "@/lib/utils-format";
import { ArtistaViewModal } from "@/components/forms/ArtistaViewModalNew";
import { ArtistaVisao360Modal } from "@/components/forms/ArtistaVisao360Modal";
import { ArtistaFormModal } from "@/components/forms/ArtistaFormModal";
import { DeleteConfirmModal } from "@/components/forms/DeleteConfirmModal";
import { ArtistasSkeleton } from "@/components/shared/PageSkeletons";
import { toast } from "sonner";

export default function Artistas() {
  const navigate = useNavigate();
  const { id: editIdFromUrl } = useParams<{ id?: string }>();
  const { artistas: artistasComContrato, isLoading: artistasLoading } = useArtistasAssinados();
  const { artistas: todosArtistas, deleteArtista } = useArtistas();

  const { eventos } = useEventos();
  const { contratos } = useContratos();

  const contratosPorArtista = useMemo(() => {
    const map = new Map<string, Array<{ status?: string | null; data_fim?: string | null }>>();
    for (const c of contratos as Array<{ artista_id?: string | null; status?: string | null; data_fim?: string | null }>) {
      if (!c.artista_id) continue;
      const arr = map.get(c.artista_id) ?? [];
      arr.push({ status: c.status, data_fim: c.data_fim });
      map.set(c.artista_id, arr);
    }
    return map;
  }, [contratos]);

  const { artistasMetrics, isLoading: metricsLoading } = useMetrics();
  const isLoading = artistasLoading || metricsLoading;
  const metricas = artistasMetrics;

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [generoFilter, setGeneroFilter] = useState<string>("todos");

  // Modals state
  const [createModal, setCreateModal] = useState(false);
  const [editModal, setEditModal] = useState<{ open: boolean; artista?: Artista }>({ open: false });
  const [viewModal, setViewModal] = useState<{ open: boolean; artista?: Artista }>({ open: false });
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; artista?: Artista }>({ open: false });
  const [visao360Modal, setVisao360Modal] = useState<{ open: boolean; artista?: Artista }>({ open: false });

  const [selectedArtists, setSelectedArtists] = useState<string[]>([]);

  const getArtistaShows = (artistaId: string) =>
    eventos.filter(e => e.artista_id === artistaId && e.tipo_evento === "Show");
  const getArtistaShowsAgendados = (artistaId: string) =>
    eventos.filter(e => e.artista_id === artistaId && e.tipo_evento === "Show" && (e.status === "Confirmado" || e.status === "Pendente"));
  const getArtistaShowsRealizados = (artistaId: string) =>
    eventos.filter(e => e.artista_id === artistaId && e.tipo_evento === "Show" && e.status === "Realizado");

  const generosUnicos = useMemo(() => {
    const generos = artistasComContrato.map(a => a.genero_musical).filter(Boolean);
    return [...new Set(generos)] as string[];
  }, [artistasComContrato]);

  const artistasFiltrados = useMemo(() => {
    return artistasComContrato.filter(artista => {
      const matchesSearch =
        searchTerm === "" ||
        artista.nome_artistico.toLowerCase().includes(searchTerm.toLowerCase()) ||
        artista.nome_civil?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        artista.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        artista.genero_musical?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === "todos" || artista.status === statusFilter;
      const matchesGenero = generoFilter === "todos" || artista.genero_musical === generoFilter;
      return matchesSearch && matchesStatus && matchesGenero;
    });
  }, [artistasComContrato, searchTerm, statusFilter, generoFilter]);

  const handleDelete = () => {
    if (deleteModal.artista) {
      deleteArtista.mutate(deleteModal.artista.id);
      setDeleteModal({ open: false });
    }
  };

  const clearFilters = () => {
    setSearchTerm("");
    setStatusFilter("todos");
    setGeneroFilter("todos");
  };

  const hasActiveFilters = searchTerm !== "" || statusFilter !== "todos" || generoFilter !== "todos";

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ativo":
      case "contratado":
        return <Badge className="bg-red-600 hover:bg-red-600 text-white text-xs px-2 py-0.5">Ativo</Badge>;
      case "parceiro":
        return <Badge className="bg-blue-600 hover:bg-blue-600 text-white text-xs px-2 py-0.5">Parceiro</Badge>;
      case "inativo":
        return <Badge className="bg-gray-600 hover:bg-gray-600 text-white text-xs px-2 py-0.5">Inativo</Badge>;
      default:
        return <Badge variant="secondary" className="text-xs px-2 py-0.5">{status}</Badge>;
    }
  };

  const getInitials = (nome: string) =>
    nome.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase();

  const toggleSelectAll = () => {
    if (selectedArtists.length === artistasFiltrados.length) {
      setSelectedArtists([]);
    } else {
      setSelectedArtists(artistasFiltrados.map(a => a.id));
    }
  };

  const toggleSelectArtist = (id: string) => {
    if (selectedArtists.includes(id)) {
      setSelectedArtists(selectedArtists.filter(a => a !== id));
    } else {
      setSelectedArtists([...selectedArtists, id]);
    }
  };

  useEffect(() => {
    if (!editIdFromUrl || isLoading) return;
    const found =
      todosArtistas.find((a) => a.id === editIdFromUrl) ||
      artistasComContrato.find((a) => a.id === editIdFromUrl);
    if (found) setEditModal({ open: true, artista: found });
  }, [editIdFromUrl, isLoading, todosArtistas, artistasComContrato]);

  if (isLoading) {
    return <ArtistasSkeleton />;
  }

  return (
    <MainLayout
      title="Artistas"
      description="Visão geral de todos os artistas"
      actions={
        <Button
          className="gap-2"
          onClick={() => setCreateModal(true)}
          data-testid="button-novo-artista"
        >
          <PlusCircle className="h-4 w-4" />
          Novo Artista
        </Button>
      }
    >
      <div className="space-y-6">
        <div className="space-y-6">
          {/* KPI Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Total de Artistas</span>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <p className="text-3xl font-bold text-foreground mt-2">{metricas.totalArtistas}</p>
                  <p className="text-xs text-muted-foreground mt-1">no casting</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Total de Shows</span>
                    <Music className="h-4 w-4 text-purple-500" />
                  </div>
                  <p className="text-3xl font-bold text-purple-500 mt-2">{metricas.totalShows}</p>
                  <p className="text-xs text-muted-foreground mt-1">shows vendidos</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Shows Agendados</span>
                    <Calendar className="h-4 w-4 text-blue-500" />
                  </div>
                  <p className="text-3xl font-bold text-blue-500 mt-2">{metricas.showsAgendados}</p>
                  <p className="text-xs text-muted-foreground mt-1">pendentes/confirmados</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Shows Realizados</span>
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  </div>
                  <p className="text-3xl font-bold text-green-500 mt-2">{metricas.showsRealizados}</p>
                  <p className="text-xs text-muted-foreground mt-1">executados</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Receita em Shows</span>
                    <DollarSign className="h-4 w-4 text-green-500" />
                  </div>
                  <p className="text-3xl font-bold text-green-500 mt-2">{formatCurrency(metricas.receitaTotal)}</p>
                  <p className="text-xs text-muted-foreground mt-1">total vendido</p>
                </CardContent>
              </Card>
            </div>

            {/* Search and Filters */}
            <div className="flex items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome, email, gênero..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="pl-10 bg-card border-border"
                />
              </div>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[160px] bg-card border-border">
                  <SelectValue placeholder="Todos Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos Status</SelectItem>
                  <SelectItem value="contratado">Ativo</SelectItem>
                  <SelectItem value="parceiro">Parceiro</SelectItem>
                  <SelectItem value="independente">Independente</SelectItem>
                </SelectContent>
              </Select>

              <Select value={generoFilter} onValueChange={setGeneroFilter}>
                <SelectTrigger className="w-[160px] bg-card border-border">
                  <SelectValue placeholder="Todos Gêneros" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos Gêneros</SelectItem>
                  {generosUnicos.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                </SelectContent>
              </Select>

              {hasActiveFilters && (
                <Button variant="outline" onClick={clearFilters}>
                  Limpar
                </Button>
              )}
            </div>

            {/* Select All */}
            <div className="flex items-center gap-3 mb-4 pb-3 border-b border-border">
              <Checkbox
                checked={selectedArtists.length === artistasFiltrados.length && artistasFiltrados.length > 0}
                onCheckedChange={toggleSelectAll}
                className="border-muted-foreground"
              />
              <span className="text-sm text-muted-foreground flex-1">Selecionar todos</span>
              {hasActiveFilters && (
                <span className="text-sm text-muted-foreground" data-testid="text-contagem-artistas">
                  {artistasFiltrados.length} de {artistasComContrato.length} artistas
                </span>
              )}
            </div>

            {/* Lista de Artistas */}
            <div className="space-y-4">
              {artistasFiltrados.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground border rounded-lg bg-card">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p data-testid="text-empty-title">
                    {hasActiveFilters ? "Nenhum artista corresponde aos filtros aplicados" : "Nenhum artista com contrato assinado"}
                  </p>
                  <p className="text-sm mt-2" data-testid="text-empty-description">
                    {hasActiveFilters
                      ? "Tente ajustar a busca ou limpar os filtros"
                      : "Cadastre um contato como artista no CRM e assine um contrato para que ele apareça aqui."}
                  </p>
                </div>
              ) : (
                artistasFiltrados.map(artista => (
                  <div key={artista.id}>
                    {/* Artist Card */}
                    <div className="border rounded-lg bg-card p-4">
                      <div className="flex items-start gap-4">
                        {/* Checkbox */}
                        <div className="pt-6">
                          <Checkbox
                            checked={selectedArtists.includes(artista.id)}
                            onCheckedChange={() => toggleSelectArtist(artista.id)}
                            className="border-red-500 data-[state=checked]:bg-red-500"
                          />
                        </div>

                        {/* Avatar */}
                        <div className="flex-shrink-0">
                          <Avatar className="h-16 w-16">
                            <AvatarFallback className="bg-muted text-foreground text-xl font-semibold">
                              {getInitials(artista.nome_artistico)}
                            </AvatarFallback>
                          </Avatar>
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="grid grid-cols-1 lg:grid-cols-[0.6fr_auto_1.4fr] gap-4">
                            {/* Column 1: Artist Info */}
                            <div className="space-y-2">
                              <div>
                                <h3 className="font-semibold text-lg text-foreground">{artista.nome_artistico}</h3>
                                <p className="text-sm text-muted-foreground">{artista.genero_musical || "Não informado"}</p>
                              </div>
                              <div className="flex flex-wrap items-center gap-1">
                                {getStatusBadge(artista.status)}
                                <ContratoStatusBadge
                                  situacao={getContratoSituacao(contratosPorArtista.get(artista.id))}
                                  data-testid={`badge-contrato-${artista.id}`}
                                />
                              </div>
                              <div className="flex flex-col gap-1 text-sm text-muted-foreground pt-1">
                                <span className="flex items-center gap-1">
                                  <Phone className="h-3.5 w-3.5" />
                                  {artista.telefone || "Não informado"}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Mail className="h-3.5 w-3.5" />
                                  {artista.email || "Não informado"}
                                </span>
                              </div>
                            </div>

                            {/* Column 2: Social Networks & Stats */}
                            <div className="space-y-3">
                              <div>
                                <p className="text-sm font-medium text-foreground mb-1">Redes Sociais</p>
                                <div className="flex items-center gap-2">
                                  <Instagram className="h-5 w-5 text-muted-foreground hover:text-foreground cursor-pointer" />
                                  <Music2 className="h-5 w-5 text-muted-foreground hover:text-foreground cursor-pointer" />
                                  <Youtube className="h-5 w-5 text-muted-foreground hover:text-foreground cursor-pointer" />
                                  <Music className="h-5 w-5 text-muted-foreground hover:text-foreground cursor-pointer" />
                                </div>
                              </div>

                              {/* Stats */}
                              <div className="flex items-center gap-6">
                                <div className="text-center">
                                  <p className="text-2xl font-bold text-foreground">{getArtistaShows(artista.id).length}</p>
                                  <p className="text-xs text-muted-foreground">Shows</p>
                                </div>
                                <div className="text-center">
                                  <p className="text-2xl font-bold text-foreground">{getArtistaShowsAgendados(artista.id).length}</p>
                                  <p className="text-xs text-muted-foreground">Agendados</p>
                                </div>
                                <div className="text-center">
                                  <p className="text-2xl font-bold text-foreground">{getArtistaShowsRealizados(artista.id).length}</p>
                                  <p className="text-xs text-muted-foreground">Realizados</p>
                                </div>
                              </div>
                            </div>

                            {/* Column 3: Profile Info + Action Buttons */}
                            <div className="space-y-3 flex flex-row">
                              <div className="space-y-1 max-w-[200px]">
                                <p className="text-sm font-medium text-foreground">Perfil: Gravadora</p>
                                <p className="text-sm">
                                  <span className="text-foreground">Nome:</span>{" "}
                                  <span className="text-muted-foreground">{artista.nome_civil || "Não informado"}</span>
                                </p>
                                <p className="text-sm">
                                  <span className="text-foreground">Tel:</span>{" "}
                                  <span className="text-muted-foreground">{artista.telefone || "Não informado"}</span>
                                </p>
                                <p className="text-sm">
                                  <span className="text-foreground">Email:</span>{" "}
                                  <span className="text-muted-foreground">{artista.email || "Não informado"}</span>
                                </p>
                              </div>

                              {/* Action Buttons: Visão 360° (visible) + 3-dot dropdown */}
                              <div className="flex-wrap gap-1 ml-auto flex items-center justify-end">
                                <Button
                                  size="sm"
                                  className="bg-red-600 hover:bg-red-700 text-white gap-1"
                                  onClick={() => setVisao360Modal({ open: true, artista: artista as any })}
                                  data-testid={`button-visao360-${artista.id}`}
                                >
                                  <Sparkles className="h-3.5 w-3.5" />
                                  Visão 360°
                                </Button>

                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-8 w-8 p-0"
                                      data-testid={`button-menu-${artista.id}`}
                                    >
                                      <MoreVertical className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem
                                      onClick={() => setViewModal({ open: true, artista: artista as any })}
                                      data-testid={`menu-view-${artista.id}`}
                                    >
                                      <Eye className="h-4 w-4 mr-2" />
                                      Ver detalhes
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => setEditModal({ open: true, artista })}
                                      data-testid={`menu-edit-${artista.id}`}
                                    >
                                      <Pencil className="h-4 w-4 mr-2" />
                                      Editar
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      className="text-destructive focus:text-destructive"
                                      onClick={() => setDeleteModal({ open: true, artista: artista as any })}
                                      data-testid={`menu-delete-${artista.id}`}
                                    >
                                      <Trash2 className="h-4 w-4 mr-2" />
                                      Excluir
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Platform Metrics — Spotify/YouTube/Deezer vêm das Edge
                        Functions (Tasks #340 e #354). Apple Music e SoundCloud
                        mostram apenas o link do perfil cadastrado (sem
                        integração de métricas pública por enquanto).
                        Instagram/TikTok permanecem como placeholder até
                        integração própria. */}
                    <ArtistaPlatformMetrics
                      artistaId={artista.id}
                      spotifyArtistId={(artista as Artista).spotify_artist_id}
                      youtubeChannelId={(artista as Artista).youtube_channel_id}
                      deezerUrl={(artista as Artista).deezer_url}
                      appleMusicUrl={(artista as Artista).apple_music_url}
                      soundcloudUrl={(artista as Artista).soundcloud_url}
                    />
                  </div>
                ))
              )}
            </div>
        </div>
      </div>

      {/* Modals */}
      <ArtistaFormModal open={createModal} onOpenChange={setCreateModal} />

      <ArtistaFormModal
        open={editModal.open}
        onOpenChange={open => {
          setEditModal(prev => ({ ...prev, open }));
          if (!open && editIdFromUrl) navigate("/artistas");
        }}
        artista={editModal.artista}
      />

      <ArtistaViewModal
        open={viewModal.open}
        onOpenChange={open => setViewModal({ ...viewModal, open })}
        artista={viewModal.artista as any}
      />

      <DeleteConfirmModal
        open={deleteModal.open}
        onOpenChange={open => setDeleteModal({ ...deleteModal, open })}
        title="Excluir Artista"
        description="Tem certeza que deseja excluir este artista? Esta ação não pode ser desfeita."
        onConfirm={handleDelete}
      />

      <ArtistaVisao360Modal
        open={visao360Modal.open}
        onOpenChange={open => setVisao360Modal({ ...visao360Modal, open })}
        artista={visao360Modal.artista as any}
      />
    </MainLayout>
  );
}
