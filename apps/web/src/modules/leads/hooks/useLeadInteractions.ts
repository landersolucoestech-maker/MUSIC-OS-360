/**
 * REM-04 (GAP-10): replaces `Lead.historicoInteracoes` (always []) with a
 * real read of `/lead-interactions?leadId=`.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { leadInteractionsService, type LeadInteractionType } from "../services/lead-interactions.service";

export const LEAD_INTERACTIONS_KEYS = {
  byLead: (leadId: string) => ["lead-interactions", leadId] as const,
};

export function useLeadInteractions(leadId: string | undefined) {
  return useQuery({
    queryKey: LEAD_INTERACTIONS_KEYS.byLead(leadId ?? ""),
    queryFn: () => leadInteractionsService.listByLead(leadId as string),
    enabled: Boolean(leadId),
  });
}

export function useCreateLeadInteraction(leadId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ type, notes }: { type: LeadInteractionType; notes?: string }) => {
      if (!leadId) throw new Error("leadId ausente");
      return leadInteractionsService.create(leadId, type, notes);
    },
    onSuccess: () => {
      if (leadId) queryClient.invalidateQueries({ queryKey: LEAD_INTERACTIONS_KEYS.byLead(leadId) });
    },
  });
}
