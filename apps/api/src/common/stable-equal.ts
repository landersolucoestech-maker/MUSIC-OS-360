/**
 * Structural equality for JSON values that ignores the order of object keys.
 *
 * jsonb columns hand objects back with their own key order (shorter keys first), not the order a client
 * posted them in, so comparing `JSON.stringify` output reports a change where there is none. Array order
 * is meaningful and is kept. `undefined` and `null` are the same absence.
 */
export function stableStringify(value: unknown): string {
  if (value === undefined || value === null) return 'null';
  if (value instanceof Date) return JSON.stringify(Number.isNaN(value.getTime()) ? null : value.toISOString());
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).filter((k) => record[k] !== undefined).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(record[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function jsonDeepEqual(a: unknown, b: unknown): boolean {
  return stableStringify(a) === stableStringify(b);
}
