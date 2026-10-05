import { useState, useEffect, useCallback } from "react";
import { localStore } from "@/shared/lib/local-store";
import { readWithLegacyKeyMigration } from "@/modules/contracts/lib/local-key-migration";
import { canonicalContractCategorySlug, sameContractCategory } from "@/modules/contracts/lib/contract-category-slugs";

const STORAGE_KEY = "musicos360_contract_categories";
// Key used before the `musicos360_` prefix; read once and migrated to STORAGE_KEY.
const LEGACY_STORAGE_KEY = "contract_categories";

export interface ContractCategory {
  id: string;
  label: string;
  value: string;
  description?: string;
  createdAt: string;
}

function generateId(): string {
  return `cat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function toSlug(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 40);
}

const SEED_CATEGORIES: Omit<ContractCategory, "id" | "createdAt">[] = [
  { label: "Gravação",           value: "recording",        description: "Contratos de gravação musical" },
  { label: "Distribuição",       value: "distribution",    description: "Contratos de distribuição digital e física" },
  { label: "Licenciamento",      value: "licensing",   description: "Licenciamento de obras musicais" },
  { label: "Cessão de Direitos", value: "rights_assignment", description: "Cessão total ou parcial de direitos" },
  { label: "Produção",           value: "production",        description: "Contratos de produção artística" },
  { label: "Shows e Eventos",    value: "shows",           description: "Contratos para apresentações ao vivo" },
  { label: "Gestão Artística",   value: "management",          description: "Contratos de representação e gestão" },
  { label: "Exclusividade",      value: "exclusivity",   description: "Contratos com cláusula de exclusividade" },
  { label: "Publicitário",       value: "advertising",    description: "Contratos para uso em publicidade" },
  { label: "Semântico (IA)",     value: "semantic",       description: "Templates gerados com apoio de IA" },
  { label: "Outros",             value: "other",          description: "Categorias diversas" },
];

export const DEFAULT_CATEGORY_LABEL = "Padrão";
export const UNKNOWN_CATEGORY_LABEL = "Categoria não cadastrada";

/**
 * PT-BR label of a contract category slug (`service_type`). The slug is a
 * technical value and is never rendered: an unregistered slug gets a neutral label.
 */
export function contractCategoryLabel(
  categories: ReadonlyArray<Pick<ContractCategory, "value" | "label">>,
  slug: string | null | undefined,
): string {
  if (!slug) return DEFAULT_CATEGORY_LABEL;
  // The registry may still hold the legacy spelling of a platform-owned slug while
  // the API now stores the canonical one (and vice-versa): match both.
  const found = categories.find((c) => c.value === slug) ?? categories.find((c) => sameContractCategory(c.value, slug));
  return found?.label ?? UNKNOWN_CATEGORY_LABEL;
}

function buildSeeds(): ContractCategory[] {
  const now = new Date().toISOString();
  return SEED_CATEGORIES.map((s, i) => ({
    ...s,
    id: `seed-cat-${i + 1}`,
    createdAt: now,
  }));
}

/**
 * Legacy reader: a registry stored by an earlier build holds the Portuguese spelling of the
 * platform-seeded slugs. Rewrites exactly those values to the canonical slug (tenant-created
 * slugs are untouched) and drops a duplicate when both spellings are present.
 */
export function canonicalizeStoredCategories(stored: ReadonlyArray<ContractCategory>): ContractCategory[] {
  const seen = new Set<string>();
  const out: ContractCategory[] = [];
  for (const c of stored) {
    if (!c || typeof c.value !== "string") continue;
    const value = canonicalContractCategorySlug(c.value);
    if (seen.has(value)) continue;
    seen.add(value);
    out.push(value === c.value ? c : { ...c, value });
  }
  return out;
}

function load(): ContractCategory[] {
  const stored = readWithLegacyKeyMigration<ContractCategory[]>(STORAGE_KEY, LEGACY_STORAGE_KEY);
  return Array.isArray(stored) ? canonicalizeStoredCategories(stored) : buildSeeds();
}

function save(cats: ContractCategory[]): void {
  localStore.set(STORAGE_KEY, cats);
}

export function useCategoryRegistry() {
  const [categories, setCategories] = useState<ContractCategory[]>(load);

  useEffect(() => {
    save(categories);
  }, [categories]);

  const addCategory = useCallback(
    (label: string, value?: string, description?: string): ContractCategory => {
      const slug = value?.trim() ? toSlug(value) : toSlug(label);
      const newCat: ContractCategory = {
        id: generateId(),
        label: label.trim(),
        value: slug,
        description: description?.trim() || undefined,
        createdAt: new Date().toISOString(),
      };
      setCategories((prev) => [...prev, newCat]);
      return newCat;
    },
    [],
  );

  const updateCategory = useCallback(
    (
      id: string,
      updates: Partial<Pick<ContractCategory, "label" | "value" | "description">>,
    ) => {
      setCategories((prev) =>
        prev.map((c) => {
          if (c.id !== id) return c;
          const label = updates.label?.trim() ?? c.label;
          const value =
            updates.value !== undefined
              ? toSlug(updates.value) || toSlug(label)
              : c.value;
          return {
            ...c,
            label,
            value,
            description:
              "description" in updates
                ? updates.description?.trim() || undefined
                : c.description,
          };
        }),
      );
    },
    [],
  );

  const removeCategory = useCallback((id: string) => {
    setCategories((prev) => prev.filter((c) => c.id !== id));
  }, []);

  return { categories, addCategory, updateCategory, removeCategory, toSlug };
}
