import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Loader2,
  RefreshCw,
  Search,
  ShieldAlert,
  Wrench,
} from "lucide-react";
import { useAudit } from "@/hooks/useAudit";
import { AUDIT_MODULES, type AuditIssue, type AuditModuleId, type AuditSeverity } from "@/lib/audit/types";

type ModuleFilter = "all" | AuditModuleId;
type SeverityFilter = "all" | AuditSeverity;

export default function Auditoria() {
  const navigate = useNavigate();
  const { data, isLoading, isFetching, error, refetch } = useAudit();

  const [moduleFilter, setModuleFilter] = useState<ModuleFilter>("all");
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
  const [search, setSearch] = useState("");
  const [openModules, setOpenModules] = useState<AuditModuleId[]>([]);

  const issues = data?.issues ?? [];
  const summary = data?.summary;

  const filteredIssues = useMemo(() => {
    const term = search.trim().toLowerCase();
    return issues.filter((issue) => {
      if (moduleFilter !== "all" && issue.module !== moduleFilter) return false;
      if (severityFilter !== "all" && issue.severity !== severityFilter) return false;
      if (term && !issue.entity_label.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [issues, moduleFilter, severityFilter, search]);

  const issuesByModule = useMemo(() => {
    const map = new Map<AuditModuleId, AuditIssue[]>();
    for (const issue of filteredIssues) {
      const arr = map.get(issue.module) ?? [];
      arr.push(issue);
      map.set(issue.module, arr);
    }
    return map;
  }, [filteredIssues]);

  const toggleModule = (moduleId: AuditModuleId) => {
    setOpenModules((prev) =>
      prev.includes(moduleId) ? prev.filter((m) => m !== moduleId) : [...prev, moduleId],
    );
  };

  const handleRefresh = () => {
    refetch();
  };

  const headerActions = (
    <Button
      onClick={handleRefresh}
      disabled={isFetching}
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

  if (isLoading) {
    return (
      <MainLayout
        title="Auditoria"
        description="Encontre dados faltantes ou inconsistentes nos seus módulos"
        actions={headerActions}
      >
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </MainLayout>
    );
  }

  if (error) {
    return (
      <MainLayout
        title="Auditoria"
        description="Encontre dados faltantes ou inconsistentes nos seus módulos"
        actions={headerActions}
      >
        <Card>
          <CardContent className="py-10 text-center space-y-2">
            <AlertCircle className="h-10 w-10 mx-auto text-destructive" />
            <p className="text-sm text-muted-foreground" data-testid="text-audit-error">
              Não foi possível executar a auditoria. Tente novamente.
            </p>
            <Button onClick={handleRefresh} data-testid="button-retry-audit">
              Tentar novamente
            </Button>
          </CardContent>
        </Card>
      </MainLayout>
    );
  }

  return (
    <MainLayout
      title="Auditoria"
      description="Encontre dados faltantes ou inconsistentes nos seus módulos"
      actions={headerActions}
    >
      <div className="space-y-6">
        {/* Resumo */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card data-testid="card-summary-total">
            <CardHeader className="pb-2">
              <CardDescription>Total de problemas</CardDescription>
              <CardTitle className="text-3xl" data-testid="text-summary-total">
                {summary?.total_issues ?? 0}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                Atualizado em {data?.generated_at ? new Date(data.generated_at).toLocaleString("pt-BR") : "-"}
              </p>
            </CardContent>
          </Card>

          <Card data-testid="card-summary-obrigatorio">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-destructive" />
                Obrigatórios
              </CardDescription>
              <CardTitle className="text-3xl text-destructive" data-testid="text-summary-obrigatorio">
                {summary?.obrigatorio ?? 0}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                Campos essenciais que precisam ser preenchidos.
              </p>
            </CardContent>
          </Card>

          <Card data-testid="card-summary-recomendado">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                Recomendados
              </CardDescription>
              <CardTitle className="text-3xl text-amber-600" data-testid="text-summary-recomendado">
                {summary?.recomendado ?? 0}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                Campos opcionais que melhoram relatórios e integrações.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Resumo por módulo */}
        <Card data-testid="card-summary-by-module">
          <CardHeader>
            <CardTitle className="text-base">Por módulo</CardTitle>
            <CardDescription>Quantidade de problemas por área do sistema.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
              {summary?.by_module.map((m) => (
                <div
                  key={m.module}
                  className="flex items-center justify-between rounded-md border p-3"
                  data-testid={`summary-module-${m.module}`}
                >
                  <div>
                    <p className="font-medium text-sm">{m.module_label}</p>
                    <p className="text-xs text-muted-foreground">
                      {m.obrigatorio} obrigatório(s) · {m.recomendado} recomendado(s)
                    </p>
                  </div>
                  <Badge variant={m.total > 0 ? "secondary" : "outline"} data-testid={`badge-module-total-${m.module}`}>
                    {m.total}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Filtros */}
        <Card>
          <CardContent className="pt-6">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome do registro"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                  data-testid="input-search-audit"
                />
              </div>
              <Select value={moduleFilter} onValueChange={(v) => setModuleFilter(v as ModuleFilter)}>
                <SelectTrigger data-testid="select-module-filter">
                  <SelectValue placeholder="Todos os módulos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os módulos</SelectItem>
                  {AUDIT_MODULES.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={severityFilter} onValueChange={(v) => setSeverityFilter(v as SeverityFilter)}>
                <SelectTrigger data-testid="select-severity-filter">
                  <SelectValue placeholder="Todas as severidades" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as severidades</SelectItem>
                  <SelectItem value="obrigatorio">Obrigatórios</SelectItem>
                  <SelectItem value="recomendado">Recomendados</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Lista por módulo */}
        {filteredIssues.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center space-y-2">
              <CheckCircle2 className="h-10 w-10 mx-auto text-green-600" />
              <p className="font-medium" data-testid="text-no-issues">
                Nenhum problema encontrado com os filtros atuais.
              </p>
              <p className="text-sm text-muted-foreground">
                Tudo certo por aqui — ou ajuste os filtros para investigar mais.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {AUDIT_MODULES.map((m) => {
              const list = issuesByModule.get(m.id);
              if (!list || list.length === 0) return null;
              const isOpen = openModules.includes(m.id);
              const obrigatorios = list.filter((i) => i.severity === "obrigatorio").length;
              const recomendados = list.filter((i) => i.severity === "recomendado").length;

              return (
                <Card key={m.id} data-testid={`card-module-${m.id}`}>
                  <Collapsible open={isOpen} onOpenChange={() => toggleModule(m.id)}>
                    <CollapsibleTrigger asChild>
                      <button
                        type="button"
                        className="w-full flex items-center justify-between p-4 hover-elevate text-left"
                        data-testid={`button-toggle-module-${m.id}`}
                      >
                        <div className="flex items-center gap-3">
                          {isOpen ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                          <div>
                            <p className="font-medium">{m.label}</p>
                            <p className="text-xs text-muted-foreground">
                              {list.length} problema(s) · {obrigatorios} obrigatório(s), {recomendados} recomendado(s)
                            </p>
                          </div>
                        </div>
                        <Badge variant="secondary" data-testid={`badge-issues-${m.id}`}>
                          {list.length}
                        </Badge>
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="border-t divide-y">
                        {list.map((issue) => (
                          <div
                            key={issue.id}
                            className="p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3"
                            data-testid={`row-issue-${issue.id}`}
                          >
                            <div className="space-y-1 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs text-muted-foreground">
                                  {issue.entity_type}
                                </span>
                                <Badge
                                  variant={issue.severity === "obrigatorio" ? "destructive" : "secondary"}
                                  className={
                                    issue.severity === "recomendado"
                                      ? "bg-amber-100 text-amber-800 hover:bg-amber-100"
                                      : ""
                                  }
                                  data-testid={`badge-severity-${issue.id}`}
                                >
                                  {issue.severity === "obrigatorio" ? "Obrigatório" : "Recomendado"}
                                </Badge>
                              </div>
                              <p className="font-medium" data-testid={`text-entity-${issue.id}`}>
                                {issue.entity_label}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                Faltando:{" "}
                                <span className="text-foreground" data-testid={`text-missing-${issue.id}`}>
                                  {issue.missing_fields.join(", ")}
                                </span>
                              </p>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => navigate(issue.fix_path)}
                              data-testid={`button-fix-${issue.id}`}
                            >
                              <Wrench className="h-4 w-4 mr-2" />
                              Corrigir
                            </Button>
                          </div>
                        ))}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
