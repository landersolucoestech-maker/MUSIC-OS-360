import { Logger, ServiceUnavailableException } from '@nestjs/common';

const RAW = 'ECONNREFUSED 10.0.0.5:5432 password authentication failed';
const mockUpdateUserById = jest.fn();
jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ auth: { admin: { updateUserById: mockUpdateUserById } } }),
}));

import { WorkspaceProvisioningService } from './workspace-provisioning.service';

describe('WorkspaceProvisioningService - provider error text never reaches the response', () => {
  afterEach(() => jest.restoreAllMocks());

  it('throws PT-BR copy with a stable code and logs the technical text', async () => {
    mockUpdateUserById.mockResolvedValue({ error: { message: RAW } });
    const queryRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      isTransactionActive: true,
      query: jest.fn()
        .mockResolvedValueOnce([]) // advisory lock
        .mockResolvedValueOnce([{ org_id: 'o', tenant_id: 't', role: 'owner', role_id: 'r' }]),
    };
    const ds = { isInitialized: true, createQueryRunner: () => queryRunner };
    const config = { getOrThrow: () => 'x' };
    const errorLog = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    const service = new WorkspaceProvisioningService(ds as never, config as never);

    const thrown = await service
      .provision({ userId: 'u1', claims: {} }, {} as never)
      .catch((e: unknown) => e);

    expect(thrown).toBeInstanceOf(ServiceUnavailableException);
    const body = (thrown as ServiceUnavailableException).getResponse() as { message: string; error: string };
    expect(body.message).toBe('Não foi possível atualizar a sessão. Tente novamente.');
    expect(body.error).toBe('SESSION_UPDATE_FAILED');
    expect(JSON.stringify(body)).not.toContain('ECONNREFUSED');
    expect(JSON.stringify(body)).not.toContain('password authentication');
    expect(errorLog.mock.calls.some(([m]) => String(m).includes(RAW))).toBe(true);
  });
});
