import { BadRequestException } from '@nestjs/common';
import {
  resolvePhonogramAliases,
  resolvePhonogramQueryAliases,
} from './phonogram-legacy-alias.util';

function errorBody(fn: () => unknown): { code: string; message: string; fields?: unknown } {
  try {
    fn();
  } catch (e) {
    if (e instanceof BadRequestException) {
      return e.getResponse() as { code: string; message: string; fields?: unknown };
    }
    throw e;
  }
  throw new Error('expected BadRequestException to be thrown');
}

const UUID_A = '123e4567-e89b-12d3-a456-426614174000';
const UUID_A_UPPER = '123E4567-E89B-12D3-A456-426614174000';
const UUID_B = '223e4567-e89b-12d3-a456-426614174000';

describe('phonogram-legacy-alias.util', () => {
  describe('resolvePhonogramAliases — title/titulo', () => {
    it('EN only: returns title, no legacy alias', () => {
      const { normalized, legacyAliasesUsed } = resolvePhonogramAliases({ title: 'Nome EN' });
      expect(normalized.title).toBe('Nome EN');
      expect(legacyAliasesUsed).not.toContain('titulo');
    });

    it('PT only (legacy): returns title with the value of titulo, records alias', () => {
      const { normalized, legacyAliasesUsed } = resolvePhonogramAliases({ titulo: 'Nome PT' });
      expect(normalized.title).toBe('Nome PT');
      expect(legacyAliasesUsed).toContain('titulo');
    });

    it('both equivalent (equal after trim): EN wins, original EN value persisted, alias recorded', () => {
      const { normalized, legacyAliasesUsed } = resolvePhonogramAliases({
        title: 'Nome', titulo: '  Nome  ',
      });
      expect(normalized.title).toBe('Nome');
      expect(legacyAliasesUsed).toContain('titulo');
    });

    it('both conflicting: throws PHONOGRAM_ALIAS_CONFLICT with correct fields', () => {
      const body = errorBody(() => resolvePhonogramAliases({ title: 'A', titulo: 'B' }));
      expect(body.code).toBe('PHONOGRAM_ALIAS_CONFLICT');
      expect(body.fields).toEqual([{ canonical: 'title', legacy: 'titulo' }]);
    });

    it('explicit undefined titulo: treated as absent (does not conflict, does not throw)', () => {
      const { normalized } = resolvePhonogramAliases({ title: 'Nome', titulo: undefined });
      expect(normalized.title).toBe('Nome');
    });

    it('total absence: title stays undefined in the result', () => {
      const { normalized } = resolvePhonogramAliases({});
      expect(normalized.title).toBeUndefined();
    });

    it('null title: invalid (PHONOGRAM_TITLE_INVALID)', () => {
      const body = errorBody(() => resolvePhonogramAliases({ title: null }));
      expect(body.code).toBe('PHONOGRAM_TITLE_INVALID');
    });

    it('empty title: invalid', () => {
      const body = errorBody(() => resolvePhonogramAliases({ title: '' }));
      expect(body.code).toBe('PHONOGRAM_TITLE_INVALID');
    });

    it('title with only spaces: invalid', () => {
      const body = errorBody(() => resolvePhonogramAliases({ title: '   ' }));
      expect(body.code).toBe('PHONOGRAM_TITLE_INVALID');
    });

    it('empty titulo (alias): also invalid', () => {
      const body = errorBody(() => resolvePhonogramAliases({ titulo: '' }));
      expect(body.code).toBe('PHONOGRAM_TITLE_INVALID');
    });

    it('does not silently trim the saved value (persists original string with internal/external spaces preserved when only one side is sent)', () => {
      const { normalized } = resolvePhonogramAliases({ title: '  Nome Com Espaço  ' });
      expect(normalized.title).toBe('  Nome Com Espaço  ');
    });

    it('error message does not include the title content', () => {
      const body = errorBody(() => resolvePhonogramAliases({ title: 'ValorSecreto', titulo: 'OutroValor' }));
      expect(JSON.stringify(body)).not.toContain('ValorSecreto');
      expect(JSON.stringify(body)).not.toContain('OutroValor');
    });
  });

  describe.each([
    ['work_id', 'workId', 'work_id' as const],
    ['artist_id', 'artistId', 'artist_id' as const],
  ])('resolvePhonogramAliases — %s/%s', (canonical, legacy, key) => {
    it('PT only: returns the value, no legacy alias', () => {
      const { normalized, legacyAliasesUsed } = resolvePhonogramAliases({ [canonical]: UUID_A });
      expect(normalized[key]).toBe(UUID_A);
      expect(legacyAliasesUsed).not.toContain(legacy);
    });

    it('EN only: returns the value, records alias', () => {
      const { normalized, legacyAliasesUsed } = resolvePhonogramAliases({ [legacy]: UUID_A });
      expect(normalized[key]).toBe(UUID_A);
      expect(legacyAliasesUsed).toContain(legacy);
    });

    it('both equal (case-insensitive): accepts, persists the original value from the PT side, alias recorded', () => {
      const { normalized, legacyAliasesUsed } = resolvePhonogramAliases({
        [canonical]: UUID_A, [legacy]: UUID_A_UPPER,
      });
      expect(normalized[key]).toBe(UUID_A);
      expect(legacyAliasesUsed).toContain(legacy);
    });

    it('both different: PHONOGRAM_ALIAS_CONFLICT', () => {
      const body = errorBody(() => resolvePhonogramAliases({ [canonical]: UUID_A, [legacy]: UUID_B }));
      expect(body.code).toBe('PHONOGRAM_ALIAS_CONFLICT');
      expect(body.fields).toEqual([{ canonical, legacy }]);
    });

    it('both null: equivalent, alias recorded, null value', () => {
      const { normalized, legacyAliasesUsed } = resolvePhonogramAliases({
        [canonical]: null, [legacy]: null,
      });
      expect(normalized[key]).toBeNull();
      expect(legacyAliasesUsed).toContain(legacy);
    });

    it('PT null + valid EN: conflict', () => {
      const body = errorBody(() => resolvePhonogramAliases({ [canonical]: null, [legacy]: UUID_A }));
      expect(body.code).toBe('PHONOGRAM_ALIAS_CONFLICT');
    });

    it('valid PT + EN null: conflict', () => {
      const body = errorBody(() => resolvePhonogramAliases({ [canonical]: UUID_A, [legacy]: null }));
      expect(body.code).toBe('PHONOGRAM_ALIAS_CONFLICT');
    });

    it('explicit undefined EN alias: treated as absent', () => {
      const { normalized } = resolvePhonogramAliases({ [canonical]: UUID_A, [legacy]: undefined });
      expect(normalized[key]).toBe(UUID_A);
    });

    it('total absence: stays undefined in the result', () => {
      const { normalized } = resolvePhonogramAliases({});
      expect(normalized[key]).toBeUndefined();
    });

    it('invalid UUID on the PT side: PHONOGRAM_UUID_INVALID', () => {
      const body = errorBody(() => resolvePhonogramAliases({ [canonical]: 'nao-e-uuid' }));
      expect(body.code).toBe('PHONOGRAM_UUID_INVALID');
    });

    it('invalid UUID on the EN side: PHONOGRAM_UUID_INVALID', () => {
      const body = errorBody(() => resolvePhonogramAliases({ [legacy]: 'nao-e-uuid' }));
      expect(body.code).toBe('PHONOGRAM_UUID_INVALID');
    });

    it('error message does not include the received UUID', () => {
      const body = errorBody(() => resolvePhonogramAliases({ [canonical]: UUID_A, [legacy]: UUID_B }));
      expect(JSON.stringify(body)).not.toContain(UUID_A);
      expect(JSON.stringify(body)).not.toContain(UUID_B);
    });
  });

  describe('resolvePhonogramQueryAliases — work_id/workId and artist_id/artistId', () => {
    it('work_id alone: accepted', () => {
      const { normalized } = resolvePhonogramQueryAliases({ work_id: UUID_A });
      expect(normalized.work_id).toBe(UUID_A);
    });

    it('workId alone: accepted, alias recorded', () => {
      const { normalized, legacyAliasesUsed } = resolvePhonogramQueryAliases({ workId: UUID_A });
      expect(normalized.work_id).toBe(UUID_A);
      expect(legacyAliasesUsed).toContain('workId');
    });

    it('work_id and workId equal: accepted', () => {
      const { normalized } = resolvePhonogramQueryAliases({ work_id: UUID_A, workId: UUID_A });
      expect(normalized.work_id).toBe(UUID_A);
    });

    it('work_id and workId different: 400', () => {
      const body = errorBody(() => resolvePhonogramQueryAliases({ work_id: UUID_A, workId: UUID_B }));
      expect(body.code).toBe('PHONOGRAM_ALIAS_CONFLICT');
    });

    it('artist_id alone: accepted', () => {
      const { normalized } = resolvePhonogramQueryAliases({ artist_id: UUID_A });
      expect(normalized.artist_id).toBe(UUID_A);
    });

    it('artistId alone: accepted, alias recorded', () => {
      const { normalized, legacyAliasesUsed } = resolvePhonogramQueryAliases({ artistId: UUID_A });
      expect(normalized.artist_id).toBe(UUID_A);
      expect(legacyAliasesUsed).toContain('artistId');
    });

    it('artist_id and artistId equal: accepted', () => {
      const { normalized } = resolvePhonogramQueryAliases({ artist_id: UUID_A, artistId: UUID_A });
      expect(normalized.artist_id).toBe(UUID_A);
    });

    it('artist_id and artistId different: 400', () => {
      const body = errorBody(() => resolvePhonogramQueryAliases({ artist_id: UUID_A, artistId: UUID_B }));
      expect(body.code).toBe('PHONOGRAM_ALIAS_CONFLICT');
    });

    it('total absence: empty normalized, no aliases', () => {
      const { normalized, legacyAliasesUsed } = resolvePhonogramQueryAliases({});
      expect(normalized.work_id).toBeUndefined();
      expect(normalized.artist_id).toBeUndefined();
      expect(legacyAliasesUsed).toEqual([]);
    });

    it('does not process titulo/title — confirmed by not throwing and not returning those fields even if present in the input', () => {
      const { normalized } = resolvePhonogramQueryAliases({ titulo: 'X', title: 'Y qualquer coisa' } as unknown as Record<string, unknown>);
      expect(normalized).not.toHaveProperty('titulo');
      expect(normalized).not.toHaveProperty('title');
    });

    it('conflicting titulo/title in the query input do NOT throw an error (query function ignores them)', () => {
      expect(() =>
        resolvePhonogramQueryAliases({ titulo: 'A', title: 'B' } as unknown as Record<string, unknown>),
      ).not.toThrow();
    });
  });
});
