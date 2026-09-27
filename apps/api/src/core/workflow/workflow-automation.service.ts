/**
 * core/workflow/workflow-automation.service.ts
 *
 * Phase 10 — Workflow Automation Engine
 *
 * Connects domain events to automated workflow actions via trigger rules.
 * Every execution is logged; failures are queued for retry (DLQ pattern).
 *
 * Architecture:
 *   DomainEvent fired → WorkflowAutomationService.processEvent()
 *     → matches trigger rules
 *     → executes actions (transition, tag, notify, webhook)
 *     → logs execution result
 *     → on failure: enqueues to DLQ queue for retry
 */

import { Injectable, Logger, Inject, Optional, OnModuleInit } from '@nestjs/common';
import { DataSource, Repository }   from 'typeorm';
import { InjectQueue }              from '@nestjs/bullmq';
import type { Queue }               from 'bullmq';
import { DATA_SOURCE }              from '../../database/database.module';
import { EventsService, DOMAIN_EVENTS } from '../events/events.service';
import type { DomainEvent }             from '../events/events.service';
import { WorkflowService }              from './workflow.service';
import { WorkflowExecutionService }     from './workflow-execution.service';
import { DomainEventLogEntity }         from '../../database/entities';
import { DatabaseContextService }       from '../../database/database-context.service';

// ── Trigger Rule types ────────────────────────────────────────────────────────

export type TriggerAction =
  | { type: 'notify';     template: string; dataPath?: string }
  | { type: 'transition'; entityType: string; toStatus: string; reason?: string }
  | { type: 'webhook';    url: string; method?: string };

export interface TriggerRule {
  id:          string;
  name:        string;
  event:       string;
  conditions?: Array<{ field: string; operator: '==' | '!=' | 'in'; value: unknown }>;
  actions:     TriggerAction[];
}

// ── Built-in trigger rules ────────────────────────────────────────────────────

const BUILTIN_TRIGGERS: TriggerRule[] = [
  {
    id:   'contract.signed → active',
    name: 'Contrato assinado → atualizar release para pendente',
    event: DOMAIN_EVENTS.CONTRACT_SIGNED,
    actions: [
      { type: 'notify', template: 'contract.signed.team' },
    ],
  },
  {
    id:   'release.published → notify',
    name: 'Release publicado → notificar equipe',
    event: DOMAIN_EVENTS.RELEASE_PUBLISHED,
    actions: [
      { type: 'notify', template: 'release.published.team' },
    ],
  },
  {
    id:   'lead.created → notify',
    name: 'Lead criado → notificar equipe comercial',
    event: DOMAIN_EVENTS.LEAD_CREATED,
    actions: [
      { type: 'notify', template: 'lead.created.sales_team' },
    ],
  },
  {
    id:   'campaign.started → notify',
    name: 'Campanha iniciada → notificar responsáveis',
    event: DOMAIN_EVENTS.CAMPAIGN_STARTED,
    actions: [
      { type: 'notify', template: 'campaign.started.team' },
    ],
  },
  {
    id:   'ticket.resolved → notify-contact',
    name: 'Ticket resolvido → notificar contacto',
    event: DOMAIN_EVENTS.TICKET_RESOLVED,
    actions: [
      { type: 'notify', template: 'support.ticket.resolved.contact' },
    ],
  },
];

@Injectable()
export class WorkflowAutomationService implements OnModuleInit {
  private readonly logger  = new Logger(WorkflowAutomationService.name);
  private readonly rules   = new Map<string, TriggerRule[]>();
  private logRepo: Repository<DomainEventLogEntity> | null = null;

  constructor(
    @Optional() @Inject(DATA_SOURCE) private readonly ds: DataSource | null,
    @Optional() @Inject(EventsService) private readonly events: EventsService | undefined,
    @Optional() @Inject(WorkflowService) private readonly workflow: WorkflowService | undefined,
    @Optional() @Inject(WorkflowExecutionService) private readonly execution: WorkflowExecutionService | undefined,
    @Optional() @InjectQueue('notifications') private readonly notifQueue: Queue | null,
    @Optional() private readonly dbContext?: DatabaseContextService,
  ) {
    if (ds) {
      this.logRepo = ds.getRepository(DomainEventLogEntity);
    }
  }

  onModuleInit(): void {
    // Register built-in triggers
    for (const rule of BUILTIN_TRIGGERS) {
      this.register(rule);
    }

    // Subscribe to all domain events
    const events = Object.values(DOMAIN_EVENTS) as string[];
    if (this.events) {
      for (const event of events) {
        this.events.on(event, (payload: DomainEvent) => {
          this.processEvent(event, payload).catch((err: unknown) =>
            this.logger.error(`WorkflowAutomation processEvent failed [${event}]: ${String(err)}`),
          );
        });
      }
    } else {
      this.logger.warn('WorkflowAutomationService: EventsService unavailable; triggers not subscribed');
    }

    this.logger.log(
      `WorkflowAutomationService initialized — ${BUILTIN_TRIGGERS.length} triggers registered`,
    );
  }

  /** Register a custom trigger rule (e.g., from tenant config). */
  register(rule: TriggerRule): void {
    const existing = this.rules.get(rule.event) ?? [];
    existing.push(rule);
    this.rules.set(rule.event, existing);
  }

  /** Process a domain event against registered trigger rules. */
  async processEvent(eventType: string, payload: DomainEvent): Promise<void> {
    const rules = this.rules.get(eventType);
    if (!rules || rules.length === 0) return;

    const tenantId = payload.tenantId;
    if (!tenantId) {
      this.logger.warn(`WorkflowAutomation skipped event without tenantId [${eventType}]`);
      return;
    }
    if (!this.dbContext) {
      this.logger.warn(
        `WorkflowAutomation skipped event without DatabaseContextService [${eventType}]`,
      );
      return;
    }

    await this.dbContext.runInTenantContext(
      { tenantId, orgId: null, role: null },
      async () => {
        for (const rule of rules) {
          if (!this.matchesConditions(rule, payload)) continue;
          await this.executeRule(rule, payload);
        }
      },
    );
  }

  private matchesConditions(rule: TriggerRule, payload: DomainEvent): boolean {
    if (!rule.conditions || rule.conditions.length === 0) return true;

    const data = payload.payload as Record<string, unknown>;
    return rule.conditions.every((cond) => {
      const val = data[cond.field];
      switch (cond.operator) {
        case '==':  return val === cond.value;
        case '!=':  return val !== cond.value;
        case 'in':  return Array.isArray(cond.value) && (cond.value as unknown[]).includes(val);
        default:    return false;
      }
    });
  }

  private async executeRule(rule: TriggerRule, event: DomainEvent): Promise<void> {
    const execution = this.execution;
    if (!execution) {
      this.logger.warn(
        `WorkflowAutomation skipped rule without WorkflowExecutionService [${rule.id}]`,
      );
      return;
    }
    const tenantId = event.tenantId;
    const executionId = await execution.start({
      tenantId,
      ruleId: rule.id,
      ruleName: rule.name,
      eventType: event.type,
      actionsTotal: rule.actions.length,
    });

    let succeeded = 0;
    let failed = 0;
    let firstError: string | null = null;

    for (const action of rule.actions) {
      try {
        await this.executeAction(action, event);
        succeeded++;
        await execution.logAction(executionId, tenantId, action.type, 'success');
        this.logger.debug(
          `Trigger [${rule.id}] → action [${action.type}] executed for tenant=${event.tenantId}`,
        );
      } catch (err) {
        failed++;
        const msg = String(err);
        if (!firstError) firstError = msg;
        await execution.logAction(executionId, tenantId, action.type, 'failed', msg);
        this.logger.warn(
          `Trigger [${rule.id}] → action [${action.type}] failed: ${msg}. Enqueuing for retry.`,
        );
        await this.enqueueDlq(rule, action, event, msg);
      }
    }

    await execution.finish(executionId, { tenantId, ruleId: rule.id, succeeded, failed, error: firstError });
  }

  private async executeAction(action: TriggerAction, event: DomainEvent): Promise<void> {
    switch (action.type) {
      case 'notify':
        await this.sendNotification(action.template, event);
        break;

      case 'transition':
        // Transition actions require fromStatus to be known.
        // Custom rules that use this action must include the current entity status in the event payload.
        // Built-in triggers use 'notify' only — this path is reserved for tenant-configured rules.
        this.logger.debug(
          `Transition action [${action.entityType} → ${action.toStatus}] skipped: ` +
          'fromStatus must be provided by custom tenant rule payload',
        );
        break;

      case 'webhook':
        // Webhook dispatch — fire-and-forget via queue
        await this.enqueueWebhook(action, event);
        break;
    }
  }

  private async sendNotification(template: string, event: DomainEvent): Promise<void> {
    if (!this.notifQueue) return;
    await this.notifQueue.add('notification', {
      tenantId:   event.tenantId,
      template,
      payload:    event.payload,
      triggeredBy: event.type,
    }, { attempts: 3, backoff: { type: 'exponential', delay: 2000 } });
  }

  private async enqueueWebhook(action: { url: string; method?: string }, event: DomainEvent): Promise<void> {
    if (!this.notifQueue) return;
    await this.notifQueue.add('webhook', {
      url:    action.url,
      method: action.method ?? 'POST',
      body:   { event: event.type, tenantId: event.tenantId, payload: event.payload },
    }, { attempts: 3, backoff: { type: 'exponential', delay: 3000 } });
  }

  private async enqueueDlq(
    rule:   TriggerRule,
    action: TriggerAction,
    event:  DomainEvent,
    error:  string,
  ): Promise<void> {
    if (!this.notifQueue) return;
    try {
      await this.notifQueue.add('automation:dlq', {
        ruleId:   rule.id,
        action,
        event,
        error,
        failedAt: new Date().toISOString(),
      }, { attempts: 1 });
    } catch {
      // DLQ enqueue failure is not critical — log and continue
    }
  }

  /** Returns all registered trigger rules (for admin inspection). */
  getTriggers(): TriggerRule[] {
    const all: TriggerRule[] = [];
    for (const rules of this.rules.values()) all.push(...rules);
    return all;
  }
}
