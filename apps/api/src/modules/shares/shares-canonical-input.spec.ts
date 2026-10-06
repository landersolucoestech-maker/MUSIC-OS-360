import 'reflect-metadata';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { SharesService } from './shares.service';
import { CreateShareDto, UpdateShareDto } from './dto/shares.dto';

/**
 * Canonical registry-share inputs (holder_name, holder_document, work_id,
 * phonogram_id, party_role) plus the deprecated EN aliases (holderName,
 * holderDoc, workId, trackId, role). Bodies go through the real Nest
 * ValidationPipe with the same options as create-app.ts, then into the service.
 */
const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  transformOptions: { enableImplicitConversion: true },
});
const run = <T>(type: new () => T, body: Record<string, unknown>) =>
  pipe.transform(body, { type: 'body', metatype: type }) as Promise<T>;

const W1 = 'work-1';
const W2 = 'work-2';

function makeService() {
  const repo = {
    create: jest.fn((v: unknown) => v),
    save: jest.fn(async (v: unknown) => ({ id: 'share-1', ...(v as object) })),
    createQueryBuilder: jest.fn(() => {
      const qb: Record<string, jest.Mock> = {};
      for (const m of ['select', 'where', 'andWhere']) qb[m] = jest.fn(() => qb);
      qb['getRawOne'] = jest.fn(async () => ({ sum: '0' }));
      return qb;
    }),
  };
  const manager = { getRepository: jest.fn(() => repo), query: jest.fn().mockResolvedValue([]) };
  const ds = {
    query: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
    getRepository: jest.fn(() => repo),
    transaction: jest.fn(async (cb: (m: unknown) => unknown) => cb(manager)),
  };
  return { service: new SharesService(ds as never), repo };
}

async function persisted(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const { service, repo } = makeService();
  await service.create('tenant-1', await run(CreateShareDto, body));
  return repo.create.mock.calls[0][0] as Record<string, unknown>;
}

const ALIAS_KEYS = ['holderName', 'holderDoc', 'workId', 'trackId', 'role'];

describe('CreateShareDto canonical + deprecated registry inputs (real ValidationPipe)', () => {
  it('accepts the canonical Work split body and persists the canonical columns', async () => {
    const row = await persisted({
      holder_name: 'Maria', holder_document: '123', work_id: W1, party_role: 'author', percentage: 40,
    });
    expect(row).toMatchObject({
      tenant_id: 'tenant-1', holder_name: 'Maria', holder_document: '123', work_id: W1, party_role: 'author', percentage: 40,
    });
    expect(row['phonogram_id']).toBeUndefined();
  });

  it('accepts the canonical Phonogram split body and persists the canonical columns', async () => {
    const row = await persisted({ holder_name: 'Maria', holder_document: '123', phonogram_id: 'ph-1', party_role: 'producer', percentage: 40 });
    expect(row).toMatchObject({ tenant_id: 'tenant-1', phonogram_id: 'ph-1', party_role: 'producer', percentage: 40 });
    expect(row['work_id']).toBeUndefined();
  });

  it('still accepts the deprecated Work body, mapped to the same columns with no alias key persisted', async () => {
    const row = await persisted({ holderName: 'Maria', holderDoc: '123', workId: W1, role: 'author', percentage: 40 });
    expect(row).toMatchObject({ holder_name: 'Maria', holder_document: '123', work_id: W1, party_role: 'author' });
    for (const k of ALIAS_KEYS) expect(row).not.toHaveProperty(k);
  });

  it('still accepts the deprecated Phonogram body (trackId), mapped to phonogram_id', async () => {
    const row = await persisted({ holderName: 'Maria', holderDoc: '123', trackId: 'ph-1', role: 'producer', percentage: 40 });
    expect(row).toMatchObject({ holder_name: 'Maria', phonogram_id: 'ph-1', party_role: 'producer' });
    for (const k of ALIAS_KEYS) expect(row).not.toHaveProperty(k);
  });

  it('canonical wins when both names carry different values (Work)', async () => {
    const row = await persisted({
      holder_name: 'Canon', holderName: 'Old', holder_document: 'C', holderDoc: 'O',
      work_id: W1, workId: W2, party_role: 'composer', role: 'author',
    });
    expect(row).toMatchObject({ holder_name: 'Canon', holder_document: 'C', work_id: W1, party_role: 'composer' });
    for (const k of ALIAS_KEYS) expect(row).not.toHaveProperty(k);
  });

  it('canonical wins when both names carry different values (Phonogram)', async () => {
    const row = await persisted({ holder_name: 'Canon', phonogram_id: 'ph-c', trackId: 'ph-o', party_role: 'producer', role: 'author' });
    expect(row).toMatchObject({ holder_name: 'Canon', phonogram_id: 'ph-c', party_role: 'producer' });
    expect(row).not.toHaveProperty('trackId');
  });

  it('rejects an unknown field (forbidNonWhitelisted) on create and update', async () => {
    await expect(run(CreateShareDto, { holder_name: 'X', unknown_field: 1 })).rejects.toBeInstanceOf(BadRequestException);
    await expect(run(UpdateShareDto, { holder_name: 'X', phonogramId: 'x' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('keeps validation on the canonical fields', async () => {
    await expect(run(CreateShareDto, { holder_name: '   ' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(run(CreateShareDto, { party_role: 'master_owner' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(run(CreateShareDto, { holder_document: 'x'.repeat(51) })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('update: canonical body accepted; explicit null on an alias still clears the column; canonical null wins over alias value', async () => {
    const update = jest.fn(async () => ({ affected: 1 }));
    const qb: Record<string, jest.Mock> = {};
    qb['where'] = jest.fn(() => qb);
    qb['getOne'] = jest.fn(async () => ({ id: 'share-1', work_id: null, phonogram_id: null }));
    const repo = { update, createQueryBuilder: jest.fn(() => qb) };
    const manager = { getRepository: jest.fn(() => repo), query: jest.fn().mockResolvedValue([]) };
    const ds = { query: jest.fn(), getRepository: jest.fn(() => repo), transaction: jest.fn(async (cb: (m: unknown) => unknown) => cb(manager)) };
    const service = new SharesService(ds as never);
    await service.update('tenant-1', 'share-1', await run(UpdateShareDto, { holder_name: 'N', holderDoc: null as never }));
    const written = (update.mock.calls as unknown as unknown[][])[0][1] as Record<string, unknown>;
    expect(written).toMatchObject({ holder_name: 'N', holder_document: null });
    expect(written).not.toHaveProperty('holderDoc');
  });
});
