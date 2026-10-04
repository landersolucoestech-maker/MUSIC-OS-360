import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { canonicalizeWorkInput } from '../work-legacy-fields';
import { CreateWorkDto } from './create-work.dto';

describe('CreateWorkDto legacy fields (legacy in, canonical out)', () => {
  it.each([['editora', 'publisher_name', 'Editora Musical']])('accepts %s and maps it to %s', async (legacy, canonical, value) => {
    const payload = { title: 'Obra', [legacy]: value };
    const errors = await validate(plainToInstance(CreateWorkDto, payload), { whitelist: true, forbidNonWhitelisted: true });
    expect(errors.filter((e) => e.property === legacy)).toEqual([]);
    const moved = canonicalizeWorkInput(payload) as Record<string, unknown>;
    expect(moved[canonical]).toBe(value);
    expect(moved).not.toHaveProperty(legacy);
  });

  it('rejects a non-string legacy editora', async () => {
    const errors = await validate(plainToInstance(CreateWorkDto, { title: 'O', editora: 5 }));
    expect(errors.map((e) => e.property)).toContain('editora');
  });
});

// Every deprecated Portuguese property of CreateWorkDto: a pre-CZ-039 web build still sends it, so it must be a declared and
// validated property (a renamed/removed one is rejected as "unknown" under whitelist + forbidNonWhitelisted), a wrong value must be
// refused by its OWN validator, and the value must reach the canonical field through the real mapper.
describe('CreateWorkDto deprecated properties: declared, validated by their own validator, mapped to the canonical field', () => {
  const strict = { whitelist: true, forbidNonWhitelisted: true } as const;
  const errorsOf = (payload: Record<string, unknown>) => validate(plainToInstance(CreateWorkDto, payload), strict);

  // [legacy, canonical, good legacy value, expected canonical value, bad value, constraint that must reject the bad value]
  const CASES: Array<[string, string, unknown, unknown, unknown, string]> = [
    ['compositor', 'composer_name', 'Fulano', 'Fulano', 5, 'isString'],
    ['compositores', 'composer_names', ['Fulano'], ['Fulano'], 'Fulano', 'isArray'],
    ['editora', 'publisher_name', 'Editora', 'Editora', 5, 'isString'],
    ['idioma', 'language', 'Inglês', 'en', 'x'.repeat(51), 'maxLength'],
    ['cod_ecad', 'ecad_code', 'ECAD-1', 'ECAD-1', 5, 'isString'],
    ['cod_entidade', 'society_code', 'ABR-1', 'ABR-1', 5, 'isString'],
    ['instrumental', 'is_instrumental', 'sim', true, 'x'.repeat(11), 'maxLength'],
    ['criada_por_ia', 'ai_used', true, true, 'sim', 'isBoolean'],
    ['tipo_ia', 'ai_usage_level', 'parcialmente', 'partial', 'sometimes', 'isIn'],
    ['ia_harmonia', 'ai_harmony', { ferramenta: 'Suno' }, { tool: 'Suno' }, 'x', 'isObject'],
    ['ia_melodia', 'ai_melody', { ferramenta: 'Suno' }, { tool: 'Suno' }, 'x', 'isObject'],
    ['ia_letra', 'ai_lyrics', { ferramenta: 'GPT' }, { tool: 'GPT' }, 'x', 'isObject'],
    ['outros_titulos', 'alternative_titles', ['Alt'], ['Alt'], 'Alt', 'isArray'],
    ['referencias_conexas', 'related_references', ['Ref'], ['Ref'], 'Ref', 'isArray'],
    ['letra_completa', 'lyrics', 'la la', 'la la', 5, 'isString'],
    ['participantes', 'participants', [{ id: 'p1', nome: 'Fulano' }], [{ id: 'p1', name: 'Fulano' }], 'Fulano', 'isArray'],
    ['letristas', 'translator_names', ['Beltrano'], ['Beltrano'], 'Beltrano', 'isArray'],
    ['tipo_obra', 'work_origin', 'autoral', 'original', 'musica', 'isIn'],
  ];

  it.each(CASES)('%s -> %s', async (legacy, canonical, good, expected, bad, constraint) => {
    const accepted = await errorsOf({ title: 'Obra', [legacy]: good });
    expect(accepted.filter((e) => e.property === legacy)).toEqual([]);
    expect(accepted).toEqual([]);

    const rejected = (await errorsOf({ title: 'Obra', [legacy]: bad })).filter((e) => e.property === legacy);
    expect(rejected).toHaveLength(1);
    expect(Object.keys(rejected[0].constraints ?? {})).toContain(constraint);
    expect(Object.keys(rejected[0].constraints ?? {})).not.toContain('whitelistValidation');

    const mapped = canonicalizeWorkInput({ title: 'Obra', [legacy]: good }) as Record<string, unknown>;
    expect(mapped[canonical]).toEqual(expected);
    expect(mapped).not.toHaveProperty(legacy);
  });
});

