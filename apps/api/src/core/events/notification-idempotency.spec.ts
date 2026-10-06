import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NotificationHandler } from './notification.handler';
import { deterministicNotificationId } from './notification-idempotency';
import { DOMAIN_EVENTS } from './events.service';

const BASE = ['t1', 'u1', 'contract.signed', 'contract', 'c1', '2026-10-06T12:00:00.000Z'];

describe('deterministicNotificationId', () => {
  it('is a valid version 5 UUID', () => {
    expect(deterministicNotificationId(BASE)).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('is the same for the same event identity', () => {
    expect(deterministicNotificationId(BASE)).toBe(deterministicNotificationId([...BASE]));
  });

  it.each([
    ['tenant', 0, 't2'],
    ['user', 1, 'u2'],
    ['type', 2, 'contract.expired'],
    ['aggregate type', 3, 'release'],
    ['aggregate id', 4, 'c2'],
    ['emission time', 5, '2026-10-06T12:00:00.001Z'],
  ])('differs when the %s differs', (_label, index, value) => {
    const changed = [...BASE];
    changed[index] = value;
    expect(deterministicNotificationId(changed)).not.toBe(deterministicNotificationId(BASE));
  });

  it('does not confuse the field boundaries', () => {
    expect(deterministicNotificationId(['ab', 'c'])).not.toBe(deterministicNotificationId(['a', 'bc']));
  });
});

describe('NotificationHandler: a repeated delivery of the same event creates one notification', () => {
  const event = (overrides: Record<string, unknown> = {}) => ({
    type: DOMAIN_EVENTS.CONTRACT_SIGNED,
    tenantId: 't1',
    userId: 'u1',
    aggregateType: 'contract',
    aggregateId: 'c1',
    occurredAt: '2026-10-06T12:00:00.000Z',
    payload: { title: 'Deal' },
    ...overrides,
  });

  function build(existing: unknown = null) {
    const repo = {
      create: jest.fn((v: unknown) => v),
      save: jest.fn().mockResolvedValue(undefined),
      findOne: jest.fn().mockResolvedValue(existing),
    };
    const ws = { sendToTenant: jest.fn() };
    const dbContext = { runInTenantContext: jest.fn((_c: unknown, work: (m: unknown) => unknown) => work({ getRepository: () => repo })) };
    const ds = { getRepository: jest.fn(() => repo) };
    const handler = new NotificationHandler(ws as never, ds as never, dbContext as never);
    return { handler, repo, ws };
  }

  it('the first delivery creates the notification with the deterministic id and broadcasts it', async () => {
    const { handler, repo, ws } = build(null);
    await handler.onDomainNotificationEvent(event() as never);
    const expected = deterministicNotificationId(['t1', 'u1', 'contract.signed', 'contract', 'c1', '2026-10-06T12:00:00.000Z']);
    expect(repo.findOne).toHaveBeenCalledWith({ where: { id: expected, tenant_id: 't1' } });
    expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ id: expected, user_id: 'u1', entity_id: 'c1' }));
    expect(ws.sendToTenant).toHaveBeenCalledWith('t1', 'notification', expect.objectContaining({ id: expected }));
  });

  it('a second delivery of the same event creates nothing and does not broadcast again', async () => {
    const { handler, repo, ws } = build({ id: 'already-there' });
    await handler.onDomainNotificationEvent(event() as never);
    expect(repo.save).not.toHaveBeenCalled();
    expect(ws.sendToTenant).not.toHaveBeenCalled();
  });

  it('a new occurrence of the same kind of event is a new notification', async () => {
    const { handler, repo } = build(null);
    await handler.onDomainNotificationEvent(event() as never);
    await handler.onDomainNotificationEvent(event({ occurredAt: '2026-10-06T12:05:00.000Z' }) as never);
    const ids = (repo.save as jest.Mock).mock.calls.map((c) => (c[0] as { id: string }).id);
    expect(ids).toHaveLength(2);
    expect(ids[0]).not.toBe(ids[1]);
  });

  it('two different events of one type without an aggregate, emitted in the same millisecond, are two notifications', async () => {
    const { handler, repo } = build(null);
    await handler.onDomainNotificationEvent(event({ aggregateId: undefined, payload: { title: 'First' } }) as never);
    await handler.onDomainNotificationEvent(event({ aggregateId: undefined, payload: { title: 'Second' } }) as never);
    const ids = (repo.save as jest.Mock).mock.calls.map((c) => (c[0] as { id: string }).id);
    expect(new Set(ids).size).toBe(2);
  });

  it('the same event without an aggregate delivered twice keeps one id', async () => {
    const { handler, repo } = build(null);
    await handler.onDomainNotificationEvent(event({ aggregateId: undefined, payload: { title: 'Same' } }) as never);
    await handler.onDomainNotificationEvent(event({ aggregateId: undefined, payload: { title: 'Same' } }) as never);
    const ids = (repo.save as jest.Mock).mock.calls.map((c) => (c[0] as { id: string }).id);
    expect(ids[0]).toBe(ids[1]);
  });

  it('an event without an emission time has no stable identity: it is still delivered, with no lookup', async () => {
    const { handler, repo } = build({ id: 'would-match' });
    await handler.onDomainNotificationEvent(event({ occurredAt: undefined }) as never);
    expect(repo.findOne).not.toHaveBeenCalled();
    expect(repo.save).toHaveBeenCalledTimes(1);
  });

  it('a concurrent duplicate that hits the primary key is treated as a duplicate, not logged as a failure', async () => {
    const { handler, repo, ws } = build(null);
    repo.save.mockRejectedValueOnce(Object.assign(new Error('duplicate key value'), { code: '23505' }));
    const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    await handler.onDomainNotificationEvent(event() as never);
    expect(errorSpy).not.toHaveBeenCalled();
    expect(ws.sendToTenant).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('any other persistence failure is still logged as an error', async () => {
    const { handler, repo } = build(null);
    repo.save.mockRejectedValueOnce(new Error('connection lost'));
    const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    await handler.onDomainNotificationEvent(event() as never);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('failed to persist notification'));
    errorSpy.mockRestore();
  });
});
