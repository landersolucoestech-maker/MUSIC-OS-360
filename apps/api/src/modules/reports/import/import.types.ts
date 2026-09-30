/**
 * Contracts and limits of the single-sheet XLSX import.
 */
export type ImportFormat = 'xlsx';
export const IMPORT_MAX_ROWS = 5000;
export const IMPORT_MAX_COLUMNS = 200;
export const IMPORT_MAX_BYTES = 1024 * 1024;
export const IMPORT_MAX_ZIP_ENTRIES = 1000;
export const IMPORT_MAX_UNCOMPRESSED_BYTES = 20 * 1024 * 1024;
export const IMPORT_MAX_COMPRESSION_RATIO = 100;
/** Deadline of the isolated OpenXML parse (a 1 MB workbook parses in well under 1 s). */
export const IMPORT_PARSE_TIMEOUT_MS = 10_000;

export interface ParsedFile {
  format: ImportFormat;
  headers: string[];
  rows: Record<string, string>[];
}

export interface FieldTypeMeta {
  type: string;
  isEnum: boolean;
  enumValues?: string[];
  nullable: boolean;
  hasDefault: boolean;
}

export interface RowIssue {
  column: string;
  message: string;
}

export interface RowValidation {
  index: number;
  data: Record<string, unknown>;
  valid: boolean;
  errors: RowIssue[];
  warnings: RowIssue[];
  /** Items grouped from consecutive rows of the same sheet. */
  repeatingGroups?: Record<string, unknown[]>;
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
  rows: RowValidation[];
  errors: string[];
  warnings: string[];
}
