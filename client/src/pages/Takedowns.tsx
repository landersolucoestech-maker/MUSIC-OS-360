import { useState, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, Clock, CheckCircle, Upload, Download, Plus, Search, FileText, ExternalLink, Loader2, MoreHorizontal, Eye, Pencil, Trash2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { TakedownFormModal } from "@/components/forms/TakedownFormModal";
import { TakedownViewModal } from "@/components/forms/TakedownViewModal";
import { DeleteConfirmModal } from "@/components/forms/DeleteConfirmModal";
import { EmptyState } from "@/components/shared/EmptyState";
import { useTakedowns } from "@/hooks/useTakedowns";
import { formatDate } from "@/lib/utils-format";

const getStatusBadge = (status: string) => {
  switch (status) {
    case "resolvido": return <Badge className="bg-green-600">Resolvido</Badge>;
    case "pendente": return <Badge className="bg-amber-500">Pendente</Badge>;
    case "analise": return <Badge className="bg-blue-500">Em Análise</Badge>;
    case "rejeitado": return <Badge className="bg-red-600">Rejeitado</Badge>;
    default: return <Badge variant="secondary">{status}</Badge>;
  }
};

const getTipoBadge = (tipo: string) => {
  return tipo === "enviado" 
    ? <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/30">Enviado</Badge>
    : <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/30">Recebido</Badge>;
};

export default function Takedowns() {
  const { takedowns, isLoading, deleteTakedown } = useTakedowns();
  const [activeTab, setActiveTab] = useState("todos");
  const [takedownModal, setTakedownModal] = useState<{ open: boolean; mode: "create" | "edit"; takedown?: any }>({ open: false, mode: "create" });
  const [viewModal, setViewModal] = useState<{ open: boolean; takedown?: any }>({ open: false });
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; takedown?: any }>({ open: false });

  // Filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [platformFilter, setPlatformFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const metricas = useMemo(() => ({
    total: takedowns.length,
    pendentes: takedowns.filter(t => t.status === "pendente" || t.status === "analise").length,
    resolvidos: takedowns.filter(t => t.status === "resolvido").length,
    emAndamento: takedowns.filter(t => t.status === "em_andamento").length,
  }), [takedowns]);

  // Filtered takedowns
  const filteredTakedowns = useMemo(() => takedowns.filter(takedown => {
    const matchesTab = activeTab === "todos" ||
      (activeTab === "pendentes" && takedown.status === "pendente") ||
      (activeTab === "resolvidos" && takedown.status === "resolvido");

    const matchesSearch = searchTerm === "" ||
      takedown.plataforma?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      takedown.url_infracao?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      takedown.observacoes?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesPlatform = platformFilter === "all" ||
      takedown.plataforma?.toLowerCase() === platformFilter.toLowerCase();

    const matchesStatus = statusFilter === "all" || takedown.status === statusFilter;

    return matchesTab && matchesSearch && matchesPlatform && matchesStatus;
  }), [takedowns, activeTab, searchTerm, platformFilter, statusFilter]);

  const hasActiveFilters = searchTerm !== "" || platformFilter !== "all" || statusFilter !== "all";

  const clearFilters = () => {
    setSearchTerm("");
    setPlatformFilter("all");
    setStatusFilter("all");
  };

  const handleDelete = () => {
    if (deleteModal.takedown) {
      deleteTakedown.mutate(deleteModal.takedown.id);
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
    <Button size="sm" className="gap-2 bg-primary hover:bg-primary/90" onClick={() => setTakedownModal({ open: true, mode: "create" })}>
      <Plus className="h-4 w-4" />Novo Takedown
    </Button>
  );

  return (
    <MainLayout title="Takedowns" description="Gerencie solicitações de remoção e claims" actions={headerActions}>
      <div className="space-y-6">

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card><CardContent className="p-4"><div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Total</span><AlertTriangle className="h-5 w-5 text-primary" /></div><div className="mt-2"><span className="text-2xl font-bold">{metricas.total}</span></div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Pendentes</span><Clock className="h-5 w-5 text-amber-500" /></div><div className="mt-2"><span className="text-2xl font-bold text-amber-500">{metricas.pendentes}</span></div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Em Andamento</span><Upload className="h-5 w-5 text-blue-500" /></div><div className="mt-2"><span className="text-2xl font-bold text-blue-500">{metricas.emAndamento}</span></div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Resolvidos</span><CheckCircle className="h-5 w-5 text-green-500" /></div><div className="mt-2"><span className="text-2xl font-bold text-green-500">{metricas.resolvidos}</span></div></CardContent></Card>
        </div>

        <div className="flex items-center gap-2">
          <Button variant={activeTab === "todos" ? "default" : "outline"} size="sm" onClick={() => setActiveTab("todos")} className={activeTab === "todos" ? "bg-muted text-foreground hover:bg-muted" : ""}>Todos</Button>
          <Button variant={activeTab === "pendentes" ? "default" : "outline"} size="sm" onClick={() => setActiveTab("pendentes")} className={activeTab === "pendentes" ? "bg-muted text-foreground hover:bg-muted" : ""}>Pendentes</Button>
          <Button variant={activeTab === "resolvidos" ? "default" : "outline"} size="sm" onClick={() => setActiveTab("resolvidos")} className={activeTab === "resolvidos" ? "bg-muted text-foreground hover:bg-muted" : ""}>Resolvidos</Button>
        </div>

        <Card>
          <CardContent className="p-6 space-y-4">
            <h2 className="text-lg font-semibold">Takedowns</h2>

            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Buscar por título, motivo, plataforma..." 
                  className="pl-10 bg-background"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Select value={platformFilter} onValueChange={setPlatformFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Plataforma" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="youtube">YouTube</SelectItem>
                  <SelectItem value="tiktok">TikTok</SelectItem>
                  <SelectItem value="spotify">Spotify</SelectItem>
                  <SelectItem value="apple podcasts">Apple Podcasts</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="analise">Em Análise</SelectItem>
                  <SelectItem value="resolvido">Resolvido</SelectItem>
                  <SelectItem value="rejeitado">Rejeitado</SelectItem>
                </SelectContent>
              </Select>
              {hasActiveFilters && (
                <Button variant="outline" size="sm" onClick={clearFilters}>
                  Limpar
                </Button>
              )}
            </div>

            {filteredTakedowns.length === 0 ? (
              <EmptyState
                icon={AlertTriangle}
                title="Nenhum takedown encontrado"
                description="Adicione um novo takedown para gerenciar solicitações de remoção e claims."
                action={{ label: "Novo Takedown", onClick: () => setTakedownModal({ open: true, mode: "create" }) }}
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Título</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Plataforma</TableHead>
                    <TableHead>Motivo</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                    {filteredTakedowns.map((takedown: any) => (
                    <TableRow key={takedown.id}>
                      <TableCell className="font-medium">{takedown.titulo}</TableCell>
                      <TableCell>{getTipoBadge(takedown.tipo)}</TableCell>
                      <TableCell><Badge variant="outline">{takedown.plataforma}</Badge></TableCell>
                      <TableCell>{takedown.motivo}</TableCell>
                      <TableCell>{formatDate(takedown.data)}</TableCell>
                      <TableCell>{getStatusBadge(takedown.status)}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setViewModal({ open: true, takedown })}>
                              <Eye className="h-4 w-4 mr-2" />
                              Ver
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setTakedownModal({ open: true, mode: "edit", takedown })}>
                              <Pencil className="h-4 w-4 mr-2" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setDeleteModal({ open: true, takedown })} className="text-red-600">
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
            )}
          </CardContent>
        </Card>
      </div>

      <TakedownFormModal open={takedownModal.open} onOpenChange={(open) => setTakedownModal({ ...takedownModal, open })} takedown={takedownModal.takedown} mode={takedownModal.mode} />
      <TakedownViewModal open={viewModal.open} onOpenChange={(open) => setViewModal({ ...viewModal, open })} takedown={viewModal.takedown} />
      <DeleteConfirmModal open={deleteModal.open} onOpenChange={(open) => setDeleteModal({ ...deleteModal, open })} title="Excluir Takedown" description={`Tem certeza que deseja excluir "${deleteModal.takedown?.titulo}"?`} onConfirm={handleDelete} />
    </MainLayout>
  );
}