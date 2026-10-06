import 'reflect-metadata';
import { IntegrationsController } from './integrations.controller';

const platform = (configured: boolean) => ({ isConfigured: () => configured });

function buildController(statusFor: (tenantId: string, provider: string) => Record<string, unknown>) {
  const integrationBase = { getStatus: jest.fn(async (tenantId: string, provider: string) => statusFor(tenantId, provider)) };
  const args = new Array(18).fill({});
  args[0] = platform(true);   // acrCloud
  args[2] = platform(false);  // spotify
  args[3] = platform(false);  // youtube
  args[4] = platform(true);   // deezer
  args[5] = platform(false);  // soundcloud
  args[6] = platform(false);  // appleMusic
  args[7] = platform(false);  // instagram
  args[8] = platform(false);  // tiktok
  args[9] = platform(false);  // googleAds
  args[12] = integrationBase;
  const controller = new (IntegrationsController as unknown as new (...a: unknown[]) => IntegrationsController)(...args);
  return { controller, integrationBase };
}

describe('IntegrationsController.getStatus: configured is the tenant state, never a constant', () => {
  const stored = (tenantId: string, provider: string) => ({
    connected: tenantId === 't1' && provider === 'abramus',
    status: tenantId === 't1' && provider === 'abramus' ? 'connected' : 'disconnected',
    verified: tenantId === 't1' && provider === 'abramus',
  });

  it('reports a connected Abramus only for the tenant that connected it', async () => {
    const { controller, integrationBase } = buildController(stored);
    const own = await controller.getStatus({ tenant: { id: 't1' } });
    const other = await controller.getStatus({ tenant: { id: 't2' } });
    expect(own.abramus).toMatchObject({ configured: true, connected: true, verified: true });
    expect(other.abramus).toMatchObject({ configured: false, connected: false, verified: false });
    expect(integrationBase.getStatus).toHaveBeenCalledWith('t2', 'abramus');
    expect(integrationBase.getStatus).toHaveBeenCalledWith('t2', 'autentique');
  });

  it('a tenant with nothing saved is not configured for either tenant-credential provider', async () => {
    const { controller } = buildController(stored);
    const status = await controller.getStatus({ tenantId: 't9' });
    expect(status.autentique).toMatchObject({ configured: false });
    expect(status.abramus).toMatchObject({ configured: false });
  });

  it('keeps the platform-level flag for the providers configured by the platform', async () => {
    const { controller } = buildController(stored);
    const status = await controller.getStatus({ tenant: { id: 't1' } });
    expect(status.acrcloud).toEqual({ configured: true });
    expect(status.spotify).toEqual({ configured: false });
    expect(status.deezer).toEqual({ configured: true });
  });
});
