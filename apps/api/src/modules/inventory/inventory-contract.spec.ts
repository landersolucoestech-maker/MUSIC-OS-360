import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { InventoryStatus } from '@music-os-360/types';
import { InventoryService } from './inventory.service';
import { CreateInventoryItemDto } from './dto/inventory.dto';
import { INVENTORY_STATUSES, LEGACY_INVENTORY_STATUSES } from './inventory-legacy-fields';

/**
 * CZ-032: the inventory request contract is English. Before it, the web form
 * offered the statuses "emprestado" and "danificado", which the DTO did not
 * accept (every save with them was rejected with 400). The legacy payload
 * below is the one the pre-CZ-032 web build really sends.
 */
const errorsFor = (plain: Record<string, unknown>) =>
  validateSync(plainToInstance(CreateInventoryItemDto, plain, { enableImplicitConversion: true }), {
    whitelist: true,
    forbidNonWhitelisted: true,
  }).map((e) => e.property);

const LEGACY_WEB_ITEM = {
  name: 'Microfone',
  category: 'Áudio',
  quantidade: 2,
  unit_price: 1500,
  localizacao: 'Estúdio 1',
  status: 'emprestado',
  responsavel: 'Ana',
  setor: 'Produção Musical',
  data_entrada: '2026-09-01',
  local_compra: 'Loja X',
  numero_nota_fiscal: '123',
  notes: 'n',
};

function makeService() {
  const qb = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn(async () => [[], 0]),
  };
  const repo = {
    create: jest.fn((v: unknown) => v),
    save: jest.fn(async (v: unknown) => ({ id: 'item-1', ...(v as object) })),
    createQueryBuilder: jest.fn(() => qb),
  };
  const ds = { getRepository: jest.fn(() => repo) };
  return { service: new InventoryService(ds as never), repo, qb };
}

describe('Inventory request contract (CZ-032)', () => {
  it('maps every legacy status slug to a canonical status', () => {
    for (const v of Object.values(LEGACY_INVENTORY_STATUSES)) expect(INVENTORY_STATUSES).toContain(v);
    expect(Object.keys(LEGACY_INVENTORY_STATUSES)).toEqual(
      expect.arrayContaining(['disponivel', 'em_uso', 'emprestado', 'manutencao', 'danificado', 'descartado']),
    );
  });

  it('accepts every status the form offers, canonical and legacy (emprestado/danificado used to be rejected)', () => {
    for (const status of [...INVENTORY_STATUSES, 'emprestado', 'danificado']) {
      expect(errorsFor({ name: 'X', status })).toEqual([]);
    }
    expect(errorsFor({ name: 'X', status: 'perdido' })).toEqual(['status']);
  });

  it('the pre-CZ-032 web payload validates', () => {
    expect(errorsFor(LEGACY_WEB_ITEM)).toEqual([]);
  });

  it('persists a legacy payload with canonical columns and status only', async () => {
    const { service, repo } = makeService();
    await service.create('tenant-1', 'user-1', LEGACY_WEB_ITEM as never);
    const row = repo.create.mock.calls[0][0] as Record<string, unknown>;
    expect(row).toMatchObject({
      quantity: 2, storage_location: 'Estúdio 1', status: InventoryStatus.ON_LOAN, responsible_person: 'Ana',
      sector: 'Produção Musical', entry_date: '2026-09-01', purchase_location: 'Loja X', numero_nota_fiscal: '123',
    });
    for (const legacy of ['quantidade', 'localizacao', 'responsavel', 'setor', 'data_entrada', 'local_compra']) {
      expect(row).not.toHaveProperty(legacy);
    }
  });

  it('a canonical payload keeps its values', async () => {
    const { service, repo } = makeService();
    await service.create('tenant-1', 'user-1', { name: 'X', quantity: 1, status: InventoryStatus.DAMAGED } as never);
    expect(repo.create.mock.calls[0][0]).toMatchObject({ quantity: 1, status: InventoryStatus.DAMAGED });
  });

  it('list filters by canonical status and storage_location, also when the legacy names are sent', async () => {
    const { service, qb } = makeService();
    await service.list('tenant-1', { status: 'em_uso', localizacao: 'Estoque' } as never);
    expect(qb.andWhere).toHaveBeenCalledWith('i.status = :status', { status: InventoryStatus.IN_USE });
    expect(qb.andWhere).toHaveBeenCalledWith('i.storage_location = :storageLocation', { storageLocation: 'Estoque' });
  });
});
