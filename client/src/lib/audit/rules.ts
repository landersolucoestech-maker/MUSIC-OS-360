import type { AuditIssue, AuditModuleId, AuditSeverity } from "./types";
import { MODULE_LABEL } from "./types";

type Row = Record<string, unknown>;

interface FieldRule {
  field: string;
  label: string;
  severity: AuditSeverity;
  check?: (row: Row) => boolean;
}

interface ModuleRule {
  module: AuditModuleId;
  entity_type: string;
  fix_path: (row: Row) => string;
  entity_label: (row: Row) => string;
  rules: FieldRule[];
}

function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "object") return Object.keys(value as object).length === 0;
  return false;
}

function isMissing(row: Row, field: string): boolean {
  return isEmpty(row[field]);
}

function isInvalidNumber(row: Row, field: string): boolean {
  const v = row[field];
  if (v === null || v === undefined) return true;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isNaN(n) || n <= 0;
}

export const AUDIT_RULES: ModuleRule[] = [
  {
    module: "artistas",
    entity_type: "Artista",
    fix_path: (row) => `/artistas/${row.id}/editar`,
    entity_label: (row) =>
      (row.nome_artistico as string) || (row.nome_civil as string) || "Artista sem nome",
    rules: [
      { field: "nome_artistico", label: "Nome artístico", severity: "obrigatorio" },
      { field: "tipo", label: "Tipo (artista/banda)", severity: "obrigatorio" },
      { field: "status", label: "Status", severity: "obrigatorio" },
      { field: "email", label: "E-mail", severity: "recomendado" },
      { field: "telefone", label: "Telefone", severity: "recomendado" },
      { field: "genero_musical", label: "Gênero musical", severity: "recomendado" },
      {
        field: "spotify_artist_id",
        label: "ID do Spotify",
        severity: "recomendado",
      },
    ],
  },
  {
    module: "clientes",
    entity_type: "Cliente",
    fix_path: (row) => `/crm?edit=${row.id}`,
    entity_label: (row) => (row.nome as string) || "Cliente sem nome",
    rules: [
      { field: "nome", label: "Nome", severity: "obrigatorio" },
      { field: "tipo_pessoa", label: "Tipo de pessoa", severity: "obrigatorio" },
      { field: "status", label: "Status", severity: "obrigatorio" },
      {
        field: "email_or_telefone",
        label: "E-mail ou telefone",
        severity: "recomendado",
        check: (row) => isMissing(row, "email") && isMissing(row, "telefone"),
      },
      { field: "cpf_cnpj", label: "CPF/CNPJ", severity: "recomendado" },
    ],
  },
  {
    module: "contratos",
    entity_type: "Contrato",
    fix_path: (row) => `/contratos?edit=${row.id}`,
    entity_label: (row) => (row.titulo as string) || `Contrato ${String(row.id).slice(0, 8)}`,
    rules: [
      { field: "titulo", label: "Título", severity: "obrigatorio" },
      { field: "tipo", label: "Tipo", severity: "obrigatorio" },
      { field: "status", label: "Status", severity: "obrigatorio" },
      { field: "data_inicio", label: "Data de início", severity: "obrigatorio" },
      { field: "data_fim", label: "Data de término", severity: "obrigatorio" },
      {
        field: "parte",
        label: "Artista ou cliente vinculado",
        severity: "obrigatorio",
        check: (row) => isMissing(row, "artista_id") && isMissing(row, "cliente_id"),
      },
      {
        field: "valor",
        label: "Valor",
        severity: "recomendado",
        check: (row) => isInvalidNumber(row, "valor"),
      },
    ],
  },
  {
    module: "lancamentos",
    entity_type: "Lançamento",
    fix_path: (row) => `/lancamentos?edit=${row.id}`,
    entity_label: (row) => (row.titulo as string) || `Lançamento ${String(row.id).slice(0, 8)}`,
    rules: [
      { field: "titulo", label: "Título", severity: "obrigatorio" },
      { field: "tipo", label: "Tipo", severity: "obrigatorio" },
      { field: "status", label: "Status", severity: "obrigatorio" },
      { field: "data_lancamento", label: "Data de lançamento", severity: "obrigatorio" },
      { field: "artista_id", label: "Artista vinculado", severity: "recomendado" },
      { field: "distribuidora", label: "Distribuidora", severity: "recomendado" },
      {
        field: "plataformas",
        label: "Plataformas de distribuição",
        severity: "recomendado",
      },
      {
        field: "fonograma_ids",
        label: "Fonogramas associados",
        severity: "recomendado",
      },
    ],
  },
  {
    module: "fonogramas",
    entity_type: "Fonograma",
    fix_path: (row) => `/registro-musicas?fonograma=${row.id}`,
    entity_label: (row) => (row.titulo as string) || `Fonograma ${String(row.id).slice(0, 8)}`,
    rules: [
      { field: "titulo", label: "Título", severity: "obrigatorio" },
      { field: "status", label: "Status", severity: "obrigatorio" },
      { field: "isrc", label: "ISRC", severity: "recomendado" },
      { field: "artista_id", label: "Artista vinculado", severity: "recomendado" },
      { field: "obra_id", label: "Obra vinculada", severity: "recomendado" },
      { field: "genero_musical", label: "Gênero musical", severity: "recomendado" },
      {
        field: "duracao_completa",
        label: "Duração",
        severity: "recomendado",
        check: (row) =>
          isMissing(row, "duracao") &&
          (isMissing(row, "duracao_min") || isMissing(row, "duracao_seg")),
      },
      {
        field: "participacao",
        label: "Participações",
        severity: "recomendado",
      },
    ],
  },
  {
    module: "obras",
    entity_type: "Obra",
    fix_path: (row) => `/registro-musicas?editObra=${row.id}`,
    entity_label: (row) => (row.titulo as string) || `Obra ${String(row.id).slice(0, 8)}`,
    rules: [
      { field: "titulo", label: "Título", severity: "obrigatorio" },
      { field: "tipo_obra", label: "Tipo de obra", severity: "obrigatorio" },
      { field: "status", label: "Status", severity: "obrigatorio" },
      { field: "iswc", label: "ISWC", severity: "recomendado" },
      { field: "artista_id", label: "Artista vinculado", severity: "recomendado" },
      { field: "compositores", label: "Compositores", severity: "recomendado" },
    ],
  },
  {
    module: "notas_fiscais",
    entity_type: "Nota Fiscal",
    fix_path: (row) => `/nota-fiscal?edit=${row.id}`,
    entity_label: (row) =>
      row.numero ? `NF nº ${row.numero}` : `NF ${String(row.id).slice(0, 8)}`,
    rules: [
      { field: "numero", label: "Número", severity: "obrigatorio" },
      { field: "status", label: "Status", severity: "obrigatorio" },
      {
        field: "valor",
        label: "Valor",
        severity: "obrigatorio",
        check: (row) => isInvalidNumber(row, "valor"),
      },
      { field: "data_emissao", label: "Data de emissão", severity: "recomendado" },
      { field: "cliente_id", label: "Cliente vinculado", severity: "recomendado" },
      { field: "url_pdf", label: "PDF anexado", severity: "recomendado" },
    ],
  },
  {
    module: "transacoes",
    entity_type: "Transação",
    fix_path: (row) => `/financeiro?edit=${row.id}`,
    entity_label: (row) =>
      (row.descricao as string) || `Transação ${String(row.id).slice(0, 8)}`,
    rules: [
      { field: "descricao", label: "Descrição", severity: "obrigatorio" },
      { field: "tipo", label: "Tipo (entrada/saída)", severity: "obrigatorio" },
      { field: "categoria", label: "Categoria", severity: "obrigatorio" },
      { field: "data", label: "Data", severity: "obrigatorio" },
      {
        field: "valor",
        label: "Valor",
        severity: "obrigatorio",
        check: (row) => isInvalidNumber(row, "valor"),
      },
      {
        field: "vinculo",
        label: "Artista ou cliente vinculado",
        severity: "recomendado",
        check: (row) => isMissing(row, "artista_id") && isMissing(row, "cliente_id"),
      },
    ],
  },
  {
    module: "campanhas",
    entity_type: "Campanha",
    fix_path: (row) => `/marketing/campanhas?edit=${row.id}`,
    entity_label: (row) => (row.nome as string) || `Campanha ${String(row.id).slice(0, 8)}`,
    rules: [
      { field: "nome", label: "Nome", severity: "obrigatorio" },
      { field: "status", label: "Status", severity: "obrigatorio" },
      { field: "artista_id", label: "Artista vinculado", severity: "recomendado" },
      { field: "data_inicio", label: "Data de início", severity: "recomendado" },
      { field: "data_fim", label: "Data de término", severity: "recomendado" },
      { field: "plataforma", label: "Plataforma", severity: "recomendado" },
      {
        field: "orcamento",
        label: "Orçamento",
        severity: "recomendado",
        check: (row) => isInvalidNumber(row, "orcamento"),
      },
    ],
  },
  {
    module: "conteudos",
    entity_type: "Conteúdo",
    fix_path: (row) => `/marketing/calendario?edit=${row.id}`,
    entity_label: (row) => (row.titulo as string) || `Conteúdo ${String(row.id).slice(0, 8)}`,
    rules: [
      { field: "titulo", label: "Título", severity: "obrigatorio" },
      { field: "status", label: "Status", severity: "obrigatorio" },
      { field: "data_publicacao", label: "Data de publicação", severity: "recomendado" },
      { field: "plataforma", label: "Plataforma", severity: "recomendado" },
      { field: "tipo_conteudo", label: "Tipo de conteúdo", severity: "recomendado" },
    ],
  },
];

export function evaluateRow(rule: ModuleRule, row: Row): AuditIssue[] {
  const obrigatorios: string[] = [];
  const recomendados: string[] = [];

  for (const fr of rule.rules) {
    const failed = fr.check ? fr.check(row) : isMissing(row, fr.field);
    if (failed) {
      if (fr.severity === "obrigatorio") obrigatorios.push(fr.label);
      else recomendados.push(fr.label);
    }
  }

  const issues: AuditIssue[] = [];
  const baseId = String(row.id ?? Math.random());

  if (obrigatorios.length > 0) {
    issues.push({
      id: `${rule.module}:${baseId}:obrigatorio`,
      module: rule.module,
      module_label: MODULE_LABEL[rule.module],
      entity_type: rule.entity_type,
      entity_id: baseId,
      entity_label: rule.entity_label(row),
      missing_fields: obrigatorios,
      severity: "obrigatorio",
      fix_path: rule.fix_path(row),
    });
  }
  if (recomendados.length > 0) {
    issues.push({
      id: `${rule.module}:${baseId}:recomendado`,
      module: rule.module,
      module_label: MODULE_LABEL[rule.module],
      entity_type: rule.entity_type,
      entity_id: baseId,
      entity_label: rule.entity_label(row),
      missing_fields: recomendados,
      severity: "recomendado",
      fix_path: rule.fix_path(row),
    });
  }
  return issues;
}
