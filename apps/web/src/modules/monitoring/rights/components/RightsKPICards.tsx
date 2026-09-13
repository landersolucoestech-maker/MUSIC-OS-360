import { MetricCard } from "@/shared/components/MetricCard";
import { Radio, CheckCircle, AlertTriangle, Clock, TrendingUp, DollarSign } from "lucide-react";

type Accent = "primary" | "success" | "warning" | "destructive";

interface KPI {
  label: string;
  value: string;
  subvalue?: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: Accent;
}

const fmtBRL = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);

const fmtNum = (n: number) =>
  new Intl.NumberFormat("pt-BR").format(n);

interface Props {
  total: number;
  completed: number;
  pending: number;
  divergences: number;
  matchRate: number;
  receivedEcadAmount: number;
  totalEcadReports: number;
}

export function RightsKPICards({ total, completed, pending, divergences, matchRate, receivedEcadAmount, totalEcadReports }: Props) {
  const kpis: KPI[] = [
    { label: "Detecções",     value: fmtNum(total),         subvalue: "conteúdo monitorado",        icon: Radio,         accent: "primary" },
    { label: "Concluídas",    value: fmtNum(completed),    subvalue: `${total > 0 ? Math.round((completed / total) * 100) : 0}% do total`, icon: CheckCircle, accent: "success" },
    { label: "Pendentes",     value: fmtNum(pending),     subvalue: "aguardam análise",            icon: Clock,         accent: "warning" },
    { label: "Divergências",  value: fmtNum(divergences),  subvalue: "sem vínculo/cód. ECAD",       icon: AlertTriangle, accent: "destructive" },
    { label: "Match Rate",    value: `${matchRate}%`,       subvalue: "vinculadas ao catálogo",      icon: TrendingUp,    accent: matchRate >= 80 ? "success" : matchRate >= 60 ? "warning" : "destructive" },
    { label: "Relatórios ECAD", value: fmtNum(totalEcadReports), subvalue: "importados",           icon: DollarSign,    accent: "primary" },
    { label: "Valor Recebido", value: fmtBRL(receivedEcadAmount), subvalue: "ECAD concluído",          icon: DollarSign,    accent: "success" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {kpis.map((kpi) => (
        <MetricCard
          key={kpi.label}
          title={kpi.label}
          value={kpi.value}
          description={kpi.subvalue}
          icon={kpi.icon}
          accent={kpi.accent}
        />
      ))}
    </div>
  );
}
