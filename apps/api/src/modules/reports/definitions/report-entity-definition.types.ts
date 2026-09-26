/**
 * modules/reports/definitions/report-entity-definition.types.ts
 *
 * PHASE 2.1 — explicit contract per reportable entity.
 * The contract declares TECHNICAL KEYS (real columns from TypeORM metadata).
 * LABELS are resolved exclusively by the i18n layer (getFieldLabelPtBr).
 */
import type { EntityCategory } from '../entity-metadata.types';

export interface ReportEntityDefinition {
  entityName: string;
  tableName: string;
  category: EntityCategory;

  /** Natural identity column (not the internal PK) — e.g. numero, nome. */
  identityColumn: string;
  /** Column used for friendly display. */
  displayColumn: string;
  /** Coluna de data principal (filtro/ordem temporal). */
  dateColumn: string;

  exportableColumns: string[];
  importableColumns: string[];
  filterableColumns: string[];
  sortableColumns: string[];
  searchableColumns: string[];
  sensitiveColumns: string[];
  requiredImportColumns: string[];

  /**
   * Extra raw SQL condition(s), server-defined only (never from request input),
   * AND-ed onto every export query for this table alongside tenant_id/soft-delete.
   * For a table that is dual-purpose at the row level (same physical table backs
   * two different business concepts, discriminated by a column) -- e.g. `invoices`
   * also holds Stripe SaaS-subscription rows that `invoices.service.ts` deliberately
   * excludes (REM-06). The generic reflection-based reports/export engine has no way
   * to know that on its own; this is how a table declares it explicitly.
   */
  baseWhere?: string[];

  supportsExport: boolean;
  supportsImport: boolean;
}
