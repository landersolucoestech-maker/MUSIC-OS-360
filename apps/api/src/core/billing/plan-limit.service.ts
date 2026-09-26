/**
 * core/billing/plan-limit.service.ts
 *
 * Enforces per-plan resource limits across all domain services.
 * Inject this service into any create operation that is subject to plan quotas.
 *
 * Usage:
 *   await this.planLimit.enforce(tenantId, orgId, 'artists');
 *   // throws ForbiddenException if the tenant has reached their plan limit
 */

import {
  Injectable,
  Logger,
  ForbiddenException,
  Inject,
  Optional,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DATA_SOURCE } from '../../database/database.module';
import { BillingSubscriptionEntity } from '../../database/entities';
import { PLAN_LIMITS } from '../../modules/billing/billing.service';

export type LimitedResource = 'artists' | 'contracts' | 'users' | 'storageGb';

const RESOURCE_QUERIES: Record<LimitedResource, (tenantId: string, orgId?: string) => [string, unknown[]]> = {
  artists:   (tid) => ['SELECT COUNT(*)::int AS cnt FROM artists WHERE tenant_id = $1 AND deleted_at IS NULL', [tid]],
  contracts: (tid) => ['SELECT COUNT(*)::int AS cnt FROM contracts WHERE tenant_id = $1 AND deleted_at IS NULL', [tid]],
  users:     (_tid, orgId?) => orgId
    ? ['SELECT COUNT(*)::int AS cnt FROM org_members WHERE org_id = $1', [orgId]]
    : ['SELECT 0::int AS cnt', []],
  storageGb: (tid) => ['SELECT COALESCE(SUM(file_size), 0)::bigint AS cnt FROM uploads WHERE tenant_id = $1 AND status != $2', [tid, 'deleted']],
};

@Injectable()
export class PlanLimitService {
  private readonly logger = new Logger(PlanLimitService.name);

  constructor(
    @Optional() @Inject(DATA_SOURCE) private readonly ds: DataSource | null,
  ) {}

  /**
   * Resolves the current plan for an org.
   * Falls back to 'starter' when billing data is unavailable.
   */
  async resolvePlan(orgId: string): Promise<string> {
    if (!this.ds) return 'starter';

    try {
      const subRepo = this.ds.getRepository(BillingSubscriptionEntity);
      const sub = await subRepo.findOne({ where: { org_id: orgId } as any });
      return (sub as any)?.plan ?? 'starter';
    } catch {
      return 'starter';
    }
  }

  /**
   * Throws ForbiddenException (HTTP 403) if the tenant has reached its plan limit.
   * orgId is required only for the 'users' resource.
   */
  async enforce(tenantId: string, orgId: string, resource: LimitedResource): Promise<void> {
    if (!this.ds) return; // DB unavailable in test stubs — skip

    const plan   = await this.resolvePlan(orgId);
    const limits = PLAN_LIMITS[plan] ?? PLAN_LIMITS['starter']!;
    const cap    = limits[resource] as number | null | undefined;

    if (cap == null) return; // null = unlimited

    let current = 0;
    try {
      const [sql, params] = RESOURCE_QUERIES[resource](tenantId, orgId);
      const rows = await this.ds.query<[{ cnt: string }]>(sql, params);
      current = parseInt(rows[0]?.cnt ?? '0', 10);

      // storageGb — convert bytes to GB
      if (resource === 'storageGb') current = Math.ceil(current / (1024 ** 3));
    } catch (err) {
      // Do not block creation on DB query failure — log and continue
      this.logger.warn(`PlanLimitService: failed to read usage of ${resource} — ${String(err)}`);
      return;
    }

    if (current >= cap) {
      this.logger.warn(
        `Plano ${plan} atingiu limite: tenant=${tenantId} resource=${resource} ` +
        `current=${current} cap=${cap}`,
      );
      throw new ForbiddenException(
        `Limite do plano atingido para "${resource}". ` +
        `O plano atual (${plan}) permite até ${cap} ${resource}. ` +
        'Faça upgrade para continuar.',
      );
    }
  }

  /**
   * Returns current usage and limits for a tenant without throwing.
   * Used by billing/usage endpoint.
   */
  async getUsageSummary(tenantId: string, orgId: string) {
    const plan   = await this.resolvePlan(orgId);
    const limits = PLAN_LIMITS[plan] ?? PLAN_LIMITS['starter']!;

    const resources: LimitedResource[] = ['artists', 'contracts', 'users'];
    const current: Record<string, number> = {};

    if (this.ds) {
      await Promise.all(
        resources.map(async (r) => {
          try {
            const [sql, params] = RESOURCE_QUERIES[r](tenantId, orgId);
            const rows = await this.ds!.query<[{ cnt: string }]>(sql, params);
            current[r] = parseInt(rows[0]?.cnt ?? '0', 10);
          } catch {
            current[r] = 0;
          }
        }),
      );
    }

    return {
      plan,
      usage:   current,
      limits,
      percent: Object.fromEntries(
        resources.map((r) => {
          const cap = limits[r] as number | null;
          return [r, cap ? Math.round((current[r]! / cap) * 100) : null];
        }),
      ),
    };
  }
}
