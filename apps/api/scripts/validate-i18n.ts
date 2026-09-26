/**
 * scripts/validate-i18n.ts  ·  PHASE 2.1 — BLOCKING i18n (pt-BR) build guard.
 *
 * Fails the build (exit ≠ 0) if there is ANY:
 *   - visible reportable column without a label;
 *   - contract column (export/import/filter/sort/search/identity/display/date)
 *     without a label;
 *   - sensitive column listed as exportable/importable;
 *   - empty label / equal to the raw key / containing a forbidden English term;
 *   - ambiguity in the reverse map of the critical labels.
 *
 * Criterion: 0 untranslated · 0 unsafe · 0 ambiguous · 0 forbidden.
 * Usage: npm run validate:i18n   (CI-integrable)
 */
import {
  FIELD_LABELS_PT_BR, FIELD_KEYS_BY_LABEL_PT_BR, tryGetFieldLabelPtBr,
} from '../src/modules/reports/i18n/field-labels.pt-br';
import { EntityMetadataService } from '../src/modules/reports/entity-metadata.service';
import { ReportEntityDefinitionService } from '../src/modules/reports/definitions/report-entity-definition.service';

const FORBIDDEN_ENGLISH = [
  'Name', 'Phone', 'Email', 'Website', 'Address', 'Country', 'State', 'Notes',
  'Priority', 'Timeline', 'Attachments', 'Tags', 'Manager', 'Company',
  'Contact Type', 'Signing Platform', 'Soundcloud Url', 'Apple Music Url', 'Url',
];

const errors: string[] = [];
const entries = Object.entries(FIELD_LABELS_PT_BR);

// 1: dictionary integrity.
for (const [key, label] of entries) {
  if (!label || !label.trim()) errors.push(`Empty label for "${key}".`);
  if (label.trim() === key) errors.push(`Label exposes the raw key: "${key}".`);
  for (const term of FORBIDDEN_ENGLISH) {
    if (new RegExp(`\\b${term.replace(/ /g, '\\s')}\\b`, 'i').test(label)) {
      errors.push(`English label: "${key}"="${label}" contains "${term}".`);
    }
  }
}

// 2: reverse map of the critical labels.
for (const [label, expected] of [
  ['link do spotify', 'spotifyUrl'],
  ['link do youtube', 'youtubeUrl'],
  ['nome do empresário', 'managerName'],
  ['empresa', 'companyName'],
  ['plataforma de assinatura', 'signingPlatform'],
] as Array<[string, string]>) {
  if (FIELD_KEYS_BY_LABEL_PT_BR[label] !== expected) {
    errors.push(`Ambiguous reverse map: "${label}" → "${FIELD_KEYS_BY_LABEL_PT_BR[label]}" (expected "${expected}").`);
  }
}

// 3: EVERY visible reportable column needs a label (BLOCKING).
const inv = new EntityMetadataService().scan();
for (const e of inv.entities) {
  if (!e.reportable) continue;
  for (const c of e.columns) {
    const internal =
      c.primary || c.generated || c.isTenantId || c.isCreatedAt || c.isUpdatedAt ||
      c.isDeletedAt || /_id$/.test(c.name) ||
      ['created_by', 'updated_by', 'uploaded_by', 'approved_by', 'org_slug', 'metadata'].includes(c.name);
    const sensitive = /_encrypted$|token|password|secret|hash|credential/i.test(c.name);
    if (!internal && !sensitive && c.label === null) {
      errors.push(`Reportable column without label: ${e.tableName}.${c.name}`);
    }
  }
}

// 4: EVERY column used in the contracts needs a label; sensitive ones are not exportable.
const defs = new ReportEntityDefinitionService(new EntityMetadataService()).getDefinitions();
for (const d of defs) {
  const contractCols = new Set([
    d.identityColumn, d.displayColumn, d.dateColumn,
    ...d.exportableColumns, ...d.importableColumns, ...d.filterableColumns,
    ...d.sortableColumns, ...d.searchableColumns,
  ]);
  for (const col of contractCols) {
    if (tryGetFieldLabelPtBr(col) === null) {
      errors.push(`Contract column without label: ${d.tableName}.${col}`);
    }
  }
  for (const sens of d.sensitiveColumns) {
    if (d.exportableColumns.includes(sens) || d.importableColumns.includes(sens)) {
      errors.push(`Sensitive column exposed in export/import: ${d.tableName}.${sens}`);
    }
  }
}

console.log(`[validate:i18n] dictionary: ${entries.length} fields · contracts: ${defs.length} entities`);

if (errors.length > 0) {
  console.error(`\n[validate:i18n] FAILED — ${errors.length} violation(s):`);
  for (const e of errors.slice(0, 80)) console.error('  ✗ ' + e);
  if (errors.length > 80) console.error(`  … +${errors.length - 80}`);
  process.exit(1);
}
console.log('[validate:i18n] OK — 0 untranslated · 0 unsafe · 0 ambiguous · 0 forbidden.');
