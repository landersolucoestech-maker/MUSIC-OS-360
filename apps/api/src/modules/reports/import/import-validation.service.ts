/**
 * Validates XLSX rows against the contract and the metadata without persisting data.
 */
import { Injectable } from '@nestjs/common';
import { getReportFormContract } from '../form-contracts/report-form-contracts';
import { getFieldLabelPtBr, normalizeFieldKey } from '../i18n/field-labels.pt-br';
import type { ReportEntityDefinition } from '../definitions/report-entity-definition.types';
import type { HeaderMapping } from './import-mapper.service';
import type {
  FieldTypeMeta,
  ImportValidationResult,
  RowIssue,
  RowValidation,
} from './import.types';

const DATE_TYPES = new Set(['timestamp', 'timestamptz', 'date', 'datetime', 'Date']);
const NUMERIC_TYPES = new Set([
  'int', 'integer', 'numeric', 'decimal', 'float', 'bigint',
  'Number', 'real', 'double precision', 'smallint',
]);
const BOOL_TRUE = new Set(['true', '1', 'sim', 'verdadeiro', 'yes']);
const BOOL_FALSE = new Set(['false', '0', 'não', 'nao', 'falso', 'no']);

function coerce(
  raw: string,
  meta: FieldTypeMeta | undefined,
): { ok: boolean; value: unknown; message?: string } {
  const value = (raw ?? '').trim();
  if (value === '') return { ok: true, value: null };
  if (meta?.isEnum && meta.enumValues && meta.enumValues.length > 0) {
    const match = meta.enumValues.find((entry) => entry.toLowerCase() === value.toLowerCase());
    return match
      ? { ok: true, value: match }
      : { ok: false, value, message: 'valor fora do conjunto permitido' };
  }
  const type = meta?.type ?? 'String';
  if (DATE_TYPES.has(type)) {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? { ok: false, value, message: 'data inválida' }
      : { ok: true, value: date.toISOString() };
  }
  if (NUMERIC_TYPES.has(type)) {
    const number = Number(value.replace(',', '.'));
    return Number.isNaN(number)
      ? { ok: false, value, message: 'número inválido' }
      : { ok: true, value: number };
  }
  if (type === 'Boolean' || type === 'boolean' || type === 'bool') {
    if (BOOL_TRUE.has(value.toLowerCase())) return { ok: true, value: true };
    if (BOOL_FALSE.has(value.toLowerCase())) return { ok: true, value: false };
    return { ok: false, value, message: 'valor inválido (use Sim ou Não)' };
  }
  return { ok: true, value };
}

@Injectable()
export class ImportValidationService {
  validate(
    definition: ReportEntityDefinition,
    typeMap: Record<string, FieldTypeMeta>,
    headerMapping: HeaderMapping,
    rows: Record<string, string>[],
    entity: string,
  ): ImportValidationResult {
    const { mapping, unknownColumns, ignoredColumns } = headerMapping;
    const errors: string[] = [];
    const warnings: string[] = [];

    const sensitiveCanonical = new Set(
      definition.sensitiveColumns.map((column) => normalizeFieldKey(column).toLowerCase()),
    );
    for (const unknown of unknownColumns) {
      if (sensitiveCanonical.has(normalizeFieldKey(unknown).toLowerCase())) {
        errors.push(`Coluna sensível rejeitada: "${unknown}".`);
      } else {
        warnings.push(`Coluna desconhecida ignorada: "${unknown}".`);
      }
    }
    for (const ignored of ignoredColumns) {
      warnings.push(`Coluna de infraestrutura ignorada: "${ignored}".`);
    }

    const activeHeaders = Object.entries(mapping)
      .filter(([, column]) => column !== null) as Array<[string, string]>;
    const mappedColumns = new Set(activeHeaders.map(([, column]) => column));

    const schemaRequired = definition.importableColumns.filter((column) => {
      const metadata = typeMap[column];
      return metadata != null && metadata.nullable === false && metadata.hasDefault === false;
    });
    const requiredColumns = Array.from(new Set([
      ...definition.requiredImportColumns,
      ...schemaRequired,
    ]));

    for (const column of requiredColumns.filter((entry) => !mappedColumns.has(entry))) {
      errors.push(`Coluna obrigatória ausente no arquivo: "${getFieldLabelPtBr(column)}".`);
    }

    const allowsRepeatedIdentity = Boolean(getReportFormContract(entity)?.repeatingGroup);
    const seenIdentity = new Set<string>();
    const result: RowValidation[] = rows.map((row, index) => {
      const data: Record<string, unknown> = {};
      const rowErrors: RowIssue[] = [];
      const rowWarnings: RowIssue[] = [];

      for (const [header, column] of activeHeaders) {
        if (definition.sensitiveColumns.includes(column)) {
          rowErrors.push({ column, message: 'coluna sensível não pode ser importada' });
          continue;
        }
        const coerced = coerce(row[header] ?? '', typeMap[column]);
        if (!coerced.ok) {
          rowErrors.push({ column, message: coerced.message ?? 'valor inválido' });
        } else {
          data[column] = coerced.value;
        }
      }

      for (const required of requiredColumns) {
        if (
          mappedColumns.has(required) &&
          (data[required] === null || data[required] === undefined || data[required] === '')
        ) {
          rowErrors.push({ column: required, message: 'campo obrigatório vazio' });
        }
      }

      const identityValue = data[definition.identityColumn];
      if (!allowsRepeatedIdentity && identityValue != null && identityValue !== '') {
        const key = String(identityValue).toLowerCase();
        if (seenIdentity.has(key)) {
          rowWarnings.push({
            column: definition.identityColumn,
            message: 'registro duplicado no arquivo',
          });
        } else {
          seenIdentity.add(key);
        }
      }

      return {
        index,
        data,
        valid: rowErrors.length === 0,
        errors: rowErrors,
        warnings: rowWarnings,
      };
    });

    const validRows = result.filter((row) => row.valid).length;
    return {
      entity,
      supportsImport: definition.supportsImport,
      mapping,
      unknownColumns,
      ignoredColumns,
      totalRows: rows.length,
      validRows,
      invalidRows: rows.length - validRows,
      rows: result,
      errors,
      warnings,
    };
  }
}
