import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { ArtistGoalStatus } from '@music-os-360/types';
import { CreateArtistGoalDto } from './dto/create-artist-goal.dto';
import {
  GOAL_PERIODS,
  GOAL_STATUSES,
  GOAL_TYPES,
  LEGACY_GOAL_CATEGORIES,
  LEGACY_GOAL_PERIODS,
  LEGACY_GOAL_STATUSES,
  LEGACY_GOAL_TYPES,
  normalizeArtistGoalInput,
} from './artist-goal-legacy.mapper';

describe('artist goal legacy compatibility (migration 20260928000001)', () => {
  it('maps every deprecated value to a canonical English value', () => {
    for (const value of Object.values(LEGACY_GOAL_TYPES)) expect(GOAL_TYPES).toContain(value);
    for (const value of Object.values(LEGACY_GOAL_PERIODS)) expect(GOAL_PERIODS).toContain(value);
    for (const value of Object.values(LEGACY_GOAL_STATUSES)) expect(GOAL_STATUSES).toContain(value);
  });

  it('normalizes the deprecated field, values and metadata keys to the canonical contract', () => {
    expect(
      normalizeArtistGoalInput({
        type: 'receita',
        periodo: 'mensal',
        status: 'em_progresso',
        metadata: { descricao: 'Meta anual', categoria: 'financeiro', unidade: 'R$', cor: '#fff', icone: 'target', responsavel: 'Ana' },
      }),
    ).toEqual({
      type: 'revenue',
      period: 'monthly',
      status: ArtistGoalStatus.IN_PROGRESS,
      metadata: { description: 'Meta anual', category: 'financial', unit: 'R$', color: '#fff', icon: 'target', owner: 'Ana' },
    });
  });

  it('keeps the canonical field when both the canonical and the deprecated name are sent', () => {
    expect(normalizeArtistGoalInput({ period: 'weekly', periodo: 'mensal' })).toEqual({ period: 'weekly' });
    expect(normalizeArtistGoalInput({ metadata: { description: 'new', descricao: 'old' } })).toEqual({
      metadata: { description: 'new' },
    });
  });

  it('leaves canonical input unchanged', () => {
    const input = {
      type: 'followers',
      period: 'quarterly',
      status: ArtistGoalStatus.COMPLETED,
      metadata: { description: 'x', category: 'marketing', unit: 'fans' },
    };
    expect(normalizeArtistGoalInput(input)).toEqual(input);
  });

  it('maps every legacy category value', () => {
    for (const [legacy, canonical] of Object.entries(LEGACY_GOAL_CATEGORIES)) {
      expect(normalizeArtistGoalInput({ metadata: { categoria: legacy } })).toEqual({ metadata: { category: canonical } });
    }
  });

  describe('CreateArtistGoalDto', () => {
    const base = { artist_id: '123e4567-e89b-12d3-a456-426614174000', title: 'Streams' };
    const errorsFor = (plain: Record<string, unknown>) =>
      validateSync(plainToInstance(CreateArtistGoalDto, plain)).map((e) => e.property);

    it('accepts the canonical payload', () => {
      expect(errorsFor({ ...base, type: 'streams', period: 'monthly', status: 'in_progress' })).toEqual([]);
    });

    it('accepts the deprecated payload during the compatibility window', () => {
      expect(errorsFor({ ...base, type: 'seguidores', periodo: 'mensal', status: 'concluida' })).toEqual([]);
    });

    it('rejects a status the database would reject instead of failing at the CHECK constraint', () => {
      expect(errorsFor({ ...base, type: 'streams', status: 'pausada' })).toContain('status');
    });

    it('rejects an unknown goal type', () => {
      expect(errorsFor({ ...base, type: 'likes' })).toContain('type');
    });
  });
});
