import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";

export interface HasId {
  id: string | number;
}

export function useEditQueryParam<T extends HasId>(
  paramName: string,
  items: ReadonlyArray<T> | undefined,
  onMatch: (item: T) => void,
): void {
  const [searchParams, setSearchParams] = useSearchParams();
  const handledRef = useRef<string | null>(null);

  useEffect(() => {
    const id = searchParams.get(paramName);
    if (!id || !items || items.length === 0) return;
    if (handledRef.current === id) return;

    const match = items.find((x) => String(x.id) === id);
    if (!match) return;

    handledRef.current = id;
    onMatch(match);

    const next = new URLSearchParams(searchParams);
    next.delete(paramName);
    setSearchParams(next, { replace: true });
  }, [searchParams, items, paramName, onMatch, setSearchParams]);
}
