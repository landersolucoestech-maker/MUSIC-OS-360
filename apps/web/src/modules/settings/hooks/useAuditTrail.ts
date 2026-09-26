/**
 * settings/hooks/useAuditTrail.ts
 *
 * Hook de leitura do Audit Trail.
 *   desembrulhando { data: AuditLogEntry[] } do envelope TransformInterceptor.
 */

import { useQuery } from "@tanstack/react-query";
import { api } from "@/shared/lib/api-client";

export interface AuditLogEntry {
  id: string;
  created_at: string;
  user_id: string | null;
  actor_role: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  http_method: string | null;
  http_path: string | null;
  ip_address: string | null;
  correlation_id: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  diff: Record<string, { from: unknown; to: unknown }> | null;
}

export interface AuditTrailFilters {
  action?: string;
  entity?: string;
  entityId?: string;
  actorRole?: string;
  correlationId?: string;
  fromDate?: string;
  toDate?: string;
  limit?: number;
  offset?: number;
}

// Stable reference — see shared/hooks/useDataQuery.ts for the reason.
const EMPTY_AUDIT_LOGS: AuditLogEntry[] = [];

export function useAuditTrail(filters: AuditTrailFilters = {}) {
  const query = useQuery<AuditLogEntry[]>({
    queryKey: ["audit_logs", filters],
    queryFn: async () => {

      const params = new URLSearchParams();
      if (filters.action)        params.set("action",        filters.action);
      if (filters.entity)        params.set("entity",        filters.entity);
      if (filters.entityId)      params.set("entityId",      filters.entityId);
      if (filters.actorRole)     params.set("actorRole",     filters.actorRole);
      if (filters.correlationId) params.set("correlationId", filters.correlationId);
      if (filters.fromDate)      params.set("fromDate",      filters.fromDate);
      if (filters.toDate)        params.set("toDate",        filters.toDate);
      params.set("limit",  String(filters.limit  ?? 100));
      params.set("offset", String(filters.offset ?? 0));
      params.set("orderBy",    "created_at");
      params.set("ascending",  "false");

      const qs = params.toString();
      return api.get<AuditLogEntry[]>(
        `/audit-logs${qs ? `?${qs}` : ""}`,
      );
    },
    staleTime: 30_000,
  });
  return { ...query, data: query.data ?? EMPTY_AUDIT_LOGS };
}
