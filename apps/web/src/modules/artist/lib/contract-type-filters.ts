import { canonicalContractCategorySlug } from "@/modules/contracts/lib/contract-category-slugs";

/**
 * Contract-type filters of the artist 360 "Contracts" tab (labels are PT-BR, the
 * `types` are canonical English contract type slugs).
 *
 * `contracts.type` persists the canonical slug for platform-owned categories since
 * R3-04 but older rows (and tenant service-type slugs such as `parceria`) keep their
 * stored spelling, so the matcher normalizes the stored value first.
 */
export interface ContractTypeFilter { key: string; label: string; types?: string[] }

export const CONTRACT_TYPE_FILTERS: ContractTypeFilter[] = [
  { key: "all", label: "Todos" },
  { key: "business", label: "Empresarial", types: ["exclusivity", "exclusive", "non_exclusive", "management", "representation"] },
  { key: "distribution", label: "Distribuição", types: ["distribution"] },
  { key: "licensing", label: "Licenciamento", types: ["licensing"] },
  { key: "production", label: "Produção", types: ["production"] },
  { key: "partnerships", label: "Parcerias", types: ["parceria"] },
  { key: "services", label: "Serviços", types: ["services"] },
  { key: "other", label: "Outros", types: ["other"] },
];

/** Pre-canonical spellings that no longer have a platform alias (READ compatibility only). */
const LEGACY_CONTRACT_TYPE_ALIASES: Readonly<Record<string, string>> = {
  exclusivo: "exclusive",
  nao_exclusivo: "non_exclusive",
  representacao: "representation",
  servicos: "services",
};

/** Canonical form of a stored `contracts.type` for filtering (lower-cased, legacy spellings mapped). */
export function canonicalFilterContractType(raw: unknown): string {
  const lower = String(raw ?? "").toLowerCase();
  if (Object.prototype.hasOwnProperty.call(LEGACY_CONTRACT_TYPE_ALIASES, lower)) return LEGACY_CONTRACT_TYPE_ALIASES[lower];
  return canonicalContractCategorySlug(lower);
}

export function matchesContractTypeFilter(filterKey: string, rawType: unknown): boolean {
  const cfg = CONTRACT_TYPE_FILTERS.find((f) => f.key === filterKey);
  if (!cfg || !cfg.types) return true;
  return cfg.types.includes(canonicalFilterContractType(rawType));
}
