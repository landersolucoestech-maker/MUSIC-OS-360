export type AuditSeverity = "obrigatorio" | "recomendado";

export type AuditModuleId =
  | "artistas"
  | "catalog"
  | "contracts"
  | "crm"
  | "events"
  | "accounting"
  | "inventory"
  | "leads"
  | "licensing"
  | "marketing"
  | "monitoring"
  | "projects"
  | "lancamentos"
  | "rh";

export interface AuditIssue {
  id: string;
  module: AuditModuleId;
  severity: AuditSeverity;
  entity_type: string;
  entity_label: string;
  missing_fields: string[];
  fix_path: string;
}

export interface AuditRecord {
  id: string;
  module: AuditModuleId;
  entity_type: string;
  entity_label: string;
  missing_fields: string[];
  recommended_missing_fields: string[];
  fix_path: string;
  completeness: number;
  is_complete: boolean;
}

export interface AuditModuleSummary {
  module: AuditModuleId;
  total_records: number;
  complete_records: number;
  incomplete_records: number;
}

export interface AuditSummary {
  total_issues: number;
  obrigatorio: number;
  recomendado: number;
  total_records: number;
  complete_records: number;
  incomplete_records: number;
  completion_rate: number;
}

export interface AuditResult {
  issues: AuditIssue[];
  records: AuditRecord[];
  modules: AuditModuleSummary[];
  summary: AuditSummary;
  generated_at: string;
}

export const AUDIT_MODULES: { id: AuditModuleId; label: string }[] = [
  { id: "artistas", label: "Artistas" },
  { id: "catalog", label: "Catálogo" },
  { id: "contracts", label: "Contratos" },
  { id: "crm", label: "CRM" },
  { id: "events", label: "Eventos" },
  { id: "accounting", label: "Accounting" },
  { id: "inventory", label: "Inventário" },
  { id: "leads", label: "Leads" },
  { id: "licensing", label: "Licenciamento" },
  { id: "marketing", label: "Marketing" },
  { id: "monitoring", label: "Monitoramento" },
  { id: "projects", label: "Projetos" },
  { id: "lancamentos", label: "Lançamentos" },
  { id: "rh", label: "RH" },
];

