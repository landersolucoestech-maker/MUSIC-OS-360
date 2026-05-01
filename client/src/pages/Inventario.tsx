import { useState, useMemo } from "react";
import { toast } from "sonner";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Package, Wrench, CheckCircle, Upload, Download, Plus, Search, Monitor, Loader2, MoreHorizontal, Eye, Pencil, Trash2, MapPin, User } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils-format";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { InventarioFormModal } from "@/components/forms/InventarioFormModal";
import { InventarioViewModal } from "@/components/forms/InventarioViewModal";
import { DeleteConfirmModal } from "@/components/forms/DeleteConfirmModal";
import { exportToCSV, importCSV, CSVColumn } from "@/lib/csv";
import { EmptyState } from "@/components/shared/EmptyState";
import { useInventario } from "@/hooks/useInventario";
import { StatusBadge } from "@/components/shared/StatusBadge";

const inventarioColumns: CSVColumn[] = [
  { key: "nome", label: "Nome" },
  { key: "categoria", label: "Categoria" },
  { key: "quantidade", label: "Quantidade" },
  { key: "localizacao", label: "Localização" },
  { key: "status", label: "Status" },
  { key: "valor_unitario", label: "Valor Unitário" },
  { key: "observacoes", label: "Observações" },
];

export default function Inventario() {
  const { inventario, isLoading, deleteInventario, addInventario } = useInventario();
  const [selectAll, setSelectAll] = useState(false);
  const [formModal, setFormModal] = useState<{ open: boolean; mode: "create" | "edit"; item?: any }>({ open: false, mode: "create" });
  const [viewModal, setViewModal] = useState<{ open: boolean; item?: any }>({ open: false });
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; item?: any }>({ open: false });
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all-category");
  const [statusFilter, setStatusFilter] = useState("all-status");
  const [localFilter, setLocalFilter] = useState("all-local");

  const handleExport = () => exportToCSV(inventario, inventarioColumns, "inventario");
  const handleImport = () => importCSV(async (data) => {
    let importados = 0;
    for (const row of data) {
      const nome = row["Nome"] || row["nome"] || row["NOME"];
      if (!nome) continue;
      try {
        await addInventario.mutateAsync({
          nome,
          categoria: row["Categoria"] || row["categoria"] || null,
          quantidade: row["Quantidade"] || row["quantidade"] ? Number(row["Quantidade"] || row["quantidade"]) : null,
          localizacao: row["Localização"] || row["localizacao"] || row["Local"] || null,
          status: row["Status"] || row["status"] || "disponivel",
          valor_unitario: row["Valor Unitário"] || row["valor_unitario"] ? Number(row["Valor Unitário"] || row["valor_unitario"]) : null,
          observacoes: row["Observações"] || row["observacoes"] || null,
        } as any);
        importados++;
      } catch {}
    }
    if (importados > 0) toast.success(`${importados} item(ns) importado(s) com sucesso!`);
    else toast.error("Nenhum item válido encontrado no arquivo");
  }, ["Nome", "Categoria", "Quantidade", "Local"]);

  const filteredEquipamentos = useMemo(() => inventario.filter((item) => {
    const matchesSearch = item.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.categoria?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.localizacao?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === "all-category" || item.categoria?.toLowerCase() === categoryFilter.toLowerCase();
    const matchesStatus = statusFilter === "all-status" || 
      (statusFilter === "em-uso" && item.status === "em_uso") ||
      (statusFilter === "disponivel" && item.status === "disponivel") ||
      (statusFilter === "manutencao" && item.status === "manutencao");
    const matchesLocal = localFilter === "all-local" || 
      (localFilter === "estudio1" && item.localizacao === "Estúdio 1") ||
      (localFilter === "estudio2" && item.localizacao === "Estúdio 2") ||
      (localFilter === "escritorio" && item.localizacao === "Escritório") ||
      (localFilter === "estoque" && item.localizacao === "Estoque");
    return matchesSearch && matchesCategory && matchesStatus && matchesLocal;
  }), [inventario, searchTerm, categoryFilter, statusFilter, localFilter]);

  const hasActiveFilters = searchTerm !== "" || categoryFilter !== "all-category" || statusFilter !== "all-status" || localFilter !== "all-local";

  const handleClearFilters = () => {
    setSearchTerm("");
    setCategoryFilter("all-category");
    setStatusFilter("all-status");
    setLocalFilter("all-local");
  };

  const handleDelete = () => {
    if (deleteModal.item) {
      deleteInventario.mutate(deleteModal.item.id);
      setDeleteModal({ open: false });
    }
  };

  const metricas = useMemo(() => ({
    total: inventario.length,
    emUso: inventario.filter(e => e.status === "em_uso").length,
    disponiveis: inventario.filter(e => e.status === "disponivel").length,
    emManutencao: inventario.filter(e => e.status === "manutencao").length,
  }), [inventario]);

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
      <Button size="sm" className="gap-2 bg-red-600 hover:bg-red-700 text-white" onClick={() => setFormModal({ open: true, mode: "create" })}><Plus className="h-4 w-4" />Novo Item</Button>
    </>
  );

  return (
    <MainLayout title="Inventário" description="Controle de equipamentos e patrimônio" actions={headerActions}>
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="bg-card border-border"><CardContent className="p-4"><div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Total de Itens</span><Package className="h-4 w-4 text-muted-foreground" /></div><div className="mt-2 flex items-baseline justify-between"><span className="text-2xl font-bold text-foreground">{metricas.total}</span></div><p className="text-xs text-muted-foreground mt-1">equipamentos cadastrados</p></CardContent></Card>
          <Card className="bg-card border-border"><CardContent className="p-4"><div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Em Uso</span><Package className="h-4 w-4 text-muted-foreground" /></div><div className="mt-2 flex items-baseline justify-between"><span className="text-2xl font-bold text-foreground">{metricas.emUso}</span></div><p className="text-xs text-muted-foreground mt-1">em operação</p></CardContent></Card>
          <Card className="bg-card border-border"><CardContent className="p-4"><div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Em Manutenção</span><Wrench className="h-4 w-4 text-muted-foreground" /></div><div className="mt-2 flex items-baseline justify-between"><span className="text-2xl font-bold text-foreground">{metricas.emManutencao}</span></div><p className="text-xs text-muted-foreground mt-1">equipamentos</p></CardContent></Card>
          <Card className="bg-card border-border"><CardContent className="p-4"><div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Disponíveis</span><CheckCircle className="h-4 w-4 text-muted-foreground" /></div><div className="mt-2 flex items-baseline justify-between"><span className="text-2xl font-bold text-foreground">{metricas.disponiveis}</span></div><p className="text-xs text-muted-foreground mt-1">prontos para uso</p></CardContent></Card>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative flex-1"><Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Buscar equipamentos por nome, categoria ou local..." className="pl-10 bg-card border-border" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}><SelectTrigger className="w-[170px] bg-card border-border"><SelectValue placeholder="Todos Categoria" /></SelectTrigger><SelectContent><SelectItem value="all-category">Todos Categoria</SelectItem><SelectItem value="áudio">Áudio</SelectItem><SelectItem value="vídeo">Vídeo</SelectItem><SelectItem value="computador">Computador</SelectItem><SelectItem value="iluminação">Iluminação</SelectItem><SelectItem value="estrutura">Estrutura</SelectItem></SelectContent></Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-[140px] bg-card border-border"><SelectValue placeholder="Todos Status" /></SelectTrigger><SelectContent><SelectItem value="all-status">Todos Status</SelectItem><SelectItem value="em-uso">Em Uso</SelectItem><SelectItem value="disponivel">Disponível</SelectItem><SelectItem value="manutencao">Manutenção</SelectItem></SelectContent></Select>
          <Select value={localFilter} onValueChange={setLocalFilter}><SelectTrigger className="w-[140px] bg-card border-border"><SelectValue placeholder="Todos Local" /></SelectTrigger><SelectContent><SelectItem value="all-local">Todos Local</SelectItem><SelectItem value="estudio1">Estúdio 1</SelectItem><SelectItem value="estudio2">Estúdio 2</SelectItem><SelectItem value="escritorio">Escritório</SelectItem><SelectItem value="estoque">Estoque</SelectItem></SelectContent></Select>
          {hasActiveFilters && <Button variant="outline" onClick={handleClearFilters}>Limpar</Button>}
        </div>

        <Card className="bg-card border-border">
          <CardHeader><CardTitle className="text-lg">Lista de Equipamentos</CardTitle><CardDescription>Inventário completo de equipamentos e instrumentos</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            {inventario.length > 0 && (
              <div className="flex items-center gap-3 mb-4 pb-3 border-b border-border"><div className="w-5 h-5 rounded-full border-2 border-red-500 flex items-center justify-center cursor-pointer" onClick={() => setSelectAll(!selectAll)}>{selectAll && <div className="w-2.5 h-2.5 rounded-full bg-red-500" />}</div><span className="text-sm text-muted-foreground flex-1">Selecionar todos</span></div>
            )}

            {filteredEquipamentos.length > 0 ? (
              <div className="space-y-3">
                {filteredEquipamentos.map((item: any) => (
                  <div key={item.id} className="flex items-center gap-4 p-4 bg-muted/30 rounded-lg border border-border hover:bg-muted/50 transition-colors" data-testid={`card-inventario-${item.id}`}>
                    <div className="w-5 h-5 rounded-full border-2 border-red-500 flex items-center justify-center cursor-pointer"></div>
                    <div className="w-10 h-10 bg-red-600 rounded-lg flex items-center justify-center shrink-0"><Monitor className="h-5 w-5 text-white" /></div>
                    <div className="min-w-[160px] flex-1">
                      <h3 className="font-semibold text-foreground" data-testid={`text-inventario-nome-${item.id}`}>{item.nome}</h3>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <Badge variant="outline" className="text-xs">{item.categoria || "-"}</Badge>
                        <StatusBadge status={item.status} />
                        {item.setor && <Badge variant="secondary" className="text-xs">{item.setor}</Badge>}
                      </div>
                    </div>
                    <div className="hidden md:block text-sm shrink-0">
                      <span className="text-muted-foreground text-xs">Quantidade</span>
                      <p className="font-medium text-foreground">{item.quantidade || 1}</p>
                    </div>
                    <div className="hidden lg:block text-sm shrink-0">
                      <span className="text-muted-foreground text-xs">Localização</span>
                      <div className="flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                        <p className="font-medium text-foreground">{item.localizacao || "-"}</p>
                      </div>
                    </div>
                    <div className="hidden lg:block text-sm shrink-0">
                      <span className="text-muted-foreground text-xs">Responsável</span>
                      <div className="flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5 text-muted-foreground" />
                        <p className="font-medium text-foreground">{item.responsavel || "-"}</p>
                      </div>
                    </div>
                    <div className="hidden xl:block text-sm shrink-0">
                      <span className="text-muted-foreground text-xs">Valor Unit.</span>
                      <p className="font-semibold text-green-600">{item.valor_unitario ? formatCurrency(item.valor_unitario) : "-"}</p>
                    </div>
                    <div className="hidden xl:block text-sm shrink-0">
                      <span className="text-muted-foreground text-xs">Entrada</span>
                      <p className="font-medium text-foreground">{item.dataEntrada ? formatDate(item.dataEntrada) : "-"}</p>
                    </div>
                    <div className="flex flex-col items-center">
                      <span className="text-xs text-muted-foreground mb-1">Ações</span>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" data-testid={`button-menu-inventario-${item.id}`}>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem data-testid={`button-ver-inventario-${item.id}`} onClick={() => setViewModal({ open: true, item })}>
                          <Eye className="h-4 w-4 mr-2" />
                          Ver
                        </DropdownMenuItem>
                        <DropdownMenuItem data-testid={`button-editar-inventario-${item.id}`} onClick={() => setFormModal({ open: true, mode: "edit", item })}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem data-testid={`button-excluir-inventario-${item.id}`} onClick={() => setDeleteModal({ open: true, item })} className="text-red-600">
                          <Trash2 className="h-4 w-4 mr-2" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={Package}
                title="Nenhum equipamento cadastrado"
                description="Comece adicionando seu primeiro item ao inventário"
                actionLabel="Novo Item"
                onAction={() => setFormModal({ open: true, mode: "create" })}
              />
            )}
          </CardContent>
        </Card>
      </div>

      <InventarioViewModal open={viewModal.open} onOpenChange={(open) => setViewModal({ ...viewModal, open })} item={viewModal.item} />
      <InventarioFormModal open={formModal.open} onOpenChange={(open) => setFormModal({ ...formModal, open })} item={formModal.item} mode={formModal.mode} />
      <DeleteConfirmModal open={deleteModal.open} onOpenChange={(open) => setDeleteModal({ ...deleteModal, open })} title="Excluir Item" description={`Tem certeza que deseja excluir "${deleteModal.item?.nome}"?`} onConfirm={handleDelete} />
    </MainLayout>
  );
}
