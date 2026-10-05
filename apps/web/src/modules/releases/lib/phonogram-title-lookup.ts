import type { PhonogramWithRelations } from "@/modules/catalog/hooks/usePhonograms";
import { normStr } from "@/modules/releases/lib/genre-match";
import { storage } from "@/shared/lib/storage";

/**
 * Resolves a phonogram by exact title (after normalization) — server-side
 * search (ILIKE) instead of scanning the capped, unfiltered usePhonograms()
 * list (Task J). Used only for best-effort autofill (ISRC of a project track);
 * a few results are enough, so the small `pageSize` is intentional.
 */
export async function findPhonogramByTitle(title: string): Promise<PhonogramWithRelations | undefined> {
  if (!title.trim()) return undefined;
  const target = normStr(title);
  const { items } = await storage.listPaged<PhonogramWithRelations & { id: string }>("phonograms", {
    page: 1,
    pageSize: 5,
    filters: { search: title },
  });
  return items.find((f) => normStr(f.title ?? "") === target);
}
