import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import type { Job } from 'bullmq';
import { DataSource, EntityManager } from 'typeorm';
import { DATA_SOURCE } from '../../database/database.tokens';
import { DatabaseContextService } from '../../database/database-context.service';
import { MarketingContentPostEntity } from '../../database/entities';
import { MARKETING_PUBLISHING_JOB_NAMES, QUEUE_NAMES } from '../queue.constants';
import type { PublishContentJobPayload } from '../services/marketing-publishing-queue.service';

@Processor(QUEUE_NAMES.MARKETING_PUBLISHING)
@Injectable()
export class MarketingPublishingProcessor extends WorkerHost {
  private readonly logger = new Logger(MarketingPublishingProcessor.name);

  constructor(
    @Inject(DATA_SOURCE) private readonly ds: DataSource | null,
    @Optional() private readonly dbContext?: DatabaseContextService,
  ) {
    super();
  }

  async process(job: Job<PublishContentJobPayload>): Promise<void> {
    if (job.name !== MARKETING_PUBLISHING_JOB_NAMES.PUBLISH_CONTENT) return;
    if (!this.ds) throw new Error('Database unavailable');
    // Fail-closed: an async job without a tenant must NOT touch tenant-scoped data.
    if (!job.data.tenantId) throw new Error('[marketing-publishing] job sem tenantId — abortado (fail-closed)');

    const work = (manager: EntityManager) => this.processContent(manager, job.data);
    await (this.dbContext
      ? this.dbContext.runInTenantContext({ tenantId: job.data.tenantId, orgId: null, role: null }, work)
      : work(this.ds.manager));
  }

  /**
   * `marketing_content_posts` has FORCE ROW LEVEL SECURITY (migration
   * 20260620000005_ForceRLSOperationalTables.ts). With
   * DATABASE_SESSION_CONTEXT_ENABLED=true (required in production) and the
   * app connecting via the NOBYPASSRLS role, a raw this.ds.getRepository()
   * call here — unlike every sibling processor already fixed for this exact
   * bug (see MarketBenchmarkRefreshProcessor's own comment) — would silently
   * find zero rows and report success without ever publishing anything.
   */
  private async processContent(manager: EntityManager, data: PublishContentJobPayload): Promise<void> {
    const repo = manager.getRepository(MarketingContentPostEntity);
    const row = await repo.findOne({
      where: { id: data.contentId, tenant_id: data.tenantId, deleted_at: null } as never,
    });

    if (!row) {
      this.logger.warn(`[marketing-publishing] content not found id=${data.contentId}`);
      return;
    }
    if (row.status !== 'agendado' || row.publication_status === 'published') return;

    // find-61333a55: the read-then-write above is a TOCTOU race — two
    // concurrently-enqueued jobs for the same content can both pass the
    // check before either commits the claim, both calling publish(). Make
    // the claim itself atomic: the UPDATE's WHERE re-checks the same
    // preconditions, so only the first writer's UPDATE affects a row.
    const claim = await repo
      .createQueryBuilder()
      .update(MarketingContentPostEntity)
      .set({ publication_status: 'publishing', publication_error: null } as never)
      .where('id = :id AND tenant_id = :tenantId', { id: row.id, tenantId: row.tenant_id })
      .andWhere("status = 'agendado'")
      .andWhere("publication_status IS DISTINCT FROM 'published'")
      .andWhere("publication_status IS DISTINCT FROM 'publishing'")
      .execute();
    if (!claim.affected) {
      this.logger.log(`[marketing-publishing] content=${row.id} já reivindicado por outro worker — pulando (idempotência)`);
      return;
    }

    try {
      const result = await this.publish(row);
      await repo.update({ id: row.id, tenant_id: row.tenant_id } as never, {
        status: 'publicado',
        publication_status: 'published',
        provider_post_id: result.providerPostId,
        published_at: new Date(),
      } as never);
      this.logger.log(`[marketing-publishing] published content=${row.id} channel=${row.channel}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await repo.update({ id: row.id, tenant_id: row.tenant_id } as never, {
        status: 'falhou',
        publication_status: 'failed',
        publication_error: message,
      } as never);
      throw err;
    }
  }

  private async publish(row: MarketingContentPostEntity): Promise<{ providerPostId: string }> {
    throw new Error(
      `Publicacao real para ${row.channel} nao configurada. Configure provider OAuth/API e defina o adaptador de publicacao.`,
    );
  }
}
