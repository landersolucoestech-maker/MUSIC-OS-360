/**
 * modules/dashboard/hooks/useActivityHistory.ts
 *
 * Loads the persisted activity history (audit-logs) to populate
 * the Dashboard Activity Feed before/after real-time events.
 *
 * In HTTP mode it calls GET /api/v1/audit-logs?limit=N.
 */
import { useQuery } from "@tanstack/react-query";
import { api } from "@/shared/lib/api-client";
import { storage } from "@/shared/lib/storage";

export interface AuditLogRow {
  id: string;
  tenant_id?: string | null;
  user_id?: string | null;
  actor_role?: string | null;
  action: string;
  entity: string;
  entity_id?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  created_at: string;
}

async function fetchHistory(limit: number): Promise<AuditLogRow[]> {
  return api.get<AuditLogRow[]>(`/audit-logs?limit=${limit}`);
}

export function useActivityHistory(limit = 30) {
  return useQuery<AuditLogRow[]>({
    queryKey: ["activity-history", limit],
    queryFn:  () => fetchHistory(limit),
    staleTime:        30_000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}

