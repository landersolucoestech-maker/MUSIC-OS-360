/**
 * PT-BR display name of a distributor/aggregator id stored on an artist
 * (general_distributors, team contacts' distributors, legacy
 * selected_distributors map). One label per id; the form's option list
 * (DISTRIBUTOR_OPTIONS) is the source for the ids it can write, plus the ids
 * only older records hold. An unknown id is never shown raw.
 */
import { isOtherDistributorId } from "@/modules/artist/lib/distributor-id";
import { DISTRIBUTOR_OPTIONS } from "@/modules/artist/forms/artist-form.definition";

/** Ids written by the legacy selected_distributors checkbox map (no longer offered by the form). */
const LEGACY_DISTRIBUTOR_LABELS: Readonly<Record<string, string>> = {
  cdbaby: "CD Baby",
  tunecore: "TuneCore",
  ditto: "Ditto Music",
  imusics: "iMusics",
};

const DISTRIBUTOR_LABELS: Readonly<Record<string, string>> = {
  ...LEGACY_DISTRIBUTOR_LABELS,
  ...Object.fromEntries(DISTRIBUTOR_OPTIONS.map((option) => [option.id, option.label])),
};

export const UNKNOWN_DISTRIBUTOR_LABEL = "Distribuidora não identificada";

export function distributorLabel(id: string | null | undefined, customName?: string | null): string {
  if (isOtherDistributorId(id)) return customName?.trim() || "Outros";
  if (!id) return UNKNOWN_DISTRIBUTOR_LABEL;
  return Object.prototype.hasOwnProperty.call(DISTRIBUTOR_LABELS, id) ? DISTRIBUTOR_LABELS[id] : UNKNOWN_DISTRIBUTOR_LABEL;
}
