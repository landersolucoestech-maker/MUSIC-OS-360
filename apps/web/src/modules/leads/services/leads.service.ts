/**
 * services/leads.service.ts
 *
 * Real backend `/leads` (`leads` table, LeadsController/LeadsService —
 * apps/api/src/modules/leads). Replaces the previous implementation, an in-memory
 * array with 2 fictitious leads ("Marina Torres"/"Rafael Azevedo") that
 * never called the API — every create/edit was lost on reload.
 *
 * The interaction history is not embedded in the lead response — there is a
 * real, separate endpoint (`/lead-interactions?leadId=`), wired directly into
 * LeadViewModal via useLeadInteractions() (REM-04 / GAP-10).
 *
 * Wire contract: canonical English fields (CZ-033).
 */
import { api } from "@/shared/lib/api-client";
import type { Lead, LeadClientType, LeadServiceType, LeadInternalCRMData } from "../types";

interface ApiLeadResponse {
  id: string;
  name: string;
  fullName: string | null;
  stageName: string | null;
  company: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  instagram: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  clientType: string | null;
  serviceType: string | null;
  servicePayload: Record<string, unknown> | null;
  crmInternalData: Record<string, unknown> | null;
  status: string;
  uploads: unknown[] | null;
  created_at: string;
  updated_at: string;
}

export type LeadInput = Omit<Lead, "id" | "createdAt" | "updatedAt">;

function fromApi(row: ApiLeadResponse): Lead {
  return {
    id: row.id,
    fullName: row.fullName ?? row.name,
    stageName: row.stageName ?? undefined,
    company: row.company ?? undefined,
    email: row.email ?? undefined,
    whatsapp: row.whatsapp ?? undefined,
    instagram: row.instagram ?? undefined,
    city: row.city ?? undefined,
    state: row.state ?? undefined,
    country: row.country ?? undefined,
    status: row.status,
    clientType: (row.clientType ?? "other") as LeadClientType,
    serviceType: (row.serviceType ?? "consulting") as LeadServiceType,
    servicePayload: row.servicePayload ?? {},
    crmInternalData: (row.crmInternalData ?? {}) as LeadInternalCRMData,
    uploads: (row.uploads ?? []) as Lead["uploads"],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toApiPayload(data: LeadInput): Record<string, unknown> {
  return {
    name: data.fullName,
    stageName: data.stageName,
    company: data.company,
    email: data.email,
    phone: data.whatsapp,
    whatsapp: data.whatsapp,
    instagram: data.instagram,
    city: data.city,
    state: data.state,
    country: data.country,
    clientType: data.clientType,
    serviceType: data.serviceType,
    servicePayload: data.servicePayload,
    crmInternalData: data.crmInternalData,
    uploads: data.uploads,
  };
}

export const leadsService = {
  async list(): Promise<Lead[]> {
    // api.get() already unwraps the {data,timestamp} envelope; since the controller
    // returns {data: [...], meta} directly (TransformInterceptor preserves
    // objects that already have `data`, it does not re-wrap), the value here already IS the array.
    const result = await api.get<ApiLeadResponse[]>("/leads?limit=200");
    return result.map(fromApi).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  async create(data: LeadInput): Promise<Lead> {
    // New leads always start as "new" (the API ignores a client status on create).
    const created = await api.post<ApiLeadResponse>("/leads", toApiPayload(data));
    return fromApi(created);
  },
  async update(id: string, data: Partial<Lead>, expectedUpdatedAt?: string): Promise<Lead> {
    const payload: Record<string, unknown> = {};
    if (expectedUpdatedAt !== undefined) payload.expectedUpdatedAt = expectedUpdatedAt;
    if (data.fullName !== undefined) payload.name = data.fullName;
    if (data.stageName !== undefined) payload.stageName = data.stageName;
    if (data.company !== undefined) payload.company = data.company;
    if (data.email !== undefined) payload.email = data.email;
    if (data.whatsapp !== undefined) { payload.phone = data.whatsapp; payload.whatsapp = data.whatsapp; }
    if (data.instagram !== undefined) payload.instagram = data.instagram;
    if (data.city !== undefined) payload.city = data.city;
    if (data.state !== undefined) payload.state = data.state;
    if (data.country !== undefined) payload.country = data.country;
    if (data.clientType !== undefined) payload.clientType = data.clientType;
    if (data.serviceType !== undefined) payload.serviceType = data.serviceType;
    if (data.servicePayload !== undefined) payload.servicePayload = data.servicePayload;
    if (data.uploads !== undefined) payload.uploads = data.uploads;
    if (data.crmInternalData !== undefined) payload.crmInternalData = data.crmInternalData;
    if (data.status !== undefined) payload.status = data.status;
    const updated = await api.patch<ApiLeadResponse>(`/leads/${id}`, payload);
    return fromApi(updated);
  },
  async remove(id: string): Promise<void> {
    await api.delete(`/leads/${id}`);
  },
};
