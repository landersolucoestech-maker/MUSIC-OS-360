import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { of, throwError, lastValueFrom } from 'rxjs';
import { LoggingInterceptor } from './logging.interceptor';

/** find-936c6f8d: the HTTP access log must not carry OAuth code/state or verify tokens. */
describe('LoggingInterceptor — query-string credentials never reach the access log', () => {
  const ctx = (url: string, statusCode = 200) => ({
    switchToHttp: () => ({
      getRequest: () => ({ method: 'GET', url }),
      getResponse: () => ({ statusCode }),
    }),
  }) as never;

  it('success line redacts code/state', async () => {
    const spy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    await lastValueFrom(new LoggingInterceptor().intercept(
      ctx('/api/v1/integrations/spotify/callback?code=AQD-secret&state=st-secret'),
      { handle: () => of({}) },
    ));
    const line = String(spy.mock.calls.at(-1)?.[0]);
    expect(line).not.toContain('AQD-secret');
    expect(line).not.toContain('st-secret');
    expect(line).toContain('/api/v1/integrations/spotify/callback?code=[REDACTED]');
    spy.mockRestore();
  });

  it('error line redacts hub.verify_token', async () => {
    const spy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const err = Object.assign(new Error('nope'), { status: 403 });
    await expect(lastValueFrom(new LoggingInterceptor().intercept(
      ctx('/webhooks/whatsapp?hub.verify_token=vt-secret&hub.mode=subscribe', 403),
      { handle: () => throwError(() => err) },
    ))).rejects.toThrow('nope');
    const line = String(spy.mock.calls.at(-1)?.[0]);
    expect(line).not.toContain('vt-secret');
    spy.mockRestore();
  });
});
