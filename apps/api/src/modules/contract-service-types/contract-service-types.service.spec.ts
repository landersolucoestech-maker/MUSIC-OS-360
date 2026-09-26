import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ContractServiceTypesService } from './contract-service-types.service';
import { DATA_SOURCE } from '../../database/database.module';

describe('ContractServiceTypesService', () => {
  let service: ContractServiceTypesService;
  let qb: Record<string, jest.Mock>;
  let repo: Record<string, jest.Mock>;

  beforeEach(async () => {
    qb = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
      getOne: jest.fn().mockResolvedValue(null),
    };
    repo = {
      createQueryBuilder: jest.fn(() => qb),
      create: jest.fn((v: unknown) => v),
      save: jest.fn((v: Record<string, unknown>) => Promise.resolve({ id: 'cst-1', ...v })),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContractServiceTypesService,
        { provide: DATA_SOURCE, useValue: { getRepository: () => repo } },
      ],
    }).compile();

    service = module.get(ContractServiceTypesService);
  });

  describe('list', () => {
    it('filters by tenant, excludes soft-deleted and orders by sort_order', async () => {
      await service.list('tenant-1');
      expect(qb.where).toHaveBeenCalledWith('t.tenant_id = :tenantId', { tenantId: 'tenant-1' });
      expect(qb.andWhere).toHaveBeenCalledWith('t.deleted_at IS NULL');
      expect(qb.orderBy).toHaveBeenCalledWith('t.sort_order', 'ASC');
    });
  });

  describe('findById', () => {
    it('throws NotFoundException when it does not exist in the tenant', async () => {
      await expect(service.findById('tenant-1', 'missing')).rejects.toThrow(NotFoundException);
    });

    it('returns the entity when it exists', async () => {
      qb.getOne.mockResolvedValueOnce({ id: 'cst-1', slug: 'dist' });
      await expect(service.findById('tenant-1', 'cst-1')).resolves.toEqual({ id: 'cst-1', slug: 'dist' });
    });
  });

  describe('create', () => {
    const dto = {
      name: 'Distribuição',
      slug: 'distribuicao',
      client_types: ['artista'],
      financial_model: 'valor_fixo',
      created_at: '2020-01-01T00:00:00.000Z',
      updated_at: '2020-01-01T00:00:00.000Z',
    };

    it('creates with tenant_id and without the timestamps sent by the client', async () => {
      const result = await service.create('tenant-1', dto as never);
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ tenant_id: 'tenant-1', name: 'Distribuição', slug: 'distribuicao' }),
      );
      const created = repo.create.mock.calls[0][0];
      expect(created.created_at).toBeUndefined();
      expect(created.updated_at).toBeUndefined();
      expect(result).toEqual(expect.objectContaining({ id: 'cst-1' }));
    });

    it('rejects a duplicate slug in the same tenant', async () => {
      qb.getOne.mockResolvedValueOnce({ id: 'other', slug: 'distribuicao' });
      await expect(service.create('tenant-1', dto as never)).rejects.toThrow(BadRequestException);
    });
  });

  describe('update', () => {
    it('throws NotFoundException if the record does not exist in the tenant', async () => {
      await expect(service.update('tenant-1', 'missing', { name: 'X' } as never)).rejects.toThrow(NotFoundException);
    });

    it('rejects changing the slug to one already used by another record', async () => {
      qb.getOne
        .mockResolvedValueOnce({ id: 'cst-1' }) // initial findById
        .mockResolvedValueOnce({ id: 'cst-2', slug: 'distribuicao' }); // assertSlugAvailable
      await expect(
        service.update('tenant-1', 'cst-1', { slug: 'distribuicao' } as never),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('remove', () => {
    it('performs a soft-delete (deleted_at), never a physical DELETE', async () => {
      qb.getOne.mockResolvedValueOnce({ id: 'cst-1' });
      const result = await service.remove('tenant-1', 'cst-1');
      expect(repo.update).toHaveBeenCalledWith(
        { id: 'cst-1', tenant_id: 'tenant-1' },
        expect.objectContaining({ deleted_at: expect.any(Date) }),
      );
      expect(result).toEqual({ deleted: true });
    });
  });
});
