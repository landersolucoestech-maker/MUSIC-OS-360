import { Logger } from '@nestjs/common';
import { integrationNotConfigured } from './integration-not-configured';

describe('integrationNotConfigured', () => {
  it('answers 503 with PT-BR copy and a machine code, logging (not returning) the missing settings', () => {
    const logSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const exception = integrationNotConfigured('Spotify', 'SOUNDCHARTS_NOT_CONFIGURED', ['SOUNDCHARTS_CLIENT_ID', 'SOUNDCHARTS_CLIENT_SECRET']);

    expect(exception.getStatus()).toBe(503);
    const body = exception.getResponse() as { error: string; message: string };
    expect(body.error).toBe('SOUNDCHARTS_NOT_CONFIGURED');
    expect(body.message).toBe('A integração com Spotify não está configurada. Contate o administrador do sistema.');
    expect(JSON.stringify(body)).not.toMatch(/SOUNDCHARTS_CLIENT/);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('SOUNDCHARTS_CLIENT_ID, SOUNDCHARTS_CLIENT_SECRET'));
    logSpy.mockRestore();
  });
});
