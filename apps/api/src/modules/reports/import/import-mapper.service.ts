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
import { WORK_DEPRECATED_FIELDS } from '../../works/work-legacy-fields';
import { PHONOGRAM_DEPRECATED_FIELDS } from '../../phonograms/phonogram-legacy-fields';
import { ARTIST_DEPRECATED_FIELDS } from '../../artists/artist-legacy-fields';
import { CLIENT_DEPRECATED_FIELDS } from '../../clients/client-legacy-fields';

/**
 * Headers of spreadsheets exported BEFORE a naming cluster changed a column's
 * PT-BR label or name (CZ-039/CZ-040/CZ-042/CZ-043): mapped to the canonical column so a
 * round-trip of an old export does not silently drop those values. Legacy
 * duration minutes/seconds have no single-column target and stay unknown.
 */
const LEGACY_IMPORT_HEADERS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  works: {
    'criada por ia': 'ai_used',
    'outros títulos': 'alternative_titles',
    'letra completa': 'lyrics',
    letristas: 'translator_names',
    ...Object.fromEntries(Object.entries(WORK_DEPRECATED_FIELDS).map(([legacy, canonical]) => [legacy.toLowerCase(), canonical])),
  },
  artists: {
    'nome civil': 'full_name',
    'nome do empresário': 'manager_name',
    'contato do empresário': 'manager_contact',
    ...Object.fromEntries(Object.entries(ARTIST_DEPRECATED_FIELDS).map(([legacy, canonical]) => [legacy.toLowerCase(), canonical])),
  },
  clients: {
    'endereço completo': 'address',
    'função': 'job_title',
    'prioridade do contato': 'priority',
    ...Object.fromEntries(Object.entries(CLIENT_DEPRECATED_FIELDS).map(([legacy, canonical]) => [legacy.toLowerCase(), canonical])),
  },
  phonograms: {
    'gravação original': 'recording_date',
    'país de origem': 'country_of_recording',
    ...Object.fromEntries(Object.entries(PHONOGRAM_DEPRECATED_FIELDS).map(([legacy, canonical]) => [legacy.toLowerCase(), canonical])),
  },
};

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
      const legacyTarget = LEGACY_IMPORT_HEADERS[def.tableName]?.[hl];
      const col =
        byName.get(hl) ??
        byLabel.get(hl) ??
        byCanonical.get(normalizeFieldKey(h).toLowerCase()) ??
        (legacyTarget && byName.has(legacyTarget.toLowerCase()) ? legacyTarget : null) ??
        null;
      mapping[header] = col;
      if (!col) unknownColumns.push(header);
    }

    return { mapping, unknownColumns, ignoredColumns };
  }
}
