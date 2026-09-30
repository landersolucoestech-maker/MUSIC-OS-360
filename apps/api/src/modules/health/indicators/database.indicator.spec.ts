import { HealthCheckError } from '@nestjs/terminus';
import { isApiErrorCode } from '@music-os-360/types';
import { DatabaseHealthIndicator } from './database.indicator';
import { GlobalExceptionFilter } from '../../../core/filters/global-exception.filter';

const RAW_DRIVER_ERROR =
  'connect ECONNREFUSED 10.1.2.3:5432 password authentication failed for user "postgres" (postgres://app:s3cret@db.internal:5432/app)';

function dataSource(query: jest.Mock, isInitialized = true) {
  return { isInitialized, query, options: { url: 'postgres://app:s3cret@db.internal:5432/app' } } as never;
}

async function capture(indicator: DatabaseHealthIndicator): Promise<HealthCheckError> {
  try {
    await indicator.isHealthy('database');
  } catch (e) {
    return e as HealthCheckError;
  }
  throw new Error('expected the indicator to throw');
}

describe('DatabaseHealthIndicator (public GET /health/ready)', () => {
  let errorSpy: jest.SpyInstance;
  beforeEach(() => {
    errorSpy = jest.spyOn(require('@nestjs/common').Logger.prototype, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  it('failure carries only a stable code, never the raw driver text', async () => {
    const indicator = new DatabaseHealthIndicator(dataSource(jest.fn().mockRejectedValue(new Error(RAW_DRIVER_ERROR))));
    const err = await capture(indicator);
    const serialized = JSON.stringify(err.causes);
    expect(serialized).not.toMatch(/ECONNREFUSED|10\.1\.2\.3|s3cret|password authentication|db\.internal/);
    const db = (err.causes as Record<string, Record<string, unknown>>)['database'];
    expect(db['status']).toBe('down');
    expect(isApiErrorCode(db['code'])).toBe(true);
    expect(db).not.toHaveProperty('error');
  });

  it('the raw diagnostic is logged server-side, redacted', async () => {
    const indicator = new DatabaseHealthIndicator(dataSource(jest.fn().mockRejectedValue(new Error(RAW_DRIVER_ERROR))));
    await capture(indicator);
    const logged = errorSpy.mock.calls.map((c) => String(c[0])).join('\n');
    expect(logged).toContain('ECONNREFUSED');
    expect(logged).not.toContain('s3cret');
  });

  it('uninitialized data source also exposes a code only', async () => {
    const err = await capture(new DatabaseHealthIndicator(dataSource(jest.fn(), false)));
    const db = (err.causes as Record<string, Record<string, unknown>>)['database'];
    expect(isApiErrorCode(db['code'])).toBe(true);
    expect(db).not.toHaveProperty('reason');
  });

  it('healthy result does not disclose the database host', async () => {
    const indicator = new DatabaseHealthIndicator(dataSource(jest.fn().mockResolvedValue([{}])));
    const res = await indicator.isHealthy('database');
    expect(JSON.stringify(res)).not.toMatch(/db\.internal|s3cret/);
    expect(res['database']['status']).toBe('up');
  });

  it('end to end through GlobalExceptionFilter the 503 body has no raw text', async () => {
    const indicator = new DatabaseHealthIndicator(dataSource(jest.fn().mockRejectedValue(new Error(RAW_DRIVER_ERROR))));
    const cause = await capture(indicator);
    const { ServiceUnavailableException } = require('@nestjs/common');
    const exception = new ServiceUnavailableException({
      status: 'error',
      info: {},
      error: cause.causes,
      details: cause.causes,
    });
    let body: unknown;
    const res = { status: () => res, header: () => res, json: (b: unknown) => { body = b; } };
    const host = {
      switchToHttp: () => ({ getResponse: () => res, getRequest: () => ({ headers: {}, url: '/api/v1/health/ready', method: 'GET' }) }),
    };
    new GlobalExceptionFilter().catch(exception, host as never);
    expect(JSON.stringify(body)).not.toMatch(/ECONNREFUSED|10\.1\.2\.3|s3cret|db\.internal/);
  });
});
