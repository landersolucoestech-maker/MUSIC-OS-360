import { useCallback, useState, useMemo, useRef } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { useEditQueryParam } from "@/hooks/useEditQueryParam";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, Download, Plus, Phone, Mail, Search, Eye, Upload, Pencil, Trash2, MoreHorizontal } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useClientes } from "@/hooks/useClientes";
import { useContratos } from "@/hooks/useContratos";
import { ContratoStatusBadge, getContratoSituacao } from "@/components/shared/ContratoStatusBadge";
import { CRMFormModal } from "@/components/forms/CRMFormModal";
import { CRMViewModal } from "@/components/forms/CRMViewModal";
import { DeleteConfirmModal } from "@/components/forms/DeleteConfirmModal";
import { CRMSkeleton } from "@/components/shared/PageSkeletons";
import { toast } from "sonner";
const getXLSX = () => import("xlsx");

type Cliente = Record<string, any>;

const temperaturaBadge: Record<string, string> = {
  quente: "bg-amber-500 text-white",
  frio: "bg-blue-500 text-white",
  morno: "bg-orange-400 text-white",
};

const prioridadeBadge: Record<string, string> = {
  alta: "bg-red-600 text-white",
  media: "bg-amber-500 text-white",
  baixa: "bg-green-600 text-white",
};

export default function CRM() {
  const { clientes: rawClientes, isLoading: clientesLoading, deleteCliente, addCliente } = useClientes();
  const { contratos } = useContratos();
  const clientes = rawClientes as Cliente[];
  const csvInputRef = useRef<HTMLInputElement>(null);

  const isLoading = clientesLoading;

  const contratosPorCliente = useMemo(() => {
    const map = new Map<string, Array<{ status?: string | null; data_fim?: string | null }>>();
    for (const c of contratos as Array<{ cliente_id?: string | null; status?: string | null; data_fim?: string | null }>) {
      if (!c.cliente_id) continue;
      const arr = map.get(c.cliente_id) ?? [];
      arr.push({ status: c.status, data_fim: c.data_fim });
      map.set(c.cliente_id, arr);
    }
    return map;
  }, [contratos]);

  const [selectAll, setSelectAll] = useState(false);
  const [formModal, setFormModal] = useState<{
    open: boolean;
    mode: "create" | "edit";
    cliente?: Cliente;
  }>({
    open: false,
    mode: "create"
  });
  const [viewModal, setViewModal] = useState<{
    open: boolean;
    cliente?: Cliente;
  }>({
    open: false
  });
  const [deleteModal, setDeleteModal] = useState<{
    open: boolean;
    cliente?: Cliente;
  }>({
    open: false
  });

  useEditQueryParam(
    "edit",
    clientes,
    useCallback((cliente: Cliente) => setFormModal({ open: true, mode: "edit", cliente }), []),
  );

  const [searchTerm, setSearchTerm] = useState("");
  const [tipoPessoaFilter, setTipoPessoaFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const filteredClientes = useMemo(() => {
    return clientes.filter(cliente => {
      const matchesSearch = searchTerm === "" || 
        cliente.nome.toLowerCase().includes(searchTerm.toLowerCase()) || 
        cliente.email?.toLowerCase().includes(searchTerm.toLowerCase()) || 
        cliente.responsavel?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesTipoPessoa = tipoPessoaFilter === "all" || cliente.tipo_pessoa === tipoPessoaFilter;
      const matchesStatus = statusFilter === "all" || cliente.status === statusFilter;
      return matchesSearch && matchesTipoPessoa && matchesStatus;
    });
  }, [clientes, searchTerm, tipoPessoaFilter, statusFilter]);

  const hasActiveFilters = searchTerm !== "" || tipoPessoaFilter !== "all" || statusFilter !== "all";

  const handleDelete = () => {
    if (deleteModal.cliente) {
      deleteCliente.mutate(deleteModal.cliente.id);
      setDeleteModal({ open: false });
    }
  };

  const clearFilters = () => {
    setSearchTerm("");
    setTipoPessoaFilter("all");
    setStatusFilter("all");
  };

  const getInitials = (nome: string) => {
    return nome.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase();
  };

  const handleExcelUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const XLSX = await getXLSX();
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data: Record<string, any>[] = XLSX.utils.sheet_to_json(worksheet);
      
      if (data.length === 0) {
        toast.error("Arquivo Excel vazio");
        return;
      }

      let importados = 0;
      for (const row of data) {
        const nome = row.nome || row.Nome || row.NOME || row.name || row.Name;
        if (!nome) continue;

        await addCliente.mutateAsync({
          nome,
          email: row.email || row.Email || row.EMAIL || null,
          telefone: row.telefone || row.Telefone || row.TELEFONE || row.phone || row.Phone || null,
          cpf_cnpj: row.cpf_cnpj || row.cpf || row.cnpj || row.CPF || row.CNPJ || null,
          tipo_pessoa: row.tipo_pessoa || row.tipo || "pessoa_fisica",
          status: row.status || row.Status || "lead",
          cidade: row.cidade || row.Cidade || null,
          estado: row.estado || row.Estado || row.uf || row.UF || null,
          endereco: row.endereco || row.Endereco || null,
          responsavel: row.responsavel || row.Responsavel || null,
          observacoes: row.observacoes || row.Observacoes || null,
        });
        importados++;
      }

      toast.success(`${importados} cliente(s) importado(s) com sucesso!`);
    } catch {
      toast.error("Erro ao importar Excel");
    }

    if (csvInputRef.current) {
      csvInputRef.current.value = "";
    }
  };

  if (isLoading) {
    return <CRMSkeleton />;
  }

  const headerActions = (
    <>
      <input
        type="file"
        ref={csvInputRef}
        accept=".xlsx,.xls"
        onChange={handleExcelUpload}
        className="hidden"
      />
      <Button variant="outline" size="sm" className="gap-2" data-testid="button-importar-crm" onClick={() => csvInputRef.current?.click()}>
        <Upload className="h-4 w-4" />
        Importar
      </Button>
      <Button variant="outline" size="sm" className="gap-2" data-testid="button-exportar-crm">
        <Download className="h-4 w-4" />
        Exportar
      </Button>
      <Button size="sm" className="gap-2 bg-primary" data-testid="button-novo-contato" onClick={() => setFormModal({
        open: true,
        mode: "create"
      })}>
        <Plus className="h-4 w-4" />
        Novo Contato
      </Button>
    </>
  );

  return (
    <MainLayout title="CRM" description="Gestão de relacionamento com clientes" actions={headerActions}>
      <div className="space-y-6">

        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar por nome, email ou responsável..." className="pl-10 bg-card border-border" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} data-testid="input-search-crm" />
          </div>

          <Select value={tipoPessoaFilter} onValueChange={setTipoPessoaFilter}>
            <SelectTrigger className="w-[160px] bg-card border-border" data-testid="select-tipo-pessoa">
              <SelectValue placeholder="Tipo Pessoa" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Tipos</SelectItem>
              <SelectItem value="pessoa_fisica">Pessoa Física</SelectItem>
              <SelectItem value="pessoa_juridica">Pessoa Jurídica</SelectItem>
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px] bg-card border-border" data-testid="select-status">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Status</SelectItem>
              <SelectItem value="lead">Lead</SelectItem>
              <SelectItem value="ativo">Ativo</SelectItem>
              <SelectItem value="inativo">Inativo</SelectItem>
            </SelectContent>
          </Select>

          {hasActiveFilters && <Button variant="outline" onClick={clearFilters} data-testid="button-clear-filters">Limpar</Button>}
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <div>
                <CardTitle className="text-lg">Lista de Contatos</CardTitle>
                <CardDescription>Todos os contatos e prospects em acompanhamento</CardDescription>
              </div>
              {clientes.length > 0 && (
                <div className="flex items-center gap-2">
                  <div
                    className="w-5 h-5 rounded-full border-2 border-red-500 flex items-center justify-center cursor-pointer"
                    onClick={() => setSelectAll(!selectAll)}
                    data-testid="checkbox-select-all"
                  >
                    {selectAll && <div className="w-2.5 h-2.5 rounded-full bg-red-500" />}
                  </div>
                  <span className="text-sm text-muted-foreground flex-1">Selecionar todos</span>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {filteredClientes.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum cliente encontrado</p>
                <Button variant="outline" size="sm" className="mt-4" onClick={() => setFormModal({
                  open: true,
                  mode: "create"
                })}>
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar primeiro cliente
                </Button>
              </div>
            ) : (
              filteredClientes.map(cliente => {
                const clienteContratos = contratosPorCliente.get(cliente.id) ?? [];
                const situacao = getContratoSituacao(clienteContratos);
                return (
                  <div key={cliente.id} data-testid={`row-contato-${cliente.id}`} className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg border">
                    <div className="w-5 h-5 rounded-full border-2 border-red-500 flex items-center justify-center cursor-pointer flex-shrink-0" data-testid={`checkbox-contato-${cliente.id}`} />

                    <Avatar className="h-10 w-10 flex-shrink-0">
                      <AvatarFallback className="bg-muted-foreground/20 text-foreground text-sm">
                        {getInitials(cliente.nome)}
                      </AvatarFallback>
                    </Avatar>

                    <div className="min-w-0 w-36 flex-shrink-0">
                      <h3 className="font-semibold text-sm truncate" data-testid={`text-nome-${cliente.id}`}>{cliente.nome}</h3>
                      <div className="flex items-center gap-1 flex-wrap mt-0.5">
                        {cliente.cargo && (
                          <Badge variant="outline" className="text-[10px] py-0 no-default-hover-elevate no-default-active-elevate">{cliente.cargo}</Badge>
                        )}
                        {cliente.temperatura && (
                          <Badge className={`text-[10px] py-0 no-default-hover-elevate no-default-active-elevate ${temperaturaBadge[cliente.temperatura] || "bg-muted text-muted-foreground"}`}>
                            {cliente.temperatura}
                          </Badge>
                        )}
                        {cliente.prioridade && (
                          <Badge className={`text-[10px] py-0 no-default-hover-elevate no-default-active-elevate ${prioridadeBadge[cliente.prioridade] || "bg-muted text-muted-foreground"}`}>
                            {cliente.prioridade}
                          </Badge>
                        )}
                        <ContratoStatusBadge
                          situacao={situacao}
                          className="no-default-hover-elevate no-default-active-elevate"
                          data-testid={`badge-contrato-${cliente.id}`}
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-4 flex-1 min-w-0 text-xs text-muted-foreground">
                      {cliente.telefone && (
                        <span className="flex items-center gap-1 flex-shrink-0">
                          <Phone className="h-3 w-3" />
                          <span className="truncate">{cliente.telefone}</span>
                        </span>
                      )}
                      {cliente.email && (
                        <span className="flex items-center gap-1 min-w-0">
                          <Mail className="h-3 w-3 flex-shrink-0" />
                          <span className="truncate">{cliente.email}</span>
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-4 text-xs flex-shrink-0">
                      {cliente.empresa && (
                        <div className="text-center">
                          <p className="text-muted-foreground">Empresa</p>
                          <p className="font-medium text-foreground truncate max-w-[100px]">{cliente.empresa}</p>
                        </div>
                      )}
                      {cliente.cargo && (
                        <div className="text-center">
                          <p className="text-muted-foreground">Cargo</p>
                          <p className="font-medium text-foreground truncate max-w-[80px]">{cliente.cargo}</p>
                        </div>
                      )}
                      {cliente.cidade && (
                        <div className="text-center">
                          <p className="text-muted-foreground">Cidade</p>
                          <p className="font-medium text-foreground truncate max-w-[100px]">{cliente.cidade}/{cliente.estado}</p>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col items-center">
                      <span className="text-xs text-muted-foreground mb-1">Ações</span>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" data-testid={`button-menu-${cliente.id}`}>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem data-testid={`button-ver-${cliente.id}`} onClick={() => setViewModal({ open: true, cliente })}>
                          <Eye className="h-4 w-4 mr-2" />
                          Ver
                        </DropdownMenuItem>
                        <DropdownMenuItem data-testid={`button-editar-${cliente.id}`} onClick={() => setFormModal({ open: true, mode: "edit", cliente })}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem data-testid={`button-excluir-${cliente.id}`} className="text-destructive" onClick={() => setDeleteModal({ open: true, cliente })}>
                          <Trash2 className="h-4 w-4 mr-2" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      <CRMFormModal 
        open={formModal.open} 
        onOpenChange={open => setFormModal({ ...formModal, open })} 
        cliente={formModal.cliente as any} 
        mode={formModal.mode} 
      />

      <CRMViewModal 
        open={viewModal.open} 
        onOpenChange={open => setViewModal({ ...viewModal, open })} 
        cliente={viewModal.cliente as any} 
      />

      <DeleteConfirmModal 
        open={deleteModal.open} 
        onOpenChange={open => setDeleteModal({ ...deleteModal, open })} 
        title="Excluir Cliente" 
        description="Tem certeza que deseja excluir este cliente? Esta ação não pode ser desfeita." 
        onConfirm={handleDelete} 
      />
    </MainLayout>
  );
}
