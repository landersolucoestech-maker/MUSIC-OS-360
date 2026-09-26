import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AdminLayout } from "../layouts/AdminLayout";
import { ListSectionHeader } from "@/shared/components/ListSectionHeader";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { TablePagination } from "@/shared/ui/table-pagination";
import { usePagination } from "@/shared/hooks/usePagination";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/shared/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/shared/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { cn } from "@/shared/lib/utils";
import { adminBillingService } from "../services/admin-billing.service";
import { adminTenantsService } from "../services/admin-tenants.service";
import type { AdminTenant, TenantStatus, PlanTier } from "../types";
import {
  Building2, Search, Users, DollarSign,
  MoreHorizontal, Eye, PowerOff, ArrowUpCircle,
  RefreshCw, ExternalLink, Calendar, CreditCard, Pencil, Trash2,
} from "lucide-react";

import { toUserMessage } from "@/shared/lib/errors";
const STATUS_STYLE: Record<TenantStatus, string> = {
  active:    "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  suspended: "text-red-400 bg-red-500/10 border-red-500/20",
  trial:     "text-primary bg-primary/10 border-primary/20",
  cancelled: "text-muted-foreground bg-muted border-border",
  pending:   "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
  past_due:  "text-orange-400 bg-orange-500/10 border-orange-500/20",
};
const STATUS_LABEL: Record<TenantStatus, string> = {
  active: "Ativo", suspended: "Suspenso", trial: "Trial",
  cancelled: "Cancelado", pending: "Pendente", past_due: "Em atraso",
};
const PLAN_COLOR: Record<PlanTier, string> = {
  starter:    "text-muted-foreground",
  growth:     "text-primary",
  pro:        "text-primary",
  professional: "text-primary",
  enterprise: "text-amber-400",
};

function fmt(n: number) { return n.toLocaleString("pt-BR"); }
function fmtBRL(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

function StorageBar({ used, limit }: { used: number; limit: number }) {
  const pct = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-1 w-16 rounded-full bg-muted overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", pct > 80 ? "bg-red-500" : pct > 60 ? "bg-yellow-500" : "bg-primary")}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[10px] text-muted-foreground">{pct.toFixed(0)}%</span>
    </div>
  );
}

const CYCLE_LABEL: Record<string, string> = { monthly: "Mensal", annual: "Anual" };

export default function AdminClients() {
  const queryClient = useQueryClient();
  const [search, setSearch]         = useState("");
  const [statusFilter, setStatus]   = useState("all");
  const [planFilter, setPlan]       = useState("all");
  const [selected, setSelected]     = useState<AdminTenant | null>(null);
  const [editing, setEditing]       = useState<AdminTenant | null>(null);

  const tenantsQuery = useQuery({
    queryKey: ["admin", "tenants"],
    queryFn: adminTenantsService.list,
  });

  const subscriptionsQuery = useQuery({
    queryKey: ["admin", "subscriptions"],
    queryFn: adminBillingService.listSubscriptions,
  });

  const tenants = tenantsQuery.data ?? [];
  const subByTenant = useMemo(
    () => Object.fromEntries((subscriptionsQuery.data ?? []).map((s) => [s.tenant_id, s])),
    [subscriptionsQuery.data],
  );

  const filtered = tenants.filter((t) => {
    if (statusFilter !== "all" && t.status !== statusFilter) return false;
    if (planFilter !== "all" && t.plan !== planFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return t.name.toLowerCase().includes(q) || t.owner_email.toLowerCase().includes(q) || t.slug.includes(q);
    }
    return true;
  });

  const { page, pageSize, total, pageItems, setPage, setPageSize } = usePagination(filtered, 10);

  const saveTenantMutation = useMutation({
    mutationFn: (tenant: AdminTenant) => adminTenantsService.update(tenant.id, {
      name: tenant.name,
      owner_email: tenant.owner_email,
      slug: tenant.slug,
      country: tenant.country,
      plan: tenant.plan,
      status: tenant.status,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "tenants"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "subscriptions"] });
      toast.success("Cliente atualizado");
      setEditing(null);
    },
    onError: (error) => {
      toast.error("Nao foi possivel atualizar o cliente", {
        description: toUserMessage(error, "Verifique permissao e API."),
      });
    },
  });

  function saveEditing() {
    if (!editing) return;
    saveTenantMutation.mutate(editing);
  }

  const stats = {
    active: tenants.filter(t => t.status === "active").length,
    trial:  tenants.filter(t => t.status === "trial").length,
    susp:   tenants.filter(t => t.status === "suspended").length,
    mrr:    tenants.reduce((a, t) => a + t.mrr, 0),
  };

  const isLoading = tenantsQuery.isLoading || subscriptionsQuery.isLoading;
  const error = tenantsQuery.error ?? subscriptionsQuery.error;

  return (
    <AdminLayout>
      <div className="p-6 space-y-6 animate-fade-in">

        {/* Header */}
        <div>
          <h1 className="text-xl font-bold text-foreground">Clientes</h1>
          <p className="text-[12px] text-muted-foreground mt-0.5">Gestão global de tenants</p>
        </div>

        {/* KPI Strip */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: "Tenants Ativos",  value: fmt(stats.active), icon: Building2, color: "text-emerald-400", bg: "bg-emerald-500/10" },
            { label: "Em Trial",        value: fmt(stats.trial),  icon: RefreshCw,  color: "text-primary",    bg: "bg-primary/10" },
            { label: "Suspensos",       value: fmt(stats.susp),   icon: PowerOff,   color: "text-red-400",     bg: "bg-red-500/10" },
            { label: "MRR Total",       value: fmtBRL(stats.mrr), icon: DollarSign, color: "text-muted-foreground",    bg: "bg-muted" },
          ].map(({ label, value, icon: Icon, color, bg }) => (
            <div key={label} className="rounded-2xl border border-border bg-card p-4">
              <div className={cn("flex h-8 w-8 items-center justify-center rounded-xl mb-3", bg)}>
                <Icon className={cn("h-4 w-4", color)} />
              </div>
              <p className="text-xl font-bold text-foreground">{value}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, email ou slug..."
              className="pl-9 h-8 text-xs bg-muted border-border text-foreground placeholder:text-muted-foreground focus:border-ring"
              value={search}
              onChange={e => setSearch(e.target.value)}
              data-testid="input-search-tenants"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatus}>
            <SelectTrigger className="h-8 text-xs w-auto min-w-[140px] bg-muted border-border text-muted-foreground" data-testid="select-status">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="active">Ativos</SelectItem>
              <SelectItem value="trial">Trial</SelectItem>
              <SelectItem value="suspended">Suspensos</SelectItem>
            </SelectContent>
          </Select>
          <Select value={planFilter} onValueChange={setPlan}>
            <SelectTrigger className="h-8 text-xs w-auto min-w-[140px] bg-muted border-border text-muted-foreground" data-testid="select-plan">
              <SelectValue placeholder="Plano" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os planos</SelectItem>
              <SelectItem value="starter">Starter</SelectItem>
              <SelectItem value="growth">Growth</SelectItem>
              <SelectItem value="pro">Pro</SelectItem>
              <SelectItem value="professional">Professional</SelectItem>
              <SelectItem value="enterprise">Enterprise</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <ListSectionHeader
            title="Lista de Clientes"
            count={filtered.length}
            description="Acompanhe tenants, planos, status, cobrança e uso da plataforma"
            className="p-4"
          />
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                {["Tenant", "Plano", "Status", "Usuários", "Storage", "MRR", "Ciclo", "Próxima Cobrança", "Método", "Desde", ""].map((h, i) => (
                  <TableHead key={i} className="text-[11px] font-semibold text-muted-foreground  tracking-wider whitespace-nowrap">
                    {h}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={11} className="py-10 text-center text-sm text-muted-foreground">
                    Carregando clientes reais...
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && error && (
                <TableRow>
                  <TableCell colSpan={11} className="py-10 text-center text-sm text-red-300">
                    Nao foi possivel carregar clientes: {toUserMessage(error, "erro desconhecido")}
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && !error && pageItems.length === 0 && (
                <TableRow>
                  <TableCell colSpan={11} className="py-10 text-center text-sm text-muted-foreground">
                    Nenhum cliente encontrado na API.
                  </TableCell>
                </TableRow>
              )}
              {pageItems.map((t) => {
                const sub = subByTenant[t.id];
                return (
                  <TableRow key={t.id} className="border-border hover:bg-muted transition-colors" data-testid={`tenant-${t.id}`}>
                    <TableCell className="py-3.5">
                      <div>
                        <p className="text-[13px] font-medium text-foreground">{t.name}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{t.owner_email}</p>
                      </div>
                    </TableCell>
                    <TableCell className="py-3.5">
                      <span className={cn("text-[12px] font-semibold capitalize", PLAN_COLOR[t.plan])}>
                        {t.plan}
                      </span>
                    </TableCell>
                    <TableCell className="py-3.5">
                      <Badge variant="outline" className={cn("text-[10px] border", STATUS_STYLE[t.status])}>
                        {STATUS_LABEL[t.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-3.5">
                      <div className="flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-[12px] text-muted-foreground">{t.users_count}</span>
                      </div>
                    </TableCell>
                    <TableCell className="py-3.5">
                      <StorageBar used={t.storage_used_mb} limit={t.storage_limit_mb} />
                    </TableCell>
                    <TableCell className="py-3.5">
                      <span className="text-[13px] font-semibold text-muted-foreground">
                        {t.mrr > 0 ? fmtBRL(t.mrr) : <span className="text-muted-foreground">—</span>}
                      </span>
                    </TableCell>
                    <TableCell className="py-3.5 whitespace-nowrap">
                      <span className="text-[12px] text-muted-foreground">
                        {sub ? CYCLE_LABEL[sub.billing_cycle] ?? sub.billing_cycle : <span className="text-muted-foreground">—</span>}
                      </span>
                    </TableCell>
                    <TableCell className="py-3.5 whitespace-nowrap">
                      {sub?.next_payment_at ? (
                        <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                          <Calendar className="h-3 w-3 shrink-0" />
                          {fmtDate(sub.next_payment_at)}
                        </div>
                      ) : (
                        <span className="text-[12px] text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="py-3.5 whitespace-nowrap">
                      {sub?.payment_method && sub.payment_method !== "—" ? (
                        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          <CreditCard className="h-3 w-3 shrink-0 text-muted-foreground" />
                          <span className="truncate max-w-[130px]">{sub.payment_method}</span>
                        </div>
                      ) : (
                        <span className="text-[12px] text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="py-3.5 whitespace-nowrap">
                      <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {fmtDate(t.created_at)}
                      </div>
                    </TableCell>
                    <TableCell className="py-3.5">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                            data-testid={`actions-${t.id}`}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          className="w-40 bg-card border-border text-muted-foreground"
                        >
                          <DropdownMenuItem
                            className="gap-2 text-xs cursor-pointer hover:bg-muted focus:bg-muted"
                            onClick={() => setSelected(t)}
                            data-testid={`view-${t.id}`}
                          >
                            <Eye className="h-3.5 w-3.5 text-primary" />
                            Ver
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="gap-2 text-xs cursor-pointer hover:bg-muted focus:bg-muted"
                            onClick={() => setEditing(t)}
                            data-testid={`edit-${t.id}`}
                          >
                            <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuSeparator className="bg-muted" />
                          <DropdownMenuItem
                            className="gap-2 text-xs cursor-pointer text-red-400 hover:bg-red-500/10 focus:bg-red-500/10 focus:text-red-400"
                            onClick={() => setEditing({ ...t, status: t.status === "suspended" ? "active" : "suspended" })}
                            data-testid={`delete-${t.id}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            {t.status === "suspended" ? "Preparar reativacao" : "Preparar suspensao"}
                          </DropdownMenuItem>
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
            itemLabel="tenants"
          />
        </div>
      </div>

      {/* Detail modal */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="sm:max-w-lg bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2">
              <Building2 className="h-4.5 w-4.5 text-primary" />
              {selected?.name}
            </DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Plano", value: selected.plan, accent: PLAN_COLOR[selected.plan] },
                  { label: "Status", value: STATUS_LABEL[selected.status], accent: "" },
                  { label: "Usuários", value: fmt(selected.users_count), accent: "" },
                  { label: "Artistas", value: fmt(selected.artists_count), accent: "" },
                  { label: "MRR", value: fmtBRL(selected.mrr), accent: "text-muted-foreground" },
                  { label: "País", value: selected.country, accent: "" },
                ].map(({ label, value, accent }) => (
                  <div key={label} className="rounded-xl bg-muted border border-border p-3">
                    <p className="text-[10px] text-muted-foreground mb-1">{label}</p>
                    <p className={cn("text-[13px] font-semibold capitalize", accent || "text-muted-foreground")}>{value}</p>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="flex-1 gap-1.5 text-xs border-border text-muted-foreground hover:text-foreground" onClick={() => setSelected(null)}>
                  <ExternalLink className="h-3.5 w-3.5" /> Acessar Ambiente
                </Button>
                <Button size="sm" variant="outline" className="flex-1 gap-1.5 text-xs border-border text-muted-foreground hover:text-foreground" onClick={() => setSelected(null)}>
                  <ArrowUpCircle className="h-3.5 w-3.5" /> Alterar Plano
                </Button>
                <Button size="sm" variant="outline" className="gap-1.5 text-xs border-border text-muted-foreground hover:text-foreground" onClick={() => { setEditing(selected); setSelected(null); }}>
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit modal */}
      <Dialog open={!!editing} onOpenChange={() => setEditing(null)}>
        <DialogContent className="sm:max-w-lg bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2">
              <Pencil className="h-4.5 w-4.5 text-primary" />
              Editar cliente
            </DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4 pt-2">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <p className="text-[11px] font-medium text-muted-foreground">Nome do tenant</p>
                  <Input
                    value={editing.name}
                    onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                    className="h-9 text-xs bg-muted border-border"
                    data-testid="input-edit-tenant-name"
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <p className="text-[11px] font-medium text-muted-foreground">Email do responsável</p>
                  <Input
                    value={editing.owner_email}
                    onChange={(e) => setEditing({ ...editing, owner_email: e.target.value })}
                    className="h-9 text-xs bg-muted border-border"
                    data-testid="input-edit-tenant-email"
                  />
                </div>
                <div className="space-y-1.5">
                  <p className="text-[11px] font-medium text-muted-foreground">Slug</p>
                  <Input
                    value={editing.slug}
                    onChange={(e) => setEditing({ ...editing, slug: e.target.value })}
                    className="h-9 text-xs bg-muted border-border"
                    data-testid="input-edit-tenant-slug"
                  />
                </div>
                <div className="space-y-1.5">
                  <p className="text-[11px] font-medium text-muted-foreground">País</p>
                  <Input
                    value={editing.country}
                    onChange={(e) => setEditing({ ...editing, country: e.target.value })}
                    className="h-9 text-xs bg-muted border-border"
                    data-testid="input-edit-tenant-country"
                  />
                </div>
                <div className="space-y-1.5">
                  <p className="text-[11px] font-medium text-muted-foreground">Plano</p>
                  <Select
                    value={editing.plan}
                    onValueChange={(value) => setEditing({ ...editing, plan: value as PlanTier })}
                  >
                    <SelectTrigger className="h-9 text-xs bg-muted border-border" data-testid="select-edit-tenant-plan">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="starter">Starter</SelectItem>
                      <SelectItem value="growth">Growth</SelectItem>
                      <SelectItem value="pro">Pro</SelectItem>
                      <SelectItem value="professional">Professional</SelectItem>
                      <SelectItem value="enterprise">Enterprise</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <p className="text-[11px] font-medium text-muted-foreground">Status</p>
                  <Select
                    value={editing.status}
                    onValueChange={(value) => setEditing({ ...editing, status: value as TenantStatus })}
                  >
                    <SelectTrigger className="h-9 text-xs bg-muted border-border" data-testid="select-edit-tenant-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Ativo</SelectItem>
                      <SelectItem value="trial">Trial</SelectItem>
                      <SelectItem value="past_due">Em atraso</SelectItem>
                      <SelectItem value="pending">Pendente</SelectItem>
                      <SelectItem value="suspended">Suspenso</SelectItem>
                      <SelectItem value="cancelled">Cancelado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter className="gap-2">
                <Button variant="outline" size="sm" className="text-xs" onClick={() => setEditing(null)}>
                  Cancelar
                </Button>
                <Button size="sm" className="text-xs gap-1.5" onClick={saveEditing} disabled={saveTenantMutation.isPending} data-testid="button-save-client-edit">
                  <Pencil className="h-3.5 w-3.5" />
                  {saveTenantMutation.isPending ? "Salvando..." : "Salvar alterações"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
