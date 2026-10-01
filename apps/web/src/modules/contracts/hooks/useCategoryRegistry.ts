import { useState, useEffect, useCallback } from "react";
import { localStore } from "@/shared/lib/local-store";
import { sameContractCategory } from "@/modules/contracts/lib/contract-category-slugs";

const STORAGE_KEY = "contract_categories";

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
  { label: "Gravação",           value: "gravacao",        description: "Contratos de gravação musical" },
  { label: "Distribuição",       value: "distribuicao",    description: "Contratos de distribuição digital e física" },
  { label: "Licenciamento",      value: "licenciamento",   description: "Licenciamento de obras musicais" },
  { label: "Cessão de Direitos", value: "cessao_direitos", description: "Cessão total ou parcial de direitos" },
  { label: "Produção",           value: "producao",        description: "Contratos de produção artística" },
  { label: "Shows e Eventos",    value: "shows",           description: "Contratos para apresentações ao vivo" },
  { label: "Gestão Artística",   value: "gestao",          description: "Contratos de representação e gestão" },
  { label: "Exclusividade",      value: "exclusividade",   description: "Contratos com cláusula de exclusividade" },
  { label: "Publicitário",       value: "publicitario",    description: "Contratos para uso em publicidade" },
  { label: "Semântico (IA)",     value: "semantico",       description: "Templates gerados com apoio de IA" },
  { label: "Outros",             value: "outros",          description: "Categorias diversas" },
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

function load(): ContractCategory[] {
  return localStore.get<ContractCategory[]>(STORAGE_KEY) ?? buildSeeds();
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
