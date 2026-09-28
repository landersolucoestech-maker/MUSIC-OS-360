/**
 * Deploy-skew compatibility for renamed request fields.
 *
 * The web and the API deploy independently, so for one release window a web
 * build may still send a field under the name it had before a technical
 * rename (e.g. a Portuguese column name). Such a field is declared in the DTO
 * as `deprecated` (the global pipe forbids unknown keys) and moved here to its
 * canonical name before anything past the controller sees it:
 *   - the canonical field wins when both names are sent;
 *   - an empty deprecated value (null / undefined / '') is dropped, never moved:
 *     a pre-rename build reads the canonical response fields as blanks and
 *     would send them back as nulls on edit, wiping the stored values
 *     (CZ-037 review). Clearing a field requires the canonical name;
 *   - the deprecated key never reaches persistence.
 *
 * Each module keeps its alias table next to its DTO, registered in the
 * canonical naming map as TEMPORARY_MIGRATION_COMPATIBILITY with a removal
 * condition; responses always use the canonical names only.
 */
export type DeprecatedFieldAliases = Readonly<Record<string, string>>;

export function applyDeprecatedFieldAliases<T extends object>(input: T, aliases: DeprecatedFieldAliases): T {
  const out: Record<string, unknown> = { ...(input as Record<string, unknown>) };
  for (const [deprecated, canonical] of Object.entries(aliases)) {
    if (!Object.prototype.hasOwnProperty.call(out, deprecated)) continue;
    const value = out[deprecated];
    if (out[canonical] === undefined && value !== null && value !== undefined && value !== '') out[canonical] = value;
    delete out[deprecated];
  }
  return out as T;
}
