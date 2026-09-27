/**
 * services/leads.service.ts
 *
 * Real backend `/leads` (`leads` table, LeadsController/LeadsService —
 * apps/api/src/modules/leads). Replaces the previous implementation, an in-memory
 * array with 2 fictitious leads ("Marina Torres"/"Rafael Azevedo") that
 * never called the API — every create/edit was lost on reload.
 *
 * `historicoInteracoes` is not embedded in the lead response — there is a
 * real, separate endpoint (`/lead-interactions?leadId=`). REM-04 (Remaining
 * Product Completion Backlog / GAP-10) wired that endpoint directly into
 * LeadViewModal via useLeadInteractions() instead of embedding it here — kept
 * empty in this layer so the source of truth is not duplicated.
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
  city: string | null;
  state: string | null;
  country: string | null;
  clientType: string | null;
  serviceType: string | null;
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
    city: row.city ?? undefined,
    state: row.state ?? undefined,
    country: row.country ?? undefined,
    clientType: (row.clientType ?? "other") as LeadClientType,
    serviceType: (row.serviceType ?? "consultoria") as LeadServiceType,
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
    city: data.city,
    state: data.state,
    country: data.country,
    clientType: data.clientType,
    serviceType: data.serviceType,
    payloadServico: data.payloadServico,
    dadosInternosCRM: data.dadosInternosCRM,
    uploads: data.uploads,
  };
}

export const leadsService = {
  async list(): Promise<Lead[]> {
    // api.get() already unwraps the {data,timestamp} envelope; since the controller
    // returns {data: [...], meta} directly (TransformInterceptor preserves
    // objects that already have `data`, it does not re-wrap), the value here already IS the array —
    // re-reading `.data` (via ListLeadsResult) duplicated the unwrap and yielded undefined.
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
    if (data.city !== undefined) payload.city = data.city;
    if (data.state !== undefined) payload.state = data.state;
    if (data.country !== undefined) payload.country = data.country;
    if (data.clientType !== undefined) payload.clientType = data.clientType;
    if (data.serviceType !== undefined) payload.serviceType = data.serviceType;
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
