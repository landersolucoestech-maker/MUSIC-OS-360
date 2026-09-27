/**
 * Entity-driven endpoints of the Reports Center.
 */
import { BadRequestException, Body, Controller, Get, Param, Post, Query, Res } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Equals, IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';
import type { Response } from 'express';
import { RequireRole } from '../../core/decorators/roles.decorator';
import { CurrentTenant } from '../../core/decorators/current-tenant.decorator';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { Audit } from '../../core/interceptors/audit.interceptor';
import { EntityMetadataService } from './entity-metadata.service';
import { ReportEntityDefinitionService } from './definitions/report-entity-definition.service';
import { ReportTableGuardService } from './report-table-guard.service';
import { REPORT_MODULE_REGISTRY_BY_TABLE } from './report-module-registry';
import { ExportEngineService } from './export/export-engine.service';
import { ImportEngineService } from './import/import-engine.service';
import { ImportCommitService, type ImportCommitResult } from './import/import-commit.service';
import {
  EXPORT_FORMATS,
  type ExportFormat,
  type ExportQueryParams,
} from './export/export.types';
import { IMPORT_MAX_BYTES, type ImportValidationResult } from './import/import.types';
import type { EntitiesInventory } from './entity-metadata.types';
import type { ReportEntityDefinition } from './definitions/report-entity-definition.types';
import { isSafeKey } from '../../core/security/safe-object';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const MAX_BASE64_LENGTH = Math.ceil(IMPORT_MAX_BYTES / 3) * 4 + 4;
const BASE64_PATTERN = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

export class ImportUploadDto {
  @IsString()
  @Matches(/^[^/\\]+\.xlsx$/i, { message: 'filename deve terminar em .xlsx e não pode conter caminho.' })
  filename: string;

  @IsString()
  @Equals(XLSX_MIME, { message: `mimeType deve ser ${XLSX_MIME}.` })
  mimeType: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_BASE64_LENGTH)
  @Matches(BASE64_PATTERN, { message: 'contentBase64 inválido.' })
  contentBase64: string;
}

// page/pageSize stay reserved so they are not interpreted as filters
// in case an old client still sends them. File export is never paginated.
const RESERVED_QUERY_KEYS = new Set(['format', 'columns', 'sort', 'order', 'page', 'pageSize']);

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function decodeImportBody(body: ImportUploadDto): Buffer {
  const content = Buffer.from(body.contentBase64, 'base64');
  const normalizedInput = body.contentBase64.replace(/=+$/, '');
  const normalizedDecoded = content.toString('base64').replace(/=+$/, '');
  if (normalizedInput !== normalizedDecoded) {
    throw new BadRequestException({
      error: 'INVALID_IMPORT_ENCODING',
      message: 'O arquivo enviado não é válido.',
    });
  }
  if (content.length === 0 || content.length > IMPORT_MAX_BYTES) {
    throw new BadRequestException({
      error: 'INVALID_IMPORT_SIZE',
      message: `Arquivo deve possuir entre 1 e ${IMPORT_MAX_BYTES} bytes.`,
    });
  }
  return content;
}

export function parseExportParams(
  query: Record<string, string | string[] | undefined>,
): ExportQueryParams {
  const filters: Record<string, string> = Object.create(null);
  for (const [key, rawValue] of Object.entries(query)) {
    if (RESERVED_QUERY_KEYS.has(key) || !isSafeKey(key)) continue;
    const value = first(rawValue);
    if (value !== undefined) filters[key] = value;
  }

  const formatRaw = first(query.format) ?? 'xlsx';
  if (!EXPORT_FORMATS.includes(formatRaw as ExportFormat)) {
    throw new BadRequestException({
      error: 'UNSUPPORTED_EXPORT_FORMAT',
      message: `Formato de exportação não suportado: "${formatRaw}". Formatos aceitos: ${EXPORT_FORMATS.join(', ')}.`,
    });
  }

  const columnsRaw = first(query.columns);
  const columns = columnsRaw
    ? Array.from(new Set(columnsRaw.split(',').map((column) => column.trim()).filter(Boolean)))
    : undefined;
  return {
    format: formatRaw as ExportFormat,
    columns,
    filters: Object.keys(filters).length ? filters : undefined,
    sort: first(query.sort),
    order: first(query.order)?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC',
  };
}

@ApiTags('Reports')
@ApiBearerAuth()
@Controller('reports')
export class ReportsController {
  constructor(
    private readonly entityMetadata: EntityMetadataService,
    private readonly definitions: ReportEntityDefinitionService,
    private readonly tableGuard: ReportTableGuardService,
    private readonly exportEngine: ExportEngineService,
    private readonly importEngine: ImportEngineService,
    private readonly importCommit: ImportCommitService,
  ) {}

  @Get('entities')
  @RequireRole('admin')
  @ApiOperation({ summary: 'Classified inventory of the persisted entities' })
  async entities(): Promise<EntitiesInventory> {
    const inventory = this.entityMetadata.scan();
    const tables = await this.tableGuard.existingTables();
    if (!tables) return inventory;

    for (const entity of inventory.entities) {
      if (REPORT_MODULE_REGISTRY_BY_TABLE.get(entity.tableName)?.computed) {
        entity.available = true;
        continue;
      }
      const available = tables.has(entity.tableName);
      entity.available = available;
      if (!available) {
        if (entity.reportable) entity.reportable = false;
        if (!entity.risks.includes('TABLE_NOT_AVAILABLE')) {
          entity.risks.push('TABLE_NOT_AVAILABLE');
        }
      }
    }
    inventory.reportableEntities = inventory.entities.filter((entity) => entity.reportable).length;
    inventory.nonReportableEntities = inventory.entities.length - inventory.reportableEntities;
    return inventory;
  }

  @Get('definitions')
  @RequireRole('admin')
  @ApiOperation({ summary: 'Contracts of the reportable entities' })
  async reportDefinitions(): Promise<ReportEntityDefinition[]> {
    const definitions = this.definitions.getDefinitions();
    const tables = await this.tableGuard.existingTables();
    if (!tables) return definitions;
    return definitions.filter(
      (definition) =>
        REPORT_MODULE_REGISTRY_BY_TABLE.get(definition.tableName)?.computed ||
        tables.has(definition.tableName),
    );
  }

  @Get('entities/:entity/export')
  @RequireRole('manager')
  @Audit('report.exported')
  @ApiOperation({ summary: 'Export the full set of a reportable entity as XLSX' })
  async export(
    @CurrentTenant() tenant: { id: string },
    @CurrentUser() user: { userId: string },
    @Param('entity') entity: string,
    @Query() query: Record<string, string | string[] | undefined>,
    @Res() response: Response,
  ): Promise<void> {
    const params = parseExportParams(query);
    const result = await this.exportEngine.export(
      entity,
      params,
      tenant?.id,
      user?.userId ?? 'unknown',
    );

    response.setHeader('Content-Type', result.contentType);
    response.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.status(200).send(result.body);
  }

  @Get('entities/:entity/import/template')
  @RequireRole('manager')
  @ApiOperation({ summary: 'Download the XLSX import template' })
  async importTemplate(
    @CurrentTenant() tenant: { id: string },
    @Param('entity') entity: string,
    @Res() response: Response,
  ): Promise<void> {
    const result = await this.importEngine.buildTemplate(entity, tenant?.id);
    response.setHeader('Content-Type', result.contentType);
    response.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.status(200).send(result.body);
  }

  @Post('entities/:entity/import/validate')
  @RequireRole('manager')
  @ApiOperation({ summary: 'Validate an XLSX file without persisting' })
  importValidate(
    @CurrentTenant() tenant: { id: string },
    @Param('entity') entity: string,
    @Body() body: ImportUploadDto,
  ): Promise<ImportValidationResult> {
    return this.importEngine.validateFile(
      entity,
      { filename: body.filename, content: decodeImportBody(body) },
      tenant?.id,
    );
  }

  @Post('entities/:entity/import/commit')
  @RequireRole('manager')
  @Audit('report.import.committed')
  @ApiOperation({ summary: 'Transactional, create-only commit of the XLSX import' })
  importCommitEndpoint(
    @CurrentTenant() tenant: { id: string },
    @CurrentUser() user: { userId: string },
    @Param('entity') entity: string,
    @Body() body: ImportUploadDto,
  ): Promise<ImportCommitResult> {
    return this.importCommit.commit(
      entity,
      { filename: body.filename, content: decodeImportBody(body) },
      tenant?.id,
      user?.userId ?? 'unknown',
    );
  }
}
