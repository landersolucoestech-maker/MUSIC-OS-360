import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { TakedownsService } from './takedowns.service';
import { CreateTakedownDto, QueryTakedownDto, UpdateTakedownDto } from './dto/takedowns.dto';

/**
 * Migration 20260719000016 dropped takedowns.work_id / artist_id / response
 * (proven empty). The table has no foreign key left, so create() has no
 * cross-entity id to check; tenant isolation is the server-side tenant_id.
 */
function makeService() {
  const repo = {
    create: jest.fn((data: unknown) => ({ ...(data as object) })),
    save: jest.fn(async (entity: unknown) => ({ id: 'takedown-new', ...(entity as object) })),
  };
  const ds = { getRepository: jest.fn(() => repo), query: jest.fn() } as never;
  return { service: new TakedownsService(ds), repo, ds };
}

const errorsFor = (dto: new () => object, plain: Record<string, unknown>) =>
  validateSync(plainToInstance(dto, plain), { whitelist: true, forbidNonWhitelisted: true }).map((e) => e.property);

describe('TakedownsService.create — tenant scoping', () => {
  it('persists with the tenant of the caller and issues no cross-entity lookup', async () => {
    const { service, repo, ds } = makeService();
    await service.create('tenant-1', 'user-1', { title: 'X', platform: 'youtube', reason: 'r' } as CreateTakedownDto);
    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ tenant_id: 'tenant-1', created_by: 'user-1' }));
    expect((ds as unknown as { query: jest.Mock }).query).not.toHaveBeenCalled();
  });

  it('defense in depth: a tenant_id smuggled past the DTO can never override the caller tenant', async () => {
    const { service, repo } = makeService();
    await service.create('tenant-1', 'user-1', { title: 'X', platform: 'youtube', reason: 'r', tenant_id: 'tenant-evil' } as unknown as CreateTakedownDto);
    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ tenant_id: 'tenant-1' }));
  });
});

describe('Takedown DTOs — columns removed by migration 20260719000016', () => {
  const valid = { title: 'X', platform: 'youtube', reason: 'r' };
  const uuid = '11111111-1111-4111-8111-111111111111';

  it('accepts the valid payload', () => {
    expect(errorsFor(CreateTakedownDto, valid)).toEqual([]);
  });

  it.each(['work_id', 'artist_id', 'response'])('create rejects %s (whitelist)', (field) => {
    expect(errorsFor(CreateTakedownDto, { ...valid, [field]: uuid })).toContain(field);
  });

  it.each(['work_id', 'artist_id', 'response'])('update rejects %s (whitelist)', (field) => {
    expect(errorsFor(UpdateTakedownDto, { [field]: uuid })).toContain(field);
  });

  it('query rejects the artist_id filter', () => {
    expect(errorsFor(QueryTakedownDto, { artist_id: uuid })).toContain('artist_id');
  });
});
