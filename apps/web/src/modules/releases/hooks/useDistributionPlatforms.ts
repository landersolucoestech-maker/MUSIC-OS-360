import { useCallback, useEffect, useState } from "react";
import {
  DISTRIBUTION_PLATFORMS,
  DISTRIBUTOR_CONNECTIONS_KEY,
  getEnabledDistributionPlatforms,
  type ConnectedDistributionPlatform,
  type DistributionPlatform,
} from "@/modules/releases/services/distribution-platforms";

interface UseDistributionPlatformsResult {
  /** Full catalog supported by the system. */
  platforms: readonly DistributionPlatform[];
  /** Only the platforms actually connected/enabled. */
  enabledPlatforms: ConnectedDistributionPlatform[];
  /** Is at least one platform connected? */
  hasAnyConnected: boolean;
}

/**
 * Exposes the distributor catalog and the effectively connected subset.
 * Reacts to connection changes (storage event) to reflect connections made in
 * Settings without reloading the page.
 */
export function useDistributionPlatforms(): UseDistributionPlatformsResult {
  const [enabledPlatforms, setEnabledPlatforms] = useState<ConnectedDistributionPlatform[]>(
    () => getEnabledDistributionPlatforms(),
  );

  const refresh = useCallback(() => {
    setEnabledPlatforms(getEnabledDistributionPlatforms());
  }, []);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === DISTRIBUTOR_CONNECTIONS_KEY) refresh();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [refresh]);

  return {
    platforms: DISTRIBUTION_PLATFORMS,
    enabledPlatforms,
    hasAnyConnected: enabledPlatforms.length > 0,
  };
}
