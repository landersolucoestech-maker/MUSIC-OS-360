/**
 * modules/reports/export/export-format.service.ts  ·  PHASE 2.2
 *
 * Centralized serialization. Headers ALWAYS in pt-BR via getFieldLabelPtBr
 * (single source). Values formatted in pt-BR (date, boolean, number). No
 * formatting scattered across the application.
 */
import { Injectable } from '@nestjs/common';
import * as XLSX from 'xlsx';
import { getFieldLabelPtBr } from '../i18n/field-labels.pt-br';
import { exportValueLabel } from '../i18n/value-labels.pt-br';

export interface ExportColumnHeader {
  key: string;
  label: string;
}

export const EXCEL_CELL_MAX_CHARS = 32767;
const EXCEL_CELL_SAFE_CHARS = 32000;
const TRUNCATION_SUFFIX = '… [truncado: excede o limite de célula do Excel]';

const ALWAYS_DANGEROUS_PREFIXES = ['=', '@', '\t', '\r'];
const PLAUSIBLE_PHONE = /^\+[\d\s()-]+$/;
const PLAUSIBLE_NEGATIVE_NUMBER = /^-[\d.,]+$/;

export function neutralizeFormulaInjection(text: string): string {
  if (text.length === 0) return text;
  const first = text[0];
  if (ALWAYS_DANGEROUS_PREFIXES.includes(first)) return `'${text}`;
  if (first === '+' && !PLAUSIBLE_PHONE.test(text)) return `'${text}`;
  if (first === '-' && !PLAUSIBLE_NEGATIVE_NUMBER.test(text)) return `'${text}`;
  return text;
}

export interface CellContext {
  entity: string;
  column: string;
}

export function sanitizeExcelCellValue(value: unknown, context: CellContext): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toLocaleDateString('pt-BR');
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
  if (typeof value === 'object') {
    // eslint-disable-next-line no-console
    console.warn(`[reports-export] technical field skipped (raw object/array): ${context.entity}.${context.column}`);
    return '';
  }
  let text: string;
  const enumLabel = exportValueLabel(context.entity, context.column, value);
  if (enumLabel !== null) {
    text = enumLabel;
  } else if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T?/.test(value)) {
    const d = new Date(value);
    text = Number.isNaN(d.getTime()) ? value : d.toLocaleDateString('pt-BR');
  } else {
    text = String(value);
  }
  if (text.length > EXCEL_CELL_MAX_CHARS) {
    // eslint-disable-next-line no-console
    console.warn(
      `[reports-export] field truncated for export: ${context.entity}.${context.column} ` +
      `had ${text.length} characters (Excel limit: ${EXCEL_CELL_MAX_CHARS})`,
    );
    text = text.slice(0, EXCEL_CELL_SAFE_CHARS - TRUNCATION_SUFFIX.length) + TRUNCATION_SUFFIX;
  }
  return neutralizeFormulaInjection(text);
}

@Injectable()
export class ExportFormatService {
  headers(columns: string[]): ExportColumnHeader[] {
    return columns.map((key) => ({ key, label: getFieldLabelPtBr(key) }));
  }

  /** Every report workbook has exactly one sheet. */
  toXlsx(entity: string, sheetName: string, columns: string[], rows: Record<string, unknown>[]): Buffer {
    const header = this.headers(columns).map((h) => h.label);
    const aoa: unknown[][] = [
      header,
      ...rows.map((r) => columns.map((c) => sanitizeExcelCellValue(r[c], { entity, column: c }))),
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31) || 'Export');
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  }
}
