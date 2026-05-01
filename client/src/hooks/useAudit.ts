import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { runAudit } from "@/lib/audit/runner";
import type { AuditResult } from "@/lib/audit/types";

export const auditQueryKey = (userId: string | null | undefined) =>
  ["audit", "data-quality", userId ?? "anon"] as const;

export function useAudit() {
  const { user } = useAuth();

  const query = useQuery<AuditResult>({
    queryKey: auditQueryKey(user?.id),
    queryFn: () => runAudit(),
    enabled: !!user,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
  };
}
