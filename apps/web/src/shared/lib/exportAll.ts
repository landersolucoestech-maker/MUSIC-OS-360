import { storage, type PagedListOptions } from "@/shared/lib/storage";

export interface FetchAllPagesOptions extends Omit<PagedListOptions, "page" | "pageSize"> {
  /** Records per page during collection. Default: 200 (the backend's maximum limit). */
  pageSize?: number;
  /** Safety ceiling — never fetches infinitely. Default: 5000. */
  maxRecords?: number;
}

export interface FetchAllPagesResult<T> {
  items: T[];
  /** Real backend total (may be larger than items.length if truncated by maxRecords). */
  total: number;
  /** true when the safety ceiling was reached before covering `total`. */
  truncated: boolean;
}

/**
 * Task I — collects ALL records matching the current filters, via
 * iterative server-side pagination (never a single larger fixed `limit`).
 * Replaces the "export the list already loaded on screen" pattern (which inherited the
 * backend's default limit=50 when nobody asked for pagination) with a
 * complete, explicit sweep that respects the active filters.
 *
 * `maxRecords` is a SAFETY ceiling (avoids a runaway export on absurdly
 * large tenants), not a pagination solution — when reached,
 * `truncated: true` tells the caller to warn the user; it never cuts
 * silently.
 */
export async function fetchAllPages<T extends object>(
  table: string,
  options: FetchAllPagesOptions = {},
): Promise<FetchAllPagesResult<T>> {
  const { pageSize = 200, maxRecords = 5000, ...rest } = options;
  const items: T[] = [];
  let page = 1;
  let total = Infinity;

  while (items.length < total && items.length < maxRecords) {
    const result = await storage.listPaged<T & { id: string }>(table, { ...rest, page, pageSize });
    total = result.total;
    if (result.items.length === 0) break;
    items.push(...result.items);
    page += 1;
  }

  const truncated = items.length > maxRecords || items.length < total;
  return { items: items.slice(0, maxRecords), total, truncated };
}
