/**
 * queues/services/workflow-queue.service.ts
 *
 * Producer for workflow and integration jobs (integrations-sync / streaming-sync queues).
 * No provider-specific logic here — payloads are normalized; adapters resolve provider mapping.
 */

import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectQueue }        from '@nestjs/bullmq';
import { Queue, JobsOptions } from 'bullmq';
import { QUEUE_NAMES, WORKFLOW_JOB_NAMES, UNCONSUMED_QUEUE_JOBS } from '../queue.constants';

@Injectable()
export class WorkflowQueueService {
  private readonly logger = new Logger(WorkflowQueueService.name);

  constructor(
    @Optional()
    @InjectQueue(QUEUE_NAMES.INTEGRATIONS_SYNC)
    private readonly integrationsQueue: Queue | null,

    @Optional()
    @InjectQueue(QUEUE_NAMES.STREAMING_SYNC)
    private readonly streamingQueue: Queue | null,
  ) {}

  private get integrationsAvailable(): boolean { return this.integrationsQueue != null; }
  private get streamingAvailable(): boolean     { return this.streamingQueue != null; }

  /**
   * find-721c845e — containment of jobs without a consumer.
   *
   * `onboarding-check` and `workflow-followup` (integrations-sync queue) have
   * no registered @Processor; `distribution-sync` (streaming-sync queue) falls
   * into ExternalDataProcessor's `default` branch. Enqueuing them made jobs
   * grow without bound in `wait` (integrations-sync) or be marked completed
   * without doing any work (distribution-sync) — a false impression of
   * processing. The business semantics of these jobs are undefined
   * (pending a product decision) and are not invented here.
   *
   * The job is NOT enqueued; the fact that triggered it is already persisted in
   * `domain_event_log` by UniversalEventLogHandler (event named in
   * `preservedAs`), whose payload is a superset of the job payload. Once the
   * semantics are decided, a real processor can be registered and the name
   * removed from UNCONSUMED_QUEUE_JOBS.
   */
  private containUnconsumed(jobName: string, queueName: string, payload: { tenantId: string }): void {
    const c = UNCONSUMED_QUEUE_JOBS[jobName as keyof typeof UNCONSUMED_QUEUE_JOBS];
    this.logger.warn(
      `[${queueName}] job '${jobName}' NOT enqueued: no consumer/defined semantics ` +
      `(find-721c845e, pending a product decision). Fact preserved in domain_event_log ` +
      `as '${c?.preservedAs ?? 'unknown'}' tenant=${payload.tenantId}`,
    );
  }

  async enqueueDistributionSync(payload: {
    tenantId:    string;
    artistId:    string;
    contractId:  string | null;
    providerHint: string | null;
    correlationId?: string | null;
  }, opts?: Partial<JobsOptions>): Promise<void> {
    void opts;
    this.containUnconsumed(WORKFLOW_JOB_NAMES.DISTRIBUTION_SYNC, QUEUE_NAMES.STREAMING_SYNC, payload);
  }

  async enqueueExternalDataSync(payload: {
    tenantId:    string;
    artistId:    string;
    workIds:     string[];
    societyHint: string | null;
    correlationId?: string | null;
  }, opts?: Partial<JobsOptions>): Promise<void> {
    if (!this.streamingAvailable) return;
    const job = await this.streamingQueue!.add(WORKFLOW_JOB_NAMES.EXTERNAL_DATA_SYNC, payload, { attempts: 3, ...opts });
    this.logger.log(`[streaming-sync] enqueued ${WORKFLOW_JOB_NAMES.EXTERNAL_DATA_SYNC} jobId=${job.id} artistId=${payload.artistId}`);
  }

  async enqueueDistributorSubmit(payload: {
    tenantId: string;
    userId: string;
    providerId: string;
    artistId: string;
    releaseId: string | null;
    phonogramIds: string[];
    idempotencyKey?: string | null;
  }, opts?: Partial<JobsOptions>): Promise<void> {
    if (!this.streamingAvailable) return;
    const job = await this.streamingQueue!.add(WORKFLOW_JOB_NAMES.DISTRIBUTOR_SUBMIT, payload, { attempts: 3, ...opts });
    this.logger.log(`[streaming-sync] enqueued ${WORKFLOW_JOB_NAMES.DISTRIBUTOR_SUBMIT} jobId=${job.id} provider=${payload.providerId}`);
  }

  async enqueueDistributorStatusCheck(payload: {
    tenantId: string;
    userId: string;
    providerId: string;
    submissionId: string;
    entityType: string | null;
    entityId: string | null;
  }, opts?: Partial<JobsOptions>): Promise<void> {
    if (!this.streamingAvailable) return;
    const job = await this.streamingQueue!.add(WORKFLOW_JOB_NAMES.DISTRIBUTOR_STATUS_CHECK, payload, { attempts: 3, ...opts });
    this.logger.log(`[streaming-sync] enqueued ${WORKFLOW_JOB_NAMES.DISTRIBUTOR_STATUS_CHECK} jobId=${job.id} submission=${payload.submissionId}`);
  }

  async enqueueSocietySubmit(payload: {
    tenantId: string;
    userId: string;
    providerId: string;
    artistId: string | null;
    workIds: string[];
    phonogramIds: string[];
    idempotencyKey?: string | null;
  }, opts?: Partial<JobsOptions>): Promise<void> {
    if (!this.streamingAvailable) return;
    const job = await this.streamingQueue!.add(WORKFLOW_JOB_NAMES.SOCIETY_SUBMIT, payload, { attempts: 3, ...opts });
    this.logger.log(`[streaming-sync] enqueued ${WORKFLOW_JOB_NAMES.SOCIETY_SUBMIT} jobId=${job.id} provider=${payload.providerId}`);
  }

  async enqueueSocietyStatusCheck(payload: {
    tenantId: string;
    userId: string;
    providerId: string;
    submissionId: string;
    entityType: string | null;
    entityId: string | null;
  }, opts?: Partial<JobsOptions>): Promise<void> {
    if (!this.streamingAvailable) return;
    const job = await this.streamingQueue!.add(WORKFLOW_JOB_NAMES.SOCIETY_STATUS_CHECK, payload, { attempts: 3, ...opts });
    this.logger.log(`[streaming-sync] enqueued ${WORKFLOW_JOB_NAMES.SOCIETY_STATUS_CHECK} jobId=${job.id} submission=${payload.submissionId}`);
  }

  async enqueueOnboardingCheck(payload: {
    tenantId:  string;
    artistId:  string;
    tasks:     string[];
    correlationId?: string | null;
  }, opts?: Partial<JobsOptions>): Promise<void> {
    void opts;
    this.containUnconsumed(WORKFLOW_JOB_NAMES.ONBOARDING_CHECK, QUEUE_NAMES.INTEGRATIONS_SYNC, payload);
  }

  async enqueueWorkflowFollowup(payload: {
    tenantId:    string;
    entityType:  string;
    entityId:    string;
    trigger:     string;
    correlationId?: string | null;
  }, opts?: Partial<JobsOptions>): Promise<void> {
    void opts;
    this.containUnconsumed(WORKFLOW_JOB_NAMES.WORKFLOW_FOLLOWUP, QUEUE_NAMES.INTEGRATIONS_SYNC, payload);
  }

}
