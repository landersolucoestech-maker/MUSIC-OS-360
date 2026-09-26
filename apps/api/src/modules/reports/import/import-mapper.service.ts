/**
 * modules/reports/import/import-mapper.service.ts  ·  PHASE 2.3A
 * Resolves each file header to an IMPORTABLE contract column.
 * Accepts the pt-BR label (export round-trip), the technical name or camelCase.
 * tenant_id is never importable → marked as ignored.
 */
import { Injectable } from '@nestjs/common';
import { getFieldLabelPtBr, normalizeFieldKey } from '../i18n/field-labels.pt-br';
import { isWritableKey } from '../../../core/security/safe-object';
import type { ReportEntityDefinition } from '../definitions/report-entity-definition.types';

export interface HeaderMapping {
  mapping: Record<string, string | null>;
  unknownColumns: string[];
  ignoredColumns: string[];
}

@Injectable()
export class ImportMapperService {
  build(def: ReportEntityDefinition, headers: string[]): HeaderMapping {
    // Resolution indexes built from the contract's importable columns.
    const byLabel = new Map<string, string>();
    const byCanonical = new Map<string, string>();
    const byName = new Map<string, string>();
    for (const col of def.importableColumns) {
      byLabel.set(getFieldLabelPtBr(col).toLowerCase(), col);
      byCanonical.set(normalizeFieldKey(col).toLowerCase(), col);
      byName.set(col.toLowerCase(), col);
    }

    // Prototype-less bag: the file header is a dynamic, user-controlled key;
    // null-proto + isWritableKey prevent property injection (CWE-915).
    const mapping: Record<string, string | null> = Object.create(null);
    const unknownColumns: string[] = [];
    const ignoredColumns: string[] = [];

    for (const header of headers) {
      const h = header.trim();
      // A header that tries to pollute the prototype (__proto__, constructor, …) is ignored.
      if (!isWritableKey(header)) {
        ignoredColumns.push(header);
        continue;
      }
      const hl = h.toLowerCase();
      // tenant_id (in any form) is never imported — multi-tenant security.
      if (hl === 'tenant_id' || normalizeFieldKey(h).toLowerCase() === 'tenantid' || hl === 'tenant') {
        mapping[header] = null;
        ignoredColumns.push(header);
        continue;
      }
      const col =
        byName.get(hl) ??
        byLabel.get(hl) ??
        byCanonical.get(normalizeFieldKey(h).toLowerCase()) ??
        null;
      mapping[header] = col;
      if (!col) unknownColumns.push(header);
    }

    return { mapping, unknownColumns, ignoredColumns };
  }
}
