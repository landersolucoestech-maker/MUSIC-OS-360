/**
 * modules/reports/export/export.types.ts  ·  FASE 2.2
 */
export type ExportFormat = 'xlsx';

export const EXPORT_FORMATS: ExportFormat[] = ['xlsx'];

/**
 * XLSX is materialized in memory by the current library. Above this volume the
 * synchronous request must fail explicitly, never deliver a partial
 * spreadsheet. limit + 1 is queried to detect the excess without an additional COUNT.
 */
export const EXPORT_MAX_ROWS = 50_000;
export const EXPORT_DETECTION_LIMIT = EXPORT_MAX_ROWS + 1;

export interface ExportQueryParams {
  format: ExportFormat;
  columns?: string[];
  filters?: Record<string, string>;
  sort?: string;
  order?: 'ASC' | 'DESC';
  /** @deprecated Synchronous export is not paginated; kept for legacy clients. */
  page?: number;
  /** @deprecated Synchronous export is not paginated; kept for legacy clients. */
  pageSize?: number;
}

export interface BuiltExportQuery {
  sql: string;
  parameters: unknown[];
  columns: string[];
}

export interface ExportResult {
  filename: string;
  contentType: string;
  body: Buffer;
  recordCount: number;
  format: ExportFormat;
}
