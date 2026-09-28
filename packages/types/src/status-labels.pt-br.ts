/**
 * status-labels.pt-br.ts — single source of the end-user (PT-BR) labels of the
 * canonical status enums.
 *
 * Status VALUES are technical (English, stable, persisted); this module is the
 * only place that turns them into Brazilian Portuguese copy. Every map is typed
 * `Record<Enum, string>`, so adding an enum member without a label fails to
 * compile. Consumers: API notification titles and the web StatusBadge.
 */
import {
  AIJobStatus,
  ArtistGoalStatus,
  ArtistStatus,
  BillingStatus,
  BriefingStatus,
  CampaignStatus,
  ClientStatus,
  ContentDetectionStatus,
  ContractStatus,
  EcadReportStatus,
  EmployeeStatus,
  EventStatus,
  InventoryStatus,
  InvoiceStatus,
  LeadStatus,
  LicenseStatus,
  LeaveRequestStatus,
  PayrollStatus,
  PhonogramStatus,
  ProjectStatus,
  QuoteStatus,
  ReleaseStatus,
  ShareStatus,
  SupportTicketStatus,
  TakedownStatus,
  TransactionStatus,
  TransactionType,
  UploadStatus,
  WorkStatus,
} from "./enums";

export const ARTIST_STATUS_LABELS_PT_BR: Readonly<Record<ArtistStatus, string>> = {
  [ArtistStatus.SIGNED]: "Contratado",
  [ArtistStatus.ACTIVE]: "Ativo",
  [ArtistStatus.INACTIVE]: "Inativo",
  [ArtistStatus.PROSPECT]: "Prospecto",
  [ArtistStatus.TERMINATED]: "Desligado",
  [ArtistStatus.SUSPENDED]: "Suspenso",
  [ArtistStatus.FORMER_ARTIST]: "Ex-artista",
  [ArtistStatus.IN_NEGOTIATION]: "Em negociação",
  [ArtistStatus.ONBOARDING]: "Em onboarding",
};

export const CONTRACT_STATUS_LABELS_PT_BR: Readonly<Record<ContractStatus, string>> = {
  [ContractStatus.DRAFT]: "Rascunho",
  [ContractStatus.UNDER_REVIEW]: "Em análise",
  [ContractStatus.AWAITING_SIGNATURE]: "Aguardando assinatura",
  [ContractStatus.SIGNED]: "Assinado",
  [ContractStatus.ACTIVE]: "Ativo",
  [ContractStatus.IN_FORCE]: "Vigente",
  [ContractStatus.EXPIRING]: "Vencendo",
  [ContractStatus.EXPIRED]: "Vencido",
  [ContractStatus.TERMINATED]: "Encerrado",
  [ContractStatus.CANCELLED]: "Cancelado",
};

const CATALOG_REGISTRATION_LABELS = {
  pending: "Pendente",
  under_review: "Em análise",
  in_review: "Em análise",
  registered: "Registrado",
  active: "Ativo",
  inactive: "Inativo",
  rejected: "Rejeitado",
  archived: "Arquivado",
} as const;

export const WORK_STATUS_LABELS_PT_BR: Readonly<Record<WorkStatus, string>> = CATALOG_REGISTRATION_LABELS;
export const PHONOGRAM_STATUS_LABELS_PT_BR: Readonly<Record<PhonogramStatus, string>> = CATALOG_REGISTRATION_LABELS;

export const RELEASE_STATUS_LABELS_PT_BR: Readonly<Record<ReleaseStatus, string>> = {
  [ReleaseStatus.DRAFT]: "Rascunho",
  [ReleaseStatus.METADATA_PENDING]: "Metadados pendentes",
  [ReleaseStatus.ASSETS_PENDING]: "Materiais pendentes",
  [ReleaseStatus.REVIEW]: "Em revisão",
  [ReleaseStatus.APPROVED]: "Aprovado",
  [ReleaseStatus.SCHEDULED]: "Agendado",
  [ReleaseStatus.DISTRIBUTED]: "Distribuído",
  [ReleaseStatus.RELEASED]: "Lançado",
  [ReleaseStatus.ARCHIVED]: "Arquivado",
  [ReleaseStatus.CANCELLED]: "Cancelado",
};

export const SHARE_STATUS_LABELS_PT_BR: Readonly<Record<ShareStatus, string>> = {
  [ShareStatus.ACTIVE]: "Ativo",
  [ShareStatus.INACTIVE]: "Inativo",
  [ShareStatus.PENDING]: "Pendente",
  [ShareStatus.SETTLED]: "Liquidado",
  [ShareStatus.PARTIAL]: "Parcial",
  [ShareStatus.SENT]: "Enviado",
  [ShareStatus.ACCEPTED]: "Aceito",
  [ShareStatus.RECEIVED]: "Recebido",
  [ShareStatus.REFUSED]: "Recusado",
  [ShareStatus.ERROR]: "Erro",
  [ShareStatus.CANCELLED]: "Cancelado",
};

export const TRANSACTION_STATUS_LABELS_PT_BR: Readonly<Record<TransactionStatus, string>> = {
  [TransactionStatus.PENDING]: "Pendente",
  [TransactionStatus.COMPLETED]: "Concluída",
  [TransactionStatus.CONFIRMED]: "Confirmada",
  [TransactionStatus.PAID]: "Paga",
  [TransactionStatus.CANCELLED]: "Cancelada",
  [TransactionStatus.SCHEDULED]: "Agendada",
};

/**
 * TransactionType is a classification, not a status, but it is rendered the same
 * way. Its persisted values are still Portuguese legacy values; keying the map
 * by the enum keeps the labels correct when the values are migrated.
 */
export const TRANSACTION_TYPE_LABELS_PT_BR: Readonly<Record<TransactionType, string>> = {
  [TransactionType.REVENUE]: "Receita",
  [TransactionType.EXPENSE]: "Despesa",
  [TransactionType.INVESTMENT]: "Investimento",
  [TransactionType.TAX]: "Imposto",
  [TransactionType.TRANSFER]: "Transferência",
};

export const INVOICE_STATUS_LABELS_PT_BR: Readonly<Record<InvoiceStatus, string>> = {
  [InvoiceStatus.DRAFT]: "Rascunho",
  [InvoiceStatus.PENDING]: "Pendente",
  [InvoiceStatus.ISSUED]: "Emitida",
  [InvoiceStatus.PAID]: "Paga",
  [InvoiceStatus.CANCELLED]: "Cancelada",
  [InvoiceStatus.OVERDUE]: "Vencida",
  [InvoiceStatus.REJECTED]: "Rejeitada",
};

export const LEAD_STATUS_LABELS_PT_BR: Readonly<Record<LeadStatus, string>> = {
  [LeadStatus.NEW]: "Novo",
  [LeadStatus.IN_CONTACT]: "Em contato",
  [LeadStatus.CONTACTED]: "Contatado",
  [LeadStatus.QUALIFIED]: "Qualificado",
  [LeadStatus.PROPOSAL]: "Proposta enviada",
  [LeadStatus.NEGOTIATION]: "Em negociação",
  [LeadStatus.CLOSED]: "Fechado",
  [LeadStatus.LOST]: "Perdido",
  [LeadStatus.INACTIVE]: "Inativo",
};

export const CLIENT_STATUS_LABELS_PT_BR: Readonly<Record<ClientStatus, string>> = {
  [ClientStatus.ACTIVE]: "Ativo",
  [ClientStatus.INACTIVE]: "Inativo",
  [ClientStatus.PROSPECT]: "Prospecto",
};

export const CAMPAIGN_STATUS_LABELS_PT_BR: Readonly<Record<CampaignStatus, string>> = {
  [CampaignStatus.DRAFT]: "Rascunho",
  [CampaignStatus.PLANNING]: "Em planejamento",
  [CampaignStatus.ACTIVE]: "Ativa",
  [CampaignStatus.PAUSED]: "Pausada",
  [CampaignStatus.COMPLETED]: "Concluída",
  [CampaignStatus.CANCELLED]: "Cancelada",
};

export const BRIEFING_STATUS_LABELS_PT_BR: Readonly<Record<BriefingStatus, string>> = {
  [BriefingStatus.DRAFT]: "Rascunho",
  [BriefingStatus.IN_PROGRESS]: "Em andamento",
  [BriefingStatus.REVIEW]: "Em revisão",
  [BriefingStatus.APPROVED]: "Aprovado",
  [BriefingStatus.COMPLETED]: "Concluído",
  [BriefingStatus.CANCELLED]: "Cancelado",
};

export const TAKEDOWN_STATUS_LABELS_PT_BR: Readonly<Record<TakedownStatus, string>> = {
  [TakedownStatus.PENDING]: "Pendente",
  [TakedownStatus.SENT]: "Enviado",
  [TakedownStatus.PROCESSING]: "Processando",
  [TakedownStatus.IN_PROGRESS]: "Em andamento",
  [TakedownStatus.COMPLETED]: "Concluído",
  [TakedownStatus.REJECTED]: "Rejeitado",
  [TakedownStatus.FAILED]: "Falhou",
};

export const CONTENT_DETECTION_STATUS_LABELS_PT_BR: Readonly<Record<ContentDetectionStatus, string>> = {
  [ContentDetectionStatus.PENDING]: "Pendente",
  [ContentDetectionStatus.IN_PROGRESS]: "Em andamento",
  [ContentDetectionStatus.COMPLETED]: "Concluída",
  [ContentDetectionStatus.REJECTED]: "Rejeitada",
  [ContentDetectionStatus.ARCHIVED]: "Arquivada",
};

export const PROJECT_STATUS_LABELS_PT_BR: Readonly<Record<ProjectStatus, string>> = {
  [ProjectStatus.PLANNING]: "Em planejamento",
  [ProjectStatus.IN_PROGRESS]: "Em andamento",
  [ProjectStatus.REVIEW]: "Em revisão",
  [ProjectStatus.COMPLETED]: "Concluído",
  [ProjectStatus.CANCELLED]: "Cancelado",
};

export const EVENT_STATUS_LABELS_PT_BR: Readonly<Record<EventStatus, string>> = {
  [EventStatus.PLANNED]: "Planejado",
  [EventStatus.SCHEDULED]: "Agendado",
  [EventStatus.CONFIRMED]: "Confirmado",
  [EventStatus.HELD]: "Realizado",
  [EventStatus.COMPLETED]: "Concluído",
  [EventStatus.CANCELLED]: "Cancelado",
  [EventStatus.POSTPONED]: "Adiado",
};

export const EMPLOYEE_STATUS_LABELS_PT_BR: Readonly<Record<EmployeeStatus, string>> = {
  [EmployeeStatus.ACTIVE]: "Ativo",
  [EmployeeStatus.INACTIVE]: "Inativo",
  [EmployeeStatus.ON_VACATION]: "Em férias",
  [EmployeeStatus.ON_LEAVE]: "Afastado",
  [EmployeeStatus.TERMINATED]: "Desligado",
};

export const PAYROLL_STATUS_LABELS_PT_BR: Readonly<Record<PayrollStatus, string>> = {
  [PayrollStatus.PENDING]: "Pendente",
  [PayrollStatus.PROCESSED]: "Processada",
  [PayrollStatus.PAID]: "Paga",
  [PayrollStatus.CANCELLED]: "Cancelada",
};

export const LEAVE_REQUEST_STATUS_LABELS_PT_BR: Readonly<Record<LeaveRequestStatus, string>> = {
  [LeaveRequestStatus.PENDING]: "Pendente",
  [LeaveRequestStatus.APPROVED]: "Aprovado",
  [LeaveRequestStatus.REJECTED]: "Rejeitado",
  [LeaveRequestStatus.COMPLETED]: "Concluído",
};

export const UPLOAD_STATUS_LABELS_PT_BR: Readonly<Record<UploadStatus, string>> = {
  [UploadStatus.PENDING]: "Pendente",
  [UploadStatus.PROCESSING]: "Processando",
  [UploadStatus.READY]: "Pronto",
  [UploadStatus.ERROR]: "Erro",
  [UploadStatus.DELETED]: "Excluído",
};

export const SUPPORT_TICKET_STATUS_LABELS_PT_BR: Readonly<Record<SupportTicketStatus, string>> = {
  [SupportTicketStatus.OPEN]: "Aberto",
  [SupportTicketStatus.IN_PROGRESS]: "Em andamento",
  [SupportTicketStatus.PENDING_USER]: "Aguardando cliente",
  [SupportTicketStatus.RESOLVED]: "Resolvido",
  [SupportTicketStatus.CLOSED]: "Fechado",
  [SupportTicketStatus.CANCELLED]: "Cancelado",
};

export const AI_JOB_STATUS_LABELS_PT_BR: Readonly<Record<AIJobStatus, string>> = {
  [AIJobStatus.PENDING]: "Pendente",
  [AIJobStatus.PROCESSING]: "Processando",
  [AIJobStatus.COMPLETED]: "Concluído",
  [AIJobStatus.FAILED]: "Falhou",
  [AIJobStatus.CANCELLED]: "Cancelado",
};

export const ECAD_REPORT_STATUS_LABELS_PT_BR: Readonly<Record<EcadReportStatus, string>> = {
  [EcadReportStatus.PENDING]: "Pendente",
  [EcadReportStatus.IMPORTED]: "Importado",
  [EcadReportStatus.COMPLETED]: "Concluído",
  [EcadReportStatus.ERROR]: "Erro",
};

export const INVENTORY_STATUS_LABELS_PT_BR: Readonly<Record<InventoryStatus, string>> = {
  [InventoryStatus.AVAILABLE]: "Disponível",
  [InventoryStatus.IN_USE]: "Em Uso",
  [InventoryStatus.ON_LOAN]: "Emprestado",
  [InventoryStatus.MAINTENANCE]: "Em Manutenção",
  [InventoryStatus.DAMAGED]: "Danificado",
  [InventoryStatus.DISCARDED]: "Descartado",
  [InventoryStatus.RESERVED]: "Reservado",
};

export const LICENSE_STATUS_LABELS_PT_BR: Readonly<Record<LicenseStatus, string>> = {
  [LicenseStatus.PENDING]: "Pendente",
  [LicenseStatus.NEGOTIATION]: "Em Negociação",
  [LicenseStatus.PROPOSAL]: "Proposta Enviada",
  [LicenseStatus.ACTIVE]: "Ativa",
  [LicenseStatus.EXPIRED]: "Expirada",
};

export const ARTIST_GOAL_STATUS_LABELS_PT_BR: Readonly<Record<ArtistGoalStatus, string>> = {
  [ArtistGoalStatus.IN_PROGRESS]: "Em andamento",
  [ArtistGoalStatus.COMPLETED]: "Concluída",
  [ArtistGoalStatus.CANCELLED]: "Cancelada",
  [ArtistGoalStatus.EXPIRED]: "Expirada",
};

export const QUOTE_STATUS_LABELS_PT_BR: Readonly<Record<QuoteStatus, string>> = {
  [QuoteStatus.DRAFT]: "Rascunho",
  [QuoteStatus.SIMULATED]: "Simulado",
  [QuoteStatus.PENDING_APPROVAL]: "Aguardando aprovação",
  [QuoteStatus.APPROVED]: "Aprovado",
  [QuoteStatus.SENT]: "Enviado",
  [QuoteStatus.ACCEPTED]: "Aceito",
  [QuoteStatus.REJECTED]: "Rejeitado",
  [QuoteStatus.EXPIRED]: "Expirado",
};

export const BILLING_STATUS_LABELS_PT_BR: Readonly<Record<BillingStatus, string>> = {
  [BillingStatus.TRIAL]: "Período de teste",
  [BillingStatus.ACTIVE]: "Ativa",
  [BillingStatus.PAST_DUE]: "Pagamento em atraso",
  [BillingStatus.CANCELED]: "Cancelada",
  [BillingStatus.UNPAID]: "Não paga",
};

/** Label maps by status domain (aggregate / entity type). */
export const STATUS_LABELS_PT_BR_BY_DOMAIN = {
  artist: ARTIST_STATUS_LABELS_PT_BR,
  contract: CONTRACT_STATUS_LABELS_PT_BR,
  work: WORK_STATUS_LABELS_PT_BR,
  phonogram: PHONOGRAM_STATUS_LABELS_PT_BR,
  release: RELEASE_STATUS_LABELS_PT_BR,
  share: SHARE_STATUS_LABELS_PT_BR,
  transaction: TRANSACTION_STATUS_LABELS_PT_BR,
  invoice: INVOICE_STATUS_LABELS_PT_BR,
  lead: LEAD_STATUS_LABELS_PT_BR,
  client: CLIENT_STATUS_LABELS_PT_BR,
  campaign: CAMPAIGN_STATUS_LABELS_PT_BR,
  briefing: BRIEFING_STATUS_LABELS_PT_BR,
  takedown: TAKEDOWN_STATUS_LABELS_PT_BR,
  content_detection: CONTENT_DETECTION_STATUS_LABELS_PT_BR,
  project: PROJECT_STATUS_LABELS_PT_BR,
  event: EVENT_STATUS_LABELS_PT_BR,
  employee: EMPLOYEE_STATUS_LABELS_PT_BR,
  payroll: PAYROLL_STATUS_LABELS_PT_BR,
  leave_request: LEAVE_REQUEST_STATUS_LABELS_PT_BR,
  upload: UPLOAD_STATUS_LABELS_PT_BR,
  support_ticket: SUPPORT_TICKET_STATUS_LABELS_PT_BR,
  ai_job: AI_JOB_STATUS_LABELS_PT_BR,
  artist_goal: ARTIST_GOAL_STATUS_LABELS_PT_BR,
  ecad_report: ECAD_REPORT_STATUS_LABELS_PT_BR,
  inventory: INVENTORY_STATUS_LABELS_PT_BR,
  license: LICENSE_STATUS_LABELS_PT_BR,
  quote: QUOTE_STATUS_LABELS_PT_BR,
  billing: BILLING_STATUS_LABELS_PT_BR,
} as const;

export type StatusDomain = keyof typeof STATUS_LABELS_PT_BR_BY_DOMAIN;

/**
 * PT-BR label of a status value in a domain, or `null` when the value is not a
 * member of that domain's enum. Never returns the raw value.
 */
export function statusLabelPtBr(domain: string | null | undefined, value: unknown): string | null {
  if (typeof value !== "string" || !domain) return null;
  const labels = (STATUS_LABELS_PT_BR_BY_DOMAIN as Record<string, Readonly<Record<string, string>>>)[domain];
  return labels?.[value] ?? null;
}
