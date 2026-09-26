import { ContractServiceTypesController } from './contract-service-types.controller';
import type { ContractServiceTypesService } from './contract-service-types.service';

describe('ContractServiceTypesController', () => {
  let controller: ContractServiceTypesController;
  let svc: Record<string, jest.Mock>;
  const tenant = { id: 'tenant-1' };

  beforeEach(() => {
    svc = {
      list: jest.fn().mockResolvedValue([]),
      findById: jest.fn().mockResolvedValue({ id: 'cst-1' }),
      create: jest.fn().mockResolvedValue({ id: 'cst-1' }),
      update: jest.fn().mockResolvedValue({ id: 'cst-1' }),
      remove: jest.fn().mockResolvedValue({ deleted: true }),
    };
    controller = new ContractServiceTypesController(svc as unknown as ContractServiceTypesService);
  });

  it('list delegates to the service with the current tenant (never lists another tenant)', async () => {
    await controller.list(tenant);
    expect(svc.list).toHaveBeenCalledWith('tenant-1');
  });

  it('findById delega id + tenant', async () => {
    await controller.findById(tenant, 'cst-1');
    expect(svc.findById).toHaveBeenCalledWith('tenant-1', 'cst-1');
  });

  it('create delega tenant + dto', async () => {
    const dto = { name: 'Distribuição', slug: 'distribuicao', client_types: ['artista'], financial_model: 'valor_fixo' };
    await controller.create(tenant, dto as never);
    expect(svc.create).toHaveBeenCalledWith('tenant-1', dto);
  });

  it('update delega tenant + id + dto', async () => {
    const dto = { name: 'Novo nome' };
    await controller.update(tenant, 'cst-1', dto as never);
    expect(svc.update).toHaveBeenCalledWith('tenant-1', 'cst-1', dto);
  });

  it('remove delega tenant + id (soft-delete, nunca hard delete direto)', async () => {
    await controller.remove(tenant, 'cst-1');
    expect(svc.remove).toHaveBeenCalledWith('tenant-1', 'cst-1');
  });
});
