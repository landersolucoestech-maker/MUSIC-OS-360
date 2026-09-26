/**
 * modules/reports/form-contracts/artists.form-contract.ts
 *
 * Derived view of the central Artists contract (report-form-contracts.ts).
 * Do NOT declare lists here: the single source is REPORT_FORM_CONTRACTS.artists.
 */
import {
  REPORT_FORM_CONTRACTS,
  contractDirectColumns,
  contractEncryptedFields,
  contractExportableColumns,
  contractMetadataFields,
} from './report-form-contracts';

const ARTISTS = REPORT_FORM_CONTRACTS.artists;

export const ARTIST_FORM_FIELDS: readonly string[] = contractExportableColumns(ARTISTS);

export const ARTIST_DIRECT_COLUMNS: Set<string> = contractDirectColumns(ARTISTS);

export const ARTIST_ENCRYPTED_FIELDS: Record<string, string> = contractEncryptedFields(ARTISTS);

const ARTIST_METADATA_FIELDS: Set<string> = new Set(Object.keys(contractMetadataFields(ARTISTS)));

export function isArtistFormField(field: string): boolean {
  return (ARTIST_FORM_FIELDS as readonly string[]).includes(field);
}

export function isArtistMetadataField(field: string): boolean {
  return ARTIST_METADATA_FIELDS.has(field);
}
