/**
 * services/leads.service.ts
 *
 * Backend real `/leads` (tabela `leads`, LeadsController/LeadsService —
 * apps/api/src/modules/leads). Substitui a implementação anterior, um array
 * em memória com 2 leads fictícios ("Marina Torres"/"Rafael Azevedo") que
 * nunca chamava a API — toda criação/edição era perdida ao recarregar.
 *
 * `historicoInteracoes` não é embutido na resposta do lead — existe um
 * endpoint real e separado (`/lead-interactions?leadId=`). REM-04 (Remaining
 * Product Completion Backlog / GAP-10) integrou esse endpoint diretamente em
 * LeadViewModal via useLeadInteractions() em vez de embuti-lo aqui — mantido
 * vazio nesta camada para não duplicar a fonte de verdade.
 */
import { api } from "@/shared/lib/api-client";
import type { Lead, LeadClientType, LeadServiceType, LeadInternalCRMData } from "../types";

interface ApiLeadResponse {
  id: string;
  name: string;
  nome_completo: string | null;
  nomeArtistico: string | null;
  empresa: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  instagram: string | null;
  cidade: string | null;
  estado: string | null;
  pais: string | null;
  tipoCliente: string | null;
  tipoServico: string | null;
  payloadServico: Record<string, unknown> | null;
  dadosInternosCRM: Record<string, unknown> | null;
  status: string;
  uploads: unknown[] | null;
  created_at: string;
  updated_at: string;
}

interface ListLeadsResult {
  data: ApiLeadResponse[];
  meta: { total: number; offset: number; limit: number };
}

function fromApi(row: ApiLeadResponse): Lead {
  const crm = (row.dadosInternosCRM ?? {}) as Partial<LeadInternalCRMData>;
  return {
    id: row.id,
    nomeCompleto: row.nome_completo ?? row.name,
    nomeArtistico: row.nomeArtistico ?? undefined,
    empresa: row.empresa ?? undefined,
    email: row.email ?? undefined,
    whatsapp: row.whatsapp ?? undefined,
    instagram: row.instagram ?? undefined,
    cidade: row.cidade ?? undefined,
    estado: row.estado ?? undefined,
    pais: row.pais ?? undefined,
    tipoCliente: (row.tipoCliente ?? "other") as LeadClientType,
    tipoServico: (row.tipoServico ?? "consultoria") as LeadServiceType,
    payloadServico: row.payloadServico ?? {},
    dadosInternosCRM: { ...crm, statusLead: row.status } as LeadInternalCRMData,
    uploads: (row.uploads ?? []) as Lead["uploads"],
    historicoInteracoes: [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toApiPayload(data: Omit<Lead, "id" | "createdAt" | "updatedAt" | "historicoInteracoes">): Record<string, unknown> {
  return {
    name: data.nomeCompleto,
    nomeArtistico: data.nomeArtistico,
    empresa: data.empresa,
    email: data.email,
    phone: data.whatsapp,
    whatsapp: data.whatsapp,
    instagram: data.instagram,
    cidade: data.cidade,
    estado: data.estado,
    pais: data.pais,
    tipoCliente: data.tipoCliente,
    tipoServico: data.tipoServico,
    payloadServico: data.payloadServico,
    dadosInternosCRM: data.dadosInternosCRM,
    uploads: data.uploads,
  };
}

export const leadsService = {
  async list(): Promise<Lead[]> {
    // api.get() já desembrulha o envelope {data,timestamp}; como o controller
    // retorna {data: [...], meta} diretamente (TransformInterceptor preserva
    // objetos que já têm `data`, não re-envolve), o valor aqui já É o array —
    // reler `.data` (via ListLeadsResult) duplicava o unwrap e dava undefined.
    const result = await api.get<ApiLeadResponse[]>("/leads?limit=200");
    return result.map(fromApi).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  async create(data: Omit<Lead, "id" | "createdAt" | "updatedAt" | "historicoInteracoes">): Promise<Lead> {
    const created = await api.post<ApiLeadResponse>("/leads", toApiPayload(data));
    return fromApi(created);
  },
  async update(id: string, data: Partial<Lead>, expectedUpdatedAt?: string): Promise<Lead> {
    const payload: Record<string, unknown> = {};
    if (expectedUpdatedAt !== undefined) payload.expectedUpdatedAt = expectedUpdatedAt;
    if (data.nomeCompleto !== undefined) payload.name = data.nomeCompleto;
    if (data.nomeArtistico !== undefined) payload.nomeArtistico = data.nomeArtistico;
    if (data.empresa !== undefined) payload.empresa = data.empresa;
    if (data.email !== undefined) payload.email = data.email;
    if (data.whatsapp !== undefined) { payload.phone = data.whatsapp; payload.whatsapp = data.whatsapp; }
    if (data.instagram !== undefined) payload.instagram = data.instagram;
    if (data.cidade !== undefined) payload.cidade = data.cidade;
    if (data.estado !== undefined) payload.estado = data.estado;
    if (data.pais !== undefined) payload.pais = data.pais;
    if (data.tipoCliente !== undefined) payload.tipoCliente = data.tipoCliente;
    if (data.tipoServico !== undefined) payload.tipoServico = data.tipoServico;
    if (data.payloadServico !== undefined) payload.payloadServico = data.payloadServico;
    if (data.uploads !== undefined) payload.uploads = data.uploads;
    if (data.dadosInternosCRM !== undefined) {
      const { statusLead, ...rest } = data.dadosInternosCRM;
      payload.dadosInternosCRM = rest;
      if (statusLead !== undefined) payload.status = statusLead;
    }
    const updated = await api.patch<ApiLeadResponse>(`/leads/${id}`, payload);
    return fromApi(updated);
  },
  async remove(id: string): Promise<void> {
    await api.delete(`/leads/${id}`);
  },
};
