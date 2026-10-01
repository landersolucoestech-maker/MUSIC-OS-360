/**
 * shared/types/enums.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Literal union types for every enumerated field of the MUSIC OS 360 system.
 * Single source of truth — every module must import from here.
 *
 * ARCHITECTURE: the types are derived from the canonical enums in @music-os-360/types
 * via TypeScript template literal types (`type X = \`${PkgEnum}\``).
 * This guarantees the package is the only source of truth, while React
 * components keep receiving string literal unions (backward compatible).
 *
 * Types with no direct counterpart in the package are defined locally.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type {
  ArtistStatus,
  ContractStatus,
  WorkStatus,
  PhonogramStatus,
  ReleaseStatus,
  ShareStatus     as PkgShareStatus,
  TransactionType as PkgTransactionType,
  TransactionStatus,
  InvoiceStatus,
  LeadStatus      as PkgLeadStatus,
  ClientStatus,
  CampaignStatus,
  TakedownStatus  as PkgTakedownStatus,
  ProjectStatus,
  EventStatus,
  EmployeeStatus,
  LeaveRequestStatus,
  InventoryStatus,
  LicenseStatus,
} from '@music-os-360/types';

// ── Artist ───────────────────────────────────────────────────────────────────

/** Derived from ArtistStatus — source of truth: @music-os-360/types */
export type ArtistStatusValue = `${ArtistStatus}`;

/**
 * Canonical wire values of `profile_type` / `profileType` (CZ-042).
 * PT-BR display labels live in modules/artist/services/artist.mapper.ts.
 */
export type ArtistProfileType =
  | "independent"
  | "managed"
  | "record_label"
  | "publisher";

/** Canonical wire values of `specialties[]` (CZ-042). */
export type ArtistSpecialty =
  | "dj"
  | "dj_producer"
  | "songwriter"
  | "performer"
  | "producer";

/** Canonical wire values of `relationships[].type` (CZ-042). */
export type ArtistRelationshipContactType =
  | "agent"
  | "record_label"
  | "publisher"
  | "booker"
  | "legal"
  | "finance"
  | "accountant"
  | "press_office";

/** Canonical wire values of the metadata-only `gender` field (CZ-042). */
export type ArtistGender = "male" | "female";

// ── Contract ─────────────────────────────────────────────────────────────────

/** Derived from ContractStatus — source of truth: @music-os-360/types */
export type ContractStatusValue = `${ContractStatus}`;

/** Free-form catalog value (contract service type slug configured per tenant); not a closed enum. */
export type ContractType = string;

// ── Transaction / Accounting ──────────────────────────────────────────────────

/** Derived from TransactionType — source of truth: @music-os-360/types */
export type TransactionType = `${PkgTransactionType}`;

/** Derived from TransactionStatus — source of truth: @music-os-360/types */
export type TransactionStatusValue = `${TransactionStatus}`;

/**
 * Canonical wire values of `payment_method` / `paymentMethod` (CZ-041).
 * `pix`/`ted`/`boleto` are proper names of Brazilian payment rails, kept as-is.
 * PT-BR display labels live in accounting/constants/transaction-constants.ts.
 */
export type TransactionPaymentMethod =
  | "pix"
  | "ted"
  | "boleto"
  | "credit_card"
  | "debit_card"
  | "cash"
  | "check";

/** Canonical wire values of `counterparty_type` / `counterpartyType` (CZ-041). */
export type TransactionCounterpartyType = "company" | "artist" | "individual" | "government" | "own_account";

/** Canonical wire values of `payment_type` / `paymentType` (CZ-041). */
export type TransactionPaymentType = "upfront" | "installments";

/** Canonical wire values of `installment_interval` / `installmentInterval` (CZ-041). */
export type TransactionInstallmentInterval = "monthly" | "biweekly" | "weekly";

// ── Invoice (Nota Fiscal) ────────────────────────────────────────────────────

/** Derived from InvoiceStatus — source of truth: @music-os-360/types */
export type InvoiceStatusValue = `${InvoiceStatus}`;

/** Fiscal document types accepted by the API (FISCAL_DOCUMENT_TYPES in invoices.dto.ts). */
export type InvoiceType = "nfse" | "nfe" | "nfce";

// ── Work / Catalog ───────────────────────────────────────────────────────────

/** Derived from WorkStatus — source of truth: @music-os-360/types */
export type WorkStatusValue = `${WorkStatus}`;

/** Musical classification stored in `works.type` (CZ-039; API default `composition`). */
export type WorkType =
  | "composition"
  | "other";

// ── Sound recording ──────────────────────────────────────────────────────────

/** Derived from PhonogramStatus — source of truth: @music-os-360/types */
export type PhonogramStatusValue = `${PhonogramStatus}`;

// ── Release ──────────────────────────────────────────────────────────────────

export type ReleaseType =
  | "single"
  | "ep"
  | "album"
  | "compilation"
  | "live"
  | "other";

/** Derived from ReleaseStatus — source of truth: @music-os-360/types */
export type ReleaseStatusValue = `${ReleaseStatus}`;

// ── Share / Participation ─────────────────────────────────────────────────────

/** Participant function stored in `shares.type` (CZ-037; PT-BR labels in share-format). */
export type ShareFunction =
  | "composer"
  | "performer"
  | "producer"
  | "publisher"
  | "record_label"
  | "manager"
  | "other";

/** Status of a share — source of truth: `ShareStatus` in @music-os-360/types. */
export type ShareStatus = `${PkgShareStatus}`;

/** Cash-flow direction of the share. */
export type ShareDirection = "receivable" | "payable";

/** Share type discriminator: internal entry vs external receivable. */
export type ShareType = "internal_release" | "external_receivable";

// ── CRM / Lead ────────────────────────────────────────────────────────────────

/** Derived from LeadStatus — source of truth: @music-os-360/types */
export type LeadStatus = `${PkgLeadStatus}`;

/** Derived from ClientStatus — source of truth: @music-os-360/types */
export type ClientStatusValue = `${ClientStatus}`;

export type ClientSegment =
  | "artista"
  | "gravadora"
  | "editora"
  | "distribuidora"
  | "agencia"
  | "marca"
  | "produtor"
  | "veiculo"
  | "outro";

// ── Event ─────────────────────────────────────────────────────────────────────

/** Coarse enum persisted in events.type (CreateEventDto.type; see events/lib/event-type.ts). */
export type EventType = "show" | "festival" | "recording" | "meeting" | "interview" | "tour" | "other";

/** Derived from EventStatus — source of truth: @music-os-360/types */
export type EventStatusValue = `${EventStatus}`;

// ── Project ───────────────────────────────────────────────────────────────────

/** Derived from ProjectStatus — source of truth: @music-os-360/types */
export type ProjectStatusValue = `${ProjectStatus}`;

/** Values accepted by projects.type (projects.dto.ts TYPES). */
export type ProjectType = "album" | "ep" | "single" | "video" | "tour" | "podcast" | "other";

// ── Marketing ─────────────────────────────────────────────────────────────────

/** Derived from CampaignStatus — source of truth: @music-os-360/types */
export type CampaignStatusValue = `${CampaignStatus}`;

// ── RH ────────────────────────────────────────────────────────────────────────

/** Derived from EmployeeStatus — source of truth: @music-os-360/types */
export type EmployeeStatusValue = `${EmployeeStatus}`;

export type EmployeeContractType =
  | "clt"
  | "pj"
  | "freelancer"
  | "internship"
  | "temporary";

export type LeaveType =
  | "vacation"
  | "sick_leave"
  | "maternity_leave"
  | "paternity_leave"
  | "excused_absence"
  | "unexcused_absence"
  | "day_off"
  | "compensatory_time_off";

/** Derived from LeaveRequestStatus — source of truth: @music-os-360/types */
export type LeaveRequestStatusValue = `${LeaveRequestStatus}`;

// ── Inventory ─────────────────────────────────────────────────────────────────

/** Derived from InventoryStatus — source of truth: @music-os-360/types */
export type InventoryStatusValue = `${InventoryStatus}`;

// ── License ───────────────────────────────────────────────────────────────────

/** Derived from LicenseStatus — source of truth: @music-os-360/types */
export type LicenseStatusValue = `${LicenseStatus}`;

// ── Monitoring / Takedown ─────────────────────────────────────────────────────

/** Derived from TakedownStatus — source of truth: @music-os-360/types */
export type TakedownStatus = `${PkgTakedownStatus}`;

