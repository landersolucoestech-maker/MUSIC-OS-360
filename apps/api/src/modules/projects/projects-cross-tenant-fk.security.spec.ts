import 'reflect-metadata';
import { BadRequestException } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { ProjectTrackEntity, ProjectTrackParticipantEntity } from '../../database/entities';

/**
 * find-50dd3726: projects.artist_id had no cross-tenant ownership check — a
 * project could silently reference another tenant's artist.
 */
describe('ProjectsService — cross-tenant FK ownership (find-50dd3726)', () => {
  function makeService(queryImpl: jest.Mock) {
    const qb: Record<string, jest.Mock> = {};
    const chain = () => qb;
    qb['where'] = jest.fn(chain);
    qb['andWhere'] = jest.fn(chain);
    qb['getOne'] = jest.fn(async () => ({ id: 'project-1', tenant_id: 'tenant-1', status: 'planning' }));
    const repo = {
      createQueryBuilder: jest.fn(() => qb),
      create: jest.fn((v: unknown) => v),
      save: jest.fn(async (v: unknown) => ({ id: 'project-1', ...(v as object) })),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    const childRepo = {
      createQueryBuilder: jest.fn(() => {
        const cqb: Record<string, jest.Mock> = {};
        const cchain = () => cqb;
        cqb['where'] = jest.fn(cchain);
        cqb['orderBy'] = jest.fn(cchain);
        cqb['getMany'] = jest.fn(async () => []);
        return cqb;
      }),
      find: jest.fn().mockResolvedValue([]),
      delete: jest.fn().mockResolvedValue({ affected: 0 }),
    };
    const getRepository = jest.fn((entity: unknown) =>
      entity === ProjectTrackEntity || entity === ProjectTrackParticipantEntity ? childRepo : repo,
    );
    const ds = {
      getRepository,
      transaction: jest.fn((cb: (m: unknown) => unknown) => cb({ getRepository, update: jest.fn() })),
      query: queryImpl,
    };
    const workflowService = { getAllowedTransitions: jest.fn(() => []), transitionInTx: jest.fn() };
    const events = { emitTyped: jest.fn() };
    const service = new ProjectsService(ds as never, workflowService as never, events as never);
    return { service, repo };
  }

  it('create: rejects an artist_id belonging to another tenant', async () => {
    const { service } = makeService(jest.fn(async () => []));
    await expect(
      service.create('tenant-1', 'user-1', {
        title: 'T', type: 'album', artist_id: '323e4567-e89b-12d3-a456-426614174000',
      } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('create: allows an artist_id that belongs to the same tenant', async () => {
    const { service, repo } = makeService(jest.fn(async () => [{ exists: 1 }]));
    await expect(
      service.create('tenant-1', 'user-1', {
        title: 'T', type: 'album', artist_id: '223e4567-e89b-12d3-a456-426614174000',
      } as never),
    ).resolves.toBeDefined();
    expect(repo.save).toHaveBeenCalled();
  });

  it('update: does not re-validate artist_id when the patch omits it (unchanged)', async () => {
    const query = jest.fn();
    const { service } = makeService(query);
    await expect(
      service.update('tenant-1', 'user-1', 'project-1', { title: 'New Title' } as never),
    ).resolves.toBeDefined();
    expect(query).not.toHaveBeenCalled();
  });

  // GAP-0001 / DEC-001: ProjectFormModal now sends artist_id on edits.
  it('update: rejects an artist_id belonging to another tenant (IDOR via PATCH)', async () => {
    const { service, repo } = makeService(jest.fn(async () => []));
    await expect(
      service.update('tenant-1', 'user-1', 'project-1', {
        artist_id: '323e4567-e89b-12d3-a456-426614174000',
      } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('update: persists same-tenant artist_id and budget scoped by tenant_id', async () => {
    const { service, repo } = makeService(jest.fn(async () => [{ exists: 1 }]));
    await service.update('tenant-1', 'user-1', 'project-1', {
      artist_id: '223e4567-e89b-12d3-a456-426614174000', budget: 2500,
    } as never);
    expect(repo.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'project-1', tenant_id: 'tenant-1' }),
      expect.objectContaining({ artist_id: '223e4567-e89b-12d3-a456-426614174000', budget: 2500 }),
    );
  });

  it('create: persists budget and artist_id with the caller tenant', async () => {
    const { service, repo } = makeService(jest.fn(async () => [{ exists: 1 }]));
    await service.create('tenant-1', 'user-1', {
      title: 'T', type: 'single', artist_id: '223e4567-e89b-12d3-a456-426614174000', budget: 15000.5,
    } as never);
    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({
      tenant_id: 'tenant-1', artist_id: '223e4567-e89b-12d3-a456-426614174000', budget: 15000.5,
    }));
  });

  it('create/update: a deprecated orcamento from a pre-canonical web build is persisted as budget', async () => {
    const { service, repo } = makeService(jest.fn(async () => [{ exists: 1 }]));
    await service.create('tenant-1', 'user-1', { title: 'T', type: 'single', orcamento: 99 } as never);
    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ budget: 99 }));
    expect(repo.create).not.toHaveBeenCalledWith(expect.objectContaining({ orcamento: expect.anything() }));
    await service.update('tenant-1', 'user-1', 'project-1', { orcamento: 7 } as never);
    expect(repo.update).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ budget: 7 }));
  });

  it('findById: readback returns artist_id/budget as persisted', async () => {
    const { service, repo } = makeService(jest.fn());
    const qb = repo.createQueryBuilder() as unknown as { getOne: jest.Mock };
    qb.getOne.mockResolvedValue({
      id: 'project-1', tenant_id: 'tenant-1', status: 'planning',
      artist_id: '223e4567-e89b-12d3-a456-426614174000', budget: '2500.00',
    });
    const row = await service.findById('tenant-1', 'project-1');
    expect(row).toMatchObject({ artist_id: '223e4567-e89b-12d3-a456-426614174000', budget: '2500.00' });
  });
});
