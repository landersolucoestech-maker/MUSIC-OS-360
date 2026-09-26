import { api } from "@/shared/lib/api-client";
import type { AdminAuditLog, AuditAction } from "../types";

/**
 * Real audit logs service for the Admin Panel.
 *
 * REM-01 (Remaining Product Completion Backlog): it used `GET /audit-logs`
 * (tenant-scoped, RequireRole viewer) — a super_admin only saw the audit trail
 * of the SINGLE tenant their session was bound to, never a real
 * cross-tenant view. It now uses `GET /audit-logs/admin` (RequireRole
 * super_admin, no tenant_id filter — RLS `super_admin_full_access`),
 * which already returns `tenant_name` via a real join with `tenants`.
 * `user_name`/`user_email`/`details` honestly remain unavailable
 * (the entity does not have those columns today — only `user_id`) — not fabricated.
 */
interface RawAdminAudit {
  id: string;
  action?: string;
  entity?: string | null;
  entity_id?: string | null;
  user_id?: string | null;
  actor_role?: string | null;
  tenant_id?: string;
  tenant_name?: string;
  ip_address?: string | null;
  created_at?: string;
}

function toAdminAudit(r: RawAdminAudit): AdminAuditLog {
  return {
    id: r.id,
    action: (r.action ?? "update") as AuditAction,
    entity: r.entity ?? "",
    entity_id: r.entity_id ?? "",
    user_id: r.user_id ?? "",
    user_name: r.user_id ?? "—",
    user_email: "",
    tenant_id: r.tenant_id ?? "",
    tenant_name: r.tenant_name ?? "",
    ip_address: r.ip_address ?? "—",
    details: undefined,
    created_at: r.created_at ?? new Date().toISOString(),
  };
}

export const adminAuditService = {
  async list(): Promise<AdminAuditLog[]> {
    const res = await api.get<RawAdminAudit[]>("/audit-logs/admin");
    return (res ?? []).map(toAdminAudit);
  },
};
