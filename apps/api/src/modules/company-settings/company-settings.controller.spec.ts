import { CompanySettingsController } from './company-settings.controller';
import type { CompanySettingsService } from './company-settings.service';

describe('CompanySettingsController', () => {
  let controller: CompanySettingsController;
  let svc: Record<string, jest.Mock>;
  const tenant = { id: 'tenant-1', org_id: 'org-1' };

  beforeEach(() => {
    svc = {
      get: jest.fn().mockResolvedValue({ legalName: 'Empresa' }),
      update: jest.fn().mockResolvedValue({ legalName: 'Nova Empresa' }),
    };
    controller = new CompanySettingsController(svc as unknown as CompanySettingsService);
  });

  it('get() derives tenantId/orgId from the session tenant, never from the client', async () => {
    await controller.get(tenant);
    expect(svc.get).toHaveBeenCalledWith('tenant-1', 'org-1');
  });

  it('update() derives tenantId/orgId/userId from the session and forwards the dto', async () => {
    const user = { userId: 'user-1', orgRole: 'owner' } as never;
    const dto = { legalName: 'Nova Empresa' };
    await controller.update(user, tenant, dto as never);
    expect(svc.update).toHaveBeenCalledWith('tenant-1', 'org-1', 'user-1', 'owner', dto);
  });
});
