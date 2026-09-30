/**
 * modules/reports/import/import-engine.service.ts
 *
 * Validation and XLSX template in a single sheet. Repeatable groups are
 * consecutive rows of the same file, never auxiliary worksheets.
 */
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as XLSX from 'xlsx';
import { EntityMetadataService } from '../entity-metadata.service';
import { ReportEntityDefinitionService } from '../definitions/report-entity-definition.service';
import { ImportParserService } from './import-parser.service';
import { ImportMapperService } from './import-mapper.service';
import { ImportValidationService } from './import-validation.service';
import { ReportTableGuardService } from '../report-table-guard.service';
import { ExportFormatService, sanitizeExcelCellValue } from '../export/export-format.service';
import {
  getReportFormContract,
  type ReportFormContract,
} from '../form-contracts/report-form-contracts';
import type { EntityReport } from '../entity-metadata.types';
import type { ReportEntityDefinition } from '../definitions/report-entity-definition.types';
import type { FieldTypeMeta, ImportValidationResult } from './import.types';
import { entityCopyPtBr } from '../i18n/report-copy.pt-br';

export interface ImportTemplateResult {
  filename: string;
  contentType: string;
  body: Buffer;
}

export const IMPORT_TEMPLATE_VERSION = '2.0-single-sheet';
const MULTI_VALUE_SEPARATOR = ' | ';

function syntheticExample(meta: FieldTypeMeta | undefined): string {
  if (!meta) return 'exemplo';
  if (meta.isEnum && meta.enumValues?.length) return meta.enumValues[0]!;
  const type = meta.type ?? 'String';
  if (/int|numeric|decimal|float|bigint|real|double/i.test(type)) return '0';
  if (/boolean|bool/i.test(type)) return 'Não';
  if (/timestamp|date/i.test(type)) return '2026-01-01';
  return 'exemplo';
}

function columnMeta(report: EntityReport, name: string): FieldTypeMeta | undefined {
  const column = report.columns.find((candidate) => candidate.name === name);
  if (!column) return undefined;
  return {
    type: column.type,
    isEnum: column.isEnum,
    enumValues: column.enumValues,
    nullable: column.nullable,
    hasDefault: column.hasDefault,
  };
}

function reportSheetName(report: EntityReport, entity: string): string {
  return (report.label ?? entity).slice(0, 31) || 'Dados';
}

/**
 * The definition uses the form's logical keys, while the database metadata
 * uses physical names. This map keeps coercion/required checks aligned with the
 * contract, including when `nome_ep_album` persists into `projects.title`.
 */
function buildLogicalTypeMap(
  report: EntityReport,
  contract: ReportFormContract | null,
): Record<string, FieldTypeMeta> {
  const typeMap: Record<string, FieldTypeMeta> = {};

  if (!contract) {
    for (const column of report.columns) {
      const metadata = columnMeta(report, column.name);
      if (metadata) typeMap[column.name] = metadata;
    }
    return typeMap;
  }

  for (const field of contract.fields) {
    const physical = field.physical ?? field.key;
    const metadata = columnMeta(report, physical);
    if (metadata) typeMap[field.key] = metadata;
  }

  // Sub-form fields are resolved by dedicated services and do not
  // belong to the parent table. Without reliable physical metadata they are text by
  // default; specific validations remain the contract's/resolver's responsibility.
  for (const field of contract.repeatingGroup?.fields ?? []) {
    typeMap[field.key] ??= {
      type: 'String',
      isEnum: false,
      nullable: true,
      hasDefault: true,
    };
  }

  return typeMap;
}

@Injectable()
export class ImportEngineService {
  constructor(
    private readonly metadata: EntityMetadataService,
    private readonly definitions: ReportEntityDefinitionService,
    private readonly parser: ImportParserService,
    private readonly mapper: ImportMapperService,
    private readonly validator: ImportValidationService,
    private readonly tableGuard: ReportTableGuardService,
    private readonly exportFormat: ExportFormatService,
  ) {}

  async validateFile(
    entity: string,
    file: { filename: string; content: Buffer },
    tenantId: string | undefined,
  ): Promise<ImportValidationResult> {
    if (!tenantId) throw new ForbiddenException('Workspace não identificado.');

    const report = this.metadata.scan().entities.find((item) => item.tableName === entity);
    if (!report || !report.reportable) {
      throw new NotFoundException({
        error: 'REPORT_ENTITY_NOT_AVAILABLE',
        message: `A entidade ${entityCopyPtBr(entity)} não está disponível na Central de Relatórios.`,
      });
    }

    await this.tableGuard.assertTableUsable(entity, report);
    const def = this.definitions.getDefinition(entity);
    if (!def) {
      throw new NotFoundException({
        error: 'REPORT_CONTRACT_REQUIRED',
        message: `A entidade ${entityCopyPtBr(entity)} ainda não está disponível para relatórios.`,
      });
    }
    if (!def.supportsImport) {
      throw new BadRequestException(`A entidade ${entityCopyPtBr(entity)} não permite importação.`);
    }

    const contract = getReportFormContract(entity);
    const typeMap = buildLogicalTypeMap(report, contract);
    const parsed = await this.parser.parse(
      file.filename,
      file.content,
      reportSheetName(report, entity),
    );
    const headerMapping = this.mapper.build(def, parsed.headers);
    return this.validator.validate(def, typeMap, headerMapping, parsed.rows, entity);
  }

  async buildTemplate(entity: string, tenantId: string | undefined): Promise<ImportTemplateResult> {
    if (!tenantId) throw new ForbiddenException('Workspace não identificado.');

    const report = this.metadata.scan().entities.find((item) => item.tableName === entity);
    if (!report || !report.reportable) {
      throw new NotFoundException({
        error: 'REPORT_ENTITY_NOT_AVAILABLE',
        message: `A entidade ${entityCopyPtBr(entity)} não está disponível na Central de Relatórios.`,
      });
    }

    await this.tableGuard.assertTableUsable(entity, report);
    const def = this.definitions.getDefinition(entity);
    if (!def) {
      throw new NotFoundException({
        error: 'REPORT_CONTRACT_REQUIRED',
        message: `A entidade ${entityCopyPtBr(entity)} ainda não está disponível para relatórios.`,
      });
    }
    if (!def.supportsImport) {
      throw new BadRequestException(`A entidade ${entityCopyPtBr(entity)} não permite importação.`);
    }

    const contract = getReportFormContract(entity);
    const typeMap = buildLogicalTypeMap(report, contract);

    return {
      filename: `${entity}_template.xlsx`,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      body: this.buildTemplateWorkbook(entity, report, def, typeMap),
    };
  }

  private buildTemplateWorkbook(
    entity: string,
    report: EntityReport,
    def: ReportEntityDefinition,
    typeMap: Record<string, FieldTypeMeta>,
  ): Buffer {
    const headers = this.exportFormat.headers(def.importableColumns);
    const clean = (value: unknown, column: string) => sanitizeExcelCellValue(value, { entity, column });
    const contract = getReportFormContract(entity);
    const repeatedKeys = new Set(contract?.repeatingGroup?.fields.map((field) => field.key) ?? []);
    const multiKeys = new Set(
      contract?.repeatingGroup?.fields.filter((field) => field.multi).map((field) => field.key) ?? [],
    );

    const exampleRow = def.importableColumns.map((column) => {
      if (multiKeys.has(column)) {
        return clean(`Exemplo 1${MULTI_VALUE_SEPARATOR}Exemplo 2`, column);
      }
      if (repeatedKeys.has(column)) return clean('exemplo', column);
      return clean(syntheticExample(typeMap[column]), column);
    });

    const worksheet = XLSX.utils.aoa_to_sheet([
      headers.map((header) => header.label),
      exampleRow,
    ]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, reportSheetName(report, entity));
    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  }
}
