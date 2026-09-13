import type { ExecutionContext } from '@nestjs/common';
import { RateLimitGuard } from './rate-limit.guard';
import type { RateLimitService } from '../security/rate-limit.service';

function makeContext(path: string, method = 'GET') {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        method,
        path,
        headers: {},
        ip: '127.0.0.1',
      }),
    }),
  } as unknown as ExecutionContext;
}

function makeContextWithHeaders(
  path: string,
  headers: Record<string, string>,
  socketRemoteAddress = '203.0.113.9',
) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        method: 'POST',
        path,
        headers,
        ip: socketRemoteAddress,
        socket: { remoteAddress: socketRemoteAddress },
      }),
    }),
  } as unknown as ExecutionContext;
}

describe('RateLimitGuard categories', () => {
  it.each([
    ['/api/v1/auth/login', 'auth'],
    ['/api/v1/dev-auth/token', 'auth'],
    ['/api/v1/ai/complete', 'ai'],
    ['/api/v1/uploads/presign', 'upload'],
    ['/api/v1/billing/webhook/stripe', 'webhook'],
    ['/api/v1/artists', 'api'],
  ])('aplica categoria %s -> %s', async (path, category) => {
    const service = { check: jest.fn().mockResolvedValue(undefined) };
    const guard = new RateLimitGuard(service as unknown as RateLimitService);

    await expect(guard.canActivate(makeContext(path))).resolves.toBe(true);

    expect(service.check).toHaveBeenCalledWith(
      category,
      expect.stringContaining(`GET:${path}`),
    );
  });
});

describe('RateLimitGuard — find-fd6b5b2b: client IP cannot be spoofed via forwarded headers by default', () => {
  const ORIGINAL_ENV = process.env['RATE_LIMIT_TRUST_PROXY'];
  afterEach(() => {
    if (ORIGINAL_ENV === undefined) delete process.env['RATE_LIMIT_TRUST_PROXY'];
    else process.env['RATE_LIMIT_TRUST_PROXY'] = ORIGINAL_ENV;
  });

  it('sem RATE_LIMIT_TRUST_PROXY: duas requisições da mesma conexão com X-Forwarded-For diferentes caem no mesmo bucket (spoofing não funciona mais)', async () => {
    delete process.env['RATE_LIMIT_TRUST_PROXY'];
    const service = { check: jest.fn().mockResolvedValue(undefined) };
    const guard = new RateLimitGuard(service as unknown as RateLimitService);

    await guard.canActivate(makeContextWithHeaders('/api/v1/auth/login', { 'x-forwarded-for': '1.1.1.1' }, '203.0.113.9'));
    await guard.canActivate(makeContextWithHeaders('/api/v1/auth/login', { 'x-forwarded-for': '2.2.2.2' }, '203.0.113.9'));

    const [firstIdentifier] = service.check.mock.calls[0]!;
    const [secondIdentifier] = service.check.mock.calls[1]!;
    expect(service.check.mock.calls[0]![1]).toBe(service.check.mock.calls[1]![1]);
    expect(service.check.mock.calls[0]![1]).toContain('203.0.113.9');
    void firstIdentifier;
    void secondIdentifier;
  });

  it('sem RATE_LIMIT_TRUST_PROXY: CF-Connecting-IP e X-Real-IP também são ignorados, mesma conexão sempre no mesmo bucket', async () => {
    delete process.env['RATE_LIMIT_TRUST_PROXY'];
    const service = { check: jest.fn().mockResolvedValue(undefined) };
    const guard = new RateLimitGuard(service as unknown as RateLimitService);

    await guard.canActivate(makeContextWithHeaders('/api/v1/auth/login', { 'cf-connecting-ip': '9.9.9.9', 'x-real-ip': '8.8.8.8' }, '203.0.113.9'));

    expect(service.check.mock.calls[0]![1]).toContain('203.0.113.9');
    expect(service.check.mock.calls[0]![1]).not.toContain('9.9.9.9');
    expect(service.check.mock.calls[0]![1]).not.toContain('8.8.8.8');
  });

  it('com RATE_LIMIT_TRUST_PROXY=true: volta a honrar CF-Connecting-IP (opt-in explícito de operador)', async () => {
    process.env['RATE_LIMIT_TRUST_PROXY'] = 'true';
    const service = { check: jest.fn().mockResolvedValue(undefined) };
    const guard = new RateLimitGuard(service as unknown as RateLimitService);

    await guard.canActivate(makeContextWithHeaders('/api/v1/auth/login', { 'cf-connecting-ip': '9.9.9.9' }, '203.0.113.9'));

    expect(service.check.mock.calls[0]![1]).toContain('9.9.9.9');
  });
});
