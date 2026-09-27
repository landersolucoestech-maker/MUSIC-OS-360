import { useEffect, useState } from "react";
import { getImageContrastMode, type ContrastMode } from "@/shared/lib/image-contrast";

/**
 * Resolves the contrast mode (light/dark) of an image to choose
 * readable text/chrome colors over it. Default `darkBackground` while
 * loading or when there is no `src`.
 */
export function useImageContrast(src: string | null | undefined): { mode: ContrastMode; isLoading: boolean } {
  const [mode, setMode] = useState<ContrastMode>("lightBackground");
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(src));

  useEffect(() => {
    let active = true;
    if (!src) {
      setMode("lightBackground");
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    getImageContrastMode(src).then((m) => {
      if (!active) return;
      setMode(m);
      setIsLoading(false);
    });
    return () => {
      active = false;
    };
  }, [src]);

  return { mode, isLoading };
}
