import { useCallback, useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { useEditQueryParam } from "@/hooks/useEditQueryParam";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  DollarSign,
  FileText,
  Plus,
  Search,
  Eye,
  Pencil,
  Trash2,
  ExternalLink,
  ArrowUpRight,
  ArrowDownLeft,
  Scale,
} from "lucide-react";
import { NotaFiscalFormModal } from "@/components/forms/NotaFiscalFormModal";
import { NotaFiscalViewModal } from "@/components/forms/NotaFiscalViewModal";
import { useNotasFiscais } from "@/hooks/useNotasFiscais";
import { DeleteConfirmModal } from "@/components/forms/DeleteConfirmModal";
import { DataTable } from "@/components/shared/DataTable";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { parseTipoOperacao, type TipoOperacaoNF } from "@/lib/nota-fiscal-tipo";

type TipoFilter = "all" | TipoOperacaoNF;

export default function NotaFiscal() {
  const { notasFiscais, isLoading, deleteNotaFiscal } = useNotasFiscais();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit" | "view">("create");
  const [selectedNota, setSelectedNota] = useState<any>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [tipoFilter, setTipoFilter] = useState<TipoFilter>("all");
  const [createTipo, setCreateTipo] = useState<TipoOperacaoNF>("saida");

  const [isViewOpen, setIsViewOpen] = useState(false);

  // Enriquecimento: anota cada nota com o tipo derivado das observações
  const notasFiscaisComTipo = useMemo(
    () =>
      notasFiscais.map((n: any) => ({
        ...n,
        _tipoOperacao: parseTipoOperacao(n.observacoes).tipo,
      })),
    [notasFiscais],
  );

  const handleView = (nota: any) => {
    setSelectedNota(nota);
    setIsViewOpen(true);
  };

  const handleEdit = useCallback((nota: any) => {
    setSelectedNota(nota);
    setModalMode("edit");
    setIsModalOpen(true);
  }, []);

  useEditQueryParam("edit", notasFiscais, handleEdit);

  const handleDelete = (nota: any) => {
    setSelectedNota(nota);
    setDeleteModalOpen(true);
  };

  const confirmDelete = () => {
    if (selectedNota) {
      deleteNotaFiscal.mutate(selectedNota.id);
    }
    setDeleteModalOpen(false);
    setSelectedNota(null);
  };

  const handleCreate = (tipo: TipoOperacaoNF) => {
    setSelectedNota(null);
    setCreateTipo(tipo);
    setModalMode("create");
    setIsModalOpen(true);
  };

  // Filtros
  const filteredNotas = notasFiscaisComTipo.filter((nota: any) => {
    const matchesSearch =
      nota.numero.toLowerCase().includes(searchTerm.toLowerCase()) ||
      nota.clientes?.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (nota.tomador_razao_social || "").toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || nota.status === statusFilter;
    const matchesTipo = tipoFilter === "all" || nota._tipoOperacao === tipoFilter;
    return matchesSearch && matchesStatus && matchesTipo;
  });

  // Métricas
  const totalRegistradas = notasFiscaisComTipo.length;
  const saidas = notasFiscaisComTipo.filter((n: any) => n._tipoOperacao === "saida");
  const entradas = notasFiscaisComTipo.filter((n: any) => n._tipoOperacao === "entrada");
  const valorSaidas = saidas.reduce((acc: number, n: any) => acc + (n.valor || 0), 0);
  const valorEntradas = entradas.reduce((acc: number, n: any) => acc + (n.valor || 0), 0);
  const saldo = valorSaidas - valorEntradas;

  const fmtCurrency = (v: number) =>
    `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      emitida: { variant: "default", label: "Emitida" },
      pendente: { variant: "secondary", label: "Pendente" },
      paga: { variant: "outline", label: "Paga" },
      cancelada: { variant: "destructive", label: "Cancelada" },
    };
    const config = variants[status] || { variant: "secondary", label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getTipoBadge = (tipo: TipoOperacaoNF) =>
    tipo === "entrada" ? (
      <Badge variant="secondary" className="gap-1" data-testid="badge-tipo-entrada">
        <ArrowDownLeft className="h-3 w-3" />
        Entrada
      </Badge>
    ) : (
      <Badge variant="default" className="gap-1" data-testid="badge-tipo-saida">
        <ArrowUpRight className="h-3 w-3" />
        Saída
      </Badge>
    );

  const columns = [
    {
      key: "numero",
      label: "Número",
      render: (nota: any) => (
        <div>
          <span className="font-medium">{nota.numero}</span>
          {nota.serie && <span className="text-muted-foreground text-xs ml-1">/{nota.serie}</span>}
        </div>
      ),
    },
    {
      key: "tipo",
      label: "Tipo",
      render: (nota: any) => getTipoBadge(nota._tipoOperacao),
    },
    {
      key: "cliente",
      label: "Cliente / Fornecedor",
      render: (nota: any) => nota.clientes?.nome || nota.tomador_razao_social || "-",
    },
    {
      key: "valor",
      label: "Valor",
      render: (nota: any) =>
        nota.valor ? `R$ ${nota.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "-",
    },
    {
      key: "data_emissao",
      label: "Data Emissão",
      render: (nota: any) =>
        nota.data_emissao ? format(new Date(nota.data_emissao), "dd/MM/yyyy", { locale: ptBR }) : "-",
    },
    {
      key: "status",
      label: "Status",
      render: (nota: any) => getStatusBadge(nota.status),
    },
    {
      key: "pdf",
      label: "PDF",
      render: (nota: any) =>
        nota.url_pdf ? (
          <Button variant="ghost" size="sm" onClick={() => window.open(nota.url_pdf, "_blank")}>
            <ExternalLink className="h-4 w-4" />
          </Button>
        ) : (
          <span className="text-muted-foreground text-xs">-</span>
        ),
    },
    {
      key: "actions",
      label: "",
      render: (nota: any) => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => handleView(nota)} data-testid={`button-view-nota-${nota.id}`}>
            <Eye className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => handleEdit(nota)} data-testid={`button-edit-nota-${nota.id}`}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => handleDelete(nota)} data-testid={`button-delete-nota-${nota.id}`}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  const headerActions = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" className="gap-2" data-testid="button-registrar-nota">
          <Plus className="h-4 w-4" />
          Registrar Nota
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleCreate("saida")} data-testid="menu-registrar-saida">
          <ArrowUpRight className="h-4 w-4 mr-2" />
          Registrar Saída
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleCreate("entrada")} data-testid="menu-registrar-entrada">
          <ArrowDownLeft className="h-4 w-4 mr-2" />
          Registrar Entrada
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <MainLayout title="Notas Fiscais" description="Registro e controle de notas fiscais de entrada e saída" actions={headerActions}>
      <div className="space-y-6">
        {/* Metrics */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total Registradas</span>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="mt-2">
                <span className="text-2xl font-bold text-foreground" data-testid="metric-total-registradas">{totalRegistradas}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Saídas (qtd)</span>
                <ArrowUpRight className="h-4 w-4 text-green-600" />
              </div>
              <div className="mt-2">
                <span className="text-2xl font-bold text-foreground" data-testid="metric-saidas-qtd">{saidas.length}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Entradas (qtd)</span>
                <ArrowDownLeft className="h-4 w-4 text-amber-600" />
              </div>
              <div className="mt-2">
                <span className="text-2xl font-bold text-foreground" data-testid="metric-entradas-qtd">{entradas.length}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Valor Saídas</span>
                <ArrowUpRight className="h-4 w-4 text-green-600" />
              </div>
              <div className="mt-2">
                <span className="text-2xl font-bold text-green-600" data-testid="metric-valor-saidas">
                  {fmtCurrency(valorSaidas)}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Valor Entradas</span>
                <ArrowDownLeft className="h-4 w-4 text-amber-600" />
              </div>
              <div className="mt-2">
                <span className="text-2xl font-bold text-amber-600" data-testid="metric-valor-entradas">
                  {fmtCurrency(valorEntradas)}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Saldo</span>
                <Scale className={`h-4 w-4 ${saldo >= 0 ? "text-green-600" : "text-red-600"}`} />
              </div>
              <div className="mt-2">
                <span
                  className={`text-2xl font-bold ${saldo >= 0 ? "text-green-600" : "text-red-600"}`}
                  data-testid="metric-saldo"
                >
                  {saldo >= 0 ? "+" : ""}
                  {fmtCurrency(saldo)}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por número, cliente ou fornecedor..."
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              data-testid="input-busca-nf"
            />
          </div>
          <ToggleGroup
            type="single"
            value={tipoFilter}
            onValueChange={(v) => v && setTipoFilter(v as TipoFilter)}
            variant="outline"
            size="sm"
            data-testid="toggle-tipo-filter"
          >
            <ToggleGroupItem value="all" data-testid="filter-tipo-all">Todas</ToggleGroupItem>
            <ToggleGroupItem value="saida" data-testid="filter-tipo-saida">
              <ArrowUpRight className="h-3.5 w-3.5 mr-1" />
              Saída
            </ToggleGroupItem>
            <ToggleGroupItem value="entrada" data-testid="filter-tipo-entrada">
              <ArrowDownLeft className="h-3.5 w-3.5 mr-1" />
              Entrada
            </ToggleGroupItem>
          </ToggleGroup>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px]" data-testid="select-status-filter">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="emitida">Emitida</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="paga">Paga</SelectItem>
              <SelectItem value="cancelada">Cancelada</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table or Empty State */}
        {filteredNotas.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Lista de Notas Fiscais</CardTitle>
              <CardDescription>
                {filteredNotas.length} nota{filteredNotas.length !== 1 ? "s" : ""} encontrada
                {filteredNotas.length !== 1 ? "s" : ""}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DataTable data={filteredNotas} columns={columns} isLoading={isLoading} />
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="w-16 h-16 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                <FileText className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                {searchTerm || statusFilter !== "all" || tipoFilter !== "all"
                  ? "Nenhuma nota encontrada"
                  : "Nenhuma nota fiscal registrada"}
              </h3>
              <p className="text-sm text-muted-foreground text-center mb-4">
                {searchTerm || statusFilter !== "all" || tipoFilter !== "all"
                  ? "Tente ajustar os filtros de busca"
                  : "Registre notas fiscais de entrada (recebidas) e saída (emitidas) para controle interno"}
              </p>
              {!searchTerm && statusFilter === "all" && tipoFilter === "all" && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button className="gap-2" data-testid="button-registrar-primeira-nota">
                      <Plus className="h-4 w-4" />
                      Registrar Primeira Nota
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="center">
                    <DropdownMenuItem onClick={() => handleCreate("saida")}>
                      <ArrowUpRight className="h-4 w-4 mr-2" />
                      Registrar Saída
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleCreate("entrada")}>
                      <ArrowDownLeft className="h-4 w-4 mr-2" />
                      Registrar Entrada
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <NotaFiscalFormModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        mode={modalMode}
        notaFiscal={selectedNota}
        defaultTipoOperacao={createTipo}
      />

      <NotaFiscalViewModal
        open={isViewOpen}
        onOpenChange={setIsViewOpen}
        notaFiscal={selectedNota}
        onEdit={() => { setIsViewOpen(false); setModalMode("edit"); setIsModalOpen(true); }}
      />

      <DeleteConfirmModal
        open={deleteModalOpen}
        onOpenChange={setDeleteModalOpen}
        onConfirm={confirmDelete}
        title="Excluir Nota Fiscal"
        description={`Tem certeza que deseja excluir a nota fiscal ${selectedNota?.numero}?`}
      />
    </MainLayout>
  );
}
