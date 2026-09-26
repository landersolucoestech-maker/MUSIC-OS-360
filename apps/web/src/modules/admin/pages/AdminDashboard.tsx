import { Link } from "react-router-dom";
import { useMemo, type ComponentType } from "react";
import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "../layouts/AdminLayout";
import { Badge } from "@/shared/ui/badge";
import { cn } from "@/shared/lib/utils";
import { MetricCard } from "@/shared/components/MetricCard";
import {
  AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { adminBillingService } from "../services/admin-billing.service";
import { adminTenantsService } from "../services/admin-tenants.service";
import type { AdminTenant } from "../types";
import {
  TrendingDown, DollarSign, Users, Building2,
  AlertCircle, CheckCircle2, Zap,
  CreditCard, ChevronRight,
} from "lucide-react";

/* ── Metrics data (merged from AdminAnalytics) ── */
const PLAN_COLORS: Record<string, string> = {
  starter: "#6B7280",
  growth: "#3B82F6",
  pro: "#8B5CF6",
  professional: "#3B82F6",
  enterprise: "#F59E0B",
};
/* ─── helpers ─── */
function fmt(n: number) {
  return n.toLocaleString("pt-BR");
}
function fmtBRL(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}
type AdminKpiAccent = "primary" | "success" | "warning" | "destructive";
interface AdminKpiCardProps {
  label: string;
  value: string | number;
  description?: string;
  icon: ComponentType<{ className?: string }>;
  accent?: AdminKpiAccent;
  href?: string;
}

function AdminKpiCard({ href, ...props }: AdminKpiCardProps) {
  const card = (
    <MetricCard
      title={props.label}
      value={props.value}
      description={props.description}
      icon={props.icon}
      accent={props.accent}
      className="h-full"
    />
  );

  if (!href) return card;

  return (
    <Link
      to={href}
      className="block h-full transition-opacity hover:opacity-90"
      data-testid={`kpi-${props.label.toLowerCase().replace(/\s+/g, "-")}`}
    >
      {card}
    </Link>
  );
}
/* ─── Custom Tooltip ─── */
function ChartTooltip({ active, payload, label }: {
  active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <p className="text-[11px] text-muted-foreground mb-2">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span className="text-[12px] text-muted-foreground">{p.name}:</span>
          <span className="text-[12px] font-semibold text-foreground">{fmtBRL(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

/* ─── Main ─── */
export default function AdminDashboard() {
  const tenantsQuery = useQuery({
    queryKey: ["admin", "tenants"],
    queryFn: adminTenantsService.list,
  });
  const subscriptionsQuery = useQuery({
    queryKey: ["admin", "subscriptions"],
    queryFn: adminBillingService.listSubscriptions,
  });

  const tenants = tenantsQuery.data ?? [];
  const subscriptions = subscriptionsQuery.data ?? [];
  const recentTenants = tenants.slice(0, 5);
  // A real query failure (endpoint down) is different from "0 real
  // tenants" — without this, a network error silently rendered R$0/0
  // as if they were real KPIs, indistinguishable from an empty platform.
  const kpisUnavailable = tenantsQuery.isError || subscriptionsQuery.isError;
  const unresolvedEvents: unknown[] = [];
  const unreadNotifs: Array<{ id: string; severity: string; title: string; message: string; action_url?: string }> = [];

  const kpis = useMemo(() => {
    const activeTenants = tenants.filter((t) => t.status === "active").length;
    const trialTenants = tenants.filter((t) => t.status === "trial").length;
    const churnedTenants = tenants.filter((t) => ["cancelled", "suspended"].includes(t.status)).length;
    const totalUsers = tenants.reduce((acc, tenant) => acc + tenant.users_count, 0);
    const mrr = subscriptions
      .filter((sub) => sub.status === "active")
      .reduce((acc, sub) => acc + sub.mrr, 0);
    const arr = mrr * 12;
    const churnRate = tenants.length > 0 ? Number(((churnedTenants / tenants.length) * 100).toFixed(1)) : 0;
    return {
      mrr,
      arr,
      active_tenants: activeTenants,
      trial_tenants: trialTenants,
      total_users: totalUsers,
      churn_rate_pct: churnRate,
      churned_tenants: churnedTenants,
    };
  }, [subscriptions, tenants]);

  const revenueData = useMemo(() => {
    const month = new Date().toLocaleDateString("pt-BR", { month: "short" });
    return [{ month, mrr: kpis.mrr }];
  }, [kpis.mrr]);

  const planDistribution = useMemo(() => {
    const counts = new Map<string, number>();
    tenants.forEach((tenant) => counts.set(tenant.plan, (counts.get(tenant.plan) ?? 0) + 1));
    return Array.from(counts.entries()).map(([plan, count]) => ({
      plan,
      count,
      color: PLAN_COLORS[plan] ?? "#6B7280",
    }));
  }, [tenants]);

  const countryDistribution = useMemo(() => {
    const labels: Record<string, { label: string; flag: string }> = {
      BR: { label: "Brasil", flag: "BR" },
      PT: { label: "Portugal", flag: "PT" },
      US: { label: "EUA", flag: "US" },
    };
    const counts = new Map<string, number>();
    tenants.forEach((tenant: AdminTenant) => {
      const key = tenant.country || "Nao informado";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    return Array.from(counts.entries()).map(([country, count]) => ({
      country: labels[country]?.label ?? country,
      flag: labels[country]?.flag ?? "--",
      count,
    }));
  }, [tenants]);

  const KPI_CARDS: AdminKpiCardProps[] = kpisUnavailable ? [
    {
      label: "MRR",
      value: "Indisponível",
      description: "Falha ao carregar assinaturas — tente novamente",
      icon: DollarSign,
      accent: "destructive",
      href: "/admin/subscriptions",
    },
    {
      label: "Clientes Ativos",
      value: "Indisponível",
      description: "Falha ao carregar tenants — tente novamente",
      icon: Building2,
      accent: "destructive",
      href: "/admin/clients",
    },
    {
      label: "Usuarios Cadastrados",
      value: "Indisponível",
      description: "Falha ao carregar tenants — tente novamente",
      icon: Users,
      accent: "destructive",
      href: "/admin/clients",
    },
    {
      label: "Churn Rate",
      value: "Indisponível",
      description: "Falha ao carregar tenants — tente novamente",
      icon: TrendingDown,
      accent: "destructive",
      href: "/admin/clients",
    },
    {
      label: "Assinaturas Ativas",
      value: "Indisponível",
      description: "Falha ao carregar assinaturas — tente novamente",
      icon: CreditCard,
      accent: "destructive",
      href: "/admin/subscriptions",
    },
    {
      label: "Tenants em Atencao",
      value: "Indisponível",
      description: "Falha ao carregar tenants — tente novamente",
      icon: AlertCircle,
      accent: "destructive",
      href: "/admin/clients",
    },
  ] : [
    {
      label: "MRR",
      value: fmtBRL(kpis.mrr),
      description: `ARR: ${fmtBRL(kpis.arr)}`,
      icon: DollarSign,
      accent: "primary",
      href: "/admin/subscriptions",
    },
    {
      label: "Clientes Ativos",
      value: fmt(kpis.active_tenants),
      description: `${kpis.trial_tenants} em trial`,
      icon: Building2,
      accent: "success",
      href: "/admin/clients",
    },
    {
      label: "Usuarios Cadastrados",
      value: fmt(kpis.total_users),
      description: `${fmt(tenants.length)} tenants no total`,
      icon: Users,
      accent: "primary",
      href: "/admin/clients",
    },
    {
      label: "Churn Rate",
      value: `${kpis.churn_rate_pct}%`,
      description: `${fmt(kpis.churned_tenants)} tenants suspensos/cancelados`,
      icon: TrendingDown,
      accent: kpis.churned_tenants > 0 ? "destructive" : "success",
      href: "/admin/clients",
    },
    {
      label: "Assinaturas Ativas",
      value: fmt(subscriptions.filter((sub) => sub.status === "active").length),
      description: `${fmt(subscriptions.length)} assinaturas registradas`,
      icon: CreditCard,
      accent: "success",
      href: "/admin/subscriptions",
    },
    {
      label: "Tenants em Atencao",
      value: fmt(kpis.churned_tenants),
      description: "Suspensos ou cancelados",
      icon: AlertCircle,
      accent: kpis.churned_tenants > 0 ? "warning" : "success",
      href: "/admin/clients",
    },
  ];
  return (
    <AdminLayout>
      <div className="p-6 space-y-6 animate-fade-in">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">Painel Executivo</h1>
            <p className="text-[12px] text-muted-foreground mt-0.5">
              Visão global da plataforma — {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {unresolvedEvents.length > 0 && (
              <Link to="/admin/security">
                <Badge variant="danger" className="gap-1.5">
                  <AlertCircle className="h-3 w-3" /> {unresolvedEvents.length} alertas
                </Badge>
              </Link>
            )}
            <Badge variant="success" className="gap-1.5">
              <CheckCircle2 className="h-3 w-3" /> Sistema operacional
            </Badge>
          </div>
        </div>

        {/* KPI Grid */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {KPI_CARDS.map((kpi) => (
            <AdminKpiCard key={kpi.label} {...kpi} />
          ))}
        </div>

        {/* Charts row */}
        <div className="grid lg:grid-cols-[1fr_380px] gap-5">

          {/* MRR Evolution */}
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-[13px] font-semibold text-foreground">Evolução MRR</h2>
                <p className="text-[11px] text-muted-foreground mt-0.5">Receita recorrente mensal</p>
              </div>
              <Link to="/admin/revenue" className="flex items-center gap-1 text-[11px] text-primary hover:text-primary-hover transition-colors">
                Ver detalhes <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={revenueData}>
                <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="0" />
                <XAxis dataKey="month" tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="mrr" stroke="hsl(var(--primary))" strokeWidth={2} fill="hsl(var(--primary))" fillOpacity={0.12} name="MRR" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Distribution per plan */}
          <div className="rounded-2xl border border-border bg-card p-5">
            <h2 className="text-[13px] font-semibold text-foreground mb-4">Distribuição por Plano</h2>
            <div className="space-y-3">
              {planDistribution.map((p) => {
                const total = planDistribution.reduce((a, x) => a + x.count, 0);
                const pct   = (p.count / total * 100).toFixed(1);
                return (
                  <div key={p.plan}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[12px] font-medium" style={{ color: p.color }}>{p.plan}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-muted-foreground">{p.count} tenants</span>
                        <span className="text-[12px] font-semibold text-muted-foreground">{pct}%</span>
                      </div>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: p.color }} />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-5 border-t border-border pt-4">
              <h3 className="text-[12px] font-semibold text-foreground mb-3 flex items-center gap-2">
                <Users className="h-3.5 w-3.5 text-muted-foreground" /> Por País
              </h3>
              <div className="space-y-2">
                {[
                  { country: "Brasil",   flag: "🇧🇷", count: countryDistribution.find((c) => c.country === "Brasil")?.count ?? 0 },
                  { country: "Portugal", flag: "🇵🇹", count: countryDistribution.find((c) => c.country === "Portugal")?.count ?? 0 },
                  { country: "EUA",      flag: "🇺🇸", count: countryDistribution.find((c) => c.country === "EUA")?.count ?? 0 },
                ].filter(c => c.count > 0).map((c) => (
                  <div key={c.country} className="flex items-center justify-between">
                    <span className="text-[12px] text-muted-foreground flex items-center gap-2">
                      <span>{c.flag}</span> {c.country}
                    </span>
                    <span className="text-[12px] font-semibold text-muted-foreground">{c.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>

        {/* Bottom row */}
        <div className="grid lg:grid-cols-[1fr_340px] gap-5">

          {/* Recent tenants */}
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="text-[13px] font-semibold text-foreground">Tenants Recentes</h2>
              <Link to="/admin/clients" className="text-[11px] text-primary hover:text-primary-hover flex items-center gap-1">
                Ver todos <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <div className="divide-y divide-white/[0.04]">
              {recentTenants.map((t) => {
                const STATUS_COLOR: Record<string, string> = {
                  active: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
                  suspended: "text-red-400 bg-red-500/10 border-red-500/20",
                  trial: "text-primary bg-primary/10 border-primary/20",
                  cancelled: "text-muted-foreground bg-muted border-border",
                  pending: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
                };
                const PLAN_COLOR: Record<string, string> = {
                  starter: "text-muted-foreground",
                  growth: "text-primary",
                  pro: "text-primary",
                  enterprise: "text-amber-400",
                };
                const statusColor = STATUS_COLOR[t.status] ?? "";
                const planColor = PLAN_COLOR[t.plan] ?? "";
                return (
                  <div key={t.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-muted transition-colors" data-testid={`tenant-row-${t.id}`}>
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                        <Building2 className="h-4 w-4 text-primary/70" />
                      </div>
                      <div>
                        <p className="text-[13px] font-medium text-foreground">{t.name}</p>
                        <p className="text-[11px] text-muted-foreground">{t.users_count} usuários · {t.artists_count} artistas</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <span className={cn("text-[11px] font-semibold capitalize", planColor)}>{t.plan}</span>
                      <Badge variant="outline" className={cn("text-[10px] border h-5 px-1.5", statusColor)}>
                        {t.status === "active" ? "Ativo" : t.status === "suspended" ? "Suspenso" : t.status === "trial" ? "Trial" : t.status}
                      </Badge>
                      <span className="text-[12px] font-semibold text-muted-foreground">{fmtBRL(t.mrr)}<span className="text-[10px] text-muted-foreground">/mês</span></span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Notifications + Alerts */}
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="text-[13px] font-semibold text-foreground">Alertas</h2>
              <Link to="/admin/notifications" className="text-[11px] text-primary hover:text-primary-hover flex items-center gap-1">
                Ver todos <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <div className="divide-y divide-white/[0.04]">
              {unreadNotifs.map((n) => {
                const SV_COLOR: Record<string, string> = {
                  error: "text-red-400", warning: "text-yellow-400",
                  info: "text-primary", success: "text-emerald-400",
                };
                const SV_BG: Record<string, string> = {
                  error: "bg-red-500/10", warning: "bg-yellow-500/10",
                  info: "bg-primary/10", success: "bg-emerald-500/10",
                };
                const SV_ICON: Record<string, typeof AlertCircle> = {
                  error: AlertCircle, warning: AlertCircle,
                  info: Zap, success: CheckCircle2,
                };
                const svColor = SV_COLOR[n.severity] ?? "text-muted-foreground";
                const svBg = SV_BG[n.severity] ?? "bg-muted";
                const SvIcon = SV_ICON[n.severity] ?? AlertCircle;
                return (
                  <div key={n.id} className="flex gap-3 px-5 py-3.5 hover:bg-muted transition-colors" data-testid={`notif-${n.id}`}>
                    <div className={cn("h-7 w-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5", svBg)}>
                      <SvIcon className={cn("h-3.5 w-3.5", svColor)} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[12px] font-medium text-foreground">{n.title}</p>
                      <p className="text-[11px] text-muted-foreground leading-snug mt-0.5 line-clamp-2">{n.message}</p>
                    </div>
                  </div>
                );
              })}
              {unreadNotifs.length === 0 && (
                <div className="px-5 py-8 text-center">
                  <CheckCircle2 className="h-8 w-8 text-emerald-400/30 mx-auto mb-2" />
                  <p className="text-[12px] text-muted-foreground">Nenhum alerta pendente</p>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </AdminLayout>
  );
}
