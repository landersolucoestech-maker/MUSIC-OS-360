import { ReleaseStatus } from '@music-os-360/types';
import { ReleasesService } from './releases.service';
import { buildDistributionConfirmation, DISTRIBUTION_CONFIRMATION_KEY } from './release-distribution-confirmation';

const NOW = new Date('2026-10-06T12:00:00.000Z');
const valid = { source: 'external_confirmation', reference: 'DIST-TICKET-4821', confirmed_at: '2026-10-05' };

describe('buildDistributionConfirmation', () => {
  it('builds the record from what the person supplied and stamps who recorded it and when', () => {
    expect(buildDistributionConfirmation({ ...valid, note: '  confirmed by e-mail  ' }, 'user-7', NOW)).toEqual({
      source: 'external_confirmation',
      reference: 'DIST-TICKET-4821',
      confirmed_at: '2026-10-05',
      note: 'confirmed by e-mail',
      confirmed_by: 'user-7',
      recorded_at: '2026-10-06T12:00:00.000Z',
    });
  });

  it('ignores a confirmed_by or recorded_at sent by the client', () => {
    const record = buildDistributionConfirmation({ ...valid, confirmed_by: 'someone-else', recorded_at: '2020-01-01T00:00:00.000Z' }, 'user-7', NOW);
    expect(record.confirmed_by).toBe('user-7');
    expect(record.recorded_at).toBe('2026-10-06T12:00:00.000Z');
  });

  it.each(['external_confirmation', 'manual_operational'])('accepts the origin %s', (source) => {
    expect(buildDistributionConfirmation({ ...valid, source }, 'u', NOW).source).toBe(source);
  });

  it('accepts a date-time string by keeping its day', () => {
    expect(buildDistributionConfirmation({ ...valid, confirmed_at: '2026-10-05T10:30:00.000Z' }, 'u', NOW).confirmed_at).toBe('2026-10-05');
  });

  it.each([
    ['nothing at all', undefined, ['source', 'reference', 'confirmed_at']],
    ['an empty object', {}, ['source', 'reference', 'confirmed_at']],
    ['an array', [valid], ['source', 'reference', 'confirmed_at']],
    ['an unknown origin', { ...valid, source: 'automatic' }, ['source']],
    ['a plain "distributed" claim as origin', { ...valid, source: 'distributed' }, ['source']],
    ['a reference that is too short', { ...valid, reference: 'ab' }, ['reference']],
    ['a blank reference', { ...valid, reference: '   ' }, ['reference']],
    ['a reference that is too long', { ...valid, reference: 'x'.repeat(501) }, ['reference']],
    ['a date in the future', { ...valid, confirmed_at: '2026-12-01' }, ['confirmed_at']],
    ['a date that does not exist', { ...valid, confirmed_at: '2026-02-30' }, ['confirmed_at']],
    ['a malformed date', { ...valid, confirmed_at: '05/10/2026' }, ['confirmed_at']],
    ['a note that is too long', { ...valid, note: 'x'.repeat(1001) }, ['note']],
    ['a note that is not text', { ...valid, note: 42 }, ['note']],
  ])('rejects %s and names the invalid fields', (_label, input, fields) => {
    expect(() => buildDistributionConfirmation(input, 'u', NOW)).toThrow(expect.objectContaining({
      response: expect.objectContaining({ code: 'RELEASE_DISTRIBUTION_CONFIRMATION_INVALID', fields }),
    }));
  });

  it('accepts today and tomorrow (time zones) but not later', () => {
    expect(() => buildDistributionConfirmation({ ...valid, confirmed_at: '2026-10-06' }, 'u', NOW)).not.toThrow();
    expect(() => buildDistributionConfirmation({ ...valid, confirmed_at: '2026-10-07' }, 'u', NOW)).not.toThrow();
    expect(() => buildDistributionConfirmation({ ...valid, confirmed_at: '2026-10-08' }, 'u', NOW)).toThrow();
  });
});

describe('ReleasesService.update: Distributed needs a real confirmation', () => {
  function makeQb(rows: Array<Record<string, unknown>>) {
    const qb: Record<string, jest.Mock> = {};
    for (const m of ['leftJoin', 'leftJoinAndSelect', 'leftJoinAndMapOne', 'select', 'addSelect', 'where', 'andWhere', 'orderBy', 'skip', 'take']) qb[m] = jest.fn(() => qb);
    qb['getOne'] = jest.fn(async () => rows[0] ?? null);
    qb['getRawAndEntities'] = jest.fn(async () => ({ entities: rows, raw: rows }));
    qb['getRawMany'] = jest.fn(async () => rows);
    qb['getMany'] = jest.fn(async () => rows);
    return qb;
  }

  function build(row: Record<string, unknown>) {
    const qb = makeQb([row]);
    const repo = { createQueryBuilder: jest.fn(() => qb), update: jest.fn(async () => ({ affected: 1 })) };
    const ds = {
      getRepository: jest.fn(() => repo),
      transaction: jest.fn(async (cb: (em: unknown) => unknown) => cb({ getRepository: () => repo })),
    };
    const events = { emitTyped: jest.fn() };
    const workflow = { getAllowedTransitions: jest.fn(() => []), transitionInTx: jest.fn(async () => undefined) };
    return { svc: new ReleasesService(ds as never, workflow as never, events as never), repo, workflow, events };
  }

  const scheduled = (overrides: Record<string, unknown> = {}) => ({
    id: 'r1', tenant_id: 't1', title: 'Album', type: 'album', status: ReleaseStatus.SCHEDULED, artist_id: 'a1',
    metadata: { note: 'kept' }, ...overrides,
  });
  const written = (repo: { update: jest.Mock }) => repo.update.mock.calls[0][1] as Record<string, unknown>;

  it('rejects a plain status update to distributed: nothing is transitioned or written', async () => {
    const { svc, repo, workflow, events } = build(scheduled());
    await expect(svc.update('t1', 'u1', 'r1', { status: ReleaseStatus.DISTRIBUTED } as never))
      .rejects.toMatchObject({ response: { code: 'RELEASE_DISTRIBUTION_CONFIRMATION_INVALID', fields: ['source', 'reference', 'confirmed_at'] } });
    expect(workflow.transitionInTx).not.toHaveBeenCalled();
    expect(repo.update).not.toHaveBeenCalled();
    expect(events.emitTyped).not.toHaveBeenCalled();
  });

  it('rejects an incomplete confirmation', async () => {
    const { svc, repo } = build(scheduled());
    await expect(svc.update('t1', 'u1', 'r1', { status: ReleaseStatus.DISTRIBUTED, metadata: { [DISTRIBUTION_CONFIRMATION_KEY]: { source: 'manual_operational' } } } as never))
      .rejects.toMatchObject({ response: { fields: ['reference', 'confirmed_at'] } });
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('transitions with a valid confirmation and stores it, stamped by the server, next to the existing metadata', async () => {
    const { svc, repo, workflow } = build(scheduled());
    await svc.update('t1', 'user-9', 'r1', {
      status: ReleaseStatus.DISTRIBUTED,
      metadata: { [DISTRIBUTION_CONFIRMATION_KEY]: { ...valid, source: 'manual_operational', confirmed_by: 'forged', recorded_at: '2001-01-01T00:00:00.000Z' } },
    } as never);
    expect(workflow.transitionInTx).toHaveBeenCalledTimes(1);
    const set = written(repo);
    expect(set['status']).toBe(ReleaseStatus.DISTRIBUTED);
    const confirmation = (set['metadata'] as Record<string, Record<string, unknown>>)[DISTRIBUTION_CONFIRMATION_KEY];
    expect(confirmation).toMatchObject({ source: 'manual_operational', reference: 'DIST-TICKET-4821', confirmed_at: '2026-10-05', confirmed_by: 'user-9' });
    expect(confirmation['recorded_at']).not.toBe('2001-01-01T00:00:00.000Z');
    expect((set['metadata'] as Record<string, unknown>)['note']).toBe('kept');
  });

  it('does not require a confirmation for any other transition', async () => {
    const { svc, repo } = build(scheduled({ status: ReleaseStatus.APPROVED }));
    await expect(svc.update('t1', 'u1', 'r1', { status: ReleaseStatus.SCHEDULED } as never)).resolves.toBeDefined();
    expect(written(repo)['status']).toBe(ReleaseStatus.SCHEDULED);
    expect(written(repo)['metadata']).toBeUndefined();
  });

  it('ignores a confirmation sent outside the transition to distributed: it cannot be forged by an ordinary edit', async () => {
    const { svc, repo } = build(scheduled({ metadata: { note: 'kept' } }));
    await svc.update('t1', 'u1', 'r1', { notes: 'edit', metadata: { [DISTRIBUTION_CONFIRMATION_KEY]: valid, other: 1 } } as never);
    const metadata = written(repo)['metadata'] as Record<string, unknown>;
    expect(metadata).not.toHaveProperty(DISTRIBUTION_CONFIRMATION_KEY);
    expect(metadata).toMatchObject({ note: 'kept', other: 1 });
  });

  it('keeps the stored confirmation of a distributed release when the form saves it again, and ignores a rewritten one', async () => {
    const stored = { ...valid, confirmed_by: 'user-1', recorded_at: '2026-10-05T09:00:00.000Z' };
    const { svc, repo } = build(scheduled({
      status: ReleaseStatus.DISTRIBUTED, title: 'Album',
      metadata: { note: 'kept', [DISTRIBUTION_CONFIRMATION_KEY]: stored },
    }));
    await svc.update('t1', 'u2', 'r1', {
      notes: 'internal follow-up',
      metadata: { [DISTRIBUTION_CONFIRMATION_KEY]: { ...valid, reference: 'REWRITTEN' } },
    } as never);
    const metadata = written(repo)['metadata'] as Record<string, unknown>;
    expect(metadata[DISTRIBUTION_CONFIRMATION_KEY]).toEqual(stored);
  });
});
