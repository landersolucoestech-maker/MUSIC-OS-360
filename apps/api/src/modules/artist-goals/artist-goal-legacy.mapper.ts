/**
 * artist-goal-legacy.mapper.ts
 *
 * Compatibility window for the artist_goals canonicalization
 * (migration 20260928000001). The canonical technical contract is English:
 *   fields    period (was periodo)
 *   values    type ∈ GOAL_TYPES, period ∈ GOAL_PERIODS, status ∈ ArtistGoalStatus
 *   metadata  description, category (∈ GOAL_CATEGORIES), unit, owner, color, icon
 * A web build released before that change still sends the Portuguese field,
 * values and metadata keys. They are accepted as deprecated input and
 * normalized here — the only place that knows the legacy vocabulary — so
 * nothing past the controller ever sees a Portuguese technical value.
 * Responses are canonical only.
 *
 * Remove once a web release that sends the canonical contract is deployed to
 * every environment (see the canonical naming map exception ledger).
 */
import { ArtistGoalStatus } from '@music-os-360/types';

export const GOAL_TYPES = ['streams', 'followers', 'shows', 'revenue', 'engagement', 'releases', 'other'] as const;
export type GoalType = (typeof GOAL_TYPES)[number];

export const GOAL_PERIODS = ['weekly', 'monthly', 'quarterly', 'semiannual', 'yearly'] as const;
export type GoalPeriod = (typeof GOAL_PERIODS)[number];

export const GOAL_STATUSES = Object.values(ArtistGoalStatus) as string[];

export const LEGACY_GOAL_TYPES: Readonly<Record<string, GoalType>> = {
  seguidores: 'followers',
  receita: 'revenue',
  engajamento: 'engagement',
  lancamentos: 'releases',
  eventos: 'shows',
  outros: 'other',
  personalizada: 'other',
};

export const LEGACY_GOAL_PERIODS: Readonly<Record<string, GoalPeriod>> = {
  semanal: 'weekly',
  mensal: 'monthly',
  trimestral: 'quarterly',
  semestral: 'semiannual',
  anual: 'yearly',
};

/** Status values the pre-canonical web goal forms sent (the CHECK constraint always rejected them). */
export const LEGACY_GOAL_STATUSES: Readonly<Record<string, ArtistGoalStatus>> = {
  em_progresso: ArtistGoalStatus.IN_PROGRESS,
  em_andamento: ArtistGoalStatus.IN_PROGRESS,
  ativa: ArtistGoalStatus.IN_PROGRESS,
  concluida: ArtistGoalStatus.COMPLETED,
  concluido: ArtistGoalStatus.COMPLETED,
  cancelada: ArtistGoalStatus.CANCELLED,
  cancelado: ArtistGoalStatus.CANCELLED,
  expirada: ArtistGoalStatus.EXPIRED,
  expirado: ArtistGoalStatus.EXPIRED,
};

export const LEGACY_METADATA_KEYS: Readonly<Record<string, string>> = {
  descricao: 'description',
  categoria: 'category',
  unidade: 'unit',
  responsavel: 'owner',
  cor: 'color',
  icone: 'icon',
};

export const LEGACY_GOAL_CATEGORIES: Readonly<Record<string, string>> = {
  crescimento: 'growth',
  financeiro: 'financial',
  producao: 'production',
  carreira: 'career',
};

/** Values the DTO accepts during the compatibility window (canonical + deprecated). */
export const ACCEPTED_GOAL_TYPES = [...GOAL_TYPES, ...Object.keys(LEGACY_GOAL_TYPES)];
export const ACCEPTED_GOAL_PERIODS = [...GOAL_PERIODS, ...Object.keys(LEGACY_GOAL_PERIODS)];
export const ACCEPTED_GOAL_STATUSES = [...GOAL_STATUSES, ...Object.keys(LEGACY_GOAL_STATUSES)];

function normalizeMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...metadata };
  for (const [legacy, canonical] of Object.entries(LEGACY_METADATA_KEYS)) {
    if (out[legacy] === undefined) continue;
    if (out[canonical] === undefined) out[canonical] = out[legacy];
    delete out[legacy];
  }
  if (typeof out['category'] === 'string') out['category'] = LEGACY_GOAL_CATEGORIES[out['category']] ?? out['category'];
  return out;
}

/**
 * Normalizes a create/update payload to the canonical contract: the deprecated
 * field name moves to its canonical name (the canonical field wins when both
 * are sent) and deprecated values and metadata keys are mapped.
 */
export function normalizeArtistGoalInput(input: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...input };
  if (out['periodo'] !== undefined) {
    if (out['period'] === undefined) out['period'] = out['periodo'];
    delete out['periodo'];
  }
  if (typeof out['period'] === 'string') out['period'] = LEGACY_GOAL_PERIODS[out['period']] ?? out['period'];
  if (typeof out['type'] === 'string') out['type'] = LEGACY_GOAL_TYPES[out['type']] ?? out['type'];
  if (typeof out['status'] === 'string') out['status'] = LEGACY_GOAL_STATUSES[out['status']] ?? out['status'];
  if (out['metadata'] && typeof out['metadata'] === 'object' && !Array.isArray(out['metadata'])) {
    out['metadata'] = normalizeMetadata(out['metadata'] as Record<string, unknown>);
  }
  return out;
}
