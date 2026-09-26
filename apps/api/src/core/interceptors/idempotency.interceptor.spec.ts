import 'reflect-metadata';
import { of, throwError } from 'rxjs';
import { ConflictException } from '@nestjs/common';
import { IdempotencyInterceptor } from './idempotency.interceptor';
import { IdempotencyStore, IdempotencyEntry } from './idempotency.store';

// ── Fake store (synchronous in-memory, no Redis) ──────────────────────────────

function makeFakeStore(): IdempotencyStore {
  const mem = new Map<string, IdempotencyEntry>();

  return {
    get:        async (k: string)          => mem.get(k) ?? null,
    set:        async (k: string, v: IdempotencyEntry) => { mem.set(k, v); },
    setInflight: async (k: string)         => { mem.set(k, { body: null, statusCode: 0, expiresAt: -1 }); },
    delete:     async (k: string)          => { mem.delete(k); },
    onModuleDestroy: () => {},
  } as unknown as IdempotencyStore;
}

function makeInterceptor(store?: IdempotencyStore) {
  return new IdempotencyInterceptor(store ?? makeFakeStore());
}

function makeContext(opts: {
  key?: string;
  userId?: string;
  statusCode?: number;
  tenantId?: string;
} = {}) {
  const headers: Record<string, string> = {};
  if (opts.key) headers['x-idempotency-key'] = opts.key;

  const setHeaderSpy = jest.fn();
  const statusSpy    = jest.fn();

  const res = {
    statusCode:  opts.statusCode ?? 201,
    setHeader:   setHeaderSpy,
    status:      statusSpy,
  };

  const req = {
    headers,
    auth: opts.userId ? { userId: opts.userId } : undefined,
    tenant: opts.tenantId ? { id: opts.tenantId } : undefined,
  };

  return {
    getHandler:   jest.fn(),
    getClass:     jest.fn(),
    switchToHttp: jest.fn().mockReturnValue({
      getRequest:  jest.fn().mockReturnValue(req),
      getResponse: jest.fn().mockReturnValue(res),
    }),
    res,
    setHeaderSpy,
    statusSpy,
  } as any;
}

describe('IdempotencyInterceptor', () => {
  afterEach(() => jest.clearAllMocks());

  it('without X-Idempotency-Key passes directly to the handler', (done) => {
    const interceptor = makeInterceptor();
    const ctx         = makeContext();
    const next        = { handle: jest.fn().mockReturnValue(of({ id: '1' })) };

    interceptor.intercept(ctx, next).subscribe({
      next: (v) => {
        expect(v).toEqual({ id: '1' });
        expect(next.handle).toHaveBeenCalledTimes(1);
        done();
      },
    });
  });

  it('malformed key is ignored (handler executes normally)', (done) => {
    const interceptor = makeInterceptor();
    const ctx         = makeContext({ key: '../../../etc/passwd' });
    const next        = { handle: jest.fn().mockReturnValue(of({ id: '2' })) };

    interceptor.intercept(ctx, next).subscribe({
      next: (v) => {
        expect(v).toEqual({ id: '2' });
        expect(next.handle).toHaveBeenCalledTimes(1);
        done();
      },
    });
  });

  it('first call with a valid key executes the handler and caches the response', (done) => {
    const interceptor = makeInterceptor();
    const key         = `test-first-call-${Date.now()}`;
    const ctx         = makeContext({ key, userId: 'user-abc', statusCode: 201 });
    const body        = { id: 'txn-001' };
    const next        = { handle: jest.fn().mockReturnValue(of(body)) };

    interceptor.intercept(ctx, next).subscribe({
      next: (v) => {
        expect(v).toEqual(body);
        expect(next.handle).toHaveBeenCalledTimes(1);
        done();
      },
    });
  });

  it('second call with the same key returns the cached response without executing the handler', (done) => {
    const store       = makeFakeStore();
    const interceptor = makeInterceptor(store);
    const key         = `test-replay-${Date.now()}`;
    const body        = { id: 'txn-002' };
    const ctx1        = makeContext({ key, userId: 'user-xyz', statusCode: 201 });
    const ctx2        = makeContext({ key, userId: 'user-xyz', statusCode: 201 });
    const next        = { handle: jest.fn().mockReturnValue(of(body)) };

    interceptor.intercept(ctx1, next).subscribe({
      complete: () => {
        interceptor.intercept(ctx2, next).subscribe({
          next: (v) => {
            expect(v).toEqual(body);
            expect(next.handle).toHaveBeenCalledTimes(1);
            expect(ctx2.setHeaderSpy).toHaveBeenCalledWith('X-Idempotency-Replayed', 'true');
            done();
          },
        });
      },
    });
  });

  it('different keys for the same user execute independent handlers', (done) => {
    const store = makeFakeStore();
    const interceptor = makeInterceptor(store);
    const ts    = Date.now();
    const ctx1  = makeContext({ key: `key-a-${ts}`, userId: 'user-multi' });
    const ctx2  = makeContext({ key: `key-b-${ts}`, userId: 'user-multi' });
    const next1 = { handle: jest.fn().mockReturnValue(of({ id: 'a' })) };
    const next2 = { handle: jest.fn().mockReturnValue(of({ id: 'b' })) };

    interceptor.intercept(ctx1, next1).subscribe({
      complete: () => {
        interceptor.intercept(ctx2, next2).subscribe({
          next: (v) => {
            expect(v).toEqual({ id: 'b' });
            expect(next1.handle).toHaveBeenCalledTimes(1);
            expect(next2.handle).toHaveBeenCalledTimes(1);
            done();
          },
        });
      },
    });
  });

  it('the same key from different users executes independent handlers', (done) => {
    const store = makeFakeStore();
    const interceptor = makeInterceptor(store);
    const key   = `shared-key-${Date.now()}`;
    const ctx1  = makeContext({ key, userId: 'user-1' });
    const ctx2  = makeContext({ key, userId: 'user-2' });
    const next1 = { handle: jest.fn().mockReturnValue(of({ result: 'user1' })) };
    const next2 = { handle: jest.fn().mockReturnValue(of({ result: 'user2' })) };

    interceptor.intercept(ctx1, next1).subscribe({
      complete: () => {
        interceptor.intercept(ctx2, next2).subscribe({
          next: (v) => {
            expect(v).toEqual({ result: 'user2' });
            expect(next1.handle).toHaveBeenCalledTimes(1);
            expect(next2.handle).toHaveBeenCalledTimes(1);
            done();
          },
        });
      },
    });
  });

  it('when the handler throws, the placeholder is removed (retry allowed)', (done) => {
    const store       = makeFakeStore();
    const interceptor = makeInterceptor(store);
    const key         = `error-retry-${Date.now()}`;
    const ctx         = makeContext({ key, userId: 'user-err' });
    const next        = { handle: jest.fn().mockReturnValue(throwError(() => new Error('DB failure'))) };

    interceptor.intercept(ctx, next).subscribe({
      error: () => {
        const ctx2  = makeContext({ key, userId: 'user-err', statusCode: 201 });
        const next2 = { handle: jest.fn().mockReturnValue(of({ id: 'retry-ok' })) };
        interceptor.intercept(ctx2, next2).subscribe({
          next: (v) => {
            expect(v).toEqual({ id: 'retry-ok' });
            expect(next2.handle).toHaveBeenCalledTimes(1);
            done();
          },
        });
      },
    });
  });

  it('in-flight placeholder throws ConflictException for a concurrent request', (done) => {
    const store = makeFakeStore();
    // Pre-seed an in-flight placeholder
    const cacheKey = 'no-tenant:user-concurrent:test-concurrent-key';
    void store.setInflight(cacheKey);

    const interceptor = makeInterceptor(store);
    const ctx         = makeContext({ key: 'test-concurrent-key', userId: 'user-concurrent' });
    const next        = { handle: jest.fn().mockReturnValue(of({})) };

    interceptor.intercept(ctx, next).subscribe({
      error: (err) => {
        expect(err).toBeInstanceOf(ConflictException);
        expect(next.handle).not.toHaveBeenCalled();
        done();
      },
    });
  });

  // find-37b2adef: the same user acting in two different tenants, replaying
  // the same client-generated X-Idempotency-Key, must NEVER see tenant A's
  // cached response body returned for a tenant B request.
  it('same userId + same idempotency key across different tenants: NEVER replays the other tenant\'s response', (done) => {
    const store = makeFakeStore();
    const interceptor = makeInterceptor(store);
    const keyOpts = { key: 'shared-key', userId: 'user-shared' };

    const ctxTenantA = makeContext({ ...keyOpts, tenantId: 'tenant-a' });
    const nextA = { handle: jest.fn().mockReturnValue(of({ secret: 'tenant-a-data' })) };

    interceptor.intercept(ctxTenantA, nextA).subscribe({
      next: () => {
        // Give the fire-and-forget store.set() a tick to land before tenant B replays.
        setImmediate(() => {
          const ctxTenantB = makeContext({ ...keyOpts, tenantId: 'tenant-b' });
          const nextB = { handle: jest.fn().mockReturnValue(of({ secret: 'tenant-b-data' })) };

          interceptor.intercept(ctxTenantB, nextB).subscribe({
            next: (v) => {
              expect(v).toEqual({ secret: 'tenant-b-data' });
              expect(nextB.handle).toHaveBeenCalled();
              done();
            },
          });
        });
      },
    });
  });
});
