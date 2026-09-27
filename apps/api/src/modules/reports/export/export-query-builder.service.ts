import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import type { ReportEntityDefinition } from '../definitions/report-entity-definition.types';
import {
  EXPORT_DETECTION_LIMIT,
  type BuiltExportQuery,
  type ExportQueryParams,
} from './export.types';
import {
  contractEncryptedFields,
  contractMetadataFields,
  getReportFormContract,
} from '../form-contracts/report-form-contracts';
import { fieldCopyPtBr } from '../i18n/report-copy.pt-br';

const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;

function assertIdent(name: string): void {
  if (!IDENT.test(name)) throw new BadRequestException('Parâmetro de exportação inválido.');
}

function quote(name: string): string {
  assertIdent(name);
  return `"${name}"`;
}

function metadataSelectExpression(column: string, physicalJsonColumn: string): string {
  const safeJsonKey = column.replace(/'/g, "''");
  return `${quote(physicalJsonColumn)} ->> '${safeJsonKey}' AS ${quote(column)}`;
}

@Injectable()
export class ExportQueryBuilderService {
  build(
    def: ReportEntityDefinition,
    params: ExportQueryParams,
    tenantId: string,
    opts: { softDeleteColumn?: string; includeInternalId?: boolean } = {},
  ): BuiltExportQuery {
    if (!tenantId) throw new ForbiddenException('Workspace não identificado.');

    // Selection = WHICH columns; canonical order (def.exportableColumns) = IN WHICH order.
    // Never use the order in which the caller sent `columns` — always filter the
    // canonical configuration by the selected identifiers, preserving its order.
    if (params.columns?.length) {
      for (const column of params.columns) {
        if (def.sensitiveColumns.includes(column)) {
          throw new BadRequestException(`O campo ${fieldCopyPtBr(column)} contém dados sensíveis e não pode ser exportado.`);
        }
        if (!def.exportableColumns.includes(column)) {
          throw new BadRequestException(`O campo ${fieldCopyPtBr(column)} não pode ser exportado.`);
        }
      }
    }

    const columns = params.columns?.length
      ? def.exportableColumns.filter((column) => params.columns!.includes(column))
      : [...def.exportableColumns];
    const contract = getReportFormContract(def.tableName);
    const encryptedFields = contract ? contractEncryptedFields(contract) : {};
    const metadataFields = contract ? contractMetadataFields(contract) : {};
    const logicalAliases: Record<string, string> = {};
    if (contract) {
      for (const field of contract.fields) {
        if (field.physical && field.physical !== field.key) logicalAliases[field.key] = field.physical;
      }
    }
    const physicalAliasFields = { ...logicalAliases, ...encryptedFields };
    const physical = (logical: string): string => physicalAliasFields[logical] ?? logical;

    const selectParts = columns.map((column) => {
      const physicalColumn = physicalAliasFields[column];
      if (physicalColumn) return `${quote(physicalColumn)} AS ${quote(column)}`;
      if (metadataFields[column]) return metadataSelectExpression(column, metadataFields[column]);
      return quote(column);
    });
    if (opts.includeInternalId) selectParts.push(`${quote('id')} AS ${quote('__internal_id')}`);

    const where: string[] = [`${quote('tenant_id')} = $1`];
    const parameters: unknown[] = [tenantId];
    if (opts.softDeleteColumn) where.push(`${quote(opts.softDeleteColumn)} IS NULL`);
    // Server-declared only (ReportEntityDefinition.baseWhere), never request input.
    where.push(...(def.baseWhere ?? []));

    if (params.filters) {
      for (const [key, value] of Object.entries(params.filters)) {
        if (!def.filterableColumns.includes(key)) throw new BadRequestException(`O filtro por ${fieldCopyPtBr(key)} não é permitido nesta exportação.`);
        parameters.push(value);
        where.push(`${quote(physical(key))} = $${parameters.length}`);
      }
    }

    let orderBy = '';
    if (params.sort) {
      if (!def.sortableColumns.includes(params.sort)) throw new BadRequestException(`A ordenação por ${fieldCopyPtBr(params.sort)} não é permitida nesta exportação.`);
      orderBy = ` ORDER BY ${quote(physical(params.sort))} ${params.order === 'DESC' ? 'DESC' : 'ASC'}`;
    }

    parameters.push(EXPORT_DETECTION_LIMIT);
    const limitIndex = parameters.length;
    const sql = `SELECT ${selectParts.join(', ')} FROM ${quote(def.tableName)} ` +
      `WHERE ${where.join(' AND ')}${orderBy} LIMIT $${limitIndex}`;

    return { sql, parameters, columns };
  }
}
