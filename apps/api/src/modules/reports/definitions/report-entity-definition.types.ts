/**
 * modules/reports/definitions/report-entity-definition.types.ts
 *
 * FASE 2.1 — contrato explícito por entidade reportável.
 * O contrato declara CHAVES TÉCNICAS (colunas reais da metadata TypeORM).
 * Os LABELS são resolvidos exclusivamente pela camada i18n (getFieldLabelPtBr).
 */
import type { EntityCategory } from '../entity-metadata.types';

export interface ReportEntityDefinition {
  entityName: string;
  tableName: string;
  category: EntityCategory;

  /** Coluna de identidade natural (não-PK interna) — ex.: numero, nome. */
  identityColumn: string;
  /** Coluna usada para exibição amigável. */
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
