import { useEffect, useMemo, useState } from "react";

/**
 * The system's standard client-side pagination hook.
 * Keeps page/items-per-page and returns the current slice.
 * Resets to the first page when the total changes (e.g. filters).
 */
export function usePagination<T>(items: T[], initialPageSize = 10) {
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(initialPageSize);

  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages - 1);

  // Goes back to the first page when the data set shrinks below the current page.
  useEffect(() => {
    if (page > totalPages - 1) setPage(0);
  }, [page, totalPages]);

  const pageItems = useMemo(
    () => items.slice(safePage * pageSize, safePage * pageSize + pageSize),
    [items, safePage, pageSize],
  );

  return {
    page: safePage,
    pageSize,
    total,
    totalPages,
    pageItems,
    setPage,
    setPageSize: (size: number) => {
      setPageSize(size);
      setPage(0);
    },
  };
}
