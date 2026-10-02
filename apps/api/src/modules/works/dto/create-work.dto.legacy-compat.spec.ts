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
