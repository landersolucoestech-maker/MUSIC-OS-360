// ============================================================================
// AdminSubscriptions — customer subscription management (admin panel).
// Central subscriptions source: status lookup, charge history, cancellations
// and renewals. Real and live-wired via adminBillingService
// (GET/POST /billing/admin/**) -- NOT mock mode. billing.service.ts actively
// rejects any STRIPE_SECRET_KEY that is not a TEST key; the real mode is shown
// in the header via GET /billing/admin/stripe-mode (badge following the
// ENV_BADGE pattern — find-340abf0b / Gotcha #20).
// ============================================================================

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AdminLayout } from "../layouts/AdminLayout";
import { ListSectionHeader } from "@/shared/components/ListSectionHeader";
import { Badge, type BadgeVariant } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/shared/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/shared/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/shared/ui/table";
import { TablePagination } from "@/shared/ui/table-pagination";
import { usePagination } from "@/shared/hooks/usePagination";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import type { AdminSubscription, PlanTier, SubscriptionStatus } from "../types";
import { adminBillingService, type AdminBillingStateStatus } from "../services/admin-billing.service";
import { ENV_BADGE, STRIPE_ENV_LABEL } from "../constants/environment-badge";
import {
  Search, MoreHorizontal, XCircle, Receipt, DollarSign,
  CheckCircle2, Clock, AlertTriangle, Lock, Unlock, ShieldCheck, ShieldOff,
} from "lucide-react";

import { toUserMessage } from "@/shared/lib/errors";
function fmtBRL(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}
function fmtDate(iso?: string) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleDateString("pt-BR"); } catch { return "—"; }
}

const PLAN_LABEL: Record<PlanTier, string> = {
  starter: "Starter",
  growth: "Growth",
  pro: "Pro",
  professional: "Professional",
  enterprise: "Enterprise",
};

const STATUS_META: Record<SubscriptionStatus, { label: string; variant: BadgeVariant }> = {
  active: { label: "Ativa", variant: "success" },
  trial: { label: "Trial", variant: "info" },
  past_due: { label: "Inadimplente", variant: "warning" },
  payment_grace: { label: "Período de carência", variant: "warning" },
  read_only: { label: "Somente leitura", variant: "warning" },
  suspended: { label: "Suspensa", variant: "danger" },
  cancelled: { label: "Cancelada", variant: "danger" },
  unpaid: { label: "Não pago", variant: "danger" },
};

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: "all", label: "Todos os status" },
  { value: "active", label: "Ativas" },
  { value: "trial", label: "Trial" },
  { value: "past_due", label: "Inadimplentes" },
  { value: "payment_grace", label: "Período de carência" },
  { value: "read_only", label: "Somente leitura" },
  { value: "suspended", label: "Suspensas" },
  { value: "cancelled", label: "Canceladas" },
];

type BillingAdminAction =
  | { kind: "suspend"; sub: AdminSubscription }
  | { kind: "reactivate"; sub: AdminSubscription }
  | { kind: "override_active"; sub: AdminSubscription }
  | { kind: "override_read_only"; sub: AdminSubscription }
  | { kind: "remove_override"; sub: AdminSubscription };

function overrideUntil(days: number) {
  const until = new Date();
  until.setDate(until.getDate() + days);
  return until.toISOString();
}

function subscriptionStatusFromBilling(status: AdminBillingStateStatus): SubscriptionStatus {
  if (status === "trial") return "trial";
  if (status === "payment_grace") return "payment_grace";
  if (status === "read_only") return "read_only";
  if (status === "suspended") return "suspended";
  if (status === "cancelled") return "cancelled";
  return "active";
}

/* ─────────────── Charge history (derived mock) ─────────────── */
interface Invoice {
  id: string;
  date: string;
  amount: number;
  status: "paid" | "pending" | "failed";
}

function buildInvoices(sub: AdminSubscription): Invoice[] {
  if (sub.mrr <= 0) return [];
  const invoices: Invoice[] = [];
  const start = new Date(sub.started_at);
  const now = new Date();
  const stepMonths = sub.billing_cycle === "annual" ? 12 : 1;
  const amount = sub.billing_cycle === "annual" ? sub.mrr * 12 : sub.mrr;

  const cursor = new Date(start);
  let i = 0;
  while (cursor <= now && i < 24) {
    invoices.push({
      id: `${sub.id}-inv-${i}`,
      date: cursor.toISOString(),
      amount,
      status: "paid",
    });
    cursor.setMonth(cursor.getMonth() + stepMonths);
    i += 1;
  }
  // Current state mirrors the subscription: the latest charge is pending/failed when applicable.
  if (invoices.length > 0) {
    if (sub.status === "past_due") invoices[invoices.length - 1].status = "failed";
    else if (sub.status === "cancelled") invoices[invoices.length - 1].status = "pending";
  }
  return invoices.reverse();
}

function InvoiceStatusBadge({ status }: { status: Invoice["status"] }) {
  if (status === "paid") return <Badge variant="success" className="text-[10px] gap-1"><CheckCircle2 className="h-3 w-3" />Pago</Badge>;
  if (status === "failed") return <Badge variant="danger" className="text-[10px] gap-1"><AlertTriangle className="h-3 w-3" />Falhou</Badge>;
  return <Badge variant="warning" className="text-[10px] gap-1"><Clock className="h-3 w-3" />Pendente</Badge>;
}

/* ─────────────── Charge history dialog ─────────────── */
function BillingHistoryDialog({ sub, onClose }: { sub: AdminSubscription; onClose: () => void }) {
  const invoices = useMemo(() => buildInvoices(sub), [sub]);
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg bg-card border-border text-foreground">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground text-[15px]">
            <Receipt className="h-4 w-4 text-primary" />
            Histórico de Cobranças — {sub.tenant_name}
          </DialogTitle>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto pr-1">
          {invoices.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nenhuma cobrança registrada para esta assinatura.
            </p>
          ) : (
            <>
            <ListSectionHeader
              title="Histórico de Cobranças"
              count={invoices.length}
              description="Acompanhe faturas, valores e status de pagamento"
            />
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="text-sm">{fmtDate(inv.date)}</TableCell>
                    <TableCell className="font-sans text-sm">{fmtBRL(inv.amount)}</TableCell>
                    <TableCell className="text-right"><InvoiceStatusBadge status={inv.status} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" className="text-xs" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─────────────── Cancellation confirmation ─────────────── */
function CancelDialog({ sub, onConfirm, onClose }: { sub: AdminSubscription; onConfirm: () => void; onClose: () => void }) {
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-sm bg-card border-border text-foreground">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground text-[15px]">
            <AlertTriangle className="h-4 w-4 text-red-400" />
            Suspender workspace
          </DialogTitle>
        </DialogHeader>
        <p className="py-2 text-[13px] text-muted-foreground">
          Tem certeza que deseja suspender o workspace{" "}
          <span className="font-semibold text-foreground">{sub.tenant_name}</span>?
          O acesso ao workspace ficará bloqueado até a reativação.
        </p>
        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" className="text-xs" onClick={onClose}>Voltar</Button>
          <Button size="sm" className="gap-1.5 bg-red-600 text-xs text-white hover:bg-red-500 hover:text-white focus-visible:text-white" onClick={onConfirm} data-testid="btn-confirm-cancel-sub">
            <XCircle className="h-3.5 w-3.5" />
            Suspender workspace
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─────────────── Main page ─────────────── */
export default function AdminSubscriptions() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [historySub, setHistorySub] = useState<AdminSubscription | null>(null);
  const [cancelSub, setCancelSub] = useState<AdminSubscription | null>(null);

  const subscriptionsQuery = useQuery({
    queryKey: ["admin", "subscriptions"],
    queryFn: adminBillingService.listSubscriptions,
  });

  const stripeModeQuery = useQuery({
    queryKey: ["admin", "billing", "stripe-mode"],
    queryFn: adminBillingService.getStripeMode,
    staleTime: 5 * 60 * 1000,
  });

  const subs = subscriptionsQuery.data ?? [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return subs.filter((s) => {
      if (statusFilter !== "all" && s.status !== statusFilter) return false;
      if (q && !s.tenant_name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [subs, search, statusFilter]);

  const { page, pageSize, total, pageItems, setPage, setPageSize } = usePagination(filtered, 10);

  const kpis = useMemo(() => ({
    total: subs.length,
    ativas: subs.filter((s) => s.status === "active").length,
    inadimplentes: subs.filter((s) => ["past_due", "payment_grace", "read_only", "suspended", "unpaid"].includes(s.status)).length,
    mrr: subs.filter((s) => s.status === "active").reduce((acc, s) => acc + s.mrr, 0),
  }), [subs]);

  const billingAction = useMutation({
    mutationFn: async (action: BillingAdminAction) => {
      if (action.kind === "suspend") {
        return adminBillingService.suspendTenant(action.sub.tenant_id, "Suspensão manual pelo painel administrativo");
      }
      if (action.kind === "reactivate") {
        return adminBillingService.reactivateTenant(action.sub.tenant_id, "Reativação manual pelo painel administrativo");
      }
      if (action.kind === "override_active") {
        return adminBillingService.applyOverride(action.sub.tenant_id, {
          status: "active",
          reason: "Override manual pelo painel admin",
          until: overrideUntil(7),
        });
      }
      if (action.kind === "override_read_only") {
        return adminBillingService.applyOverride(action.sub.tenant_id, {
          status: "read_only",
          reason: "Override read-only pelo painel admin",
          until: overrideUntil(7),
        });
      }
      return adminBillingService.removeOverride(action.sub.tenant_id, "Override removido pelo painel admin");
    },
    onSuccess: (result, action) => {
      const nextStatus = subscriptionStatusFromBilling(result.status);
      queryClient.invalidateQueries({ queryKey: ["admin", "subscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "tenants"] });
      toast.success("Cobrança atualizada", {
        description: `${action.sub.tenant_name}: ${STATUS_META[nextStatus].label}`,
      });
      setCancelSub(null);
    },
    onError: (error) => {
      toast.error("Não foi possível atualizar a cobrança", {
        description: toUserMessage(error, "Verifique as permissões e o workspace e tente novamente."),
      });
    },
  });

  function confirmCancel() {
    if (!cancelSub) return;
    billingAction.mutate({ kind: "suspend", sub: cancelSub });
  }

  return (
    <AdminLayout>
      <div className="p-6 space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-foreground">Assinaturas</h1>
            <p className="text-[12px] text-muted-foreground mt-0.5">Gestão de assinaturas, cobranças, cancelamentos e renovações</p>
          </div>
          {/* find-340abf0b / Gotcha #20: real Stripe mode, coming from the backend. */}
          {stripeModeQuery.isError ? (
            <span
              className="inline-flex items-center rounded-md border border-destructive/40 bg-destructive/10 px-2.5 py-1 text-[11px] font-medium text-destructive"
              data-testid="stripe-mode-badge-error"
            >
              Modo do Stripe indisponível
            </span>
          ) : stripeModeQuery.data ? (
            <span
              className={`inline-flex items-center rounded-md border px-2.5 py-1 text-[11px] font-medium ${ENV_BADGE[stripeModeQuery.data.environment]}`}
              data-testid="stripe-mode-badge"
              data-environment={stripeModeQuery.data.environment}
            >
              {STRIPE_ENV_LABEL[stripeModeQuery.data.environment]}
            </span>
          ) : null}
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Total de Assinaturas", value: kpis.total, icon: Receipt },
            { label: "Ativas", value: kpis.ativas, icon: CheckCircle2 },
            { label: "Inadimplentes", value: kpis.inadimplentes, icon: AlertTriangle },
            { label: "MRR (ativas)", value: fmtBRL(kpis.mrr), icon: DollarSign },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl mb-3 bg-muted">
                <Icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-2xl font-bold tabular-nums text-foreground">{value}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted">
                <Lock className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-foreground">Controle de inadimplência</h2>
                <p className="mt-0.5 text-[12px] text-muted-foreground">
                  Ações administrativas de suspensão, reativação, modo somente leitura e liberação manual por workspace.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="warning" className="text-[10px]">Período de carência</Badge>
              <Badge variant="warning" className="text-[10px]">Somente leitura</Badge>
              <Badge variant="danger" className="text-[10px]">Suspenso</Badge>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar por cliente..."
              className="pl-9 h-8 text-xs bg-muted border-border text-foreground placeholder:text-muted-foreground"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              data-testid="input-search-subscriptions"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-8 text-xs w-auto min-w-[140px] bg-muted border-border text-muted-foreground" data-testid="select-sub-status">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_FILTERS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <ListSectionHeader
            title="Lista de Assinaturas"
            count={filtered.length}
            description="Acompanhe clientes, planos, ciclos, MRR e próximas cobranças"
            className="p-4"
          />
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                {["Cliente", "Plano", "Status", "Ciclo", "MRR", "Início", "Próx. Cobrança", "Método", ""].map((h, i) => (
                  <TableHead key={i} className="text-[11px] font-semibold text-muted-foreground tracking-wider whitespace-nowrap">{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {subscriptionsQuery.isLoading && (
                <TableRow>
                  <TableCell colSpan={9} className="py-10 text-center text-sm text-muted-foreground">
                    Carregando assinaturas reais...
                  </TableCell>
                </TableRow>
              )}
              {!subscriptionsQuery.isLoading && subscriptionsQuery.error && (
                <TableRow>
                  <TableCell colSpan={9} className="py-10 text-center text-sm text-red-300">
                    Não foi possível carregar as assinaturas: {toUserMessage(subscriptionsQuery.error, "erro desconhecido")}
                  </TableCell>
                </TableRow>
              )}
              {!subscriptionsQuery.isLoading && !subscriptionsQuery.error && pageItems.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="py-10 text-center text-sm text-muted-foreground">
                    Nenhuma assinatura encontrada na API.
                  </TableCell>
                </TableRow>
              )}
              {pageItems.map((s) => (
                <TableRow key={s.id} className="border-border hover:bg-muted transition-colors" data-testid={`subscription-${s.id}`}>
                  <TableCell className="font-medium text-foreground">{s.tenant_name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{PLAN_LABEL[s.plan]}</TableCell>
                  <TableCell><Badge variant={STATUS_META[s.status].variant} className="text-[10px]">{STATUS_META[s.status].label}</Badge></TableCell>
                  <TableCell className="text-sm text-muted-foreground">{s.billing_cycle === "annual" ? "Anual" : "Mensal"}</TableCell>
                  <TableCell className="font-sans text-sm text-muted-foreground">{fmtBRL(s.mrr)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{fmtDate(s.started_at)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{fmtDate(s.next_payment_at ?? s.current_period_end)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[160px] truncate">{s.payment_method}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground" data-testid={`actions-sub-${s.id}`}>
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56 bg-card border-border text-muted-foreground">
                        <DropdownMenuItem className="gap-2 text-xs cursor-pointer hover:bg-muted focus:bg-muted" onClick={() => setHistorySub(s)} data-testid={`history-sub-${s.id}`}>
                          <Receipt className="h-3.5 w-3.5 text-primary" />
                          Histórico de cobranças
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-muted" />
                        <DropdownMenuItem className="gap-2 text-xs cursor-pointer hover:bg-muted focus:bg-muted" onClick={() => !billingAction.isPending && billingAction.mutate({ kind: "reactivate", sub: s })} data-testid={`reactivate-tenant-${s.id}`}>
                          <Unlock className="h-3.5 w-3.5 text-emerald-400" />
                          Reativar workspace
                        </DropdownMenuItem>
                        <DropdownMenuItem className="gap-2 text-xs cursor-pointer hover:bg-muted focus:bg-muted" onClick={() => !billingAction.isPending && billingAction.mutate({ kind: "override_active", sub: s })} data-testid={`override-active-${s.id}`}>
                          <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                          Liberação manual ativa por 7 dias
                        </DropdownMenuItem>
                        <DropdownMenuItem className="gap-2 text-xs cursor-pointer hover:bg-muted focus:bg-muted" onClick={() => !billingAction.isPending && billingAction.mutate({ kind: "override_read_only", sub: s })} data-testid={`override-read-only-${s.id}`}>
                          <Lock className="h-3.5 w-3.5 text-yellow-400" />
                          Forcar somente leitura
                        </DropdownMenuItem>
                        <DropdownMenuItem className="gap-2 text-xs cursor-pointer hover:bg-muted focus:bg-muted" onClick={() => !billingAction.isPending && billingAction.mutate({ kind: "remove_override", sub: s })} data-testid={`remove-override-${s.id}`}>
                          <ShieldOff className="h-3.5 w-3.5 text-muted-foreground" />
                          Remover liberação manual
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-muted" />
                        <DropdownMenuItem className="gap-2 text-xs cursor-pointer text-red-400 hover:bg-red-500/10 focus:bg-red-500/10 focus:text-red-400" onClick={() => !billingAction.isPending && setCancelSub(s)} data-testid={`suspend-tenant-${s.id}`}>
                          <XCircle className="h-3.5 w-3.5" />
                          Suspender workspace
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <TablePagination
            total={total}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            itemLabel="assinaturas"
          />
        </div>
      </div>

      {historySub && <BillingHistoryDialog sub={historySub} onClose={() => setHistorySub(null)} />}
      {cancelSub && <CancelDialog sub={cancelSub} onConfirm={confirmCancel} onClose={() => setCancelSub(null)} />}
    </AdminLayout>
  );
}
