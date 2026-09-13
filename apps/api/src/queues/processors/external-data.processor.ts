import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { ExternalDataExchangeService } from '../../core/external-data/external-data-exchange.service';
import { QUEUE_NAMES, WORKFLOW_JOB_NAMES } from '../queue.constants';
import { DatabaseContextService } from '../../database/database-context.service';

type ExternalDataJobPayload = Record<string, unknown> & {
  tenantId: string;
  userId?: string;
  providerId?: string;
};

@Processor(QUEUE_NAMES.STREAMING_SYNC)
@Injectable()
export class ExternalDataProcessor extends WorkerHost {
  private readonly logger = new Logger(ExternalDataProcessor.name);

  constructor(
    private readonly exchange: ExternalDataExchangeService,
    private readonly dbContext: DatabaseContextService,
  ) {
    super();
  }

  // find-657093f0: ExternalDataExchangeService persists via repos captured at
  // construction (artists/releases/works/phonograms/shares/webhookEvents/
  // submissions — all tenant-scoped). Route every job through the tenant DB
  // context so those repos re-resolve through the ALS-bound connection.
  async process(job: Job<ExternalDataJobPayload>): Promise<void> {
    const d = job.data;
    if (!d.tenantId) throw new Error('External data job missing tenantId');
    this.logger.log(`[external-data] job=${job.name} id=${job.id} tenant=${d.tenantId}`);

    return this.dbContext.runInTenantContext(
      { tenantId: d.tenantId, orgId: null, role: null },
      () => this.processInContext(job),
    );
  }

  private async processInContext(job: Job<ExternalDataJobPayload>): Promise<void> {
    const d = job.data;
    switch (job.name) {
      case WORKFLOW_JOB_NAMES.DISTRIBUTOR_SUBMIT: {
        if (!d.providerId) throw new Error('External data job missing providerId (distributor.submit)');
        await this.exchange.submitDistributor({
          tenantId: d.tenantId,
          userId: String(d.userId ?? 'system:queue'),
          providerId: String(d.providerId),
          artistId: String(d['artistId']),
          releaseId: d['releaseId'] ? String(d['releaseId']) : null,
          phonogramIds: Array.isArray(d['phonogramIds']) ? d['phonogramIds'].map(String) : [],
          idempotencyKey: d['idempotencyKey'] ? String(d['idempotencyKey']) : String(job.id),
          metadata: { jobId: String(job.id) },
        });
        return;
      }

      case WORKFLOW_JOB_NAMES.DISTRIBUTOR_STATUS_CHECK: {
        if (!d.providerId) throw new Error('External data job missing providerId (distributor.status-check)');
        await this.exchange.checkDistributorStatus({
          tenantId: d.tenantId,
          userId: String(d.userId ?? 'system:queue'),
          providerId: String(d.providerId),
          submissionId: String(d['submissionId']),
          entityType: d['entityType'] as any,
          entityId: d['entityId'] ? String(d['entityId']) : undefined,
          idempotencyKey: String(job.id),
        });
        return;
      }

      case WORKFLOW_JOB_NAMES.SOCIETY_SUBMIT:
      case WORKFLOW_JOB_NAMES.EXTERNAL_DATA_SYNC: {
        const providerId = d.providerId ?? d['societyHint'];
        if (!providerId) throw new Error('External data job missing providerId/societyHint (society.submit)');
        await this.exchange.submitSociety({
          tenantId: d.tenantId,
          userId: String(d.userId ?? 'system:queue'),
          providerId: String(providerId),
          artistId: d['artistId'] ? String(d['artistId']) : null,
          workIds: Array.isArray(d['workIds']) ? d['workIds'].map(String) : [],
          phonogramIds: Array.isArray(d['phonogramIds']) ? d['phonogramIds'].map(String) : [],
          idempotencyKey: d['idempotencyKey'] ? String(d['idempotencyKey']) : String(job.id),
          metadata: { jobId: String(job.id) },
        });
        return;
      }

      case WORKFLOW_JOB_NAMES.SOCIETY_STATUS_CHECK: {
        if (!d.providerId) throw new Error('External data job missing providerId (society.status-check)');
        await this.exchange.checkSocietyStatus({
          tenantId: d.tenantId,
          userId: String(d.userId ?? 'system:queue'),
          providerId: String(d.providerId),
          submissionId: String(d['submissionId']),
          entityType: d['entityType'] as any,
          entityId: d['entityId'] ? String(d['entityId']) : undefined,
          idempotencyKey: String(job.id),
        });
        return;
      }

      default:
        this.logger.debug(`[external-data] ignored job=${job.name}`);
    }
  }
}
