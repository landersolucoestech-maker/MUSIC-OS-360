/**
 * import-value-canonicalizers.ts — the reports import writes rows with its own
 * INSERT, so it must apply the same legacy-value → canonical mapping as the
 * module services (CZ-032..CZ-042). A spreadsheet exported before a cluster
 * renamed its persisted values (e.g. shares `direction = a_receber`, works
 * `language = Português`) would
 * otherwise be stored with values the application no longer recognizes.
 *
 * One entry per table; each module owns its vocabulary, this file only routes.
 */
import { SHARE_LEGACY_VALUES } from '../../shares/share-legacy-fields';
import { canonicalReleaseType } from '../../releases/release-legacy-fields';
import { canonicalTakedownPriority, canonicalTakedownType } from '../../takedowns/takedown-legacy-fields';
import { canonicalLicenseValue } from '../../licensing/license-vocabulary';
import { canonicalInventoryStatus } from '../../inventory/inventory-legacy-fields';
import { canonicalCrmInternalData, canonicalLeadServiceType, canonicalServicePayload } from '../../leads/lead-vocabulary';
import { LANGUAGE_LABEL_TO_CODE, LEGACY_WORK_VALUES } from '../../works/work-legacy-fields';
import { LEGACY_PHONOGRAM_VALUES, canonicalCountryCode } from '../../phonograms/phonogram-legacy-fields';
import { LEGACY_TRANSACTION_VALUES } from '../../transactions/transaction-legacy-fields';
import { canonicalTransactionSlug } from '../../transactions/transaction-category-slugs';
import { canonicalInvoicePaymentMethod, INVOICE_PAYMENT_METHODS } from '../../invoices/invoice-legacy-fields';
import { isMultiValueLabelColumn, valueFromExportLabel } from '../i18n/value-labels.pt-br';
import { canonicalClientPersonType, canonicalClientPriority } from '../../clients/client-legacy-fields';
import {
  ARTIST_NESTED_JSON_COLUMNS,
  canonicalArtistMetadata,
  canonicalArtistNestedColumn,
  canonicalArtistProfileType,
  canonicalArtistSpecialties,
} from '../../artists/artist-legacy-fields';

type ColumnCanonicalizer = (value: unknown) => unknown;

/**
 * jsonb column value for the raw INSERT: node-postgres serializes a JS array as
 * a Postgres array literal (invalid jsonb input), so arrays/objects are sent as
 * JSON text and Postgres parses them into jsonb.
 */
const asJsonb = (value: unknown): unknown =>
  value !== null && typeof value === 'object' ? JSON.stringify(value) : value;

/**
 * artists.specialties cell: the export writes the PT-BR labels joined by " | "
 * ("DJ | Compositor/Autor"); a JSON list (older export) is also accepted. Each
 * item: raw canonical value first, then PT-BR label, then legacy PT value.
 */
function importArtistSpecialties(value: unknown): unknown {
  const items = typeof value === 'string'
    ? value.split('|').map((part) => part.trim()).filter(Boolean)
    : value;
  if (!Array.isArray(items)) return items;
  return canonicalArtistSpecialties(items.map((item) => valueFromExportLabel('artists', 'specialties', item) ?? item));
}

/** CZ-042 artists jsonb columns: nested-item columns get canonical keys (+ relationship types). */
const ARTIST_JSONB_CANONICALIZERS: Record<string, ColumnCanonicalizer> = {
  specialties: (v) => asJsonb(importArtistSpecialties(v)),
  gallery_urls: asJsonb,
  music_tags: asJsonb,
  selected_distributors: asJsonb,
  distributor_emails: asJsonb,
  company_selected_distributors: asJsonb,
  company_distributor_emails: asJsonb,
  ...Object.fromEntries(ARTIST_NESTED_JSON_COLUMNS.map((column) => [
    column, (v: unknown) => asJsonb(canonicalArtistNestedColumn(column, v)),
  ])),
};

/** Spreadsheet cells are free text: matched exactly, then trimmed and case-insensitively. */
const fromMap = (map: Readonly<Record<string, string>>): ColumnCanonicalizer => {
  const byLowerKey = new Map(Object.entries(map).map(([key, canonical]) => [key.trim().toLowerCase(), canonical]));
  return (value) => {
    if (typeof value !== 'string') return value;
    if (Object.prototype.hasOwnProperty.call(map, value)) return map[value];
    return byLowerKey.get(value.trim().toLowerCase()) ?? value;
  };
};

const CANONICALIZERS: Readonly<Record<string, Readonly<Record<string, ColumnCanonicalizer>>>> = {
  shares: {
    status: fromMap(SHARE_LEGACY_VALUES.status),
    direction: fromMap(SHARE_LEGACY_VALUES.direction),
    type: fromMap(SHARE_LEGACY_VALUES.type),
  },
  releases: { type: canonicalReleaseType },
  takedowns: { type: canonicalTakedownType, priority: canonicalTakedownPriority },
  licenses: {
    status: (v) => canonicalLicenseValue('status', v),
    type: (v) => canonicalLicenseValue('type', v),
    target_media: (v) => canonicalLicenseValue('target_media', v),
    territory: (v) => canonicalLicenseValue('territory', v),
  },
  inventory_items: { status: (v) => (typeof v === 'string' ? canonicalInventoryStatus(v) : v) },
  leads: { service_type: canonicalLeadServiceType },
  works: {
    language: fromMap(LANGUAGE_LABEL_TO_CODE),
    is_instrumental: fromMap({ sim: true, nao: false } as unknown as Record<string, string>),
    work_origin: fromMap(LEGACY_WORK_VALUES.work_origin),
    ai_usage_level: fromMap(LEGACY_WORK_VALUES.ai_usage_level),
    type: fromMap(LEGACY_WORK_VALUES.type),
  },
  phonograms: {
    media_type: fromMap(LEGACY_PHONOGRAM_VALUES.media_type),
    recording_classification: fromMap(LEGACY_PHONOGRAM_VALUES.recording_classification),
    aggregator: fromMap(LEGACY_PHONOGRAM_VALUES.aggregator),
    country_of_recording: canonicalCountryCode,
    publication_country: canonicalCountryCode,
  },
  artists: { profile_type: canonicalArtistProfileType, ...ARTIST_JSONB_CANONICALIZERS },
  // CZ-043: an old CRM export carries pessoa_fisica/pessoa_juridica (and PT priorities).
  clients: { person_type: canonicalClientPersonType, priority: canonicalClientPriority },
  transactions: {
    type: fromMap(LEGACY_TRANSACTION_VALUES.transactionType),
    counterparty_type: fromMap(LEGACY_TRANSACTION_VALUES.counterpartyType),
    payment_method: fromMap(LEGACY_TRANSACTION_VALUES.paymentMethod),
    payment_type: fromMap(LEGACY_TRANSACTION_VALUES.paymentType),
    installment_interval: fromMap(LEGACY_TRANSACTION_VALUES.installmentInterval),
    // TX1: platform-owned taxonomy slugs; free text (user/rule category names) passes through untouched.
    category: canonicalTransactionSlug,
    subcategory: canonicalTransactionSlug,
  },
  // An old invoices export carries dinheiro/cartao_credito/... (chk_invoices_payment_method).
  invoices: { payment_method: canonicalInvoicePaymentMethod },
};

/**
 * Closed vocabularies enforced by a database CHECK that the import writes with a
 * raw INSERT. The validation step rejects a cell outside the set (row error)
 * so the commit never reaches the constraint (which would surface as a 500).
 * The cell is compared AFTER canonicalization (deprecated aliases accepted).
 */
const CLOSED_VOCABULARIES: Readonly<Record<string, Readonly<Record<string, readonly string[]>>>> = {
  invoices: { payment_method: INVOICE_PAYMENT_METHODS },
};

/** False when `table.column` has a closed vocabulary and the (non-empty) cell is not in it once canonicalized. */
export function isAllowedImportValue(table: string, physicalColumn: string, value: unknown): boolean {
  const allowed = CLOSED_VOCABULARIES[table]?.[physicalColumn];
  if (!allowed || value === null || value === undefined || value === '') return true;
  const canonical = canonicalImportValue(table, physicalColumn, value);
  return typeof canonical === 'string' && allowed.includes(canonical);
}

/** Own-property lookup: a prototype key (`constructor`, `__proto__`, ...) is never a table, column or canonicalizer. */
function ownEntry<T>(map: Readonly<Record<string, T>>, key: string): T | undefined {
  return Object.prototype.hasOwnProperty.call(map, key) ? map[key] : undefined;
}

/** Canonical value of an imported cell for `table.column` (unchanged when no mapping applies). */
export function canonicalImportValue(table: string, physicalColumn: string, value: unknown): unknown {
  // An exported spreadsheet carries the PT-BR label of enum values (round-trip).
  // Multi-valued enum lists are split and mapped item by item by their canonicalizer.
  const fromLabel = isMultiValueLabelColumn(table, physicalColumn) ? null : valueFromExportLabel(table, physicalColumn, value);
  if (fromLabel !== null) return fromLabel;
  const canonicalize = ownEntry(CANONICALIZERS, table) ? ownEntry(ownEntry(CANONICALIZERS, table)!, physicalColumn) : undefined;
  return canonicalize ? canonicalize(value) : value;
}

/**
 * Contract fields stored inside a jsonb column (`meta()`) are assembled into
 * one object per column before the INSERT; the legacy keys/values inside it
 * are canonicalized the same way the module service does (CZ-033 leads).
 */
const JSON_COLUMN_CANONICALIZERS: Readonly<Record<string, Readonly<Record<string, ColumnCanonicalizer>>>> = {
  leads: { crm_internal_data: canonicalCrmInternalData, service_payload: canonicalServicePayload },
  artists: { metadata: canonicalArtistMetadata },
};

/** Canonical jsonb object of an imported `table.column` (unchanged when no mapping applies). */
export function canonicalImportJsonColumn(table: string, physicalColumn: string, value: Record<string, unknown>): unknown {
  const canonicalize = ownEntry(JSON_COLUMN_CANONICALIZERS, table) ? ownEntry(ownEntry(JSON_COLUMN_CANONICALIZERS, table)!, physicalColumn) : undefined;
  return canonicalize ? canonicalize(value) : value;
}
