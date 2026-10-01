import { useState, useEffect } from "react";
import { LEAVE_STATUS_OPTIONS, contractTypeLabel, leaveStatusLabel, leaveTypeLabel } from "@/modules/hr/constants";
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
import { EmployeeFormModal } from "@/modules/hr/components/EmployeeFormModal";
import { PayrollFormModal } from "@/modules/hr/components/PayrollFormModal";
import { LeaveRequestFormModal } from "@/modules/hr/components/LeaveRequestFormModal";
import {
  EmployeeViewModal,
  PayrollViewModal,
  LeaveRequestViewModal,
} from "@/modules/hr/components/HRViewModals";
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
} from "@/modules/hr/hooks/useEmployees";
import type { Employee } from "@/modules/hr/hooks/useEmployees";
import { usePayroll, PAYMENT_STATUS } from "@/modules/hr/hooks/usePayroll";
import type { PayrollEntry } from "@/modules/hr/hooks/usePayroll";
import {
  useLeaveRequests,
} from "@/modules/hr/hooks/useLeaveRequests";
import type { LeaveRequest } from "@/modules/hr/hooks/useLeaveRequests";
import {
  useEmployeesPaginated, useEmployeesStats,
  usePayrollPaginated, useLeaveRequestsPaginated,
} from "@/modules/hr/hooks/useHRPaginated";
import { useUsers } from "@/modules/settings/hooks/useUsers";
import {
  useEmployeeDocuments,
  DOCUMENT_TYPES,
} from "@/modules/hr/hooks/useEmployeeDocuments";
import type { EmployeeDocument } from "@/modules/hr/hooks/useEmployeeDocuments";
import { Label } from "@/shared/ui/label";
import { FeatureGate } from '@/shared/components/FeatureGate';
import { StoredFileLink } from "@/shared/components/StoredFileLink";
const STATUS_VARIANT_EMPLOYEE: Record<string, BadgeVariant> = {
  active: "success",
  inactive: "neutral",
  on_vacation: "info",
  on_leave: "warning",
  terminated: "danger",
};

const STATUS_VARIANT_PAYMENT: Record<string, BadgeVariant> = {
  pending: "warning",
  paid: "success",
  cancelled: "neutral",
};

const LEAVE_STATUS_VARIANT: Record<string, BadgeVariant> = {
  pending: "warning",
  approved: "success",
  rejected: "danger",
  completed: "neutral",
};

/** Resolves the employee name directly by ID (GET /hr/employees/:id) — never
 * by scanning the capped list of useEmployees() (Task J). */
function EmployeeNameCell({ id }: { id: string | null }) {
  const { entity, isLoading } = useEntityById<Employee>("employees", id);
  if (!id) return <>N/A</>;
  if (isLoading) return <>…</>;
  return <>{entity?.name || "N/A"}</>;
}

export default function HR() {
  const {
    isLoading: loadingEmployees,
    deleteEmployee,
  } = useEmployees();

  const { deletePayrollEntry } = usePayroll();

  const { users: users = [] } = useUsers();
  const getUserName = (userId: string | null) => {
    if (!userId) return null;
    const u = users.find((u) => u.id === userId);
    return u?.full_name || u?.email || null;
  };

  const {
    updateLeaveRequest,
    deleteLeaveRequest,
  } = useLeaveRequests();

  const [activeTab, setActiveTab] = useState("employees");

  const [employeeSearch, setEmployeeSearch] = useState("");
  const [employeeStatusFilter, setEmployeeStatusFilter] = useState("all");
  const [employeeDepartmentFilter, setEmployeeDepartmentFilter] = useState("all");
  const [employeeFormModal, setEmployeeFormModal] = useState<{
    open: boolean;
    mode: "create" | "edit" | "view";
    employee?: Employee;
  }>({ open: false, mode: "create" });
  const [employeeDeleteModal, setEmployeeDeleteModal] = useState<{
    open: boolean;
    employee?: Employee;
  }>({ open: false });

  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  const toggleSelectAllFuncs = () => {
    if (selectedEmployeeIds.length === filteredEmployees.length && filteredEmployees.length > 0) {
      setSelectedEmployeeIds([]);
    } else {
      setSelectedEmployeeIds(filteredEmployees.map((f: any) => f.id));
    }
  };
  const toggleSelectFunc = (id: string) => setSelectedEmployeeIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const handleBulkDeleteFuncs = async () => {
    if (selectedEmployeeIds.length === 0) return;
    const ids = selectedEmployeeIds;
    setSelectedEmployeeIds([]);
    const result = await runBulkAction(ids, (id) => deleteEmployee.mutateAsync(id));
    reportBulkResult(result, "excluído", "funcionário");
  };

  const [payrollSearch, setPayrollSearch] = useState("");
  const [payrollMonthFilter, setPayrollMonthFilter] = useState("");
  const [payrollStatusFilter, setPayrollStatusFilter] = useState("all");
  const [payrollFormModal, setPayrollFormModal] = useState<{
    open: boolean;
    mode: "create" | "edit" | "view";
    record?: PayrollEntry;
  }>({ open: false, mode: "create" });
  const [payrollDeleteModal, setPayrollDeleteModal] = useState<{
    open: boolean;
    record?: PayrollEntry;
  }>({ open: false });
  const [selectedPayrollIds, setSelectedPayrollIds] = useState<string[]>([]);
  const [payrollBulkDeleteModal, setPayrollBulkDeleteModal] = useState<{ open: boolean; ids: string[] }>({ open: false, ids: [] });

  const [leaveSearch, setLeaveSearch] = useState("");
  const [leaveStatusFilter, setLeaveStatusFilter] = useState("all");
  const [leaveFormModal, setLeaveFormModal] = useState<{
    open: boolean;
    mode: "create" | "edit" | "view";
    leaveRequest?: LeaveRequest;
  }>({ open: false, mode: "create" });
  const [leaveDeleteModal, setLeaveDeleteModal] = useState<{
    open: boolean;
    leaveRequest?: LeaveRequest;
  }>({ open: false });
  const [selectedLeaveIds, setSelectedLeaveIds] = useState<string[]>([]);
  const [leaveBulkDeleteModal, setLeaveBulkDeleteModal] = useState<{ open: boolean; ids: string[] }>({ open: false, ids: [] });

  const [docEmployeeId, setDocEmployeeId] = useState("");
  const [docType, setDocType] = useState("");
  const [docDescription, setDocDescription] = useState("");
  const [docDeleteModal, setDocDeleteModal] = useState<{
    open: boolean;
    document?: EmployeeDocument;
  }>({ open: false });

  const {
    documents,
    isLoading: loadingDocs,
    addDocument,
    deleteDocument,
  } = useEmployeeDocuments(docEmployeeId || undefined);

  // KPIs — exact aggregation over the whole tenant (GET /hr/employees/stats),
  // never computed over the loaded page only (Task H).
  const { stats: employeesStats } = useEmployeesStats();
  const kpiCounts = {
    total: employeesStats.total,
    active: employeesStats.byGroup["active"] ?? 0,
    onLeave: employeesStats.byGroup["on_vacation"] ?? 0,
    absent: employeesStats.byGroup["on_leave"] ?? 0,
  };

  const debouncedEmployeeSearch = useDebounce(employeeSearch, 300);
  const debouncedPayrollSearch = useDebounce(payrollSearch, 300);
  const debouncedLeaveSearch = useDebounce(leaveSearch, 300);

  const [employeePage, setEmployeePage] = useState(0);
  const [employeePageSize, setEmployeePageSize] = useState(10);
  const [payrollPage, setPayrollPage] = useState(0);
  const [payrollPageSize, setPayrollPageSize] = useState(10);
  const [leavePage, setLeavePage] = useState(0);
  const [leavePageSize, setLeavePageSize] = useState(10);

  useEffect(() => { setEmployeePage(0); }, [debouncedEmployeeSearch, employeeStatusFilter, employeeDepartmentFilter]);
  useEffect(() => { setPayrollPage(0); }, [debouncedPayrollSearch, payrollMonthFilter, payrollStatusFilter]);
  useEffect(() => { setLeavePage(0); }, [debouncedLeaveSearch, leaveStatusFilter]);

  const {
    employees: employeePageItems, total: employeeTotal, isLoading: isLoadingEmployeePage,
    error: employeePageError, refetch: refetchEmployeePage,
  } = useEmployeesPaginated({
    page: employeePage, pageSize: employeePageSize, search: debouncedEmployeeSearch || undefined,
    status: employeeStatusFilter !== "all" ? employeeStatusFilter : undefined,
    department: employeeDepartmentFilter !== "all" ? employeeDepartmentFilter : undefined,
    enabled: activeTab === "employees",
  });
  const filteredEmployees = employeePageItems;
  const employeesPg = { pageItems: employeePageItems, total: employeeTotal, page: employeePage, pageSize: employeePageSize, setPage: setEmployeePage, setPageSize: setEmployeePageSize };

  const {
    payrollEntries: payrollPageItems, total: totalPayroll, isLoading: isLoadingPayrollPage,
    error: payrollPageError, refetch: refetchPayrollPage,
  } = usePayrollPaginated({
    page: payrollPage, pageSize: payrollPageSize, search: debouncedPayrollSearch || undefined,
    referenceMonth: payrollMonthFilter || undefined,
    status: payrollStatusFilter !== "all" ? payrollStatusFilter : undefined,
    enabled: activeTab === "payroll",
  });
  const filteredPayroll = payrollPageItems;
  const payrollPg = { pageItems: payrollPageItems, total: totalPayroll, page: payrollPage, pageSize: payrollPageSize, setPage: setPayrollPage, setPageSize: setPayrollPageSize };

  const {
    leaveRequests: leavePageItems, total: totalLeave, isLoading: isLoadingLeavePage,
    error: leavePageError, refetch: refetchLeavePage,
  } = useLeaveRequestsPaginated({
    page: leavePage, pageSize: leavePageSize, search: debouncedLeaveSearch || undefined,
    status: leaveStatusFilter !== "all" ? leaveStatusFilter : undefined,
    enabled: activeTab === "leave",
  });
  const filteredLeave = leavePageItems;
  const leavePg = { pageItems: leavePageItems, total: totalLeave, page: leavePage, pageSize: leavePageSize, setPage: setLeavePage, setPageSize: setLeavePageSize };


  const handleDeleteEmployee = () => {
    if (employeeDeleteModal.employee) {
      deleteEmployee.mutate(employeeDeleteModal.employee.id);
      setEmployeeDeleteModal({ open: false });
    }
  };

  const handleDeletePayroll = () => {
    if (payrollDeleteModal.record) {
      deletePayrollEntry.mutate(payrollDeleteModal.record.id);
      setPayrollDeleteModal({ open: false });
    }
  };

  const toggleSelectPayroll = (id: string) => {
    setSelectedPayrollIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };

  const toggleSelectAllPayroll = () => {
    const ids = filteredPayroll.map((fp) => fp.id);
    const allSelected = ids.length > 0 && ids.every((id) => selectedPayrollIds.includes(id));
    setSelectedPayrollIds((current) => allSelected ? current.filter((id) => !ids.includes(id)) : Array.from(new Set([...current, ...ids])));
  };

  const handleBulkDeletePayroll = async () => {
    const ids = payrollBulkDeleteModal.ids;
    setSelectedPayrollIds((current) => current.filter((id) => !ids.includes(id)));
    setPayrollBulkDeleteModal({ open: false, ids: [] });
    const result = await runBulkAction(ids, (id) => deletePayrollEntry.mutateAsync(id));
    reportBulkResult(result, "excluído", "registro de folha");
  };

  const handleDeleteLeave = () => {
    if (leaveDeleteModal.leaveRequest) {
      deleteLeaveRequest.mutate(leaveDeleteModal.leaveRequest.id);
      setLeaveDeleteModal({ open: false });
    }
  };

  const toggleSelectLeave = (id: string) => {
    setSelectedLeaveIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };

  const toggleSelectAllLeave = () => {
    const ids = filteredLeave.map((fa) => fa.id);
    const allSelected = ids.length > 0 && ids.every((id) => selectedLeaveIds.includes(id));
    setSelectedLeaveIds((current) => allSelected ? current.filter((id) => !ids.includes(id)) : Array.from(new Set([...current, ...ids])));
  };

  const handleBulkDeleteLeave = async () => {
    const ids = leaveBulkDeleteModal.ids;
    setSelectedLeaveIds((current) => current.filter((id) => !ids.includes(id)));
    setLeaveBulkDeleteModal({ open: false, ids: [] });
    const result = await runBulkAction(ids, (id) => deleteLeaveRequest.mutateAsync(id));
    reportBulkResult(result, "excluído", "registro de férias");
  };

  const handleApproveReject = (leaveRequest: LeaveRequest, newStatus: string) => {
    updateLeaveRequest.mutate({
      id: leaveRequest.id,
      status: newStatus,
    } as any);
  };

  const handleDeleteDocument = () => {
    if (docDeleteModal.document) {
      deleteDocument.mutate(docDeleteModal.document.id);
      setDocDeleteModal({ open: false });
    }
  };

  const handleDocUploadComplete = async (files: UploadedFile[]) => {
    if (!docEmployeeId) {
      toast.error("Selecione um funcionário primeiro");
      return;
    }
    for (const file of files) {
      try {
        await addDocument.mutateAsync({
          funcionario_id: docEmployeeId,
          tipo_documento: docType || "Outro",
          nome_arquivo: file.name,
          url_arquivo: file.url || file.path,
          descricao: docDescription.trim() || null,
        });
      } catch {
        toast.error(`Erro ao registrar documento: ${file.name}`);
      }
    }
    setDocDescription("");
    setDocType("");
  };

  return (
    <FeatureGate feature="moduleHr" featureName="Recursos Humanos">
    <>
    {loadingEmployees || isLoadingEmployeePage ? (
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
                  activeTab === "employees"
                    ? () => setEmployeeFormModal({ open: true, mode: "create" })
                    : activeTab === "payroll"
                    ? () => setPayrollFormModal({ open: true, mode: "create" })
                    : () => setLeaveFormModal({ open: true, mode: "create" })
                }
                data-testid="button-new-header"
              >
                <Plus className="h-4 w-4" />
                {activeTab === "employees" ? "Novo Funcionário"
                  : activeTab === "payroll" ? "Novo Registro"
                  : "Nova Ausência"}
              </Button>
            </RequirePermission>
          )}
        </div>
      }
    >
      <div className="space-y-6">
        {(employeePageError || payrollPageError || leavePageError) && (
          <div
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 px-4 py-3"
            data-testid="hr-load-warning"
          >
            <p className="text-sm text-muted-foreground">
              Não foi possível carregar os dados de RH agora. Exibindo a página vazia.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => { refetchEmployeePage(); refetchPayrollPage(); refetchLeavePage(); }}
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
          <Card data-testid="kpi-active">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <UserCheck className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold" data-testid="text-kpi-active">{kpiCounts.active}</p>
                <p className="text-xs text-muted-foreground">Ativos</p>
              </div>
            </CardContent>
          </Card>
          <Card data-testid="kpi-vacation">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-info/10">
                <Palmtree className="h-5 w-5 text-info" />
              </div>
              <div>
                <p className="text-2xl font-bold" data-testid="text-kpi-vacation">{kpiCounts.onLeave}</p>
                <p className="text-xs text-muted-foreground">Férias</p>
              </div>
            </CardContent>
          </Card>
          <Card data-testid="kpi-absent">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-warning/10">
                <UserX className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold" data-testid="text-kpi-absent">{kpiCounts.absent}</p>
                <p className="text-xs text-muted-foreground">Afastados</p>
              </div>
            </CardContent>
          </Card>
        </div>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="employees" className="flex items-center gap-2" data-testid="tab-employees">
              <Users className="h-4 w-4" />
              Funcionários
            </TabsTrigger>
            <TabsTrigger value="payroll" className="flex items-center gap-2" data-testid="tab-payroll">
              <DollarSign className="h-4 w-4" />
              Folha de Pagamento
            </TabsTrigger>
            <TabsTrigger value="leave" className="flex items-center gap-2" data-testid="tab-leave">
              <CalendarDays className="h-4 w-4" />
              Férias e Ausências
            </TabsTrigger>
            <TabsTrigger value="documents" className="flex items-center gap-2" data-testid="tab-documents">
              <FileText className="h-4 w-4" />
              Documentos
            </TabsTrigger>
          </TabsList>
          {activeTab === "employees" && (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mt-4">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome, e-mail, cargo, CPF..."
                  value={employeeSearch}
                  onChange={(e) => setEmployeeSearch(e.target.value)}
                  className="h-8 pl-9 text-sm bg-card border-border"
                  data-testid="input-search-employees"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Select value={employeeStatusFilter} onValueChange={setEmployeeStatusFilter}>
                  <SelectTrigger className="w-auto min-w-[140px] h-8 text-sm bg-card border-border" data-testid="select-filter-status-employee">
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
                <Select value={employeeDepartmentFilter} onValueChange={setEmployeeDepartmentFilter}>
                  <SelectTrigger className="w-auto min-w-[140px] h-8 text-sm bg-card border-border" data-testid="select-filter-department">
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
          {activeTab === "payroll" && (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center mt-4">
              {/* Date picker — always immediately to the left of the search */}
              <MonthPickerField
                value={payrollMonthFilter}
                onChange={setPayrollMonthFilter}
                placeholder="Filtrar por mês"
                className="w-[160px] h-8 text-sm bg-card border-border shrink-0"
                data-testid="monthpicker-filter-payroll-month"
              />
              <div className="relative flex-1 min-w-[220px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Buscar por funcionário ou mês..."
                  value={payrollSearch}
                  onChange={(e) => setPayrollSearch(e.target.value)}
                  className="h-8 pl-9 text-sm bg-card border-border"
                  data-testid="input-search-payroll"
                />
              </div>
              <Select value={payrollStatusFilter} onValueChange={setPayrollStatusFilter}>
                <SelectTrigger className="w-auto min-w-[140px] h-8 text-sm bg-card border-border shrink-0" data-testid="select-filter-status-payroll">
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
          {activeTab === "leave" && (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mt-4">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Buscar por funcionário ou tipo..."
                  value={leaveSearch}
                  onChange={(e) => setLeaveSearch(e.target.value)}
                  className="h-8 pl-9 text-sm bg-card border-border"
                  data-testid="input-search-leave"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Select value={leaveStatusFilter} onValueChange={setLeaveStatusFilter}>
                  <SelectTrigger className="w-auto min-w-[140px] h-8 text-sm bg-card border-border" data-testid="select-filter-status-leave">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos Status</SelectItem>
                    {LEAVE_STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <TabsContent value="employees" className="mt-6 space-y-6">
            {filteredEmployees.length === 0 ? (
              employeePageError && employeeTotal === 0 ? (
                <UnavailableState onRetry={() => refetchEmployeePage()} />
              ) : (
                <EmptyState
                  icon={Users}
                  title="Nenhum funcionário encontrado"
                  description="Adicione seu primeiro funcionário para começar a gerenciar a equipe."
                  action={{
                    label: "Novo Funcionário",
                    onClick: () => setEmployeeFormModal({ open: true, mode: "create" }),
                  }}
                />
              )
            ) : (
              <>
              <Card>
              <CardContent className="pt-0">
              <ListSectionHeader
                title="Lista de Funcionários"
                count={employeeTotal}
                description="Acompanhe funcionários, cargos, setores, vínculo, salário, status e usuário associado."
                action={
                  <div className="flex flex-wrap items-center justify-end gap-3">
                    <Checkbox
                      checked={selectedEmployeeIds.length === filteredEmployees.length && filteredEmployees.length > 0}
                      onCheckedChange={toggleSelectAllFuncs}
                      data-testid="checkbox-select-all-employees"
                      aria-label="Selecionar todos"
                    />
                    <span className="text-xs text-muted-foreground">
                      {selectedEmployeeIds.length > 0 ? `${selectedEmployeeIds.length} selecionado(s)` : "Selecionar todos"}
                    </span>
                    {selectedEmployeeIds.length > 0 && (
                      <Button variant="destructive" size="sm" className="gap-1 h-7 text-xs" onClick={handleBulkDeleteFuncs} data-testid="button-bulk-delete-employees">
                        <Trash2 className="h-3.5 w-3.5" />
                        Excluir ({selectedEmployeeIds.length})
                      </Button>
                    )}
                  </div>
                }
              />
              <Table data-testid="table-employees">
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
                  {employeesPg.pageItems.map((f) => (
                    <TableRow key={f.id} data-testid={`row-employee-${f.id}`} className={selectedEmployeeIds.includes(f.id) ? "bg-muted/20" : ""}>
                      <TableCell>
                        <Checkbox
                          checked={selectedEmployeeIds.includes(f.id)}
                          onCheckedChange={() => toggleSelectFunc(f.id)}
                          data-testid={`checkbox-employee-${f.id}`}
                          aria-label={`Selecionar ${f.name}`}
                        />
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{f.name}</p>
                          {f.email && <p className="text-xs text-muted-foreground">{f.email}</p>}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{f.job_title || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{f.department || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{contractTypeLabel(f.contract_type as string | null)}</TableCell>
                      <TableCell className={`text-right ${getMonetarySemanticClass("neutral")}`}>{f.salary ? formatCurrency(Number(f.salary)) : "—"}</TableCell>
                      <TableCell>
                        <Badge variant={STATUS_VARIANT_EMPLOYEE[f.status || "active"] || "neutral"}>
                          {(f.status || "active").charAt(0).toUpperCase() + (f.status || "active").slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs" data-testid={`text-linked-user-${f.id}`}>
                        {getUserName(f.linked_user_id ?? null) || "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" data-testid={`button-actions-employee-${f.id}`}>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setEmployeeFormModal({ open: true, mode: "view", employee: f })} data-testid={`button-view-employee-${f.id}`}>
                              <Eye className="mr-2 h-4 w-4" /> Visualizar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setEmployeeFormModal({ open: true, mode: "edit", employee: f })} data-testid={`button-edit-employee-${f.id}`}>
                              <Pencil className="mr-2 h-4 w-4" /> Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive" onClick={() => setEmployeeDeleteModal({ open: true, employee: f })} data-testid={`button-delete-employee-${f.id}`}>
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
                total={employeesPg.total}
                page={employeesPg.page}
                pageSize={employeesPg.pageSize}
                onPageChange={employeesPg.setPage}
                onPageSizeChange={employeesPg.setPageSize}
                itemLabel="funcionários"
              />
              </CardContent>
              </Card>
              </>
            )}
          </TabsContent>

          <TabsContent value="payroll" className="mt-6 space-y-6">
            {isLoadingPayrollPage ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredPayroll.length === 0 ? (
              payrollPageError && totalPayroll === 0 ? (
                <UnavailableState onRetry={() => refetchPayrollPage()} />
              ) : (
                <EmptyState
                  icon={DollarSign}
                  title="Nenhum registro de pagamento"
                  description="Adicione registros de folha de pagamento para controlar os salários."
                  action={{
                    label: "Novo Registro",
                    onClick: () => setPayrollFormModal({ open: true, mode: "create" }),
                  }}
                />
              )
            ) : (
              <>
              <Card>
              <CardContent className="pt-0">
              <ListSectionHeader
                title="Folha de Pagamento"
                count={totalPayroll}
                action={
                  <div className="flex flex-wrap items-center justify-end gap-3">
                    {selectedPayrollIds.length > 0 && (
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="h-8 text-xs gap-1.5"
                        onClick={() => setPayrollBulkDeleteModal({ open: true, ids: filteredPayroll.filter((fp) => selectedPayrollIds.includes(fp.id)).map((fp) => fp.id) })}
                        data-testid="button-delete-selected-payroll"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Excluir selecionados
                      </Button>
                    )}
                    <Checkbox
                      checked={filteredPayroll.length > 0 && filteredPayroll.every((fp) => selectedPayrollIds.includes(fp.id))}
                      onCheckedChange={toggleSelectAllPayroll}
                      aria-label="Selecionar todos os registros de pagamento"
                      data-testid="checkbox-select-all-payroll"
                    />
                    <span className="text-xs text-muted-foreground">
                      {selectedPayrollIds.length > 0 ? `${filteredPayroll.filter((fp) => selectedPayrollIds.includes(fp.id)).length} selecionado(s)` : "Selecionar todos"}
                    </span>
                  </div>
                }
                description="Acompanhe salários, descontos, bônus, valores líquidos, status e datas de pagamento."
              />
              <Table data-testid="table-payroll">
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
                  {payrollPg.pageItems.map((fp) => (
                    <TableRow key={fp.id} data-testid={`row-payroll-${fp.id}`}>
                      <TableCell>
                        <Checkbox
                          checked={selectedPayrollIds.includes(fp.id)}
                          onCheckedChange={() => toggleSelectPayroll(fp.id)}
                          aria-label={`Selecionar registro de pagamento ${fp.id}`}
                          data-testid={`checkbox-payroll-${fp.id}`}
                        />
                      </TableCell>
                      <TableCell className="font-medium"><EmployeeNameCell id={fp.employee_id ?? null} /></TableCell>
                      <TableCell className="text-muted-foreground">{fp.reference_month || "—"}</TableCell>
                      <TableCell className={`text-right ${getMonetarySemanticClass("neutral")}`}>{formatCurrency(Number(fp.gross_salary) || 0)}</TableCell>
                      <TableCell className={`text-right ${getMonetarySemanticClass("negative")}`}>
                        {fp.deductions ? formatCurrency(-Number(fp.deductions)) : "—"}
                      </TableCell>
                      <TableCell className={`text-right ${getMonetarySemanticClass("neutral")}`}>
                        {fp.bonus ? `+ ${formatCurrency(Number(fp.bonus))}` : "—"}
                      </TableCell>
                      <TableCell className={`text-right font-semibold ${getMonetarySemanticClass("neutral")}`}>
                        {formatCurrency(Number(fp.net_salary) || 0)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{fp.payment_date ? formatDate(fp.payment_date) : "—"}</TableCell>
                      <TableCell>
                        <Badge variant={STATUS_VARIANT_PAYMENT[fp.status || "pending"] || "neutral"}>
                          {(fp.status || "pending").charAt(0).toUpperCase() + (fp.status || "pending").slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" data-testid={`button-actions-payroll-${fp.id}`}>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setPayrollFormModal({ open: true, mode: "view", record: fp })} data-testid={`button-view-payroll-${fp.id}`}>
                              <Eye className="mr-2 h-4 w-4" /> Visualizar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setPayrollFormModal({ open: true, mode: "edit", record: fp })} data-testid={`button-edit-payroll-${fp.id}`}>
                              <Pencil className="mr-2 h-4 w-4" /> Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive" onClick={() => setPayrollDeleteModal({ open: true, record: fp })} data-testid={`button-delete-payroll-${fp.id}`}>
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
                total={payrollPg.total}
                page={payrollPg.page}
                pageSize={payrollPg.pageSize}
                onPageChange={payrollPg.setPage}
                onPageSizeChange={payrollPg.setPageSize}
                itemLabel="registros"
              />
              </CardContent>
              </Card>
              </>
            )}
          </TabsContent>

          <TabsContent value="leave" className="mt-6 space-y-6">
            {isLoadingLeavePage ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredLeave.length === 0 ? (
              leavePageError && totalLeave === 0 ? (
                <UnavailableState onRetry={() => refetchLeavePage()} />
              ) : (
                <EmptyState
                  icon={CalendarDays}
                  title="Nenhum registro de férias/ausência"
                  description="Registre férias e ausências dos funcionários aqui."
                  action={{
                    label: "Nova Ausência",
                    onClick: () => setLeaveFormModal({ open: true, mode: "create" }),
                  }}
                />
              )
            ) : (
              <>
              <Card>
              <CardContent className="pt-0">
              <ListSectionHeader
                title="Férias e Ausências"
                count={totalLeave}
                action={
                  <div className="flex flex-wrap items-center justify-end gap-3">
                    {selectedLeaveIds.length > 0 && (
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="h-8 text-xs gap-1.5"
                        onClick={() => setLeaveBulkDeleteModal({ open: true, ids: filteredLeave.filter((fa) => selectedLeaveIds.includes(fa.id)).map((fa) => fa.id) })}
                        data-testid="button-delete-selected-leave"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Excluir selecionados
                      </Button>
                    )}
                    <Checkbox
                      checked={filteredLeave.length > 0 && filteredLeave.every((fa) => selectedLeaveIds.includes(fa.id))}
                      onCheckedChange={toggleSelectAllLeave}
                      aria-label="Selecionar todos os registros de férias"
                      data-testid="checkbox-select-all-leave"
                    />
                    <span className="text-xs text-muted-foreground">
                      {selectedLeaveIds.length > 0 ? `${filteredLeave.filter((fa) => selectedLeaveIds.includes(fa.id)).length} selecionado(s)` : "Selecionar todos"}
                    </span>
                  </div>
                }
                description="Acompanhe solicitações de férias, ausências, períodos, quantidade de dias e status de aprovação."
              />
              <Table data-testid="table-leave">
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
                  {leavePg.pageItems.map((fa) => (
                    <TableRow key={fa.id} data-testid={`row-leave-${fa.id}`}>
                      <TableCell>
                        <Checkbox
                          checked={selectedLeaveIds.includes(fa.id)}
                          onCheckedChange={() => toggleSelectLeave(fa.id)}
                          aria-label={`Selecionar registro de férias ${fa.id}`}
                          data-testid={`checkbox-leave-${fa.id}`}
                        />
                      </TableCell>
                      <TableCell className="font-medium"><EmployeeNameCell id={fa.employee_id ?? null} /></TableCell>
                      <TableCell className="text-muted-foreground">
                        {leaveTypeLabel(fa.type)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{formatDate(fa.start_date)}</TableCell>
                      <TableCell className="text-muted-foreground">{formatDate(fa.end_date)}</TableCell>
                      <TableCell className="text-center">{fa.total_days ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant={LEAVE_STATUS_VARIANT[fa.status || "pending"] || "neutral"}>
                          {leaveStatusLabel(fa.status || "pending")}
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
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" data-testid={`button-actions-leave-${fa.id}`}>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setLeaveFormModal({ open: true, mode: "view", leaveRequest: fa })} data-testid={`button-view-leave-${fa.id}`}>
                                <Eye className="mr-2 h-4 w-4" /> Visualizar
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setLeaveFormModal({ open: true, mode: "edit", leaveRequest: fa })} data-testid={`button-edit-leave-${fa.id}`}>
                                <Pencil className="mr-2 h-4 w-4" /> Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-destructive" onClick={() => setLeaveDeleteModal({ open: true, leaveRequest: fa })} data-testid={`button-delete-leave-${fa.id}`}>
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
                total={leavePg.total}
                page={leavePg.page}
                pageSize={leavePg.pageSize}
                onPageChange={leavePg.setPage}
                onPageSizeChange={leavePg.setPageSize}
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
                    table="employees"
                    value={docEmployeeId || null}
                    onChange={(id) => setDocEmployeeId(id || "")}
                    getLabel={(f) => f.name ?? ""}
                    placeholder="Selecione um funcionário"
                    searchPlaceholder="Buscar por nome…"
                    emptyText="Nenhum funcionário encontrado"
                    data-testid="select-doc-employee"
                  />
                </div>
              </div>
            </div>

            {!docEmployeeId ? (
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
                        <Select value={docType} onValueChange={setDocType}>
                          <SelectTrigger data-testid="select-type-document">
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
                          value={docDescription}
                          onChange={(e) => setDocDescription(e.target.value)}
                          data-testid="input-doc-description"
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
                          <TableRow key={doc.id} data-testid={`row-document-${doc.id}`}>
                            <TableCell>
                              <Badge variant="secondary">{doc.tipo_documento || "Outro"}</Badge>
                            </TableCell>
                            <TableCell>
                              <StoredFileLink url={doc.url_arquivo ?? undefined}
                                className="text-primary hover:underline"
                                data-testid={`link-doc-${doc.id}`}>
                                {doc.nome_arquivo}
                              </StoredFileLink>
                            </TableCell>
                            <TableCell className="text-muted-foreground">{doc.descricao || "-"}</TableCell>
                            <TableCell className="text-muted-foreground">{formatDate(doc.created_at)}</TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive"
                                onClick={() => setDocDeleteModal({ open: true, document: doc })}
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

      {/* Outside the isLoading gate on purpose — same bug as /artists
          (Task C): EmployeeFormModal calls useEmployees() again only
          for the mutations, the same query as loadingFuncionarios above. */}
      <EmployeeFormModal
        open={employeeFormModal.open && employeeFormModal.mode !== "view"}
        onOpenChange={(open) => setEmployeeFormModal({ ...employeeFormModal, open })}
        employee={employeeFormModal.employee}
        mode={employeeFormModal.mode}
      />
      <EmployeeViewModal
        open={employeeFormModal.open && employeeFormModal.mode === "view"}
        onOpenChange={(open) => setEmployeeFormModal({ ...employeeFormModal, open })}
        employee={employeeFormModal.employee}
      />

      <PayrollFormModal
        open={payrollFormModal.open && payrollFormModal.mode !== "view"}
        onOpenChange={(open) => setPayrollFormModal({ ...payrollFormModal, open })}
        record={payrollFormModal.record}
        mode={payrollFormModal.mode}
      />
      <PayrollViewModal
        open={payrollFormModal.open && payrollFormModal.mode === "view"}
        onOpenChange={(open) => setPayrollFormModal({ ...payrollFormModal, open })}
        record={payrollFormModal.record}
      />

      <LeaveRequestFormModal
        open={leaveFormModal.open && leaveFormModal.mode !== "view"}
        onOpenChange={(open) => setLeaveFormModal({ ...leaveFormModal, open })}
        leaveRequest={leaveFormModal.leaveRequest}
        mode={leaveFormModal.mode}
      />
      <LeaveRequestViewModal
        open={leaveFormModal.open && leaveFormModal.mode === "view"}
        onOpenChange={(open) => setLeaveFormModal({ ...leaveFormModal, open })}
        leaveRequest={leaveFormModal.leaveRequest}
      />

      <DeleteConfirmModal
        open={employeeDeleteModal.open}
        onOpenChange={(open) => setEmployeeDeleteModal({ ...employeeDeleteModal, open })}
        onConfirm={handleDeleteEmployee}
        title="Excluir Funcionário"
        description={`Tem certeza que deseja excluir "${employeeDeleteModal.employee?.name}"? Esta ação não pode ser desfeita.`}
      />

      <DeleteConfirmModal
        open={payrollDeleteModal.open}
        onOpenChange={(open) => setPayrollDeleteModal({ ...payrollDeleteModal, open })}
        onConfirm={handleDeletePayroll}
        title="Excluir Registro de Pagamento"
        description="Tem certeza que deseja excluir este registro de pagamento? Esta ação não pode ser desfeita."
      />

      <DeleteConfirmModal
        open={leaveDeleteModal.open}
        onOpenChange={(open) => setLeaveDeleteModal({ ...leaveDeleteModal, open })}
        onConfirm={handleDeleteLeave}
        title="Excluir Registro de Ausência"
        description="Tem certeza que deseja excluir este registro de férias/ausência? Esta ação não pode ser desfeita."
      />

      <DeleteConfirmModal
        open={payrollBulkDeleteModal.open}
        onOpenChange={(open) => setPayrollBulkDeleteModal({ ...payrollBulkDeleteModal, open })}
        onConfirm={handleBulkDeletePayroll}
        title="Excluir registros de pagamento"
        description={`Tem certeza que deseja excluir ${payrollBulkDeleteModal.ids.length} registro(s) selecionado(s)? Esta ação não pode ser desfeita.`}
      />

      <DeleteConfirmModal
        open={leaveBulkDeleteModal.open}
        onOpenChange={(open) => setLeaveBulkDeleteModal({ ...leaveBulkDeleteModal, open })}
        onConfirm={handleBulkDeleteLeave}
        title="Excluir registros de férias e ausências"
        description={`Tem certeza que deseja excluir ${leaveBulkDeleteModal.ids.length} registro(s) selecionado(s)? Esta ação não pode ser desfeita.`}
      />

      <DeleteConfirmModal
        open={docDeleteModal.open}
        onOpenChange={(open) => setDocDeleteModal({ ...docDeleteModal, open })}
        onConfirm={handleDeleteDocument}
        title="Excluir Documento"
        description={`Tem certeza que deseja excluir o documento "${docDeleteModal.document?.nome_arquivo}"? Esta ação não pode ser desfeita.`}
      />
    </>
    </FeatureGate>
  );
}
