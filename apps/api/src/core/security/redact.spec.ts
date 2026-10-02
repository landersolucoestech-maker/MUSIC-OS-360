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

  it('BLK-CRM-PII-PLAINTEXT: redacts personal/bank data keys (canonical and Portuguese), exact match only', () => {
    const out = redactSensitiveObject({
      cpf: '1', cnpj: '2', cpf_cnpj: '3', rg: '4', birth_date: '5', data_nascimento: '5', bank_name: '6', bank_branch: '7',
      bank_account: '8', pix_key: '9', chave_pix: '9', account_holder: 'a', titular_conta: 'a', banco: 'b', agencia: 'c',
      conta: 'd', address: 'e', endereco: 'e', 'Bank-Account': 'f',
      org: 'keep', organization_id: 'keep', stage_name: 'keep', nested: { rg: 'x', note: 'keep' },
    }) as Record<string, any>;
    for (const key of [
      'cpf', 'cnpj', 'cpf_cnpj', 'rg', 'birth_date', 'data_nascimento', 'bank_name', 'bank_branch', 'bank_account',
      'pix_key', 'chave_pix', 'account_holder', 'titular_conta', 'banco', 'agencia', 'conta', 'address', 'endereco', 'Bank-Account',
    ]) {
      expect(out[key]).toBe(REDACTED);
    }
    expect(out.org).toBe('keep');
    expect(out.organization_id).toBe('keep');
    expect(out.stage_name).toBe('keep');
    expect(out.nested.rg).toBe(REDACTED);
    expect(out.nested.note).toBe('keep');
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
