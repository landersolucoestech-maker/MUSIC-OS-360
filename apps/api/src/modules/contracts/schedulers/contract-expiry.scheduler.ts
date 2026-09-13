import { Injectable, Logger, OnApplicationBootstrap, Inject, Optional } from '@nestjs/common';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { DATA_SOURCE, ADMIN_DATA_SOURCE } from '../../../database/database.module';
import { DatabaseContextService } from '../../../database/database-context.service';
import { ContractEntity } from '../../../database/entities';
import { EventsService, DOMAIN_EVENTS } from '../../../core/events/events.service';
import { ContractStatus } from '@music-os-360/types';

const DAY_MS           = 24 * 60 * 60 * 1000;
const EXPIRY_WINDOW    = 30;   // days ahead to start alerting
const DEDUP_DAYS       = 7;    // minimum days between repeat notifications

const ALERT_STATUSES = [ContractStatus.IN_FORCE, ContractStatus.SIGNED, ContractStatus.EXPIRING];

/**
 * Cross-tenant maintenance cron. P2-6: instead of a single global scan + update
 * by bare id, it now (1) discovers the affected tenants in a controlled
 * administrative step, then (2) processes EACH tenant inside
 * runInTenantContext(), with every write scoped by tenant_id. This makes the job
 * RLS-safe (works under a NOBYPASSRLS app role + session context) and isolates a
 * failing tenant from the rest of the run.
 */
@Injectable()
export class ContractExpiryScheduler implements OnApplicationBootstrap {
  private readonly logger = new Logger(ContractExpiryScheduler.name);
  private readonly repo: Repository<ContractEntity> | null = null;
  /** Read-only owner connection for cross-tenant enumeration (P2-7). */
  private readonly adminRepo: Repository<ContractEntity> | null = null;

  constructor(
    @Inject(DATA_SOURCE) @Optional() ds: DataSource | null,
    @Optional() private readonly events: EventsService,
    @Optional() private readonly dbContext?: DatabaseContextService,
    @Inject(ADMIN_DATA_SOURCE) @Optional() adminDataSource?: DataSource | null,
  ) {
    if (ds) this.repo = ds.getRepository(ContractEntity);
    if (adminDataSource) this.adminRepo = adminDataSource.getRepository(ContractEntity);
  }

  onApplicationBootstrap(): void {
    if (!this.repo || !this.events) return;

    this.runCheck().catch((err: unknown) =>
      this.logger.warn(`ContractExpiryScheduler initial run failed: ${String(err)}`),
    );

    setInterval(() => {
      this.runCheck().catch((err: unknown) =>
        this.logger.warn(`ContractExpiryScheduler daily run failed: ${String(err)}`),
      );
    }, DAY_MS);
  }

  async runCheck(): Promise<void> {
    if (!this.repo || !this.events) return;

    const now         = new Date();
    const horizon     = new Date(now.getTime() + EXPIRY_WINDOW * DAY_MS);
    const dedupCutoff = new Date(now.getTime() - DEDUP_DAYS * DAY_MS);

    // 1. Controlled administrative enumeration of affected tenants.
    const tenantIds = await this.discoverTenantIds(now, horizon);

    // 2. Process each tenant in its own session context, isolated from the rest.
    for (const tenantId of tenantIds) {
      if (!tenantId) continue; // fail-closed: never process a row without a tenant

      try {
        await this.runForTenant(tenantId, now, horizon, dedupCutoff);
      } catch (err) {
        // Isolate the failure — one tenant must not abort the whole cron.
        this.logger.warn(`ContractExpiryScheduler: tenant ${tenantId} failed — ${String(err)}`);
      }
    }
  }

  /**
   * Distinct tenants with candidate contracts. Administrative cross-tenant READ.
   * Uses ADMIN_DATA_SOURCE (owner) so it sees all tenants even when the app
   * connects via a NOBYPASSRLS role; falls back to DATA_SOURCE when absent.
   */
  private async discoverTenantIds(now: Date, horizon: Date): Promise<string[]> {
    const enumRepo = this.adminRepo ?? this.repo!;
    const rows = await enumRepo
      .createQueryBuilder('c')
      .select('DISTINCT c.tenant_id', 'tenant_id')
      .where('c.end_date IS NOT NULL')
      .andWhere('c.end_date >= :now', { now })
      .andWhere('c.end_date <= :horizon', { horizon })
      .andWhere('c.status IN (:...statuses)', { statuses: ALERT_STATUSES })
      .andWhere('c.deleted_at IS NULL')
      .andWhere('c.tenant_id IS NOT NULL')
      .getRawMany<{ tenant_id: string }>();
    return rows.map((r) => r.tenant_id).filter(Boolean);
  }

  private runForTenant(tenantId: string, now: Date, horizon: Date, dedupCutoff: Date): Promise<void> {
    const work = (manager: EntityManager | undefined) =>
      this.processTenant(this.repoFrom(manager), tenantId, now, horizon, dedupCutoff);

    return this.dbContext
      ? this.dbContext.runInTenantContext({ tenantId, orgId: null, role: null }, work)
      : work(undefined);
  }

  private repoFrom(manager: EntityManager | undefined): Repository<ContractEntity> {
    return manager ? manager.getRepository(ContractEntity) : this.repo!;
  }

  private async processTenant(
    repo: Repository<ContractEntity>,
    tenantId: string,
    now: Date,
    horizon: Date,
    dedupCutoff: Date,
  ): Promise<void> {
    const contracts = await repo
      .createQueryBuilder('c')
      .where('c.tenant_id = :tenantId', { tenantId })
      .andWhere('c.end_date IS NOT NULL')
      .andWhere('c.end_date >= :now', { now })
      .andWhere('c.end_date <= :horizon', { horizon })
      .andWhere('c.status IN (:...statuses)', { statuses: ALERT_STATUSES })
      .andWhere('c.deleted_at IS NULL')
      .getMany();

    for (const contract of contracts) {
      const lastNotified = contract.metadata?.['expiry_notified_at'] as string | undefined;
      if (lastNotified && new Date(lastNotified) > dedupCutoff) continue;

      const endDate  = contract.end_date!;
      const daysLeft = Math.ceil((endDate.getTime() - now.getTime()) / DAY_MS);

      this.events.emitTyped(DOMAIN_EVENTS.CONTRACT_EXPIRING_SOON, {
        tenantId:      contract.tenant_id,
        userId:        'system',
        aggregateType: 'contract',
        aggregateId:   contract.id,
        payload: {
          contractId: contract.id,
          tenantId:   contract.tenant_id,
          title:     contract.title,
          artistId:   contract.artist_id,
          endDate:    endDate.toISOString(),
          daysLeft,
        },
      });

      // Tenant-scoped update — never touches a row outside this tenant.
      await repo
        .createQueryBuilder()
        .update(ContractEntity)
        .set({
          metadata:   { ...contract.metadata, expiry_notified_at: now.toISOString() },
          updated_at: now,
        } as any)
        .where('id = :id AND tenant_id = :tenantId', { id: contract.id, tenantId })
        .execute();

      this.logger.log(`ContractExpiryScheduler: notified "${contract.title}" (${contract.id}) — ${daysLeft} days left`);
    }
  }
}
