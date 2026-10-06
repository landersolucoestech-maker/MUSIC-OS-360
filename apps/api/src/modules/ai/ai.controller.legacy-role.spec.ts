import { ForbiddenException } from '@nestjs/common';
import { AiController } from './ai.controller';

/**
 * assertSystemPromptAllowed resolves the caller's level through roleLevel() (own-key lookup that
 * also knows the persisted Portuguese slugs). Without it the comparison is NaN and fails OPEN.
 */
describe('AiController systemPrompt authorization (roleLevel wiring)', () => {
  function build() {
    const ai = {
      complete: jest.fn(async () => ({ content: 'ok' })),
    };
    return { ai, controller: new AiController(ai as never) };
  }
  const reqFor = (role: string | undefined) => ({ currentMember: role === undefined ? undefined : { role }, tenantId: 't1', userId: 'u1' });

  const DENIED = ['viewer', 'artista', 'colaborador', 'rh_manager', 'juridico', 'editor', 'unknown_role', 'constructor', 'toString', '__proto__'];
  const ALLOWED = ['manager', 'admin', 'owner', 'tenant_owner', 'super_admin'];

  it.each(DENIED)('denies %s a custom systemPrompt on /complete and never reaches the provider', async (role) => {
    const { ai, controller } = build();
    await expect((async () => controller.complete(reqFor(role), { prompt: 'p', systemPrompt: 'custom' } as never))()).rejects.toBeInstanceOf(ForbiddenException);
    expect(ai.complete).not.toHaveBeenCalled();
  });

  it.each(DENIED)('denies %s a custom systemPrompt on /generate', async (role) => {
    const { ai, controller } = build();
    await expect(controller.generate(reqFor(role), { prompt: 'p', systemPrompt: 'custom' })).rejects.toBeInstanceOf(ForbiddenException);
    expect(ai.complete).not.toHaveBeenCalled();
  });

  it('denies a request with no resolved member (defaults to viewer)', async () => {
    const { ai, controller } = build();
    await expect((async () => controller.complete(reqFor(undefined), { prompt: 'p', systemPrompt: 'custom' } as never))()).rejects.toBeInstanceOf(ForbiddenException);
    expect(ai.complete).not.toHaveBeenCalled();
  });

  it.each(ALLOWED)('allows %s to send a custom systemPrompt', async (role) => {
    const { ai, controller } = build();
    await controller.complete(reqFor(role), { prompt: 'p', systemPrompt: 'custom' } as never);
    expect(ai.complete).toHaveBeenCalledWith(expect.objectContaining({ systemPrompt: 'custom' }));
  });

  it('lets a low role call without a systemPrompt', async () => {
    const { ai, controller } = build();
    await controller.complete(reqFor('viewer'), { prompt: 'p' } as never);
    expect(ai.complete).toHaveBeenCalledTimes(1);
  });
});
