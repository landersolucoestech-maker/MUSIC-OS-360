/**
 * import-value-canonicalizers.ts — the reports import writes rows with its own
 * INSERT, so it must apply the same legacy-value → canonical mapping as the
 * module services (CZ-032..CZ-041). A spreadsheet exported before a cluster
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

type ColumnCanonicalizer = (value: unknown) => unknown;

const fromMap = (map: Readonly<Record<string, string>>): ColumnCanonicalizer =>
  (value) => (typeof value === 'string' && Object.prototype.hasOwnProperty.call(map, value) ? map[value] : value);

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
  transactions: {
    type: fromMap(LEGACY_TRANSACTION_VALUES.transactionType),
    counterparty_type: fromMap(LEGACY_TRANSACTION_VALUES.counterpartyType),
    payment_method: fromMap(LEGACY_TRANSACTION_VALUES.paymentMethod),
    payment_type: fromMap(LEGACY_TRANSACTION_VALUES.paymentType),
    installment_interval: fromMap(LEGACY_TRANSACTION_VALUES.installmentInterval),
  },
};

/** Canonical value of an imported cell for `table.column` (unchanged when no mapping applies). */
export function canonicalImportValue(table: string, physicalColumn: string, value: unknown): unknown {
  const canonicalize = CANONICALIZERS[table]?.[physicalColumn];
  return canonicalize ? canonicalize(value) : value;
}

/**
 * Contract fields stored inside a jsonb column (`meta()`) are assembled into
 * one object per column before the INSERT; the legacy keys/values inside it
 * are canonicalized the same way the module service does (CZ-033 leads).
 */
const JSON_COLUMN_CANONICALIZERS: Readonly<Record<string, Readonly<Record<string, ColumnCanonicalizer>>>> = {
  leads: { crm_internal_data: canonicalCrmInternalData, service_payload: canonicalServicePayload },
};

/** Canonical jsonb object of an imported `table.column` (unchanged when no mapping applies). */
export function canonicalImportJsonColumn(table: string, physicalColumn: string, value: Record<string, unknown>): unknown {
  const canonicalize = JSON_COLUMN_CANONICALIZERS[table]?.[physicalColumn];
  return canonicalize ? canonicalize(value) : value;
}
