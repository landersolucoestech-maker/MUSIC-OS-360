import { Logger } from '@nestjs/common';
import { providerCallFailed } from './provider-failure';

describe('providerCallFailed', () => {
  it('response carries only the stable code and PT-BR copy; raw text is logged redacted', () => {
    const logger = new Logger('t');
    const spy = jest.spyOn(logger, 'error').mockImplementation(() => undefined);
    const err = providerCallFailed(logger, 'DocuSign', 'TypeError: fetch failed for user a@b.com at https://x:pw@host/');
    expect(err.getStatus()).toBe(503);
    const body = err.getResponse() as Record<string, unknown>;
    expect(body['error']).toBe('INTEGRATION_CALL_FAILED');
    expect(JSON.stringify(body)).not.toMatch(/fetch failed|a@b\.com|pw/);
    expect(String(spy.mock.calls[0][0])).toContain('fetch failed');
    expect(String(spy.mock.calls[0][0])).not.toContain('a@b.com');
  });
});
