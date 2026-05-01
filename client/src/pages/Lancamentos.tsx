import { useCallback, useState, useMemo } from "react";
import { toast } from "sonner";
import { useEditQueryParam } from "@/hooks/useEditQueryParam";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Music, Radio, Clock, Eye, AlertTriangle, Upload, Download, Plus, Search, Loader2, Disc } from "lucide-react";
import { SiSpotify, SiApplemusic, SiYoutubemusic } from "react-icons/si";
import { LancamentoFormModal } from "@/components/forms/LancamentoFormModal";
import { LancamentoViewModal } from "@/components/forms/LancamentoViewModal";
import { DeleteConfirmModal } from "@/components/forms/DeleteConfirmModal";
import { exportToCSV, importCSV, CSVColumn } from "@/lib/csv";
import { EmptyState } from "@/components/shared/EmptyState";
import { useLancamentos } from "@/hooks/useLancamentos";
import { useArtistas } from "@/hooks/useArtistas";
import { StatusBadge } from "@/components/shared/StatusBadge";

const lancamentoColumns: CSVColumn[] = [
  { key: "titulo", label: "Título" },
  { key: "tipo", label: "Tipo" },
  { key: "status", label: "Status" },
  { key: "data_lancamento", label: "Data" },
  { key: "distribuidora", label: "Distribuidora" },
  { key: "observacoes", label: "Observações" },
];

export default function Lancamentos() {
  const { lancamentos, isLoading, deleteLancamento, addLancamento } = useLancamentos();
  const { artistas } = useArtistas();
  const [selectAll, setSelectAll] = useState(false);
  const [formModal, setFormModal] = useState<{ open: boolean; mode: "create" | "edit"; lancamento?: any }>({ open: false, mode: "create" });
  const [viewModal, setViewModal] = useState<{ open: boolean; lancamento?: any }>({ open: false });
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; lancamento?: any }>({ open: false });

  useEditQueryParam(
    "edit",
    lancamentos,
    useCallback((lancamento) => setFormModal({ open: true, mode: "edit", lancamento }), []),
  );

  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("all-type");
  const [statusFilter, setStatusFilter] = useState("all-status");
  const [artistFilter, setArtistFilter] = useState("all-artist");

  const handleExport = () => exportToCSV(lancamentos, lancamentoColumns, "lancamentos");
  const handleImport = () => importCSV(async (data) => {
    let importados = 0;
    for (const row of data) {
      const titulo = row["Título"] || row["titulo"] || row["TITULO"];
      if (!titulo) continue;
      try {
        await addLancamento.mutateAsync({
          titulo,
          tipo: row["Tipo"] || row["tipo"] || "single",
          status: row["Status"] || row["status"] || "planejado",
          data_lancamento: row["Data"] || row["data_lancamento"] || null,
          distribuidora: row["Distribuidora"] || row["distribuidora"] || null,
          observacoes: row["Observações"] || row["observacoes"] || null,
        } as any);
        importados++;
      } catch {}
    }
    if (importados > 0) toast.success(`${importados} lançamento(s) importado(s) com sucesso!`);
    else toast.error("Nenhum lançamento válido encontrado no arquivo");
  }, ["Título", "Artista", "Tipo"]);

  const getArtistaById = (id: string | null) => id ? artistas.find(a => a.id === id) : undefined;

  const metricas = useMemo(() => {
    const ativos = lancamentos.filter(l => l.status === "ativo").length;
    const programados = lancamentos.filter(l => l.status === "programado").length;
    const analise = lancamentos.filter(l => l.status === "analise").length;
    return { total: lancamentos.length, ativos, programados, analise };
  }, [lancamentos]);

  const filteredReleases = useMemo(() => {
    return lancamentos.filter((release) => {
      const artista = getArtistaById(release.artista_id);
      const matchesSearch = release.titulo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        artista?.nome_artistico?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = typeFilter === "all-type" || release.tipo?.toLowerCase() === typeFilter.toLowerCase();
      const matchesStatus = statusFilter === "all-status" || release.status === statusFilter;
      const matchesArtist = artistFilter === "all-artist" || release.artista_id === artistFilter;
      return matchesSearch && matchesType && matchesStatus && matchesArtist;
    });
  }, [lancamentos, searchTerm, typeFilter, statusFilter, artistFilter, artistas]);

  const hasActiveFilters = searchTerm !== "" || typeFilter !== "all-type" || statusFilter !== "all-status" || artistFilter !== "all-artist";

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

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </MainLayout>
    );
  }

  const headerActions = (
    <>
      <Button variant="outline" size="sm" className="gap-2" onClick={handleImport}>
        <Upload className="h-4 w-4" />
        Importar
      </Button>
      <Button variant="outline" size="sm" className="gap-2" onClick={handleExport}>
        <Download className="h-4 w-4" />
        Exportar
      </Button>
      <Button size="sm" className="gap-2 bg-primary" data-testid="button-novo-lancamento" onClick={() => setFormModal({ open: true, mode: "create" })}>
        <Plus className="h-4 w-4" />
        Novo Lançamento
      </Button>
    </>
  );

  return (
    <MainLayout title="Lançamentos" description="Gestão de lançamentos e distribuição" actions={headerActions}>
      <div className="space-y-6">
        {/* Metrics */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Lançamentos Ativos</span>
                <Radio className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="mt-2">
                <span className="text-2xl font-bold text-foreground">{metricas.ativos}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">disponíveis nas plataformas</p>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Programados</span>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="mt-2">
                <span className="text-2xl font-bold text-foreground">{metricas.programados}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">programados</p>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Performance</span>
                <Eye className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="mt-2">
                <span className="text-2xl font-bold text-foreground">0%</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">taxa de crescimento</p>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total de Streams</span>
                <Eye className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="mt-2">
                <span className="text-2xl font-bold text-foreground">0</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">reproduções acumuladas</p>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Takedowns</span>
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="mt-2">
                <span className="text-2xl font-bold text-foreground">0</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">lançamentos removidos</p>
            </CardContent>
          </Card>
        </div>

        {/* Search and Filters */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar lançamentos por título ou artista..." 
              className="pl-10 bg-card border-border"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[160px] bg-card border-border">
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
            <SelectTrigger className="w-[160px] bg-card border-border">
              <SelectValue placeholder="Todos Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all-status">Todos Status</SelectItem>
              <SelectItem value="analise">Em Análise</SelectItem>
              <SelectItem value="ativo">Ativo</SelectItem>
              <SelectItem value="programado">Programado</SelectItem>
            </SelectContent>
          </Select>
          <Select value={artistFilter} onValueChange={setArtistFilter}>
            <SelectTrigger className="w-[160px] bg-card border-border">
              <SelectValue placeholder="Todos Artistas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all-artist">Todos Artistas</SelectItem>
              {artistas.map((artist) => (
                <SelectItem key={artist.id} value={artist.id}>{artist.nome_artistico}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {hasActiveFilters && <Button variant="outline" onClick={handleClearFilters}>Limpar</Button>}
        </div>

        {/* Releases List */}
        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg">Lista de Lançamentos</CardTitle>
              <CardDescription>Acompanhe todos os seus lançamentos musicais</CardDescription>
            </div>
            {lancamentos.length > 0 && (
              <div className="flex items-center gap-2">
                <div 
                  className="w-5 h-5 rounded-full border-2 border-red-500 flex items-center justify-center cursor-pointer"
                  onClick={() => setSelectAll(!selectAll)}
                >
                  {selectAll && <div className="w-2.5 h-2.5 rounded-full bg-red-500" />}
                </div>
                <span className="text-sm text-muted-foreground">Selecionar Todos</span>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {filteredReleases.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {filteredReleases.map((release) => {
                  const artista = getArtistaById(release.artista_id);
                  const tipoBadgeColor = release.tipo === "single" ? "bg-red-600" : release.tipo === "ep" ? "bg-blue-600" : "bg-purple-600";
                  const generos = artista?.genero_musical ? [artista.genero_musical] : [];
                  return (
                    <Card key={release.id} data-testid={`card-lancamento-${release.id}`} className="bg-muted/30 border-border overflow-hidden flex flex-col">
                      <div className="relative">
                        <div className="absolute top-3 left-3 z-10">
                          <div className="w-5 h-5 rounded-full border-2 border-red-500 flex items-center justify-center cursor-pointer bg-background/50" data-testid={`checkbox-lancamento-${release.id}`} />
                        </div>
                        <div className="absolute top-3 right-3 z-10">
                          <StatusBadge status={release.status} />
                        </div>
                        <div className="aspect-square bg-muted flex items-center justify-center">
                          <Music className="h-16 w-16 text-red-600/50" />
                        </div>
                      </div>
                      <CardContent className="p-4 flex flex-col flex-1">
                        <div className="mb-1">
                          <h3 className="font-bold text-foreground text-sm uppercase truncate" data-testid={`text-lancamento-titulo-${release.id}`}>{release.titulo}</h3>
                          <p className="text-muted-foreground text-xs" data-testid={`text-lancamento-artista-${release.id}`}>{artista?.nome_artistico || "-"}</p>
                        </div>
                        <div className="flex items-center gap-1 flex-wrap mb-3">
                          <Badge className={`${tipoBadgeColor} text-white text-[10px] no-default-hover-elevate no-default-active-elevate`}>
                            {release.tipo === "single" ? "Single" : release.tipo === "ep" ? "EP" : "Album"}
                          </Badge>
                          {generos.map((g, i) => (
                            <Badge key={i} className="bg-green-600 text-white text-[10px] no-default-hover-elevate no-default-active-elevate">
                              {g}
                            </Badge>
                          ))}
                        </div>
                        <div className="grid grid-cols-4 gap-1 text-center mb-3">
                          <div className="flex flex-col items-center gap-0.5">
                            <SiSpotify className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-[10px] font-medium text-muted-foreground uppercase">Spotify</span>
                            <span className="text-xs text-foreground">--</span>
                          </div>
                          <div className="flex flex-col items-center gap-0.5">
                            <SiApplemusic className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-[10px] font-medium text-muted-foreground uppercase">Apple</span>
                            <span className="text-xs text-foreground">--</span>
                          </div>
                          <div className="flex flex-col items-center gap-0.5">
                            <SiYoutubemusic className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-[10px] font-medium text-muted-foreground uppercase">YouTube</span>
                            <span className="text-xs text-foreground">--</span>
                          </div>
                          <div className="flex flex-col items-center gap-0.5">
                            <Disc className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-[10px] font-medium text-muted-foreground uppercase">Deezer</span>
                            <span className="text-xs text-foreground">--</span>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2 mt-auto">
                          <Button variant="outline" size="sm" className="text-xs" data-testid={`button-ver-lancamento-${release.id}`} onClick={() => setViewModal({ open: true, lancamento: release })}>
                            Ver
                          </Button>
                          <Button variant="outline" size="sm" className="text-xs" data-testid={`button-editar-lancamento-${release.id}`} onClick={() => setFormModal({ open: true, mode: "edit", lancamento: release })}>
                            Editar
                          </Button>
                          <Button variant="outline" size="sm" className="text-xs text-red-500" data-testid={`button-excluir-lancamento-${release.id}`} onClick={() => setDeleteModal({ open: true, lancamento: release })}>
                            Excluir
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                icon={Radio}
                title="Nenhum lançamento cadastrado"
                description="Comece criando seu primeiro lançamento musical"
                actionLabel="Novo Lançamento"
                onAction={() => setFormModal({ open: true, mode: "create" })}
              />
            )}
          </CardContent>
        </Card>
      </div>

      <LancamentoFormModal open={formModal.open} onOpenChange={(open) => setFormModal({ ...formModal, open })} lancamento={formModal.lancamento} mode={formModal.mode} />
      <LancamentoViewModal open={viewModal.open} onOpenChange={(open) => setViewModal({ ...viewModal, open })} lancamento={viewModal.lancamento} />
      <DeleteConfirmModal open={deleteModal.open} onOpenChange={(open) => setDeleteModal({ ...deleteModal, open })} title="Excluir Lançamento" description={`Tem certeza que deseja excluir "${deleteModal.lancamento?.titulo}"?`} onConfirm={handleDelete} />
    </MainLayout>
  );
}
