import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { applyDeprecatedFieldAliases } from '../../../common/compat/deprecated-field-aliases.util';
import { LEAVE_REQUEST_DEPRECATED_FIELDS } from '../hr-legacy-fields';
import { CreateLeaveRequestDto } from './create-leave-request.dto';

describe('CreateLeaveRequestDto legacy fields (legacy in, canonical out)', () => {
  it.each([['motivo', 'reason', 'Consulta medica']])('accepts %s and maps it to %s', async (legacy, canonical, value) => {
    const payload = { [legacy]: value };
    const errors = await validate(plainToInstance(CreateLeaveRequestDto, payload), { whitelist: true, forbidNonWhitelisted: true });
    expect(errors.filter((e) => e.property === legacy)).toEqual([]);
    const moved = applyDeprecatedFieldAliases(payload, LEAVE_REQUEST_DEPRECATED_FIELDS) as Record<string, unknown>;
    expect(moved[canonical]).toBe(value);
    expect(moved).not.toHaveProperty(legacy);
  });

  it('the canonical field wins when both are sent', () => {
    expect(applyDeprecatedFieldAliases({ motivo: 'old', reason: 'new' }, LEAVE_REQUEST_DEPRECATED_FIELDS)).toEqual({ reason: 'new' });
  });
});
