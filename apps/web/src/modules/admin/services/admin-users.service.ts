import { api } from "@/shared/lib/api-client";
import type { AdminUser } from "../types";

/**
 * Real cross-tenant users service for the Admin Panel (Decision Gate
 * item 6/GAP-07). Uses `GET /admin/users` (super_admin), which already resolves
 * role/tenant/MFA/last_login in the backend — see
 * apps/api/src/modules/admin-users/admin-users.service.ts for the source
 * (a real join with `roles`/`tenants` + the paginated Supabase Admin API `listUsers()`,
 * never an N+1 per user; `sessions_count` is always null because the
 * Supabase Admin API does not expose that information — never fabricated).
 */
interface RawAdminUser {
  id: string;
  name: string;
  email: string;
  role_slug: string;
  role_name: string;
  tenant_id: string;
  tenant_name: string;
  status: "active" | "blocked";
  joined_at: string | null;
  last_login: string | null;
  mfa_enabled: boolean | null;
  sessions_count: null;
}

export const adminUsersService = {
  async list(params?: { search?: string; status?: string; tenantId?: string }): Promise<AdminUser[]> {
    const query = new URLSearchParams();
    if (params?.search) query.set("search", params.search);
    if (params?.status) query.set("status", params.status);
    if (params?.tenantId) query.set("tenantId", params.tenantId);
    const qs = query.toString();
    const res = await api.get<RawAdminUser[]>(`/admin/users${qs ? `?${qs}` : ""}`);
    return (res ?? []) as AdminUser[];
  },
};
