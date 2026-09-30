import { toPublicActivityLog } from './activity-log.public';

describe('toPublicActivityLog', () => {
  it('replaces the raw metadata.error with a stable error_code', () => {
    const row = { id: 'a', metadata: { provider: 'docusign', error: 'TypeError: fetch failed ECONNREFUSED 10.0.0.9:443 token=abc123' } };
    const out = toPublicActivityLog(row);
    expect(out.metadata).toEqual({ provider: 'docusign', error_code: 'INTEGRATION_CALL_FAILED' });
    expect(JSON.stringify(out)).not.toMatch(/ECONNREFUSED|abc123|10\.0\.0\.9/);
    expect(row.metadata.error).toContain('ECONNREFUSED'); // persisted row untouched
  });

  it('classifies known failure classes and passes clean rows through', () => {
    expect(toPublicActivityLog({ metadata: { error: 'HTTP 429 rate limit' } }).metadata).toEqual({ error_code: 'PROVIDER_RATE_LIMITED' });
    const clean = { metadata: { provider: 'x' } };
    expect(toPublicActivityLog(clean)).toBe(clean);
  });
});
