import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { applyDeprecatedFieldAliases } from '../../../common/compat/deprecated-field-aliases.util';
import { ABRAMUS_WORK_DEPRECATED_FIELDS, RegisterAbramusWorkDto } from './integrations.dto';

const PIPE = { whitelist: true, forbidNonWhitelisted: true };
const run = async (payload: Record<string, unknown>) => {
  const instance = plainToInstance(RegisterAbramusWorkDto, payload);
  return { instance, errors: await validate(instance, PIPE) };
};
const CANONICAL_REQUIRED = { title: 'Obra X', composer: 'Fulano' };

// [deprecated property, canonical property, valid value, malformed value, expected constraint]
const LEGACY: Array<[string, string, unknown, unknown, string]> = [
  ['titulo', 'title', 'Obra legada', 42, 'isString'],
  ['compositor', 'composer', 'Beltrano', 42, 'isString'],
  ['coautores', 'co_composers', ['A', 'B'], 'not-an-array', 'isArray'],
  ['genero', 'genre', 'Pop', 42, 'isString'],
  ['duracao', 'duration', '3:20', 42, 'isString'],
  ['editora', 'publisher', 'Editora Y', 42, 'isString'],
];

/** The deprecated name replaces its canonical counterpart (title/composer are required unless the alias is sent). */
const legacyOnly = (legacy: string, canonical: string, value: unknown): Record<string, unknown> => {
  const payload: Record<string, unknown> = { ...CANONICAL_REQUIRED, [legacy]: value };
  delete payload[canonical];
  return payload;
};

describe('RegisterAbramusWorkDto deprecated properties (legacy in, canonical out)', () => {
  it.each(LEGACY)('accepts %s in place of %s, preserves it, and maps it to the canonical name', async (legacy, canonical, valid) => {
    const payload = legacyOnly(legacy, canonical, valid);
    const { instance, errors } = await run(payload);
    expect(errors).toEqual([]);
    expect((instance as unknown as Record<string, unknown>)[legacy]).toEqual(valid);
    const moved = applyDeprecatedFieldAliases(payload, ABRAMUS_WORK_DEPRECATED_FIELDS) as Record<string, unknown>;
    expect(moved[canonical]).toEqual(valid);
    expect(moved).not.toHaveProperty(legacy);
  });

  it.each(LEGACY)('rejects a malformed %s with a constraint on that property (not a whitelist error)', async (legacy, canonical, _valid, bad, constraint) => {
    const { errors } = await run(legacyOnly(legacy, canonical, bad));
    const forLegacy = errors.filter((e) => e.property === legacy);
    expect(forLegacy).toHaveLength(1);
    const keys = Object.keys(forLegacy[0].constraints ?? {});
    expect(keys).toContain(constraint);
    expect(keys).not.toContain('whitelistValidation');
  });

  it('the alias table maps exactly the deprecated properties the DTO declares as deprecated', () => {
    expect(Object.keys(ABRAMUS_WORK_DEPRECATED_FIELDS).sort()).toEqual(LEGACY.map(([legacy]) => legacy).sort());
    for (const [legacy, canonical] of LEGACY) expect(ABRAMUS_WORK_DEPRECATED_FIELDS[legacy]).toBe(canonical);
  });

  it('the canonical name wins over the deprecated one and the deprecated key is dropped', () => {
    const out = applyDeprecatedFieldAliases(
      { duration: '4:00', duracao: '3:20', publisher: 'Nova', editora: 'Velha' } as Record<string, unknown>,
      ABRAMUS_WORK_DEPRECATED_FIELDS,
    );
    expect(out).toEqual({ duration: '4:00', publisher: 'Nova' });
  });

  it.each(LEGACY)('%s is declared deprecated in the Swagger metadata', (legacy) => {
    expect(Reflect.getMetadata('swagger/apiModelProperties', RegisterAbramusWorkDto.prototype, legacy)).toEqual(
      expect.objectContaining({ deprecated: true }),
    );
  });
});
