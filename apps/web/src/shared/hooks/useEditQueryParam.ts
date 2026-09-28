import type { StorageTable } from "@/shared/lib/api-client";
import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { storage } from "@/shared/lib/storage";

export interface HasId {
  id?: unknown;
}

/**
 * Resolves `?<paramName>=<id>` to open a record (e.g. an edit modal)
 * coming from a deep link.
 *
 * `items` is typically the "give me everything" list of a hook such as useContratos()
 * — which today, without pagination, is stuck at the backend default of 50
 * records (see PaginationDto). Without the `table` parameter, the behavior is
 * identical to the original: it only resolves when the id is among the already
 * loaded `items`. Passing `table` (the key used in TABLE_ENDPOINT), when the
 * id is not found in the loaded list, it fetches DIRECTLY by ID
 * (GET /:resource/:id) — Task I: a `?edit=<id-of-record-75>` link now
 * resolves even when the record is outside the first ones loaded.
 */
export function useEditQueryParam<T extends HasId>(
  paramName: string,
  items: ReadonlyArray<T> | undefined,
  onMatch: (item: T) => void,
  table?: StorageTable,
): void {
  const [searchParams, setSearchParams] = useSearchParams();
  const handledRef = useRef<string | null>(null);

  useEffect(() => {
    const id = searchParams.get(paramName);
    if (!id) return;
    if (handledRef.current === id) return;

    const consume = (found: T) => {
      handledRef.current = id;
      onMatch(found);
      const next = new URLSearchParams(searchParams);
      next.delete(paramName);
      setSearchParams(next, { replace: true });
    };

    const match = items?.find((x) => String(x.id) === id);
    if (match) {
      consume(match);
      return;
    }

    // Not found in the loaded list — it may be outside the first
    // records (or the list has not arrived yet). Without `table`, keeps the
    // original behavior: waits for the list to load/grow.
    if (!table || !items || items.length === 0) return;

    let cancelled = false;
    (storage.findById(table, id) as Promise<T | undefined>).then((found) => {
      if (cancelled || !found) return;
      consume(found);
    });
    return () => { cancelled = true; };
  }, [searchParams, items, paramName, onMatch, setSearchParams, table]);
}
