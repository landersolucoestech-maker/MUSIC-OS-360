import { storage, type StorageRow } from "@/shared/lib/storage";
import type {
  AuditIssue,
  AuditModuleId,
  AuditModuleSummary,
  AuditRecord,
  AuditResult,
} from "./types";

type FieldRule = {
  key: string;
  label: string;
  severity: "obrigatorio" | "recomendado";
};

type AuditConfig = {
  module: AuditModuleId;
  table: string;
  entityType: string;
  fixPath: (row: StorageRow) => string;
  label: (row: StorageRow) => string;
  fields: FieldRule[];
};

const hasValue = (value: unknown): boolean => {
  if (value == null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
};

const firstValue = (row: StorageRow, keys: string[]) =>
  keys.map((key) => row[key]).find(hasValue);

const entityLabel = (row: StorageRow, keys: string[], fallback: string) =>
  String(firstValue(row, keys) ?? fallback);

const editPath = (path: string, row: StorageRow) => `${path}?edit=${row.id}`;

const CONFIGS: AuditConfig[] = [
  {
    module: "artistas",
    table: "artistas",
    entityType: "Artista",
    fixPath: (row) => editPath("/artistas", row),
    label: (row) => entityLabel(row, ["nome_artistico", "nome_civil", "email"], "Artista sem nome"),
    fields: [
      { key: "nome_artistico", label: "Nome artístico", severity: "obrigatorio" },
      { key: "genero_musical", label: "Gênero musical", severity: "obrigatorio" },
      { key: "email", label: "E-mail", severity: "obrigatorio" },
      { key: "telefone", label: "Telefone", severity: "recomendado" },
      { key: "cpf_cnpj", label: "CPF/CNPJ", severity: "recomendado" },
      { key: "status", label: "Status", severity: "recomendado" },
    ],
  },
  {
    module: "projects",
    table: "projects",
    entityType: "Projeto",
    fixPath: (row) => editPath("/projetos", row),
    label: (row) => entityLabel(row, ["title", "nome"], "Projeto sem título"),
    fields: [
      { key: "title", label: "Título", severity: "obrigatorio" },
      { key: "type", label: "Tipo", severity: "obrigatorio" },
      { key: "status", label: "Status", severity: "obrigatorio" },
      { key: "genero", label: "Gênero musical", severity: "recomendado" },
      { key: "artist_id", label: "Artista vinculado", severity: "recomendado" },
    ],
  },
  {
    module: "catalog",
    table: "obras",
    entityType: "Obra",
    fixPath: (row) => `/registro-musicas?editObra=${row.id}`,
    label: (row) => entityLabel(row, ["title", "iswc", "cod_ecad"], "Obra sem título"),
    fields: [
      { key: "title", label: "Título", severity: "obrigatorio" },
      { key: "compositores|compositor", label: "Compositores", severity: "obrigatorio" },
      { key: "genero", label: "Gênero", severity: "recomendado" },
      { key: "iswc", label: "ISWC", severity: "recomendado" },
      { key: "cod_ecad", label: "Código ECAD", severity: "recomendado" },
    ],
  },
  {
    module: "catalog",
    table: "fonogramas",
    entityType: "Fonograma",
    fixPath: (row) => `/registro-musicas?editFonograma=${row.id}`,
    label: (row) => entityLabel(row, ["title", "nome", "isrc"], "Fonograma sem título"),
    fields: [
      { key: "title", label: "Título", severity: "obrigatorio" },
      { key: "isrc", label: "ISRC", severity: "obrigatorio" },
      { key: "artist_id", label: "Artista vinculado", severity: "recomendado" },
      { key: "work_id", label: "Obra vinculada", severity: "recomendado" },
      { key: "genero_musical", label: "Gênero musical", severity: "recomendado" },
    ],
  },
  {
    module: "lancamentos",
    table: "lancamentos",
    entityType: "Lançamento",
    fixPath: (row) => editPath("/lancamentos", row),
    label: (row) => entityLabel(row, ["title", "upc", "isrc_global"], "Lançamento sem título"),
    fields: [
      { key: "title", label: "Título", severity: "obrigatorio" },
      { key: "type", label: "Tipo", severity: "obrigatorio" },
      { key: "status", label: "Status", severity: "obrigatorio" },
      { key: "artist_id", label: "Artista vinculado", severity: "obrigatorio" },
      { key: "data_lancamento", label: "Data de lançamento", severity: "recomendado" },
      { key: "distribuidora", label: "Distribuidora", severity: "recomendado" },
      { key: "plataformas", label: "Plataformas", severity: "recomendado" },
    ],
  },
  {
    module: "contracts",
    table: "contracts",
    entityType: "Contrato",
    fixPath: (row) => editPath("/contratos", row),
    label: (row) => entityLabel(row, ["title", "type"], "Contrato sem título"),
    fields: [
      { key: "title", label: "Título", severity: "obrigatorio" },
      { key: "type", label: "Tipo", severity: "obrigatorio" },
      { key: "status", label: "Status", severity: "obrigatorio" },
      { key: "start_date", label: "Data de início", severity: "recomendado" },
      { key: "end_date", label: "Data de fim", severity: "recomendado" },
      { key: "arquivo_url", label: "Arquivo do contrato", severity: "recomendado" },
    ],
  },
  {
    module: "accounting",
    table: "transactions",
    entityType: "Transação",
    fixPath: (row) => editPath("/accounting", row),
    label: (row) => entityLabel(row, ["descricao", "categoria"], "Transação sem descrição"),
    fields: [
      { key: "descricao", label: "Descrição", severity: "obrigatorio" },
      { key: "type", label: "Tipo", severity: "obrigatorio" },
      { key: "categoria", label: "Categoria", severity: "obrigatorio" },
      { key: "valor", label: "Valor", severity: "obrigatorio" },
      { key: "data", label: "Data", severity: "obrigatorio" },
      { key: "status", label: "Status", severity: "recomendado" },
    ],
  },
  {
    module: "events",
    table: "events",
    entityType: "Evento",
    fixPath: (row) => editPath("/agenda", row),
    label: (row) => entityLabel(row, ["title", "nome", "local"], "Evento sem título"),
    fields: [
      { key: "title", label: "Título", severity: "obrigatorio" },
      { key: "start_date", label: "Data de início", severity: "obrigatorio" },
      { key: "local", label: "Local", severity: "recomendado" },
      { key: "artist_id", label: "Artista vinculado", severity: "recomendado" },
    ],
  },
  {
    module: "inventory",
    table: "inventario",
    entityType: "Item de inventário",
    fixPath: (row) => editPath("/inventario", row),
    label: (row) => entityLabel(row, ["nome", "title", "categoria"], "Item sem nome"),
    fields: [
      { key: "nome", label: "Nome", severity: "obrigatorio" },
      { key: "categoria", label: "Categoria", severity: "obrigatorio" },
      { key: "status", label: "Status", severity: "obrigatorio" },
      { key: "valor", label: "Valor", severity: "recomendado" },
      { key: "localizacao", label: "Localização", severity: "recomendado" },
    ],
  },
  {
    module: "crm",
    table: "clientes",
    entityType: "Cliente/Contato",
    fixPath: (row) => editPath("/crm", row),
    label: (row) => entityLabel(row, ["nome", "razao_social", "email"], "Contato sem nome"),
    fields: [
      { key: "nome", label: "Nome", severity: "obrigatorio" },
      { key: "email", label: "E-mail", severity: "recomendado" },
      { key: "telefone", label: "Telefone", severity: "recomendado" },
      { key: "segmento", label: "Segmento", severity: "recomendado" },
      { key: "status", label: "Status", severity: "recomendado" },
    ],
  },
  {
    module: "leads",
    table: "leads",
    entityType: "Lead",
    fixPath: (row) => editPath("/crm", row),
    label: (row) => entityLabel(row, ["nome", "nome_contratante", "email"], "Lead sem nome"),
    fields: [
      { key: "nome", label: "Nome", severity: "obrigatorio" },
      { key: "email", label: "E-mail", severity: "obrigatorio" },
      { key: "telefone", label: "Telefone", severity: "recomendado" },
      { key: "origem_lead", label: "Origem", severity: "recomendado" },
      { key: "status_lead", label: "Status", severity: "recomendado" },
    ],
  },
  {
    module: "licensing",
    table: "licencas",
    entityType: "Licença",
    fixPath: (row) => editPath("/licenciamento", row),
    label: (row) => entityLabel(row, ["title", "cliente", "projeto"], "Licença sem título"),
    fields: [
      { key: "title", label: "Título", severity: "obrigatorio" },
      { key: "cliente", label: "Cliente", severity: "obrigatorio" },
      { key: "valor", label: "Valor", severity: "recomendado" },
      { key: "status", label: "Status", severity: "recomendado" },
    ],
  },
  {
    module: "rh",
    table: "funcionarios",
    entityType: "Funcionário",
    fixPath: (row) => editPath("/rh", row),
    label: (row) => entityLabel(row, ["nome", "email", "cargo"], "Funcionário sem nome"),
    fields: [
      { key: "nome", label: "Nome completo", severity: "obrigatorio" },
      { key: "email", label: "E-mail", severity: "obrigatorio" },
      { key: "cpf", label: "CPF", severity: "recomendado" },
      { key: "telefone", label: "Telefone", severity: "recomendado" },
      { key: "cargo", label: "Cargo", severity: "recomendado" },
    ],
  },
];

function missingLabels(row: StorageRow, fields: FieldRule[], severity: FieldRule["severity"]): string[] {
  return fields
    .filter((field) => {
      const keys = field.key.split("|");
      return field.severity === severity && !keys.some((key) => hasValue(row[key]));
    })
    .map((field) => field.label);
}

function buildRecord(config: AuditConfig, row: StorageRow): AuditRecord {
  const requiredMissing = missingLabels(row, config.fields, "obrigatorio");
  const recommendedMissing = missingLabels(row, config.fields, "recomendado");
  const filled = config.fields.length - requiredMissing.length - recommendedMissing.length;
  return {
    id: `${config.table}-${row.id}`,
    module: config.module,
    entity_type: config.entityType,
    entity_label: config.label(row),
    missing_fields: requiredMissing,
    recommended_missing_fields: recommendedMissing,
    fix_path: config.fixPath(row),
    completeness: config.fields.length === 0 ? 100 : Math.round((filled / config.fields.length) * 100),
    is_complete: requiredMissing.length === 0 && recommendedMissing.length === 0,
  };
}

export async function runAudit(): Promise<AuditResult> {
  const records: AuditRecord[] = [];

  for (const config of CONFIGS) {
    let rows: StorageRow[] = [];
    try {
      rows = await storage.list<StorageRow>(config.table, {
        orderBy: { column: "updated_at", ascending: false },
      });
    } catch {
      rows = [];
    }
    records.push(...rows.map((row) => buildRecord(config, row)));
  }

  const issues: AuditIssue[] = records.flatMap((record) => {
    const required = record.missing_fields.length > 0
      ? [{
          id: `${record.id}-required`,
          module: record.module,
          severity: "obrigatorio" as const,
          entity_type: record.entity_type,
          entity_label: record.entity_label,
          missing_fields: record.missing_fields,
          fix_path: record.fix_path,
        }]
      : [];

    const recommended = record.recommended_missing_fields.length > 0
      ? [{
          id: `${record.id}-recommended`,
          module: record.module,
          severity: "recomendado" as const,
          entity_type: record.entity_type,
          entity_label: record.entity_label,
          missing_fields: record.recommended_missing_fields,
          fix_path: record.fix_path,
        }]
      : [];

    return [...required, ...recommended];
  });

  const modules: AuditModuleSummary[] = CONFIGS.reduce<AuditModuleSummary[]>((acc, config) => {
    if (acc.some((item) => item.module === config.module)) return acc;
    const moduleRecords = records.filter((record) => record.module === config.module);
    acc.push({
      module: config.module,
      total_records: moduleRecords.length,
      complete_records: moduleRecords.filter((record) => record.is_complete).length,
      incomplete_records: moduleRecords.filter((record) => !record.is_complete).length,
    });
    return acc;
  }, []);

  const completeRecords = records.filter((record) => record.is_complete).length;
  const totalRecords = records.length;

  return {
    issues,
    records,
    modules,
    summary: {
      total_issues: issues.length,
      obrigatorio: issues.filter((issue) => issue.severity === "obrigatorio").length,
      recomendado: issues.filter((issue) => issue.severity === "recomendado").length,
      total_records: totalRecords,
      complete_records: completeRecords,
      incomplete_records: totalRecords - completeRecords,
      completion_rate: totalRecords === 0 ? 0 : Math.round((completeRecords / totalRecords) * 100),
    },
    generated_at: new Date().toISOString(),
  };
}

