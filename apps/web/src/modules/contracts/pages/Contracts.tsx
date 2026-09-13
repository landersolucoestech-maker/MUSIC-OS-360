import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { runBulkAction, reportBulkResult } from "@/shared/hooks/useBulkAction";
import { useNavigate } from "react-router-dom";
import { useEditQueryParam } from "@/shared/hooks/useEditQueryParam";
import { MainLayout } from "@/shared/components/MainLayout";
import { ListSectionHeader } from "@/shared/components/ListSectionHeader";
import { Card, CardContent } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Checkbox } from "@/shared/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { SigningPlatformBadge } from "@/modules/contracts/components/SigningPlatformBadge";
import {
  FileText, Clock, CheckCircle, Plus, Search,
  FileStack, Loader2, MoreHorizontal, Eye, Pencil, Trash2, X, DollarSign,
  AlertCircle, PenLine,
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/shared/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { ContractWizard } from "@/modules/contracts/components/ContractWizard";
import { ContractViewModal } from "@/modules/contracts/components/ContractViewModal";
import { DeleteConfirmModal } from "@/shared/components/DeleteConfirmModal";
import { useContracts } from "@/modules/contracts/hooks/useContracts";
import { useContractsPaginated, useContractsStats } from "@/modules/contracts/hooks/useContractsPaginated";
import { useDebounce } from "@/shared/hooks/useDebounce";
import { formatCurrency, formatDateDashes, getMonetarySemanticClass } from "@/shared/lib/format-utils";
import { formatCategoryLabel } from "@/shared/lib/category-labels";
import { EmptyState } from "@/shared/components/EmptyState";
import { UnavailableState } from "@/shared/components/UnavailableState";
import { StatusBadge } from "@/shared/components/StatusBadge";
import { MetricCard } from "@/shared/components/MetricCard";
import { TablePagination } from "@/shared/ui/table-pagination";
import { usePagination } from "@/shared/hooks/usePagination";
import { cn } from "@/shared/lib/utils";
import { RequirePermission } from "@/shared/components/RequirePermission";

export default function Contracts() {
  const navigate = useNavigate();
  const { contracts, isLoading, deleteContract, addContract } = useContracts();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [wizardOpen, setWizardOpen] = useState(false);
  const [formModal, setFormModal] = useState<{ open: boolean; mode: "create" | "edit"; contrato?: any }>({ open: false, mode: "edit" });
  const [viewModal, setViewModal] = useState<{ open: boolean; contrato?: any }>({ open: false });
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; contrato?: any }>({ open: false });

  useEditQueryParam(
    "edit",
    contracts,
    useCallback((contrato) => setFormModal({ open: true, mode: "edit", contrato }), []),
    "contracts",
  );

  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("all-type");
  const [statusFilter, setStatusFilter] = useState("all-status");
  const [platformFilter, setPlatformFilter] = useState("all-platform");
  const debouncedSearch = useDebounce(searchTerm, 300);

  const hasActiveFilters = searchTerm !== "" || typeFilter !== "all-type" || statusFilter !== "all-status" || platformFilter !== "all-platform";

  // Task H: paginação real server-side — a página muda de request (nunca
  // recorta uma lista já baixada), e volta pra página 0 quando um filtro
  // muda (senão a página 5 de um filtro que só tem 2 páginas fica presa).
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  useEffect(() => { setPage(0); }, [debouncedSearch, typeFilter, statusFilter, platformFilter]);

  const {
    contracts: pageItems,
    total,
    isLoading: isLoadingPage,
    error: pageError,
    refetch: refetchPage,
  } = useContractsPaginated({
    page,
    pageSize,
    search: debouncedSearch || undefined,
    status: statusFilter !== "all-status" ? statusFilter : undefined,
    type: typeFilter !== "all-type" ? typeFilter : undefined,
    signingPlatform: platformFilter !== "all-platform" ? platformFilter : undefined,
  });
  const filteredContratos = pageItems;

  // KPIs: contagem + soma de valor por status SOBRE O TENANT INTEIRO (não a
  // página atual) — GET /contracts/stats, agregado no banco. O bucket-mapping
  // (vigente/assinado/aguardando/análise/encerrado) é o mesmo de sempre, só
  // que agora itera sobre {status: count} (5-10 entradas) em vez da lista
  // completa de contratos.
  const { stats: contratosStats } = useContractsStats();

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredContratos.length && filteredContratos.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredContratos.map((c: any) => c.id));
    }
  };
  const toggleSelect = (id: string) =>
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    const ids = selectedIds;
    setSelectedIds([]);
    const result = await runBulkAction(ids, (id) => deleteContract.mutateAsync(id));
    reportBulkResult(result, "excluído", "contrato");
  };

  const handleClearFilters = () => {
    setSearchTerm("");
    setTypeFilter("all-type");
    setStatusFilter("all-status");
    setPlatformFilter("all-platform");
  };

  const handleDelete = () => {
    if (deleteModal.contrato) {
      deleteContract.mutate(deleteModal.contrato.id);
      setDeleteModal({ open: false });
    }
  };

  // ── KPIs de contratos: PARTIÇÃO por status → a soma dos buckets = total da lista ──
  // Cada contrato cai em EXATAMENTE um bucket (status desconhecido → "Em Análise"),
  // garantindo Total = Vigentes + Assinados + Aguardando + Em Análise + Encerrados.
  const norm = (s?: string | null) => (s ?? "").toLowerCase();
  const EM_VIGOR_STATUSES = new Set(["in_force", "active"]);
  const ASSINADO_STATUSES = new Set(["signed"]);
  const AGUARDANDO_STATUSES = new Set(["awaiting_signature", "pendente"]);
  const ENCERRADO_STATUSES = new Set(["expirado", "rescindido", "cancelled", "terminated"]);
  const bucketOf = (status?: string | null): "vigente" | "assinado" | "aguardando" | "encerrado" | "analise" => {
    const s = norm(status);
    if (EM_VIGOR_STATUSES.has(s)) return "vigente";
    if (ASSINADO_STATUSES.has(s)) return "assinado";
    if (AGUARDANDO_STATUSES.has(s)) return "aguardando";
    if (ENCERRADO_STATUSES.has(s)) return "encerrado";
    return "analise"; // draft / under_review / negociação / qualquer status desconhecido
  };

  const tally = { vigente: 0, assinado: 0, aguardando: 0, analise: 0, encerrado: 0 };
  let valorEfetivo = 0;
  for (const [status, count] of Object.entries(contratosStats.byGroup)) {
    const b = bucketOf(status);
    tally[b] += count;
    if (b === "vigente" || b === "assinado") valorEfetivo += contratosStats.sumByGroup?.[status] ?? 0;
  }
  const totalContratos = contratosStats.total;
  const today = new Date();

  return (
    <>
    {isLoading || isLoadingPage ? (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    ) : (
    <MainLayout
      title="Contratos"
      description="Gerencie contratos e documentação legal"
      actions={
        <>
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => navigate("/contratos/templates")}>
            <FileStack className="h-3.5 w-3.5" />
            Templates
          </Button>
          <RequirePermission module="contracts" action="write">
            <Button size="sm" className="h-8 text-xs gap-1.5" onClick={() => setWizardOpen(true)} data-testid="button-novo-contrato">
              <Plus className="h-3.5 w-3.5" />
              Novo Contrato
            </Button>
          </RequirePermission>
        </>
      }
    >
      <div className="space-y-6">
        {/* ── KPI Stats: partição por status (Total = soma dos 5 buckets) ── */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title="Total de Contratos"
            value={totalContratos}
            description="na base"
            icon={FileStack}
            accent="primary"
          />
          <MetricCard
            title="Vigentes"
            value={tally.vigente}
            description="em vigor"
            icon={CheckCircle}
            accent="success"
          />
          <MetricCard
            title="Assinados"
            value={tally.assinado}
            description="aguardando vigência"
            icon={PenLine}
            accent="primary"
          />
          <MetricCard
            title="Aguardando Assinatura"
            value={tally.aguardando}
            description="pendentes de assinar"
            icon={Clock}
            accent={tally.aguardando > 0 ? "warning" : "primary"}
          />
          <MetricCard
            title="Em Análise"
            value={tally.analise}
            description="rascunho / negociação"
            icon={FileText}
            accent="primary"
          />
          <MetricCard
            title="Encerrados"
            value={tally.encerrado}
            description="expirados / rescindidos / cancelados"
            icon={AlertCircle}
            accent={tally.encerrado > 0 ? "warning" : "primary"}
          />
          <MetricCard
            title="Valor Total"
            value={formatCurrency(valorEfetivo)}
            description="vigentes + assinados"
            icon={DollarSign}
            accent="primary"
          />
        </div>

        {/* ── Filter Bar ── */}
        <div className="flex flex-wrap items-center gap-3 rounded-lg bg-muted/30 p-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar por artista, type ou título…"
              className="pl-9 h-8 text-sm bg-card border-border"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-auto min-w-[140px] h-8 text-sm bg-card border-border shrink-0">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all-type">Todos os tipos</SelectItem>
              <SelectItem value="agenciamento">Agenciamento</SelectItem>
              <SelectItem value="distribuicao">Distribuição</SelectItem>
              <SelectItem value="licenciamento">Licenciamento</SelectItem>
              <SelectItem value="edicao">Edição</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-auto min-w-[140px] h-8 text-sm bg-card border-border shrink-0">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all-status">Todos os status</SelectItem>
              <SelectItem value="signed">Assinado</SelectItem>
              <SelectItem value="in_force">Vigente</SelectItem>
              <SelectItem value="active">Ativo</SelectItem>
              <SelectItem value="awaiting_signature">Aguardando Assinatura</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="draft">Rascunho</SelectItem>
              <SelectItem value="expirado">Expirado</SelectItem>
              <SelectItem value="rescindido">Rescindido</SelectItem>
              <SelectItem value="cancelled">Cancelado</SelectItem>
            </SelectContent>
          </Select>
          <Select value={platformFilter} onValueChange={setPlatformFilter}>
            <SelectTrigger className="w-auto min-w-[140px] h-8 text-sm bg-card border-border shrink-0" data-testid="select-platform-filter">
              <SelectValue placeholder="Plataforma" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all-platform">Todas as plataformas</SelectItem>
              <SelectItem value="autentique">Autentique</SelectItem>
              <SelectItem value="clicksign">Clicksign</SelectItem>
              <SelectItem value="docusign">DocuSign</SelectItem>
              <SelectItem value="none">Sem plataforma</SelectItem>
            </SelectContent>
          </Select>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" className="h-8 text-xs gap-1.5 text-muted-foreground" onClick={handleClearFilters}>
              <X className="h-3 w-3" />
              Limpar
            </Button>
          )}
          {hasActiveFilters && (
            <span className="text-xs text-muted-foreground ml-auto">
              {total} de {contratosStats.total} contratos
            </span>
          )}
        </div>

        {/* ── Table Card ── */}
        <Card>
          <CardContent className="pt-0">
            <ListSectionHeader
              title="Lista de Contratos"
              count={total}
              description="Acompanhe todos os contratos e seus vencimentos"
              action={
                <div className="flex flex-wrap items-center justify-end gap-3">
                  <Checkbox
                    checked={selectedIds.length === filteredContratos.length && filteredContratos.length > 0}
                    onCheckedChange={toggleSelectAll}
                    aria-label="Selecionar todos"
                  />
                  <span className="text-xs text-muted-foreground">
                    {selectedIds.length > 0 ? `${selectedIds.length} selecionado(s)` : "Selecionar todos"}
                  </span>
                  {selectedIds.length > 0 && (
                    <Button variant="destructive" size="sm" className="h-7 text-xs gap-1.5" onClick={handleBulkDelete} data-testid="button-bulk-delete">
                      <Trash2 className="h-3.5 w-3.5" /> Excluir ({selectedIds.length})
                    </Button>
                  )}
                </div>
              }
            />

            {filteredContratos.length > 0 ? (
              <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[36px]"></TableHead>
                    <TableHead>Título</TableHead>
                    <TableHead>Artista / Cliente</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Plataforma</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Período</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageItems.map((contrato) => {
                    const end = contrato.end_date ? new Date(contrato.end_date) : null;
                    const diff = end ? Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) : null;
                    const nearExpiry = diff !== null && diff >= 0 && diff <= 30;
                    return (
                      <TableRow key={contrato.id} data-testid={`row-contrato-${contrato.id}`}>
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.includes(contrato.id)}
                            onCheckedChange={() => toggleSelect(contrato.id)}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{contrato.title}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {contrato.artistas?.nome_artistico || contrato.clientes?.nome || "—"}
                        </TableCell>
                        <TableCell className="text-sm">{contrato.type ? formatCategoryLabel(contrato.type) : "—"}</TableCell>
                        <TableCell><SigningPlatformBadge platform={contrato.signing_platform} /></TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <StatusBadge status={contrato.status ?? ""} />
                            {nearExpiry && (
                              <span className="inline-flex items-center gap-1 text-[10px] text-warning border border-warning/20 bg-warning/10 rounded-sm px-1.5 py-0.5 font-medium">
                                <AlertCircle className="h-3 w-3" />{diff}d
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                          {formatDateDashes(contrato.start_date)} – {formatDateDashes(contrato.end_date)}
                        </TableCell>
                        <TableCell className={`text-sm ${getMonetarySemanticClass("neutral")}`}>
                          {contrato.valor ? formatCurrency(contrato.valor) : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" data-testid={`button-acoes-contrato-${contrato.id}`}>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setViewModal({ open: true, contrato })}>
                                <Eye className="h-3.5 w-3.5 mr-2" /> Ver
                              </DropdownMenuItem>
                              <RequirePermission module="contracts" action="write">
                                <DropdownMenuItem onClick={() => setFormModal({ open: true, mode: "edit", contrato })}>
                                  <Pencil className="h-3.5 w-3.5 mr-2" /> Editar
                                </DropdownMenuItem>
                              </RequirePermission>
                              <RequirePermission module="contracts" action="delete">
                                <DropdownMenuItem
                                  onClick={() => setDeleteModal({ open: true, contrato })}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <Trash2 className="h-3.5 w-3.5 mr-2" /> Excluir
                                </DropdownMenuItem>
                              </RequirePermission>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <TablePagination
                total={total}
                page={page}
                pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
                itemLabel="contratos"
              />
              </>
            ) : pageError && total === 0 ? (
              <UnavailableState onRetry={() => refetchPage()} />
            ) : (
              <EmptyState
                icon={FileText}
                title={hasActiveFilters ? "Nenhum resultado" : "Nenhum contrato cadastrado"}
                description={
                  hasActiveFilters
                    ? "Nenhum contrato corresponde aos filtros aplicados."
                    : "Comece criando seu primeiro contrato."
                }
                actionLabel={hasActiveFilters ? undefined : "Novo Contrato"}
                onAction={hasActiveFilters ? undefined : () => setWizardOpen(true)}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
    )}

      {/* Fora do gate de isLoading de propósito — mesmo bug de /artistas
          (Task C): ContractWizard chama useContracts() de novo só para as
          mutations de create/update, a mesma query do isLoading acima.
          Montá-lo só depois do isLoading virar false criava um observer
          novo nessa query; em erro (backend fora do ar), refetchOnMount
          reabria isLoading, o gate desmontava o wizard de novo — loop
          infinito de loading. Mantê-los sempre montados quebra o ciclo. */}
      <ContractViewModal
        open={viewModal.open}
        onOpenChange={(open) => setViewModal({ ...viewModal, open })}
        contrato={viewModal.contrato}
        onEdit={() => setFormModal({ open: true, mode: "edit", contrato: viewModal.contrato })}
      />
      <ContractWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
      />
      <ContractWizard
        open={formModal.open && formModal.mode === "edit"}
        onOpenChange={(open) => setFormModal({ ...formModal, open })}
        contrato={formModal.contrato}
      />
      <DeleteConfirmModal
        open={deleteModal.open}
        onOpenChange={(open) => setDeleteModal({ ...deleteModal, open })}
        title="Excluir Contrato"
        description={`Tem certeza que deseja excluir o contrato "${deleteModal.contrato?.title}"?`}
        onConfirm={handleDelete}
      />
    </>
  );
}

