import { useState, useEffect } from "react";
import { MonthPickerField } from "@/shared/ui/month-picker-field";
import { toast } from "sonner";
import { runBulkAction, reportBulkResult } from "@/shared/hooks/useBulkAction";
import { MainLayout } from "@/shared/components/MainLayout";
import { ListSectionHeader } from "@/shared/components/ListSectionHeader";
import { Card, CardContent } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Badge, type BadgeVariant } from "@/shared/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { TablePagination } from "@/shared/ui/table-pagination";
import { useDebounce } from "@/shared/hooks/useDebounce";
import { useEntityById } from "@/shared/hooks/useEntityLookup";
import { AsyncEntityCombobox } from "@/shared/components/AsyncEntityCombobox";
import { Checkbox } from "@/shared/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import {
  Users,
  Search,
  Loader2,
  Plus,
  MoreHorizontal,
  Eye,
  Pencil,
  Trash2,
  Briefcase,
  DollarSign,
  CalendarDays,
  FileText,
  UserCheck,
  UserX,
  Palmtree,
  AlertCircle,
  CheckCircle,
  XCircle,
  Clock,
} from "lucide-react";
import { EmployeeFormModal } from "@/modules/rh/components/EmployeeFormModal";
import { PayrollFormModal } from "@/modules/rh/components/PayrollFormModal";
import { LeaveRequestFormModal } from "@/modules/rh/components/LeaveRequestFormModal";
import {
  EmployeeViewModal,
  PayrollViewModal,
  LeaveRequestViewModal,
} from "@/modules/rh/components/RHViewModals";
import { DeleteConfirmModal } from "@/shared/components/DeleteConfirmModal";
import { RequirePermission } from "@/shared/components/RequirePermission";
import { FileUpload, UploadedFile } from "@/shared/components/FileUpload";
import { EmptyState } from "@/shared/components/EmptyState";
import { UnavailableState } from "@/shared/components/UnavailableState";
import { formatCurrency, formatDate, getMonetarySemanticClass } from "@/shared/lib/format-utils";
import {
  useEmployees,
  DEPARTMENTS,
  EMPLOYEE_STATUS,
} from "@/modules/rh/hooks/useEmployees";
import type { Employee } from "@/modules/rh/hooks/useEmployees";
import { usePayroll, PAYMENT_STATUS } from "@/modules/rh/hooks/usePayroll";
import type { PayrollEntry } from "@/modules/rh/hooks/usePayroll";
import {
  useLeaveRequests,
  LEAVE_STATUS,
} from "@/modules/rh/hooks/useLeaveRequests";
import type { LeaveRequest } from "@/modules/rh/hooks/useLeaveRequests";
import {
  useEmployeesPaginated, useEmployeesStats,
  usePayrollPaginated, useLeaveRequestsPaginated,
} from "@/modules/rh/hooks/useHRPaginated";
import { useUsuarios } from "@/modules/settings/hooks/useUsuarios";
import {
  useEmployeeDocuments,
  DOCUMENT_TYPES,
} from "@/modules/rh/hooks/useEmployeeDocuments";
import type { EmployeeDocument } from "@/modules/rh/hooks/useEmployeeDocuments";
import { Label } from "@/shared/ui/label";
import { FeatureGate } from '@/shared/components/FeatureGate';
const STATUS_VARIANT_FUNCIONARIO: Record<string, BadgeVariant> = {
  active: "success",
  inactive: "neutral",
  on_vacation: "info",
  on_leave: "warning",
  terminated: "danger",
};

const STATUS_VARIANT_PAGAMENTO: Record<string, BadgeVariant> = {
  pending: "warning",
  paid: "success",
  cancelled: "neutral",
};

const STATUS_VARIANT_AUSENCIA: Record<string, BadgeVariant> = {
  pending: "warning",
  approved: "success",
  rejected: "danger",
  "em andamento": "info",
  completed: "neutral",
};

/** Resolve o nome do funcionário direto por ID (GET /hr/employees/:id) — nunca
 * escaneando a lista capada de useEmployees() (Task J). */
function FuncionarioNomeCell({ id }: { id: string | null }) {
  const { entity, isLoading } = useEntityById<Employee>("funcionarios", id);
  if (!id) return <>N/A</>;
  if (isLoading) return <>…</>;
  return <>{entity?.nome || "N/A"}</>;
}

export default function RH() {
  const {
    isLoading: loadingFuncionarios,
    deleteEmployee,
  } = useEmployees();

  const { deletePayrollEntry } = usePayroll();

  const { usuarios = [] } = useUsuarios();
  const getUsuarioNome = (userId: string | null) => {
    if (!userId) return null;
    const u = usuarios.find((u) => u.id === userId);
    return u?.full_name || u?.email || null;
  };

  const {
    updateLeaveRequest,
    deleteLeaveRequest,
  } = useLeaveRequests();

  const [activeTab, setActiveTab] = useState("funcionarios");

  const [funcSearch, setFuncSearch] = useState("");
  const [funcStatusFilter, setFuncStatusFilter] = useState("all");
  const [funcSetorFilter, setFuncSetorFilter] = useState("all");
  const [funcFormModal, setFuncFormModal] = useState<{
    open: boolean;
    mode: "create" | "edit" | "view";
    funcionario?: Employee;
  }>({ open: false, mode: "create" });
  const [funcDeleteModal, setFuncDeleteModal] = useState<{
    open: boolean;
    funcionario?: Employee;
  }>({ open: false });

  const [selectedFuncIds, setSelectedFuncIds] = useState<string[]>([]);
  const toggleSelectAllFuncs = () => {
    if (selectedFuncIds.length === filteredFuncionarios.length && filteredFuncionarios.length > 0) {
      setSelectedFuncIds([]);
    } else {
      setSelectedFuncIds(filteredFuncionarios.map((f: any) => f.id));
    }
  };
  const toggleSelectFunc = (id: string) => setSelectedFuncIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const handleBulkDeleteFuncs = async () => {
    if (selectedFuncIds.length === 0) return;
    const ids = selectedFuncIds;
    setSelectedFuncIds([]);
    const result = await runBulkAction(ids, (id) => deleteEmployee.mutateAsync(id));
    reportBulkResult(result, "excluído", "funcionário");
  };

  const [folhaSearch, setFolhaSearch] = useState("");
  const [folhaMesFilter, setFolhaMesFilter] = useState("");
  const [folhaStatusFilter, setFolhaStatusFilter] = useState("all");
  const [folhaFormModal, setFolhaFormModal] = useState<{
    open: boolean;
    mode: "create" | "edit" | "view";
    registro?: PayrollEntry;
  }>({ open: false, mode: "create" });
  const [folhaDeleteModal, setFolhaDeleteModal] = useState<{
    open: boolean;
    registro?: PayrollEntry;
  }>({ open: false });
  const [selectedFolhaIds, setSelectedFolhaIds] = useState<string[]>([]);
  const [folhaBulkDeleteModal, setFolhaBulkDeleteModal] = useState<{ open: boolean; ids: string[] }>({ open: false, ids: [] });

  const [feriasSearch, setFeriasSearch] = useState("");
  const [feriasStatusFilter, setFeriasStatusFilter] = useState("all");
  const [feriasFormModal, setFeriasFormModal] = useState<{
    open: boolean;
    mode: "create" | "edit" | "view";
    ausencia?: LeaveRequest;
  }>({ open: false, mode: "create" });
  const [feriasDeleteModal, setFeriasDeleteModal] = useState<{
    open: boolean;
    ausencia?: LeaveRequest;
  }>({ open: false });
  const [selectedFeriasIds, setSelectedFeriasIds] = useState<string[]>([]);
  const [feriasBulkDeleteModal, setFeriasBulkDeleteModal] = useState<{ open: boolean; ids: string[] }>({ open: false, ids: [] });

  const [docFuncionarioId, setDocFuncionarioId] = useState("");
  const [docTipoDocumento, setDocTipoDocumento] = useState("");
  const [docDescricao, setDocDescricao] = useState("");
  const [docDeleteModal, setDocDeleteModal] = useState<{
    open: boolean;
    documento?: EmployeeDocument;
  }>({ open: false });

  const {
    documents,
    isLoading: loadingDocs,
    addDocumento,
    deleteDocumento,
  } = useEmployeeDocuments(docFuncionarioId || undefined);

  // KPIs — agregação exata do tenant inteiro (GET /hr/employees/stats),
  // nunca calculada só sobre a página carregada (Task H).
  const { stats: funcionariosStats } = useEmployeesStats();
  const kpiCounts = {
    total: funcionariosStats.total,
    ativos: funcionariosStats.byGroup["active"] ?? 0,
    ferias: funcionariosStats.byGroup["on_vacation"] ?? 0,
    afastados: funcionariosStats.byGroup["on_leave"] ?? 0,
  };

  const debouncedFuncSearch = useDebounce(funcSearch, 300);
  const debouncedFolhaSearch = useDebounce(folhaSearch, 300);
  const debouncedFeriasSearch = useDebounce(feriasSearch, 300);

  const [funcPage, setFuncPage] = useState(0);
  const [funcPageSize, setFuncPageSize] = useState(10);
  const [folhaPage, setFolhaPage] = useState(0);
  const [folhaPageSize, setFolhaPageSize] = useState(10);
  const [feriasPage, setFeriasPage] = useState(0);
  const [feriasPageSize, setFeriasPageSize] = useState(10);

  useEffect(() => { setFuncPage(0); }, [debouncedFuncSearch, funcStatusFilter, funcSetorFilter]);
  useEffect(() => { setFolhaPage(0); }, [debouncedFolhaSearch, folhaMesFilter, folhaStatusFilter]);
  useEffect(() => { setFeriasPage(0); }, [debouncedFeriasSearch, feriasStatusFilter]);

  const {
    funcionarios: funcPageItems, total: funcTotal, isLoading: isLoadingFuncPage,
    error: funcPageError, refetch: refetchFuncPage,
  } = useEmployeesPaginated({
    page: funcPage, pageSize: funcPageSize, search: debouncedFuncSearch || undefined,
    status: funcStatusFilter !== "all" ? funcStatusFilter : undefined,
    setor: funcSetorFilter !== "all" ? funcSetorFilter : undefined,
    enabled: activeTab === "funcionarios",
  });
  const filteredFuncionarios = funcPageItems;
  const funcionariosPg = { pageItems: funcPageItems, total: funcTotal, page: funcPage, pageSize: funcPageSize, setPage: setFuncPage, setPageSize: setFuncPageSize };

  const {
    folhaPagamento: folhaPageItems, total: folhaTotal, isLoading: isLoadingFolhaPage,
    error: folhaPageError, refetch: refetchFolhaPage,
  } = usePayrollPaginated({
    page: folhaPage, pageSize: folhaPageSize, search: debouncedFolhaSearch || undefined,
    competencia: folhaMesFilter || undefined,
    status: folhaStatusFilter !== "all" ? folhaStatusFilter : undefined,
    enabled: activeTab === "folha",
  });
  const filteredFolha = folhaPageItems;
  const folhaPg = { pageItems: folhaPageItems, total: folhaTotal, page: folhaPage, pageSize: folhaPageSize, setPage: setFolhaPage, setPageSize: setFolhaPageSize };

  const {
    feriasAusencias: feriasPageItems, total: feriasTotal, isLoading: isLoadingFeriasPage,
    error: feriasPageError, refetch: refetchFeriasPage,
  } = useLeaveRequestsPaginated({
    page: feriasPage, pageSize: feriasPageSize, search: debouncedFeriasSearch || undefined,
    status: feriasStatusFilter !== "all" ? feriasStatusFilter : undefined,
    enabled: activeTab === "ferias",
  });
  const filteredFerias = feriasPageItems;
  const feriasPg = { pageItems: feriasPageItems, total: feriasTotal, page: feriasPage, pageSize: feriasPageSize, setPage: setFeriasPage, setPageSize: setFeriasPageSize };


  const handleDeleteFuncionario = () => {
    if (funcDeleteModal.funcionario) {
      deleteEmployee.mutate(funcDeleteModal.funcionario.id);
      setFuncDeleteModal({ open: false });
    }
  };

  const handleDeleteFolha = () => {
    if (folhaDeleteModal.registro) {
      deletePayrollEntry.mutate(folhaDeleteModal.registro.id);
      setFolhaDeleteModal({ open: false });
    }
  };

  const toggleSelectFolha = (id: string) => {
    setSelectedFolhaIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };

  const toggleSelectAllFolha = () => {
    const ids = filteredFolha.map((fp) => fp.id);
    const allSelected = ids.length > 0 && ids.every((id) => selectedFolhaIds.includes(id));
    setSelectedFolhaIds((current) => allSelected ? current.filter((id) => !ids.includes(id)) : Array.from(new Set([...current, ...ids])));
  };

  const handleBulkDeleteFolha = async () => {
    const ids = folhaBulkDeleteModal.ids;
    setSelectedFolhaIds((current) => current.filter((id) => !ids.includes(id)));
    setFolhaBulkDeleteModal({ open: false, ids: [] });
    const result = await runBulkAction(ids, (id) => deletePayrollEntry.mutateAsync(id));
    reportBulkResult(result, "excluído", "registro de folha");
  };

  const handleDeleteFerias = () => {
    if (feriasDeleteModal.ausencia) {
      deleteLeaveRequest.mutate(feriasDeleteModal.ausencia.id);
      setFeriasDeleteModal({ open: false });
    }
  };

  const toggleSelectFerias = (id: string) => {
    setSelectedFeriasIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };

  const toggleSelectAllFerias = () => {
    const ids = filteredFerias.map((fa) => fa.id);
    const allSelected = ids.length > 0 && ids.every((id) => selectedFeriasIds.includes(id));
    setSelectedFeriasIds((current) => allSelected ? current.filter((id) => !ids.includes(id)) : Array.from(new Set([...current, ...ids])));
  };

  const handleBulkDeleteFerias = async () => {
    const ids = feriasBulkDeleteModal.ids;
    setSelectedFeriasIds((current) => current.filter((id) => !ids.includes(id)));
    setFeriasBulkDeleteModal({ open: false, ids: [] });
    const result = await runBulkAction(ids, (id) => deleteLeaveRequest.mutateAsync(id));
    reportBulkResult(result, "excluído", "registro de férias");
  };

  const handleApproveReject = (ausencia: LeaveRequest, newStatus: string) => {
    updateLeaveRequest.mutate({
      id: ausencia.id,
      status: newStatus,
    } as any);
  };

  const handleDeleteDocumento = () => {
    if (docDeleteModal.documento) {
      deleteDocumento.mutate(docDeleteModal.documento.id);
      setDocDeleteModal({ open: false });
    }
  };

  const handleDocUploadComplete = async (files: UploadedFile[]) => {
    if (!docFuncionarioId) {
      toast.error("Selecione um funcionário primeiro");
      return;
    }
    for (const file of files) {
      try {
        await addDocumento.mutateAsync({
          funcionario_id: docFuncionarioId,
          tipo_documento: docTipoDocumento || "Outro",
          nome_arquivo: file.name,
          url_arquivo: file.url || file.path,
          descricao: docDescricao.trim() || null,
        });
      } catch {
        toast.error(`Erro ao registrar documento: ${file.name}`);
      }
    }
    setDocDescricao("");
    setDocTipoDocumento("");
  };

  return (
    <FeatureGate feature="moduleRh" featureName="Recursos Humanos">
    <>
    {loadingFuncionarios || isLoadingFuncPage ? (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </MainLayout>
    ) : (
    <MainLayout
      title="Recursos Humanos"
      description="Gestão de funcionários, folha de pagamento, férias e documentos"
      actions={
        <div className="flex items-center gap-2">
          {activeTab !== "documents" && (
            <RequirePermission module="rh" action="write">
              <Button
                size="sm"
                className="gap-2"
                onClick={
                  activeTab === "funcionarios"
                    ? () => setFuncFormModal({ open: true, mode: "create" })
                    : activeTab === "folha"
                    ? () => setFolhaFormModal({ open: true, mode: "create" })
                    : () => setFeriasFormModal({ open: true, mode: "create" })
                }
                data-testid="button-new-header"
              >
                <Plus className="h-4 w-4" />
                {activeTab === "funcionarios" ? "Novo Funcionário"
                  : activeTab === "folha" ? "Novo Registro"
                  : "Nova Ausência"}
              </Button>
            </RequirePermission>
          )}
        </div>
      }
    >
      <div className="space-y-6">
        {(funcPageError || folhaPageError || feriasPageError) && (
          <div
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 px-4 py-3"
            data-testid="rh-load-warning"
          >
            <p className="text-sm text-muted-foreground">
              Não foi possível carregar os dados de RH agora. Exibindo a página vazia.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => { refetchFuncPage(); refetchFolhaPage(); refetchFeriasPage(); }}
              className="gap-2"
              data-testid="button-retry"
            >
              <Loader2 className="h-4 w-4" />
              Tentar novamente
            </Button>
          </div>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card data-testid="kpi-total">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold" data-testid="text-kpi-total">{kpiCounts.total}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
            </CardContent>
          </Card>
          <Card data-testid="kpi-ativos">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <UserCheck className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold" data-testid="text-kpi-ativos">{kpiCounts.ativos}</p>
                <p className="text-xs text-muted-foreground">Ativos</p>
              </div>
            </CardContent>
          </Card>
          <Card data-testid="kpi-ferias">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Palmtree className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold" data-testid="text-kpi-ferias">{kpiCounts.ferias}</p>
                <p className="text-xs text-muted-foreground">Férias</p>
              </div>
            </CardContent>
          </Card>
          <Card data-testid="kpi-afastados">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-warning/10">
                <UserX className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold" data-testid="text-kpi-afastados">{kpiCounts.afastados}</p>
                <p className="text-xs text-muted-foreground">Afastados</p>
              </div>
            </CardContent>
          </Card>
        </div>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="funcionarios" className="flex items-center gap-2" data-testid="tab-funcionarios">
              <Users className="h-4 w-4" />
              Funcionários
            </TabsTrigger>
            <TabsTrigger value="folha" className="flex items-center gap-2" data-testid="tab-folha">
              <DollarSign className="h-4 w-4" />
              Folha de Pagamento
            </TabsTrigger>
            <TabsTrigger value="ferias" className="flex items-center gap-2" data-testid="tab-ferias">
              <CalendarDays className="h-4 w-4" />
              Férias e Ausências
            </TabsTrigger>
            <TabsTrigger value="documents" className="flex items-center gap-2" data-testid="tab-documents">
              <FileText className="h-4 w-4" />
              Documentos
            </TabsTrigger>
          </TabsList>
          {activeTab === "funcionarios" && (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mt-4">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome, email, cargo, CPF..."
                  value={funcSearch}
                  onChange={(e) => setFuncSearch(e.target.value)}
                  className="h-8 pl-9 text-sm bg-card border-border"
                  data-testid="input-search-funcionarios"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Select value={funcStatusFilter} onValueChange={setFuncStatusFilter}>
                  <SelectTrigger className="w-auto min-w-[140px] h-8 text-sm bg-card border-border" data-testid="select-filter-status-func">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos Status</SelectItem>
                    {EMPLOYEE_STATUS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={funcSetorFilter} onValueChange={setFuncSetorFilter}>
                  <SelectTrigger className="w-auto min-w-[140px] h-8 text-sm bg-card border-border" data-testid="select-filter-setor">
                    <SelectValue placeholder="Setor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos Setores</SelectItem>
                    {DEPARTMENTS.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          {activeTab === "folha" && (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center mt-4">
              {/* Seletor de datas — sempre imediatamente à esquerda da busca */}
              <MonthPickerField
                value={folhaMesFilter}
                onChange={setFolhaMesFilter}
                placeholder="Filtrar por mês"
                className="w-[160px] h-8 text-sm bg-card border-border shrink-0"
                data-testid="monthpicker-filter-mes-folha"
              />
              <div className="relative flex-1 min-w-[220px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Buscar por funcionário ou mês..."
                  value={folhaSearch}
                  onChange={(e) => setFolhaSearch(e.target.value)}
                  className="h-8 pl-9 text-sm bg-card border-border"
                  data-testid="input-search-folha"
                />
              </div>
              <Select value={folhaStatusFilter} onValueChange={setFolhaStatusFilter}>
                <SelectTrigger className="w-auto min-w-[140px] h-8 text-sm bg-card border-border shrink-0" data-testid="select-filter-status-folha">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos Status</SelectItem>
                  {PAYMENT_STATUS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {activeTab === "ferias" && (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mt-4">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Buscar por funcionário ou tipo..."
                  value={feriasSearch}
                  onChange={(e) => setFeriasSearch(e.target.value)}
                  className="h-8 pl-9 text-sm bg-card border-border"
                  data-testid="input-search-ferias"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Select value={feriasStatusFilter} onValueChange={setFeriasStatusFilter}>
                  <SelectTrigger className="w-auto min-w-[140px] h-8 text-sm bg-card border-border" data-testid="select-filter-status-ferias">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos Status</SelectItem>
                    {LEAVE_STATUS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <TabsContent value="funcionarios" className="mt-6 space-y-6">
            {filteredFuncionarios.length === 0 ? (
              funcPageError && funcTotal === 0 ? (
                <UnavailableState onRetry={() => refetchFuncPage()} />
              ) : (
                <EmptyState
                  icon={Users}
                  title="Nenhum funcionário encontrado"
                  description="Adicione seu primeiro funcionário para começar a gerenciar a equipe."
                  action={{
                    label: "Novo Funcionário",
                    onClick: () => setFuncFormModal({ open: true, mode: "create" }),
                  }}
                />
              )
            ) : (
              <>
              <Card>
              <CardContent className="pt-0">
              <ListSectionHeader
                title="Lista de Funcionários"
                count={funcTotal}
                description="Acompanhe funcionários, cargos, setores, vínculo, salário, status e usuário associado."
                action={
                  <div className="flex flex-wrap items-center justify-end gap-3">
                    <Checkbox
                      checked={selectedFuncIds.length === filteredFuncionarios.length && filteredFuncionarios.length > 0}
                      onCheckedChange={toggleSelectAllFuncs}
                      data-testid="checkbox-select-all-funcs"
                      aria-label="Selecionar todos"
                    />
                    <span className="text-xs text-muted-foreground">
                      {selectedFuncIds.length > 0 ? `${selectedFuncIds.length} selecionado(s)` : "Selecionar todos"}
                    </span>
                    {selectedFuncIds.length > 0 && (
                      <Button variant="destructive" size="sm" className="gap-1 h-7 text-xs" onClick={handleBulkDeleteFuncs} data-testid="button-bulk-delete-funcs">
                        <Trash2 className="h-3.5 w-3.5" />
                        Excluir ({selectedFuncIds.length})
                      </Button>
                    )}
                  </div>
                }
              />
              <Table data-testid="table-funcionarios">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[36px]"></TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Cargo</TableHead>
                    <TableHead>Setor</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Salário</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Usuário</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {funcionariosPg.pageItems.map((f) => (
                    <TableRow key={f.id} data-testid={`row-funcionario-${f.id}`} className={selectedFuncIds.includes(f.id) ? "bg-muted/20" : ""}>
                      <TableCell>
                        <Checkbox
                          checked={selectedFuncIds.includes(f.id)}
                          onCheckedChange={() => toggleSelectFunc(f.id)}
                          data-testid={`checkbox-funcionario-${f.id}`}
                          aria-label={`Selecionar ${f.nome}`}
                        />
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{f.nome}</p>
                          {f.email && <p className="text-xs text-muted-foreground">{f.email}</p>}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{f.cargo || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{f.departamento || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{f.tipo_contrato || "—"}</TableCell>
                      <TableCell className={`text-right ${getMonetarySemanticClass("neutral")}`}>{f.salario ? formatCurrency(Number(f.salario)) : "—"}</TableCell>
                      <TableCell>
                        <Badge variant={STATUS_VARIANT_FUNCIONARIO[f.status || "active"] || "neutral"}>
                          {(f.status || "active").charAt(0).toUpperCase() + (f.status || "active").slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs" data-testid={`text-usuario-vinculo-${f.id}`}>
                        {getUsuarioNome(f.vinculo_usuario_id ?? null) || "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" data-testid={`button-actions-func-${f.id}`}>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setFuncFormModal({ open: true, mode: "view", funcionario: f })} data-testid={`button-view-func-${f.id}`}>
                              <Eye className="mr-2 h-4 w-4" /> Visualizar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setFuncFormModal({ open: true, mode: "edit", funcionario: f })} data-testid={`button-edit-func-${f.id}`}>
                              <Pencil className="mr-2 h-4 w-4" /> Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive" onClick={() => setFuncDeleteModal({ open: true, funcionario: f })} data-testid={`button-delete-func-${f.id}`}>
                              <Trash2 className="mr-2 h-4 w-4" /> Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <TablePagination
                total={funcionariosPg.total}
                page={funcionariosPg.page}
                pageSize={funcionariosPg.pageSize}
                onPageChange={funcionariosPg.setPage}
                onPageSizeChange={funcionariosPg.setPageSize}
                itemLabel="funcionários"
              />
              </CardContent>
              </Card>
              </>
            )}
          </TabsContent>

          <TabsContent value="folha" className="mt-6 space-y-6">
            {isLoadingFolhaPage ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredFolha.length === 0 ? (
              folhaPageError && folhaTotal === 0 ? (
                <UnavailableState onRetry={() => refetchFolhaPage()} />
              ) : (
                <EmptyState
                  icon={DollarSign}
                  title="Nenhum registro de pagamento"
                  description="Adicione registros de folha de pagamento para controlar os salários."
                  action={{
                    label: "Novo Registro",
                    onClick: () => setFolhaFormModal({ open: true, mode: "create" }),
                  }}
                />
              )
            ) : (
              <>
              <Card>
              <CardContent className="pt-0">
              <ListSectionHeader
                title="Folha de Pagamento"
                count={folhaTotal}
                action={
                  <div className="flex flex-wrap items-center justify-end gap-3">
                    {selectedFolhaIds.length > 0 && (
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="h-8 text-xs gap-1.5"
                        onClick={() => setFolhaBulkDeleteModal({ open: true, ids: filteredFolha.filter((fp) => selectedFolhaIds.includes(fp.id)).map((fp) => fp.id) })}
                        data-testid="button-delete-selected-folha"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Excluir selecionados
                      </Button>
                    )}
                    <Checkbox
                      checked={filteredFolha.length > 0 && filteredFolha.every((fp) => selectedFolhaIds.includes(fp.id))}
                      onCheckedChange={toggleSelectAllFolha}
                      aria-label="Selecionar todos os registros de pagamento"
                      data-testid="checkbox-select-all-folha"
                    />
                    <span className="text-xs text-muted-foreground">
                      {selectedFolhaIds.length > 0 ? `${filteredFolha.filter((fp) => selectedFolhaIds.includes(fp.id)).length} selecionado(s)` : "Selecionar todos"}
                    </span>
                  </div>
                }
                description="Acompanhe salários, descontos, bônus, valores líquidos, status e datas de pagamento."
              />
              <Table data-testid="table-folha">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[36px]"></TableHead>
                    <TableHead>Funcionário</TableHead>
                    <TableHead>Mês Ref.</TableHead>
                    <TableHead className="text-right">Bruto</TableHead>
                    <TableHead className="text-right">Descontos</TableHead>
                    <TableHead className="text-right">Bônus</TableHead>
                    <TableHead className="text-right">Líquido</TableHead>
                    <TableHead>Pagamento</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {folhaPg.pageItems.map((fp) => (
                    <TableRow key={fp.id} data-testid={`row-folha-${fp.id}`}>
                      <TableCell>
                        <Checkbox
                          checked={selectedFolhaIds.includes(fp.id)}
                          onCheckedChange={() => toggleSelectFolha(fp.id)}
                          aria-label={`Selecionar registro de pagamento ${fp.id}`}
                          data-testid={`checkbox-folha-${fp.id}`}
                        />
                      </TableCell>
                      <TableCell className="font-medium"><FuncionarioNomeCell id={fp.funcionario_id ?? null} /></TableCell>
                      <TableCell className="text-muted-foreground">{fp.mes_referencia || "—"}</TableCell>
                      <TableCell className={`text-right ${getMonetarySemanticClass("neutral")}`}>{formatCurrency(Number(fp.salario_bruto) || 0)}</TableCell>
                      <TableCell className={`text-right ${getMonetarySemanticClass("negative")}`}>
                        {fp.descontos ? formatCurrency(-Number(fp.descontos)) : "—"}
                      </TableCell>
                      <TableCell className={`text-right ${getMonetarySemanticClass("neutral")}`}>
                        {fp.bonus ? `+ ${formatCurrency(Number(fp.bonus))}` : "—"}
                      </TableCell>
                      <TableCell className={`text-right font-semibold ${getMonetarySemanticClass("neutral")}`}>
                        {formatCurrency(Number(fp.salario_liquido) || 0)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{fp.data_pagamento ? formatDate(fp.data_pagamento) : "—"}</TableCell>
                      <TableCell>
                        <Badge variant={STATUS_VARIANT_PAGAMENTO[fp.status || "pending"] || "neutral"}>
                          {(fp.status || "pending").charAt(0).toUpperCase() + (fp.status || "pending").slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" data-testid={`button-actions-folha-${fp.id}`}>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setFolhaFormModal({ open: true, mode: "view", registro: fp })} data-testid={`button-view-folha-${fp.id}`}>
                              <Eye className="mr-2 h-4 w-4" /> Visualizar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setFolhaFormModal({ open: true, mode: "edit", registro: fp })} data-testid={`button-edit-folha-${fp.id}`}>
                              <Pencil className="mr-2 h-4 w-4" /> Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive" onClick={() => setFolhaDeleteModal({ open: true, registro: fp })} data-testid={`button-delete-folha-${fp.id}`}>
                              <Trash2 className="mr-2 h-4 w-4" /> Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <TablePagination
                total={folhaPg.total}
                page={folhaPg.page}
                pageSize={folhaPg.pageSize}
                onPageChange={folhaPg.setPage}
                onPageSizeChange={folhaPg.setPageSize}
                itemLabel="registros"
              />
              </CardContent>
              </Card>
              </>
            )}
          </TabsContent>

          <TabsContent value="ferias" className="mt-6 space-y-6">
            {isLoadingFeriasPage ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredFerias.length === 0 ? (
              feriasPageError && feriasTotal === 0 ? (
                <UnavailableState onRetry={() => refetchFeriasPage()} />
              ) : (
                <EmptyState
                  icon={CalendarDays}
                  title="Nenhum registro de férias/ausência"
                  description="Registre férias e ausências dos funcionários aqui."
                  action={{
                    label: "Nova Ausência",
                    onClick: () => setFeriasFormModal({ open: true, mode: "create" }),
                  }}
                />
              )
            ) : (
              <>
              <Card>
              <CardContent className="pt-0">
              <ListSectionHeader
                title="Férias e Ausências"
                count={feriasTotal}
                action={
                  <div className="flex flex-wrap items-center justify-end gap-3">
                    {selectedFeriasIds.length > 0 && (
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="h-8 text-xs gap-1.5"
                        onClick={() => setFeriasBulkDeleteModal({ open: true, ids: filteredFerias.filter((fa) => selectedFeriasIds.includes(fa.id)).map((fa) => fa.id) })}
                        data-testid="button-delete-selected-ferias"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Excluir selecionados
                      </Button>
                    )}
                    <Checkbox
                      checked={filteredFerias.length > 0 && filteredFerias.every((fa) => selectedFeriasIds.includes(fa.id))}
                      onCheckedChange={toggleSelectAllFerias}
                      aria-label="Selecionar todos os registros de ferias"
                      data-testid="checkbox-select-all-ferias"
                    />
                    <span className="text-xs text-muted-foreground">
                      {selectedFeriasIds.length > 0 ? `${filteredFerias.filter((fa) => selectedFeriasIds.includes(fa.id)).length} selecionado(s)` : "Selecionar todos"}
                    </span>
                  </div>
                }
                description="Acompanhe solicitações de férias, ausências, períodos, quantidade de dias e status de aprovação."
              />
              <Table data-testid="table-ferias">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[36px]"></TableHead>
                    <TableHead>Funcionário</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Início</TableHead>
                    <TableHead>Fim</TableHead>
                    <TableHead className="text-center">Dias</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {feriasPg.pageItems.map((fa) => (
                    <TableRow key={fa.id} data-testid={`row-ferias-${fa.id}`}>
                      <TableCell>
                        <Checkbox
                          checked={selectedFeriasIds.includes(fa.id)}
                          onCheckedChange={() => toggleSelectFerias(fa.id)}
                          aria-label={`Selecionar registro de ferias ${fa.id}`}
                          data-testid={`checkbox-ferias-${fa.id}`}
                        />
                      </TableCell>
                      <TableCell className="font-medium"><FuncionarioNomeCell id={fa.funcionario_id ?? null} /></TableCell>
                      <TableCell className="text-muted-foreground">
                        {fa.type ? fa.type.charAt(0).toUpperCase() + fa.type.slice(1) : "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{formatDate(fa.start_date)}</TableCell>
                      <TableCell className="text-muted-foreground">{formatDate(fa.end_date)}</TableCell>
                      <TableCell className="text-center">{fa.dias_totais ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant={STATUS_VARIANT_AUSENCIA[fa.status || "pending"] || "neutral"}>
                          {(fa.status || "pending").charAt(0).toUpperCase() + (fa.status || "pending").slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {fa.status === "pending" && (
                            <>
                              <Button variant="ghost" size="icon" onClick={() => handleApproveReject(fa, "approved")} title="Aprovar" data-testid={`button-approve-${fa.id}`}>
                                <CheckCircle className="h-4 w-4 text-emerald-600" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => handleApproveReject(fa, "rejected")} title="Rejeitar" data-testid={`button-reject-${fa.id}`}>
                                <XCircle className="h-4 w-4 text-destructive" />
                              </Button>
                            </>
                          )}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" data-testid={`button-actions-ferias-${fa.id}`}>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setFeriasFormModal({ open: true, mode: "view", ausencia: fa })} data-testid={`button-view-ferias-${fa.id}`}>
                                <Eye className="mr-2 h-4 w-4" /> Visualizar
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setFeriasFormModal({ open: true, mode: "edit", ausencia: fa })} data-testid={`button-edit-ferias-${fa.id}`}>
                                <Pencil className="mr-2 h-4 w-4" /> Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-destructive" onClick={() => setFeriasDeleteModal({ open: true, ausencia: fa })} data-testid={`button-delete-ferias-${fa.id}`}>
                                <Trash2 className="mr-2 h-4 w-4" /> Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <TablePagination
                total={feriasPg.total}
                page={feriasPg.page}
                pageSize={feriasPg.pageSize}
                onPageChange={feriasPg.setPage}
                onPageSizeChange={feriasPg.setPageSize}
                itemLabel="registros"
              />
              </CardContent>
              </Card>
              </>
            )}
          </TabsContent>

          <TabsContent value="documents" className="mt-6 space-y-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-2 flex-1">
                <div className="w-[250px]">
                  <AsyncEntityCombobox<Employee>
                    table="funcionarios"
                    value={docFuncionarioId || null}
                    onChange={(id) => setDocFuncionarioId(id || "")}
                    getLabel={(f) => f.nome ?? ""}
                    placeholder="Selecione um funcionário"
                    searchPlaceholder="Buscar por nome…"
                    emptyText="Nenhum funcionário encontrado"
                    data-testid="select-doc-funcionario"
                  />
                </div>
              </div>
            </div>

            {!docFuncionarioId ? (
              <EmptyState
                icon={FileText}
                title="Selecione um funcionário"
                description="Escolha um funcionário na lista acima para visualizar e gerenciar seus documentos."
              />
            ) : (
              <div className="space-y-6">
                <Card>
                  <CardContent className="p-4 space-y-4">
                    <h3 className="font-semibold text-sm" data-testid="text-upload-title">Enviar Novo Documento</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Tipo de Documento</Label>
                        <Select value={docTipoDocumento} onValueChange={setDocTipoDocumento}>
                          <SelectTrigger data-testid="select-type-documento">
                            <SelectValue placeholder="Selecione o tipo" />
                          </SelectTrigger>
                          <SelectContent>
                            {DOCUMENT_TYPES.map((t) => (
                              <SelectItem key={t} value={t}>{t}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Descrição</Label>
                        <Input
                          placeholder="Descrição opcional do documento"
                          value={docDescricao}
                          onChange={(e) => setDocDescricao(e.target.value)}
                          data-testid="input-doc-descricao"
                        />
                      </div>
                    </div>
                    <FileUpload
                      folder="documents-rh"
                      accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                      maxSize={10}
                      multiple
                      onUploadComplete={handleDocUploadComplete}
                      data-testid="file-upload-documents"
                    />
                  </CardContent>
                </Card>

                {loadingDocs ? (
                  <div className="flex items-center justify-center h-32">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (documents || []).length === 0 ? (
                  <EmptyState
                    icon={FileText}
                    title="Nenhum documento encontrado"
                    description="Envie documentos usando o formulário acima."
                  />
                ) : (
                  <Card data-testid="table-documents">
                    <CardContent className="pt-0">
                    <ListSectionHeader
                      title="Documentos"
                      count={(documents || []).length}
                      description="Acompanhe documentos de funcionários, tipos, vencimentos, anexos e status."
                    />
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Arquivo</TableHead>
                          <TableHead>Descrição</TableHead>
                          <TableHead>Data</TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(documents || []).map((doc) => (
                          <TableRow key={doc.id} data-testid={`row-documento-${doc.id}`}>
                            <TableCell>
                              <Badge variant="secondary">{doc.tipo_documento || "Outro"}</Badge>
                            </TableCell>
                            <TableCell>
                              <a
                                href={doc.url_arquivo ?? undefined}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline"
                                data-testid={`link-doc-${doc.id}`}
                              >
                                {doc.nome_arquivo}
                              </a>
                            </TableCell>
                            <TableCell className="text-muted-foreground">{doc.descricao || "-"}</TableCell>
                            <TableCell className="text-muted-foreground">{formatDate(doc.created_at)}</TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive"
                                onClick={() => setDocDeleteModal({ open: true, documento: doc })}
                                data-testid={`button-delete-doc-${doc.id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
    )}

      {/* Fora do gate de isLoading de propósito — mesmo bug de /artistas
          (Task C): EmployeeFormModal chama useEmployees() de novo só
          para as mutations, a mesma query de loadingFuncionarios acima. */}
      <EmployeeFormModal
        open={funcFormModal.open && funcFormModal.mode !== "view"}
        onOpenChange={(open) => setFuncFormModal({ ...funcFormModal, open })}
        funcionario={funcFormModal.funcionario}
        mode={funcFormModal.mode}
      />
      <EmployeeViewModal
        open={funcFormModal.open && funcFormModal.mode === "view"}
        onOpenChange={(open) => setFuncFormModal({ ...funcFormModal, open })}
        funcionario={funcFormModal.funcionario}
      />

      <PayrollFormModal
        open={folhaFormModal.open && folhaFormModal.mode !== "view"}
        onOpenChange={(open) => setFolhaFormModal({ ...folhaFormModal, open })}
        registro={folhaFormModal.registro}
        mode={folhaFormModal.mode}
      />
      <PayrollViewModal
        open={folhaFormModal.open && folhaFormModal.mode === "view"}
        onOpenChange={(open) => setFolhaFormModal({ ...folhaFormModal, open })}
        registro={folhaFormModal.registro}
      />

      <LeaveRequestFormModal
        open={feriasFormModal.open && feriasFormModal.mode !== "view"}
        onOpenChange={(open) => setFeriasFormModal({ ...feriasFormModal, open })}
        ausencia={feriasFormModal.ausencia}
        mode={feriasFormModal.mode}
      />
      <LeaveRequestViewModal
        open={feriasFormModal.open && feriasFormModal.mode === "view"}
        onOpenChange={(open) => setFeriasFormModal({ ...feriasFormModal, open })}
        ausencia={feriasFormModal.ausencia}
      />

      <DeleteConfirmModal
        open={funcDeleteModal.open}
        onOpenChange={(open) => setFuncDeleteModal({ ...funcDeleteModal, open })}
        onConfirm={handleDeleteFuncionario}
        title="Excluir Funcionário"
        description={`Tem certeza que deseja excluir "${funcDeleteModal.funcionario?.nome}"? Esta ação não pode ser desfeita.`}
      />

      <DeleteConfirmModal
        open={folhaDeleteModal.open}
        onOpenChange={(open) => setFolhaDeleteModal({ ...folhaDeleteModal, open })}
        onConfirm={handleDeleteFolha}
        title="Excluir Registro de Pagamento"
        description="Tem certeza que deseja excluir este registro de pagamento? Esta ação não pode ser desfeita."
      />

      <DeleteConfirmModal
        open={feriasDeleteModal.open}
        onOpenChange={(open) => setFeriasDeleteModal({ ...feriasDeleteModal, open })}
        onConfirm={handleDeleteFerias}
        title="Excluir Registro de Ausência"
        description="Tem certeza que deseja excluir este registro de férias/ausência? Esta ação não pode ser desfeita."
      />

      <DeleteConfirmModal
        open={folhaBulkDeleteModal.open}
        onOpenChange={(open) => setFolhaBulkDeleteModal({ ...folhaBulkDeleteModal, open })}
        onConfirm={handleBulkDeleteFolha}
        title="Excluir registros de pagamento"
        description={`Tem certeza que deseja excluir ${folhaBulkDeleteModal.ids.length} registro(s) selecionado(s)? Esta acao nao pode ser desfeita.`}
      />

      <DeleteConfirmModal
        open={feriasBulkDeleteModal.open}
        onOpenChange={(open) => setFeriasBulkDeleteModal({ ...feriasBulkDeleteModal, open })}
        onConfirm={handleBulkDeleteFerias}
        title="Excluir registros de férias e ausências"
        description={`Tem certeza que deseja excluir ${feriasBulkDeleteModal.ids.length} registro(s) selecionado(s)? Esta acao nao pode ser desfeita.`}
      />

      <DeleteConfirmModal
        open={docDeleteModal.open}
        onOpenChange={(open) => setDocDeleteModal({ ...docDeleteModal, open })}
        onConfirm={handleDeleteDocumento}
        title="Excluir Documento"
        description={`Tem certeza que deseja excluir o documento "${docDeleteModal.documento?.nome_arquivo}"? Esta ação não pode ser desfeita.`}
      />
    </>
    </FeatureGate>
  );
}
