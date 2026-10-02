/**
 * Deprecated XLSX header aliases accepted on import (applied by the parser BEFORE the
 * `isWritableKey` check, which stays strict: em dash is not a writable-key character).
 *
 * The projects export used `Duração — Minutos` / `Duração — Segundos`; the labels are now
 * `Duração (minutos)` / `Duração (segundos)` (parenthesis style of the sibling labels). A file
 * exported before the rename must still import. Normalization (NFKC, case, dash/space) is used
 * only to LOOK UP the alias; an unlisted header is returned unchanged.
 * Removal condition: drop an alias once no pre-rename export is expected (owner: reports module).
 */
const DEPRECATED_IMPORT_HEADER_ALIASES: Readonly<Record<string, string>> = {
  'duração — minutos': 'Duração (minutos)',
  'duração — segundos': 'Duração (segundos)',
};

function aliasLookupKey(header: string): string {
  return header
    .normalize('NFKC')
    .trim()
    .toLocaleLowerCase('pt-BR')
    .replace(/\s*[‒–—―−]\s*/g, ' — ')
    .replace(/\s+/g, ' ');
}

/** Current header for a deprecated one; any other header unchanged. */
export function resolveDeprecatedImportHeader(header: string): string {
  const key = aliasLookupKey(header);
  return Object.prototype.hasOwnProperty.call(DEPRECATED_IMPORT_HEADER_ALIASES, key)
    ? DEPRECATED_IMPORT_HEADER_ALIASES[key]!
    : header;
}
