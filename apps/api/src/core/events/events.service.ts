import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CorrelationContext } from './correlation.context';
import type {
  ArtistCreatedPayload,
  ArtistUpdatedPayload,
  ArtistStatusChangedPayload,
  ArtistDeletedPayload,
  ContractCreatedPayload,
  ContractStatusChangedPayload,
  ContractSentForSignaturePayload,
  ContractCancelledPayload,
  ContractExpiringSoonPayload,
  ContractSignedPayload,
  ContractExpiredPayload,
  TransactionCreatedPayload,
  TransactionStatusChangedPayload,
  TransactionPaidPayload,
  TransactionCancelledPayload,
  InvoiceCreatedPayload,
  InvoiceStatusChangedPayload,
  InvoiceIssuedPayload,
  InvoiceOverduePayload,
  FinancialRuleTriggeredPayload,
  ArtistOnboardingStartedPayload,
  DistributionSetupRequestedPayload,
  ProjectCompletedPayload,
  ExternalDataSyncRequestedPayload,
  ContractIntegrationReadyPayload,
  DistributionSyncStartedPayload,
  DistributionSyncCompletedPayload,
  DistributionSyncFailedPayload,
  ExternalDataSyncStartedPayload,
  ExternalDataSyncCompletedPayload,
  ExternalDataSyncFailedPayload,
  SocietySubmissionCreatedPayload,
  SocietyStatusUpdatedPayload,
  DistributorSubmissionCreatedPayload,
  DistributorStatusUpdatedPayload,
  ReleaseCreatedPayload,
  ReleasePublishedPayload,
  ReleaseApprovedPayload,
  ReleaseDistributedPayload,
  TakedownRequestedPayload,
  CampaignCreatedPayload,
  CampaignStartedPayload,
  CampaignEndedPayload,
  MarketingProjectCreatedPayload,
  CoverArtTaskCreatedPayload,
  MarketingPlanCompletedPayload,
  MarketingTasksGeneratedPayload,
  LeadConvertedPayload,
  AssetUploadedPayload,
  AssetAvailableForContentPayload,
  SkillStartedPayload,
  SkillCompletedPayload,
  SkillFailedPayload,
  AssetLinkedToProjectPayload,
  AssetLinkedToTaskPayload,
  WorkflowExecutionStartedPayload,
  WorkflowExecutionCompletedPayload,
  WorkflowExecutionFailedPayload,
  CatalogWorkCreatedPayload,
  CatalogRecordingCreatedPayload,
  SupportTicketCreatedPayload,
  TicketResolvedPayload,
  WorkflowTransitionedPayload,
  TenantCreatedPayload,
  UserInvitedPayload,
  LeadCreatedPayload,
  LeadUpdatedPayload,
  ConversationCreatedPayload,
} from './domain-events.types';

// ─── Core DomainEvent envelope ────────────────────────────────────────────────

export interface DomainEvent<T = unknown> {
  type:           string;
  tenantId:       string;
  userId?:        string;
  correlationId?: string;
  /** Domain aggregate name (e.g. 'artist', 'contract', 'release') */
  aggregateType?: string;
  /** ID of the aggregate instance */
  aggregateId?:   string;
  payload:        T;
  occurredAt:     string;
}

// ─── Event → Payload compile-time map ────────────────────────────────────────

/**
 * Map from event type string → payload type.
 * Used by `EventsService.emitTyped()` to enforce payload shape at compile time.
 */
export interface EventPayloadMap {
  'artist.created':                ArtistCreatedPayload;
  'artist.updated':                ArtistUpdatedPayload;
  'artist.status_changed':         ArtistStatusChangedPayload;
  'artist.deleted':                ArtistDeletedPayload;
  'contract.created':              ContractCreatedPayload;
  'contract.status_changed':       ContractStatusChangedPayload;
  'contract.sent_for_signature':   ContractSentForSignaturePayload;
  'contract.cancelled':            ContractCancelledPayload;
  'contract.expiring_soon':        ContractExpiringSoonPayload;
  'contract.signed':               ContractSignedPayload;
  'contract.expired':              ContractExpiredPayload;
  'transaction.created':         TransactionCreatedPayload;
  'transaction.status_changed':  TransactionStatusChangedPayload;
  'transaction.paid':            TransactionPaidPayload;
  'transaction.cancelled':       TransactionCancelledPayload;
  'invoice.created':             InvoiceCreatedPayload;
  'invoice.status_changed':      InvoiceStatusChangedPayload;
  'invoice.issued':              InvoiceIssuedPayload;
  'invoice.overdue':             InvoiceOverduePayload;
  'financial_rule.triggered':    FinancialRuleTriggeredPayload;
  'artist.onboarding_started':   ArtistOnboardingStartedPayload;
  'distribution.setup_requested': DistributionSetupRequestedPayload;
  'project.completed':           ProjectCompletedPayload;
  'external-data.sync_requested': ExternalDataSyncRequestedPayload;
  'contract.integration_ready':      ContractIntegrationReadyPayload;
  'distribution.sync_started':       DistributionSyncStartedPayload;
  'distribution.sync_completed':     DistributionSyncCompletedPayload;
  'distribution.sync_failed':        DistributionSyncFailedPayload;
  'external-data.sync_started':      ExternalDataSyncStartedPayload;
  'external-data.sync_completed':    ExternalDataSyncCompletedPayload;
  'external-data.sync_failed':       ExternalDataSyncFailedPayload;
  'society.submission_created':      SocietySubmissionCreatedPayload;
  'society.status_updated':          SocietyStatusUpdatedPayload;
  'distributor.submission_created':  DistributorSubmissionCreatedPayload;
  'distributor.status_updated':      DistributorStatusUpdatedPayload;
  'release.created':                 ReleaseCreatedPayload;
  'release.published':               ReleasePublishedPayload;
  'release.approved':      ReleaseApprovedPayload;
  'release.distributed':   ReleaseDistributedPayload;
  'takedown.requested':    TakedownRequestedPayload;
  'campaign.created':      CampaignCreatedPayload;
  'campaign.started':      CampaignStartedPayload;
  'campaign.ended':        CampaignEndedPayload;
  'marketing.project_created': MarketingProjectCreatedPayload;
  'marketing.cover_art_task_created': CoverArtTaskCreatedPayload;
  'marketing.plan_completed': MarketingPlanCompletedPayload;
  'marketing.tasks_generated': MarketingTasksGeneratedPayload;
  'lead.created':          LeadCreatedPayload;
  'lead.updated':          LeadUpdatedPayload;
  'lead.converted':        LeadConvertedPayload;
  'conversation.created':  ConversationCreatedPayload;
  'asset.uploaded':        AssetUploadedPayload;
  'marketing.asset_available_for_content': AssetAvailableForContentPayload;
  'skill.started':         SkillStartedPayload;
  'skill.completed':       SkillCompletedPayload;
  'skill.failed':          SkillFailedPayload;
  'asset.linked_to_project': AssetLinkedToProjectPayload;
  'asset.linked_to_task':    AssetLinkedToTaskPayload;
  'workflow.execution.started':   WorkflowExecutionStartedPayload;
  'workflow.execution.completed': WorkflowExecutionCompletedPayload;
  'workflow.execution.failed':    WorkflowExecutionFailedPayload;
  'catalog.work.created':      CatalogWorkCreatedPayload;
  'catalog.recording.created': CatalogRecordingCreatedPayload;
  'support.ticket.created': SupportTicketCreatedPayload;
  'ticket.resolved':       TicketResolvedPayload;
  'workflow.transitioned': WorkflowTransitionedPayload;
  'tenant.created':        TenantCreatedPayload;
  'user.invited':          UserInvitedPayload;
}

export type DomainEventType = keyof EventPayloadMap;

/** Nomes de eventos de domínio padronizados */
export const DOMAIN_EVENTS = {
  // Artists
  ARTIST_CREATED:        'artist.created',
  ARTIST_UPDATED:        'artist.updated',
  ARTIST_STATUS_CHANGED: 'artist.status_changed',
  ARTIST_DELETED:        'artist.deleted',

  // Contracts
  CONTRACT_CREATED:             'contract.created',
  CONTRACT_STATUS_CHANGED:      'contract.status_changed',
  CONTRACT_SENT_FOR_SIGNATURE:  'contract.sent_for_signature',
  CONTRACT_CANCELLED:           'contract.cancelled',
  CONTRACT_EXPIRING_SOON:       'contract.expiring_soon',
  CONTRACT_SIGNED:              'contract.signed',
  CONTRACT_EXPIRED:             'contract.expired',

  // Accounting — Transactions
  TRANSACTION_CREATED:        'transaction.created',
  TRANSACTION_STATUS_CHANGED: 'transaction.status_changed',
  TRANSACTION_PAID:           'transaction.paid',
  TRANSACTION_CANCELLED:      'transaction.cancelled',

  // Accounting — Invoices
  INVOICE_CREATED:        'invoice.created',
  INVOICE_STATUS_CHANGED: 'invoice.status_changed',
  INVOICE_ISSUED:         'invoice.issued',
  INVOICE_OVERDUE:        'invoice.overdue',

  // Financial Rules
  FINANCIAL_RULE_TRIGGERED: 'financial_rule.triggered',

  // Operational Workflows
  ARTIST_ONBOARDING_STARTED:    'artist.onboarding_started',
  DISTRIBUTION_SETUP_REQUESTED: 'distribution.setup_requested',
  PROJECT_COMPLETED:            'project.completed',
  EXTERNAL_DATA_SYNC_REQUESTED: 'external-data.sync_requested',
  CONTRACT_INTEGRATION_READY:   'contract.integration_ready',

  // Distribution Sync
  DISTRIBUTION_SYNC_STARTED:    'distribution.sync_started',
  DISTRIBUTION_SYNC_COMPLETED:  'distribution.sync_completed',
  DISTRIBUTION_SYNC_FAILED:     'distribution.sync_failed',

  // External data exchange only. MUSIC OS 360 does not calculate royalties.
  EXTERNAL_DATA_SYNC_STARTED:       'external-data.sync_started',
  EXTERNAL_DATA_SYNC_COMPLETED:     'external-data.sync_completed',
  EXTERNAL_DATA_SYNC_FAILED:        'external-data.sync_failed',
  SOCIETY_SUBMISSION_CREATED:       'society.submission_created',
  SOCIETY_STATUS_UPDATED:           'society.status_updated',
  DISTRIBUTOR_SUBMISSION_CREATED:   'distributor.submission_created',
  DISTRIBUTOR_STATUS_UPDATED:       'distributor.status_updated',

  // Releases
  RELEASE_CREATED:       'release.created',
  RELEASE_PUBLISHED:     'release.published',
  RELEASE_APPROVED:      'release.approved',
  RELEASE_DISTRIBUTED:   'release.distributed',

  // Monitoring
  TAKEDOWN_REQUESTED:    'takedown.requested',

  // Marketing / CRM
  CAMPAIGN_CREATED:      'campaign.created',
  CAMPAIGN_STARTED:      'campaign.started',
  CAMPAIGN_ENDED:        'campaign.ended',
  MARKETING_PROJECT_CREATED: 'marketing.project_created',
  COVER_ART_TASK_CREATED: 'marketing.cover_art_task_created',
  MARKETING_PLAN_COMPLETED: 'marketing.plan_completed',
  MARKETING_TASKS_GENERATED: 'marketing.tasks_generated',
  LEAD_CREATED:          'lead.created',
  LEAD_UPDATED:          'lead.updated',
  LEAD_CONVERTED:        'lead.converted',
  CONVERSATION_CREATED:  'conversation.created',

  // Assets
  ASSET_UPLOADED:        'asset.uploaded',
  ASSET_AVAILABLE_FOR_CONTENT: 'marketing.asset_available_for_content',
  ASSET_LINKED_TO_PROJECT: 'asset.linked_to_project',
  ASSET_LINKED_TO_TASK:    'asset.linked_to_task',

  // Skills runtime
  SKILL_STARTED:         'skill.started',
  SKILL_COMPLETED:       'skill.completed',
  SKILL_FAILED:          'skill.failed',

  // Workflow execution
  WORKFLOW_EXECUTION_STARTED:   'workflow.execution.started',
  WORKFLOW_EXECUTION_COMPLETED: 'workflow.execution.completed',
  WORKFLOW_EXECUTION_FAILED:    'workflow.execution.failed',

  // Catalog
  CATALOG_WORK_CREATED:      'catalog.work.created',
  CATALOG_RECORDING_CREATED: 'catalog.recording.created',

  // Support
  SUPPORT_TICKET_CREATED: 'support.ticket.created',
  TICKET_RESOLVED:       'ticket.resolved',

  // Workflow
  WORKFLOW_TRANSITIONED: 'workflow.transitioned',

  // Tenant / Users
  TENANT_CREATED:        'tenant.created',
  USER_INVITED:          'user.invited',
} as const;

// ─── EventsService ────────────────────────────────────────────────────────────

/**
 * EventsService — typed wrapper over EventEmitter2.
 *
 * - `emitTyped` provides compile-time payload type enforcement via EventPayloadMap.
 * - `emit` / `emitAsync` accept any generic DomainEvent envelope.
 * - correlationId is auto-injected from CorrelationContext when not explicitly provided.
 */
@Injectable()
export class EventsService {
  constructor(private readonly emitter: EventEmitter2) {}

  /**
   * Type-safe emit — payload type is inferred from the event name via EventPayloadMap.
   * correlationId is auto-injected from the current async context.
   */
  emitTyped<K extends DomainEventType>(
    type: K,
    envelope: Omit<DomainEvent<EventPayloadMap[K]>, 'type' | 'occurredAt'> & {
      occurredAt?: string;
    },
  ): void {
    const event: DomainEvent<EventPayloadMap[K]> = {
      ...envelope,
      type,
      occurredAt:    envelope.occurredAt ?? new Date().toISOString(),
      correlationId: envelope.correlationId ?? CorrelationContext.get() ?? undefined,
    };
    this.emitter.emit(type, event);
  }

  emit<T>(event: DomainEvent<T>): void {
    const enriched: DomainEvent<T> = {
      ...event,
      correlationId: event.correlationId ?? CorrelationContext.get() ?? undefined,
    };
    this.emitter.emit(enriched.type, enriched);
  }

  emitAsync<T>(event: DomainEvent<T>): Promise<unknown[]> {
    const enriched: DomainEvent<T> = {
      ...event,
      correlationId: event.correlationId ?? CorrelationContext.get() ?? undefined,
    };
    return this.emitter.emitAsync(enriched.type, enriched);
  }

  on<T>(eventType: string, handler: (event: DomainEvent<T>) => void): void {
    this.emitter.on(eventType, handler);
  }

  off<T>(eventType: string, handler: (event: DomainEvent<T>) => void): void {
    this.emitter.off(eventType, handler);
  }
}
