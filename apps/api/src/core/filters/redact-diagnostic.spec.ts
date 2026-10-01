import { redactDiagnosticText, redactForStorage } from './redact-diagnostic';

describe('redactDiagnosticText', () => {
  it('redacts e-mail addresses', () => {
    const out = redactDiagnosticText('User maria.silva+x@gmail.com already registered');
    expect(out).toBe('User [REDACTED] already registered');
  });

  it('redacts credentials embedded in connection strings', () => {
    const out = redactDiagnosticText('connect failed postgres://svc:S3cr3tPw@10.0.0.5:5432/db');
    expect(out).not.toContain('S3cr3tPw');
    expect(out).toContain('postgres://[REDACTED]@10.0.0.5:5432/db');
  });

  it('redacts key=value secrets, JSON secrets, bearer tokens and JWTs', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0In0.abcDEF123_-';
    const out = redactDiagnosticText(
      `password=hunter2 api_key: abc123 {"access_token":"tok-999"} Authorization: Bearer abcdefgh12345678 jwt ${jwt}`,
    );
    for (const secret of ['hunter2', 'abc123', 'tok-999', 'abcdefgh12345678', jwt]) {
      expect(out).not.toContain(secret);
    }
  });

  it('keeps the non-sensitive diagnostic readable', () => {
    const raw = 'ECONNREFUSED 10.0.0.5:5432 password authentication failed';
    expect(redactDiagnosticText(raw)).toBe(raw);
  });

  it('does not mangle package@version segments in stack paths', () => {
    const line = 'at run (/app/node_modules/.pnpm/jest-circus@30.0.0_x/node_modules/jest-circus/build/run.js:765:3)';
    expect(redactDiagnosticText(line)).toBe(line);
  });

  it('handles empty input', () => {
    expect(redactDiagnosticText(undefined)).toBe('');
    expect(redactDiagnosticText(null)).toBe('');
    expect(redactDiagnosticText('')).toBe('');
  });

  it('stays fast and bounded on adversarial long input (S4-1)', () => {
    const inputs = [
      `x://${'a'.repeat(80000)}`,
      `${'a'.repeat(80000)}@`,
      `${'a.'.repeat(40000)}`,
      `a://${'b:'.repeat(40000)}`,
      `${'a'.repeat(50000)}@${'b'.repeat(50000)}`,
    ];
    const t = Date.now();
    for (const input of inputs) {
      const out = redactDiagnosticText(input);
      expect(out.length).toBeLessThanOrEqual(4100);
    }
    expect(Date.now() - t).toBeLessThan(1500);
  });

  it('still redacts an e-mail and credentials inside the first 4000 chars of a long message', () => {
    const out = redactDiagnosticText(`user a@b.com ${'z'.repeat(9000)} postgres://u:pw@h/db`);
    expect(out).not.toContain('a@b.com');
  });

  describe('SEC3 F-SEC-R1: no bounded-quantifier leaks', () => {
    it('redacts a connection-string password longer than the old 256 bound, and a long user', () => {
      const out = redactDiagnosticText(`postgres://user:${'p'.repeat(300)}@db.host/x`);
      expect(out).toBe('postgres://[REDACTED]@db.host/x');
      expect(redactDiagnosticText(`postgres://${'u'.repeat(200)}:pw@db.host/x`)).not.toContain('uuuu');
      expect(redactDiagnosticText(`${'A'.repeat(40)}://user:pw@host`)).not.toContain('pw@');
    });
    it('redacts a 100-char and a 300-char e-mail local part entirely', () => {
      expect(redactDiagnosticText(`${'a'.repeat(100)}@example.com`)).toBe('[REDACTED]');
      expect(redactDiagnosticText(`x ${'a.b'.repeat(100)}@example.com y`)).toBe('x [REDACTED] y');
    });
    it('redacts unicode e-mail addresses', () => {
      expect(redactDiagnosticText('josé@example.com e 山田@example.jp')).toBe('[REDACTED] e [REDACTED]');
    });
    it('redacts a secret that straddles the 4000-char cut (cut happens after redaction)', () => {
      const bearer = redactDiagnosticText(`${'x'.repeat(3985)} Bearer abcdefghijklmnopqrstuvwxyz`);
      expect(bearer).not.toContain('abc');
      const pwd = redactDiagnosticText(`${'x'.repeat(3995)} password=hunter2`);
      expect(pwd).not.toContain('hunter2');
      const mail = redactDiagnosticText(`${'x'.repeat(3990)} someone.long@example.com`);
      expect(mail).not.toContain('someone');
      expect(mail).not.toContain('@example');
      expect(mail.endsWith('…[truncated]')).toBe(true);
    });
    it('redacts an unterminated quoted secret', () => {
      expect(redactDiagnosticText('password="abc def ghi')).not.toContain('abc');
    });
    it('keeps the ReDoS guarantee on adversarial 4000-char inputs (< 50 ms each)', () => {
      const inputs = [
        'a'.repeat(4000), 'pass'.repeat(1000), '-'.repeat(4000), 'a@'.repeat(2000), 'a.'.repeat(2000),
        'a://'.repeat(1000), 'a://u:'.repeat(660), `${'a'.repeat(60)}@${'b.'.repeat(1900)}`,
        `a://${'b:'.repeat(2000)}`, `${'a'.repeat(2000)}@${'b'.repeat(2000)}`, 'a@b.'.repeat(1000), 'eyJ'.repeat(1300),
      ];
      for (const input of inputs) {
        const t = process.hrtime.bigint();
        redactDiagnosticText(input);
        expect(Number(process.hrtime.bigint() - t) / 1e6).toBeLessThan(50);
      }
    });
  });
});

describe('redactForStorage (SEC3 F-A2-1)', () => {
  it('redacts and caps persisted text', () => {
    const out = redactForStorage(new Error(`boom for a@b.com password=hunter2 ${'z'.repeat(2000)}`));
    expect(out).not.toContain('a@b.com');
    expect(out).not.toContain('hunter2');
    expect(out.length).toBeLessThanOrEqual(500);
  });
  it('handles non-strings and empty values', () => {
    expect(redactForStorage(undefined)).toBe('');
    expect(redactForStorage(null)).toBe('');
    expect(redactForStorage(42)).toBe('42');
  });
});
