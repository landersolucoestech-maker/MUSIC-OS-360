import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateArtistGoalDto } from './create-artist-goal.dto';

// Real class-validator/class-transformer pipeline with the app's global pipe options (whitelist + forbidNonWhitelisted):
// a deprecated property must stay accepted (legacy in), keep its value, and reject malformed input on that exact property.
const PIPE = { whitelist: true, forbidNonWhitelisted: true };
const base = { artist_id: '123e4567-e89b-12d3-a456-426614174000', title: 'Streams', type: 'streams' };
const run = async (payload: Record<string, unknown>) => {
  const instance = plainToInstance(CreateArtistGoalDto, payload);
  return { instance, errors: await validate(instance, PIPE) };
};

describe('CreateArtistGoalDto deprecated property periodo (legacy in)', () => {
  it.each(['mensal', 'anual', 'monthly'])('accepts periodo=%s and preserves the value on the instance', async (value) => {
    const { instance, errors } = await run({ ...base, periodo: value });
    expect(errors).toEqual([]);
    expect(instance.periodo).toBe(value);
  });

  it('rejects a malformed periodo with a constraint on periodo itself (not a whitelist error)', async () => {
    const { errors } = await run({ ...base, periodo: 'fortnightly' });
    const forPeriodo = errors.filter((e) => e.property === 'periodo');
    expect(forPeriodo).toHaveLength(1);
    expect(Object.keys(forPeriodo[0].constraints ?? {})).toEqual(['isIn']);
  });

  it('the canonical period is validated independently of the deprecated alias', async () => {
    const { errors } = await run({ ...base, period: 'fortnightly' });
    expect(errors.map((e) => e.property)).toEqual(['period']);
  });

  it('is declared deprecated in the Swagger metadata', () => {
    const meta = Reflect.getMetadata('swagger/apiModelProperties', CreateArtistGoalDto.prototype, 'periodo');
    expect(meta).toEqual(expect.objectContaining({ deprecated: true }));
  });
});
