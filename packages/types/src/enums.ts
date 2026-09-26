// ─── Tenant / Billing ─────────────────────────────────────────────────────────

export enum TenantPlan {
  STARTER      = "starter",
  PROFESSIONAL = "professional",
  ENTERPRISE   = "enterprise",
}

export enum BillingStatus {
  TRIAL    = "trial",
  ACTIVE   = "active",
  PAST_DUE = "past_due",
  CANCELED = "canceled",
  UNPAID   = "unpaid",
}

// ─── RBAC — System Roles (stored in org_members.role) ────────────────────────

/**
 * SystemRole — hierarchical system roles (stored in OrgMemberEntity.role).
 * Aligned with roles.guard.ts ROLE_HIERARCHY.
 */
export enum SystemRole {
  SUPER_ADMIN  = "super_admin",
  TENANT_OWNER = "tenant_owner",
  OWNER        = "owner",
  ADMIN        = "admin",
  EDITOR       = "editor",
  MANAGER      = "manager",
  VIEWER       = "viewer",
}

/**
 * FunctionalRole — functional/domain roles used in the RBAC service.
 * They are not system roles; they represent operational functions within the tenant.
 * Includes every business role present in the frontend (auth.ts AppRole).
 */
export enum FunctionalRole {
  FINANCIAL          = "financial",
  ACCOUNTING         = "accounting",
  JURIDICO           = "juridico",
  MARKETING          = "marketing",
  MARKETING_MANAGER  = "marketing_manager",
  ARTIST             = "artist",
  ARTISTA            = "artista",
  PRODUTOR           = "produtor",
  COMERCIAL          = "comercial",
  COLABORADOR        = "colaborador",
  RH_MANAGER         = "rh_manager",
  RADIO              = "radio",
  TV                 = "tv",
}

/** Union of every role recognized by the system */
export type AnyRole = SystemRole | FunctionalRole;

// ─── Artistas ─────────────────────────────────────────────────────────────────

/**
 * ArtistStatus — superset of every possible artist status.
 * Covers the general registration status (active/inactive) and the contractual
 * relationship status (signed/in_negotiation/onboarding).
 * The frontend derives: type ArtistaStatus = `${ArtistStatus}`
 */
export enum ArtistStatus {
  SIGNED         = "signed",
  ACTIVE         = "active",
  INACTIVE       = "inactive",
  PROSPECT       = "prospect",
  TERMINATED     = "terminated",
  SUSPENDED      = "suspended",
  FORMER_ARTIST  = "former_artist",
  IN_NEGOTIATION = "in_negotiation",
  ONBOARDING     = "onboarding",
}

export enum ArtistStatusCadastro {
  ACTIVE    = "active",
  INACTIVE  = "inactive",
  SUSPENDED = "suspended",
}

/**
 * ArtistRelationshipType — classification of the artist's contractual link
 * (never persisted; computed at runtime from `contracts.exclusivo`
 * + the active contract status — see `ArtistsService.vinculoStats`). Single
 * source: previously duplicated as a loose PT union type in 6 places (backend
 * service x3, DTO, and frontend types/labels x2).
 */
export enum ArtistRelationshipType {
  EXCLUSIVE   = "exclusive",
  PARTNER     = "partner",
  INDEPENDENT = "independent",
}

// ─── Contratos ────────────────────────────────────────────────────────────────

/**
 * ContractStatus — lifecycle of a contract.
 * Covers every pipeline state: draft → active → expiring → terminated.
 * ACTIVE and IN_FORCE are distinct pipeline states (signed-but-not-yet-effective
 * vs. currently in force) and are kept as separate, unambiguous members.
 */
export enum ContractStatus {
  DRAFT               = "draft",
  UNDER_REVIEW        = "under_review",
  AWAITING_SIGNATURE  = "awaiting_signature",
  SIGNED              = "signed",
  ACTIVE              = "active",
  IN_FORCE            = "in_force",
  EXPIRING            = "expiring",
  EXPIRED             = "expired",
  TERMINATED          = "terminated",
  CANCELLED           = "cancelled",
}

// ─── Catalog — Works ───────────────────────────────────────────────────────────

/**
 * WorkStatus — lifecycle of a musical work.
 * UNDER_REVIEW and IN_REVIEW are kept as a superset for compatibility with
 * legacy frontend/backend data.
 */
export enum WorkStatus {
  PENDING      = "pending",
  UNDER_REVIEW = "under_review",
  IN_REVIEW    = "in_review",
  REGISTERED   = "registered",
  ACTIVE       = "active",
  INACTIVE     = "inactive",
  REJECTED     = "rejected",
  ARCHIVED     = "archived",
}

// ─── Catalog — Phonograms ─────────────────────────────────────────────────────

/**
 * PhonogramStatus — lifecycle of a phonogram.
 * Same superset strategy as WorkStatus.
 */
export enum PhonogramStatus {
  PENDING      = "pending",
  UNDER_REVIEW = "under_review",
  IN_REVIEW    = "in_review",
  REGISTERED   = "registered",
  ACTIVE       = "active",
  INACTIVE     = "inactive",
  REJECTED     = "rejected",
  ARCHIVED     = "archived",
}

// ─── Releases ─────────────────────────────────────────────────────────────────

/**
 * ReleaseStatus — lifecycle of a music release.
 * Per spec: draft → metadata_pending → assets_pending → review → approved →
 *                scheduled → distributed → released → archived / cancelled
 */
export enum ReleaseStatus {
  DRAFT            = "draft",
  METADATA_PENDING = "metadata_pending",
  ASSETS_PENDING   = "assets_pending",
  REVIEW           = "review",
  APPROVED         = "approved",
  SCHEDULED        = "scheduled",
  DISTRIBUTED      = "distributed",
  RELEASED         = "released",
  ARCHIVED         = "archived",
  CANCELLED        = "cancelled",
}

// ─── Shares ───────────────────────────────────────────────────────────────────

export enum ShareStatus {
  ACTIVE   = "active",
  INACTIVE = "inactive",
  PENDING  = "pending",
  SETTLED  = "settled",
}

// ─── Financeiro / Accounting ──────────────────────────────────────────────────

export enum TransactionType {
  RECEITA = "receita",
  DESPESA = "despesa",
}

/**
 * TransactionStatus — state of a financial transaction.
 * Includes "completed" (frontend) and "confirmed" (backend) as a superset.
 * PAID is a third historically-distinct synonym for "money settled" (was
 * PT-BR `pago`), treated identically to COMPLETED/CONFIRMED by every
 * consumer (transactions.service.ts, analytics.service.ts) — kept as its
 * own member rather than merged into COMPLETED/CONFIRMED because collapsing
 * three pre-existing values into one is a data-model decision beyond a
 * PT->EN naming translation.
 */
export enum TransactionStatus {
  PENDING   = "pending",
  COMPLETED = "completed",
  CONFIRMED = "confirmed",
  PAID      = "paid",
  CANCELLED = "cancelled",
  SCHEDULED = "scheduled",
}

// ─── Notas Fiscais (Invoices) ─────────────────────────────────────────────────

/**
 * InvoiceStatus — state of an invoice.
 * Superset: includes frontend states (draft/issued/rejected) and backend states (paid/overdue).
 */
export enum InvoiceStatus {
  DRAFT     = "draft",
  PENDING   = "pending",
  ISSUED    = "issued",
  PAID      = "paid",
  CANCELLED = "cancelled",
  OVERDUE   = "overdue",
  REJECTED  = "rejected",
}

// ─── CRM ──────────────────────────────────────────────────────────────────────

/**
 * LeadStatus — pipeline of a CRM lead.
 * Includes "in_contact" (frontend) and "contacted"/"qualified" (backend).
 */
export enum LeadStatus {
  NEW         = "new",
  IN_CONTACT  = "in_contact",
  CONTACTED   = "contacted",
  QUALIFIED   = "qualified",
  PROPOSAL    = "proposal",
  NEGOTIATION = "negotiation",
  CLOSED      = "closed",
  LOST        = "lost",
  INACTIVE    = "inactive",
}

export enum ClientStatus {
  ACTIVE   = "active",
  INACTIVE = "inactive",
  PROSPECT = "prospect",
}

// ─── Marketing / Campanhas ────────────────────────────────────────────────────

export enum CampaignStatus {
  DRAFT     = "draft",
  PLANNING  = "planning",
  ACTIVE    = "active",
  PAUSED    = "paused",
  COMPLETED = "completed",
  CANCELLED = "cancelled",
}

export enum BriefingStatus {
  DRAFT       = "draft",
  IN_PROGRESS = "in_progress",
  REVIEW      = "review",
  APPROVED    = "approved",
  COMPLETED   = "completed",
  CANCELLED   = "cancelled",
}

// ─── Monitoramento ────────────────────────────────────────────────────────────

/**
 * TakedownStatus — state of a takedown process.
 * Superset: includes "sent"/"processing"/"failed" (frontend) and "in_progress"/"completed" (backend).
 */
export enum TakedownStatus {
  PENDING     = "pending",
  SENT        = "sent",
  PROCESSING  = "processing",
  IN_PROGRESS = "in_progress",
  COMPLETED   = "completed",
  REJECTED    = "rejected",
  FAILED      = "failed",
}

export enum ContentDetectionStatus {
  PENDING     = "pending",
  IN_PROGRESS = "in_progress",
  COMPLETED   = "completed",
  REJECTED    = "rejected",
  ARCHIVED    = "archived",
}

// ─── Projetos ────────────────────────────────────────────────────────────────

/**
 * ProjectStatus — lifecycle of a music project.
 * Per spec: planning → in_progress → review → completed / cancelled
 */
export enum ProjectStatus {
  PLANNING    = "planning",
  IN_PROGRESS = "in_progress",
  REVIEW      = "review",
  COMPLETED   = "completed",
  CANCELLED   = "cancelled",
}

// ─── Eventos ─────────────────────────────────────────────────────────────────

/**
 * EventStatus — state of an event.
 * Superset: includes "planned"/"completed"/"postponed" (frontend) and "scheduled"/"held" (backend).
 */
export enum EventStatus {
  PLANNED    = "planned",
  SCHEDULED  = "scheduled",
  CONFIRMED  = "confirmed",
  HELD       = "held",
  COMPLETED  = "completed",
  CANCELLED  = "cancelled",
  POSTPONED  = "postponed",
}

// ─── HR / Employees ───────────────────────────────────────────────────────────

export enum EmployeeStatus {
  ACTIVE      = "active",
  INACTIVE    = "inactive",
  ON_VACATION = "on_vacation",
  ON_LEAVE    = "on_leave",
  TERMINATED  = "terminated",
}

export enum PayrollStatus {
  PENDING   = "pending",
  PROCESSED = "processed",
  PAID      = "paid",
  CANCELLED = "cancelled",
}

export enum LeaveRequestStatus {
  PENDING   = "pending",
  APPROVED  = "approved",
  REJECTED  = "rejected",
  COMPLETED = "completed",
}

// ─── Uploads / Media ─────────────────────────────────────────────────────────

export enum UploadStatus {
  PENDING    = "pending",
  PROCESSING = "processing",
  READY      = "ready",
  ERROR      = "error",
  DELETED    = "deleted",
}

// ─── Integrations ─────────────────────────────────────────────────────────────

export enum IntegrationStatus {
  DISCONNECTED = "disconnected",
  CONNECTING   = "connecting",
  CONNECTED    = "connected",
  ERROR        = "error",
  DISABLED     = "disabled",
}

/**
 * Architectural classification of an integration. Separates concepts that can
 * NEVER replace one another (refactoring wave 2026-08-24):
 *
 *   A. PUBLIC ARTIST DATA — public artist metrics (Spotify, YouTube,
 *      Deezer…). It does NOT live in this catalog: it arrives via Soundcharts and is
 *      normalized in artists/platform-profiles. Not connectable by the customer.
 *   B. INTERNAL_PLATFORM  — MUSIC OS 360 uses it with THE PLATFORM's credentials.
 *      The customer does not connect, does not configure and must not see them in the
 *      commercial catalog (Soundcharts, ACRCloud, Resend).
 *   C. COMMERCIAL         — the CUSTOMER connects their own account. Governed by
 *      publication + audience + plan entitlement + technical capability.
 *   D. COMMERCIAL_FUTURE  — commercial by nature, but still without a real
 *      adapter. They exist for governance/roadmap; never usable.
 *   E. PLATFORM_BILLING   — the platform's own billing infrastructure
 *      (Stripe). Neither a customer integration nor an entitlement.
 */
export enum IntegrationClassification {
  INTERNAL_PLATFORM = "internal_platform",
  COMMERCIAL        = "commercial",
  PLATFORM_BILLING  = "platform_billing",
}

/**
 * Only COMMERCIAL takes part in the commercial catalog, plan entitlement and the
 * client-facing governance screen. "Future" is NOT a classification: a
 * commercial provider not yet operational is COMMERCIAL with technicalState=PLANNED and
 * publication=COMING_SOON.
 */
export const CUSTOMER_FACING_CLASSIFICATIONS: readonly IntegrationClassification[] = [
  IntegrationClassification.COMMERCIAL,
];

/**
 * TECHNICAL/operational state of the adapter — governed by the admin, distinct from the
 * in-code capability (does an adapter exist?) and from publication (commercial rollout).
 * Never reduce it to an `enabled` boolean.
 */
export enum IntegrationTechnicalState {
  PLANNED           = "planned",
  IN_DEVELOPMENT    = "in_development",
  CONFIGURING       = "configuring",
  AWAITING_PROVIDER = "awaiting_provider",
  HOMOLOGATING      = "homologating",
  READY             = "ready",
  DEGRADED          = "degraded",
  DISABLED          = "disabled",
  RETIRED           = "retired",
}

/** Technical states in which the provider can actually operate. */
export const OPERATIONAL_TECHNICAL_STATES: readonly IntegrationTechnicalState[] = [
  IntegrationTechnicalState.READY,
  IntegrationTechnicalState.HOMOLOGATING,
  IntegrationTechnicalState.DEGRADED,
];

/** Commercial rollout — separate from technical state, entitlement and connection. */
export enum IntegrationPublicationState {
  HIDDEN                  = "hidden",
  COMING_SOON             = "coming_soon",
  BETA                    = "beta",
  AVAILABLE               = "available",
  TEMPORARILY_UNAVAILABLE = "temporarily_unavailable",
}

/**
 * STABLE reason codes. The frontend branches on these values — never on
 * human text.
 */
export enum IntegrationReasonCode {
  HIDDEN                  = "HIDDEN",
  COMING_SOON             = "COMING_SOON",
  TECHNICAL_NOT_READY     = "TECHNICAL_NOT_READY",
  TEMPORARILY_UNAVAILABLE = "TEMPORARILY_UNAVAILABLE",
  AUDIENCE_NOT_ALLOWED    = "AUDIENCE_NOT_ALLOWED",
  PLAN_NOT_INCLUDED       = "PLAN_NOT_INCLUDED",
  NOT_CONNECTED           = "NOT_CONNECTED",
  CONNECTED               = "CONNECTED",
  REQUIRES_REAUTH         = "REQUIRES_REAUTH",
  PROVIDER_ERROR          = "PROVIDER_ERROR",
  NOT_IMPLEMENTED         = "NOT_IMPLEMENTED",
  NOT_CUSTOMER_FACING     = "NOT_CUSTOMER_FACING",
}

/**
 * Key inside `billing_plans.features` that holds the DYNAMIC list of commercial
 * slugs included in the plan. A generic structure on purpose: adding a new
 * commercial integration requires neither schema nor per-provider code.
 *
 *   billing_plans.features = { ..., "integrations": ["docusign","whatsapp"] }
 */
export const PLAN_INTEGRATIONS_FEATURE_KEY = "integrations";

/**
 * Governance state of an EXTERNAL PROVIDER (a third-party service a
 * tenant connects with its own credentials). Distinct from IntegrationStatus, which
 * is the value persisted in the `integrations.status` column: this one is derived
 * by the backend from the real state (platform prerequisites +
 * tenant credentials + health of the last call) and is the contract the
 * frontend consumes.
 *
 * Do NOT use for internal/infrastructure modules (storage, queues, observability,
 * internal AI, internal CRM/finance/support) — external governance only covers
 * what really is a third-party provider.
 *
 * The frontend must branch on THESE values, never on human text.
 */
export enum ExternalProviderStatus {
  /** Missing platform prerequisite (e.g. app credentials in the environment) — the tenant cannot even try to connect. */
  DEPENDENCY_NOT_MET      = "dependency_not_met",
  /** Prerequisites satisfied, but this tenant has not connected yet. */
  AVAILABLE_NOT_CONNECTED = "available_not_connected",
  /** Connected and without a recorded failure. */
  CONNECTED               = "connected",
  /** Expired/revoked token — needs a new authorization. */
  REQUIRES_REAUTH         = "requires_reauth",
  /** Connected, but the last interaction with the provider failed. */
  PROVIDER_ERROR          = "provider_error",
}

// ─── Webhooks ─────────────────────────────────────────────────────────────────

export enum WebhookEventStatus {
  PENDING   = "pending",
  PROCESSED = "processed",
  FAILED    = "failed",
  SKIPPED   = "skipped",
}

// ─── Support Tickets ─────────────────────────────────────────────────────────

export enum SupportTicketStatus {
  OPEN         = "open",
  IN_PROGRESS  = "in_progress",
  PENDING_USER = "pending_user",
  RESOLVED     = "resolved",
  CLOSED       = "closed",
  CANCELLED    = "cancelled",
}

export enum SupportTicketPriority {
  LOW      = "low",
  MEDIUM   = "medium",
  HIGH     = "high",
  CRITICAL = "critical",
}

// ─── AI Jobs ─────────────────────────────────────────────────────────────────

export enum AIJobStatus {
  PENDING    = "pending",
  PROCESSING = "processing",
  COMPLETED  = "completed",
  FAILED     = "failed",
  CANCELLED  = "cancelled",
}

// ─── ECAD / Reports ──────────────────────────────────────────────────────────

export enum EcadReportStatus {
  PENDENTE  = "pendente",
  IMPORTADO = "importado",
  CONCLUIDO = "concluido",
  ERRO      = "erro",
}

// ─── Artist Goals ─────────────────────────────────────────────────────────────

export enum ArtistGoalStatus {
  IN_PROGRESS = "in_progress",
  COMPLETED   = "completed",
  CANCELLED   = "cancelled",
  EXPIRED     = "expired",
}

// ─── Notifications ────────────────────────────────────────────────────────────

export enum NotificationType {
  INFO    = "info",
  WARNING = "warning",
  ERROR   = "error",
  SUCCESS = "success",
}

// ─── Pricing / Quotes ─────────────────────────────────────────────────────────

export enum QuoteStatus {
  DRAFT             = "draft",
  SIMULATED         = "simulated",
  PENDING_APPROVAL  = "pending_approval",
  APPROVED          = "approved",
  SENT              = "sent",
  ACCEPTED          = "accepted",
  REJECTED          = "rejected",
  EXPIRED           = "expired",
}

export enum PricingVariableType {
  NUMBER     = "number",
  CURRENCY   = "currency",
  PERCENTAGE = "percentage",
  BOOLEAN    = "boolean",
  SELECT     = "select",
}

export enum PricingRuleCategory {
  CUSTO     = "custo",
  IMPOSTO   = "imposto",
  COMISSAO  = "comissao",
  DESCONTO  = "desconto",
  MARGEM    = "margem",
  ADICIONAL = "adicional",
  CUSTOM    = "custom",
}

export enum QuoteApprovalAction {
  SUBMIT  = "submit",
  APPROVE = "approve",
  REJECT  = "reject",
  REVOKE  = "revoke",
}

// ─── Registro Musical / Society Integration (ABRAMUS / ECAD) ──────────────────
//
// Registry status is intentionally SEPARATE from the editorial WorkStatus /
// PhonogramStatus. Values are UPPER_SNAKE to map cleanly onto society payloads.

export enum RegistryStatus {
  DRAFT                = "DRAFT",
  READY_FOR_VALIDATION = "READY_FOR_VALIDATION",
  VALIDATED            = "VALIDATED",
  READY_TO_SUBMIT      = "READY_TO_SUBMIT",
  SUBMITTED            = "SUBMITTED",
  PROCESSING           = "PROCESSING",
  APPROVED             = "APPROVED",
  REJECTED             = "REJECTED",
  REQUIRES_CORRECTION  = "REQUIRES_CORRECTION",
  FAILED               = "FAILED",
  ARCHIVED             = "ARCHIVED",
}

/** Entities that can be registered / identified / submitted. */
export enum RegistrableEntityType {
  WORK          = "WORK",
  RECORDING     = "RECORDING",
  RIGHTS_HOLDER = "RIGHTS_HOLDER",
  RELEASE       = "RELEASE",
  SUBMISSION    = "SUBMISSION",
}

export enum HolderType {
  AUTHOR                = "AUTHOR",
  COMPOSER              = "COMPOSER",
  PUBLISHER             = "PUBLISHER",
  INTERPRETER           = "INTERPRETER",
  MUSICIAN              = "MUSICIAN",
  PHONOGRAPHIC_PRODUCER = "PHONOGRAPHIC_PRODUCER",
  LABEL                 = "LABEL",
  ARRANGER              = "ARRANGER",
  ADAPTER               = "ADAPTER",
  TRANSLATOR            = "TRANSLATOR",
  OTHER                 = "OTHER",
}

export enum HolderDocumentType {
  CPF      = "CPF",
  CNPJ     = "CNPJ",
  PASSPORT = "PASSPORT",
  OTHER    = "OTHER",
  NONE     = "NONE",
}

/** Authorship split roles (work side). */
export enum SplitRole {
  COMPOSER      = "COMPOSER",
  AUTHOR        = "AUTHOR",
  LYRICIST      = "LYRICIST",
  ARRANGER      = "ARRANGER",
  ADAPTER       = "ADAPTER",
  TRANSLATOR    = "TRANSLATOR",
  PUBLISHER     = "PUBLISHER",
  SUB_PUBLISHER = "SUB_PUBLISHER",
}

/** Recording participant roles (phonogram side). */
export enum RecordingContributorRole {
  MAIN_ARTIST           = "MAIN_ARTIST",
  FEATURED_ARTIST       = "FEATURED_ARTIST",
  INTERPRETER           = "INTERPRETER",
  MUSICIAN              = "MUSICIAN",
  PRODUCER              = "PRODUCER",
  PHONOGRAPHIC_PRODUCER = "PHONOGRAPHIC_PRODUCER",
  ARRANGER              = "ARRANGER",
  MIXING_ENGINEER       = "MIXING_ENGINEER",
  MASTERING_ENGINEER    = "MASTERING_ENGINEER",
  SESSION_MUSICIAN      = "SESSION_MUSICIAN",
  BACKING_VOCAL         = "BACKING_VOCAL",
  OTHER                 = "OTHER",
}

export enum IdentifierProvider {
  ABRAMUS    = "ABRAMUS",
  ECAD       = "ECAD",
  CISAC      = "CISAC",
  IFPI       = "IFPI",
  PRO_MUSICA = "PRO_MUSICA",
  ISRC       = "ISRC",
  INTERNAL   = "INTERNAL",
  OTHER      = "OTHER",
}

export enum IdentifierType {
  ISWC                = "ISWC",
  ISRC                = "ISRC",
  IPI_CAE             = "IPI_CAE",
  ECAD_WORK_CODE      = "ECAD_WORK_CODE",
  ABRAMUS_PROTOCOL    = "ABRAMUS_PROTOCOL",
  SOCIETY_MEMBER_CODE = "SOCIETY_MEMBER_CODE",
  CATALOG_NUMBER      = "CATALOG_NUMBER",
  UPC                 = "UPC",
  EAN                 = "EAN",
  OTHER               = "OTHER",
}

export enum SocietyName {
  ABRAMUS  = "ABRAMUS",
  ECAD     = "ECAD",
  UBC      = "UBC",
  SBACEM   = "SBACEM",
  AMAR     = "AMAR",
  SICAM    = "SICAM",
  SOCINPRO = "SOCINPRO",
  ASSIM    = "ASSIM",
  OTHER    = "OTHER",
}

/**
 * How a submission reaches the society. Only MANUAL_EXPORT is functional;
 * PARTNER_API and PORTAL_RPA are stubs, disabled by default (env-gated).
 */
export enum SocietyDriver {
  MANUAL_EXPORT = "MANUAL_EXPORT",
  PARTNER_API   = "PARTNER_API",
  PORTAL_RPA    = "PORTAL_RPA",
}

export enum SocietyAccountStatus {
  ACTIVE   = "ACTIVE",
  INACTIVE = "INACTIVE",
  PENDING  = "PENDING",
  ERROR    = "ERROR",
}

export enum SocietySubmissionStatus {
  DRAFT               = "DRAFT",
  VALIDATING          = "VALIDATING",
  VALID               = "VALID",
  INVALID             = "INVALID",
  READY               = "READY",
  EXPORTED            = "EXPORTED",
  SUBMITTED           = "SUBMITTED",
  PROCESSING          = "PROCESSING",
  APPROVED            = "APPROVED",
  REJECTED            = "REJECTED",
  REQUIRES_CORRECTION = "REQUIRES_CORRECTION",
  FAILED              = "FAILED",
  CANCELLED           = "CANCELLED",
}

export enum SocietySubmissionEventType {
  CREATED              = "CREATED",
  VALIDATED            = "VALIDATED",
  PAYLOAD_GENERATED    = "PAYLOAD_GENERATED",
  EXPORTED             = "EXPORTED",
  SUBMITTED            = "SUBMITTED",
  STATUS_CHANGED       = "STATUS_CHANGED",
  PROTOCOL_ASSIGNED    = "PROTOCOL_ASSIGNED",
  APPROVED             = "APPROVED",
  REJECTED             = "REJECTED",
  CORRECTION_REQUESTED = "CORRECTION_REQUESTED",
  FAILED               = "FAILED",
  RESYNCED             = "RESYNCED",
  NOTE                 = "NOTE",
}

export enum SocietyValidationSeverity {
  ERROR   = "ERROR",
  WARNING = "WARNING",
  INFO    = "INFO",
}

export enum SocietySyncJobStatus {
  PENDING   = "PENDING",
  RUNNING   = "RUNNING",
  SUCCESS   = "SUCCESS",
  FAILED    = "FAILED",
  CANCELLED = "CANCELLED",
}
