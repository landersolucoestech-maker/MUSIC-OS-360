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
} from '@music-os-360/types';

// ── Artist ───────────────────────────────────────────────────────────────────

/** Derived from ArtistStatus — source of truth: @music-os-360/types */
export type ArtistStatusValue = `${ArtistStatus}`;

export type ArtistProfileType =
  | "independente"
  | "com_empresario"
  | "gravadora"
  | "editora";

export type ArtistSpecialty =
  | "dj"
  | "dj_produtor"
  | "compositor_autor"
  | "interprete"
  | "produtor";

// ── Contract ─────────────────────────────────────────────────────────────────

/** Derived from ContractStatus — source of truth: @music-os-360/types */
export type ContractStatusValue = `${ContractStatus}`;

export type ContractType =
  | "exclusivo"
  | "nao_exclusivo"
  | "licenciamento"
  | "distribuicao"
  | "producao"
  | "representacao"
  | "parceria"
  | "servicos"
  | "gestao"
  | "outro";

// ── Transação / Accounting ────────────────────────────────────────────────────

/** Derived from TransactionType — source of truth: @music-os-360/types */
export type TransactionType = `${PkgTransactionType}`;

/** Derived from TransactionStatus — source of truth: @music-os-360/types */
export type TransactionStatusValue = `${TransactionStatus}`;

export type TransactionPaymentMethod =
  | "dinheiro"
  | "pix"
  | "ted"
  | "boleto"
  | "cartao_credito"
  | "cartao_debito"
  | "cheque"
  | "permuta"
  | "outro";

// ── Invoice (Nota Fiscal) ────────────────────────────────────────────────────

/** Derived from InvoiceStatus — source of truth: @music-os-360/types */
export type InvoiceStatusValue = `${InvoiceStatus}`;

export type InvoiceType =
  | "nfs"
  | "nfe"
  | "nfce"
  | "nfse"
  | "recibo"
  | "outro";

// ── Work / Catalog ───────────────────────────────────────────────────────────

/** Derived from WorkStatus — source of truth: @music-os-360/types */
export type WorkStatusValue = `${WorkStatus}`;

export type WorkType =
  | "musica"
  | "letra"
  | "trilha"
  | "jingle"
  | "instrumental"
  | "sampledTrack"
  | "outro";

// ── Sound recording ──────────────────────────────────────────────────────────

/** Derived from PhonogramStatus — source of truth: @music-os-360/types */
export type PhonogramStatusValue = `${PhonogramStatus}`;

// ── Release ──────────────────────────────────────────────────────────────────

export type ReleaseType =
  | "single"
  | "ep"
  | "album"
  | "compilacao"
  | "live"
  | "outro";

/** Derived from ReleaseStatus — source of truth: @music-os-360/types */
export type ReleaseStatusValue = `${ReleaseStatus}`;

// ── Share / Participação ──────────────────────────────────────────────────────

export type ShareCategory =
  | "composicao"
  | "master"
  | "editorial"
  | "performance"
  | "sincronia"
  | "outro";

/**
 * Status of a share. Includes the package values (`@music-os-360/types`) and the
 * values actually used by the UI/mock (internal and external receipt flow).
 */
export type ShareStatus =
  | `${PkgShareStatus}`
  | "parcial"
  | "recebido"
  | "enviado"
  | "aceito"
  | "recusado"
  | "erro"
  | "cancelado";

/** Cash-flow direction of the share (keeps legacy aliases). */
export type ShareDirection = "entrada" | "saida" | "a_receber" | "a_enviar" | "a_pagar";

/** Share type discriminator: internal entry vs external receivable. */
export type ShareType = "internal_release" | "external_receivable";

// ── CRM / Lead ────────────────────────────────────────────────────────────────

/** Derived from LeadStatus — source of truth: @music-os-360/types */
export type LeadStatus = `${PkgLeadStatus}`;

export type LeadPriority = "alta" | "media" | "baixa";

export type LeadTemperature = "quente" | "morno" | "frio";

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

export type EventType =
  | "show"
  | "festival"
  | "gravacao"
  | "videoclipe"
  | "ensaio"
  | "reuniao"
  | "workshop"
  | "lancamento"
  | "live"
  | "streaming"
  | "outro";

/** Derived from EventStatus — source of truth: @music-os-360/types */
export type EventStatusValue = `${EventStatus}`;

// ── Project ───────────────────────────────────────────────────────────────────

/** Derived from ProjectStatus — source of truth: @music-os-360/types */
export type ProjectStatusValue = `${ProjectStatus}`;

export type ProjectType =
  | "album"
  | "ep"
  | "single"
  | "videoclipe"
  | "show"
  | "tour"
  | "campanha"
  | "podcast"
  | "outro";

// ── Marketing ─────────────────────────────────────────────────────────────────

/** Derived from CampaignStatus — source of truth: @music-os-360/types */
export type CampaignStatusValue = `${CampaignStatus}`;

export type CampaignType =
  | "digital"
  | "impressa"
  | "outdoor"
  | "radio"
  | "tv"
  | "influencer"
  | "email"
  | "sms"
  | "push"
  | "release"
  | "outro";

export type ContentStatus =
  | "rascunho"
  | "revisao"
  | "aprovado"
  | "agendado"
  | "publicado"
  | "arquivado";

// ── RH ────────────────────────────────────────────────────────────────────────

/** Derived from EmployeeStatus — source of truth: @music-os-360/types */
export type EmployeeStatusValue = `${EmployeeStatus}`;

export type EmployeeContractType =
  | "clt"
  | "pj"
  | "autonomo"
  | "estagio"
  | "temporario";

export type LeaveType =
  | "ferias"
  | "licenca_medica"
  | "licenca_maternidade"
  | "licenca_paternidade"
  | "falta"
  | "outro";

/** Derived from LeaveRequestStatus — source of truth: @music-os-360/types */
export type LeaveRequestStatusValue = `${LeaveRequestStatus}`;

// ── Inventory ─────────────────────────────────────────────────────────────────

export type InventoryStatus =
  | "disponivel"
  | "em_uso"
  | "manutencao"
  | "descartado"
  | "emprestado";

// ── License ───────────────────────────────────────────────────────────────────

export type LicenseType =
  | "sincronia"
  | "mecanica"
  | "performance"
  | "impressao"
  | "digital"
  | "streaming"
  | "outro";

export type LicenseStatus =
  | "ativo"
  | "pendente"
  | "vencido"
  | "cancelado"
  | "encerrado";

// ── Monitoring / Takedown ─────────────────────────────────────────────────────

/** Derived from TakedownStatus — source of truth: @music-os-360/types */
export type TakedownStatus = `${PkgTakedownStatus}`;

