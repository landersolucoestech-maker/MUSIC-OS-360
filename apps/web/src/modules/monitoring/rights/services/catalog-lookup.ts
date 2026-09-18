/**
 * Catalog lookup helpers for Rights Monitoring.
 * Funções puras usadas para indexar o catálogo real (obtido via useObras())
 * por ISRC/id e calcular taxa de match ECAD / ISRCs órfãos. A busca do
 * catálogo em si acontece no componente, via hook real — este módulo não
 * busca dados sozinho (evita uma segunda fonte de verdade).
 */

export interface CatalogObra {
  id: string;
  title: string;
  compositor: string;
  compositores: string;
  editora: string;
  isrc: string;
  iswc: string | null;
  cod_ecad: string | null;
  cod_entidade: string | null;
  genero: string;
  status: string;
  duration_text: string;
}

export function buildIsrcIndex(obras: CatalogObra[]): Map<string, CatalogObra> {
  const index = new Map<string, CatalogObra>();
  for (const obra of obras) {
    if (obra.isrc) index.set(obra.isrc, obra);
  }
  return index;
}

/**
 * Computes match rate (0–100) based on how many unique ISRCs have
 * a catalog obra with a non-empty cod_ecad.
 */
export function computeEcadMatchRate(
  isrcs: string[],
  isrcIndex: Map<string, CatalogObra>,
): number {
  if (isrcs.length === 0) return 0;
  const matched = isrcs.filter((isrc) => {
    const obra = isrcIndex.get(isrc);
    return obra && obra.cod_ecad;
  }).length;
  return Math.round((matched / isrcs.length) * 100);
}

/**
 * Returns a list of ISRCs that have no corresponding obra in the catalog.
 */
export function findOrphanIsrcs(
  isrcs: string[],
  isrcIndex: Map<string, CatalogObra>,
): string[] {
  return isrcs.filter((isrc) => !isrcIndex.has(isrc));
}
