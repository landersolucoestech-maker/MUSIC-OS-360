import { classifyStripeSecretKeyFormat, classifyStripePublishableKeyFormat, checkStripeKeyLiveness } from './stripe-key-guard';

describe('classifyStripeSecretKeyFormat', () => {
  it('MISSING when absent, empty, or only whitespace', () => {
    expect(classifyStripeSecretKeyFormat(undefined)).toBe('MISSING');
    expect(classifyStripeSecretKeyFormat(null)).toBe('MISSING');
    expect(classifyStripeSecretKeyFormat('')).toBe('MISSING');
    expect(classifyStripeSecretKeyFormat('   ')).toBe('MISSING');
  });

  it('LIVE_KEY_REJECTED for sk_live_ and rk_live_, in any environment', () => {
    expect(classifyStripeSecretKeyFormat('sk_live_abc123')).toBe('LIVE_KEY_REJECTED');
    expect(classifyStripeSecretKeyFormat('rk_live_abc123')).toBe('LIVE_KEY_REJECTED');
  });

  it('VALID_TEST_KEY for sk_test_ and rk_test_', () => {
    expect(classifyStripeSecretKeyFormat('sk_test_abc123')).toBe('VALID_TEST_KEY');
    expect(classifyStripeSecretKeyFormat('rk_test_abc123')).toBe('VALID_TEST_KEY');
    // format used by the existing billing.service.spec.ts fixture — must never regress
    expect(classifyStripeSecretKeyFormat('sk_test_key')).toBe('VALID_TEST_KEY');
  });

  it('INVALID_FORMAT for anything that is not a recognized Stripe prefix', () => {
    expect(classifyStripeSecretKeyFormat('not-a-stripe-key')).toBe('INVALID_FORMAT');
    expect(classifyStripeSecretKeyFormat('pk_test_abc123')).toBe('INVALID_FORMAT'); // publishable, not secret
  });
});

describe('classifyStripePublishableKeyFormat', () => {
  it('MISSING / LIVE_KEY_REJECTED / VALID_TEST_KEY / INVALID_FORMAT', () => {
    expect(classifyStripePublishableKeyFormat(undefined)).toBe('MISSING');
    expect(classifyStripePublishableKeyFormat('pk_live_abc')).toBe('LIVE_KEY_REJECTED');
    expect(classifyStripePublishableKeyFormat('pk_test_abc')).toBe('VALID_TEST_KEY');
    expect(classifyStripePublishableKeyFormat('sk_test_abc')).toBe('INVALID_FORMAT');
  });
});

describe('checkStripeKeyLiveness', () => {
  const originalFetch = global.fetch;
  afterEach(() => { global.fetch = originalFetch; });

  it('VALID_TEST_KEY when Stripe responds 200', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) }) as any;
    expect(await checkStripeKeyLiveness('sk_test_x')).toBe('VALID_TEST_KEY');
  });

  it('EXPIRED_OR_REVOKED when Stripe rejects the key (real case found in Part 71)', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: { message: 'Expired API Key provided: sk_test_...1vcjvj' } }),
    }) as any;
    expect(await checkStripeKeyLiveness('sk_test_x')).toBe('EXPIRED_OR_REVOKED');
  });

  it('NETWORK_ERROR when fetch fails (no internet, DNS, etc.) — never fakes success', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('getaddrinfo ENOTFOUND')) as any;
    expect(await checkStripeKeyLiveness('sk_test_x')).toBe('NETWORK_ERROR');
  });

  it('never includes the key in plaintext in the authorization message outside the Basic header', async () => {
    let capturedHeaders: Record<string, string> | undefined;
    global.fetch = jest.fn().mockImplementation((_url: string, opts: any) => {
      capturedHeaders = opts.headers;
      return Promise.resolve({ ok: true, json: async () => ({}) });
    }) as any;
    await checkStripeKeyLiveness('sk_test_super-secret-value');
    expect(capturedHeaders?.Authorization).not.toContain('super-secret-value');
    expect(capturedHeaders?.Authorization).toMatch(/^Basic /);
  });
});
