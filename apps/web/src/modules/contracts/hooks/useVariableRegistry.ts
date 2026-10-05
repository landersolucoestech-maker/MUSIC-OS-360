import { useState, useEffect, useCallback } from "react";
import { localStore } from "@/shared/lib/local-store";
import { readWithLegacyKeyMigration } from "@/modules/contracts/lib/local-key-migration";

const STORAGE_KEY = "musicos360_variable_registry";
// Key used before the `musicos360_` prefix; read once and migrated to STORAGE_KEY.
const LEGACY_STORAGE_KEY = "variable_registry";

export interface RegistryVariable {
  id: string;
  name: string;
  group: string;
  field: string;
  placeholder: string;
  internalGroup?: string;
  createdAt: string;
}

function generateId(): string {
  return `rv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ── Default seed variables ────────────────────────────────────────────────
// Loaded on first use (localStorage empty). Shows the Alias / internalGroup model.

const SEED_VARIABLES: Omit<RegistryVariable, "id" | "createdAt">[] = [
  // ARTISTA (artist)
  { name: "Nome do Artista",        group: "ARTISTA",    field: "NAME",        placeholder: "{{ARTISTA.NAME}}",        internalGroup: "artist" },
  { name: "CPF do Artista",         group: "ARTISTA",    field: "CPF",         placeholder: "{{ARTISTA.CPF}}",         internalGroup: "artist" },
  { name: "E-mail do Artista",      group: "ARTISTA",    field: "EMAIL",       placeholder: "{{ARTISTA.EMAIL}}",       internalGroup: "artist" },
  { name: "CNPJ do Artista",        group: "ARTISTA",    field: "CNPJ",        placeholder: "{{ARTISTA.CNPJ}}",        internalGroup: "artist" },
  // GRAVADORA (label)
  { name: "Nome da Gravadora",      group: "GRAVADORA",  field: "NAME",        placeholder: "{{GRAVADORA.NAME}}",      internalGroup: "label" },
  { name: "CNPJ da Gravadora",      group: "GRAVADORA",  field: "CNPJ",        placeholder: "{{GRAVADORA.CNPJ}}",      internalGroup: "label" },
  // LICENCIANTE group (licensor)
  { name: "Nome do Licenciante",    group: "LICENCIANTE", field: "NAME",       placeholder: "{{LICENCIANTE.NAME}}",    internalGroup: "licensor" },
  { name: "CPF do Licenciante",     group: "LICENCIANTE", field: "CPF",        placeholder: "{{LICENCIANTE.CPF}}",     internalGroup: "licensor" },
  // CONTRATANTE (contractor)
  { name: "Nome do Contratante",    group: "CONTRATANTE", field: "NAME",       placeholder: "{{CONTRATANTE.NAME}}",    internalGroup: "contractor" },
  { name: "CPF do Contratante",     group: "CONTRATANTE", field: "CPF",        placeholder: "{{CONTRATANTE.CPF}}",     internalGroup: "contractor" },
];

function buildSeeds(): RegistryVariable[] {
  const now = new Date().toISOString();
  return SEED_VARIABLES.map((s, i) => ({
    ...s,
    id: `seed-${i + 1}`,
    createdAt: now,
  }));
}

function load(): RegistryVariable[] {
  // Seeds only on first use — null key = never written.
  // An empty array is valid user state and must not be replaced with seeds.
  const stored = readWithLegacyKeyMigration<RegistryVariable[]>(STORAGE_KEY, LEGACY_STORAGE_KEY);
  return stored !== null ? stored : buildSeeds();
}

function save(vars: RegistryVariable[]): void {
  localStore.set(STORAGE_KEY, vars);
}

export function useVariableRegistry() {
  const [variables, setVariables] = useState<RegistryVariable[]>(load);

  useEffect(() => {
    save(variables);
  }, [variables]);

  const addVariable = useCallback(
    (name: string, group: string, field: string, internalGroup?: string): RegistryVariable => {
      const normalGroup = group.toUpperCase().replace(/[^A-Z0-9_]/g, "_");
      const normalField = field.toUpperCase().replace(/[^A-Z0-9_]/g, "_");
      const placeholder = `{{${normalGroup}.${normalField}}}`;
      const newVar: RegistryVariable = {
        id: generateId(),
        name: name.trim(),
        group: normalGroup,
        field: normalField,
        placeholder,
        internalGroup: internalGroup?.trim() || undefined,
        createdAt: new Date().toISOString(),
      };
      setVariables((prev) => [...prev, newVar]);
      return newVar;
    },
    [],
  );

  const updateVariable = useCallback(
    (
      id: string,
      updates: Partial<Pick<RegistryVariable, "name" | "group" | "field" | "internalGroup">>,
    ) => {
      setVariables((prev) =>
        prev.map((v) => {
          if (v.id !== id) return v;
          const group = (updates.group ?? v.group).toUpperCase().replace(/[^A-Z0-9_]/g, "_");
          const field = (updates.field ?? v.field).toUpperCase().replace(/[^A-Z0-9_]/g, "_");
          const internalGroup =
            "internalGroup" in updates
              ? (updates.internalGroup?.trim() || undefined)
              : v.internalGroup;
          return {
            ...v,
            name: updates.name?.trim() ?? v.name,
            group,
            field,
            placeholder: `{{${group}.${field}}}`,
            internalGroup,
          };
        }),
      );
    },
    [],
  );

  const removeVariable = useCallback((id: string) => {
    setVariables((prev) => prev.filter((v) => v.id !== id));
  }, []);

  const removeVariables = useCallback((ids: string[]) => {
    const set = new Set(ids);
    setVariables((prev) => prev.filter((v) => !set.has(v.id)));
  }, []);

  /**
   * Merge incoming variables into the registry.
   * Skips entries whose `placeholder` already exists (case-insensitive).
   * Regenerates `id` and `createdAt` for each imported entry.
   * Returns { added, skipped } counts.
   */
  const importVariables = useCallback(
    (incoming: RegistryVariable[]): { added: number; skipped: number } => {
      let added = 0;
      let skipped = 0;
      setVariables((prev) => {
        const existingPlaceholders = new Set(
          prev.map((v) => v.placeholder.toLowerCase()),
        );
        const toAdd: RegistryVariable[] = [];
        for (const v of incoming) {
          if (existingPlaceholders.has(v.placeholder.toLowerCase())) {
            skipped++;
          } else {
            existingPlaceholders.add(v.placeholder.toLowerCase());
            toAdd.push({
              ...v,
              id: generateId(),
              createdAt: new Date().toISOString(),
            });
            added++;
          }
        }
        return [...prev, ...toAdd];
      });
      return { added, skipped };
    },
    [],
  );

  return { variables, addVariable, updateVariable, removeVariable, removeVariables, importVariables };
}

