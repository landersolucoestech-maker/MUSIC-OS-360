import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { PhonogramsService } from './phonograms.service';
import { DATA_SOURCE } from '../../database/database.module';
import { EventsService } from '../../core/events/events.service';

const TENANT = 'tenant-test';
const ID = 'phono-test';

function build(current: Record<string, unknown>) {
  const row = { id: ID, tenant_id: TENANT, title: 'T', type: 'master', deleted_at: null, ...current };
  const qb: any = { where: jest.fn(), andWhere: jest.fn(), getOne: jest.fn().mockResolvedValue(row), update: jest.fn(), set: jest.fn(), execute: jest.fn().mockResolvedValue({ affected: 1 }) };
  for (const k of ['where', 'andWhere', 'update', 'set']) qb[k].mockReturnValue(qb);
  const repo = {
    createQueryBuilder: jest.fn(() => qb),
    create: jest.fn((v: any) => v),
    save: jest.fn((v: any) => Promise.resolve({ id: ID, ...v })),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
  };
  return { ds: { getRepository: jest.fn(() => repo), query: jest.fn().mockResolvedValue([{ exists: 1 }]) }, repo };
}

async function make(current: Record<string, unknown> = {}) {
  const { ds, repo } = build(current);
  const module = await Test.createTestingModule({
    providers: [PhonogramsService, { provide: DATA_SOURCE, useValue: ds }, { provide: EventsService, useValue: { emitTyped: jest.fn() } }],
  }).compile();
  return { service: module.get(PhonogramsService), repo };
}

const PARTS = { isrc_country_code: 'BR', isrc_registrant_code: 'ABC', isrc_year: '26', isrc_designation_code: '00001' };

describe('PhonogramsService — authoritative/derived fields', () => {
  it('create: duration_text alone is parsed; duration_text rewritten from seconds', async () => {
    const { service, repo } = await make();
    await service.create(TENANT, 'u1', { title: 'T', duration_text: '3:25' } as any);
    expect(repo.create.mock.calls[0][0]).toMatchObject({ duration_seconds: 205, duration_text: '03:25' });
  });

  it('create: isrc normalised and the four parts derived', async () => {
    const { service, repo } = await make();
    await service.create(TENANT, 'u1', { title: 'T', isrc: 'br-abc-26-00001' } as any);
    expect(repo.create.mock.calls[0][0]).toMatchObject({ isrc: 'BRABC2600001', ...PARTS });
  });

  it.each([
    ['PHONOGRAM_DURATION_TEXT_INVALID', { duration_text: 'abc' }],
    ['PHONOGRAM_DURATION_MISMATCH', { duration_text: '03:25', duration_seconds: 100 }],
    ['PHONOGRAM_ISRC_MISMATCH', { isrc: 'BRABC2600001', isrc_year: '27' }],
    ['PHONOGRAM_ISRC_INVALID', { isrc: 'bad' }],
  ])('rejects %s with 400 and no write', async (code, payload) => {
    const { service, repo } = await make();
    const err = await service.update(TENANT, 'u1', ID, payload as any).catch((e) => e);
    expect(err).toBeInstanceOf(BadRequestException);
    expect(err.getResponse()).toMatchObject({ code });
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('partial PATCH of one part merges over the stored parts and recomposes the isrc', async () => {
    const { service, repo } = await make({ isrc: 'BRABC2600001', ...PARTS });
    await service.update(TENANT, 'u1', ID, { isrc_year: '27' } as any);
    expect(repo.update.mock.calls[0][1]).toMatchObject({ isrc: 'BRABC2700001', isrc_year: '27', isrc_country_code: 'BR' });
  });

  it('PATCH of duration_seconds alone rewrites duration_text', async () => {
    const { service, repo } = await make({ duration_seconds: 10, duration_text: '00:10' });
    await service.update(TENANT, 'u1', ID, { duration_seconds: 125 } as any);
    expect(repo.update.mock.calls[0][1]).toMatchObject({ duration_seconds: 125, duration_text: '02:05' });
  });

  it('null still does not clear the derived columns', async () => {
    const { service, repo } = await make({ duration_seconds: 10, duration_text: '00:10' });
    await service.update(TENANT, 'u1', ID, { duration_text: null, isrc: null } as any);
    const payload = repo.update.mock.calls[0][1];
    expect(payload).not.toHaveProperty('duration_text');
    expect(payload).not.toHaveProperty('isrc');
  });
});
