/**
 * PT-BR end-user copy helpers for Reports Center errors. Table names and
 * column keys are technical identifiers: they are rendered through the
 * canonical label dictionaries, and an untranslated key never reaches the
 * message (generic wording instead).
 */
import { resolveEntityLabel } from './entity-labels.pt-br';
import { tryGetFieldLabelPtBr } from './field-labels.pt-br';

/** `"Artistas"` for a translated table, otherwise `esta entidade`. */
export function entityCopyPtBr(tableName: string): string {
  const label = resolveEntityLabel(tableName);
  return label ? `"${label}"` : 'esta entidade';
}

/** `"Nome completo"` for a translated column, otherwise `um dos campos`. */
export function fieldCopyPtBr(columnKey: string): string {
  const label = tryGetFieldLabelPtBr(columnKey);
  return label ? `"${label}"` : 'um dos campos';
}
