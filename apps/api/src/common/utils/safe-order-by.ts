/**
 * `orderBy` chega como string livre do @Query() do cliente. TypeORM insere o
 * valor de QueryBuilder.orderBy() diretamente no SQL (colunas não são
 * parametrizáveis), então repassar a string sem checagem é injeção de SQL.
 * Restringe a um allow-list de colunas por entidade; fora da lista, cai no default.
 */
export function safeOrderBy(value: string | undefined, allowed: readonly string[], fallback: string): string {
  return value && (allowed as string[]).includes(value) ? value : fallback;
}
