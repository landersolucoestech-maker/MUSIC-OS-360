/**
 * modules/reports/export/export-engine.service.ts
 *
 * Entity-driven export into a single sheet. Repeatable structures are
 * flattened into rows of the same worksheet; auxiliary sheets are never created.
 */
import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Optional,
  PayloadTooLargeException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DATA_SOURCE } from '../../../database/database.module';
import { EntityMetadataService } from '../entity-metadata.service';
import { ReportEntityDefinitionService } from '../definitions/report-entity-definition.service';
import type { ReportEntityDefinition } from '../definitions/report-entity-definition.types';
import { ExportQueryBuilderService } from './export-query-builder.service';
import { ExportFormatService } from './export-format.service';
import { ExportAuditService } from './export-audit.service';
import { ReportTableGuardService } from '../report-table-guard.service';
import { EncryptionService } from '../../../core/security/encryption.service';
import {
  contractEncryptedFields,
  getReportFormContract,
  type ReportFormContract,
  type ReportRepeatingGroupSpec,
} from '../form-contracts/report-form-contracts';
import { REPEATING_GROUP_EXPORT_RESOLVERS } from '../computed-fields/registry';
import {
  REPORT_MODULE_REGISTRY_BY_TABLE,
  ACCOUNTING_SUMMARY_TABLE_NAME,
} from '../report-module-registry';
import { fetchAccountingSummaryRows } from '../computed-fields/accounting-summary.report';
import {
  EXPORT_FORMATS,
  EXPORT_MAX_ROWS,
  type ExportQueryParams,
  type ExportResult,
} from './export.types';
import { entityCopyPtBr } from '../i18n/report-copy.pt-br';

const REPORT_MULTI_VALUE_SEPARATOR = ' | ';

function assertExportSize(entity: string, rows: number): void {
  if (rows <= EXPORT_MAX_ROWS) return;
  throw new PayloadTooLargeException({
    error: 'REPORT_EXPORT_TOO_LARGE',
    message:
      `A exportação de ${entityCopyPtBr(entity)} possui mais de ${EXPORT_MAX_ROWS} linhas. ` +
      'Nenhum arquivo parcial foi gerado. Reduza o conjunto com filtros ou use o fluxo assíncrono quando disponível.',
    limit: EXPORT_MAX_ROWS,
  });
}

@Injectable()
export class ExportEngineService {
  constructor(
    @Inject(DATA_SOURCE) @Optional() private readonly ds: DataSource | null,
    private readonly metadata: EntityMetadataService,
    private readonly definitions: ReportEntityDefinitionService,
    private readonly queryBuilder: ExportQueryBuilderService,
    private readonly format: ExportFormatService,
    private readonly audit: ExportAuditService,
    private readonly tableGuard: ReportTableGuardService,
    private readonly encryption: EncryptionService,
  ) {}

  async export(
    entity: string,
    params: ExportQueryParams,
    tenantId: string | undefined,
    userId: string,
  ): Promise<ExportResult> {
    if (!tenantId) throw new ForbiddenException('Workspace não identificado.');
    if (!EXPORT_FORMATS.includes(params.format)) {
      throw new BadRequestException({
        error: 'UNSUPPORTED_EXPORT_FORMAT',
        message: `Formato de exportação não suportado: "${params.format}". Formatos aceitos: ${EXPORT_FORMATS.join(', ')}.`,
      });
    }

    const report = this.metadata.scan().entities.find((item) => item.tableName === entity);
    if (!report || !report.reportable) {
      throw new UnprocessableEntityException({
        error: 'REPORT_ENTITY_NOT_AVAILABLE',
        message: `A entidade ${entityCopyPtBr(entity)} não está disponível na Central de Relatórios.`,
      });
    }

    await this.tableGuard.assertTableUsable(entity, report);
    const definition = this.definitions.getDefinition(entity);
    if (!definition) {
      throw new UnprocessableEntityException({
        error: 'REPORT_CONTRACT_REQUIRED',
        message: `A entidade ${entityCopyPtBr(entity)} ainda não está disponível para relatórios.`,
      });
    }
    if (!definition.supportsExport) {
      throw new BadRequestException(`A entidade ${entityCopyPtBr(entity)} não permite exportação.`);
    }

    const sheetName = report.label ?? entity;
    if (REPORT_MODULE_REGISTRY_BY_TABLE.get(entity)?.computed) {
      if (!this.ds) throw new ServiceUnavailableException('Serviço temporariamente indisponível. Tente novamente.');
      try {
        const rows = await this.resolveComputedReport(entity, tenantId);
        assertExportSize(entity, rows.length);
        // Selection = WHICH columns; canonical order (definition.exportableColumns) = IN
        // WHICH order. Filter the canonical config by the selection, not the reverse — never
        // let the order of `params.columns` (the caller's order) leak into the XLSX.
        const columns = params.columns?.length
          ? definition.exportableColumns.filter((column) => params.columns!.includes(column))
          : definition.exportableColumns;
        const result = this.serialize(entity, sheetName, params.format, columns, rows);
        this.audit.record({ userId, tenantId, entity, format: params.format, recordCount: rows.length, status: 'success' });
        return result;
      } catch (error) {
        this.audit.record({ userId, tenantId, entity, format: params.format, recordCount: 0, status: 'failed', error: String(error) });
        throw error;
      }
    }

    const contract = getReportFormContract(entity);
    const softDeleteColumn = report.hasSoftDelete
      ? report.columns.find((column) => column.isDeletedAt)?.name
      : undefined;
    if (!this.ds) throw new ServiceUnavailableException('Serviço temporariamente indisponível. Tente novamente.');

    if (contract?.repeatingGroup) {
      try {
        const result = await this.exportWithRepeatingGroup(
          entity,
          sheetName,
          params,
          tenantId,
          definition,
          contract,
          contract.repeatingGroup,
          softDeleteColumn,
        );
        this.audit.record({ userId, tenantId, entity, format: params.format, recordCount: result.recordCount, status: 'success' });
        return result;
      } catch (error) {
        this.audit.record({ userId, tenantId, entity, format: params.format, recordCount: 0, status: 'failed', error: String(error) });
        throw error;
      }
    }

    const query = this.queryBuilder.build(definition, params, tenantId, { softDeleteColumn });
    try {
      const rows = (await this.ds.query(query.sql, query.parameters)) as Record<string, unknown>[];
      assertExportSize(entity, rows.length);
      this.decryptEncryptedColumns(contract, query.columns, rows);
      const result = this.serialize(entity, sheetName, params.format, query.columns, rows);
      this.audit.record({ userId, tenantId, entity, format: params.format, recordCount: rows.length, status: 'success' });
      return result;
    } catch (error) {
      this.audit.record({ userId, tenantId, entity, format: params.format, recordCount: 0, status: 'failed', error: String(error) });
      throw error;
    }
  }

  private decryptEncryptedColumns(
    contract: ReportFormContract | null,
    columns: string[],
    rows: Record<string, unknown>[],
  ): void {
    const encryptedFields = Object.keys(contract ? contractEncryptedFields(contract) : {})
      .filter((key) => columns.includes(key));
    for (const row of rows) {
      for (const key of encryptedFields) {
        const value = row[key];
        row[key] = typeof value === 'string' && value.length > 0
          ? this.encryption.decryptNullable(value)
          : null;
      }
    }
  }

  private async resolveComputedReport(
    entity: string,
    tenantId: string,
  ): Promise<Record<string, unknown>[]> {
    if (entity === ACCOUNTING_SUMMARY_TABLE_NAME) {
      return fetchAccountingSummaryRows(this.ds!, tenantId) as unknown as Record<string, unknown>[];
    }
    throw new Error(`[reports-export] computed report without a registered resolver: ${entity}`);
  }

  private async exportWithRepeatingGroup(
    entity: string,
    sheetName: string,
    params: ExportQueryParams,
    tenantId: string,
    definition: ReportEntityDefinition,
    contract: ReportFormContract,
    group: ReportRepeatingGroupSpec,
    softDeleteColumn: string | undefined,
  ): Promise<ExportResult> {
    if (!this.ds) throw new ServiceUnavailableException('Serviço temporariamente indisponível. Tente novamente.');

    const generalColumns = contract.fields.map((field) => field.key);
    const query = this.queryBuilder.build(
      definition,
      { ...params, columns: generalColumns },
      tenantId,
      { softDeleteColumn, includeInternalId: true },
    );
    const rawRows = (await this.ds.query(query.sql, query.parameters)) as Record<string, unknown>[];
    assertExportSize(entity, rawRows.length);
    this.decryptEncryptedColumns(contract, query.columns, rawRows);

    const resolver = REPEATING_GROUP_EXPORT_RESOLVERS[`${entity}.${group.key}`];
    if (!resolver) {
      throw new Error(`[reports-export] repeatable group without a registered resolver: ${entity}.${group.key}`);
    }

    const parentIds = rawRows.map((row) => String(row.__internal_id));
    const itemsByParent = await resolver(this.ds, tenantId, parentIds);
    const itemColumns = group.fields.map((field) => field.key);
    const allColumns = [...generalColumns, ...itemColumns];
    const flatRows: Record<string, unknown>[] = [];

    for (const row of rawRows) {
      const general: Record<string, unknown> = {};
      for (const column of generalColumns) general[column] = row[column];
      const items = itemsByParent.get(String(row.__internal_id)) ?? [];

      if (items.length === 0) {
        const blank: Record<string, unknown> = { ...general };
        for (const column of itemColumns) blank[column] = '';
        flatRows.push(blank);
        assertExportSize(entity, flatRows.length);
        continue;
      }

      for (const item of items) {
        const flat: Record<string, unknown> = { ...general };
        for (const field of group.fields) {
          const value = item[field.key];
          flat[field.key] = field.multi && Array.isArray(value)
            ? value.join(REPORT_MULTI_VALUE_SEPARATOR)
            : value;
        }
        flatRows.push(flat);
        assertExportSize(entity, flatRows.length);
      }
    }

    return this.serialize(entity, sheetName, params.format, allColumns, flatRows);
  }

  private serialize(
    entity: string,
    sheetName: string,
    format: ExportResult['format'],
    columns: string[],
    rows: Record<string, unknown>[],
  ): ExportResult {
    const stamp = new Date().toISOString().slice(0, 10);
    return {
      filename: `${entity}_${stamp}.xlsx`,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      body: this.format.toXlsx(entity, sheetName, columns, rows),
      recordCount: rows.length,
      format,
    };
  }
}
