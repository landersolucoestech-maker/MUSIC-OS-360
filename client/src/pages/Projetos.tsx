import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Clock, TrendingUp, FileText, LayoutGrid, Search, Play, FolderKanban, Loader2, Upload, Download, Plus, MoreHorizontal, Eye, Pencil, Trash2, Music2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ProjetoFormModal } from "@/components/forms/ProjetoFormModal";
import { ProjetoViewModal } from "@/components/forms/ProjetoViewModal";
import { DeleteConfirmModal } from "@/components/forms/DeleteConfirmModal";
import { exportToCSV, importCSV, CSVColumn } from "@/lib/csv";
import { EmptyState } from "@/components/shared/EmptyState";
import { useProjetos } from "@/hooks/useProjetos";
import { useArtistas } from "@/hooks/useArtistas";
import type { ProjetoWithRelationsExtended } from "@/types/projetos-extensions";

const projetoColumns: CSVColumn[] = [
  { key: "titulo", label: "Nome" },
  { key: "status", label: "Status" },
  { key: "tipo", label: "Tipo" },
  { key: "produtores", label: "Produtores" },
  { key: "orcamento", label: "Orçamento" },
  { key: "observacoes", label: "Observações" },
];

export default function Projetos() {
  const { projetos: rawProjetos, isLoading, deleteProjeto, addProjeto } = useProjetos();
  const projetos = rawProjetos as ProjetoWithRelationsExtended[];
  const { artistas } = useArtistas();
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

  // Auto-open the view modal when arriving with ?projeto=:id (e.g. from an Obra link)
  useEffect(() => {
    const projetoId = searchParams.get("projeto");
    if (!projetoId || isLoading) return;
    const target = projetos.find(p => p.id === projetoId);
    if (target) {
      setViewModal({ open: true, projeto: target });
      const next = new URLSearchParams(searchParams);
      next.delete("projeto");
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, projetos, isLoading, setSearchParams]);

  const filteredProjects = useMemo(() => {
    return projetos.filter(project => {
      const matchesSearch = searchTerm === "" ||
        project.titulo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        project.artistas?.nome_artistico?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        project.compositor?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        project.interprete?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (Array.isArray(project.produtores) && project.produtores.some(p => p.toLowerCase().includes(searchTerm.toLowerCase())));

      const matchesStatus = statusFilter === "all" || project.status === statusFilter;
      const matchesArtista = artistaFilter === "all" || project.artista_id === artistaFilter;
      const matchesTipo = tipoFilter === "all" || project.tipo?.toLowerCase() === tipoFilter.toLowerCase();
      const matchesGenero = generoFilter === "all" || project.genero?.toLowerCase() === generoFilter.toLowerCase();

      return matchesSearch && matchesStatus && matchesArtista && matchesTipo && matchesGenero;
    });
  }, [projetos, searchTerm, statusFilter, artistaFilter, tipoFilter, generoFilter]);

  const generos = useMemo(() => {
    const set = new Set<string>();
    projetos.forEach(p => { if (p.genero) set.add(p.genero); });
    return Array.from(set);
  }, [projetos]);

  const handleExport = () => exportToCSV(projetos, projetoColumns, "projetos");
  const handleImport = () => importCSV(async (data) => {
    let importados = 0;
    for (const row of data) {
      const titulo = row["Nome"] || row["titulo"] || row["Título"] || row["TITULO"];
      if (!titulo) continue;
      try {
        await addProjeto.mutateAsync({
          titulo,
          tipo: row["Tipo"] || row["tipo"] || "single",
          status: row["Status"] || row["status"] || "planejamento",
          orcamento: row["Orçamento"] || row["orcamento"] ? Number(row["Orçamento"] || row["orcamento"]) : null,
          observacoes: row["Observações"] || row["observacoes"] || null,
        } as any);
        importados++;
      } catch {}
    }
    if (importados > 0) toast.success(`${importados} projeto(s) importado(s) com sucesso!`);
    else toast.error("Nenhum projeto válido encontrado no arquivo");
  }, ["Nome", "Compositores", "Intérpretes", "Gênero"]);

  const handleDelete = () => {
    if (deleteModal.projeto) {
      deleteProjeto.mutate(deleteModal.projeto.id);
      setDeleteModal({ open: false });
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredProjects.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredProjects.map(p => p.id));
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "em_andamento":
        return <Badge className="bg-yellow-500 hover:bg-yellow-600 text-white text-xs">Em Andamento</Badge>;
      case "concluido":
        return <Badge className="bg-green-500 hover:bg-green-600 text-white text-xs">Concluído</Badge>;
      case "planejamento":
        return <Badge className="bg-red-500 hover:bg-red-600 text-white text-xs">Registro Pendente</Badge>;
      case "cancelado":
        return <Badge className="bg-gray-500 hover:bg-gray-600 text-white text-xs">Cancelado</Badge>;
      default:
        return <Badge className="bg-red-500 hover:bg-red-600 text-white text-xs">Registro Pendente</Badge>;
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
      <Button variant="outline" size="sm" className="gap-2" onClick={handleImport}><Upload className="h-4 w-4" />Importar</Button>
      <Button variant="outline" size="sm" className="gap-2" onClick={handleExport}><Download className="h-4 w-4" />Exportar</Button>
      <Button size="sm" className="gap-2 bg-red-600 hover:bg-red-700 text-white" onClick={() => setFormModal({ open: true, mode: "create" })}><Plus className="h-4 w-4" />Novo Projeto</Button>
    </>
  );

  const metricas = {
    ativos: projetos.filter(p => p.status === "em_andamento").length,
    concluidos: projetos.filter(p => p.status === "concluido").length,
    rascunhos: projetos.filter(p => p.status === "planejamento").length,
    total: projetos.length
  };

  return (
    <MainLayout title="Projetos" description="Gestão completa de projetos musicais" actions={headerActions}>
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Projetos Ativos</span>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="mt-2">
                <span className="text-2xl font-bold">{metricas.ativos}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">em desenvolvimento</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Concluídos</span>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="mt-2">
                <span className="text-2xl font-bold">{metricas.concluidos}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">projetos finalizados</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Rascunhos</span>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="mt-2">
                <span className="text-2xl font-bold">{metricas.rascunhos}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">em planejamento</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total de Projetos</span>
                <LayoutGrid className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="mt-2">
                <span className="text-2xl font-bold">{metricas.total}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">cadastrados no sistema</p>
            </CardContent>
          </Card>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[300px]">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar por música, artista, compositor, intérprete, produtor, gênero..." 
              className="pl-10 bg-card border-border"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px] bg-card border-border">
              <SelectValue placeholder="Todos Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Status</SelectItem>
              <SelectItem value="em_andamento">Em Andamento</SelectItem>
              <SelectItem value="concluido">Concluído</SelectItem>
              <SelectItem value="planejamento">Planejamento</SelectItem>
              <SelectItem value="cancelado">Cancelado</SelectItem>
            </SelectContent>
          </Select>
          <Select value={artistaFilter} onValueChange={setArtistaFilter}>
            <SelectTrigger className="w-[140px] bg-card border-border">
              <SelectValue placeholder="Todos Artista" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Artista</SelectItem>
              {artistas.map(a => (
                <SelectItem key={a.id} value={a.id}>{a.nome_artistico}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={tipoFilter} onValueChange={setTipoFilter}>
            <SelectTrigger className="w-[140px] bg-card border-border">
              <SelectValue placeholder="Todos Tipo de..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Tipo de...</SelectItem>
              <SelectItem value="single">Single</SelectItem>
              <SelectItem value="álbum">Álbum</SelectItem>
              <SelectItem value="ep">EP</SelectItem>
              <SelectItem value="turne">Turnê</SelectItem>
            </SelectContent>
          </Select>
          <Select value={generoFilter} onValueChange={setGeneroFilter}>
            <SelectTrigger className="w-[140px] bg-card border-border">
              <SelectValue placeholder="Todos Gênero" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Gênero</SelectItem>
              {generos.map(g => (
                <SelectItem key={g} value={g.toLowerCase()}>{g}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Lista de Projetos</CardTitle>
            <CardDescription>Acompanhe o desenvolvimento de todos os projetos musicais</CardDescription>
          </CardHeader>
          <CardContent>
            {projetos.length > 0 && (
              <div className="flex items-center gap-3 mb-4 pb-3 border-b border-border">
                <button 
                  onClick={toggleSelectAll}
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                    selectedIds.length === filteredProjects.length && filteredProjects.length > 0
                      ? 'bg-red-500 border-red-500' 
                      : 'border-red-500'
                  }`}
                >
                  {selectedIds.length === filteredProjects.length && filteredProjects.length > 0 && (
                    <div className="w-2 h-2 bg-white rounded-full" />
                  )}
                </button>
                <span className="text-sm text-muted-foreground flex-1">Selecionar todos</span>
              </div>
            )}

            <div className="space-y-2">
              {filteredProjects.length > 0 ? (
                <>
                {filteredProjects.map((project) => (
                  <div 
                    key={project.id} 
                    className="flex items-center gap-4 py-3 border-b border-border last:border-b-0 hover:bg-muted/30 transition-colors px-2 rounded"
                  >
                    <button 
                      onClick={() => toggleSelect(project.id)}
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                        selectedIds.includes(project.id)
                          ? 'bg-red-500 border-red-500' 
                          : 'border-red-500'
                      }`}
                    >
                      {selectedIds.includes(project.id) && (
                        <div className="w-2 h-2 bg-white rounded-full" />
                      )}
                    </button>
                    
                    <div className="w-10 h-10 bg-red-600 rounded-full flex items-center justify-center flex-shrink-0">
                      <Play className="h-4 w-4 text-white ml-0.5" />
                    </div>
                    
                    <div className="min-w-[180px] max-w-[200px]">
                      <span className="font-medium block truncate">{project.titulo}</span>
                      <div className="mt-1">{getStatusBadge(project.status)}</div>
                    </div>

                    <div className="hidden md:flex items-center gap-6 text-sm flex-1">
                      <div className="w-32">
                        <span className="text-muted-foreground text-xs block">Compositores</span>
                        <span className="truncate block">{project.compositor || "-"}</span>
                      </div>
                      <div className="w-32">
                        <span className="text-muted-foreground text-xs block">Intérpretes</span>
                        <span className="truncate block">{project.interprete || "-"}</span>
                      </div>
                      <div className="w-32">
                        <span className="text-muted-foreground text-xs block">Produtor</span>
                        <span className="truncate block">{Array.isArray(project.produtores) ? project.produtores.join(", ") : "-"}</span>
                      </div>
                      <div className="w-24">
                        <span className="text-muted-foreground text-xs block">Gênero</span>
                        <span className="truncate block">{project.genero || "-"}</span>
                      </div>
                      <div className="w-20">
                        <span className="text-muted-foreground text-xs block">Obras</span>
                        <Badge
                          variant="secondary"
                          className="gap-1 mt-0.5"
                          data-testid={`badge-obras-count-${project.id}`}
                        >
                          <Music2 className="h-3 w-3" />
                          {project.obras?.length ?? 0}
                        </Badge>
                      </div>
                    </div>

                    <div className="flex-shrink-0 flex flex-col items-center">
                      <span className="text-xs text-muted-foreground mb-1">Ações</span>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" data-testid={`button-actions-${project.id}`}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setViewModal({ open: true, projeto: project })} data-testid={`button-view-${project.id}`}>
                            <Eye className="h-4 w-4 mr-2" />
                            Ver
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setFormModal({ open: true, mode: "edit", projeto: project })} data-testid={`button-edit-${project.id}`}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setDeleteModal({ open: true, projeto: project })} className="text-red-600" data-testid={`button-delete-${project.id}`}>
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
                  icon={FolderKanban}
                  title="Nenhum projeto cadastrado"
                  description="Comece criando seu primeiro projeto musical"
                  actionLabel="Novo Projeto"
                  onAction={() => setFormModal({ open: true, mode: "create" })}
                />
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <ProjetoFormModal open={formModal.open} onOpenChange={(open) => setFormModal({ ...formModal, open })} projeto={formModal.projeto} mode={formModal.mode} />
      <ProjetoViewModal open={viewModal.open} onOpenChange={(open) => setViewModal({ ...viewModal, open })} projeto={viewModal.projeto} />
      <DeleteConfirmModal open={deleteModal.open} onOpenChange={(open) => setDeleteModal({ ...deleteModal, open })} title="Excluir Projeto" description={`Tem certeza que deseja excluir o projeto "${deleteModal.projeto?.titulo}"?`} onConfirm={handleDelete} />
    </MainLayout>
  );
}
