/**
 * shared/types/enums.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Literal union types para todos os campos enumerados do sistema MUSIC OS 360.
 * Fonte única de verdade — todos os módulos devem importar daqui.
 *
 * ARQUITECTURA: os tipos derivados dos enums canónicos em @music-os-360/types
 * via TypeScript template literal types (`type X = \`${PkgEnum}\``).
 * Isso garante que o pacote é a única fonte de verdade, enquanto os componentes
 * React continuam a receber string literal unions (retrocompatível).
 *
 * Tipos sem correspondência directa no pacote são definidos localmente.
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

// ── Artista ──────────────────────────────────────────────────────────────────

/** Derivado de ArtistStatus — fonte de verdade: @music-os-360/types */
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

// ── Contrato ─────────────────────────────────────────────────────────────────

/** Derivado de ContractStatus — fonte de verdade: @music-os-360/types */
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

/** Derivado de TransactionType — fonte de verdade: @music-os-360/types */
export type TransactionType = `${PkgTransactionType}`;

/** Derivado de TransactionStatus — fonte de verdade: @music-os-360/types */
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

// ── Nota Fiscal ──────────────────────────────────────────────────────────────

/** Derivado de InvoiceStatus — fonte de verdade: @music-os-360/types */
export type InvoiceStatusValue = `${InvoiceStatus}`;

export type InvoiceType =
  | "nfs"
  | "nfe"
  | "nfce"
  | "nfse"
  | "recibo"
  | "outro";

// ── Obra / Catálogo ──────────────────────────────────────────────────────────

/** Derivado de WorkStatus — fonte de verdade: @music-os-360/types */
export type WorkStatusValue = `${WorkStatus}`;

export type WorkType =
  | "musica"
  | "letra"
  | "trilha"
  | "jingle"
  | "instrumental"
  | "sampledTrack"
  | "outro";

// ── Fonograma ────────────────────────────────────────────────────────────────

/** Derivado de PhonogramStatus — fonte de verdade: @music-os-360/types */
export type PhonogramStatusValue = `${PhonogramStatus}`;

// ── Lançamento ────────────────────────────────────────────────────────────────

export type ReleaseType =
  | "single"
  | "ep"
  | "album"
  | "compilacao"
  | "live"
  | "outro";

/** Derivado de ReleaseStatus — fonte de verdade: @music-os-360/types */
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
 * Status de um share. Inclui os valores do pacote (`@music-os-360/types`) e os
 * valores realmente usados pela UI/mock (fluxo interno e externo de recebimento).
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

/** Direção do fluxo de caixa do share (mantém aliases legados). */
export type ShareDirection = "entrada" | "saida" | "a_receber" | "a_enviar" | "a_pagar";

/** Discriminador de tipo de share: lançamento interno vs recebível externo. */
export type ShareType = "internal_release" | "external_receivable";

// ── CRM / Lead ────────────────────────────────────────────────────────────────

/** Derivado de LeadStatus — fonte de verdade: @music-os-360/types */
export type LeadStatus = `${PkgLeadStatus}`;

export type LeadPriority = "alta" | "media" | "baixa";

export type LeadTemperature = "quente" | "morno" | "frio";

/** Derivado de ClientStatus — fonte de verdade: @music-os-360/types */
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

// ── Evento ────────────────────────────────────────────────────────────────────

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

/** Derivado de EventStatus — fonte de verdade: @music-os-360/types */
export type EventStatusValue = `${EventStatus}`;

// ── Projeto ───────────────────────────────────────────────────────────────────

/** Derivado de ProjectStatus — fonte de verdade: @music-os-360/types */
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

/** Derivado de CampaignStatus — fonte de verdade: @music-os-360/types */
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

/** Derivado de EmployeeStatus — fonte de verdade: @music-os-360/types */
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

/** Derivado de LeaveRequestStatus — fonte de verdade: @music-os-360/types */
export type LeaveRequestStatusValue = `${LeaveRequestStatus}`;

// ── Inventário ────────────────────────────────────────────────────────────────

export type InventoryStatus =
  | "disponivel"
  | "em_uso"
  | "manutencao"
  | "descartado"
  | "emprestado";

// ── Licença ───────────────────────────────────────────────────────────────────

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

// ── Monitoramento / Takedown ──────────────────────────────────────────────────

/** Derivado de TakedownStatus — fonte de verdade: @music-os-360/types */
export type TakedownStatus = `${PkgTakedownStatus}`;

