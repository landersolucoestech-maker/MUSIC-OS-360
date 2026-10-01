import { canonicalTransactionCategory } from "@/modules/accounting/constants/transaction-constants";

/**
 * Artist 360 "revenue by nature" buckets. A bucket matches a transaction category by
 * keyword (substring, lowercase). Stored categories are either legacy Portuguese
 * slugs (`cache-show`, `licenciamento`, `patrocinio`) or the canonical English ids
 * (`show_fee`, `licensing`, `sponsorship`, TX1), so the keywords cover both spellings
 * and a category is tested in both its stored and its canonical form.
 */
export const NATURE_BUCKETS: Array<{ label: string; keywords: string[] }> = [
  { label: "Royalties", keywords: ["royalt"] },
  { label: "Shows", keywords: ["show", "cache", "cachê"] },
  { label: "Licenciamentos", keywords: ["licenc", "licens", "sync"] },
  { label: "Publicidade", keywords: ["public", "publi", "advertis", "ads", "anuncio", "patroc", "sponsor"] },
  { label: "Distribuição", keywords: ["distrib", "streaming"] },
];

export function matchesNatureBucket(bucket: { keywords: string[] }, category: unknown): boolean {
  const raw = String(category ?? "").toLowerCase();
  const canonical = canonicalTransactionCategory(raw);
  return bucket.keywords.some((k) => raw.includes(k) || canonical.includes(k));
}
