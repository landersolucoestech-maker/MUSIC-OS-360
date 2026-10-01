import type { ContractVariable, EntityType, MusicWork, Participant, VariableCategory } from "@/modules/contracts/types/contracts.types";

/**
 * Canonical (English) machine values of the contract template builder. User-facing labels stay PT-BR
 * (`CATEGORY_LABELS`, field labels). The template placeholders themselves (`{{CONTRATANTE_NOME_COMPLETO}}`,
 * participant role keys) are user-authored product vocabulary and are NOT part of this boundary.
 *
 * Persisted shape: `contract_service_types.variables` / `participants` / `music_work` are jsonb written by
 * earlier builds with the Portuguese spellings below. These maps are READ compatibility only; every
 * write is canonical.
 * Removal condition: no persisted variables[*].category, participants[*].entityType or
 * music_work.distributionType holds a key of the LEGACY_* maps for one release window.
 */
export const LEGACY_VARIABLE_CATEGORIES: Readonly<Record<string, VariableCategory>> = {
  participantes: "participants",
  financeiro: "financial",
  obra_musical: "musical_work",
  vigencia: "term",
  assinatura: "signature",
  sistema: "system",
  personalizada: "custom",
};

export const LEGACY_ENTITY_TYPES: Readonly<Record<string, EntityType>> = {
  pessoa_fisica: "individual",
  pessoa_juridica: "company",
};

export const LEGACY_DISTRIBUTION_TYPES: Readonly<Record<string, NonNullable<MusicWork["distributionType"]>>> = {
  exclusiva: "exclusive",
  nao_exclusiva: "non_exclusive",
  licenca: "license",
};

function canonical<T extends string>(map: Readonly<Record<string, T>>, value: unknown): unknown {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(map, value) ? map[value] : value;
}

export const canonicalVariableCategory = (v: unknown) => canonical(LEGACY_VARIABLE_CATEGORIES, v) as VariableCategory;
export const canonicalEntityType = (v: unknown) => canonical(LEGACY_ENTITY_TYPES, v) as EntityType;
export const canonicalDistributionType = (v: unknown) => canonical(LEGACY_DISTRIBUTION_TYPES, v) as MusicWork["distributionType"];

/** Canonicalizes the persisted `variables` jsonb (non-array input and non-object members are returned untouched). */
export function canonicalizeStoredVariables(variables: ContractVariable[]): ContractVariable[] {
  if (!Array.isArray(variables)) return variables;
  return variables.map((v) => (v && typeof v === "object" ? { ...v, category: canonicalVariableCategory(v.category) } : v));
}

/** Canonicalizes the persisted `participants` jsonb (entityType, and its nested variables). */
export function canonicalizeStoredParticipants(participants: Participant[]): Participant[] {
  if (!Array.isArray(participants)) return participants;
  return participants.map((p) =>
    p && typeof p === "object"
      ? {
          ...p,
          entityType: canonicalEntityType(p.entityType),
          ...(Array.isArray(p.variables) ? { variables: canonicalizeStoredVariables(p.variables) } : {}),
        }
      : p,
  );
}

/** Canonicalizes the persisted `music_work` jsonb. */
export function canonicalizeStoredMusicWork(work: MusicWork | null): MusicWork | null {
  if (!work || typeof work !== "object") return work;
  return "distributionType" in work ? { ...work, distributionType: canonicalDistributionType(work.distributionType) } : work;
}
