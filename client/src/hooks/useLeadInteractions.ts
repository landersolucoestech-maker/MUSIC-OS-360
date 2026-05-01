import type { Tables, TablesInsert } from "@/types/database";
import { QUERY_KEYS } from "@/lib/query-config";
import { useSupabaseQuery } from "./useSupabaseQuery";

export type LeadInteraction = Tables<"lead_interactions">;
export type LeadInteractionInsert = Omit<TablesInsert<"lead_interactions">, "user_id" | "id" | "created_at">;

export const TIPO_INTERACAO_OPTIONS = [
  { value: "ligacao", label: "Ligação" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "email", label: "Email" },
  { value: "reuniao", label: "Reunião" },
  { value: "proposta", label: "Proposta Enviada" },
  { value: "followup", label: "Follow-up" },
] as const;

export const TIPO_INTERACAO_LABELS: Record<string, string> = Object.fromEntries(
  TIPO_INTERACAO_OPTIONS.map(o => [o.value, o.label])
);

export function useLeadInteractions(leadId?: string) {
  const result = useSupabaseQuery<LeadInteraction>({
    queryKey: [...QUERY_KEYS.LEAD_INTERACTIONS, leadId || ""],
    table: "lead_interactions",
    orderBy: { column: "data_interacao", ascending: false },
    filters: leadId ? { lead_id: leadId } : undefined,
    enabled: !!leadId,
  }, {
    create: { success: "Interação registrada!", error: "Erro ao registrar interação" },
    delete: { success: "Interação removida!", error: "Erro ao remover interação" },
  });

  return {
    interactions: result.data,
    isLoading: result.isLoading,
    error: result.error,
    addInteraction: result.create,
    deleteInteraction: result.delete,
    refetch: result.refetch,
  };
}
