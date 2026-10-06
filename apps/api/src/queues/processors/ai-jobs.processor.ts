/**
 * queues/processors/ai-jobs.processor.ts
 *
 * BullMQ processor for the "ai-jobs" queue.
 * Runs AI completions (OpenAI / Claude / Gemini via AiService),
 * persists the result in the ai_jobs table and emits it via WebSocket.
 */

import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger }    from '@nestjs/common';
import { Job }                   from 'bullmq';
import { QUEUE_NAMES }           from '../queue.constants';
import { AiService, AiCompletionOptions } from '../../modules/ai/ai.service';
import { RealtimeService }       from '../../core/realtime/realtime.service';
import { DatabaseContextService } from '../../database/database-context.service';

// ─── Payload ──────────────────────────────────────────────────────────────────

export interface AiJobPayload extends AiCompletionOptions {
  /** unique jobId for deduplication — optional */
  jobRef?: string;
}

// ─── Processor ────────────────────────────────────────────────────────────────

@Processor(QUEUE_NAMES.AI_JOBS)
@Injectable()
export class AiJobsProcessor extends WorkerHost {
  private readonly logger = new Logger(AiJobsProcessor.name);

  constructor(
    private readonly ai:        AiService,
    private readonly wsGateway: RealtimeService,
    private readonly dbContext: DatabaseContextService,
  ) { super(); }

  async process(job: Job<AiJobPayload>): Promise<void> {
    const d = job.data;
    this.logger.log(
      `[ai-jobs] job="${job.name}" id=${job.id} skill=${d.skill} userId=${d.userId}`,
    );

    // find-2ed4c244: fail-closed, matching every sibling processor
    // (notifications/external-data/marketing-publishing) — RLS would deny
    // the write anyway, but as a clean guard rather than a deep unhandled
    // transaction error.
    if (!d.tenantId) {
      this.logger.warn(`[ai-jobs] job ${job.id} without tenantId — aborted (fail-closed)`);
      return;
    }

    let result: Awaited<ReturnType<AiService['complete']>>;
    const startMs = Date.now();

    try {
      // find-657093f0: AiService persists to ai_jobs (a tenant-scoped table)
      // via a repo captured at construction; runInTenantContext binds the ALS
      // store so that repo re-resolves through the tenant-scoped connection
      // for the duration of this call, same as notifications.processor.ts.
      result = await this.dbContext.runInTenantContext(
        { tenantId: d.tenantId, orgId: null, role: null },
        () => this.ai.complete({
          tenantId:     d.tenantId,
          userId:       d.userId,
          skill:        d.skill,
          prompt:       d.prompt,
          systemPrompt: d.systemPrompt,
          maxTokens:    d.maxTokens,
          temperature:  d.temperature,
          jsonMode:     d.jsonMode,
        }),
      );
    } catch (err) {
      this.logger.error(`[ai-jobs] complete() failed: ${(err as Error).message}`);
      throw err; // BullMQ will retry according to the configured backoff
    }

    const latencyMs = Date.now() - startMs;
    this.logger.log(
      `[ai-jobs] skill=${d.skill} provider=${result.provider} tokens_in=${result.inputTokens} tokens_out=${result.outputTokens} latency=${latencyMs}ms`,
    );

    // Emit the result via WebSocket (ai:job:completed)
    try {
      this.wsGateway.sendToUser(d.tenantId, d.userId, 'ai:job:completed', {
        jobId:    job.id,
        jobRef:   d.jobRef,
        skill:    d.skill,
        content:  result.content,
        provider: result.provider,
        model:    result.model,
        latencyMs,
      });
    } catch (wsErr) {
      this.logger.warn(
        `[ai-jobs] WS emit failed (userId=${d.userId}): ${(wsErr as Error).message}`,
      );
    }
  }
}
