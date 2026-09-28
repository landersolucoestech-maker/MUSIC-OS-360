import type { StorageTable } from "@/shared/lib/api-client";
import { storage } from "@/shared/lib/storage";

/**
 * Task J — fetches ALL records of a table (real pagination, no fixed
 * cap) and extracts a label from each. Use: legacy pickers that store the
 * NAME (not the id) as the field value and filter client-side (e.g. a
 * "select" field with `searchable: true` of MarketingFormModal, or a simple
 * `<Select>`) — unlike useEntityLookup (server-side search by typed
 * term), here there is no id to resolve "the selected one" via useEntityById,
 * so the only way to never lose a record is to have the full set
 * of labels available for the local filter.
 *
 * ponytail: one query per table costs N/pageSize round trips for very
 * large tenants — acceptable to populate a dropdown of names (a few KB per
 * page). A safety ceiling of 50 pages (5000 records) avoids an infinite
 * loop if the backend never empties `items`. Upgrade: if these fields some
 * day migrate from "name as value" to "id as value", switch to
 * useEntityLookup + AsyncEntityCombobox (real server-side search).
 */
export async function fetchAllLabels(
  table: StorageTable,
  pick: (item: Record<string, unknown>) => string | null | undefined,
): Promise<{ value: string; label: string }[]> {
  const seen = new Set<string>();
  const out: { value: string; label: string }[] = [];
  const pageSize = 100;

  for (let page = 1; page <= 50; page += 1) {
    const result = await storage.listPaged<Record<string, unknown> & { id: string }>(table, {
      page,
      pageSize,
      orderBy: { column: "created_at", ascending: false },
    });
    for (const item of result.items) {
      const label = pick(item)?.trim();
      if (label && !seen.has(label)) {
        seen.add(label);
        out.push({ value: label, label });
      }
    }
    if (page >= result.totalPages || result.items.length === 0) break;
  }

  return out.sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
}
