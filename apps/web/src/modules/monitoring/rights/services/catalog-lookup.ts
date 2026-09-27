/**
 * Catalog lookup helpers for Rights Monitoring.
 * Pure functions used to index the real catalog (obtained via useWorks())
 * by ISRC/id and compute the ECAD match rate / orphan ISRCs. The catalog
 * fetch itself happens in the component, via a real hook — this module does not
 * fetch data on its own (avoids a second source of truth).
 */

export interface CatalogWork {
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

export function buildIsrcIndex(works: CatalogWork[]): Map<string, CatalogWork> {
  const index = new Map<string, CatalogWork>();
  for (const work of works) {
    if (work.isrc) index.set(work.isrc, work);
  }
  return index;
}

/**
 * Computes match rate (0–100) based on how many unique ISRCs have
 * a catalog obra with a non-empty cod_ecad.
 */
export function computeEcadMatchRate(
  isrcs: string[],
  isrcIndex: Map<string, CatalogWork>,
): number {
  if (isrcs.length === 0) return 0;
  const matched = isrcs.filter((isrc) => {
    const work = isrcIndex.get(isrc);
    return work && work.cod_ecad;
  }).length;
  return Math.round((matched / isrcs.length) * 100);
}

/**
 * Returns a list of ISRCs that have no corresponding obra in the catalog.
 */
export function findOrphanIsrcs(
  isrcs: string[],
  isrcIndex: Map<string, CatalogWork>,
): string[] {
  return isrcs.filter((isrc) => !isrcIndex.has(isrc));
}
