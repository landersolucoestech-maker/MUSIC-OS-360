import 'reflect-metadata';
import type { ConfigService } from '@nestjs/config';
import type { DataSource } from 'typeorm';

jest.mock('@supabase/supabase-js', () => {
  const send = jest.fn().mockResolvedValue(undefined);
  const subscribe = jest.fn((cb: (status: string) => void) => {
    cb('SUBSCRIBED');
    return { send };
  });
  const channel = jest.fn(() => ({ subscribe, send }));
  const removeChannel = jest.fn();
  const removeAllChannels = jest.fn();
  const ctor = jest.fn(() => ({ channel, removeChannel, removeAllChannels }));
  return { createClient: ctor, __channel: channel, __send: send };
});

import { RealtimeService } from './realtime.service';
import { tenantAls } from '../../database/tenant-als';

function channelMock() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('@supabase/supabase-js').__channel as jest.Mock;
}

function flush() {
  return new Promise((resolve) => setImmediate(resolve));
}

/**
 * Regression: RealtimeService.sendToTenant received tenants.id (PK) from all
 * callers and published to `tenant:<tenants.id>` — but the channel's RLS
 * authorization policy (20260801000001_RealtimeBroadcastAuthorization) and the
 * frontend (ws-client.ts) authorize/subscribe to `tenant:<org_id>`. Broadcasts
 * never arrived. The fix resolves tenants.id -> tenants.org_id internally
 * before publishing, without requiring any caller to change — this test
 * proves that the published topic uses org_id, not the tenantId passed by
 * the caller.
 */
describe('RealtimeService — canonical tenant topic (tenants.id -> org_id)', () => {
  function makeService(tenantRow: { org_id: string } | null = { org_id: 'org-xyz-canonical' }) {
    const config = {
      get: jest.fn((key: string) => {
        if (key === 'SUPABASE_URL') return 'https://example.supabase.co';
        if (key === 'SUPABASE_SERVICE_ROLE_KEY') return 'service-role-key';
        return undefined;
      }),
    } as unknown as ConfigService;

    const findOne = jest.fn().mockResolvedValue(tenantRow);
    const tenantRepo = { findOne };
    const ds = { getRepository: jest.fn(() => tenantRepo) } as unknown as DataSource;

    return { service: new RealtimeService(config, ds), findOne };
  }

  beforeEach(() => jest.clearAllMocks());

  it('sendToTenant publishes to tenant:<org_id>, never to tenant:<tenants.id>', async () => {
    const { service, findOne } = makeService({ org_id: 'org-xyz-canonical' });

    service.sendToTenant('tenant-pk-123', 'conversation:message', { hello: 'world' });
    await flush();

    expect(findOne).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'tenant-pk-123' } }));
    expect(channelMock()).toHaveBeenCalledWith('tenant:org-xyz-canonical', expect.anything());
    expect(channelMock()).not.toHaveBeenCalledWith('tenant:tenant-pk-123', expect.anything());
  });

  it('resolves org_id only once per tenant (cache) on subsequent calls', async () => {
    const { service, findOne } = makeService({ org_id: 'org-cached' });

    service.sendToTenant('tenant-1', 'conversation:created', {});
    await flush();
    service.sendToTenant('tenant-1', 'conversation:updated', {});
    await flush();

    expect(findOne).toHaveBeenCalledTimes(1);
    expect(channelMock()).toHaveBeenCalledWith('tenant:org-cached', expect.anything());
  });

  it('nonexistent tenant: does not publish to a topic using the raw tenantId as a fallback', async () => {
    const { service } = makeService(null);

    service.sendToTenant('unknown-tenant', 'conversation:message', {});
    await flush();

    expect(channelMock()).not.toHaveBeenCalledWith('tenant:unknown-tenant', expect.anything());
    expect(channelMock()).not.toHaveBeenCalled();
  });

  it('sendToUser publishes to the user channel with the literal id AND to the resolved tenant:<org_id>', async () => {
    const { service } = makeService({ org_id: 'org-for-user' });

    service.sendToUser('tenant-pk-999', 'user-abc', 'notification:new', {});
    await flush();

    expect(channelMock()).toHaveBeenCalledWith('user:user-abc', expect.anything());
    expect(channelMock()).toHaveBeenCalledWith('tenant:org-for-user', expect.anything());
  });

  it('sendToUserOnly publishes only to the user channel, never to the tenant channel (private point-to-point event)', async () => {
    const { service } = makeService({ org_id: 'org-for-user' });

    service.sendToUserOnly('user-abc', 'internalConversation:message', {});
    await flush();

    expect(channelMock()).toHaveBeenCalledWith('user:user-abc', expect.anything());
    expect(channelMock()).not.toHaveBeenCalledWith('tenant:org-for-user', expect.anything());
  });
});

/**
 * Regression (Metrics Phase 1.1 — investigated P1): sendToTenant/notifyDataChanged
 * are fire-and-forget — if called from inside
 * RequestTenantContextInterceptor/DatabaseContextService.runInTenantContext
 * (DATABASE_SESSION_CONTEXT_ENABLED=true), the request-scoped QueryRunner may
 * already have been released (runInTenantContext's finally) before the async
 * resolveOrgId query finishes, throwing QueryRunnerAlreadyReleasedError —
 * RealtimeService uses service_role and never needed the tenant/ALS context
 * for this query. This simulates exactly that: a repo whose findOne throws if
 * seen from inside an active ALS store (as would happen with the manager of
 * an already-released QueryRunner).
 */
describe('RealtimeService — does not depend on the ALS request-scoped EntityManager/QueryRunner (Metrics Phase 1.1)', () => {
  it('resolveOrgId never sees the active ALS store — never throws even when called from inside a tenant context', async () => {
    const config = {
      get: jest.fn((key: string) => {
        if (key === 'SUPABASE_URL') return 'https://example.supabase.co';
        if (key === 'SUPABASE_SERVICE_ROLE_KEY') return 'service-role-key';
        return undefined;
      }),
    } as unknown as ConfigService;

    const findOne = jest.fn(async () => {
      // Simulates the manager of an already-released request-scoped QueryRunner:
      // if the DATA_SOURCE Proxy still sees an active ALS store here, that's a
      // sign the query would route to that manager — exactly the bug.
      if (tenantAls.getStore()) {
        throw new Error('QueryRunnerAlreadyReleasedError (simulated): request-scoped manager already released');
      }
      return { org_id: 'org-safe' };
    });
    const tenantRepo = { findOne };
    const ds = { getRepository: jest.fn(() => tenantRepo) } as unknown as DataSource;
    const service = new RealtimeService(config, ds);

    // Simulates being inside runInTenantContext (interceptor/job) at the
    // moment the fire-and-forget broadcast is triggered.
    const fakeManager = {} as never;
    await tenantAls.run({ manager: fakeManager }, async () => {
      service.sendToTenant('tenant-1', 'conversation:message', { hello: 'world' });
    });
    await flush();

    expect(findOne).toHaveBeenCalledTimes(1);
    expect(findOne).not.toThrow;
    expect(channelMock()).toHaveBeenCalledWith('tenant:org-safe', expect.anything());
  });
});
