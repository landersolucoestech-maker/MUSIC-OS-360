import { useCallback, useState, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import { useEditQueryParam } from "@/hooks/useEditQueryParam";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { DollarSign, TrendingUp, TrendingDown, FileText, Link as LinkIcon, Download, Plus, Search, Settings, Calendar, Upload, MoreHorizontal, Eye, Pencil, Trash2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useTransacoes } from "@/hooks/useTransacoes";
import { useMetrics } from "@/hooks/useMetrics";
import { formatCurrency, formatDate } from "@/lib/utils-format";
import { TransacaoFormModal } from "@/components/forms/TransacaoFormModal";
import { TransacaoViewModal } from "@/components/forms/TransacaoViewModal";
import { DeleteConfirmModal } from "@/components/forms/DeleteConfirmModal";
import { exportToCSV, CSVColumn } from "@/lib/csv";
import { cn } from "@/lib/utils";
import { FinanceiroSkeleton } from "@/components/shared/PageSkeletons";
import { toast } from "sonner";

type Transacao = Record<string, any>;

const transacaoColumns: CSVColumn[] = [
  { key: "descricao", label: "Descrição" },
  { key: "categoria", label: "Categoria" },
  { key: "status", label: "Status" },
  { key: "data", label: "Data" },
  { key: "valor", label: "Valor" },
  { key: "tipo", label: "Tipo" },
];

export default function Financeiro() {
  const { transacoes, isLoading: transacoesLoading, deleteTransacao, addTransacao } = useTransacoes();
  const { financeiroMetrics, isLoading: metricsLoading } = useMetrics();
  const ofxInputRef = useRef<HTMLInputElement>(null);

  const isLoading = transacoesLoading || metricsLoading;

  // Destructure metrics for easier access
  const metricas = financeiroMetrics;

  const [selectAll, setSelectAll] = useState(false);
  const [formModal, setFormModal] = useState<{ open: boolean; mode: "create" | "edit"; transacao?: Transacao }>({ open: false, mode: "create" });
  const [viewModal, setViewModal] = useState<{ open: boolean; transacao?: Transacao }>({ open: false });
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; transacao?: Transacao }>({ open: false });

  useEditQueryParam(
    "edit",
    transacoes,
    useCallback((transacao: Transacao) => setFormModal({ open: true, mode: "edit", transacao }), []),
  );

  const [searchTerm, setSearchTerm] = useState("");
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [typeFilter, setTypeFilter] = useState("all-type");
  const [statusFilter, setStatusFilter] = useState("all-status");
  const [categoryFilter, setCategoryFilter] = useState("all-category");

  const handleExport = () => exportToCSV(transacoes, transacaoColumns, "transacoes");

  const handleOFXUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.ofx')) {
      toast.error("Por favor, selecione um arquivo OFX válido");
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      const content = e.target?.result as string;
      try {
        const transactions = parseOFXContent(content);
        if (transactions.length === 0) {
          toast.error("Nenhuma transação encontrada no arquivo OFX");
          return;
        }
        
        // Add each transaction with proper async handling
        let successCount = 0;
        let errorCount = 0;
        
        for (const tx of transactions) {
          try {
            await addTransacao.mutateAsync(tx);
            successCount++;
          } catch {
            errorCount++;
          }
        }
        
        if (successCount > 0) {
          toast.success(`${successCount} transação(ões) importada(s) com sucesso!`);
        }
        if (errorCount > 0) {
          toast.error(`${errorCount} transação(ões) falharam ao importar`);
        }
      } catch {
        toast.error("Erro ao processar arquivo OFX");
      }
    };
    reader.readAsText(file);
    
    // Reset input
    if (ofxInputRef.current) {
      ofxInputRef.current.value = '';
    }
  };

  const parseOFXContent = (content: string): Array<{
    descricao: string;
    valor: number;
    data: string;
    tipo: string;
    categoria: string;
    status: string;
    artista_id: string | null;
    cliente_id: string | null;
    origem: any;
    venda_id: string | null;
  }> => {
    const transactions: Array<{
      descricao: string;
      valor: number;
      data: string;
      tipo: string;
      categoria: string;
      status: string;
      artista_id: string | null;
      cliente_id: string | null;
      origem: any;
      venda_id: string | null;
    }> = [];

    // Simple OFX parser - extract STMTTRN blocks
    const stmttrnRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
    let match;

    while ((match = stmttrnRegex.exec(content)) !== null) {
      const block = match[1];
      
      // Extract fields
      const trnamt = block.match(/<TRNAMT>([^<\n]+)/i)?.[1]?.trim();
      const dtposted = block.match(/<DTPOSTED>([^<\n]+)/i)?.[1]?.trim();
      const memo = block.match(/<MEMO>([^<\n]+)/i)?.[1]?.trim() || 
                   block.match(/<NAME>([^<\n]+)/i)?.[1]?.trim() || 
                   "Transação importada";

      if (trnamt && dtposted) {
        const valor = parseFloat(trnamt.replace(",", "."));
        
        // Parse date (format: YYYYMMDD or YYYYMMDDHHMMSS)
        const year = dtposted.substring(0, 4);
        const month = dtposted.substring(4, 6);
        const day = dtposted.substring(6, 8);
        const data = `${year}-${month}-${day}`;

        transactions.push({
          descricao: memo,
          valor: Math.abs(valor),
          data,
          tipo: valor >= 0 ? "receita" : "despesa",
          categoria: "outros",
          status: "pago",
          artista_id: null,
          cliente_id: null,
          origem: "manual" as any,
          venda_id: null,
        });
      }
    }

    return transactions;
  };
  const filteredTransacoes = useMemo(() => {
    return transacoes.filter((transacao) => {
      const matchesSearch = transacao.descricao.toLowerCase().includes(searchTerm.toLowerCase()) ||
        transacao.categoria.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = typeFilter === "all-type" || 
        (typeFilter === "receita" && transacao.tipo === "receita") ||
        (typeFilter === "despesa" && transacao.tipo === "despesa");
      const matchesStatus = statusFilter === "all-status" || transacao.status.toLowerCase() === statusFilter.toLowerCase();
      const matchesCategory = categoryFilter === "all-category" || transacao.categoria.toLowerCase() === categoryFilter.toLowerCase();
      
      const transacaoDate = new Date(transacao.data);
      const matchesStartDate = !startDate || transacaoDate >= startDate;
      const matchesEndDate = !endDate || transacaoDate <= endDate;
      
      return matchesSearch && matchesType && matchesStatus && matchesCategory && matchesStartDate && matchesEndDate;
    });
  }, [transacoes, searchTerm, typeFilter, statusFilter, categoryFilter, startDate, endDate]);

  // Pending counts now come from metricas

  const hasActiveFilters = searchTerm !== "" || typeFilter !== "all-type" || statusFilter !== "all-status" || categoryFilter !== "all-category" || startDate !== undefined || endDate !== undefined;

  const handleClearFilters = () => {
    setSearchTerm("");
    setStartDate(undefined);
    setEndDate(undefined);
    setTypeFilter("all-type");
    setStatusFilter("all-status");
    setCategoryFilter("all-category");
  };

  const handleDelete = () => {
    if (deleteModal.transacao) {
      deleteTransacao.mutate(deleteModal.transacao.id);
      setDeleteModal({ open: false });
    }
  };

  if (isLoading) {
    return <FinanceiroSkeleton />;
  }

  const headerActions = (
    <>
      <input
        type="file"
        ref={ofxInputRef}
        accept=".ofx"
        className="hidden"
        onChange={handleOFXUpload}
      />
      <Link to="/financeiro/regras">
        <Button variant="outline" size="sm" className="gap-2">
          <Settings className="h-4 w-4" />Regras
        </Button>
      </Link>
      <Button variant="outline" size="sm" className="gap-2" onClick={() => ofxInputRef.current?.click()}>
        <Upload className="h-4 w-4" />Importar OFX
      </Button>
      <Button variant="outline" size="sm" className="gap-2" onClick={handleExport}>
        <Download className="h-4 w-4" />Exportar
      </Button>
      <Button variant="outline" size="sm" className="gap-2">
        <LinkIcon className="h-4 w-4" />Integração Bancária
      </Button>
      <Button size="sm" className="gap-2 bg-red-600 hover:bg-red-700 text-white" onClick={() => setFormModal({ open: true, mode: "create" })}>
        <Plus className="h-4 w-4" />Nova Transação
      </Button>
    </>
  );

  return (
    <MainLayout title="Financeiro" description="Controle financeiro e fluxo de caixa" actions={headerActions}>
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Receita Mensal</span>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-2xl font-bold text-green-500">{formatCurrency(metricas.receitasPagas)}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">receitas pagas</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Despesas Mensais</span>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-2xl font-bold text-red-500">{formatCurrency(metricas.despesasPagas)}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">despesas pagas</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Lucro Líquido</span>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-2xl font-bold text-foreground">{formatCurrency(metricas.lucroLiquido)}</span>
                <span className="text-xs text-green-500">margem {metricas.margem}%</span>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Contas a Receber</span>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-2xl font-bold text-foreground">{formatCurrency(metricas.contasReceber)}</span>
                <span className="text-xs text-amber-500">{metricas.receitasPendentes} pendentes</span>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Contas a Pagar</span>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-2xl font-bold text-foreground">{formatCurrency(metricas.contasPagar)}</span>
                <span className="text-xs text-amber-500">{metricas.despesasPendentes} pendentes</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          <div className="relative flex-1 max-w-lg">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar transações..." className="pl-10 bg-card border-border" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("gap-2 min-w-[140px]", !startDate && "text-muted-foreground")}>
                  <Calendar className="h-4 w-4" />
                  {startDate ? format(startDate, "dd/MM/yyyy", { locale: ptBR }) : "Data início"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="single"
                  selected={startDate}
                  onSelect={setStartDate}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
            
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("gap-2 min-w-[140px]", !endDate && "text-muted-foreground")}>
                  <Calendar className="h-4 w-4" />
                  {endDate ? format(endDate, "dd/MM/yyyy", { locale: ptBR }) : "Data fim"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="single"
                  selected={endDate}
                  onSelect={setEndDate}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[140px] bg-card border-border">
              <SelectValue placeholder="Todos Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all-type">Todos Tipo</SelectItem>
              <SelectItem value="receita">Receita</SelectItem>
              <SelectItem value="despesa">Despesa</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px] bg-card border-border">
              <SelectValue placeholder="Todos Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all-status">Todos Status</SelectItem>
              <SelectItem value="pago">Pago</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
            </SelectContent>
          </Select>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[160px] bg-card border-border">
              <SelectValue placeholder="Todos Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all-category">Todos Categoria</SelectItem>
              <SelectItem value="royalties">Royalties</SelectItem>
              <SelectItem value="producao">Produção</SelectItem>
              <SelectItem value="shows">Shows</SelectItem>
              <SelectItem value="licenciamento">Licenciamento</SelectItem>
              <SelectItem value="operacional">Operacional</SelectItem>
              <SelectItem value="marketing">Marketing</SelectItem>
            </SelectContent>
          </Select>
          {hasActiveFilters && <Button variant="outline" onClick={handleClearFilters}>Limpar</Button>}
        </div>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-lg">Transações</CardTitle>
            <CardDescription>{filteredTransacoes.length} transação(ões) encontrada(s)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {filteredTransacoes.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhuma transação encontrada</p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="mt-4"
                  onClick={() => setFormModal({ open: true, mode: "create" })}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Criar primeira transação
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredTransacoes.map((transacao) => (
                  <div 
                    key={transacao.id} 
                    className={`flex items-center gap-4 p-4 rounded-lg border transition-colors ${
                      transacao.tipo === 'receita' 
                        ? 'bg-green-500/10 border-green-500/20 hover:bg-green-500/20' 
                        : 'bg-red-500/10 border-red-500/20 hover:bg-red-500/20'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      transacao.tipo === 'receita' ? 'bg-green-600' : 'bg-red-600'
                    }`}>
                      {transacao.tipo === 'receita' 
                        ? <TrendingUp className="h-5 w-5 text-white" /> 
                        : <TrendingDown className="h-5 w-5 text-white" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground truncate">{transacao.descricao}</p>
                      <div className="flex items-center mt-1">
                        <Badge 
                          variant="outline" 
                          className={`text-xs ${
                            transacao.status === 'pago' 
                              ? 'bg-green-500/20 text-green-500 border-green-500/30' 
                              : 'bg-amber-500/20 text-amber-500 border-amber-500/30'
                          }`}
                        >
                          {transacao.status === 'pago' ? 'Pago' : 'Pendente'}
                        </Badge>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Data</p>
                      <p className="text-sm text-foreground">{formatDate(transacao.data)}</p>
                    </div>
                    <div className="text-right min-w-[100px]">
                      <p className="text-xs text-muted-foreground">Valor</p>
                      <p className={`text-sm font-semibold ${
                        transacao.tipo === 'receita' ? 'text-green-500' : 'text-red-500'
                      }`}>
                        {transacao.tipo === 'receita' ? '+' : '-'}{formatCurrency(transacao.valor)}
                      </p>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setViewModal({ open: true, transacao })}>
                          <Eye className="h-4 w-4 mr-2" />
                          Ver
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setFormModal({ open: true, mode: "edit", transacao })}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setDeleteModal({ open: true, transacao })} className="text-red-600">
                          <Trash2 className="h-4 w-4 mr-2" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <TransacaoViewModal 
        open={viewModal.open} 
        onOpenChange={(open) => setViewModal({ ...viewModal, open })} 
        transacao={viewModal.transacao as any} 
      />
      <TransacaoFormModal 
        open={formModal.open} 
        onOpenChange={(open) => setFormModal({ ...formModal, open })} 
        transacao={formModal.transacao as any} 
        mode={formModal.mode} 
      />
      <DeleteConfirmModal 
        open={deleteModal.open} 
        onOpenChange={(open) => setDeleteModal({ ...deleteModal, open })} 
        title="Excluir Transação" 
        description="Tem certeza que deseja excluir esta transação?" 
        onConfirm={handleDelete} 
      />
    </MainLayout>
  );
}
