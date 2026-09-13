import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MainLayout } from "@/shared/components/MainLayout";
import { Card, CardContent, CardHeader, CardDescription, CardTitle } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Contact,
  Disc3,
  DollarSign,
  FileText,
  Folder,
  Loader2,
  Music,
  Package,
  RefreshCw,
  Rocket,
  Settings,
  Users,
  Wrench,
} from "lucide-react";
import { useAudit } from "@/shared/hooks/useAudit";
import type { AuditModuleId } from "@/shared/lib/audit/types";
import { cn } from "@/shared/lib/utils";

type CompletenessFilter = "all" | "complete" | "incomplete";
type AuditPanelTabId =
  | "artistas"
  | "projetos"
  | "obras"
  | "fonogramas"
  | "lancamentos"
  | "contratos"
  | "financeiro"
  | "agenda"
  | "inventario"
  | "crm"
  | "servicos";

const AUDIT_PANEL_TABS: {
  id: AuditPanelTabId;
  label: string;
  title: string;
  module: AuditModuleId | null;
  entityType?: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: "artistas", label: "Artistas", title: "Auditoria de Artistas", module: "artistas", icon: Users },
  { id: "projetos", label: "Projetos", title: "Auditoria de Projetos", module: "projects", icon: Folder },
  { id: "obras", label: "Obras", title: "Auditoria de Obras", module: "catalog", entityType: "Obra", icon: Music },
  { id: "fonogramas", label: "Fonogramas", title: "Auditoria de Fonogramas", module: "catalog", entityType: "Fonograma", icon: Disc3 },
  { id: "lancamentos", label: "Lançamentos", title: "Auditoria de Lançamentos", module: "lancamentos", icon: Rocket },
  { id: "contratos", label: "Contratos", title: "Auditoria de Contratos", module: "contracts", icon: FileText },
  { id: "financeiro", label: "Financeiro", title: "Auditoria de Financeiro", module: "accounting", icon: DollarSign },
  { id: "agenda", label: "Agenda", title: "Auditoria de Agenda", module: "events", icon: Calendar },
  { id: "inventario", label: "Inventário", title: "Auditoria de Inventário", module: "inventory", icon: Package },
  { id: "crm", label: "CRM", title: "Auditoria de CRM", module: "crm", icon: Contact },
  { id: "servicos", label: "Serviços", title: "Auditoria de Serviços", module: null, icon: Settings },
];

function DadosTab() {
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useAudit();

  const [activeAuditTab, setActiveAuditTab] = useState<AuditPanelTabId>("artistas");
  const [completenessFilter, setCompletenessFilter] = useState<CompletenessFilter>("incomplete");

  const records = data?.records ?? [];
  const summary = data?.summary;
  const activeTab = AUDIT_PANEL_TABS.find((item) => item.id === activeAuditTab) ?? AUDIT_PANEL_TABS[0];
  const ActiveIcon = activeTab.icon;

  const activeTabRecords = useMemo(() => {
    if (!activeTab.module) return [];
    return records.filter((record) => {
      if (record.module !== activeTab.module) return false;
      if (activeTab.entityType && record.entity_type !== activeTab.entityType) return false;
      return true;
    });
  }, [records, activeTab]);

  const tabRecords = useMemo(() => {
    return activeTabRecords.filter((record) => {
      if (completenessFilter === "complete" && !record.is_complete) return false;
      if (completenessFilter === "incomplete" && record.is_complete) return false;
      return true;
    });
  }, [activeTabRecords, completenessFilter]);

  const completeCount = activeTabRecords.filter((record) => record.is_complete).length;
  const incompleteCount = activeTabRecords.length - completeCount;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-10 text-center space-y-2">
          <AlertCircle className="h-10 w-10 mx-auto text-destructive" />
          <p className="text-sm text-muted-foreground" data-testid="text-audit-error">
            Não foi possível executar a auditoria. Tente novamente.
          </p>
          <Button onClick={() => refetch()} data-testid="button-retry-audit">
            Tentar novamente
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 md:grid-cols-4">
        <Card className="h-[86px] bg-card border-border" data-testid="card-summary-total">
          <CardHeader className="p-4">
            <CardDescription className="text-sm font-medium text-muted-foreground">Total de Registros</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums leading-none" data-testid="text-summary-total">
              {summary?.total_records ?? 0}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card className="h-[86px] bg-card border-border" data-testid="card-summary-complete">
          <CardHeader className="p-4">
            <CardDescription className="text-sm font-medium text-muted-foreground">Registros Completos</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums leading-none text-success" data-testid="text-summary-complete">
              {summary?.complete_records ?? 0}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card className="h-[86px] bg-card border-border" data-testid="card-summary-incomplete">
          <CardHeader className="p-4">
            <CardDescription className="text-sm font-medium text-muted-foreground">Registros Incompletos</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums leading-none text-warning" data-testid="text-summary-incomplete">
              {summary?.incomplete_records ?? 0}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card className="h-[86px] bg-card border-border" data-testid="card-summary-rate">
          <CardHeader className="p-4">
            <CardDescription className="text-sm font-medium text-muted-foreground">Taxa de Completude</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums leading-none" data-testid="text-summary-rate">
              {summary?.completion_rate ?? 0}%
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card className="bg-card border-border">
        <CardContent className="min-h-[180px] space-y-6 p-4">
          <div className="flex gap-1 overflow-x-auto">
            {AUDIT_PANEL_TABS.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveAuditTab(item.id)}
                  className={cn(
                    "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md border px-3 text-xs font-medium transition-colors",
                    activeAuditTab === item.id
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                  data-testid={`button-audit-entity-${item.id}`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {item.label}
                </button>
              );
            })}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <ActiveIcon className="h-4 w-4 text-foreground" />
              <h3 className="text-sm font-semibold" data-testid="text-audit-panel-title">
                {activeTab.title}
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCompletenessFilter("complete")}
                className={cn(
                  "inline-flex h-5 items-center gap-1 rounded-full border px-2 text-[11px] font-semibold transition-colors",
                  completenessFilter === "complete"
                    ? "border-success/40 bg-success/10 text-success"
                    : "border-success/30 text-success hover:bg-success/10",
                )}
                data-testid="button-filter-complete"
              >
                <CheckCircle2 className="h-3 w-3" />
                {completeCount} Completos
              </button>
              <button
                type="button"
                onClick={() => setCompletenessFilter("incomplete")}
                className={cn(
                  "inline-flex h-5 items-center gap-1 rounded-full border px-2 text-[11px] font-semibold transition-colors",
                  completenessFilter === "incomplete"
                    ? "border-warning/40 bg-warning/10 text-warning"
                    : "border-warning/30 text-warning hover:bg-warning/10",
                )}
                data-testid="button-filter-incomplete"
              >
                <AlertTriangle className="h-3 w-3" />
                {incompleteCount} Incompletos
              </button>
            </div>
          </div>

          {tabRecords.length === 0 ? (
            <div className="flex min-h-[86px] items-center justify-center">
              <p className="text-sm text-muted-foreground" data-testid="text-no-issues">
                Nenhum registro encontrado
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {tabRecords.map((record) => {
                const missing = [...record.missing_fields, ...record.recommended_missing_fields];
                return (
                  <div
                    key={record.id}
                    className="flex flex-col gap-3 py-3 md:flex-row md:items-center md:justify-between"
                    data-testid={`row-audit-record-${record.id}`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium" data-testid={`text-entity-${record.id}`}>
                          {record.entity_label}
                        </p>
                        <Badge variant={record.is_complete ? "default" : "outline"} className="text-[11px]">
                          {record.is_complete ? "Completo" : "Incompleto"}
                        </Badge>
                      </div>
                      {missing.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-1.5" data-testid={`text-missing-${record.id}`}>
                          {record.missing_fields.map((field) => (
                            <Badge key={`required-${field}`} variant="destructive" className="text-[11px]">
                              {field}
                            </Badge>
                          ))}
                          {record.recommended_missing_fields.map((field) => (
                            <Badge
                              key={`recommended-${field}`}
                              variant="secondary"
                              className="bg-warning/10 text-warning hover:bg-warning/10 text-[11px]"
                            >
                              {field}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-1 text-xs text-muted-foreground">Nenhum campo faltante.</p>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => navigate(record.fix_path)}
                      data-testid={`button-fix-${record.id}`}
                    >
                      <Wrench className="mr-2 h-4 w-4" />
                      {record.is_complete ? "Abrir" : "Preencher"}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function Auditoria() {
  const { isFetching, refetch } = useAudit();

  const headerActions = (
    <Button
      onClick={() => refetch()}
      variant="outline"
      data-testid="button-refresh-audit"
    >
      {isFetching ? (
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      ) : (
        <RefreshCw className="h-4 w-4 mr-2" />
      )}
      Atualizar auditoria
    </Button>
  );

  return (
    <MainLayout
      title="Auditoria"
      description="Exiba e filtre dados faltantes a serem preenchidos"
      actions={headerActions}
    >
      <div className="space-y-4 pt-[10px] pb-[10px]">
        <DadosTab />
      </div>
    </MainLayout>
  );
}
