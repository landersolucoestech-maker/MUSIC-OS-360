import { isDevMockSocialMetricsEnabled } from './dev-social-metrics-mock';

describe('isDevMockSocialMetricsEnabled', () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
  });
  const setEnv = (env: Record<string, string | undefined>) => {
    for (const k of ['DEV_SOCIAL_METRICS_MOCK', 'USE_MOCK', 'NODE_ENV']) delete process.env[k];
    for (const [k, v] of Object.entries(env)) if (v !== undefined) process.env[k] = v;
  };

  it('is off without an explicit opt-in', () => {
    setEnv({ NODE_ENV: 'development' });
    expect(isDevMockSocialMetricsEnabled()).toBe(false);
  });

  it.each(['DEV_SOCIAL_METRICS_MOCK', 'USE_MOCK'])('%s=true enables it in development', (flag) => {
    setEnv({ NODE_ENV: 'development', [flag]: 'true' });
    expect(isDevMockSocialMetricsEnabled()).toBe(true);
  });

  it.each(['1', 'TRUE', 'yes', 'false'])('only the exact string "true" opts in (got %s)', (value) => {
    setEnv({ NODE_ENV: 'development', DEV_SOCIAL_METRICS_MOCK: value });
    expect(isDevMockSocialMetricsEnabled()).toBe(false);
  });

  it.each(['production', 'staging'])('never enables in %s even when opted in (negative path)', (nodeEnv) => {
    for (const flag of ['DEV_SOCIAL_METRICS_MOCK', 'USE_MOCK']) {
      setEnv({ NODE_ENV: nodeEnv, [flag]: 'true' });
      expect(isDevMockSocialMetricsEnabled()).toBe(false);
    }
  });
});
