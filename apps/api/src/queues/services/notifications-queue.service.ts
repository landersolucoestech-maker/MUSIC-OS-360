/**
 * queues/services/notifications-queue.service.ts
 *
 * Producer service for the "notifications" queue.
 * When Redis is not available, the methods are silent no-ops.
 */

import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectQueue }        from '@nestjs/bullmq';
import { Queue, JobsOptions } from 'bullmq';
import { QUEUE_NAMES, NOTIFICATION_JOB_NAMES } from '../queue.constants';
import type { NotificationPayload } from '../processors/notifications.processor';

const HIGH_PRIORITY:   Partial<JobsOptions> = { priority: 1 };
const NORMAL_PRIORITY: Partial<JobsOptions> = { priority: 5 };

@Injectable()
export class NotificationsQueueService {
  private readonly logger = new Logger(NotificationsQueueService.name);

  constructor(
    @Optional()
    @InjectQueue(QUEUE_NAMES.NOTIFICATIONS)
    private readonly queue: Queue | null,
  ) {}

  private get available(): boolean {
    return this.queue != null;
  }

  async enqueue(payload: NotificationPayload, opts?: Partial<JobsOptions>): Promise<void> {
    if (!this.available) return;
    // The job name must match NotificationsProcessor's switch(job.name)
    // (NOTIFICATION_JOB_NAMES.SEND='send') — using an arbitrary string here
    // makes the processor silently fall into `default:` and never persist/emit.
    const job = await this.queue!.add(NOTIFICATION_JOB_NAMES.SEND, payload, { ...NORMAL_PRIORITY, ...opts });
    this.logger.log(`[notifications] enqueued jobId=${job.id} userId=${payload.userId} type=${payload.type}`);
  }

  async enqueueUrgent(payload: NotificationPayload): Promise<void> {
    if (!this.available) return;
    const job = await this.queue!.add(NOTIFICATION_JOB_NAMES.SEND, payload, HIGH_PRIORITY);
    this.logger.log(`[notifications] enqueued URGENT jobId=${job.id} userId=${payload.userId} type=${payload.type}`);
  }

  async enqueueContractExpiring(
    tenantId: string, userId: string, contractId: string, contractTitle: string, daysLeft: number,
  ): Promise<void> {
    await this.enqueue({ tenantId, userId, title: `Contrato vencendo em ${daysLeft} dias`, body: contractTitle, type: 'contract:expiring', entity: 'contract', entityId: contractId, metadata: { daysLeft } });
  }

  async enqueuePaymentFailed(tenantId: string, userId: string, planDisplayName: string): Promise<void> {
    await this.enqueueUrgent({ tenantId, userId, title: 'Falha no pagamento da assinatura', body: `Plano: ${planDisplayName}. Atualize o método de pagamento.`, type: 'billing:payment_failed', entity: 'billing', metadata: { plan: planDisplayName } });
  }

  async enqueueAiJobCompleted(tenantId: string, userId: string, skill: string): Promise<void> {
    await this.enqueue({ tenantId, userId, title: 'Tarefa de IA concluída', body: 'O resultado já está disponível.', type: 'ai:job_completed', entity: 'ai_job', metadata: { skill } });
  }

  async getQueueStats(): Promise<{ waiting: number; active: number; completed: number; failed: number; delayed: number }> {
    if (!this.available) return { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 };
    const [waiting, active, completed, failed, delayed] = [
      await this.queue!.getWaitingCount(),
      await this.queue!.getActiveCount(),
      await this.queue!.getCompletedCount(),
      await this.queue!.getFailedCount(),
      await this.queue!.getDelayedCount(),
    ];
    return { waiting, active, completed, failed, delayed };
  }
}
