import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateUserDto } from './users.dto';

/**
 * users.dto.spec.ts
 *
 * Guarda permanente (auditoria 2026-07-18 — settings/usuários): o hook
 * useUsuarios() enviava `full_name`/`phone`/`cargo` — `phone` nunca teve
 * coluna nem campo de DTO (sempre descartado/rejeitado); `full_name`/`cargo`
 * não batiam com os nomes reais do DTO (`fullName`/`role`). Corrigido no
 * hook (envia fullName/phone) e aqui no DTO (phone adicionado).
 *
 * Task L: `role` e `status` foram REMOVIDOS deste DTO — eram aceitos aqui via
 * PATCH /users/:id (gate apenas 'manager') sem passar pelas checagens de
 * autorização/hierarquia dos endpoints dedicados (PATCH /users/:id/role,
 * gate 'admin'; PATCH /users/:id/status, gate 'owner'). Um 'manager'
 * conseguia se auto-promover a 'owner' pelo PATCH genérico. O hook
 * useUsuarios() já foi corrigido para usar os endpoints dedicados.
 */
async function validatePayload(payload: Record<string, unknown>) {
  const instance = plainToInstance(UpdateUserDto, payload);
  return validate(instance, { whitelist: true, forbidNonWhitelisted: true });
}

describe('UpdateUserDto — contrato real (auditoria 2026-07-18 + Task L)', () => {
  it('aceita fullName/phone — payload real de perfil enviado por useUsuarios()', async () => {
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
