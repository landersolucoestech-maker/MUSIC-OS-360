import { useEffect, useMemo, useState } from "react";
import { leadsService } from "../services";
import type { Lead } from "../types";

export function useLeads() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  async function refresh() {
    setIsLoading(true);
    try {
      setLeads(await leadsService.list());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  return {
    leads,
    isLoading,
    error,
    metrics: useMemo(() => ({
      total:         leads.length,
      followUps:     leads.filter((lead) => lead.dadosInternosCRM.proximoFollowUp).length,
      // Alinhado ao enum real LeadStatus (@music-os-360/types): "proposal"/"closed".
      propostas:     leads.filter((lead) => lead.dadosInternosCRM.statusLead === "proposal").length,
      contratos:     leads.filter((lead) => lead.dadosInternosCRM.statusLead === "closed").length,
      valorEstimado: leads.reduce((sum, lead) => sum + Number(lead.dadosInternosCRM.valorEstimado ?? 0), 0),
    }), [leads]),
    createLead: async (data: Parameters<typeof leadsService.create>[0]) => {
      await leadsService.create(data);
      await refresh();
    },
    updateLead: async (id: string, data: Partial<Lead>, expectedUpdatedAt?: string) => {
      await leadsService.update(id, data, expectedUpdatedAt);
      await refresh();
    },
    deleteLead: async (id: string) => {
      await leadsService.remove(id);
      await refresh();
    },
    refetch: refresh,
  };
}
