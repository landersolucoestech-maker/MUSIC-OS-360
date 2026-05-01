import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Clock, FileText, CheckCircle, Target, Search, Check, Loader2, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { TarefaMarketingFormModal } from "@/components/forms/TarefaMarketingFormModal";
import { DeleteConfirmModal } from "@/components/forms/DeleteConfirmModal";
import { EmptyState } from "@/components/shared/EmptyState";
import { useTarefasMarketing } from "@/hooks";

const getStatusColor = (status: string) => {
  switch (status) {
    case "concluida": return "bg-green-600 text-white";
    case "em_andamento": return "bg-blue-600 text-white";
    case "pendente": return "bg-amber-500 text-white";
    case "atrasada": return "bg-red-600 text-white";
    default: return "bg-muted text-muted-foreground";
  }
};

const getPrioridadeColor = (prioridade: string) => {
  switch (prioridade) {
    case "alta": return "border-red-500 text-red-500";
    case "media": return "border-amber-500 text-amber-500";
    case "baixa": return "border-green-500 text-green-500";
    default: return "border-muted-foreground text-muted-foreground";
  }
};

export default function MarketingTarefas() {
  const { tarefas, isLoading, deleteTarefa } = useTarefasMarketing();
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [selectedTarefa, setSelectedTarefa] = useState<any>(null);
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; tarefa?: any }>({ open: false });
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [prioridadeFilter, setPrioridadeFilter] = useState("all-pri");
  const [categoriaFilter, setCategoriaFilter] = useState("all-cat");

  const handleNovaTarefa = () => {
    setSelectedTarefa(null);
    setModalMode("create");
    setModalOpen(true);
  };

  const handleEdit = (tarefa: any) => {
    setSelectedTarefa(tarefa);
    setModalMode("edit");
    setModalOpen(true);
  };

  const handleDelete = () => {
    if (deleteModal.tarefa) {
      deleteTarefa.mutate(deleteModal.tarefa.id);
      setDeleteModal({ open: false });
    }
  };

  // Filter tarefas
  const filteredTarefas = tarefas.filter((t: any) => {
    const matchesSearch = searchTerm === "" || 
      t.titulo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.descricao?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || t.status === statusFilter;
    const matchesPrioridade = prioridadeFilter === "all-pri" || t.prioridade === prioridadeFilter;
    const matchesCategoria = categoriaFilter === "all-cat" || t.categoria === categoriaFilter;
    return matchesSearch && matchesStatus && matchesPrioridade && matchesCategoria;
  });

  // Metrics
  const pendentes = tarefas.filter((t: any) => t.status === "pendente").length;
  const emAndamento = tarefas.filter((t: any) => t.status === "em_andamento").length;
  const concluidas = tarefas.filter((t: any) => t.status === "concluida").length;
  const taxaConclusao = tarefas.length > 0 ? Math.round((concluidas / tarefas.length) * 100) : 0;

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
    <Button className="bg-red-600 hover:bg-red-700" onClick={handleNovaTarefa}>+ Nova Tarefa</Button>
  );

  return (
    <MainLayout title="Gestão de Tarefas" description="Organize e acompanhe todas as tarefas de marketing" actions={headerActions}>
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="bg-card">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Tarefas Pendentes</span>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="mt-2">
                <span className="text-2xl font-bold text-amber-500">{pendentes}</span>
                <p className="text-xs text-muted-foreground mt-1">aguardando execução</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Em Andamento</span>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="mt-2">
                <span className="text-2xl font-bold text-blue-500">{emAndamento}</span>
                <p className="text-xs text-muted-foreground mt-1">sendo executadas</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Concluídas</span>
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="mt-2">
                <span className="text-2xl font-bold text-green-500">{concluidas}</span>
                <p className="text-xs text-muted-foreground mt-1">este mês</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Taxa de Conclusão</span>
                <Target className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="mt-2">
                <span className="text-2xl font-bold">{taxaConclusao}%</span>
                <p className="text-xs text-muted-foreground mt-1">no prazo</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar tarefas por título, descrição ou campanha..." 
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Todos Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Status</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="em_andamento">Em Andamento</SelectItem>
              <SelectItem value="concluida">Concluída</SelectItem>
            </SelectContent>
          </Select>
          <Select value={prioridadeFilter} onValueChange={setPrioridadeFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Todos Prioridade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all-pri">Todos Prioridade</SelectItem>
              <SelectItem value="alta">Alta</SelectItem>
              <SelectItem value="media">Média</SelectItem>
              <SelectItem value="baixa">Baixa</SelectItem>
            </SelectContent>
          </Select>
          <Select value={categoriaFilter} onValueChange={setCategoriaFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Todos Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all-cat">Todos Categoria</SelectItem>
              <SelectItem value="design">Design</SelectItem>
              <SelectItem value="video">Vídeo</SelectItem>
              <SelectItem value="conteudo">Conteúdo</SelectItem>
            </SelectContent>
          </Select>
          {(searchTerm !== "" || statusFilter !== "all" || prioridadeFilter !== "all-pri" || categoriaFilter !== "all-cat") && (
            <Button variant="outline" onClick={() => { setSearchTerm(""); setStatusFilter("all"); setPrioridadeFilter("all-pri"); setCategoriaFilter("all-cat"); }}>
              Limpar
            </Button>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Lista de Tarefas</CardTitle>
            <CardDescription>Gerencie todas as tarefas de marketing e seus prazos</CardDescription>
          </CardHeader>
          <CardContent>
            {filteredTarefas.length > 0 ? (
              <div className="space-y-3">
                <div className="hidden md:flex items-center gap-4 px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  <div className="w-10" />
                  <div className="flex-1 min-w-0">Tarefa</div>
                  <div className="w-9 text-center">Ações</div>
                </div>
                {filteredTarefas.map((tarefa: any) => (
                  <div key={tarefa.id} className="flex items-center gap-4 p-4 bg-muted/30 rounded-lg border border-border hover:bg-muted/50 transition-colors">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${tarefa.status === 'concluida' ? 'bg-green-600' : 'bg-red-600'}`}>
                      {tarefa.status === 'concluida' ? <Check className="h-5 w-5 text-white" /> : <Clock className="h-5 w-5 text-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-foreground">{tarefa.titulo}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">{tarefa.categoria || "Geral"}</Badge>
                        <Badge variant="outline" className={`text-xs ${getPrioridadeColor(tarefa.prioridade)}`}>{tarefa.prioridade || "Normal"}</Badge>
                        <Badge className={`text-xs ${getStatusColor(tarefa.status)}`}>{tarefa.status}</Badge>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(tarefa)}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setDeleteModal({ open: true, tarefa })} className="text-red-600">
                          <Trash2 className="h-4 w-4 mr-2" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={FileText}
                title="Nenhuma tarefa cadastrada"
                description="Comece criando sua primeira tarefa de marketing"
                actionLabel="Nova Tarefa"
                onAction={handleNovaTarefa}
              />
            )}
          </CardContent>
        </Card>
      </div>

      <TarefaMarketingFormModal open={modalOpen} onOpenChange={setModalOpen} initialData={selectedTarefa} mode={modalMode} />
      <DeleteConfirmModal 
        open={deleteModal.open} 
        onOpenChange={(open) => setDeleteModal({ ...deleteModal, open })} 
        title="Excluir Tarefa" 
        description={`Tem certeza que deseja excluir a tarefa "${deleteModal.tarefa?.titulo}"?`} 
        onConfirm={handleDelete} 
      />
    </MainLayout>
  );
}
