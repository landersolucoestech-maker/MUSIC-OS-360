import type { StorageTable } from "@/shared/lib/api-client";
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
  severity: "required" | "recommended";
};

type AuditConfig = {
  module: AuditModuleId;
  table: StorageTable;
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
    module: "artists",
    table: "artists",
    entityType: "Artista",
    fixPath: (row) => editPath("/artists", row),
    label: (row) => entityLabel(row, ["stage_name", "full_name", "email"], "Artista sem nome"),
    fields: [
      { key: "stage_name", label: "Nome artístico", severity: "required" },
      { key: "music_genre", label: "Gênero musical", severity: "required" },
      { key: "email", label: "E-mail", severity: "required" },
      { key: "phone", label: "Telefone", severity: "recommended" },
      { key: "cpf_cnpj", label: "CPF/CNPJ", severity: "recommended" },
      { key: "status", label: "Status", severity: "recommended" },
    ],
  },
  {
    module: "projects",
    table: "projects",
    entityType: "Projeto",
    fixPath: (row) => editPath("/projects", row),
    label: (row) => entityLabel(row, ["title"], "Projeto sem título"),
    fields: [
      { key: "title", label: "Título", severity: "required" },
      { key: "type", label: "Tipo", severity: "required" },
      { key: "status", label: "Status", severity: "required" },
      { key: "music_genre", label: "Gênero musical", severity: "recommended" },
      { key: "artist_id", label: "Artista vinculado", severity: "recommended" },
    ],
  },
  {
    module: "catalog",
    table: "works",
    entityType: "Obra",
    fixPath: (row) => `/music-registration?editWork=${row.id}`,
    label: (row) => entityLabel(row, ["title", "iswc", "ecad_code"], "Obra sem título"),
    fields: [
      { key: "title", label: "Título", severity: "required" },
      { key: "composer_names|composer_name", label: "Compositores", severity: "required" },
      { key: "music_genre", label: "Gênero", severity: "recommended" },
      { key: "iswc", label: "ISWC", severity: "recommended" },
      { key: "ecad_code", label: "Código ECAD", severity: "recommended" },
    ],
  },
  {
    module: "catalog",
    table: "phonograms",
    entityType: "Fonograma",
    fixPath: (row) => `/music-registration?phonogram=${row.id}`,
    label: (row) => entityLabel(row, ["title", "nome", "isrc"], "Fonograma sem título"),
    fields: [
      { key: "title", label: "Título", severity: "required" },
      { key: "isrc", label: "ISRC", severity: "required" },
      { key: "artist_id", label: "Artista vinculado", severity: "recommended" },
      { key: "work_id", label: "Obra vinculada", severity: "recommended" },
      { key: "music_genre", label: "Gênero musical", severity: "recommended" },
    ],
  },
  {
    module: "releases",
    table: "releases",
    entityType: "Lançamento",
    fixPath: (row) => editPath("/releases", row),
    label: (row) => entityLabel(row, ["title", "upc", "isrc_global"], "Lançamento sem título"),
    fields: [
      { key: "title", label: "Título", severity: "required" },
      { key: "type", label: "Tipo", severity: "required" },
      { key: "status", label: "Status", severity: "required" },
      { key: "artist_id", label: "Artista vinculado", severity: "required" },
      { key: "release_date", label: "Data de lançamento", severity: "recommended" },
      { key: "distributor", label: "Distribuidora", severity: "recommended" },
      { key: "platforms", label: "Plataformas", severity: "recommended" },
    ],
  },
  {
    module: "contracts",
    table: "contracts",
    entityType: "Contrato",
    fixPath: (row) => editPath("/contracts", row),
    label: (row) => entityLabel(row, ["title", "type"], "Contrato sem título"),
    fields: [
      { key: "title", label: "Título", severity: "required" },
      { key: "type", label: "Tipo", severity: "required" },
      { key: "status", label: "Status", severity: "required" },
      { key: "start_date", label: "Data de início", severity: "recommended" },
      { key: "end_date", label: "Data de fim", severity: "recommended" },
      { key: "file_url", label: "Arquivo do contrato", severity: "recommended" },
    ],
  },
  {
    module: "accounting",
    table: "transactions",
    entityType: "Transação",
    fixPath: (row) => editPath("/accounting", row),
    label: (row) => entityLabel(row, ["description", "category"], "Transação sem descrição"),
    fields: [
      { key: "description", label: "Descrição", severity: "required" },
      { key: "type", label: "Tipo", severity: "required" },
      { key: "category", label: "Categoria", severity: "required" },
      { key: "amount", label: "Valor", severity: "required" },
      { key: "transaction_date", label: "Data", severity: "required" },
      { key: "status", label: "Status", severity: "recommended" },
    ],
  },
  {
    module: "events",
    table: "events",
    entityType: "Evento",
    fixPath: (row) => editPath("/agenda", row),
    label: (row) => entityLabel(row, ["title", "venue"], "Evento sem título"),
    fields: [
      { key: "title", label: "Título", severity: "required" },
      { key: "starts_at", label: "Data de início", severity: "required" },
      { key: "venue", label: "Local", severity: "recommended" },
      { key: "artist_id", label: "Artista vinculado", severity: "recommended" },
    ],
  },
  {
    module: "inventory",
    table: "inventory_items",
    entityType: "Item de inventário",
    fixPath: (row) => editPath("/inventory", row),
    label: (row) => entityLabel(row, ["name", "category"], "Item sem nome"),
    fields: [
      { key: "name", label: "Nome", severity: "required" },
      { key: "category", label: "Categoria", severity: "required" },
      { key: "status", label: "Status", severity: "required" },
      { key: "unit_price", label: "Valor", severity: "recommended" },
      { key: "storage_location", label: "Localização", severity: "recommended" },
    ],
  },
  {
    module: "crm",
    table: "clients",
    entityType: "Cliente/Contato",
    fixPath: (row) => editPath("/crm", row),
    label: (row) => entityLabel(row, ["name", "legal_name", "email"], "Contato sem nome"),
    fields: [
      { key: "name", label: "Nome", severity: "required" },
      { key: "email", label: "E-mail", severity: "recommended" },
      { key: "phone", label: "Telefone", severity: "recommended" },
      { key: "category", label: "Categoria", severity: "recommended" },
      { key: "status", label: "Status", severity: "recommended" },
    ],
  },
  {
    module: "leads",
    table: "leads",
    entityType: "Lead",
    fixPath: (row) => editPath("/crm", row),
    label: (row) => entityLabel(row, ["name", "email"], "Lead sem nome"),
    // Keys of the /leads response (CZ-033); the lead origin lives inside
    // crmInternalData, which this one-level check does not read.
    fields: [
      { key: "name", label: "Nome", severity: "required" },
      { key: "email", label: "E-mail", severity: "required" },
      { key: "phone", label: "Telefone", severity: "recommended" },
      { key: "status", label: "Status", severity: "recommended" },
    ],
  },
  {
    module: "licensing",
    table: "licenses",
    entityType: "Licença",
    fixPath: (row) => editPath("/licensing", row),
    label: (row) => entityLabel(row, ["title", "client_name", "project_name"], "Licença sem título"),
    fields: [
      { key: "title", label: "Título", severity: "required" },
      { key: "client_name", label: "Cliente", severity: "required" },
      { key: "amount", label: "Valor", severity: "recommended" },
      { key: "status", label: "Status", severity: "recommended" },
    ],
  },
  {
    module: "rh",
    table: "employees",
    entityType: "Funcionário",
    fixPath: (row) => editPath("/hr", row),
    label: (row) => entityLabel(row, ["name", "email", "job_title"], "Funcionário sem nome"),
    fields: [
      { key: "name", label: "Nome completo", severity: "required" },
      { key: "email", label: "E-mail", severity: "required" },
      { key: "cpf", label: "CPF", severity: "recommended" },
      { key: "phone", label: "Telefone", severity: "recommended" },
      { key: "job_title", label: "Cargo", severity: "recommended" },
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
  const requiredMissing = missingLabels(row, config.fields, "required");
  const recommendedMissing = missingLabels(row, config.fields, "recommended");
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
          severity: "required" as const,
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
          severity: "recommended" as const,
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
      required: issues.filter((issue) => issue.severity === "required").length,
      recommended: issues.filter((issue) => issue.severity === "recommended").length,
      total_records: totalRecords,
      complete_records: completeRecords,
      incomplete_records: totalRecords - completeRecords,
      completion_rate: totalRecords === 0 ? 0 : Math.round((completeRecords / totalRecords) * 100),
    },
    generated_at: new Date().toISOString(),
  };
}

