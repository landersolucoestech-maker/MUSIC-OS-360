import { Injectable } from '@nestjs/common';
import { EntityMetadataService } from '../entity-metadata.service';
import type { ColumnMeta, EntityReport } from '../entity-metadata.types';
import type { ReportEntityDefinition } from './report-entity-definition.types';
import {
  contractDirectColumns,
  getReportFormContract,
  type ReportFormContract,
} from '../form-contracts/report-form-contracts';

const JSON_TYPES = new Set(['json', 'jsonb', 'simple-json', 'simple-array']);
const BLOB_NAME_HINT = /(^|_)(html|raw|payload|snapshot|dump|debug|xml)(_|$)/i;
const HIDDEN_INTERNAL_HINT = /^(notas?_internas?|observacoes?_internas?|comentarios?_internos?|internal_notes)$/i;

function isInternalColumn(c: ColumnMeta): boolean {
  return (
    c.primary || c.generated || c.isTenantId || c.isCreatedAt || c.isUpdatedAt || c.isDeletedAt ||
    /_id$/.test(c.name) || JSON_TYPES.has(c.type) || BLOB_NAME_HINT.test(c.name) ||
    HIDDEN_INTERNAL_HINT.test(c.name) ||
    ['created_by', 'updated_by', 'uploaded_by', 'approved_by', 'org_slug', 'metadata'].includes(c.name)
  );
}

function isSensitiveColumn(c: ColumnMeta): boolean {
  return /_encrypted$|token|password|secret|hash|credential/i.test(c.name);
}

const DATE_TYPES = new Set(['timestamp', 'timestamptz', 'date', 'datetime', 'Date']);
const NUMERIC_TYPES = new Set(['int', 'integer', 'numeric', 'decimal', 'float', 'bigint', 'Number', 'real', 'double precision']);
const FILTERABLE_HINTS = /^(status|situacao|categoria|category|type|type|kind|stage|prioridade|priority|active|ativo|is_active|published|approved|archived)$/;

/**
 * Row-level exclusions for tables that are dual-purpose at the physical-table
 * level (see ReportEntityDefinition.baseWhere). `invoices` also stores Stripe
 * SaaS-subscription invoices (type='stripe_subscription'); invoices.service.ts's
 * own list()/findById() already exclude them (REM-06) -- this closes the same
 * gap for the generic reports export/import engine, which reads the table
 * directly and has no domain knowledge of that split otherwise.
 */
const TABLE_BASE_EXCLUSIONS: Record<string, string[]> = {
  invoices: ["type != 'stripe_subscription'"],
};

@Injectable()
export class ReportEntityDefinitionService {
  constructor(private readonly entityMetadata: EntityMetadataService) {}

  getDefinitions(): ReportEntityDefinition[] {
    return this.entityMetadata
      .scan()
      .entities.filter((entity) => entity.reportable && getReportFormContract(entity.tableName) !== null)
      .map((entity) => this.build(entity, getReportFormContract(entity.tableName)!));
  }

  getDefinition(tableName: string): ReportEntityDefinition | null {
    return this.getDefinitions().find((definition) => definition.tableName === tableName) ?? null;
  }

  private build(entity: EntityReport, contract: ReportFormContract): ReportEntityDefinition {
    const columns = entity.columns;
    const sensitive = columns.filter(isSensitiveColumn).map((column) => column.name);
    const visible = columns.filter((column) => !isInternalColumn(column) && !isSensitiveColumn(column));

    const exportableColumns = [
      ...contract.fields.map((field) => field.key),
      ...(contract.repeatingGroup?.fields.map((field) => field.key) ?? []),
    ];
    const importableColumns = [
      ...contract.fields.filter((field) => field.importable !== false).map((field) => field.key),
      ...(contract.repeatingGroup?.fields.map((field) => field.key) ?? []),
    ];
    const identityColumn = contract.identityColumn;
    const displayColumn = identityColumn;

    const dateColumn =
      columns.find((column) => column.isCreatedAt)?.name ??
      columns.find((column) => DATE_TYPES.has(column.type) && !column.isUpdatedAt && !column.isDeletedAt)?.name ??
      'created_at';

    const directContractColumns = contractDirectColumns(contract);
    const sqlSafe = (name: string): boolean => directContractColumns.has(name);

    const filterableColumns = contract.filterableColumns ?? visible
      .filter((column) => (
        FILTERABLE_HINTS.test(column.name) || column.isEnum || column.type === 'Boolean' || DATE_TYPES.has(column.type)
      ) && sqlSafe(column.name))
      .map((column) => column.name);

    const sortableColumns = Array.from(new Set([
      identityColumn,
      dateColumn,
      ...visible
        .filter((column) => (NUMERIC_TYPES.has(column.type) || DATE_TYPES.has(column.type)) && sqlSafe(column.name))
        .map((column) => column.name),
    ]));

    const searchableColumns = contract.searchableColumns ?? visible
      .filter((column) => (
        column.type === 'String' || column.type === 'varchar' || column.type === 'text'
      ) && !column.isEnum && sqlSafe(column.name))
      .map((column) => column.name);

    return {
      entityName: entity.entityName,
      tableName: entity.tableName,
      category: entity.category,
      identityColumn,
      displayColumn,
      dateColumn,
      exportableColumns,
      importableColumns,
      filterableColumns,
      sortableColumns,
      searchableColumns,
      sensitiveColumns: sensitive,
      requiredImportColumns: [identityColumn],
      baseWhere: TABLE_BASE_EXCLUSIONS[entity.tableName] ?? [],
      supportsExport: exportableColumns.length > 0,
      supportsImport: importableColumns.length > 0,
    };
  }
}
