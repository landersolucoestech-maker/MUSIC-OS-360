/**
 * import-value-canonicalizers.ts — the reports import writes rows with its own
 * INSERT, so it must apply the same legacy-value → canonical mapping as the
 * module services (CZ-032..CZ-038). A spreadsheet exported before a cluster
 * renamed its persisted values (e.g. shares `direction = a_receber`) would
 * otherwise be stored with values the application no longer recognizes.
 *
 * One entry per table; each module owns its vocabulary, this file only routes.
 */
import { SHARE_LEGACY_VALUES } from '../../shares/share-legacy-fields';
import { RELEASE_LEGACY_TYPES } from '../../releases/release-legacy-fields';
import { canonicalTakedownPriority, canonicalTakedownType } from '../../takedowns/takedown-legacy-fields';
import { canonicalLicenseValue } from '../../licensing/license-vocabulary';
import { canonicalInventoryStatus } from '../../inventory/inventory-legacy-fields';
import { canonicalLeadServiceType } from '../../leads/lead-vocabulary';

type ColumnCanonicalizer = (value: unknown) => unknown;

const fromMap = (map: Readonly<Record<string, string>>): ColumnCanonicalizer =>
  (value) => (typeof value === 'string' && Object.prototype.hasOwnProperty.call(map, value) ? map[value] : value);

const CANONICALIZERS: Readonly<Record<string, Readonly<Record<string, ColumnCanonicalizer>>>> = {
  shares: {
    status: fromMap(SHARE_LEGACY_VALUES.status),
    direction: fromMap(SHARE_LEGACY_VALUES.direction),
    type: fromMap(SHARE_LEGACY_VALUES.type),
    party_role: fromMap(SHARE_LEGACY_VALUES.party_role),
  },
  releases: { type: fromMap(RELEASE_LEGACY_TYPES) },
  takedowns: { type: canonicalTakedownType, priority: canonicalTakedownPriority },
  licenses: {
    status: (v) => canonicalLicenseValue('status', v),
    type: (v) => canonicalLicenseValue('type', v),
    target_media: (v) => canonicalLicenseValue('target_media', v),
    territory: (v) => canonicalLicenseValue('territory', v),
  },
  inventory_items: { status: (v) => (typeof v === 'string' ? canonicalInventoryStatus(v) : v) },
  leads: { service_type: canonicalLeadServiceType },
};

/** Canonical value of an imported cell for `table.column` (unchanged when no mapping applies). */
export function canonicalImportValue(table: string, physicalColumn: string, value: unknown): unknown {
  const canonicalize = CANONICALIZERS[table]?.[physicalColumn];
  return canonicalize ? canonicalize(value) : value;
}
