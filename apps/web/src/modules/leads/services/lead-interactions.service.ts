/**
 * services/lead-interactions.service.ts
 *
 * REM-04 (Remaining Product Completion Backlog / GAP-10): `Lead.historicoInteracoes`
 * era sempre `[]` — existe um endpoint real (`/lead-interactions`,
 * LeadInteractionsController/Service) que nunca foi integrado a esta tela.
 * Este serviço lê diretamente da tabela real `lead_interactions`.
 */
import { api } from "@/shared/lib/api-client";

export type LeadInteractionType = "call" | "email" | "meeting" | "whatsapp" | "note" | "proposal" | "other";

export const LEAD_INTERACTION_TYPE_LABELS: Record<LeadInteractionType, string> = {
  call: "Ligação",
  email: "Email",
  meeting: "Reunião",
  whatsapp: "WhatsApp",
  note: "Observação",
  proposal: "Proposta",
  other: "Outro",
};

export interface LeadInteractionRecord {
  id: string;
  leadId: string;
  type: LeadInteractionType;
  notes: string | null;
  data: string;
  createdBy: string | null;
}

interface RawLeadInteraction {
  id: string;
  lead_id: string;
  type: string;
  notes: string | null;
  data: string;
  created_by: string | null;
}

function fromApi(r: RawLeadInteraction): LeadInteractionRecord {
  return {
    id: r.id,
    leadId: r.lead_id,
    type: r.type as LeadInteractionType,
    notes: r.notes,
    data: r.data,
    createdBy: r.created_by,
  };
}

export const leadInteractionsService = {
  async listByLead(leadId: string): Promise<LeadInteractionRecord[]> {
    const res = await api.get<{ data: RawLeadInteraction[] }>(`/lead-interactions?leadId=${encodeURIComponent(leadId)}`);
    return (res.data ?? []).map(fromApi);
  },

  async create(leadId: string, type: LeadInteractionType, notes?: string): Promise<LeadInteractionRecord> {
    const created = await api.post<RawLeadInteraction>("/lead-interactions", { leadId, type: type, notes });
    return fromApi(created);
  },
};
