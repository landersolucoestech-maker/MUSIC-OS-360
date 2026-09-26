/**
 * services/clients.service.ts
 *
 * Real backend client for `/clients` (`clients` table, ClientsController/
 * ClientsService — apps/api/src/modules/clients). Source of truth for the
 * "client" dropdown used in contracts, calendar, finance, invoices and the
 * dashboard (see useClientes() in ../hooks/useContacts.ts).
 *
 * Replaces the previous implementation of useClientes(), which — despite its name —
 * read the `contacts` table (via useContacts()), never the real `clients` table.
 */
import { api } from "@/shared/lib/api-client";

export interface ApiClient {
  id: string;
  tenant_id: string;
  tipo_pessoa: string;
  categoria: string;
  perfil: string;
  nome: string;
  razao_social: string | null;
  nome_fantasia: string | null;
  nome_pf: string | null;
  city: string | null;
  state: string | null;
  cep: string | null;
  instagram: string | null;
  endereco_completo: string | null;
  status: string;
  prioridade_contato: string | null;
  notes: string | null;
  responsavel_nome: string | null;
  attachments: unknown[] | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  // Friendly aliases already resolved by the backend (ClientsService.mapClient).
  name: string;
  type: string;
  category: string;
  address: string | null;
  email: string | null;
  phone: string | null;
  document: string | null;
}

export interface CreateApiClientInput {
  name: string;
  type?: "person" | "company";
  category?: string;
  email?: string;
  phone?: string;
  document?: string;
  address?: Record<string, unknown> | string;
  metadata?: Record<string, unknown>;
  city?: string;
  state?: string;
  instagram?: string;
  zipCode?: string;
  responsible?: string;
  notes?: string;
  priority?: "low" | "medium" | "high" | "strategic";
}

export type UpdateApiClientInput = Partial<CreateApiClientInput> & {
  status?: "active" | "inactive" | "blocked";
  /** Optimistic concurrency (Task L) — see apps/api optimistic-update.util.ts. */
  expectedUpdatedAt?: string;
};

export interface ListApiClientsResult {
  data: ApiClient[];
  meta: { total: number; offset: number; limit: number };
}

export interface ClientTimelineEntry {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  description: string;
  metadata: Record<string, unknown>;
  user_id: string;
  user_name: string | null;
  created_at: string;
}

export interface ClientContractSummary {
  id: string;
  title: string;
  type: string;
  status: string;
  valor: string | null;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
}

export interface ClientAttachment {
  id: string;
  tenant_id: string;
  client_id: string;
  storage_key: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  checksum: string | null;
  uploaded_by: string | null;
  created_at: string;
}

export const clientsService = {
  async list(params?: { search?: string; status?: string; category?: string; limit?: number; offset?: number }): Promise<ApiClient[]> {
    const query = new URLSearchParams();
    if (params?.status) query.set("status", params.status);
    if (params?.category) query.set("category", params.category);
    if (params?.limit) query.set("limit", String(params.limit));
    if (params?.offset) query.set("offset", String(params.offset));
    const qs = query.toString();
    // api.get() already unwraps the TransformInterceptor's {data,timestamp} envelope;
    // since the controller returns {data: [...], meta} directly (no new wrap,
    // see TransformInterceptor: an object that already has `data` is preserved), the value
    // here already IS the array — using ListApiClientsResult and re-reading `.data` duplicated the
    // unwrap and resulted in undefined.
    return api.get<ApiClient[]>(`/clients${qs ? `?${qs}` : ""}`);
  },
  async create(data: CreateApiClientInput): Promise<ApiClient> {
    return api.post<ApiClient>("/clients", data);
  },
  async update(id: string, data: UpdateApiClientInput): Promise<ApiClient> {
    return api.patch<ApiClient>(`/clients/${id}`, data);
  },
  async remove(id: string): Promise<void> {
    await api.delete(`/clients/${id}`);
  },

  // ── Timeline real (persistida em activity_logs) ───────────────────────────
  async getTimeline(clientId: string): Promise<ClientTimelineEntry[]> {
    return api.get<ClientTimelineEntry[]>(`/clients/${clientId}/timeline`);
  },
  async addTimelineEntry(clientId: string, data: { type: string; description: string }): Promise<ClientTimelineEntry> {
    return api.post<ClientTimelineEntry>(`/clients/${clientId}/timeline`, data);
  },

  // ── Linked contracts (real contracts.client_id relation) ────────────────────
  async getContracts(clientId: string): Promise<ClientContractSummary[]> {
    return api.get<ClientContractSummary[]>(`/clients/${clientId}/contracts`);
  },

  // ── Real attachments (metadata in client_attachments; binary in R2) ─────────
  async listAttachments(clientId: string): Promise<ClientAttachment[]> {
    return api.get<ClientAttachment[]>(`/clients/${clientId}/attachments`);
  },
  async removeAttachment(clientId: string, attachmentId: string): Promise<void> {
    await api.delete(`/clients/${clientId}/attachments/${attachmentId}`);
  },
};
