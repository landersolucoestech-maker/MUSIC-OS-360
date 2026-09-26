import { redactSensitiveObject, redactUrl, REDACTED } from './redact';

describe('redactSensitiveObject (clear-text exposure, CWE-312/532)', () => {
  it('redacts secret-looking keys, keeps metadata', () => {
    const out = redactSensitiveObject({
      runId: 'r1',
      status: 'ok',
      password: 'p',
      access_token: 'at',
      refresh_token: 'rt',
      api_key: 'ak',
      client_secret: 'cs',
      DATABASE_URL: 'postgres://u:p@h/db',
      SUPABASE_SERVICE_ROLE_KEY: 'srk',
      JWT_SECRET: 'js',
      R2_SECRET_KEY: 'r2',
      authorization: 'Bearer x',
    }) as Record<string, string>;
    expect(out.runId).toBe('r1');
    expect(out.status).toBe('ok');
    for (const k of [
      'password', 'access_token', 'refresh_token', 'api_key', 'client_secret',
      'DATABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'JWT_SECRET', 'R2_SECRET_KEY', 'authorization',
    ]) {
      expect(out[k]).toBe(REDACTED);
    }
  });

  it('redacts nested objects and arrays', () => {
    const out = redactSensitiveObject({
      list: [{ token: 't', name: 'n' }],
      nested: { deep: { secret: 's', keep: 'k' } },
    }) as any;
    expect(out.list[0].token).toBe(REDACTED);
    expect(out.list[0].name).toBe('n');
    expect(out.nested.deep.secret).toBe(REDACTED);
    expect(out.nested.deep.keep).toBe('k');
  });

  it('leaves primitives untouched', () => {
    expect(redactSensitiveObject('hello')).toBe('hello');
    expect(redactSensitiveObject(42)).toBe(42);
    expect(redactSensitiveObject(null)).toBeNull();
  });
});

describe('redactUrl (find-936c6f8d: credentials in query strings)', () => {
  it('redacts OAuth code/state on callbacks, keeps path and harmless params', () => {
    expect(redactUrl('/api/v1/integrations/spotify/callback?code=AQD123&state=abc.sig&lang=pt'))
      .toBe(`/api/v1/integrations/spotify/callback?code=${REDACTED}&state=${REDACTED}&lang=pt`);
  });

  it('redacts the Meta webhook verify token and secret-looking keys', () => {
    expect(redactUrl('/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=s3cr3t&hub.challenge=42'))
      .toBe(`/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=${REDACTED}&hub.challenge=42`);
    expect(redactUrl('/x?access_token=a&api_key=b&page=2'))
      .toBe(`/x?access_token=${REDACTED}&api_key=${REDACTED}&page=2`);
  });

  it('handles encoded keys, case, no query, empty input', () => {
    expect(redactUrl('/x?Code=1')).toBe(`/x?Code=${REDACTED}`);
    expect(redactUrl('/x?hub%2Everify_token=t')).toBe(`/x?hub%2Everify_token=${REDACTED}`);
    expect(redactUrl('/plain/path')).toBe('/plain/path');
    expect(redactUrl(undefined)).toBe('');
  });
});
