import { api } from "@/shared/lib/api-client";
import type { AdminSupportTicket, SupportTicketStatus, SupportTicketPriority } from "../types";

/**
 * Real support tickets service for the Admin Panel.
 *
 * REM-01 (Remaining Product Completion Backlog): it used `GET /support-tickets`
 * (tenant-scoped, RequireRole manager) — a super_admin only saw the tickets of the
 * SINGLE tenant their session was bound to, never a real
 * cross-tenant view, even though the panel implied it. It now uses the real endpoint
 * `GET /support-tickets/admin` (RequireRole super_admin, no
 * tenant_id filter — RLS `super_admin_full_access`), which already returns `tenant_name`
 * via a real join with `tenants`. `requester_email`/`first_response_at`
 * honestly remain unavailable (the entity does not have those columns
 * today) — not fabricated.
 */
interface RawAdminTicket {
  id: string;
  subject?: string;
  category?: string | null;
  status?: SupportTicketStatus;
  priority?: SupportTicketPriority;
  assigned_to?: string | null;
  tenant_id?: string;
  tenant_name?: string;
  created_at?: string;
  updated_at?: string;
  resolved_at?: string | null;
}

function toAdminTicket(r: RawAdminTicket): AdminSupportTicket {
  const created = r.created_at ?? new Date().toISOString();
  return {
    id: r.id,
    subject: r.subject ?? "(sem assunto)",
    category: r.category ?? "",
    tenant_id: r.tenant_id ?? "",
    tenant_name: r.tenant_name ?? "",
    requester_email: "",
    status: (r.status ?? "open") as SupportTicketStatus,
    priority: (r.priority ?? "medium") as SupportTicketPriority,
    assigned_to: r.assigned_to ?? undefined,
    created_at: created,
    updated_at: r.updated_at ?? created,
    first_response_at: undefined,
    resolved_at: r.resolved_at ?? undefined,
  };
}

export const adminSupportService = {
  async list(): Promise<AdminSupportTicket[]> {
    const res = await api.get<RawAdminTicket[]>("/support-tickets/admin");
    return (res ?? []).map(toAdminTicket);
  },
};
