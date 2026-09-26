/**
 * `orderBy` arrives as a free string from the client's @Query(). TypeORM inserts the
 * QueryBuilder.orderBy() value directly into the SQL (columns cannot be
 * parameterized), so passing the string through unchecked is SQL injection.
 * Restricts it to a per-entity allow-list of columns; outside the list, it falls back to the default.
 */
export function safeOrderBy(value: string | undefined, allowed: readonly string[], fallback: string): string {
  return value && (allowed as string[]).includes(value) ? value : fallback;
}
