/**
 * services/clients.service.ts
 *
 * Real backend client for `/clients` (`clients` table, ClientsController/
 * ClientsService — apps/api/src/modules/clients). Typed against the CZ-043
 * canonical wire contract (snake_case = column names). The CRM view model
 * (`Contact`) is mapped in ./contacts.service.ts; useClients() in
 * ../hooks/useContacts.ts exposes the raw rows for record-level mutations.
 */
import { api } from "@/shared/lib/api-client";
import { fetchAllPages, type FetchAllPagesResult } from "@/shared/lib/exportAll";
import type { ContactPriority, ContactStatus, ContactType, PersonType } from "../types";

/**
 * One `clients.interactions` item on the wire (CZ-043 canonical keys; the API
 * validates `type` against call/whatsapp/email/meeting/proposal/follow_up/note).
 */
export interface ClientWireInteraction {
  id?: string;
  type: string;
  date?: string;
  time?: string;
  description?: string;
}

/**
 * A `/clients` response row — the CZ-043 canonical wire contract (snake_case =
 * column names). `email`, `phone` and `cpf_cnpj` arrive decrypted. There is NO
 * `metadata` (historical, never returned) and no `*_encrypted` column.
 */
export interface ApiClient {
  id: string;
  tenant_id: string;
  person_type: PersonType;
  category: ContactType | null;
  profile: string | null;
  name: string;
  photo_url: string | null;
  individual_name: string | null;
  legal_name: string | null;
  trade_name: string | null;
  email: string | null;
  phone: string | null;
  cpf_cnpj: string | null;
  instagram: string | null;
  job_title: string | null;
  street: string | null;
  street_number: string | null;
  address_complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  address: string | null;
  priority: ContactPriority | null;
  responsible_name: string | null;
  responsible_job_title: string | null;
  responsible_email: string | null;
  responsible_phone: string | null;
  attachments: unknown[] | null;
  notes: string | null;
  interactions: ClientWireInteraction[] | null;
  status: ContactStatus;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

/**
 * POST /clients body — CZ-043 canonical keys only (column names). `cpf_cnpj`
 * is the ONLY key a CPF/CNPJ travels in (stored encrypted); no `metadata`.
 * `null` clears an optional column.
 */
export interface CreateApiClientInput {
  name: string;
  person_type?: PersonType;
  category?: ContactType | null;
  profile?: string | null;
  photo_url?: string | null;
  individual_name?: string | null;
  legal_name?: string | null;
  trade_name?: string | null;
  email?: string | null;
  phone?: string | null;
  cpf_cnpj?: string | null;
  instagram?: string | null;
  job_title?: string | null;
  street?: string | null;
  street_number?: string | null;
  address_complement?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  zip_code?: string | null;
  address?: string | null;
  priority?: ContactPriority | null;
  responsible_name?: string | null;
  responsible_job_title?: string | null;
  responsible_email?: string | null;
  responsible_phone?: string | null;
  notes?: string | null;
  interactions?: ClientWireInteraction[] | null;
}

/** PATCH /clients/:id body — `status` is accepted on update only. */
export type UpdateApiClientInput = Partial<CreateApiClientInput> & {
  status?: ContactStatus;
  /** Optimistic concurrency (Task L) — see apps/api optimistic-update.util.ts. */
  expectedUpdatedAt?: string;
};

export interface ListApiClientsResult {
  data: ApiClient[];
  meta: { total: number; offset: number; limit: number };
}

/** Manual timeline entry types accepted by POST /clients/:id/timeline (CZ-043). */
export type ClientTimelineEntryType = "note" | "call" | "meeting" | "email" | "whatsapp" | "other";

/**
 * A client timeline event (activity_logs). `action` is a manual entry type
 * (ClientTimelineEntryType) or an automatic lifecycle action (created/updated/
 * removed) — shown through timelineActionLabel() (../constants/timeline).
 */
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
  /** contracts.fixed_value (numeric → string on the wire); show as BRL via formatCurrency(). */
  fixed_value: string | null;
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
  /**
   * Every client of the tenant matching the filters, via a full paged sweep.
   * `list()` without a limit inherits the API's default page (50 rows), which
   * silently truncated the CRM list, its metrics and every name resolution;
   * `truncated` is true only when the sweep's safety ceiling was reached.
   */
  async listAll(params?: { search?: string; status?: string; person_type?: PersonType; category?: string }): Promise<FetchAllPagesResult<ApiClient>> {
    return fetchAllPages<ApiClient>("clientes", {
      filters: params ? { ...params } : undefined,
    });
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

  // ── Real timeline (persisted in activity_logs) ────────────────────────────
  async getTimeline(clientId: string): Promise<ClientTimelineEntry[]> {
    return api.get<ClientTimelineEntry[]>(`/clients/${clientId}/timeline`);
  },
  async addTimelineEntry(clientId: string, data: { type: ClientTimelineEntryType; description: string }): Promise<ClientTimelineEntry> {
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
