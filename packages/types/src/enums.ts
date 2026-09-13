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
 * SystemRole — roles hierárquicos de sistema (armazenados em OrgMemberEntity.role).
 * Alinhado com roles.guard.ts ROLE_HIERARCHY.
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
 * FunctionalRole — roles funcionais/domínio usados no RBAC service.
 * Não são roles de sistema; representam funções operacionais dentro do tenant.
 * Inclui todos os roles de negócio presentes no frontend (auth.ts AppRole).
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

/** Union de todos os roles reconhecidos pelo sistema */
export type AnyRole = SystemRole | FunctionalRole;

// ─── Artistas ─────────────────────────────────────────────────────────────────

/**
 * ArtistStatus — superset de todos os status possíveis para artistas.
 * Cobre status de cadastro geral (active/inactive) e status de relacionamento
 * contratual (signed/in_negotiation/onboarding).
 * Frontend deriva: type ArtistaStatus = `${ArtistStatus}`
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
 * ArtistRelationshipType — classificação do vínculo contratual do artista
 * (nunca persistida; computada em runtime a partir de `contracts.exclusivo`
 * + status de contrato ativo — ver `ArtistsService.vinculoStats`). Fonte
 * única: antes duplicada como union type PT solto em 6 lugares (backend
 * service x3, DTO, e frontend types/labels x2).
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

// ─── Catálogo — Obras ─────────────────────────────────────────────────────────

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

// ─── Catálogo — Fonogramas ────────────────────────────────────────────────────

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

// ─── Releases (Lançamentos) ───────────────────────────────────────────────────

/**
 * ReleaseStatus — ciclo de vida de um lançamento musical.
 * Conforme spec: draft → metadata_pending → assets_pending → review → approved →
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

// ─── Shares (Participações) ───────────────────────────────────────────────────

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

// ─── RH / Funcionários ────────────────────────────────────────────────────────

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

// ─── Integrações ─────────────────────────────────────────────────────────────

export enum IntegrationStatus {
  DISCONNECTED = "disconnected",
  CONNECTING   = "connecting",
  CONNECTED    = "connected",
  ERROR        = "error",
  DISABLED     = "disabled",
}

/**
 * Classificação arquitetural de uma integração. Separa conceitos que NUNCA
 * podem substituir uns aos outros (wave de refatoração 2026-08-24):
 *
 *   A. PUBLIC ARTIST DATA — métricas públicas de artista (Spotify, YouTube,
 *      Deezer…). NÃO vive neste catálogo: chega via Soundcharts e é
 *      normalizada em artists/platform-profiles. Não é conectável pelo cliente.
 *   B. INTERNAL_PLATFORM  — o MUSIC OS 360 usa com credenciais DA PLATAFORMA.
 *      O cliente não conecta, não configura e não deve vê-las no catálogo
 *      comercial (Soundcharts, ACRCloud, Resend).
 *   C. COMMERCIAL         — o CLIENTE conecta a própria conta. Governadas por
 *      publicação + audiência + entitlement do plano + capacidade técnica.
 *   D. COMMERCIAL_FUTURE  — comerciais por natureza, mas ainda sem adapter
 *      real. Existem para governança/roadmap; nunca utilizáveis.
 *   E. PLATFORM_BILLING   — infraestrutura de cobrança da própria plataforma
 *      (Stripe). Não é integração de cliente nem entitlement.
 */
export enum IntegrationClassification {
  INTERNAL_PLATFORM = "internal_platform",
  COMMERCIAL        = "commercial",
  PLATFORM_BILLING  = "platform_billing",
}

/**
 * Só COMMERCIAL participa de catálogo comercial, entitlement de plano e da tela
 * de governança client-facing. "Futuro" NÃO é uma classificação: um provedor
 * comercial ainda não operacional é COMMERCIAL com technicalState=PLANNED e
 * publication=COMING_SOON.
 */
export const CUSTOMER_FACING_CLASSIFICATIONS: readonly IntegrationClassification[] = [
  IntegrationClassification.COMMERCIAL,
];

/**
 * Estado TÉCNICO/operacional do adapter — governado pelo admin, distinto da
 * capacidade em código (existe adapter?) e da publicação (rollout comercial).
 * Nunca reduzir a um booleano `enabled`.
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

/** Estados técnicos em que o provedor pode de facto operar. */
export const OPERATIONAL_TECHNICAL_STATES: readonly IntegrationTechnicalState[] = [
  IntegrationTechnicalState.READY,
  IntegrationTechnicalState.HOMOLOGATING,
  IntegrationTechnicalState.DEGRADED,
];

/** Rollout comercial — separado de técnico, entitlement e conexão. */
export enum IntegrationPublicationState {
  HIDDEN                  = "hidden",
  COMING_SOON             = "coming_soon",
  BETA                    = "beta",
  AVAILABLE               = "available",
  TEMPORARILY_UNAVAILABLE = "temporarily_unavailable",
}

/**
 * Reason codes ESTÁVEIS. O frontend ramifica por estes valores — nunca por
 * texto humano.
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
 * Chave dentro de `billing_plans.features` que guarda a lista DINÂMICA de slugs
 * comerciais incluídos no plano. Estrutura genérica de propósito: adicionar uma
 * integração comercial nova não exige schema nem código por provedor.
 *
 *   billing_plans.features = { ..., "integrations": ["docusign","whatsapp"] }
 */
export const PLAN_INTEGRATIONS_FEATURE_KEY = "integrations";

/**
 * Estado de governança de um PROVEDOR EXTERNO (serviço de terceiros que um
 * tenant conecta com credenciais próprias). Distinto de IntegrationStatus, que
 * é o valor persistido na coluna `integrations.status`: este aqui é derivado
 * pelo backend a partir do estado real (pré-requisitos de plataforma +
 * credenciais do tenant + saúde da última chamada) e é o contrato que o
 * frontend consome.
 *
 * NÃO usar para módulos internos/infraestrutura (storage, filas, observabilidade,
 * IA interna, CRM/financeiro/suporte internos) — governança externa cobre só
 * quem é, de facto, um provedor de terceiros.
 *
 * O frontend deve ramificar por ESTES valores, nunca por texto humano.
 */
export enum ExternalProviderStatus {
  /** Pré-requisito de plataforma ausente (ex.: credenciais de app no ambiente) — o tenant não consegue sequer tentar conectar. */
  DEPENDENCY_NOT_MET      = "dependency_not_met",
  /** Pré-requisitos satisfeitos, mas este tenant ainda não conectou. */
  AVAILABLE_NOT_CONNECTED = "available_not_connected",
  /** Conectado e sem falha registada. */
  CONNECTED               = "connected",
  /** Token expirado/revogado — precisa de nova autorização. */
  REQUIRES_REAUTH         = "requires_reauth",
  /** Conectado, mas a última interação com o provedor falhou. */
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
