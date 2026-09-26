/**
 * workflow.bootstrap.ts
 *
 * Registers all domain workflows in WorkflowService during application bootstrap.
 * Called automatically via OnModuleInit.
 */

import { Optional, Injectable, OnModuleInit } from '@nestjs/common';
import { WorkflowService } from './workflow.service';
import { RELEASES_WORKFLOW }  from './definitions/releases.workflow';
import { CONTRACTS_WORKFLOW } from './definitions/contracts.workflow';
import { LEADS_WORKFLOW }     from './definitions/leads.workflow';
import { CAMPAIGNS_WORKFLOW } from './definitions/campaigns.workflow';
import { PROJECTS_WORKFLOW }  from './definitions/projects.workflow';
import { TICKETS_WORKFLOW }   from './definitions/tickets.workflow';

@Injectable()
export class WorkflowBootstrap implements OnModuleInit {
  constructor(@Optional() private readonly workflowService?: WorkflowService) {}

  onModuleInit(): void {
    if (!this.workflowService) return;

    this.workflowService.register(RELEASES_WORKFLOW);
    this.workflowService.register(CONTRACTS_WORKFLOW);
    this.workflowService.register(LEADS_WORKFLOW);
    this.workflowService.register(CAMPAIGNS_WORKFLOW);
    this.workflowService.register(PROJECTS_WORKFLOW);
    this.workflowService.register(TICKETS_WORKFLOW);
  }
}
