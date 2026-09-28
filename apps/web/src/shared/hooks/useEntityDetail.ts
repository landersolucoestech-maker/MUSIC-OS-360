/**
 * useEntityDetail
 *
 * Fetches a single entity by ID via the storage abstraction.
 *
 * In HTTP mode  → calls GET /{endpoint}/{id} which the backend decorates with
 *                  `allowed_transitions` filtered by the actor's role and
 *                  workflow guards — the authoritative source for transition UI.
 * In mock mode  → returns the entity from MOCK_DATA (no allowed_transitions);
 *                  callers fall back to the local workflow-transitions mirror.
 *
 * Usage in detail modals:
 *   const { data: detail } = useEntityDetail('lancamentos', lancamento?.id, open);
 *   const allowedTransitions = resolveAllowedTransitions(
 *     'release', detail?.status ?? lancamento?.status, detail?.allowed_transitions
 *   );
 */

import type { StorageTable } from "@/shared/lib/api-client";
import { useQuery } from '@tanstack/react-query';
import { storage } from '@/shared/lib/storage';

export function useEntityDetail<T = Record<string, unknown>>(
  table: StorageTable,
  id: string | undefined,
  enabled = true,
) {
  return useQuery<T | undefined>({
    queryKey: [table, 'detail', id],
    queryFn:  () => storage.getById<T & { id: string }>(table, id!),
    enabled:  enabled && !!id,
    staleTime: 0,
  });
}
