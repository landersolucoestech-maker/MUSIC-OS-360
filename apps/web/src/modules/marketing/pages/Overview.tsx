/**
 * Marketing — overview page (operational dashboard).
 * KPIs, operational alerts, upcoming deliveries, pending approvals,
 * recent activity and quick actions.
 */

import { Link } from "react-router-dom";
import {
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  FileEdit,
  Folder,
  Gauge,
  ListChecks,
  Megaphone,
  Plus,
  Sparkles,
  Truck,
} from "lucide-react";
import { MainLayout } from "@/shared/components/MainLayout";
import { FeatureGate } from "@/shared/components/FeatureGate";
import { Button } from "@/shared/ui/button";
import { Skeleton } from "@/shared/ui/skeleton";
import { MarketingKpiCard } from "../components/MarketingKpiCard";
import { MarketingSectionCard } from "../components/MarketingSectionCard";
import { MarketingActivityFeed } from "../components/MarketingActivityFeed";
import { ContentStatusBadge, ApprovalBadge } from "../components/MarketingStatusBadge";
import { useMarketingDashboard } from "../hooks/useMarketingDashboard";
import { CONTENT_CHANNEL_LABEL } from "../constants/marketing.constants";
import { formatDate } from "../utils/marketing-format";

const QUICK_LINKS = [
  { href: "/marketing/campanhas", icon: Megaphone, label: "Nova Campanha" },
  { href: "/marketing/calendario", icon: CalendarClock, label: "Novo Conteúdo" },
  { href: "/marketing/tarefas", icon: ListChecks, label: "Nova Tarefa" },
  { href: "/marketing/ia-criativa", icon: Sparkles, label: "IA Criativa" },
];

export default function Overview() {
  const { data, isLoading } = useMarketingDashboard();

  return (
    <FeatureGate feature="moduleMarketing" featureName="Marketing">
      <MainLayout
        title="Visão Geral"
        description="Painel operacional do setor de marketing"
      >
        <div className="space-y-6">
          {/* KPIs */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {isLoading || !data
              ? Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-[104px]" />)
              : (
                <>
                  <MarketingKpiCard title="Campanhas ativas" value={data.kpis.activeCampaigns} icon={Megaphone} accent="primary" to="/marketing/campanhas" />
                  <MarketingKpiCard title="Projetos musicais em divulgação" value={data.kpis.activeProjects} icon={Folder} accent="primary" to="/projetos" />
                  <MarketingKpiCard title="Conteúdos programados" value={data.kpis.scheduledContents} icon={CalendarClock} accent="warning" to="/marketing/calendario" />
                  <MarketingKpiCard title="Tarefas pendentes" value={data.kpis.pendingTasks} icon={ListChecks} accent="warning" to="/marketing/tarefas" />
                  <MarketingKpiCard title="Conteúdos publicados" value={data.kpis.openBriefings} icon={FileEdit} accent="primary" to="/marketing/calendario" />
                  <MarketingKpiCard title="Aprovações pendentes" value={data.kpis.pendingApprovals} icon={CheckCircle2} accent="destructive" />
                  <MarketingKpiCard title="Entregas próximas" value={data.kpis.upcomingDeliveries} icon={Truck} accent="primary" />
                  <MarketingKpiCard title="Performance do setor" value={`${data.kpis.sectorPerformance}%`} icon={Gauge} accent="success" to="/marketing/metricas" />
                </>
              )}
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Left column */}
            <div className="lg:col-span-2 space-y-6">

              <MarketingSectionCard
                title="Entregas próximas"
                icon={CalendarClock}
                description="Conteúdos a publicar"
                action={
                  <Link to="/marketing/calendario">
                    <Button variant="ghost" size="sm" className="h-7 text-xs">Ver calendário</Button>
                  </Link>
                }
              >
                {isLoading || !data ? (
                  <Skeleton className="h-24 w-full" />
                ) : data.upcomingContents.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">Nada agendado.</p>
                ) : (
                  <ul className="divide-y divide-border/60">
                    {data.upcomingContents.map((content) => (
                      <li key={content.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{content.title}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {CONTENT_CHANNEL_LABEL[content.channel]} · {formatDate(content.publishDate)} {content.publishTime}
                          </p>
                        </div>
                        <ContentStatusBadge status={content.status} />
                      </li>
                    ))}
                  </ul>
                )}
              </MarketingSectionCard>

              <MarketingSectionCard
                title="Aprovações pendentes"
                icon={CheckCircle2}
                description="Conteúdos aguardando aprovação"
              >
                {isLoading || !data ? (
                  <Skeleton className="h-20 w-full" />
                ) : data.pendingApprovals.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">Nenhuma aprovação pendente.</p>
                ) : (
                  <ul className="divide-y divide-border/60">
                    {data.pendingApprovals.map((content) => (
                      <li key={content.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{content.title}</p>
                          <p className="text-[11px] text-muted-foreground">{content.owner}</p>
                        </div>
                        <ApprovalBadge status={content.approval} />
                      </li>
                    ))}
                  </ul>
                )}
              </MarketingSectionCard>
            </div>

            {/* Right column */}
            <div className="space-y-6">
              <MarketingSectionCard title="Atalhos rápidos" icon={Sparkles}>
                <div className="space-y-2">
                  {QUICK_LINKS.map(({ href, icon: Icon, label }) => (
                    <Link to={href} key={href}>
                      <Button variant="outline" size="sm" className="w-full justify-start gap-2 h-9 text-xs">
                        <Plus className="h-3 w-3" />
                        <Icon className="h-3.5 w-3.5" />
                        {label}
                      </Button>
                    </Link>
                  ))}
                </div>
              </MarketingSectionCard>

              <MarketingSectionCard title="Atividades recentes" icon={ClipboardList}>
                {isLoading || !data ? (
                  <Skeleton className="h-32 w-full" />
                ) : (
                  <MarketingActivityFeed events={data.recentActivity} />
                )}
              </MarketingSectionCard>

            </div>
          </div>
        </div>
      </MainLayout>
    </FeatureGate>
  );
}

