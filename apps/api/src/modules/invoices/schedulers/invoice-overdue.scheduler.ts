import { Injectable, Logger, OnApplicationBootstrap, Inject, Optional } from '@nestjs/common';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { DATA_SOURCE, ADMIN_DATA_SOURCE } from '../../../database/database.module';
import { DatabaseContextService } from '../../../database/database-context.service';
import { InvoiceEntity } from '../../../database/entities';
import { EventsService, DOMAIN_EVENTS } from '../../../core/events/events.service';

const DAY_MS    = 24 * 60 * 60 * 1000;
const DEDUP_HRS = 23; // skip re-notification within 23h (allows daily run with drift)

const ACTIVE_STATUSES = ['pending', 'issued'];

/**
 * Cross-tenant maintenance cron. P2-6: discovers affected tenants in a controlled
 * administrative step, then processes EACH tenant inside runInTenantContext(),
 * with every write scoped by tenant_id. RLS-safe (works under a NOBYPASSRLS app
 * role + session context) and isolates a failing tenant from the rest of the run.
 */
@Injectable()
export class InvoiceOverdueScheduler implements OnApplicationBootstrap {
  private readonly logger = new Logger(InvoiceOverdueScheduler.name);
  private readonly repo: Repository<InvoiceEntity> | null = null;
  /** Read-only owner connection for cross-tenant enumeration (P2-7). */
  private readonly adminRepo: Repository<InvoiceEntity> | null = null;

  constructor(
    @Inject(DATA_SOURCE) @Optional() ds: DataSource | null,
    @Optional() private readonly events: EventsService,
    @Optional() private readonly dbContext?: DatabaseContextService,
    @Inject(ADMIN_DATA_SOURCE) @Optional() adminDataSource?: DataSource | null,
  ) {
    if (ds) this.repo = ds.getRepository(InvoiceEntity);
    if (adminDataSource) this.adminRepo = adminDataSource.getRepository(InvoiceEntity);
  }

  onApplicationBootstrap(): void {
    if (!this.repo || !this.events) return;

    this.runCheck().catch((err: unknown) =>
      this.logger.warn(`InvoiceOverdueScheduler initial run failed: ${String(err)}`),
    );

    setInterval(() => {
      this.runCheck().catch((err: unknown) =>
        this.logger.warn(`InvoiceOverdueScheduler daily run failed: ${String(err)}`),
      );
    }, DAY_MS);
  }

  async runCheck(): Promise<void> {
    if (!this.repo || !this.events) return;

    const now         = new Date();
    const dedupCutoff = new Date(now.getTime() - DEDUP_HRS * 60 * 60 * 1000);

    // 1. Controlled administrative enumeration of affected tenants.
    const tenantIds = await this.discoverTenantIds(now);

    // 2. Process each tenant in its own session context, isolated from the rest.
    for (const tenantId of tenantIds) {
      if (!tenantId) continue; // fail-closed: never process a row without a tenant

      try {
        await this.runForTenant(tenantId, now, dedupCutoff);
      } catch (err) {
        this.logger.warn(`InvoiceOverdueScheduler: tenant ${tenantId} failed — ${String(err)}`);
      }
    }
  }

  /**
   * Distinct tenants with overdue invoices. Administrative cross-tenant READ.
   * Uses ADMIN_DATA_SOURCE (owner) so it sees all tenants even when the app
   * connects via a NOBYPASSRLS role; falls back to DATA_SOURCE when absent.
   */
  private async discoverTenantIds(now: Date): Promise<string[]> {
    const enumRepo = this.adminRepo ?? this.repo!;
    const rows = await enumRepo
      .createQueryBuilder('i')
      .select('DISTINCT i.tenant_id', 'tenant_id')
      .where('i.data_vencimento IS NOT NULL')
      .andWhere('i.data_vencimento < :now', { now })
      .andWhere('i.status IN (:...statuses)', { statuses: ACTIVE_STATUSES })
      .andWhere('i.deleted_at IS NULL')
      .andWhere('i.tenant_id IS NOT NULL')
      .getRawMany<{ tenant_id: string }>();
    return rows.map((r) => r.tenant_id).filter(Boolean);
  }

  private runForTenant(tenantId: string, now: Date, dedupCutoff: Date): Promise<void> {
    const work = (manager: EntityManager | undefined) =>
      this.processTenant(this.repoFrom(manager), tenantId, now, dedupCutoff);

    return this.dbContext
      ? this.dbContext.runInTenantContext({ tenantId, orgId: null, role: null }, work)
      : work(undefined);
  }

  private repoFrom(manager: EntityManager | undefined): Repository<InvoiceEntity> {
    return manager ? manager.getRepository(InvoiceEntity) : this.repo!;
  }

  private async processTenant(
    repo: Repository<InvoiceEntity>,
    tenantId: string,
    now: Date,
    dedupCutoff: Date,
  ): Promise<void> {
    const overdueInvoices = await repo
      .createQueryBuilder('i')
      .where('i.tenant_id = :tenantId', { tenantId })
      .andWhere('i.data_vencimento IS NOT NULL')
      .andWhere('i.data_vencimento < :now', { now })
      .andWhere('i.status IN (:...statuses)', { statuses: ACTIVE_STATUSES })
      .andWhere('i.deleted_at IS NULL')
      .getMany();

    for (const invoice of overdueInvoices) {
      const lastNotified = invoice.metadata?.['last_overdue_notified_at'] as string | undefined;
      if (lastNotified && new Date(lastNotified) > dedupCutoff) continue;

      // Tenant-scoped update — never touches a row outside this tenant.
      await repo
        .createQueryBuilder()
        .update(InvoiceEntity)
        .set({
          status:     'overdue',
          metadata:   { ...invoice.metadata, last_overdue_notified_at: now.toISOString() },
          updated_at: now,
        } as any)
        .where('id = :id AND tenant_id = :tenantId', { id: invoice.id, tenantId })
        .execute();

      this.events.emitTyped(DOMAIN_EVENTS.INVOICE_OVERDUE, {
        tenantId:      invoice.tenant_id,
        userId:        'system',
        aggregateType: 'invoice',
        aggregateId:   invoice.id,
        payload: {
          invoiceId:      invoice.id,
          tenantId:       invoice.tenant_id,
          numero:         invoice.numero ?? null,
          valor:          String(invoice.valor),
          dataVencimento: invoice.data_vencimento!.toISOString(),
        },
      });

      this.logger.warn(`InvoiceOverdueScheduler: marked invoice "${invoice.id}" (${invoice.numero ?? 'no-number'}) as overdue`);
    }
  }
}
