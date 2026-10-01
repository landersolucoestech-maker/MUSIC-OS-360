import type { Phonogram, PhonogramParticipation } from "@/modules/catalog/types/catalog.types";

export type PhonogramParticipantCategory = "performers" | "phonographic_producers";

/** Participant columns of the phonograms list: English keys, PT-BR labels. */
export const PHONOGRAM_LIST_PARTICIPANT_COLUMNS: ReadonlyArray<{ key: PhonogramParticipantCategory; label: string }> = [
  { key: "performers", label: "Intérpretes" },
  { key: "phonographic_producers", label: "Produtor" },
];

/** Names of one `participation` category, comma-joined ("" when none). */
export function participantNames(
  phonogram: Pick<Phonogram, "participation">,
  category: keyof PhonogramParticipation,
): string {
  const items = phonogram.participation?.[category];
  if (!Array.isArray(items)) return "";
  return items
    .map((item) => (typeof item?.name === "string" ? item.name.trim() : ""))
    .filter(Boolean)
    .join(", ");
}

/** Sort value of a phonograms list column (participant columns or a plain field). */
export function phonogramListSortValue(phonogram: Phonogram, key: string): string {
  if (key === "performers" || key === "phonographic_producers") return participantNames(phonogram, key);
  const value = (phonogram as Record<string, unknown>)[key];
  if (Array.isArray(value)) return value.filter(Boolean).join(", ");
  return (value ?? "").toString();
}
