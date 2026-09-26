import { Injectable, Logger, Optional } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { DatabaseContextService } from '../../../database/database-context.service';
import { DOMAIN_EVENTS, type DomainEvent } from '../../../core/events/events.service';
import type { ProjectCompletedPayload } from '../../../core/events/domain-events.types';
import { MarketingProjectsService } from '../marketing-projects.service';

@Injectable()
export class MarketingProjectEventsHandler {
  private readonly logger = new Logger(MarketingProjectEventsHandler.name);

  constructor(
    private readonly marketingProjects: MarketingProjectsService,
    @Optional() private readonly dbContext?: DatabaseContextService,
  ) {}

  @OnEvent(DOMAIN_EVENTS.PROJECT_COMPLETED)
  async onProjectCompleted(event: DomainEvent<ProjectCompletedPayload>): Promise<void> {
    const tenantId = event.tenantId ?? event.payload.tenantId;
    if (!tenantId) {
      this.logger.warn(
        `MarketingProjectEventsHandler: event "${event.type}" without tenantId - aborted (fail-closed)`,
      );
      return;
    }

    const { projectId, title } = event.payload;

    try {
      const create = () => this.marketingProjects.createFromCompletedProject({
        ...event.payload,
        tenantId,
      });
      const marketingProject = this.dbContext
        ? await this.dbContext.runInTenantContext({ tenantId, orgId: null, role: null }, create)
        : await create();
      this.logger.log(
        `PROJECT_COMPLETED processed for project "${projectId}" (${title}); marketingProject=${marketingProject.id}; tenant=${tenantId}`,
      );
    } catch (err) {
      this.logger.error(
        `Failed to process PROJECT_COMPLETED for project "${projectId}" (${title})`,
        err instanceof Error ? err.stack : String(err),
      );
      throw err;
    }
  }
}
