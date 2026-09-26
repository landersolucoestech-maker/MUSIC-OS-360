/**
 * modules/notifications/notifications.service.ts
 *
 * NotificationsService — notification CRUD + enqueue to the BullMQ queue.
 * When Redis is not available, enqueue() is a silent no-op.
 */

import { Injectable, Inject, Optional, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { DATA_SOURCE } from '../../database/database.module';
import { DatabaseContextService } from '../../database/database-context.service';
import { NotificationEntity } from '../../database/entities';
import { RealtimeService } from '../../core/realtime/realtime.service';
import { QUEUE_NAMES, NOTIFICATION_JOB_NAMES } from '../../queues/queue.constants';
import type { CreateNotificationDto } from './dto/create-notification.dto';
import type { PaginationDto }         from '../../common/dto/pagination.dto';

/**
 * Best-effort tenant DB context (P2-3 wiring). `orgId`/`role` are optional: the
 * `notifications` RLS policy is `tenant_isolation` (depends only on
 * app.current_tenant_id); org/role are bound for completeness / super_admin.
 */
export interface NotificationDbContext {
  orgId?: string | null;
  role?:  string | null;
}

@Injectable()
export class NotificationsService {
  private readonly repo: Repository<NotificationEntity> | null = null;

  constructor(
    @Inject(DATA_SOURCE) ds: DataSource | null,
    @Optional()
    @InjectQueue(QUEUE_NAMES.NOTIFICATIONS) private readonly queue: Queue | null,
    private readonly ws: RealtimeService,
    private readonly dbContext: DatabaseContextService,
  ) {
    if (ds) this.repo = ds.getRepository(NotificationEntity);
  }

  /**
   * Resolves the NotificationEntity repository for a unit of work.
   * Flag OFF → `manager` is the default DataSource manager (identical to today).
   * Flag ON  → `manager` is the context-bound transaction manager (SET LOCAL).
   * Standalone (no DB) → falls back to the cached repo (preserves current throw).
   */
  private repoFrom(manager: EntityManager | undefined): Repository<NotificationEntity> {
    return manager ? manager.getRepository(NotificationEntity) : this.repo!;
  }

  async enqueue(tenantId: string, dto: CreateNotificationDto): Promise<{ jobId: string | undefined }> {
    if (!this.queue) return { jobId: undefined };
    const job = await this.queue.add(NOTIFICATION_JOB_NAMES.SEND, {
      tenantId,
      userId:   dto.userId,
      title:    dto.title,
      body:     dto.body,
      type:     dto.type,
      entity:   dto.entity,
      entityId: dto.entityId,
      metadata: dto.metadata,
    });
    return { jobId: job.id };
  }

  async list(tenantId: string, userId: string | undefined, query: PaginationDto, ctx?: NotificationDbContext) {
    return this.dbContext.runInTenantContext(
      { tenantId, orgId: ctx?.orgId ?? null, role: ctx?.role ?? null },
      async (manager) => {
        const qb = this.repoFrom(manager)
          .createQueryBuilder('n')
          .where('n.tenant_id = :tenantId', { tenantId });

        if (userId) qb.andWhere('n.user_id = :userId', { userId });

        qb.orderBy('n.created_at', 'DESC')
          .skip(query.offset ?? 0)
          .take(query.limit ?? 20);

        const [data, total] = await qb.getManyAndCount();
        return { data, meta: { total, offset: query.offset ?? 0, limit: query.limit ?? 20 } };
      },
    );
  }

  async countUnread(tenantId: string, userId: string, ctx?: NotificationDbContext): Promise<number> {
    return this.dbContext.runInTenantContext(
      { tenantId, orgId: ctx?.orgId ?? null, role: ctx?.role ?? null },
      async (manager) =>
        this.repoFrom(manager)
          .createQueryBuilder('n')
          .where('n.tenant_id = :tenantId AND n.user_id = :userId AND n.read_at IS NULL', { tenantId, userId })
          .getCount(),
    );
  }

  async markRead(tenantId: string, id: string, ctx?: NotificationDbContext): Promise<NotificationEntity> {
    return this.dbContext.runInTenantContext(
      { tenantId, orgId: ctx?.orgId ?? null, role: ctx?.role ?? null },
      async (manager) => {
        const repo = this.repoFrom(manager);
        const existing = await repo
          .createQueryBuilder('n')
          .where('n.id = :id AND n.tenant_id = :tenantId', { id, tenantId })
          .getOne();
        if (!existing) throw new NotFoundException('Notificação não encontrada');

        await repo.update({ id, tenant_id: tenantId } as any, { read_at: new Date() } as any);
        return repo
          .createQueryBuilder('n')
          .where('n.id = :id AND n.tenant_id = :tenantId', { id, tenantId })
          .getOne() as Promise<NotificationEntity>;
      },
    );
  }

  async markAllRead(tenantId: string, userId: string, ctx?: NotificationDbContext): Promise<{ updated: number }> {
    return this.dbContext.runInTenantContext(
      { tenantId, orgId: ctx?.orgId ?? null, role: ctx?.role ?? null },
      async (manager) => {
        const result = await this.repoFrom(manager)
          .createQueryBuilder()
          .update(NotificationEntity)
          .set({ read_at: new Date() } as any)
          .where('tenant_id = :tenantId AND user_id = :userId AND read_at IS NULL', { tenantId, userId })
          .execute();
        return { updated: result.affected ?? 0 };
      },
    );
  }
}
