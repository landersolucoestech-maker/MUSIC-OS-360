import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { MainLayout } from "@/shared/components/MainLayout";
import { transactionTypeRegisteredPtBr } from "@music-os-360/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { ScrollArea } from "@/shared/ui/scroll-area";
import {
  Users, FileText, DollarSign, Calendar, ArrowRight,
  Music, TrendingUp, AlertTriangle, Activity,
  UserCheck, Radio, Shield, Clock, ListChecks, Upload,
  ServerCrash, Layers, Disc,
} from "lucide-react";
import { Link } from "react-router-dom";
import { differenceInDays } from "date-fns";
import { useMetrics } from "../hooks/useMetrics";
import { useOperationalDashboard } from "../hooks/useOperationalDashboard";
import type { EventWithRelations } from "@/modules/events/hooks/useEvents";
import { getBackendEventTypeLabel } from "@/modules/events/lib/event-type";
import { formatCurrency } from "@/shared/lib/format-utils";
import { DashboardSkeleton } from "@/shared/components/PageSkeletons";
import { UnavailableState } from "@/shared/components/UnavailableState";
import { ArtistVision360Modal } from "@/modules/artist/components/ArtistVision360Modal";
import type { Artist } from "@/modules/artist/types/artist.types";
import { useWsEvent } from "@/shared/hooks/useWsEvent";
import { cn } from "@/shared/lib/utils";
import { useActivityHistory, type AuditLogRow } from "../hooks/useActivityHistory";
import { auditEntityMeta, describeAuditAction, describeAuditRow } from "../lib/audit-activity";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ActivityItem {
  id: string;
  icon: React.ReactNode;
  label: string;
  description: string;
  badge?: string;
  badgeVariant?: "default" | "secondary" | "outline";
  timestamp: Date;
}

const MAX_ITEMS = 30;

// ─── Upcoming appointments (Schedule) ─────────────────────────────────────────
// Official categories of the Schedule module (SchedulerFormModal). Normalizes both the
// events.type only stores the backend's coarse enum — see
// modules/events/lib/event-type.ts for the real pt-BR labels.

// Statuses that remove the event from the upcoming appointments list (past/closed).
const HIDDEN_APPOINTMENT_STATUSES = new Set([
  "cancelado", "concluido", "realizado", "arquivado",
]);

function normalizeSlug(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function appointmentCategoryLabel(type: unknown): string {
  return getBackendEventTypeLabel(typeof type === "string" ? type : undefined);
}

// Combines date (date-only or ISO) + "HH:mm" time into a comparable Date.
// Without a time, assumes end of day to keep the appointment visible all day.
function appointmentDateTime(raw: unknown, time: unknown): Date | null {
  if (typeof raw !== "string" || !raw) return null;
  // `raw` is already the real event timestamp (`data` column, time included) —
  // an explicit `horario` (override) takes priority; without it, uses the time that
  // already comes in the timestamp itself instead of inventing 23:59 (event.horario_inicio
  // never existed on the backend, so that fallback always fired before).
  if (typeof time === "string" && /^\d{1,2}:\d{2}/.test(time)) {
    const datePart = raw.includes("T") ? raw.slice(0, 10) : raw;
    const dt = new Date(`${datePart}T${time.slice(0, 5)}:00`);
    return Number.isFinite(dt.getTime()) ? dt : null;
  }
  const dt = new Date(raw);
  return Number.isFinite(dt.getTime()) ? dt : null;
}

// ─── Audit Log → ActivityItem mapper ────────────────────────────────────────
// Keyed by the canonical entity key resolved in lib/audit-activity (PT-BR labels live there).
const ENTITY_ICON: Record<string, React.ReactNode> = {
  artist:      <Users   className="h-3.5 w-3.5" />,
  contract:    <FileText className="h-3.5 w-3.5" />,
  release:     <Music   className="h-3.5 w-3.5" />,
  work:        <Music   className="h-3.5 w-3.5" />,
  phonogram:   <Music   className="h-3.5 w-3.5" />,
  lead:        <UserCheck className="h-3.5 w-3.5" />,
  client:      <UserCheck className="h-3.5 w-3.5" />,
  transaction: <DollarSign className="h-3.5 w-3.5" />,
  invoice:     <DollarSign className="h-3.5 w-3.5" />,
  event:       <Calendar className="h-3.5 w-3.5" />,
};

function mapAuditToActivity(row: AuditLogRow): ActivityItem {
  const view = describeAuditRow(row);
  const ts = row.created_at ? new Date(row.created_at) : new Date();
  return {
    id:           row.id,
    icon:         (view.entityKey && ENTITY_ICON[view.entityKey]) || <Shield className="h-3.5 w-3.5" />,
    label:        view.label,
    description:  view.description,
    badge:        view.badge,
    badgeVariant: row.action.includes("delete") ? "outline" : "default",
    timestamp:    Number.isFinite(ts.getTime()) ? ts : new Date(),
  };
}

function timeAgo(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const s = Math.floor(diffMs / 1000);
  if (s < 60) return `${s}s atrás`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}min atrás`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h atrás`;
  return date.toLocaleDateString("pt-BR");
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: React.ReactNode;
  icon: React.ComponentType<{ className?: string }>;
  accent?: "primary" | "success" | "warning" | "destructive";
}

// Same visual identity as the KPI cards of the Artists page (MetricCard).
const accentIcon: Record<NonNullable<StatCardProps["accent"]>, string> = {
  primary:     "bg-primary/8 text-primary border-primary/15",
  success:     "bg-success/8 text-success border-success/15",
  warning:     "bg-warning/8 text-warning border-warning/15",
  destructive: "bg-destructive/8 text-destructive border-destructive/15",
};

function StatCard({ label, value, sub, icon: Icon, accent = "primary" }: StatCardProps) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0 space-y-1.5">
            <p className="text-sm font-medium text-muted-foreground leading-none">
              {label}
            </p>
            <p className="text-2xl font-bold tabular-nums tracking-tight text-foreground leading-none">
              {value}
            </p>
            {sub && (
              <div className="text-xs text-muted-foreground leading-snug">
                {sub}
              </div>
            )}
          </div>
          {Icon && (
            <div className={cn("rounded-lg p-2.5 border shrink-0", accentIcon[accent])}>
              <Icon className="h-[15px] w-[15px]" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Section Header ───────────────────────────────────────────────────────────

function SectionHeader({
  title, description, action
}: {
  title: string;
  description?: string;
  action?: { label: string; href: string };
}) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div>
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {description && (
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
      {action && (
        <Link to={action.href}>
          <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground hover:text-foreground gap-1.5">
            {action.label}
            <ArrowRight className="h-3 w-3" />
          </Button>
        </Link>
      )}
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

// ─── Operational Alert ────────────────────────────────────────────────────────

interface AlertItemProps {
  label: string;
  value: number;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  variant: "destructive" | "warning" | "info";
}

function AlertItem({ label, value, href, icon: Icon, variant }: AlertItemProps) {
  const cls = {
    destructive: "border-destructive/30 bg-destructive/5 text-destructive",
    warning:     "border-warning/30 bg-warning/5 text-warning",
    info:        "border-primary/20 bg-primary/5 text-primary",
  }[variant];

  return (
    <Link to={href}>
      <div className={cn("flex items-center gap-3 rounded-lg border px-4 py-3 hover:opacity-80 transition-opacity cursor-pointer", cls)}>
        <Icon className="h-4 w-4 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium leading-snug">{label}</p>
        </div>
        <span className="font-sans font-bold text-lg leading-none">{value}</span>
        <ArrowRight className="h-3.5 w-3.5 shrink-0 opacity-60" />
      </div>
    </Link>
  );
}

function OperationalAlerts() {
  const { dashboard } = useOperationalDashboard();
  if (!dashboard) return null;

  const alerts: AlertItemProps[] = [
    dashboard.overdue_tasks_count > 0 && {
      label: "Tarefas atrasadas",
      value: dashboard.overdue_tasks_count,
      href: "/crm",
      icon: ListChecks,
      variant: "destructive" as const,
    },
    dashboard.overdue_invoices_count > 0 && {
      label: "Notas fiscais vencidas",
      value: dashboard.overdue_invoices_count,
      href: "/accounting/invoices",
      icon: AlertTriangle,
      variant: "destructive" as const,
    },
    dashboard.failed_external_syncs > 0 && {
      label: "Sincronizações com falha",
      value: dashboard.failed_external_syncs,
      href: "/settings",
      icon: ServerCrash,
      variant: "destructive" as const,
    },
    dashboard.contracts_expiring_soon_count > 0 && {
      label: "Contratos vencendo em 30 dias",
      value: dashboard.contracts_expiring_soon_count,
      href: "/contracts",
      icon: FileText,
      variant: "warning" as const,
    },
    dashboard.pending_tasks_count > 0 && {
      label: "Tarefas pendentes",
      value: dashboard.pending_tasks_count,
      href: "/crm",
      icon: ListChecks,
      variant: "info" as const,
    },
    dashboard.onboarding_in_progress_count > 0 && {
      label: "Onboardings em andamento",
      value: dashboard.onboarding_in_progress_count,
      href: "/artists",
      icon: Users,
      variant: "info" as const,
    },
    dashboard.pending_distribution_setups > 0 && {
      label: "Configurações de distribuição pendentes",
      value: dashboard.pending_distribution_setups,
      href: "/releases",
      icon: Upload,
      variant: "info" as const,
    },
    dashboard.pending_external_syncs > 0 && {
      label: "Sincronizações externas pendentes",
      value: dashboard.pending_external_syncs,
      href: "/settings",
      icon: Activity,
      variant: "info" as const,
    },
  ].filter(Boolean) as AlertItemProps[];

  if (alerts.length === 0) return null;

  const critical = alerts.filter((a) => a.variant === "destructive");
  const warn     = alerts.filter((a) => a.variant === "warning");
  const info     = alerts.filter((a) => a.variant === "info");

  return (
    <div>
      <SectionHeader
        title="Atenção Operacional"
        description="Itens que requerem ação imediata ou acompanhamento"
      />
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {[...critical, ...warn, ...info].slice(0, 9).map((a) => (
          <AlertItem key={a.label} {...a} />
        ))}
      </div>
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

/** Initials for the artist avatar's default placeholder. */
function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

export default function Dashboard() {
  const [visao360Modal, setVisao360Modal] = useState<{ open: boolean; artist?: Artist }>({ open: false });
  const { dashboardMetrics, artistasMetrics: artistsMetrics, isLoading, eventos: events, error: metricsError, refetch: refetchMetrics } = useMetrics();

  // ── Activity state ──────────────────────────────────────────────────────────
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const { data: historyRows } = useActivityHistory(MAX_ITEMS);

  // Hydrate feed with persisted history once it arrives. Subsequent realtime
  // pushes prepend on top, dedup by id, then keep MAX_ITEMS.
  useEffect(() => {
    if (!historyRows || historyRows.length === 0) return;
    setActivities((prev) => {
      const mapped = historyRows.map(mapAuditToActivity);
      const seen   = new Set<string>();
      const merged: ActivityItem[] = [];
      for (const item of [...prev, ...mapped]) {
        if (seen.has(item.id)) continue;
        seen.add(item.id);
        merged.push(item);
      }
      merged.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      return merged.slice(0, MAX_ITEMS);
    });
  }, [historyRows]);

  const push = useCallback((item: Omit<ActivityItem, "id" | "timestamp">) => {
    setActivities((prev) => {
      const next: ActivityItem = { id: crypto.randomUUID(), timestamp: new Date(), ...item };
      return [next, ...prev].slice(0, MAX_ITEMS);
    });
  }, []);

  // WS subscriptions
  useWsEvent("artist.created", () =>
    push({ icon: <Users className="h-3.5 w-3.5" />, label: "Artista cadastrado", description: "Novo cadastro no elenco", badge: "Artista", badgeVariant: "default" }),
  );
  useWsEvent("artist.updated", () =>
    push({ icon: <Users className="h-3.5 w-3.5" />, label: "Artista atualizado", description: "Dados alterados", badge: "Artista", badgeVariant: "secondary" }),
  );
  useWsEvent("artist.deleted", () =>
    push({ icon: <Users className="h-3.5 w-3.5" />, label: "Artista removido", description: "Cadastro removido do elenco", badge: "Artista", badgeVariant: "outline" }),
  );
  useWsEvent("catalog.music.registered", (d) =>
    push({ icon: <Music className="h-3.5 w-3.5" />, label: "Música registrada", description: (d as { title?: string }).title ?? "Título não informado", badge: "Catálogo", badgeVariant: "default" }),
  );
  useWsEvent("catalog.phonogram.registered", () =>
    push({ icon: <Music className="h-3.5 w-3.5" />, label: "Fonograma registrado", description: "Novo fonograma no catálogo", badge: "Catálogo", badgeVariant: "secondary" }),
  );
  useWsEvent("contract.created", () =>
    push({ icon: <FileText className="h-3.5 w-3.5" />, label: "Contrato criado", description: "Novo contrato adicionado", badge: "Contrato", badgeVariant: "default" }),
  );
  useWsEvent("contract.updated", () =>
    push({ icon: <FileText className="h-3.5 w-3.5" />, label: "Contrato atualizado", description: "Alterações salvas", badge: "Contrato", badgeVariant: "secondary" }),
  );
  useWsEvent("contract.signed", () =>
    push({ icon: <FileText className="h-3.5 w-3.5" />, label: "Contrato assinado", description: "Assinatura registrada", badge: "Contrato", badgeVariant: "default" }),
  );
  useWsEvent("crm.lead.captured", (d) =>
    push({ icon: <UserCheck className="h-3.5 w-3.5" />, label: "Lead capturado", description: (d as { nome?: string }).nome ?? "Nome não informado", badge: "CRM", badgeVariant: "default" }),
  );
  useWsEvent("crm.lead.converted", () =>
    push({ icon: <UserCheck className="h-3.5 w-3.5" />, label: "Lead convertido", description: "Lead virou artista/cliente", badge: "CRM", badgeVariant: "default" }),
  );
  useWsEvent("finance.transaction.created", (d) =>
    push({ icon: <DollarSign className="h-3.5 w-3.5" />, label: "Transação registrada", description: transactionTypeRegisteredPtBr((d as { type?: string }).type), badge: "Contabilidade", badgeVariant: "default" }),
  );
  useWsEvent("finance.transaction.updated", () =>
    push({ icon: <DollarSign className="h-3.5 w-3.5" />, label: "Transação atualizada", description: "Alterações salvas", badge: "Contabilidade", badgeVariant: "secondary" }),
  );
  useWsEvent("finance.calculated", () =>
    push({ icon: <DollarSign className="h-3.5 w-3.5" />, label: "Apuração concluída", description: "Contabilidade recalculada", badge: "Contabilidade", badgeVariant: "default" }),
  );
  useWsEvent("audit.entry.created", (d) => {
    const ev = d as { action?: string; entity?: string };
    const meta = auditEntityMeta(ev.entity ?? ev.action?.split(".")[0]);
    push({ icon: <Shield className="h-3.5 w-3.5" />, label: describeAuditAction(ev.action, ev.entity), description: "Registro de auditoria", badge: meta?.badge ?? "Sistema", badgeVariant: "outline" });
  });

  // Mock mode: window CustomEvents
  const pushRef = useRef(push);
  pushRef.current = push;

  useEffect(() => {
    const handlers: { event: string; fn: EventListener }[] = [
      {
        event: "musicos360:ARTIST_CREATED",
        fn: (e) => {
          const d = (e as CustomEvent).detail as { stageName?: string };
          pushRef.current({ icon: <Users className="h-3.5 w-3.5" />, label: "Artista cadastrado", description: d.stageName ?? "–", badge: "Artista", badgeVariant: "default" });
        },
      },
      {
        event: "musicos360:ARTIST_UPDATED",
        fn: () => pushRef.current({ icon: <Users className="h-3.5 w-3.5" />, label: "Artista atualizado", description: "Dados alterados", badge: "Artista", badgeVariant: "secondary" }),
      },
      {
        event: "musicos360:ARTIST_DELETED",
        fn: () => pushRef.current({ icon: <Users className="h-3.5 w-3.5" />, label: "Artista removido", description: "–", badge: "Artista", badgeVariant: "outline" }),
      },
      {
        event: "musicos360:MUSIC_REGISTERED",
        fn: (e) => {
          const d = (e as CustomEvent).detail as { title?: string };
          pushRef.current({ icon: <Music className="h-3.5 w-3.5" />, label: "Música registrada", description: d.title ?? "–", badge: "Catálogo", badgeVariant: "default" });
        },
      },
      {
        event: "musicos360:CONTRACT_CREATED",
        fn: () => pushRef.current({ icon: <FileText className="h-3.5 w-3.5" />, label: "Contrato criado", description: "Novo contrato adicionado", badge: "Contrato", badgeVariant: "default" }),
      },
      {
        event: "musicos360:CONTRACT_UPDATED",
        fn: () => pushRef.current({ icon: <FileText className="h-3.5 w-3.5" />, label: "Contrato atualizado", description: "Alterações salvas", badge: "Contrato", badgeVariant: "secondary" }),
      },
      {
        event: "musicos360:CONTRACT_SIGNED",
        fn: () => pushRef.current({ icon: <FileText className="h-3.5 w-3.5" />, label: "Contrato assinado", description: "Assinatura registrada", badge: "Contrato", badgeVariant: "default" }),
      },
      {
        event: "musicos360:LEAD_CAPTURED",
        fn: (e) => {
          const d = (e as CustomEvent).detail as { nome?: string };
          pushRef.current({ icon: <UserCheck className="h-3.5 w-3.5" />, label: "Lead capturado", description: d.nome ?? "–", badge: "CRM", badgeVariant: "default" });
        },
      },
      {
        event: "musicos360:LEAD_CONVERTED",
        fn: () => pushRef.current({ icon: <UserCheck className="h-3.5 w-3.5" />, label: "Lead convertido", description: "Lead virou artista/cliente", badge: "CRM", badgeVariant: "default" }),
      },
      {
        event: "musicos360:TRANSACTION_CREATED",
        fn: (e) => {
          const d = (e as CustomEvent).detail as { type?: string };
          pushRef.current({ icon: <DollarSign className="h-3.5 w-3.5" />, label: "Transação registrada", description: transactionTypeRegisteredPtBr(d.type), badge: "Contabilidade", badgeVariant: "default" });
        },
      },
      {
        event: "musicos360:TRANSACTION_UPDATED",
        fn: () => pushRef.current({ icon: <DollarSign className="h-3.5 w-3.5" />, label: "Transação atualizada", description: "Alterações salvas", badge: "Contabilidade", badgeVariant: "secondary" }),
      },
      {
        event: "musicos360:FINANCE_CALCULATED",
        fn: () => pushRef.current({ icon: <Radio className="h-3.5 w-3.5" />, label: "Apuração concluída", description: "Contabilidade recalculada", badge: "Contabilidade", badgeVariant: "default" }),
      },
    ];

    handlers.forEach(({ event, fn }) => window.addEventListener(event, fn));
    return () => handlers.forEach(({ event, fn }) => window.removeEventListener(event, fn));
  }, []);

  // ── Derived data ────────────────────────────────────────────────────────────

  const { totalArtistas: totalArtists, contratosAtivos: activeContracts, contratosVencendo: expiringContracts, receitaMensal: monthlyIncome, eventosMes: eventsMonth, artistasDestaque: featuredArtists } =
    dashboardMetrics;

  // Upcoming appointments: only future events (date/time >= now), without the
  // closed/canceled/archived ones, in chronological order and limited to 5.
  // Tenant scoping is already guaranteed by the data layer (useEventos → tenant).
  const upcomingAppointments = useMemo(() => {
    const nowMs = Date.now();
    return events
      .map((calendarEvent) => {
        // The frontend uses `start_date`; the backend returns `data` in the timestamp column.
        const raw =
          (calendarEvent.start_date as string | null | undefined) ??
          ((calendarEvent as { data?: string | null }).data ?? null);
        return { event: calendarEvent, when: appointmentDateTime(raw, calendarEvent.horario_inicio) };
      })
      .filter(
        (item): item is { event: EventWithRelations; when: Date } => {
          if (!item.when) return false;
          if (item.when.getTime() < nowMs) return false;
          return !HIDDEN_APPOINTMENT_STATUSES.has(normalizeSlug(item.event.status));
        },
      )
      .sort((a, b) => a.when.getTime() - b.when.getTime())
      .slice(0, 5);
  }, [events]);

  const artistsWithEvents = useMemo(
    () => featuredArtists.map((a) => ({
      id: a.id,
      name: a.stageName,
      genre: a.musicGenre || "Outro",
      releases: a.lancamentos,
      streams: a.streams, // may be null → the UI shows "–"
      projects: a.projetos,
      photoUrl: a.photoUrl,
    })),
    [featuredArtists],
  );

  return (
    <>
    {isLoading ? <DashboardSkeleton /> : (
    <MainLayout title="Dashboard" description="Visão geral do seu negócio musical">
      <div className="space-y-6">

        {metricsError && (
          <UnavailableState
            title="Não foi possível carregar o Dashboard"
            description="A API não respondeu. Os KPIs abaixo não refletem dados reais até a conexão ser restabelecida."
            onRetry={refetchMetrics}
            className="py-10"
          />
        )}

        {/* ── KPI Stats ── */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Artistas Cadastrados"
            value={totalArtists}
            icon={Users}
            accent="primary"
            sub={
              <span>
                <span className="font-sans font-semibold text-success">{artistsMetrics.comContrato}</span>
                {" "}com contrato ativo
              </span>
            }
          />
          <StatCard
            label="Contratos Vigentes"
            value={activeContracts}
            icon={FileText}
            accent={expiringContracts > 0 ? "warning" : "success"}
            sub={
              expiringContracts > 0 ? (
                <span className="flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3 text-warning" />
                  <span className="font-sans font-semibold text-warning">{expiringContracts}</span>
                  {" "}vencendo em breve
                </span>
              ) : (
                <span className="text-success font-medium">Todos em dia</span>
              )
            }
          />
          <StatCard
            label="Receita Total"
            value={formatCurrency(monthlyIncome)}
            icon={DollarSign}
            accent="success"
            sub={<span>receita atual consolidada</span>}
          />
          <StatCard
            label="Eventos do Mês"
            value={eventsMonth}
            icon={Calendar}
            accent="primary"
            sub={<span>{eventsMonth === 1 ? "evento" : "eventos"} no mês atual</span>}
          />
        </div>

        {/* ── Main grid: recent activity + schedule (equal widths) ── */}
        <div className="grid gap-6 lg:grid-cols-2">

          {/* Atividades Recentes — all system events */}
          <Card data-testid="card-activity-feed">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="rounded-md bg-primary/10 border border-primary/20 p-1.5">
                    <Activity className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-sm font-semibold">Atividades Recentes</CardTitle>
                    <CardDescription className="text-xs mt-0.5">
                      Todas as ações realizadas no sistema
                    </CardDescription>
                  </div>
                </div>
                {activities.length > 0 && (
                  <Badge variant="secondary" className="font-sans text-xs">
                    {activities.length}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-0 p-0">
              <ScrollArea className="h-[320px] px-6 pb-4">
                {activities.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-[280px] text-center">
                    <div className="rounded-xl bg-muted/60 border border-border p-4 mb-3">
                      <TrendingUp className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium text-muted-foreground">Nenhuma atividade ainda</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">
                      Ações como criar artistas, registrar músicas ou transações aparecerão aqui
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-border/60">
                    {activities.map((item, idx) => (
                      <div
                        key={item.id}
                        className={cn(
                          "flex items-start gap-3 py-3 first:pt-0 last:pb-0 transition-colors",
                          idx === 0 && "animate-in slide-in-from-top-1 duration-300",
                        )}
                        data-testid={`activity-item-${item.id}`}
                      >
                        <div className="mt-0.5 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-primary">
                          {item.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium">{item.label}</span>
                            {item.badge && (
                              <Badge variant={item.badgeVariant ?? "secondary"} className="text-xs px-1.5 py-0">
                                {item.badge}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground truncate mt-0.5">{item.description}</p>
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0 font-sans">
                          {timeAgo(item.timestamp)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Upcoming appointments */}
          <Card className="flex flex-col">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <div className="rounded-md bg-primary/10 border border-primary/20 p-1.5">
                  <Calendar className="h-3.5 w-3.5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-sm font-semibold">Próximos Compromissos</CardTitle>
                  <CardDescription className="text-xs mt-0">
                    Compromissos agendados em ordem cronológica
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col pt-0">
              {upcomingAppointments.length > 0 ? (
                <ul className="flex-1 divide-y divide-border/60">
                  {upcomingAppointments.map(({ event: calendarEvent, when }) => (
                    <li
                      key={calendarEvent.id}
                      className="flex flex-col gap-1 py-3 first:pt-0 sm:flex-row sm:items-start sm:gap-3"
                      data-testid={`compromisso-${calendarEvent.id}`}
                    >
                      <div className="flex shrink-0 items-center gap-2 sm:w-16 sm:flex-col sm:items-center sm:gap-0 sm:text-center">
                        <span className="text-xs font-sans font-semibold text-foreground">
                          {when.toLocaleDateString("pt-BR")}
                        </span>
                        <span className="text-xs font-sans text-primary sm:mt-0.5">
                          {when.getHours() === 0 && when.getMinutes() === 0
                            ? "Dia inteiro"
                            : when.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <div className="hidden w-px self-stretch bg-primary/20 sm:block" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium leading-tight">{calendarEvent.title}</p>
                        <Badge
                          variant="outline"
                          className="mt-1.5 px-1.5 py-0 text-[10px] border-border text-muted-foreground"
                        >
                          {appointmentCategoryLabel(calendarEvent.type)}
                        </Badge>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center py-8 text-center">
                  <div className="rounded-xl bg-muted/60 border border-border p-4 mb-3">
                    <Calendar className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Nenhum compromisso agendado
                  </p>
                  <p className="text-xs text-muted-foreground/60 mt-1">
                    Os próximos eventos, reuniões e produções aparecerão aqui.
                  </p>
                </div>
              )}
              <Link to="/agenda" className="mt-4 block">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full h-8 text-xs"
                  aria-label="Ver agenda completa"
                >
                  Ver Agenda Completa
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* ── Featured artists ── */}
        <div>
          <SectionHeader
            title="Artistas em Destaque"
            description="Artistas com maior relevância no período"
            action={{ label: "Ver todos", href: "/artists" }}
          />
          {artistsWithEvents.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {artistsWithEvents.map((artist, index) => (
                <Card
                  key={artist.id}
                  className="group relative overflow-hidden duration-200"
                  data-testid={`card-artista-destaque-${artist.id}`}
                >
                  {/* The artist image covers the whole card; default placeholder when there is no photo */}
                  {artist.photoUrl ? (
                    <>
                      <img
                        src={artist.photoUrl}
                        alt={artist.name}
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-black/10" />
                    </>
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-muted">
                      <span className="text-3xl font-semibold text-muted-foreground/70">
                        {getInitials(artist.name)}
                      </span>
                    </div>
                  )}

                  <div className={cn(
                    "relative z-10 flex min-h-[300px] flex-col p-4",
                    artist.photoUrl && "text-white",
                  )}>
                    <div className="flex justify-end">
                      <span className={cn(
                        "text-[11px] font-bold tabular-nums tracking-tight px-1.5 py-0.5 rounded-sm border",
                        index === 0
                          ? "bg-warning/10 text-warning border-warning/20"
                          : artist.photoUrl
                            ? "bg-white/15 text-white border-white/30"
                            : "bg-muted text-muted-foreground border-border"
                      )}>
                        #{index + 1}
                      </span>
                    </div>

                    <div className="mt-auto space-y-3">
                      <div>
                        <h3 className="font-semibold text-sm leading-tight truncate">{artist.name}</h3>
                        <p className={cn("text-xs mt-0.5", artist.photoUrl ? "text-white/80" : "text-muted-foreground")}>{artist.genre}</p>
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className={cn("flex items-center gap-1.5 text-xs", artist.photoUrl ? "text-white/80" : "text-muted-foreground")}>
                            <Layers className="h-3 w-3" />
                            Projetos
                          </span>
                          <span className="text-xs font-sans font-semibold">{artist.projects}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className={cn("flex items-center gap-1.5 text-xs", artist.photoUrl ? "text-white/80" : "text-muted-foreground")}>
                            <Radio className="h-3 w-3" />
                            Streams
                          </span>
                          <span className="text-xs font-sans font-semibold">
                            {artist.streams == null
                              ? "–"
                              : artist.streams.toLocaleString("pt-BR")}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className={cn("flex items-center gap-1.5 text-xs", artist.photoUrl ? "text-white/80" : "text-muted-foreground")}>
                            <Disc className="h-3 w-3" />
                            Lançamentos
                          </span>
                          <span className="text-xs font-sans font-semibold">{artist.releases}</span>
                        </div>
                      </div>

                      <Button
                        variant="ghost"
                        size="sm"
                        className={cn(
                          "w-full mt-1 h-7 text-xs border",
                          artist.photoUrl
                            ? "text-white border-white/40 hover:bg-white/10 hover:text-white"
                            : "text-muted-foreground hover:text-foreground border-border/60 hover:border-border"
                        )}
                        onClick={() =>
                          setVisao360Modal({
                            open: true,
                            artist: featuredArtists.find((a) => a.id === artist.id)?.artist,
                          })
                        }
                        data-testid={`button-ver-perfil-${artist.id}`}
                      >
                        Ver perfil 360°
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <div className="rounded-xl bg-muted/60 border border-border p-4 mb-4">
                  <Users className="h-7 w-7 text-muted-foreground" />
                </div>
                <p className="text-sm font-semibold text-foreground mb-1">Nenhum artista cadastrado</p>
                <p className="text-xs text-muted-foreground mb-4">Comece cadastrando seus artistas para ver os destaques aqui.</p>
                <Link to="/artists">
                  <Button size="sm" className="h-8 text-xs">
                    Criar Artista
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </div>

      </div>
    </MainLayout>
    )}

      {/* Outside the isLoading gate on purpose — same bug as /artists
          (see Task C): ArtistaVisao360Modal calls useContratos/useTransacoes/
          useEventos/useLancamentos/useProjetos unconditionally, all of them
          used in the Dashboard's composite isLoading (useMetrics). Mounting it only
          after isLoading turns false creates new observers on those same
          queries; with them in error (backend down), refetchOnMount
          reopens isLoading, the gate unmounts the modal again — infinite loop.
          Keeping it always mounted breaks the cycle. */}
      <ArtistVision360Modal
        open={visao360Modal.open}
        onOpenChange={(open) => setVisao360Modal({ ...visao360Modal, open })}
        artist={visao360Modal.artist ?? null}
      />
    </>
  );
}

