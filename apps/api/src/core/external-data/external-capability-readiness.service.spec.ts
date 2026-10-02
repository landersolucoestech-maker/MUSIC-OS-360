import 'reflect-metadata';
import { ExternalCapabilityReadinessService, EXTERNAL_CAPABILITIES } from './external-capability-readiness.service';
import { ExternalDataProviderRegistry } from './external-data-provider-registry.service';
import type { ExternalDataExchangeProvider, DistributorSubmissionPayload } from './external-data.types';

function fake(over: Partial<ExternalDataExchangeProvider<DistributorSubmissionPayload>['metadata']>) {
  return {
    metadata: { providerId: 'fake-dist', displayName: 'Fake', kind: 'distributor', supportsSubmit: false, supportsStatusCheck: false, mock: false, ...over },
    submit: jest.fn(), checkStatus: jest.fn(), normalizeWebhook: jest.fn(),
  } as unknown as ExternalDataExchangeProvider<DistributorSubmissionPayload>;
}

describe('ExternalCapabilityReadinessService', () => {
  it('reports all four capabilities unavailable with no provider', () => {
    const svc = new ExternalCapabilityReadinessService(new ExternalDataProviderRegistry());
    for (const capability of EXTERNAL_CAPABILITIES) {
      const r = svc.check(capability, 't1');
      expect(r).toMatchObject({ available: false, capability, code: 'CAPABILITY_UNAVAILABLE', reason: 'NO_PROVIDER_CONFIGURED' });
      expect((r as { expectedContract: string }).expectedContract).toBeTruthy();
      expect((r as { fallback: string }).fallback).toBeTruthy();
    }
    expect(svc.checkAll().every((r) => r.available === false)).toBe(true);
    expect(svc.checkAll()).toHaveLength(4);
  });

  it('flips submit/status to available when a provider declaring them is registered', () => {
    const reg = new ExternalDataProviderRegistry();
    const svc = new ExternalCapabilityReadinessService(reg);
    reg.register(fake({ supportsSubmit: true, supportsStatusCheck: true }));
    expect(svc.check('distributor_submission')).toEqual({ available: true });
    expect(svc.check('distributor_status')).toEqual({ available: true });
    expect(svc.check('audio_transcription').available).toBe(false);
    expect(svc.check('payout').available).toBe(false);
  });

  it('distinguishes per-flag support and mock providers', () => {
    const reg = new ExternalDataProviderRegistry();
    const svc = new ExternalCapabilityReadinessService(reg);
    reg.register(fake({ supportsSubmit: true }));
    expect(svc.check('distributor_submission').available).toBe(true);
    expect(svc.check('distributor_status')).toMatchObject({ available: false, reason: 'PROVIDER_LACKS_CAPABILITY' });
    reg.register(fake({ providerId: 'fake-dist', supportsSubmit: true, supportsStatusCheck: true, mock: true }));
    expect(svc.check('distributor_submission')).toMatchObject({ available: false, reason: 'PROVIDER_DISABLED' });
  });

  it('never calls a provider', () => {
    const reg = new ExternalDataProviderRegistry();
    const p = fake({ supportsSubmit: true, supportsStatusCheck: true });
    reg.register(p);
    new ExternalCapabilityReadinessService(reg).checkAll();
    expect(p.submit).not.toHaveBeenCalled();
    expect(p.checkStatus).not.toHaveBeenCalled();
  });
});
