import { MOCK_DATA } from "@/data/mockData";
import { AUDIT_RULES, evaluateRow } from "./rules";
import type {
  AuditIssue,
  AuditModuleId,
  AuditModuleSummary,
  AuditResult,
  AuditSummary,
} from "./types";
import { AUDIT_MODULES, MODULE_LABEL } from "./types";

const TABLE_BY_MODULE: Record<AuditModuleId, string> = {
  artistas: "artistas",
  clientes: "clientes",
  contratos: "contratos",
  lancamentos: "lancamentos",
  fonogramas: "fonogramas",
  obras: "obras",
  notas_fiscais: "notas_fiscais",
  transacoes: "transacoes",
  campanhas: "campanhas",
  conteudos: "conteudos",
};

function fetchModule(table: string): Record<string, unknown>[] {
  const rows = MOCK_DATA[table];
  if (!Array.isArray(rows)) return [];
  return rows as Record<string, unknown>[];
}

export async function runAudit(): Promise<AuditResult> {
  const issues: AuditIssue[] = [];

  for (const rule of AUDIT_RULES) {
    const table = TABLE_BY_MODULE[rule.module];
    const rows = fetchModule(table);
    for (const row of rows) {
      const rowIssues = evaluateRow(rule, row);
      issues.push(...rowIssues);
    }
  }

  const summary = buildSummary(issues);

  return {
    generated_at: new Date().toISOString(),
    summary,
    issues,
  };
}

function buildSummary(issues: AuditIssue[]): AuditSummary {
  const byModuleMap = new Map<AuditModuleId, AuditModuleSummary>();
  for (const m of AUDIT_MODULES) {
    byModuleMap.set(m.id, {
      module: m.id,
      module_label: m.label,
      total: 0,
      obrigatorio: 0,
      recomendado: 0,
    });
  }

  let total = 0;
  let obrigatorio = 0;
  let recomendado = 0;

  for (const issue of issues) {
    total++;
    const bucket = byModuleMap.get(issue.module);
    if (bucket) {
      bucket.total++;
      if (issue.severity === "obrigatorio") bucket.obrigatorio++;
      else bucket.recomendado++;
    }
    if (issue.severity === "obrigatorio") obrigatorio++;
    else recomendado++;
  }

  return {
    total_issues: total,
    obrigatorio,
    recomendado,
    by_module: Array.from(byModuleMap.values()),
  };
}

export { MODULE_LABEL };
