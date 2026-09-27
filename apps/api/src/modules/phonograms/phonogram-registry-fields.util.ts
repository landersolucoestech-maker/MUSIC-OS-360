/**
 * phonogram-registry-fields.util.ts
 *
 * Naming-mission audit (2026-09-20/21) proved PhonogramEntity's Registry
 * Fields (recording_date/release_date/duration_seconds/country_of_recording,
 * migration 20260601000001_RegistryFieldsPhase1) are never populated by the
 * real write path — FonogramaFormModal writes only the Portuguese "one
 * column per form field" set (gravacao_original/data_lancamento/
 * duracao_min+duracao_seg/pais_origem), and society-payload-builder.
 * service.ts's buildRecordingPayload() reads only the Registry Fields —
 * every ABRAMUS/ECAD recording submission has shipped these fields null
 * even when the user filled the equivalent PT field. This derives the
 * Registry Fields from the PT fields on every write.
 */

// The form's country <Select> is a small, fixed, lowercased list
// (FonogramaFormModal.tsx: paises = ["BRAZIL","USA","UK","PORTUGAL",
// "ARGENTINA","OUTRO"]) -- not free text. ISO 3166-1 alpha-2 codes (an
// official standard, not a heuristic guess). "UK" itself is not the ISO
// code for the United Kingdom -- that's "GB" -- so this is a real
// correction, not just a case change.
const SOURCE_COUNTRY_TO_ISO: Record<string, string> = {
  brazil: 'BR',
  usa: 'US',
  uk: 'GB',
  portugal: 'PT',
  argentina: 'AR',
  // "outro" (other) has no determinate code -- left unmapped (-> null)
  // rather than invented.
};

export function mapOriginCountryToCountryCode(sourceCountry: string | null | undefined): string | null {
  if (!sourceCountry) return null;
  const code = SOURCE_COUNTRY_TO_ISO[sourceCountry.toLowerCase()];
  return code ?? null;
}

export interface PhonogramRegistrySourceFields {
  gravacao_original?: string | Date | null;
  data_lancamento?: string | Date | null;
  duracao_min?: number | null;
  duracao_seg?: number | null;
  pais_origem?: string | null;
}

export interface PhonogramRegistryDerivedFields {
  recording_date: Date | null;
  release_date: Date | null;
  duration_seconds: number | null;
  country_of_recording: string | null;
}

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Derives every Registry Field from a FULLY MERGED view of the PT source
 * fields (caller merges the incoming patch over the current entity, same
 * pattern as work-registry-fields.util.ts's deriveWorkRegistryFields).
 */
export function derivePhonogramRegistryFields(
  merged: PhonogramRegistrySourceFields,
): PhonogramRegistryDerivedFields {
  const min = merged.duracao_min ?? 0;
  const seg = merged.duracao_seg ?? 0;
  const hasDuration = merged.duracao_min != null || merged.duracao_seg != null;
  return {
    recording_date: toDate(merged.gravacao_original),
    release_date: toDate(merged.data_lancamento),
    duration_seconds: hasDuration ? min * 60 + seg : null,
    country_of_recording: mapOriginCountryToCountryCode(merged.pais_origem),
  };
}
