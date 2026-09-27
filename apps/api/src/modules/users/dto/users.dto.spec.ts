import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateUserDto } from './users.dto';

/**
 * users.dto.spec.ts
 *
 * Permanent guard (2026-07-18 audit — settings/users): the
 * useUsuarios() hook sent `full_name`/`phone`/`cargo` — `phone` never had a
 * column nor a DTO field (always discarded/rejected); `full_name`/`cargo`
 * did not match the real DTO names (`fullName`/`role`). Fixed in the
 * hook (sends fullName/phone) and here in the DTO (phone added).
 *
 * Task L: `role` and `status` were REMOVED from this DTO — they were accepted here via
 * PATCH /users/:id (gate 'manager' only) without going through the
 * authorization/hierarchy checks of the dedicated endpoints (PATCH /users/:id/role,
 * gate 'admin'; PATCH /users/:id/status, gate 'owner'). A 'manager'
 * could self-promote to 'owner' through the generic PATCH. The
 * useUsuarios() hook was already fixed to use the dedicated endpoints.
 */
async function validatePayload(payload: Record<string, unknown>) {
  const instance = plainToInstance(UpdateUserDto, payload);
  return validate(instance, { whitelist: true, forbidNonWhitelisted: true });
}

describe('UpdateUserDto — contrato real (auditoria 2026-07-18 + Task L)', () => {
  it('accepts fullName/phone — the real profile payload sent by useUsuarios()', async () => {
    const errors = await validatePayload({ fullName: 'Fulano da Silva', phone: '11999999999' });
    expect(errors).toEqual([]);
  });

  it('rejects full_name/cargo (old incorrect names used by the hook before the fix)', async () => {
    for (const key of ['full_name', 'cargo']) {
      const errors = await validatePayload({ [key]: 'x' });
      expect(errors.some((e) => e.property === key)).toBe(true);
    }
  });

  it('Task L: rejects role/status — only the dedicated (authorized) endpoints may change them', async () => {
    for (const key of ['role', 'status']) {
      const errors = await validatePayload({ [key]: 'owner' });
      expect(errors.some((e) => e.property === key)).toBe(true);
    }
  });

  it('accepts expectedUpdatedAt (optimistic concurrency, Task L)', async () => {
    const errors = await validatePayload({ fullName: 'x', expectedUpdatedAt: '2026-08-14T10:00:00.000Z' });
    expect(errors).toEqual([]);
  });
});
