/**
 * Cliente da Central de Relatórios. Consome exclusivamente os endpoints reais.
 */
import { api, getAccessToken, getTenantId } from "@/shared/lib/api-client";
import { API_BASE_URL } from "@/shared/lib/env";
import { UserFacingError } from "@/shared/lib/errors";

export type ExportFormat = "xlsx";
export const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
export const IMPORT_MAX_BYTES = 1024 * 1024;

export interface ReportColumnMeta {
  name: string;
  label: string | null;
  type: string;
  nullable: boolean;
  primary: boolean;
  isEnum: boolean;
  enumValues?: string[];
}

export interface ReportEntity {
  entityName: string;
  tableName: string;
  label: string | null;
  category: string;
  reportable: boolean;
  columns: ReportColumnMeta[];
  hasTenantId: boolean;
  hasSoftDelete: boolean;
  hasTimestamps: boolean;
  risks: string[];
}

export interface EntitiesInventory {
  totalEntities: number;
  reportableEntities: number;
  nonReportableEntities: number;
  unknownEntities: number;
  entities: ReportEntity[];
}

export interface ReportEntityDefinition {
  entityName: string;
  tableName: string;
  category: string;
  identityColumn: string;
  displayColumn: string;
  dateColumn: string;
  exportableColumns: string[];
  importableColumns: string[];
  filterableColumns: string[];
  sortableColumns: string[];
  searchableColumns: string[];
  sensitiveColumns: string[];
  requiredImportColumns: string[];
  supportsExport: boolean;
  supportsImport: boolean;
}

export interface ImportRowValidation {
  index: number;
  data: Record<string, unknown>;
  valid: boolean;
  errors: { column: string; message: string }[];
  warnings: { column: string; message: string }[];
}

export interface ImportValidationResult {
  entity: string;
  supportsImport: boolean;
  mapping: Record<string, string | null>;
  unknownColumns: string[];
  ignoredColumns: string[];
  totalRows: number;
  validRows: number;
  invalidRows: number;
  rows: ImportRowValidation[];
  errors: string[];
  warnings: string[];
}

export interface ImportCommitResult {
  entity: string;
  totalRows: number;
  importedRows: number;
  failedRows: number;
  warnings: string[];
  errors: string[];
}

export interface ExportParams {
  format: ExportFormat;
  columns?: string[];
  filters?: Record<string, string>;
  sort?: string;
  order?: "ASC" | "DESC";
  page?: number;
  pageSize?: number;
}

export interface ImportUploadBody {
  filename: string;
  mimeType: typeof XLSX_MIME;
  contentBase64: string;
}

function buildExportQuery(params: ExportParams): string {
  const query = new URLSearchParams();
  query.set("format", params.format);
  if (params.columns?.length) query.set("columns", params.columns.join(","));
  if (params.sort) query.set("sort", params.sort);
  if (params.order) query.set("order", params.order);
  if (params.page) query.set("page", String(params.page));
  if (params.pageSize) query.set("pageSize", String(params.pageSize));
  for (const [key, value] of Object.entries(params.filters ?? {})) {
    if (value !== "" && value != null) query.set(key, value);
  }
  return query.toString();
}

function authenticatedHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  const token = getAccessToken();
  const tenant = getTenantId();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (tenant) headers["X-Tenant-ID"] = tenant;
  return headers;
}

async function responseError(response: Response, operation: string): Promise<Error> {
  const raw = await response.text().catch(() => "");
  // The API's `message` is end-user copy (PT-BR) by contract; anything else
  // (unstructured text, `error` codes) is an internal diagnostic only.
  let userMessage: string | undefined;
  try {
    const parsed = JSON.parse(raw) as { message?: string | string[] };
    userMessage = Array.isArray(parsed.message) ? parsed.message.join("; ") : parsed.message;
  } catch {
    // Unstructured body: kept only in the technical diagnostic below.
  }
  return new UserFacingError(
    `${operation} failed (HTTP ${response.status})${raw ? `: ${raw.slice(0, 200)}` : ""}`,
    userMessage ?? "Não foi possível concluir a operação de relatório. Tente novamente.",
  );
}

export const reportsApi = {
  entities: () => api.get<EntitiesInventory>("/reports/entities"),
  definitions: () => api.get<ReportEntityDefinition[]>("/reports/definitions"),

  exportBlob: async (
    entity: string,
    params: ExportParams,
  ): Promise<{ blob: Blob; filename: string }> => {
    const response = await fetch(
      `${API_BASE_URL}/api/v1/reports/entities/${encodeURIComponent(entity)}/export?${buildExportQuery(params)}`,
      { headers: authenticatedHeaders(), credentials: "include" },
    );
    if (!response.ok) throw await responseError(response, "Export");

    const contentType = response.headers.get("content-type")?.split(";")[0].trim();
    if (contentType !== XLSX_MIME) {
      throw new UserFacingError(`Export returned an unexpected MIME type: ${contentType ?? "missing"}`, "O arquivo exportado pelo servidor é inválido. Tente novamente.");
    }
    const disposition = response.headers.get("content-disposition") ?? "";
    const filename = /filename="?([^";]+)"?/i.exec(disposition)?.[1] ?? `${entity}.xlsx`;
    if (!/\.xlsx$/i.test(filename)) {
      throw new UserFacingError(`Export returned an invalid filename: ${filename}`, "O arquivo exportado pelo servidor é inválido. Tente novamente.");
    }

    const blob = await response.blob();
    const signature = new Uint8Array(await blob.slice(0, 4).arrayBuffer());
    if (signature[0] !== 0x50 || signature[1] !== 0x4b || signature[2] !== 0x03 || signature[3] !== 0x04) {
      throw new UserFacingError("Export content is not a valid OpenXML workbook", "O arquivo exportado pelo servidor é inválido. Tente novamente.");
    }
    return { blob, filename };
  },

  importTemplateBlob: async (entity: string): Promise<{ blob: Blob; filename: string }> => {
    const response = await fetch(
      `${API_BASE_URL}/api/v1/reports/entities/${encodeURIComponent(entity)}/import/template`,
      { headers: authenticatedHeaders(), credentials: "include" },
    );
    if (!response.ok) throw await responseError(response, "Template download");
    if (response.headers.get("content-type")?.split(";")[0].trim() !== XLSX_MIME) {
      throw new UserFacingError("Template returned a MIME type incompatible with XLSX", "O modelo retornado pelo servidor é inválido. Tente novamente.");
    }

    const disposition = response.headers.get("content-disposition") ?? "";
    const filename = /filename="?([^";]+)"?/i.exec(disposition)?.[1] ?? `${entity}_template.xlsx`;
    const blob = await response.blob();
    const signature = new Uint8Array(await blob.slice(0, 4).arrayBuffer());
    if (signature[0] !== 0x50 || signature[1] !== 0x4b || signature[2] !== 0x03 || signature[3] !== 0x04) {
      throw new UserFacingError("Template returned invalid OpenXML content", "O modelo retornado pelo servidor é inválido. Tente novamente.");
    }
    return { blob, filename };
  },

  importValidate: (entity: string, body: ImportUploadBody) =>
    api.post<ImportValidationResult>(
      `/reports/entities/${encodeURIComponent(entity)}/import/validate`,
      body,
    ),

  importCommit: (entity: string, body: ImportUploadBody) =>
    api.post<ImportCommitResult>(
      `/reports/entities/${encodeURIComponent(entity)}/import/commit`,
      body,
    ),
};

export async function fileToImportBody(file: File): Promise<ImportUploadBody> {
  if (!/^[^/\\]+\.xlsx$/i.test(file.name)) {
    throw new UserFacingError("Import file does not have the .xlsx extension", "Selecione um arquivo com extensão .xlsx.");
  }
  if (file.type !== XLSX_MIME) {
    throw new UserFacingError(`Invalid import MIME type; expected ${XLSX_MIME}`, "Tipo de arquivo inválido. Selecione uma planilha .xlsx.");
  }
  if (file.size <= 0 || file.size > IMPORT_MAX_BYTES) {
    throw new UserFacingError(`Import file size outside 1..${IMPORT_MAX_BYTES} bytes`, `O arquivo deve possuir entre 1 e ${IMPORT_MAX_BYTES} bytes.`);
  }

  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4b || bytes[2] !== 0x03 || bytes[3] !== 0x04) {
    throw new UserFacingError("Import content lacks a valid OpenXML signature", "O arquivo não é uma planilha .xlsx válida.");
  }

  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return { filename: file.name, mimeType: XLSX_MIME, contentBase64: btoa(binary) };
}

export function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
