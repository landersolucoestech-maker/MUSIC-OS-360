/**
 * `titulo` was the original PT-BR field name for title-like records across
 * several domains (events, marketing briefings, transactions); `title` is
 * now canonical (mirrors `contract-legacy-alias.util.ts`'s write-path
 * canonical/legacy pairing on the API side). This is the single legacy-read
 * boundary: consumers that only have a raw record should call this instead
 * of reading `record.titulo` directly.
 */
export function legacyTitle(record: Record<string, unknown> | null | undefined): unknown {
  if (!record) return undefined;
  return record.titulo ?? record.title;
}
