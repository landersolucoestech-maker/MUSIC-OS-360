import {
  LEGACY_GOAL_CATEGORIES,
  LEGACY_GOAL_PERIODS,
  LEGACY_GOAL_STATUSES,
  LEGACY_GOAL_TYPES,
  LEGACY_METADATA_KEYS,
  normalizeArtistGoalInput,
} from './artist-goal-legacy.mapper';

// Deprecated artist goal vocabulary stays accepted (compatibility window) and is mapped to the canonical contract.
describe('artist goal legacy mapper (legacy in, canonical out)', () => {
  it.each([
    ['seguidores', 'followers'],
    ['receita', 'revenue'],
    ['engajamento', 'engagement'],
    ['lancamentos', 'releases'],
    ['eventos', 'shows'],
    ['outros', 'other'],
    ['personalizada', 'other'],
  ])('type %s -> %s', (legacy, canonical) => {
    expect(normalizeArtistGoalInput({ type: legacy }).type).toBe(canonical);
    expect(LEGACY_GOAL_TYPES[legacy]).toBe(canonical);
  });

  it.each([
    ['semanal', 'weekly'],
    ['mensal', 'monthly'],
    ['trimestral', 'quarterly'],
    ['semestral', 'semiannual'],
    ['anual', 'yearly'],
  ])('period %s -> %s (also through the deprecated field periodo)', (legacy, canonical) => {
    expect(normalizeArtistGoalInput({ period: legacy }).period).toBe(canonical);
    const moved = normalizeArtistGoalInput({ periodo: legacy });
    expect(moved.period).toBe(canonical);
    expect(moved).not.toHaveProperty('periodo');
    expect(LEGACY_GOAL_PERIODS[legacy]).toBe(canonical);
  });

  it.each([
    ['em_progresso', 'in_progress'],
    ['em_andamento', 'in_progress'],
    ['ativa', 'in_progress'],
    ['concluida', 'completed'],
    ['concluido', 'completed'],
    ['cancelada', 'cancelled'],
    ['cancelado', 'cancelled'],
    ['expirada', 'expired'],
    ['expirado', 'expired'],
  ])('status %s -> %s', (legacy, canonical) => {
    expect(normalizeArtistGoalInput({ status: legacy }).status).toBe(canonical);
    expect(LEGACY_GOAL_STATUSES[legacy]).toBe(canonical);
  });

  it.each([
    ['descricao', 'description'],
    ['categoria', 'category'],
    ['unidade', 'unit'],
    ['responsavel', 'owner'],
    ['cor', 'color'],
    ['icone', 'icon'],
  ])('metadata key %s -> %s', (legacy, canonical) => {
    const out = normalizeArtistGoalInput({ metadata: { [legacy]: 'x' } }).metadata as Record<string, unknown>;
    expect(out[canonical]).toBe('x');
    expect(out).not.toHaveProperty(legacy);
    expect(LEGACY_METADATA_KEYS[legacy]).toBe(canonical);
  });

  it.each([
    ['crescimento', 'growth'],
    ['financeiro', 'financial'],
    ['producao', 'production'],
    ['carreira', 'career'],
  ])('metadata category value %s -> %s', (legacy, canonical) => {
    const out = normalizeArtistGoalInput({ metadata: { categoria: legacy } }).metadata as Record<string, unknown>;
    expect(out.category).toBe(canonical);
    expect(LEGACY_GOAL_CATEGORIES[legacy]).toBe(canonical);
  });

  it('the canonical field wins over the deprecated one and unknown values pass through', () => {
    expect(normalizeArtistGoalInput({ periodo: 'mensal', period: 'yearly' }).period).toBe('yearly');
    expect(normalizeArtistGoalInput({ type: 'streams' }).type).toBe('streams');
    expect(normalizeArtistGoalInput({ type: 'unknown_type' }).type).toBe('unknown_type');
  });
});
