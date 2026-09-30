import { redactDiagnosticText } from './redact-diagnostic';

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
});
