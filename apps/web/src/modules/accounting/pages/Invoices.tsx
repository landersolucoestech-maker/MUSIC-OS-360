import { useCallback, useMemo, useState } from "react";
import { runBulkAction, reportBulkResult } from "@/shared/hooks/useBulkAction";
import { MainLayout } from "@/shared/components/MainLayout";
import { useEditQueryParam } from "@/shared/hooks/useEditQueryParam";
import { ListSectionHeader } from "@/shared/components/ListSectionHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { Input } from "@/shared/ui/input";
import { DatePickerField } from "@/shared/ui/date-picker-field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import {
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
  MoreHorizontal,
} from "lucide-react";
import { InvoiceFormModal } from "@/modules/accounting/components/invoice-form/InvoiceFormModal";
import { InvoiceViewModal } from "@/modules/accounting/components/InvoiceViewModal";
import { useInvoices } from "@/modules/accounting/hooks/useInvoices";
import { DeleteConfirmModal } from "@/shared/components/DeleteConfirmModal";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { TablePagination } from "@/shared/ui/table-pagination";
import { usePagination } from "@/shared/hooks/usePagination";
import { Badge } from "@/shared/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { parseOperationType, type InvoiceOperationType } from "@/modules/accounting/types/invoice-type";
import { formatCurrency, getCurrencyToneClass, getMonetarySemanticClass } from "@/shared/lib/format-utils";

type TypeFilter = "all" | InvoiceOperationType;

function numberValue(...values: unknown[]): number | null {
  for (const value of values) {
    if (value === null || value === undefined || value === "") continue;
    const parsed = typeof value === "number" ? value : Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function getInvoicePartyName(invoice: any): string {
  return (
    invoice.clientes?.nome ||
    invoice.tomador_razao_social ||
    invoice.tomador_nome ||
    "-"
  );
}

function getInvoiceDisplayValue(invoice: any): number | null {
  return numberValue(invoice.valor_liquido, invoice.valor_servicos, invoice.valor, invoice.valor_total);
}

export default function Invoices() {
  const { invoices, isLoading, deleteInvoice } = useInvoices();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit" | "view">("create");
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [createType, setCreateType] = useState<InvoiceOperationType>("saida");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [isViewOpen, setIsViewOpen] = useState(false);

  // Enriquecimento: anota cada nota com o type derivado das observações
  const invoicesWithType = useMemo(
    () =>
      invoices.map((n: any) => ({
        ...n,
        _operationType: parseOperationType(n.observacoes).type,
      })),
    [invoices],
  );

  const handleView = (invoice: any) => {
    setSelectedInvoice(invoice);
    setIsViewOpen(true);
  };

  const handleEdit = useCallback((invoice: any) => {
    setSelectedInvoice(invoice);
    setModalMode("edit");
    setIsModalOpen(true);
  }, []);

  useEditQueryParam("edit", invoices, handleEdit, "invoices");

  const handleDelete = (invoice: any) => {
    setSelectedInvoice(invoice);
    setDeleteModalOpen(true);
  };

  const confirmDelete = () => {
    if (selectedInvoice) {
      deleteInvoice.mutate(selectedInvoice.id);
    }
    setDeleteModalOpen(false);
    setSelectedInvoice(null);
  };

  const handleCreate = (type: InvoiceOperationType) => {
    setSelectedInvoice(null);
    setCreateType(type);
    setModalMode("create");
    setIsModalOpen(true);
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    const ids = selectedIds;
    setSelectedIds([]);
    const result = await runBulkAction(ids, (id) => deleteInvoice.mutateAsync(id));
    reportBulkResult(result, "excluída", "nota fiscal");
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredInvoices.length && filteredInvoices.length > 0) {
      setSelectedIds([]);
      return;
    }
    setSelectedIds(filteredInvoices.map((invoice: any) => invoice.id));
  };

  // Filtros
  const filteredInvoices = invoicesWithType.filter((invoice: any) => {
    const partyName = getInvoicePartyName(invoice).toLowerCase();
    const rawSearch = searchTerm.toLowerCase();
    const matchesSearch =
      (invoice.numero || "").toLowerCase().includes(rawSearch) ||
      partyName.includes(rawSearch) ||
      (invoice.tomador_cnpj || "").toLowerCase().includes(rawSearch) ||
      (invoice.tomador_email || "").toLowerCase().includes(rawSearch);
    const matchesStatus = statusFilter === "all" || invoice.status === statusFilter;
    const matchesType = typeFilter === "all" || invoice._operationType === typeFilter;
    const emissao = String(invoice.data_emissao ?? "").slice(0, 10);
    const matchesStart = !startDate || (emissao && emissao >= startDate);
    const matchesEnd = !endDate || (emissao && emissao <= endDate);
    return matchesSearch && matchesStatus && matchesType && matchesStart && matchesEnd;
  });

  const { page, pageSize, total, pageItems, setPage, setPageSize } = usePagination(filteredInvoices, 10);

  // Métricas
  const totalRegistered = invoicesWithType.length;
  const outgoingInvoices = invoicesWithType.filter((n: any) => n._operationType === "saida");
  const incomingInvoices = invoicesWithType.filter((n: any) => n._operationType === "entrada");
  const outgoingTotal = outgoingInvoices.reduce((acc: number, n: any) => acc + (getInvoiceDisplayValue(n) ?? 0), 0);
  const incomingTotal = incomingInvoices.reduce((acc: number, n: any) => acc + (getInvoiceDisplayValue(n) ?? 0), 0);
  const balance = outgoingTotal - incomingTotal;

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      issued: { variant: "default", label: "Emitida" },
      pending: { variant: "secondary", label: "Pendente" },
      paid: { variant: "outline", label: "Paga" },
      cancelled: { variant: "destructive", label: "Cancelada" },
    };
    const config = variants[status] || { variant: "secondary", label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getTypeBadge = (type: InvoiceOperationType) =>
    type === "entrada" ? (
      <Badge variant="secondary" className="gap-1" data-testid="badge-type-entrada">
        <ArrowDownLeft className="h-3 w-3" />
        Entrada
      </Badge>
    ) : (
      <Badge variant="default" className="gap-1" data-testid="badge-type-saida">
        <ArrowUpRight className="h-3 w-3" />
        Saída
      </Badge>
    );


  const headerActions = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" className="gap-2" data-testid="button-registrar-invoice">
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
        {/* Metrics — padrão do sistema */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg"><FileText className="h-5 w-5 text-primary" /></div>
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">Total</p>
                  <p className="text-xl font-bold text-foreground" data-testid="metric-total-registradas">{totalRegistered}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500/10 rounded-lg"><ArrowUpRight className="h-5 w-5 text-green-500" /></div>
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">Saídas</p>
                  <p className="text-xl font-bold text-foreground" data-testid="metric-outgoingInvoices-qtd">{outgoingInvoices.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-500/10 rounded-lg"><ArrowDownLeft className="h-5 w-5 text-yellow-500" /></div>
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">Entradas</p>
                  <p className="text-xl font-bold text-foreground" data-testid="metric-incomingInvoices-qtd">{incomingInvoices.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500/10 rounded-lg"><ArrowUpRight className="h-5 w-5 text-green-500" /></div>
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">Valor Saídas</p>
                  <p className={`text-base font-bold leading-tight ${getMonetarySemanticClass("positive")}`} data-testid="metric-valor-outgoingInvoices">{formatCurrency(outgoingTotal)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-500/10 rounded-lg"><ArrowDownLeft className="h-5 w-5 text-yellow-500" /></div>
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">Valor Entradas</p>
                  <p className={`text-base font-bold leading-tight ${getMonetarySemanticClass("negative")}`} data-testid="metric-valor-incomingInvoices">{formatCurrency(-incomingTotal)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${balance >= 0 ? "bg-green-500/10" : "bg-red-500/10"}`}>
                  <Scale className={`h-5 w-5 ${balance >= 0 ? "text-green-500" : "text-red-500"}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">Saldo</p>
                  <p className={`text-base font-bold leading-tight ${getCurrencyToneClass(balance)}`} data-testid="metric-balance">
                    {balance >= 0 ? "+" : ""}{formatCurrency(balance)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-wrap items-center gap-3 rounded-lg bg-muted/30 p-3">
          {/* Seletor de datas — sempre imediatamente à esquerda da busca */}
          <DatePickerField
            value={startDate}
            onChange={setStartDate}
            placeholder="Data início"
            className="h-8 text-xs w-[150px] shrink-0"
            data-testid="datepicker-start-date"
          />
          <DatePickerField
            value={endDate}
            onChange={setEndDate}
            placeholder="Data fim"
            className="h-8 text-xs w-[150px] shrink-0"
            data-testid="datepicker-end-date"
          />
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar por número, cliente ou fornecedor…"
              className="pl-9 h-8 text-sm bg-card border-border"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              data-testid="input-busca-nf"
            />
          </div>
          <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value as TypeFilter)}>
            <SelectTrigger className="w-auto min-w-[140px] h-8 text-sm bg-card border-border shrink-0" data-testid="select-type-filter">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" data-testid="filter-type-all">Todas</SelectItem>
              <SelectItem value="saida" data-testid="filter-type-saida">Saída</SelectItem>
              <SelectItem value="entrada" data-testid="filter-type-entrada">Entrada</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-auto min-w-[140px] h-8 text-sm bg-card border-border" data-testid="select-status-filter">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="issued">Emitida</SelectItem>
              <SelectItem value="pending">Pendente</SelectItem>
              <SelectItem value="paid">Paga</SelectItem>
              <SelectItem value="cancelled">Cancelada</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table or Empty State */}
        {filteredInvoices.length > 0 ? (
          <Card>
            <CardContent>
              <ListSectionHeader
                title="Lista de Notas Fiscais"
                count={filteredInvoices.length}
                description="Registro de notas de entrada e saída"
                action={
                  <div className="flex flex-wrap items-center justify-end gap-3">
                    <Checkbox
                      checked={selectedIds.length === filteredInvoices.length && filteredInvoices.length > 0}
                      onCheckedChange={toggleSelectAll}
                      aria-label="Selecionar todas as notas fiscais"
                      data-testid="checkbox-select-all-notas"
                    />
                    <span className="text-xs text-muted-foreground">
                      {selectedIds.length > 0 ? `${selectedIds.length} nota(s) selecionada(s)` : "Selecionar todos"}
                    </span>
                    {selectedIds.length > 0 && (
                      <Button variant="destructive" size="sm" className="gap-1 h-7 text-xs" onClick={handleBulkDelete} data-testid="button-bulk-delete-notas">
                        <Trash2 className="h-3.5 w-3.5" />
                        Excluir ({selectedIds.length})
                      </Button>
                    )}
                  </div>
                }
              />
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8"></TableHead>
                      <TableHead>Número</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Cliente / Fornecedor</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Data Emissão</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>PDF</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pageItems.map((invoice: any) => {
                      const displayValue = getInvoiceDisplayValue(invoice);
                      return (
                      <TableRow key={invoice.id} data-testid={`row-invoice-${invoice.id}`}>
                        <TableCell className="py-3">
                          <Checkbox
                            checked={selectedIds.includes(invoice.id)}
                            onCheckedChange={() => setSelectedIds(prev => prev.includes(invoice.id) ? prev.filter(x => x !== invoice.id) : [...prev, invoice.id])}
                            aria-label="Selecionar nota fiscal"
                            data-testid={`checkbox-invoice-${invoice.id}`}
                          />
                        </TableCell>
                        <TableCell className="py-3">
                          <span className="font-medium">{invoice.numero}</span>
                          {invoice.serie && <span className="text-muted-foreground text-xs ml-1">/{invoice.serie}</span>}
                        </TableCell>
                        <TableCell className="py-3">{getTypeBadge(invoice._operationType)}</TableCell>
                        <TableCell className="py-3 text-sm">{getInvoicePartyName(invoice)}</TableCell>
                        <TableCell className={`py-3 text-sm ${getMonetarySemanticClass("neutral")}`}>
                          {displayValue !== null ? formatCurrency(displayValue) : "-"}
                        </TableCell>
                        <TableCell className="py-3 text-sm">
                          {invoice.data_emissao ? format(new Date(invoice.data_emissao), "dd/MM/yyyy", { locale: ptBR }) : "-"}
                        </TableCell>
                        <TableCell className="py-3">{getStatusBadge(invoice.status)}</TableCell>
                        <TableCell className="py-3">
                          {invoice.url_pdf ? (
                            <Button variant="ghost" size="sm" onClick={() => window.open(invoice.url_pdf, "_blank")}>
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          ) : (
                            <span className="text-muted-foreground text-xs">-</span>
                          )}
                        </TableCell>
                        <TableCell className="py-3 text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" aria-label="Ações da nota fiscal" data-testid={`button-actions-invoice-${invoice.id}`}>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleView(invoice)} data-testid={`menu-view-invoice-${invoice.id}`}>
                                <Eye className="h-4 w-4 mr-2" />
                                Visualizar
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleEdit(invoice)} data-testid={`menu-edit-invoice-${invoice.id}`}>
                                <Pencil className="h-4 w-4 mr-2" />
                                Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleDelete(invoice)} data-testid={`menu-delete-invoice-${invoice.id}`}>
                                <Trash2 className="h-4 w-4 mr-2 text-destructive" />
                                Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                    })}
                  </TableBody>
                </Table>
              </div>
              <TablePagination
                total={total}
                page={page}
                pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
                itemLabel="notas fiscais"
              />
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="w-16 h-16 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                <FileText className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                {searchTerm || statusFilter !== "all" || typeFilter !== "all"
                  ? "Nenhuma nota encontrada"
                  : "Nenhuma nota fiscal registrada"}
              </h3>
              <p className="text-sm text-muted-foreground text-center mb-4">
                {searchTerm || statusFilter !== "all" || typeFilter !== "all"
                  ? "Tente ajustar os filtros de busca"
                  : "Registre notas fiscais de entrada (recebidas) e saída (emitidas) para controle interno"}
              </p>
              {!searchTerm && statusFilter === "all" && typeFilter === "all" && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button className="gap-2" data-testid="button-registrar-primeira-invoice">
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

      <InvoiceFormModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        mode={modalMode}
        invoice={selectedInvoice}
        defaultOperationType={createType}
      />

      <InvoiceViewModal
        open={isViewOpen}
        onOpenChange={setIsViewOpen}
        invoice={selectedInvoice}
        onEdit={() => { setIsViewOpen(false); setModalMode("edit"); setIsModalOpen(true); }}
      />

      <DeleteConfirmModal
        open={deleteModalOpen}
        onOpenChange={setDeleteModalOpen}
        onConfirm={confirmDelete}
        title="Excluir Nota Fiscal"
        description={`Tem certeza que deseja excluir a nota fiscal ${selectedInvoice?.numero}?`}
      />
    </MainLayout>
  );
}
