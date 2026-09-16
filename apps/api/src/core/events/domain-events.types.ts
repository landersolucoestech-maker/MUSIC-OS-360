/**
 * domain-events.types.ts
 *
 * Typed payload interfaces for every MUSIC OS 360 domain event.
 * Each interface maps exactly to one DOMAIN_EVENTS key.
 * Import via: import type { ArtistCreatedPayload } from './domain-events.types';
 */

// ─── Artists ──────────────────────────────────────────────────────────────────

export interface ArtistCreatedPayload {
  artistId:      string;
  tenantId:      string;
  nomeArtistico: string;
  status:        string;
  createdBy:     string;
}

export interface ArtistUpdatedPayload {
  artistId:      string;
  tenantId:      string;
  nomeArtistico: string;
  changedFields: string[];
  updatedBy:     string;
}

export interface ArtistStatusChangedPayload {
  artistId:       string;
  tenantId:       string;
  nomeArtistico:  string;
  previousStatus: string;
  newStatus:      string;
  changedBy:      string;
}

export interface ArtistDeletedPayload {
  artistId:      string;
  tenantId:      string;
  nomeArtistico: string;
  deletedBy:     string;
}

// ─── Contracts ────────────────────────────────────────────────────────────────

export interface ContractCreatedPayload {
  contractId: string;
  tenantId:   string;
  title:     string;
  type:       string;
  artistId:   string | null;
  createdBy:  string;
}

export interface ContractStatusChangedPayload {
  contractId:     string;
  tenantId:       string;
  title:         string;
  previousStatus: string;
  newStatus:      string;
  changedBy:      string;
}

export interface ContractSentForSignaturePayload {
  contractId:  string;
  tenantId:    string;
  title:      string;
  artistId:    string | null;
  autentiqueDocId: string;
  sentBy:      string;
}

export interface ContractCancelledPayload {
  contractId:  string;
  tenantId:    string;
  title:      string;
  artistId:    string | null;
  cancelledBy: string;
  cancelledAt: string;
}

export interface ContractExpiringSoonPayload {
  contractId: string;
  tenantId:   string;
  title:     string;
  artistId:   string | null;
  endDate:    string;
  daysLeft:   number;
}

export interface ContractSignedPayload {
  contractId: string;
  tenantId:   string;
  title:     string;
  artistId:   string | null;
  signedBy:   string;
  signedAt:   string;
}

export interface ContractExpiredPayload {
  contractId: string;
  tenantId:   string;
  title:     string;
  artistId:   string | null;
  expiredAt:  string;
}

// ─── Operational Workflow ─────────────────────────────────────────────────────

export interface ArtistOnboardingStartedPayload {
  artistId:      string;
  tenantId:      string;
  nomeArtistico: string;
  tasks:         string[];
  startedAt:     string;
}

export interface DistributionSetupRequestedPayload {
  artistId:     string;
  tenantId:     string;
  contractId:   string | null;
  requestedAt:  string;
  providerHint: string | null;
}

export interface ProjectCompletedPayload {
  projectId:   string;
  tenantId:    string;
  title:       string;
  type:        string;
  artistId:    string | null;
  completedBy: string;
  completedAt: string;
}

export interface ExternalDataSyncRequestedPayload {
  artistId:    string;
  tenantId:    string;
  workIds:     string[];
  societyHint: string | null;
  requestedAt: string;
}

export interface ContractIntegrationReadyPayload {
  contractId:   string;
  tenantId:     string;
  title:       string;
  artistId:     string | null;
  valor:        string | null;
  readyAt:      string;
  integrations: string[];
}

// ─── Distribution Sync ────────────────────────────────────────────────────────

export interface DistributionSyncStartedPayload {
  tenantId:    string;
  artistId:    string;
  jobId:       string;
  provider:    string;
  contractId:  string | null;
  startedAt:   string;
}

export interface DistributionSyncCompletedPayload {
  tenantId:          string;
  artistId:          string;
  jobId:             string;
  provider:          string;
  externalReleaseId: string | null;
  completedAt:       string;
}

export interface DistributionSyncFailedPayload {
  tenantId:   string;
  artistId:   string;
  jobId:      string;
  provider:   string;
  error:      string;
  retryCount: number;
  failedAt:   string;
}

// External Data Exchange

// Society integrations are data exchange only. MUSIC OS 360 does not calculate royalties.
export interface ExternalDataSyncStartedPayload {
  tenantId:  string;
  artistId:  string;
  jobId:     string;
  society:   string;
  workIds:   string[];
  startedAt: string;
}

export interface ExternalDataSyncCompletedPayload {
  tenantId:    string;
  artistId:    string;
  jobId:       string;
  society:     string;
  completedAt: string;
}

export interface ExternalDataSyncFailedPayload {
  tenantId:   string;
  artistId:   string;
  jobId:      string;
  society:    string;
  error:      string;
  retryCount: number;
  failedAt:   string;
}

export interface SocietySubmissionCreatedPayload {
  tenantId:     string;
  artistId:     string;
  society:      string;
  submissionId: string;
  externalId:   string | null;
  createdAt:    string;
}

export interface SocietyStatusUpdatedPayload {
  tenantId:     string;
  artistId:     string;
  society:      string;
  submissionId: string;
  status:       string;
  externalId:   string | null;
  updatedAt:    string;
}

export interface DistributorSubmissionCreatedPayload {
  tenantId:     string;
  artistId:     string;
  distributor:  string;
  submissionId: string;
  externalId:   string | null;
  createdAt:    string;
}

export interface DistributorStatusUpdatedPayload {
  tenantId:     string;
  artistId:     string;
  distributor:  string;
  submissionId: string;
  status:       string;
  externalId:   string | null;
  updatedAt:    string;
}

// ─── Transactions ─────────────────────────────────────────────────────────────

export interface TransactionCreatedPayload {
  transactionId: string;
  tenantId:      string;
  type:          string;
  categoria:     string;
  valor:         string;
  contratoId:    string | null;
  artistId:     string | null;
  createdBy:     string;
  /** Quando definido, identifica o fluxo de origem (ex.: 'contract.signed') —
   * usado para evitar disparo duplicado de financial-rules quando a criação
   * desta transação já foi causada por outro evento que também avalia regras. */
  source?:       string;
}

export interface TransactionStatusChangedPayload {
  transactionId:  string;
  tenantId:       string;
  type:           string;
  valor:          string;
  previousStatus: string;
  newStatus:      string;
  changedBy:      string;
}

export interface TransactionPaidPayload {
  transactionId: string;
  tenantId:      string;
  type:          string;
  valor:         string;
  contratoId:    string | null;
  artistId:     string | null;
  paidBy:        string;
  paidAt:        string;
}

export interface TransactionCancelledPayload {
  transactionId: string;
  tenantId:      string;
  type:          string;
  valor:         string;
  cancelledBy:   string;
  cancelledAt:   string;
}

// ─── Invoices ─────────────────────────────────────────────────────────────────

export interface InvoiceCreatedPayload {
  invoiceId:    string;
  tenantId:     string;
  type:         string;
  valor:        string;
  numero:       string | null;
  prestadorId:  string | null;
  createdBy:    string;
}

export interface InvoiceStatusChangedPayload {
  invoiceId:      string;
  tenantId:       string;
  numero:         string | null;
  previousStatus: string;
  newStatus:      string;
  changedBy:      string;
}

export interface InvoiceIssuedPayload {
  invoiceId:  string;
  tenantId:   string;
  type:       string;
  valor:      string;
  numero:     string | null;
  issuedBy:   string;
  issuedAt:   string;
}

export interface InvoiceOverduePayload {
  invoiceId:       string;
  tenantId:        string;
  numero:          string | null;
  valor:           string;
  dataVencimento:  string;
}

// ─── Financial Rules ──────────────────────────────────────────────────────────

export interface FinancialRuleTriggeredPayload {
  ruleId:     string;
  tenantId:   string;
  ruleName:   string;
  ruleType:   string;
  trigger:    string;
  entityId:   string | null;
  entityType: string | null;
  result:     Record<string, unknown>;
}

// ─── Releases ─────────────────────────────────────────────────────────────────

export interface ReleaseCreatedPayload {
  releaseId:  string;
  tenantId:   string;
  title:     string;
  type:       string;
  artistId:   string | null;
  createdBy:  string;
  createdAt:  string;
}

export interface ReleasePublishedPayload {
  releaseId:  string;
  tenantId:   string;
  title:     string;
  artistId:   string | null;
  publishedAt: string;
}

export interface ReleaseApprovedPayload {
  releaseId:  string;
  tenantId:   string;
  title:     string;
  artistId:   string | null;
  approvedBy: string;
  approvedAt: string;
}

export interface ReleaseDistributedPayload {
  releaseId:      string;
  tenantId:       string;
  title:         string;
  artistId:       string | null;
  distribuidora:  string | null;
  plataformas:    unknown[];
  distributedAt:  string;
}

// ─── Takedown ─────────────────────────────────────────────────────────────────

export interface TakedownRequestedPayload {
  takedownId:  string;
  tenantId:    string;
  entityType:  string;
  entityId:    string;
  reason:      string;
  requestedBy: string;
}

// ─── Campaigns ────────────────────────────────────────────────────────────────

export interface CampaignCreatedPayload {
  campaignId: string;
  tenantId:   string;
  title:      string;
  createdBy:  string;
}

export interface CampaignStartedPayload {
  campaignId: string;
  tenantId:   string;
  title:     string;
  startedBy:  string;
  startedAt:  string;
}

export interface CampaignEndedPayload {
  campaignId: string;
  tenantId:   string;
  title:     string;
  endedAt:    string;
}

export interface MarketingProjectCreatedPayload {
  marketingProjectId: string;
  tenantId:           string;
  type:               string;
  title:              string;
  sourceProjectId:    string | null;
  artistId:           string | null;
  campaignId:         string | null;
  createdBy:          string;
  createdAt:          string;
}

export interface CoverArtTaskCreatedPayload {
  taskId:             string;
  tenantId:           string;
  marketingProjectId: string;
  sourceProjectId:    string | null;
  title:              string;
  createdBy:          string;
  createdAt:          string;
}

export interface MarketingPlanCompletedPayload {
  marketingProjectId: string;
  tenantId:           string;
  completedBy:        string;
  completedAt:        string;
}

export interface MarketingTasksGeneratedPayload {
  marketingProjectId: string;
  tenantId:           string;
  generatedTaskIds:   string[];
  skippedActionIds:   string[];
  generatedBy:        string;
  generatedAt:        string;
}

export interface MarketingContentCreatedPayload {
  contentId: string;
  tenantId:  string;
  title:     string;
  channel:   string;
  createdBy: string;
}

// ─── Leads ────────────────────────────────────────────────────────────────────

export interface LeadConvertedPayload {
  leadId:      string;
  tenantId:    string;
  nome:        string;
  empresa:     string | null;
  convertedBy: string;
  convertedAt: string;
}

// ─── Assets / Uploads ─────────────────────────────────────────────────────────

export interface AssetUploadedPayload {
  uploadId:   string;
  tenantId:   string;
  entityType: string;
  entityId:   string;
  fileName:   string;
  mimeType:   string;
  uploadedBy: string;
  uploadedAt: string;
}

export interface AssetAvailableForContentPayload {
  assetId:            string;
  versionId:          string;
  tenantId:           string;
  marketingProjectId: string | null;
  assetType:          string;
  approvedBy:         string;
  approvedAt:         string;
}

// ─── Skills runtime + Asset Linking (Fatia 1) ────────────────────────────────

export interface SkillStartedPayload {
  skillRunId: string;
  tenantId:   string;
  skillName:  string;
  entityType: string | null;
  entityId:   string | null;
  startedAt:  string;
}

export interface SkillCompletedPayload {
  skillRunId: string;
  tenantId:   string;
  skillName:  string;
  durationMs: number;
  finishedAt: string;
}

export interface SkillFailedPayload {
  skillRunId:   string;
  tenantId:     string;
  skillName:    string;
  errorMessage: string;
  finishedAt:   string;
}

export interface AssetLinkedToProjectPayload {
  assetId:     string;
  projectId:   string;
  tenantId:    string;
  role:        string;
  sourceEvent: string;
  linkedBy:    string | null;
  linkedAt:    string;
}

export interface AssetLinkedToTaskPayload {
  assetId:     string;
  taskId:      string;
  tenantId:    string;
  role:        string;
  sourceEvent: string;
  linkedBy:    string | null;
  linkedAt:    string;
}

export interface WorkflowExecutionStartedPayload {
  executionId: string;
  tenantId:    string | null;
  ruleId:      string;
  eventType:   string;
  startedAt:   string;
}

export interface WorkflowExecutionCompletedPayload {
  executionId:      string;
  tenantId:         string | null;
  ruleId:           string;
  status:           'success' | 'partial';
  actionsSucceeded: number;
  actionsFailed:    number;
  durationMs:       number;
  finishedAt:       string;
}

export interface WorkflowExecutionFailedPayload {
  executionId:  string;
  tenantId:     string | null;
  ruleId:       string;
  errorMessage: string;
  finishedAt:   string;
}

// ─── Catalog (Works / Recordings) ─────────────────────────────────────────────

export interface CatalogWorkCreatedPayload {
  tenantId:  string;
  workId:    string;
  createdBy: string;
}

export interface CatalogRecordingCreatedPayload {
  tenantId:     string;
  recordingId:  string;
  createdBy:    string;
}

// ─── Support Tickets ──────────────────────────────────────────────────────────

export interface SupportTicketCreatedPayload {
  tenantId:  string;
  ticketId:  string;
  createdBy: string;
  category:  string | null;
  priority:  string;
}

export interface TicketResolvedPayload {
  ticketId:   string;
  tenantId:   string;
  title:     string;
  resolvedBy: string;
  resolvedAt: string;
}

// ─── Workflow ─────────────────────────────────────────────────────────────────

export interface WorkflowTransitionedPayload {
  entityType:  string;
  entityId:    string;
  tenantId:    string;
  fromStatus:  string;
  toStatus:    string;
  actorId:     string;
  actorRole:   string | undefined;
  reason:      string | null;
  transitionedAt: string;
}

// ─── Tenant / Users ───────────────────────────────────────────────────────────

export interface TenantCreatedPayload {
  tenantId: string;
  name:     string;
  slug:     string;
  plan:     string;
}

export interface UserInvitedPayload {
  tenantId:  string;
  userId:    string;
  email:     string;
  role:      string;
  invitedBy: string;
}

export interface LeadCreatedPayload {
  tenantId: string;
  leadId:   string;
  nome:     string;
  origem:   string;
}

export interface LeadUpdatedPayload {
  tenantId:      string;
  aggregateType: string;
  aggregateId:   string;
  action:        string;
}

export interface ConversationCreatedPayload {
  tenantId:      string;
  aggregateType: string;
  aggregateId:   string;
  action:        string;
}

// ─── Discriminated union over all event payloads ──────────────────────────────

export type AnyDomainEventPayload =
  | ArtistCreatedPayload
  | ArtistUpdatedPayload
  | ArtistStatusChangedPayload
  | ArtistDeletedPayload
  | ContractCreatedPayload
  | ContractStatusChangedPayload
  | ContractSentForSignaturePayload
  | ContractCancelledPayload
  | ContractExpiringSoonPayload
  | ContractSignedPayload
  | ContractExpiredPayload
  | TransactionCreatedPayload
  | TransactionStatusChangedPayload
  | TransactionPaidPayload
  | TransactionCancelledPayload
  | InvoiceCreatedPayload
  | InvoiceStatusChangedPayload
  | InvoiceIssuedPayload
  | InvoiceOverduePayload
  | FinancialRuleTriggeredPayload
  | ArtistOnboardingStartedPayload
  | DistributionSetupRequestedPayload
  | ProjectCompletedPayload
  | ExternalDataSyncRequestedPayload
  | ContractIntegrationReadyPayload
  | ReleaseCreatedPayload
  | ReleasePublishedPayload
  | ReleaseApprovedPayload
  | ReleaseDistributedPayload
  | TakedownRequestedPayload
  | CampaignCreatedPayload
  | CampaignStartedPayload
  | CampaignEndedPayload
  | MarketingProjectCreatedPayload
  | MarketingContentCreatedPayload
  | CoverArtTaskCreatedPayload
  | MarketingPlanCompletedPayload
  | MarketingTasksGeneratedPayload
  | LeadCreatedPayload
  | LeadUpdatedPayload
  | ConversationCreatedPayload
  | LeadConvertedPayload
  | AssetUploadedPayload
  | AssetAvailableForContentPayload
  | SkillStartedPayload
  | SkillCompletedPayload
  | SkillFailedPayload
  | AssetLinkedToProjectPayload
  | AssetLinkedToTaskPayload
  | WorkflowExecutionStartedPayload
  | WorkflowExecutionCompletedPayload
  | WorkflowExecutionFailedPayload
  | CatalogWorkCreatedPayload
  | CatalogRecordingCreatedPayload
  | SupportTicketCreatedPayload
  | TicketResolvedPayload
  | WorkflowTransitionedPayload
  | TenantCreatedPayload
  | UserInvitedPayload
  | DistributionSyncStartedPayload
  | DistributionSyncCompletedPayload
  | DistributionSyncFailedPayload
  | ExternalDataSyncStartedPayload
  | ExternalDataSyncCompletedPayload
  | ExternalDataSyncFailedPayload
  | SocietySubmissionCreatedPayload
  | SocietyStatusUpdatedPayload
  | DistributorSubmissionCreatedPayload
  | DistributorStatusUpdatedPayload;
