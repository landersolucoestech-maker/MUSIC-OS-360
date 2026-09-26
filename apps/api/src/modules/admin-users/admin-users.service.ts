import { Injectable, Inject, ServiceUnavailableException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from '@supabase/supabase-js';
import { DataSource } from 'typeorm';
import { DATA_SOURCE } from '../../database/database.module';
import type { AdminUsersQueryDto } from './dto/admin-users.dto';

export interface AdminUserRow {
  id: string;
  auth_user_id: string;
  name: string;
  email: string;
  role_slug: string;
  role_name: string;
  tenant_id: string;
  tenant_name: string;
  status: 'active' | 'blocked';
  joined_at: string | null;
  last_login: string | null;
  mfa_enabled: boolean | null;
  /** The Supabase Admin API does not expose a list of active sessions — never fabricate this value. */
  sessions_count: null;
}

interface AuthUserInfo {
  last_sign_in_at: string | null;
  mfa_enabled: boolean;
}

const AUTH_CACHE_TTL_MS = 30_000;
const MAX_PAGES = 20;
const PAGE_SIZE = 1000;

/**
 * Decision Gate item 6 (product-completion audit, GAP-07): Admin Users needs
 * real MFA/last-login data without an N+1 per user. `supabase.auth.admin.listUsers()`
 * is paginated and GLOBAL to the project (not per tenant) — we fetch all pages ONCE
 * per cache window and build a Map by auth_user_id, instead of one
 * getUserById call per member. `sessions_count`: the Supabase Admin API does not expose
 * an active session count — never fabricated, always `null` (the frontend honestly shows
 * "Indisponível").
 */
@Injectable()
export class AdminUsersService {
  private readonly logger = new Logger(AdminUsersService.name);
  private authCache: { data: Map<string, AuthUserInfo>; expiresAt: number } | null = null;

  constructor(
    @Inject(DATA_SOURCE) private readonly ds: DataSource | null,
    private readonly config: ConfigService,
  ) {}

  private assertDataSource(): DataSource {
    if (!this.ds) throw new ServiceUnavailableException('Persistência indisponível');
    return this.ds;
  }

  private supabaseAdmin() {
    return createClient(
      this.config.getOrThrow<string>('SUPABASE_URL'),
      this.config.getOrThrow<string>('SUPABASE_SERVICE_ROLE_KEY'),
    );
  }

  private async fetchAuthUsers(): Promise<Map<string, AuthUserInfo>> {
    if (this.authCache && this.authCache.expiresAt > Date.now()) return this.authCache.data;

    const map = new Map<string, AuthUserInfo>();
    try {
      const supabase = this.supabaseAdmin();
      for (let page = 1; page <= MAX_PAGES; page++) {
        const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: PAGE_SIZE });
        if (error) {
          this.logger.warn(`listUsers failed on page ${page}: ${error.message}`);
          break;
        }
        for (const user of data.users) {
          const factors = (user as { factors?: Array<{ status?: string }> }).factors ?? [];
          map.set(user.id, {
            last_sign_in_at: user.last_sign_in_at ?? null,
            mfa_enabled: factors.some((f) => f.status === 'verified'),
          });
        }
        if (data.users.length < PAGE_SIZE) break;
      }
    } catch (err) {
      this.logger.warn(`Could not fetch auth data (MFA/last_login): ${(err as Error).message}`);
    }

    this.authCache = { data: map, expiresAt: Date.now() + AUTH_CACHE_TTL_MS };
    return map;
  }

  async list(query: AdminUsersQueryDto): Promise<AdminUserRow[]> {
    const ds = this.assertDataSource();
    const params: unknown[] = [];
    const filters: string[] = ['m.deleted_at IS NULL', 't.deleted_at IS NULL'];

    if (query.search) {
      params.push(`%${query.search.toLowerCase()}%`);
      filters.push(
        `(lower(m.email) LIKE $${params.length} OR lower(COALESCE(m.full_name, '')) LIKE $${params.length} OR lower(t.name) LIKE $${params.length})`,
      );
    }
    if (query.tenantId) {
      params.push(query.tenantId);
      filters.push(`m.tenant_id = $${params.length}`);
    }
    if (query.status === 'active' || query.status === 'blocked') {
      params.push(query.status === 'active');
      filters.push(`m.is_active = $${params.length}`);
    }

    const rows = await ds.query(
      `
      SELECT
        m.id,
        m.auth_user_id,
        COALESCE(m.full_name, m.email) AS name,
        m.email,
        m.role AS role_slug,
        COALESCE(r.name, gr.name, m.role) AS role_name,
        m.tenant_id,
        t.name AS tenant_name,
        CASE WHEN m.is_active THEN 'active' ELSE 'blocked' END AS status,
        m.joined_at
      FROM org_members m
      JOIN tenants t ON t.id = m.tenant_id
      LEFT JOIN roles r  ON r.id = m.role_id
      LEFT JOIN roles gr ON gr.slug = m.role AND gr.tenant_id IS NULL AND gr.deleted_at IS NULL
      WHERE ${filters.join(' AND ')}
      ORDER BY m.created_at DESC
      LIMIT 500
      `,
      params,
    );

    const authInfo = await this.fetchAuthUsers();

    return rows.map((row: Record<string, unknown>) => {
      const auth = authInfo.get(row.auth_user_id as string);
      return {
        id: row.id,
        auth_user_id: row.auth_user_id,
        name: row.name,
        email: row.email,
        role_slug: row.role_slug,
        role_name: row.role_name,
        tenant_id: row.tenant_id,
        tenant_name: row.tenant_name,
        status: row.status,
        joined_at: row.joined_at,
        last_login: auth?.last_sign_in_at ?? null,
        mfa_enabled: auth ? auth.mfa_enabled : null,
        sessions_count: null,
      } as AdminUserRow;
    });
  }
}
