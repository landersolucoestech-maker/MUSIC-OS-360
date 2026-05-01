import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Clock, CheckCircle, FileEdit, Search, AlertTriangle, Loader2, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { BriefingFormModal } from "@/components/forms/BriefingFormModal";
import { DeleteConfirmModal } from "@/components/forms/DeleteConfirmModal";
import { EmptyState } from "@/components/shared/EmptyState";
import { useBriefings } from "@/hooks";

const getStatusColor = (status: string) => {
  switch (status) {
    case "ativo": return "bg-green-600 text-white";
    case "pendente": return "bg-amber-500 text-white";
    case "aprovado": return "bg-blue-600 text-white";
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

export default function MarketingBriefing() {
  const { briefings, isLoading, deleteBriefing } = useBriefings();
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [selectedBriefing, setSelectedBriefing] = useState<any>(null);
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; briefing?: any }>({ open: false });
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [prioridadeFilter, setPrioridadeFilter] = useState("all");

  const handleNovoBriefing = () => {
    setSelectedBriefing(null);
    setModalMode("create");
    setModalOpen(true);
  };

  const handleEdit = (briefing: any) => {
    setSelectedBriefing(briefing);
    setModalMode("edit");
    setModalOpen(true);
  };

  const handleDelete = () => {
    if (deleteModal.briefing) {
      deleteBriefing.mutate(deleteModal.briefing.id);
      setDeleteModal({ open: false });
    }
  };

  // Filter briefings
  const filteredBriefings = briefings.filter((b: any) => {
    const matchesSearch = searchTerm === "" || 
      b.titulo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.descricao?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || b.status === statusFilter;
    const matchesPrioridade = prioridadeFilter === "all" || b.prioridade === prioridadeFilter;
    return matchesSearch && matchesStatus && matchesPrioridade;
  });

  // Metrics
  const briefingsAtivos = briefings.filter((b: any) => b.status === "ativo").length;
  const pendentesAprovacao = briefings.filter((b: any) => b.status === "pendente").length;
  const aprovados = briefings.filter((b: any) => b.status === "aprovado").length;

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
    <Button className="bg-red-600 hover:bg-red-700" onClick={handleNovoBriefing}>
      + Novo Briefing
    </Button>
  );

  return (
    <MainLayout title="Central de Briefing" description="Gerencie briefings e diretrizes para campanhas de marketing" actions={headerActions}>
      <div className="space-y-6">
        {/* Metrics Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="bg-card">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Briefings Ativos</span>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="mt-2">
                <span className="text-2xl font-bold">{briefingsAtivos}</span>
                <p className="text-xs text-muted-foreground mt-1">em desenvolvimento</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Pendentes Aprovação</span>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="mt-2">
                <span className="text-2xl font-bold">{pendentesAprovacao}</span>
                <p className="text-xs text-muted-foreground mt-1">aguardando review</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Aprovados este mês</span>
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="mt-2">
                <span className="text-2xl font-bold">{aprovados}</span>
                <p className="text-xs text-muted-foreground mt-1">prontos para execução</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total de Briefings</span>
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="mt-2">
                <span className="text-2xl font-bold">{briefings.length}</span>
                <p className="text-xs text-muted-foreground mt-1">no sistema</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search and Filters */}
        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar briefings por título, campanha ou descrição..." 
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
              <SelectItem value="ativo">Ativo</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="aprovado">Aprovado</SelectItem>
            </SelectContent>
          </Select>
          <Select value={prioridadeFilter} onValueChange={setPrioridadeFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Todos Prioridade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Prioridade</SelectItem>
              <SelectItem value="alta">Alta</SelectItem>
              <SelectItem value="media">Média</SelectItem>
              <SelectItem value="baixa">Baixa</SelectItem>
            </SelectContent>
          </Select>
          {(searchTerm !== "" || statusFilter !== "all" || prioridadeFilter !== "all") && (
            <Button variant="outline" onClick={() => { setSearchTerm(""); setStatusFilter("all"); setPrioridadeFilter("all"); }}>
              Limpar
            </Button>
          )}
        </div>

        {/* Content Section */}
        <Card>
          <CardHeader>
            <CardTitle>Briefings de Marketing</CardTitle>
            <CardDescription>Todos os briefings e diretrizes de campanhas</CardDescription>
          </CardHeader>
          <CardContent>
            {filteredBriefings.length > 0 ? (
              <div className="space-y-3">
                <div className="hidden md:flex items-center gap-4 px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  <div className="w-10" />
                  <div className="flex-1 min-w-0">Briefing</div>
                  <div className="w-9 text-center">Ações</div>
                </div>
                {filteredBriefings.map((briefing: any) => (
                  <div key={briefing.id} className="flex items-center gap-4 p-4 bg-muted/30 rounded-lg border border-border hover:bg-muted/50 transition-colors">
                    <div className="w-10 h-10 bg-red-600 rounded-lg flex items-center justify-center">
                      <FileEdit className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-foreground">{briefing.titulo}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className={`text-xs ${getPrioridadeColor(briefing.prioridade)}`}>
                          {briefing.prioridade || "Normal"}
                        </Badge>
                        <Badge className={`text-xs ${getStatusColor(briefing.status)}`}>{briefing.status}</Badge>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(briefing)}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setDeleteModal({ open: true, briefing })} className="text-red-600">
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
                icon={FileEdit}
                title="Nenhum briefing cadastrado"
                description="Comece a criar briefings para suas campanhas"
                actionLabel="Novo Briefing"
                onAction={handleNovoBriefing}
              />
            )}
          </CardContent>
        </Card>
      </div>

      <BriefingFormModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        initialData={selectedBriefing}
        mode={modalMode}
      />

      <DeleteConfirmModal
        open={deleteModal.open}
        onOpenChange={(open) => setDeleteModal({ ...deleteModal, open })}
        title="Excluir Briefing"
        description={`Tem certeza que deseja excluir o briefing "${deleteModal.briefing?.titulo}"?`}
        onConfirm={handleDelete}
      />
    </MainLayout>
  );
}
