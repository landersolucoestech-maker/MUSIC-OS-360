import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateProjectDto, PROJECT_DEPRECATED_FIELDS, PROJECT_TRACK_DEPRECATED_FIELDS } from './projects.dto';
import { applyDeprecatedFieldAliases } from '../../../common/compat/deprecated-field-aliases.util';

/**
 * projects.dto.spec.ts
 *
 * Permanent guard (2026-07-18 audit — real bug confirmed): the old
 * DTO used English names (type/artistId/budget/currency/
 * startsAt/deadlineAt/releasedAt) that NEVER matched the real payload
 * sent by ProjetoFormModal.tsx/Projetos.tsx (title/type/status/
 * notes/description/music_genre/artist_id/tracks[]) nor the entity's
 * physical columns (title/type/status/description). With
 * ValidationPipe (whitelist + forbidNonWhitelisted), every project
 * create/edit returned 400. `title` went from legacy name to canonical in the
 * naming normalization (2026-09-05).
 */
async function validatePayload(payload: Record<string, unknown>) {
  const instance = plainToInstance(CreateProjectDto, payload);
  return validate(instance, { whitelist: true, forbidNonWhitelisted: true });
}

const REAL_FORM_PAYLOAD = {
  title: 'Meu Álbum',
  type: 'album',
  notes: 'Notas internas',
  description: null,
  music_genre: 'pop',
  artist_id: '123e4567-e89b-12d3-a456-426614174000',
  tracks: [
    {
      id: 'track-1', name: 'Faixa 1', soloFeat: 'solo', originalRemix: 'original',
      instrumental: 'no', durationMinutes: '3', durationSeconds: '30', genre: 'pop', language: 'pt',
      composers: ['Fulano'], performers: ['Beltrano'], producers: ['Ciclano'], lyrics: 'lalala',
    },
  ],
};

/** The payload the pre-CZ-031 web build sends (deprecated `musicas`, Portuguese track fields). */
const LEGACY_FORM_PAYLOAD = {
  title: 'Meu Álbum',
  type: 'album',
  musicas: [
    {
      id: 'track-1', name: 'Faixa 1', duracaoMin: '3', duracaoSeg: '30', genero: 'pop', idioma: 'pt-BR',
      compositores: ['Fulano'], interpretes: ['Beltrano'], produtores: ['Ciclano'], letra: 'lalala',
    },
  ],
};

describe('CreateProjectDto — real canonical contract (audit 2026-07-18)', () => {
  it('accepts the real form payload (previously rejected entirely by forbidNonWhitelisted)', async () => {
    const errors = await validatePayload(REAL_FORM_PAYLOAD);
    expect(errors).toEqual([]);
  });

  it('rejects the old DTO\'s English names (type/artistId/budget/currency/startsAt/deadlineAt/releasedAt) — "title" became canonical on 2026-09-05', async () => {
    for (const key of ['type', 'artistId', 'budget', 'currency', 'startsAt', 'deadlineAt', 'releasedAt']) {
      const errors = await validatePayload({ ...REAL_FORM_PAYLOAD, [key]: 'x' });
      expect(errors.some((e) => e.property === key)).toBe(true);
    }
  });

  it('still accepts the pre-CZ-031 payload (deprecated musicas) during the deploy-skew window', async () => {
    expect(await validatePayload(LEGACY_FORM_PAYLOAD)).toEqual([]);
  });

  it('accepts a minimal payload (only title/type required)', async () => {
    const errors = await validatePayload({ title: 'X', type: 'single' });
    expect(errors).toEqual([]);
  });

  it('rejects a type outside the real enum', async () => {
    const errors = await validatePayload({ title: 'X', type: 'unknown-type' });
    expect(errors.some((e) => e.property === 'type')).toBe(true);
  });
});

describe('CreateProjectDto — artist_id/budget (GAP-0001 / DEC-001)', () => {
  it('accepts artist_id and budget sent by ProjectFormModal', async () => {
    expect(await validatePayload({ ...REAL_FORM_PAYLOAD, budget: 15000.5 })).toEqual([]);
  });

  it('accepts null artist_id/budget (cleared optional fields)', async () => {
    expect(await validatePayload({ ...REAL_FORM_PAYLOAD, artist_id: null, budget: null })).toEqual([]);
  });

  it('rejects a negative budget on the server (does not rely on the frontend)', async () => {
    const errors = await validatePayload({ ...REAL_FORM_PAYLOAD, budget: -1 });
    expect(errors.map((e) => e.property)).toContain('budget');
  });

  it('still accepts the deprecated orcamento name during the deploy-skew window, with the same validation', async () => {
    expect(await validatePayload({ ...REAL_FORM_PAYLOAD, orcamento: 2500 })).toEqual([]);
    const errors = await validatePayload({ ...REAL_FORM_PAYLOAD, orcamento: -1 });
    expect(errors.map((e) => e.property)).toContain('orcamento');
  });
});

// Explicit static expectations (NOT derived from the tables under test): a renamed/removed/re-targeted legacy key fails here.
const EXPECTED_PROJECT_ALIASES: ReadonlyArray<[string, string, unknown, unknown]> = [
  ['orcamento', 'budget', 1500, 999],
  ['musicas', 'tracks', [{ name: 'legacy' }], [{ name: 'canonical' }]],
];

const EXPECTED_TRACK_ALIASES: ReadonlyArray<[string, string, unknown, unknown]> = [
  ['duracaoMin', 'durationMinutes', '3', '4'],
  ['duracaoSeg', 'durationSeconds', '30', '45'],
  ['genero', 'genre', 'samba', 'rock'],
  ['idioma', 'language', 'pt', 'en'],
  ['letra', 'lyrics', 'letra antiga', 'letra nova'],
  ['compositores', 'composers', ['Fulano'], ['Sicrano']],
  ['interpretes', 'performers', ['Beltrano'], ['Outro']],
  ['produtores', 'producers', ['Ciclano'], ['Terceiro']],
];

describe.each([
  ['PROJECT_DEPRECATED_FIELDS (top level)', PROJECT_DEPRECATED_FIELDS, EXPECTED_PROJECT_ALIASES],
  ['PROJECT_TRACK_DEPRECATED_FIELDS (track item)', PROJECT_TRACK_DEPRECATED_FIELDS, EXPECTED_TRACK_ALIASES],
])('%s - legacy alias table', (_label, table, expected) => {
  it('declares exactly the expected legacy -> canonical pairs', () => {
    expect(table).toEqual(Object.fromEntries(expected.map(([legacy, canonical]) => [legacy, canonical])));
  });

  it.each(expected)('%s is moved to %s when it is the only one sent; the legacy key never survives', (legacy, canonical, legacyValue) => {
    const out = applyDeprecatedFieldAliases({ keep: 1, [legacy]: legacyValue }, table) as Record<string, unknown>;
    expect(out[canonical]).toEqual(legacyValue);
    expect(out).not.toHaveProperty(legacy);
    expect(out['keep']).toBe(1);
  });

  it.each(expected)('%s -> %s: the CANONICAL value wins when both are sent', (legacy, canonical, legacyValue, canonicalValue) => {
    const out = applyDeprecatedFieldAliases({ [legacy]: legacyValue, [canonical]: canonicalValue }, table) as Record<string, unknown>;
    expect(out[canonical]).toEqual(canonicalValue);
    expect(out).not.toHaveProperty(legacy);
  });

  it.each(expected)('%s -> %s: an empty legacy value is dropped, never moved over the stored value', (legacy, canonical) => {
    for (const empty of [null, undefined, '']) {
      const out = applyDeprecatedFieldAliases({ [legacy]: empty }, table) as Record<string, unknown>;
      expect(out[canonical]).toBeUndefined();
      expect(out).not.toHaveProperty(legacy);
    }
  });
});

describe('CreateProjectDto - deprecated top-level properties through the real validation pipeline', () => {
  it('orcamento: accepted and preserved as sent, rejected on exactly that property when malformed', async () => {
    const instance = plainToInstance(CreateProjectDto, { ...REAL_FORM_PAYLOAD, orcamento: '2500' });
    expect(await validate(instance, { whitelist: true, forbidNonWhitelisted: true })).toEqual([]);
    expect(instance.orcamento).toBe(2500);
    const bad = await validatePayload({ ...REAL_FORM_PAYLOAD, orcamento: 'abc' });
    expect(bad.map((e) => e.property)).toEqual(['orcamento']);
  });

  it('musicas: accepted and preserved (items untouched), rejected on exactly that property when it is not an array', async () => {
    const instance = plainToInstance(CreateProjectDto, LEGACY_FORM_PAYLOAD);
    expect(await validate(instance, { whitelist: true, forbidNonWhitelisted: true })).toEqual([]);
    expect(instance.musicas).toHaveLength(1);
    expect(instance.musicas![0]).toMatchObject({ duracaoMin: '3', duracaoSeg: '30', genero: 'pop', letra: 'lalala', compositores: ['Fulano'], interpretes: ['Beltrano'], produtores: ['Ciclano'] });
    const bad = await validatePayload({ title: 'X', type: 'album', musicas: 'not-an-array' });
    expect(bad.map((e) => e.property)).toEqual(['musicas']);
  });
});
