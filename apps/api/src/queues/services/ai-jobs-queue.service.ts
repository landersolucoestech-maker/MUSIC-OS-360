/**
 * queues/services/ai-jobs-queue.service.ts
 *
 * Producer service for the "ai-jobs" queue.
 * When Redis is not available, the methods are silent no-ops.
 */

import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectQueue }        from '@nestjs/bullmq';
import { Queue, JobsOptions } from 'bullmq';
import { QUEUE_NAMES }        from '../queue.constants';
import type { AIJobPayload }  from '../processors/ai-jobs.processor';

const NORMAL_PRIORITY: Partial<JobsOptions> = { priority: 5 };
const LOW_PRIORITY:    Partial<JobsOptions> = { priority: 10 };

@Injectable()
export class AIJobsQueueService {
  private readonly logger = new Logger(AIJobsQueueService.name);

  constructor(
    @Optional()
    @InjectQueue(QUEUE_NAMES.AI_JOBS)
    private readonly queue: Queue | null,
  ) {}

  private get available(): boolean {
    return this.queue != null;
  }

  async enqueue(payload: AIJobPayload, opts?: Partial<JobsOptions>): Promise<string | undefined> {
    if (!this.available) return undefined;
    const job = await this.queue!.add('ai:complete', payload, {
      ...NORMAL_PRIORITY,
      attempts: 2,
      backoff:  { type: 'exponential', delay: 3000 },
      ...opts,
    });
    this.logger.log(`[ai-jobs] enqueued jobId=${job.id} skill=${payload.skill} userId=${payload.userId}`);
    return job.id;
  }

  async enqueueBiography(opts: { tenantId: string; userId: string; artistName: string; context: string; jobRef?: string }): Promise<string | undefined> {
    return this.enqueue({ tenantId: opts.tenantId, userId: opts.userId, skill: 'biography', prompt: `Escreva uma biografia profissional para o artista: ${opts.artistName}.\nContexto: ${opts.context}`, jobRef: opts.jobRef });
  }

  async enqueueCampaignCopy(opts: { tenantId: string; userId: string; campaign: string; platform: string; goal: string; jobRef?: string }): Promise<string | undefined> {
    return this.enqueue({ tenantId: opts.tenantId, userId: opts.userId, skill: 'campaign_copy', prompt: `Crie a copy da campanha "${opts.campaign}" para a plataforma ${opts.platform}. Objetivo: ${opts.goal}.`, jobRef: opts.jobRef }, LOW_PRIORITY);
  }

  async enqueueContractAnalysis(opts: { tenantId: string; userId: string; contractText: string; jobRef?: string }): Promise<string | undefined> {
    return this.enqueue({ tenantId: opts.tenantId, userId: opts.userId, skill: 'contract_analysis', prompt: `Analise o contrato a seguir e identifique as cláusulas problemáticas:\n\n${opts.contractText}`, jobRef: opts.jobRef });
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
