import { formatCategoryLabel } from "@/shared/lib/category-labels";
import { canonicalContractCategorySlug } from "./contract-category-slugs";

export interface ContractTypeFilterOption {
  /** Persisted slug (canonical spelling for platform-owned categories) — the API expands legacy aliases. */
  value: string;
  /** PT-BR label. */
  label: string;
}

interface NamedSlug { slug: string; name: string }
interface LabeledValue { value: string; label: string }

/**
 * Options of the Contracts "type" filter, derived from data:
 *  - the tenant's contract service types (canonical source the form uses);
 *  - the category registry (templates' categories);
 *  - the types actually present in contracts (GET /contracts/type-facets), so a
 *    contract type that exists in data is always filterable.
 * Labels come from the first source that knows the slug; the PT-BR dictionary is
 * the last resort (never a raw technical slug). Spellings of one platform-owned
 * category collapse into one option.
 */
export function buildContractTypeFilterOptions(
  serviceTypes: ReadonlyArray<NamedSlug>,
  registry: ReadonlyArray<LabeledValue>,
  presentTypes: ReadonlyArray<string>,
): ContractTypeFilterOption[] {
  const labels = new Map<string, string>();
  const remember = (slug: string, label: string | undefined) => {
    const key = canonicalContractCategorySlug(slug);
    if (!labels.has(key) && label?.trim()) labels.set(key, label.trim());
  };
  for (const t of serviceTypes) remember(t.slug, t.name);
  for (const c of registry) remember(c.value, c.label);

  const keys = new Set<string>();
  for (const t of serviceTypes) if (t.slug) keys.add(canonicalContractCategorySlug(t.slug));
  for (const slug of presentTypes) if (slug && slug !== "—") keys.add(canonicalContractCategorySlug(slug));

  return [...keys]
    .map((value) => ({ value, label: labels.get(value) ?? formatCategoryLabel(value) }))
    .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
}
