/**
 * modules/reports/pages/Relatorios.tsx  ·  PHASE 2.5
 *
 * Reports Center — consumes ONLY the API (GET /reports/entities,
 * GET /reports/definitions). No fixed list, no mock, no registry/contract/
 * label on the frontend. The backend is the only source of truth.
 */
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { MainLayout } from "@/shared/components/MainLayout";
import { Card, CardContent } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { Upload, Download, AlertTriangle, Loader2, Database } from "lucide-react";
import { useReportEntities, useReportDefinitions, useReportExport } from "../hooks/useReports";
import { ImportDialog } from "../components/ImportDialog";
import type { ReportEntityDefinition } from "../services/reports-api";

import { toUserMessage } from "@/shared/lib/errors";
export default function Relatorios() {
  const entitiesQ = useReportEntities();
  const definitionsQ = useReportDefinitions();
  const exportM = useReportExport();
  const [selected, setSelected] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);

  // Direct export: no intermediate modal/screen. Omitting `columns` makes the
  // backend export ALL the columns of the entity contract, in the official order.
  function runExport(tableName: string) {
    setExporting(tableName);
    exportM.mutate(
      { entity: tableName, params: { format: "xlsx", pageSize: 1000 } },
      {
        onSuccess: () => toast.success("Exportação concluída."),
        onError: (e) => toast.error(toUserMessage(e, "Falha na exportação.")),
        onSettled: () => setExporting(null),
      },
    );
  }

  const defByTable = useMemo(() => {
    const m = new Map<string, ReportEntityDefinition>();
    for (const d of definitionsQ.data ?? []) m.set(d.tableName, d);
    return m;
  }, [definitionsQ.data]);

  const reportable = useMemo(
    () => (entitiesQ.data?.entities ?? []).filter((e) => e.reportable),
    [entitiesQ.data],
  );

  const selectedDef = selected ? defByTable.get(selected) ?? null : null;

  const loading = entitiesQ.isLoading || definitionsQ.isLoading;
  const error = entitiesQ.isError || definitionsQ.isError;

  return (
    <MainLayout title="Relatórios" description="Exportação e importação por entidade — dirigido pelo backend">
      <div className="space-y-6">
        {loading && (
          <div className="flex items-center gap-2 p-8 text-sm text-muted-foreground" data-testid="reports-loading">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando entidades…
          </div>
        )}

        {error && !loading && (
          <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4" data-testid="reports-error">
            <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
            <p className="text-sm text-destructive">Não foi possível carregar as entidades da API.</p>
          </div>
        )}

        {!loading && !error && reportable.length === 0 && (
          <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground" data-testid="reports-empty">
            Nenhuma entidade reportável disponível.
          </div>
        )}

        {!loading && !error && reportable.length > 0 && (
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <div className="divide-y divide-border/50">
              {reportable.map((e) => {
                const def = defByTable.get(e.tableName);
                const unavailable = !def;
                return (
                  <div key={e.tableName} className="flex items-center gap-4 px-4 py-3 hover:bg-muted/20" data-testid={`entity-row-${e.tableName}`}>
                    <div className="p-1.5 rounded-md bg-muted shrink-0">
                      <Database className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground">{e.label ?? e.tableName}</p>
                      {unavailable && (
                        <p className="text-[11px] text-muted-foreground" data-testid={`unavailable-${e.tableName}`}>
                          Temporariamente indisponível
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        size="sm" variant="outline" className="h-7 text-xs gap-1"
                        disabled={!def?.supportsImport}
                        onClick={() => { setSelected(e.tableName); setImportOpen(true); }}
                        data-testid={`btn-import-${e.tableName}`}
                      >
                        <Upload className="h-3 w-3" /> Importar
                      </Button>
                      <Button
                        size="sm" variant="outline" className="h-7 text-xs gap-1"
                        disabled={!def?.supportsExport || exporting === e.tableName}
                        onClick={() => runExport(e.tableName)}
                        data-testid={`btn-export-${e.tableName}`}
                      >
                        {exporting === e.tableName
                          ? <Loader2 className="h-3 w-3 animate-spin" />
                          : <Download className="h-3 w-3" />} Exportar
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} definition={selectedDef} />
    </MainLayout>
  );
}
