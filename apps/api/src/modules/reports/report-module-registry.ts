/**
 * modules/reports/report-module-registry.ts
 *
 * CLOSED and EXPLICIT registry of the modules authorized in the Reports
 * Center. This list — physical key (tableName), displayed label and order —
 * is the ONLY source of truth about what may appear in Reports.
 */

export interface ReportModuleRegistryEntry {
  readonly tableName: string;
  readonly label: string;
  readonly order: number;
  readonly computed?: boolean;
}

export const ACCOUNTING_SUMMARY_TABLE_NAME = 'accounting_summary';

export const REPORT_MODULE_REGISTRY: readonly ReportModuleRegistryEntry[] = [
  { tableName: 'artists', label: 'Artistas', order: 1 },
  { tableName: 'projects', label: 'Projetos', order: 2 },
  { tableName: 'works', label: 'Obras', order: 3 },
  { tableName: 'phonograms', label: 'Fonogramas', order: 4 },
  { tableName: 'content_detections', label: 'Monitoramento', order: 5 },
  { tableName: 'licenses', label: 'Licenciamento', order: 6 },
  { tableName: 'takedowns', label: 'Takedowns', order: 7 },
  { tableName: 'releases', label: 'Distribuição', order: 8 },
  { tableName: 'shares', label: 'Shares', order: 9 },
  { tableName: 'contracts', label: 'Contratos', order: 10 },
  { tableName: 'audiovisual_projects', label: 'Projetos Audiovisuais', order: 11 },
  { tableName: 'transactions', label: 'Transações Financeiras', order: 12 },
  { tableName: ACCOUNTING_SUMMARY_TABLE_NAME, label: 'Contabilidade', order: 13, computed: true },
  { tableName: 'invoices', label: 'Nota Fiscal', order: 14 },
  { tableName: 'events', label: 'Agenda', order: 15 },
  { tableName: 'inventory_items', label: 'Inventário', order: 16 },
  { tableName: 'clients', label: 'Contatos', order: 17 },
  { tableName: 'leads', label: 'Leads', order: 18 },
  { tableName: 'employees', label: 'RH', order: 19 },
  { tableName: 'marketing_tasks', label: 'Tarefas', order: 20 },
  { tableName: 'marketing_content_posts', label: 'Calendário de Conteúdo', order: 21 },
  { tableName: 'briefings', label: 'Briefing', order: 22 },
] as const;

export const REPORT_MODULE_REGISTRY_BY_TABLE: ReadonlyMap<string, ReportModuleRegistryEntry> =
  new Map(REPORT_MODULE_REGISTRY.map((e) => [e.tableName, e]));

export const REPORT_MODULE_TABLE_NAMES: ReadonlySet<string> =
  new Set(REPORT_MODULE_REGISTRY.map((e) => e.tableName));

export const REPORT_MODULE_ORDERED_LABELS: readonly string[] =
  REPORT_MODULE_REGISTRY.slice().sort((a, b) => a.order - b.order).map((e) => e.label);
