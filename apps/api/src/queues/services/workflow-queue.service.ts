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
   * find-721c845e — contenção de jobs sem consumidor.
   *
   * `onboarding-check` e `workflow-followup` (fila integrations-sync) não têm
   * nenhum @Processor registrado; `distribution-sync` (fila streaming-sync)
   * cai no `default` do ExternalDataProcessor. Enfileirá-los fazia jobs
   * crescerem sem limite em `wait` (integrations-sync) ou serem marcados como
   * concluídos sem nenhum trabalho (distribution-sync) — falsa impressão de
   * processamento. A semântica de negócio desses jobs está indefinida
   * (DEPENDENTE_DECISÃO_DE_PRODUTO): não é inventada aqui.
   *
   * O job NÃO é enfileirado; o fato que o originou já está persistido em
   * `domain_event_log` pelo UniversalEventLogHandler (evento indicado em
   * `preservedAs`), cujo payload é um superconjunto do payload do job. Quando
   * a semântica for decidida, um processor real pode ser registrado e o
   * nome removido de UNCONSUMED_QUEUE_JOBS.
   */
  private containUnconsumed(jobName: string, queueName: string, payload: { tenantId: string }): void {
    const c = UNCONSUMED_QUEUE_JOBS[jobName as keyof typeof UNCONSUMED_QUEUE_JOBS];
    this.logger.warn(
      `[${queueName}] job '${jobName}' NÃO enfileirado: sem consumidor/semântica definida ` +
      `(find-721c845e, DEPENDENTE_DECISAO_DE_PRODUTO). Fato preservado em domain_event_log ` +
      `como '${c?.preservedAs ?? 'desconhecido'}' tenant=${payload.tenantId}`,
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
