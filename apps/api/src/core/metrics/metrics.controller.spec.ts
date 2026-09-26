import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';

function makeController(env: Record<string, string | undefined>) {
  const metrics = {
    dbUp: { set: jest.fn() },
    redisUp: { set: jest.fn() },
    render: jest.fn().mockResolvedValue('ok'),
  } as unknown as MetricsService;
  const config = {
    get: jest.fn((key: string) => env[key]),
  } as unknown as ConfigService;
  return new MetricsController(metrics, config, null);
}

function makeRequest(auth?: string, query: Record<string, unknown> = {}) {
  return {
    headers: auth ? { authorization: auth } : {},
    query,
  } as unknown as Request;
}

describe('MetricsController security', () => {
  it('rejects a token passed via query string', async () => {
    const controller = makeController({ NODE_ENV: 'development', METRICS_TOKEN: 'secret' });

    await expect(
      controller.scrape(makeRequest(undefined, { token: 'secret' })),
    ).rejects.toThrow(ForbiddenException);
  });

  it('requires METRICS_TOKEN in staging', async () => {
    const controller = makeController({ NODE_ENV: 'staging' });

    await expect(controller.scrape(makeRequest())).rejects.toThrow(ForbiddenException);
  });

  it('accepts only the correct Authorization Bearer in staging', async () => {
    const controller = makeController({ NODE_ENV: 'staging', METRICS_TOKEN: 'secret' });

    await expect(controller.scrape(makeRequest('Bearer secret'))).resolves.toBe('ok');
  });
});
