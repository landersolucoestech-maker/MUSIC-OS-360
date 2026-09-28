import { useEffect, useState } from "react";
import { clientsService, type ClientTimelineEntry, type ClientTimelineEntryType } from "../services/clients.service";

/**
 * A client's real timeline (persisted in activity_logs — survives a
 * reload). Replaces the old useContactTimelineStore (in-memory Zustand,
 * never used by any component, removed in Part 80).
 */
export function useClientTimeline(clientId: string | null) {
  const [entries, setEntries] = useState<ClientTimelineEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  async function refresh() {
    if (!clientId) { setEntries([]); return; }
    setIsLoading(true);
    try {
      setEntries(await clientsService.getTimeline(clientId));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  return {
    entries,
    isLoading,
    error,
    addEntry: async (type: ClientTimelineEntryType, description: string) => {
      if (!clientId) return;
      await clientsService.addTimelineEntry(clientId, { type, description });
      await refresh();
    },
    refetch: refresh,
  };
}
