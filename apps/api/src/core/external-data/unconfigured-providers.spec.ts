import 'reflect-metadata';
import { CapabilityUnavailableError } from './capability-unavailable.error';
import { UnconfiguredDistributorProvider } from './unconfigured-distributor.provider';
import { UnconfiguredSocietyProvider } from './unconfigured-society.provider';
import { UnconfiguredTranscriptionProvider } from './unconfigured-transcription.provider';
import { UnconfiguredPayoutProvider } from './unconfigured-payout.provider';
import { ExternalDataProviderRegistry } from './external-data-provider-registry.service';

const ctx = { tenantId: 't1', userId: 'u1', providerId: 'p', idempotencyKey: 'k1' };

async function expectUnavailable(fn: () => unknown, capability: string) {
  let caught: unknown;
  try { await fn(); } catch (e) { caught = e; }
  expect(caught).toBeInstanceOf(CapabilityUnavailableError);
  const err = caught as CapabilityUnavailableError;
  expect(err.code).toBe('CAPABILITY_UNAVAILABLE');
  expect(err.capability).toBe(capability);
  expect(err.getStatus()).toBe(503);
  expect(err.getResponse()).toEqual({
    error: 'CAPABILITY_UNAVAILABLE', capability, reason: 'NO_PROVIDER_CONFIGURED', message: expect.stringContaining('CAPABILITY_UNAVAILABLE'),
  });
}

describe('unconfigured adapters fail closed', () => {
  let fetchSpy: jest.SpyInstance;
  beforeEach(() => { fetchSpy = jest.spyOn(globalThis, 'fetch' as never).mockImplementation((() => { throw new Error('network forbidden'); }) as never); });
  afterEach(() => { expect(fetchSpy).not.toHaveBeenCalled(); fetchSpy.mockRestore(); });

  it('distributor', async () => {
    const p = new UnconfiguredDistributorProvider();
    expect(p.metadata).toMatchObject({ supportsSubmit: false, supportsStatusCheck: false, unconfigured: true });
    await expectUnavailable(() => p.submit({} as never, ctx), 'distributor_submission');
    await expectUnavailable(() => p.checkStatus('s', ctx), 'distributor_status');
    await expectUnavailable(() => p.normalizeWebhook({}), 'distributor_status');
  });

  it('society', async () => {
    const p = new UnconfiguredSocietyProvider();
    await expectUnavailable(() => p.submit({} as never, ctx), 'society_submission');
    await expectUnavailable(() => p.checkStatus('s', ctx), 'society_submission');
    await expectUnavailable(() => p.normalizeWebhook({}), 'society_submission');
  });

  it('transcription', async () => {
    await expectUnavailable(() => new UnconfiguredTranscriptionProvider().transcribe({ tenantId: 't', assetId: 'a', idempotencyKey: 'k' }), 'audio_transcription');
  });

  it('payout', async () => {
    await expectUnavailable(() => new UnconfiguredPayoutProvider().execute({ tenantId: 't', payoutId: 'p', amountMinor: 100, currency: 'BRL', idempotencyKey: 'k' }), 'payout');
  });

  it('registry rejects unknown providers with the typed error', async () => {
    const reg = new ExternalDataProviderRegistry();
    await expectUnavailable(() => reg.getDistributor('nope'), 'distributor_submission');
    await expectUnavailable(() => reg.getSociety('nope'), 'society_submission');
    await expectUnavailable(() => reg.get('nope'), 'distributor_status');
  });
});

describe('ExternalDataProviderRegistry registration is environment independent', () => {
  const original = process.env['NODE_ENV'];
  afterEach(() => { process.env['NODE_ENV'] = original; });

  it.each(['development', 'staging', 'production'])('%s registers both unconfigured providers', (env) => {
    process.env['NODE_ENV'] = env;
    const reg = new ExternalDataProviderRegistry();
    expect(reg.list().map((m) => m.providerId).sort()).toEqual(['distributor-provider-not-configured', 'society-provider-not-configured']);
    expect(reg.list().every((m) => m.unconfigured === true && !m.supportsSubmit && !m.supportsStatusCheck)).toBe(true);
    expect(reg.list('distributor')).toHaveLength(1);
  });
});
