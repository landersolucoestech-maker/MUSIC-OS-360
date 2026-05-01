export type AuditSeverity = "obrigatorio" | "recomendado";

export type AuditModuleId =
  | "artistas"
  | "clientes"
  | "contratos"
  | "lancamentos"
  | "fonogramas"
  | "obras"
  | "notas_fiscais"
  | "transacoes"
  | "campanhas"
  | "conteudos";

export interface AuditModuleInfo {
  id: AuditModuleId;
  label: string;
}

export interface AuditIssue {
  id: string;
  module: AuditModuleId;
  module_label: string;
  entity_type: string;
  entity_id: string;
  entity_label: string;
  missing_fields: string[];
  severity: AuditSeverity;
  fix_path: string;
}

export interface AuditModuleSummary {
  module: AuditModuleId;
  module_label: string;
  total: number;
  obrigatorio: number;
  recomendado: number;
}

export interface AuditSummary {
  total_issues: number;
  obrigatorio: number;
  recomendado: number;
  by_module: AuditModuleSummary[];
}

export interface AuditResult {
  generated_at: string;
  summary: AuditSummary;
  issues: AuditIssue[];
}

export const AUDIT_MODULES: AuditModuleInfo[] = [
  { id: "artistas", label: "Artistas" },
  { id: "clientes", label: "CRM / Clientes" },
  { id: "contratos", label: "Contratos" },
  { id: "lancamentos", label: "Lançamentos" },
  { id: "fonogramas", label: "Catálogo / Fonogramas" },
  { id: "obras", label: "Catálogo / Obras" },
  { id: "notas_fiscais", label: "Financeiro / Notas Fiscais" },
  { id: "transacoes", label: "Financeiro / Transações" },
  { id: "campanhas", label: "Marketing / Campanhas" },
  { id: "conteudos", label: "Marketing / Calendário de Conteúdo" },
];

export const MODULE_LABEL: Record<AuditModuleId, string> = AUDIT_MODULES.reduce(
  (acc, m) => {
    acc[m.id] = m.label;
    return acc;
  },
  {} as Record<AuditModuleId, string>,
);
