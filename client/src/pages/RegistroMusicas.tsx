import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Music, FileText, Clock, CheckCircle, Upload, Download, Plus, Search, Disc, Loader2, MoreHorizontal, Eye, Pencil, Trash2, FolderKanban } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ObraFormModal, ObraTipoBadge } from "@/components/forms/ObraFormModal";
import { ObraViewModal } from "@/components/forms/ObraViewModal";
import { ObraTipoSelectorModal, type TipoObra } from "@/components/forms/ObraTipoSelectorModal";
import { FonogramaFormModal } from "@/components/forms/FonogramaFormModal";
import { FonogramaViewModal } from "@/components/forms/FonogramaViewModal";
import { DeleteConfirmModal } from "@/components/forms/DeleteConfirmModal";
import { exportToCSV, importCSV, CSVColumn } from "@/lib/csv";
import { toast } from "sonner";
import { EmptyState } from "@/components/shared/EmptyState";
import { AbramusBadge } from "@/components/shared/AbramusBadge";
import { useObras, useFonogramas } from "@/hooks";
import { useProjetos } from "@/hooks/useProjetos";

const fonogramaColumns: CSVColumn[] = [
  { key: "titulo", label: "Título" },
  { key: "status", label: "Status" },
  { key: "isrc", label: "ISRC" },
  { key: "duracao", label: "Duração" },
  { key: "gravadora", label: "Gravadora" },
  { key: "produtores", label: "Produtores" },
];

const obraColumns: CSVColumn[] = [
  { key: "titulo", label: "Título" },
  { key: "status", label: "Status" },
  { key: "iswc", label: "ISWC" },
  { key: "compositores", label: "Compositores" },
  { key: "letristas", label: "Letristas" },
  { key: "genero", label: "Gênero" },
];

export default function RegistroMusicas() {
  const { obras, isLoading: loadingObras, deleteObra, addObra } = useObras();
  const { fonogramas, isLoading: loadingFonogramas, deleteFonograma, addFonograma } = useFonogramas();
  const { projetos: allProjetos } = useProjetos();
  
  const [activeTab, setActiveTab] = useState("obras");
  const [selectAll, setSelectAll] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all-status");
  const [genreFilter, setGenreFilter] = useState("all-genre");
  const [origemFilter, setOrigemFilter] = useState("all-origem");
  const [projetoFilter, setProjetoFilter] = useState("all-projetos");
  const [obraModal, setObraModal] = useState<{ open: boolean; mode: "create" | "edit"; obra?: any; tipoObra?: TipoObra }>({
    open: false,
    mode: "create",
    obra: undefined,
    tipoObra: undefined,
  });
  const [obraTipoSelectorOpen, setObraTipoSelectorOpen] = useState(false);
  const [obraViewModal, setObraViewModal] = useState<{ open: boolean; obra?: any }>({ open: false });
  const [fonogramaModal, setFonogramaModal] = useState<{ open: boolean; mode: "create" | "edit"; fonograma?: any }>({
    open: false,
    mode: "create",
    fonograma: undefined
  });
  const [fonogramaViewModal, setFonogramaViewModal] = useState<{ open: boolean; fonograma?: any }>({ open: false });
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; item?: any; type?: string }>({ open: false, item: undefined, type: undefined });

  const isLoading = loadingObras || loadingFonogramas;

  // Apply incoming ?projeto=:id (and optional ?obra=:id) coming from the Projetos screen
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    const projetoParam = searchParams.get("projeto");
    const obraParam = searchParams.get("obra");
    const editObraParam = searchParams.get("editObra");
    const fonogramaParam = searchParams.get("fonograma");
    if (!projetoParam && !obraParam && !editObraParam && !fonogramaParam) return;

    // If we still need to resolve an obra/fonograma but data are loading,
    // wait so we don't clear the URL before having a chance to open the modal.
    if ((obraParam || editObraParam) && loadingObras) return;
    if (fonogramaParam && loadingFonogramas) return;

    const next = new URLSearchParams(searchParams);
    let consumed = false;

    if (projetoParam) {
      setActiveTab("obras");
      setProjetoFilter(projetoParam);
      next.delete("projeto");
      consumed = true;
    }

    if (obraParam) {
      const target = obras.find((o: any) => o.id === obraParam);
      if (target) {
        setActiveTab("obras");
        setObraViewModal({ open: true, obra: target });
      }
      // Whether or not the obra was found, drop the param so we don't loop.
      next.delete("obra");
      consumed = true;
    }

    if (editObraParam) {
      const target = obras.find((o: any) => o.id === editObraParam);
      if (target) {
        setActiveTab("obras");
        setObraModal({ open: true, mode: "edit", obra: target });
      }
      next.delete("editObra");
      consumed = true;
    }

    if (fonogramaParam) {
      const target = fonogramas.find((f: any) => f.id === fonogramaParam);
      if (target) {
        setActiveTab("fonogramas");
        setFonogramaModal({ open: true, mode: "edit", fonograma: target });
      }
      next.delete("fonograma");
      consumed = true;
    }

    if (consumed) {
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, obras, fonogramas, loadingObras, loadingFonogramas, setSearchParams]);

  const matchesOrigem = (origem?: string | null) => {
    if (origemFilter === "all-origem") return true;
    if (origemFilter === "abramus") return origem === "abramus";
    if (origemFilter === "manual") return !origem;
    return true;
  };

  // Filter fonogramas
  const filteredFonogramas = fonogramas.filter((fonograma: any) => {
    const matchesSearch = searchTerm === "" || 
      fonograma.titulo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      fonograma.compositores?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all-status" || 
      fonograma.status?.toLowerCase().includes(statusFilter);
    
    return matchesSearch && matchesStatus && matchesOrigem(fonograma.origem_externa);
  });

  // Filter obras
  const filteredObras = obras.filter((obra: any) => {
    const matchesSearch = searchTerm === "" || 
      obra.titulo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      obra.compositores?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      obra.projetos?.titulo?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all-status" || 
      obra.status?.toLowerCase().includes(statusFilter);
    
    const matchesGenre = genreFilter === "all-genre" || 
      obra.genero?.toLowerCase() === genreFilter.toLowerCase();
    const matchesProjeto = projetoFilter === "all-projetos" ||
      (projetoFilter === "no-projeto" ? !obra.projeto_id : obra.projeto_id === projetoFilter);

    return matchesSearch && matchesStatus && matchesGenre && matchesOrigem(obra.origem_externa) && matchesProjeto;
  });

  // Distinct projetos available for the project filter:
  // include every project (even those without obras yet) plus any project ids
  // referenced by existing obras, so deep links from /projetos always work.
  const projetosDisponiveis = useMemo(() => {
    const map = new Map<string, string>();
    allProjetos.forEach((p: any) => {
      if (p?.id && p?.titulo) map.set(p.id, p.titulo);
    });
    obras.forEach((o: any) => {
      if (o.projetos?.id && o.projetos?.titulo && !map.has(o.projetos.id)) {
        map.set(o.projetos.id, o.projetos.titulo);
      }
    });
    return Array.from(map.entries()).map(([id, titulo]) => ({ id, titulo }));
  }, [obras, allProjetos]);

  // Metrics
  const pendentes = activeTab === "fonogramas" 
    ? fonogramas.filter((f: any) => f.status === "pendente").length
    : obras.filter((o: any) => o.status === "pendente").length;
  
  const emAnalise = activeTab === "fonogramas"
    ? fonogramas.filter((f: any) => f.status === "analise").length
    : obras.filter((o: any) => o.status === "analise").length;
  
  const registrados = activeTab === "fonogramas"
    ? fonogramas.filter((f: any) => f.status === "registrado").length
    : obras.filter((o: any) => o.status === "registrado").length;
  
  const total = activeTab === "fonogramas" ? fonogramas.length : obras.length;
  const taxaAprovacao = total > 0 ? Math.round((registrados / total) * 100) : 0;

  const handleExport = () => {
    if (activeTab === "fonogramas") {
      exportToCSV(fonogramas, fonogramaColumns, "fonogramas");
    } else {
      exportToCSV(obras, obraColumns, "obras");
    }
  };

  const handleImport = () => {
    const headers = activeTab === "fonogramas" 
      ? ["Título", "ISRC", "Compositores", "Intérpretes"]
      : ["Título", "Compositores", "Editora", "Gênero"];
    importCSV(async (data) => {
      let importados = 0;
      if (activeTab === "fonogramas") {
        for (const row of data) {
          const titulo = row["Título"] || row["titulo"] || row["TITULO"];
          if (!titulo) continue;
          try {
            await addFonograma.mutateAsync({
              titulo,
              isrc: row["ISRC"] || row["isrc"] || null,
              duracao: row["Duração"] || row["duracao"] || null,
              gravadora: row["Gravadora"] || row["gravadora"] || null,
              status: row["Status"] || row["status"] || "pendente",
              observacoes: row["Observações"] || row["observacoes"] || null,
            } as any);
            importados++;
          } catch {}
        }
      } else {
        for (const row of data) {
          const titulo = row["Título"] || row["titulo"] || row["TITULO"];
          if (!titulo) continue;
          try {
            await addObra.mutateAsync({
              titulo,
              iswc: row["ISWC"] || row["iswc"] || null,
              genero: row["Gênero"] || row["genero"] || null,
              status: row["Status"] || row["status"] || "pendente",
              observacoes: row["Observações"] || row["observacoes"] || null,
            } as any);
            importados++;
          } catch {}
        }
      }
      const tipo = activeTab === "fonogramas" ? "fonograma(s)" : "obra(s)";
      if (importados > 0) toast.success(`${importados} ${tipo} importado(s) com sucesso!`);
      else toast.error(`Nenhum(a) ${tipo} válido(a) encontrado(a) no arquivo`);
    }, headers);
  };

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

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
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
      <Button 
        size="sm" 
        className="gap-2 bg-red-600 hover:bg-red-700 text-white"
        onClick={() => activeTab === "fonogramas" 
          ? setFonogramaModal({ open: true, mode: "create" }) 
          : setObraTipoSelectorOpen(true)
        }
        data-testid="button-nova-obra"
      >
        <Plus className="h-4 w-4" />
        {activeTab === "fonogramas" ? "Novo Fonograma" : "Nova Obra"}
      </Button>
    </>
  );

  return (
    <MainLayout title="Registro de Músicas" description="Registro e controle de obras musicais e fonogramas" actions={headerActions}>
      <div className="space-y-6">

        {/* Metrics */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {activeTab === "fonogramas" ? "Total de Fonogramas" : "Total de Obras"}
                </span>
                {activeTab === "fonogramas" ? (
                  <Disc className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Music className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
              <div className="mt-2">
                <span className="text-2xl font-bold text-foreground">{total}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">registrados no sistema</p>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Pendentes de Registro</span>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="mt-2">
                <span className="text-2xl font-bold text-foreground">{pendentes}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">aguardando análise</p>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Em Análise</span>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="mt-2">
                <span className="text-2xl font-bold text-foreground">{emAnalise}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">aguardando aprovação</p>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Registro Aceito</span>
                <CheckCircle className="h-4 w-4 text-green-500" />
              </div>
              <div className="mt-2">
                <span className="text-2xl font-bold text-foreground">{registrados}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">aprovados</p>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Taxa de Aprovação</span>
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="mt-2">
                <span className="text-2xl font-bold text-foreground">{taxaAprovacao}%</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {activeTab === "fonogramas" ? "fonogramas aprovados" : "obras aprovadas"}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Search and Filters */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder={activeTab === "fonogramas" ? "Buscar por título, compositor, intérprete, ISRC..." : "Buscar por título, compositor, ISWC, gênero..."}
              className="pl-10 bg-card border-border"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px] bg-card border-border">
              <SelectValue placeholder="Todos Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all-status">Todos Status</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="analise">Em Análise</SelectItem>
              <SelectItem value="registrado">Registrado</SelectItem>
            </SelectContent>
          </Select>
          {activeTab === "obras" && (
            <Select value={genreFilter} onValueChange={setGenreFilter}>
              <SelectTrigger className="w-[160px] bg-card border-border">
                <SelectValue placeholder="Todos Gêneros" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all-genre">Todos Gêneros</SelectItem>
                <SelectItem value="funk">Funk</SelectItem>
                <SelectItem value="trap">Trap</SelectItem>
                <SelectItem value="pop">Pop</SelectItem>
              </SelectContent>
            </Select>
          )}
          <Select value={origemFilter} onValueChange={setOrigemFilter}>
            <SelectTrigger className="w-[180px] bg-card border-border" data-testid="select-origem-filter">
              <SelectValue placeholder="Todas Origens" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all-origem">Todas as origens</SelectItem>
              <SelectItem value="abramus">Somente ABRAMUS</SelectItem>
              <SelectItem value="manual">Somente cadastro manual</SelectItem>
            </SelectContent>
          </Select>
          {activeTab === "obras" && projetosDisponiveis.length > 0 && (
            <Select value={projetoFilter} onValueChange={setProjetoFilter}>
              <SelectTrigger className="w-[180px] bg-card border-border" data-testid="select-filter-projeto">
                <SelectValue placeholder="Todos Projetos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all-projetos">Todos Projetos</SelectItem>
                <SelectItem value="no-projeto">Sem projeto vinculado</SelectItem>
                {projetosDisponiveis.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.titulo}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {(searchTerm !== "" || statusFilter !== "all-status" || genreFilter !== "all-genre" || projetoFilter !== "all-projetos" || origemFilter !== "all-origem") && (
            <Button variant="outline" onClick={() => { setSearchTerm(""); setStatusFilter("all-status"); setGenreFilter("all-genre"); setProjetoFilter("all-projetos"); setOrigemFilter("all-origem"); }}>
              Limpar
            </Button>
          )}
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

        {/* Content - Fonogramas */}
        {activeTab === "fonogramas" && (
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Fonogramas Registrados</CardTitle>
              <CardDescription>Catálogo completo de gravações registradas</CardDescription>
            </CardHeader>
            <CardContent>
              {fonogramas.length > 0 && (
                <div className="flex items-center gap-3 mb-4 pb-3 border-b border-border">
                  <button 
                    onClick={() => setSelectAll(!selectAll)}
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                      selectAll ? 'bg-red-500 border-red-500' : 'border-red-500'
                    }`}
                  >
                    {selectAll && <div className="w-2 h-2 bg-white rounded-full" />}
                  </button>
                  <span className="text-sm text-muted-foreground flex-1">Selecionar todos</span>
                </div>
              )}

              <div className="space-y-2">
                {filteredFonogramas.length > 0 ? (
                  <>
                  {filteredFonogramas.map((fonograma: any) => (
                    <div 
                      key={fonograma.id} 
                      className="flex items-center gap-4 py-3 border-b border-border last:border-b-0 hover:bg-muted/30 transition-colors px-2 rounded"
                    >
                      <button 
                        className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors border-red-500"
                      >
                      </button>
                      
                      <div className="w-10 h-10 bg-red-600 rounded-full flex items-center justify-center flex-shrink-0">
                        <Disc className="h-4 w-4 text-white" />
                      </div>
                      
                      <div className="min-w-[160px] max-w-[180px]">
                        <span className="font-medium block truncate" data-testid={`text-fonograma-titulo-${fonograma.id}`}>{fonograma.titulo}</span>
                        <div className="mt-1 flex flex-wrap gap-1 items-center">
                          <Badge 
                            className={`text-xs ${
                              fonograma.status === "registrado" 
                                ? "bg-green-500 hover:bg-green-600 text-white" 
                                : fonograma.status === "analise"
                                ? "bg-yellow-500 hover:bg-yellow-600 text-white"
                                : "bg-red-500 hover:bg-red-600 text-white"
                            }`}
                          >
                            {fonograma.status === "registrado" ? "Registrado" : fonograma.status === "analise" ? "Em Análise" : "Pendente"}
                          </Badge>
                          <AbramusBadge
                            origem={fonograma.origem_externa}
                            sincronizadoEm={fonograma.origem_externa_sincronizado_em}
                            variant="compact"
                          />
                        </div>
                      </div>

                      <div className="hidden md:flex items-center gap-4 text-sm flex-1">
                        <div className="w-24">
                          <span className="text-muted-foreground text-xs block">Cód. ABRAMUS</span>
                          <span className="truncate block">{fonograma.cod_abramus || "-"}</span>
                        </div>
                        <div className="w-24">
                          <span className="text-muted-foreground text-xs block">Cód. ECAD</span>
                          <span className="truncate block">{fonograma.cod_ecad || "-"}</span>
                        </div>
                        <div className="w-28">
                          <span className="text-muted-foreground text-xs block">ISRC</span>
                          <span className="truncate block">{fonograma.isrc || "-"}</span>
                        </div>
                        <div className="w-28">
                          <span className="text-muted-foreground text-xs block">Compositores</span>
                          <span className="truncate block">{fonograma.compositores || "-"}</span>
                        </div>
                        <div className="w-24">
                          <span className="text-muted-foreground text-xs block">Intérpretes</span>
                          <span className="truncate block">{fonograma.interpretes || "-"}</span>
                        </div>
                        <div className="w-24">
                          <span className="text-muted-foreground text-xs block">Produtor</span>
                          <span className="truncate block">{fonograma.produtores || "-"}</span>
                        </div>
                      </div>

                      <div className="flex-shrink-0 flex flex-col items-center">
                        <span className="text-xs text-muted-foreground mb-1">Ações</span>
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
                              onClick={() => setDeleteModal({ open: true, item: fonograma, type: "fonograma" })}
                              className="text-red-600"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  ))}
                  </>
                ) : (
                  <EmptyState
                    icon={Disc}
                    title="Nenhum fonograma cadastrado"
                    description="Comece registrando seu primeiro fonograma"
                    actionLabel="Novo Fonograma"
                    onAction={() => setFonogramaModal({ open: true, mode: "create" })}
                  />
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Content - Obras */}
        {activeTab === "obras" && (
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Obras Registradas</CardTitle>
              <CardDescription>Catálogo completo de obras musicais registradas</CardDescription>
            </CardHeader>
            <CardContent>
              {obras.length > 0 && (
                <div className="flex items-center gap-3 mb-4 pb-3 border-b border-border">
                  <button 
                    onClick={() => setSelectAll(!selectAll)}
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                      selectAll ? 'bg-red-500 border-red-500' : 'border-red-500'
                    }`}
                  >
                    {selectAll && <div className="w-2 h-2 bg-white rounded-full" />}
                  </button>
                  <span className="text-sm text-muted-foreground flex-1">Selecionar todos</span>
                </div>
              )}

              <div className="space-y-2">
                {filteredObras.length > 0 ? (
                  <>
                  {filteredObras.map((obra: any) => (
                    <div 
                      key={obra.id} 
                      className="flex items-center gap-4 py-3 border-b border-border last:border-b-0 hover:bg-muted/30 transition-colors px-2 rounded"
                    >
                      <button 
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors border-red-500`}
                      >
                      </button>
                      
                      <div className="w-10 h-10 bg-red-600 rounded-full flex items-center justify-center flex-shrink-0">
                        <Music className="h-4 w-4 text-white" />
                      </div>
                      
                      <div className="min-w-[160px] max-w-[180px]">
                        <span className="font-medium block truncate" data-testid={`text-obra-titulo-${obra.id}`}>{obra.titulo}</span>
                        <div className="mt-1 flex flex-wrap gap-1 items-center">
                          <Badge 
                            className={`text-xs ${
                              obra.status === "registrado" 
                                ? "bg-green-500 hover:bg-green-600 text-white" 
                                : obra.status === "analise"
                                ? "bg-yellow-500 hover:bg-yellow-600 text-white"
                                : "bg-red-500 hover:bg-red-600 text-white"
                            }`}
                          >
                            {obra.status === "registrado" ? "Registrado" : obra.status === "analise" ? "Em Análise" : "Pendente"}
                          </Badge>
                          <ObraTipoBadge tipo={obra.tipo_obra} />
                          <AbramusBadge
                            origem={obra.origem_externa}
                            sincronizadoEm={obra.origem_externa_sincronizado_em}
                            variant="compact"
                          />
                        </div>
                      </div>

                      <div className="hidden md:flex items-center gap-4 text-sm flex-1">
                        <div className="w-32">
                          <span className="text-muted-foreground text-xs block">Projeto</span>
                          {obra.projetos?.id ? (
                            <Link
                              to={`/projetos?projeto=${obra.projetos.id}`}
                              className="inline-flex items-center gap-1 text-primary hover:underline truncate max-w-full"
                              data-testid={`link-obra-projeto-${obra.id}`}
                            >
                              <FolderKanban className="h-3.5 w-3.5 flex-shrink-0" />
                              <span className="truncate">{obra.projetos.titulo}</span>
                            </Link>
                          ) : (
                            <span className="text-muted-foreground italic" data-testid={`text-obra-projeto-empty-${obra.id}`}>Sem projeto vinculado</span>
                          )}
                        </div>
                        <div className="w-24">
                          <span className="text-muted-foreground text-xs block">Cód. ABRAMUS</span>
                          <span className="truncate block">{obra.cod_abramus || "-"}</span>
                        </div>
                        <div className="w-24">
                          <span className="text-muted-foreground text-xs block">Cód. ECAD</span>
                          <span className="truncate block">{obra.cod_ecad || "-"}</span>
                        </div>
                        <div className="w-28">
                          <span className="text-muted-foreground text-xs block">ISWC</span>
                          <span className="truncate block">{obra.iswc || "-"}</span>
                        </div>
                        <div className="w-28">
                          <span className="text-muted-foreground text-xs block">Compositores</span>
                          <span className="truncate block">{obra.compositores || "-"}</span>
                        </div>
                        <div className="w-24">
                          <span className="text-muted-foreground text-xs block">Editora</span>
                          <span className="truncate block">{obra.editora || "-"}</span>
                        </div>
                        <div className="w-20">
                          <span className="text-muted-foreground text-xs block">Gênero</span>
                          <span className="truncate block">{obra.genero || "-"}</span>
                        </div>
                      </div>

                      <div className="flex-shrink-0 flex flex-col items-center">
                        <span className="text-xs text-muted-foreground mb-1">Ações</span>
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
                              onClick={() => setDeleteModal({ open: true, item: obra, type: "obra" })}
                              className="text-red-600"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  ))}
                  </>
                ) : (
                  <EmptyState
                    icon={Music}
                    title="Nenhuma obra cadastrada"
                    description="Comece registrando sua primeira obra musical"
                    actionLabel="Nova Obra"
                    onAction={() => setObraTipoSelectorOpen(true)}
                  />
                )}
              </div>
            </CardContent>
          </Card>
        )}

      </div>

      {/* Modals */}
      <ObraTipoSelectorModal
        open={obraTipoSelectorOpen}
        onOpenChange={setObraTipoSelectorOpen}
        onSelect={(tipo) =>
          setObraModal({ open: true, mode: "create", obra: undefined, tipoObra: tipo })
        }
      />
      <ObraFormModal 
        open={obraModal.open} 
        onOpenChange={(open) => setObraModal({ ...obraModal, open })} 
        mode={obraModal.mode}
        obra={obraModal.obra}
        tipoObra={obraModal.tipoObra}
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
        fonograma={fonogramaModal.fonograma}
      />
      <FonogramaViewModal 
        open={fonogramaViewModal.open} 
        onOpenChange={(open) => setFonogramaViewModal({ ...fonogramaViewModal, open })} 
        fonograma={fonogramaViewModal.fonograma}
      />
      <DeleteConfirmModal
        open={deleteModal.open}
        onOpenChange={(open) => setDeleteModal({ ...deleteModal, open })}
        onConfirm={handleDelete}
        title={deleteModal.type === "fonograma" ? "Excluir Fonograma" : "Excluir Obra"}
        description={`Tem certeza que deseja excluir ${deleteModal.type === "fonograma" ? "este fonograma" : "esta obra"}? Esta ação não pode ser desfeita.`}
      />
    </MainLayout>
  );
}
