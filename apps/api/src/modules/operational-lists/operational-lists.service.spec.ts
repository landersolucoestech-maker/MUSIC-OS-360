import 'reflect-metadata';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { OperationalListsService } from './operational-lists.service';
import { OPERATIONAL_LIST_DEFAULTS } from './operational-lists.defaults';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeRepo(rows: Record<string, unknown>[] = []) {
  const qb: Record<string, jest.Mock> = {};
  const chain = () => qb;
  qb['where'] = jest.fn(chain);
  qb['andWhere'] = jest.fn(chain);
  qb['orderBy'] = jest.fn(chain);
  qb['addOrderBy'] = jest.fn(chain);
  qb['skip'] = jest.fn(chain);
  qb['take'] = jest.fn(chain);
  qb['getOne'] = jest.fn(async () => rows[0] ?? null);
  qb['getManyAndCount'] = jest.fn(async () => [rows, rows.length]);
  qb['insert'] = jest.fn(chain);
  qb['into'] = jest.fn(chain);
  qb['values'] = jest.fn(chain);
  qb['orIgnore'] = jest.fn(chain);
  qb['execute'] = jest.fn(async () => ({ identifiers: [] }));

  return {
    createQueryBuilder: jest.fn(() => qb),
    count: jest.fn(async () => rows.length),
    create: jest.fn((data: unknown) => ({ ...(data as object) })),
    save: jest.fn(async (entity: unknown) => ({ id: 'uuid-new', ...(entity as object) })),
    update: jest.fn(async () => ({ affected: 1 })),
    _qb: qb,
  };
}

function makeDs(repo: ReturnType<typeof makeRepo>) {
  return { getRepository: jest.fn(() => repo) } as any;
}

function makeService(rows: Record<string, unknown>[] = []) {
  const repo = makeRepo(rows);
  const ds = makeDs(repo);
  const svc = new OperationalListsService(ds);
  return { svc, repo };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('OperationalListsService', () => {
  describe('list — bootstrap idempotente', () => {
    it('semeia os itens padrão quando o tenant não tem nenhum item', async () => {
      const { svc, repo } = makeService([]);

      await svc.list('tenant-1', {} as any);

      expect(repo.count).toHaveBeenCalledWith({ where: { tenant_id: 'tenant-1' } });
      expect(repo._qb['insert']).toHaveBeenCalled();
      expect(repo._qb['orIgnore']).toHaveBeenCalled();
      const inserted = (repo._qb['values'] as jest.Mock).mock.calls[0][0] as unknown[];
      expect(inserted).toHaveLength(OPERATIONAL_LIST_DEFAULTS.length);
    });

    it('não re-semeia quando o tenant já tem itens', async () => {
      const { svc, repo } = makeService([{ id: 'x', tenant_id: 'tenant-1' }]);

      await svc.list('tenant-1', {} as any);

      expect(repo._qb['insert']).not.toHaveBeenCalled();
    });

    it('filtra por kind e por active quando informados na query', async () => {
      const { svc, repo } = makeService([{ id: 'x', tenant_id: 'tenant-1' }]);

      await svc.list('tenant-1', { kind: 'event_type', active: true } as any);

      expect(repo._qb['andWhere']).toHaveBeenCalledWith('i.kind = :kind', { kind: 'event_type' });
      expect(repo._qb['andWhere']).toHaveBeenCalledWith('i.active = :active', { active: true });
    });
  });

  describe('create', () => {
    it('rejeita criação duplicada para o mesmo tenant+kind+slug (409)', async () => {
      const { svc, repo } = makeService([]);
      (repo._qb['getOne'] as jest.Mock).mockResolvedValueOnce({ id: 'existing' });

      await expect(
        svc.create('tenant-1', 'user-1', { kind: 'lead_type', slug: 'artista_banda', name: 'X' } as any),
      ).rejects.toThrow(ConflictException);
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('persiste com tenant_id e created_by/updated_by corretos', async () => {
      const { svc, repo } = makeService([]);
      (repo._qb['getOne'] as jest.Mock).mockResolvedValueOnce(null);

      await svc.create('tenant-1', 'user-1', { kind: 'lead_type', slug: 'novo', name: 'Novo' } as any);

      const saved = (repo.create as jest.Mock).mock.calls[0][0] as Record<string, unknown>;
      expect(saved['tenant_id']).toBe('tenant-1');
      expect(saved['created_by']).toBe('user-1');
      expect(saved['updated_by']).toBe('user-1');
    });
  });

  describe('findById', () => {
    it('lança NotFoundException quando o item não pertence ao tenant ou não existe', async () => {
      const { svc, repo } = makeService([]);
      (repo._qb['getOne'] as jest.Mock).mockResolvedValue(null);

      await expect(svc.findById('tenant-1', 'inexistente')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('atualiza apenas os campos informados e sempre grava updated_by', async () => {
      const existing = { id: 'uuid-1', tenant_id: 'tenant-1', kind: 'lead_type', slug: 'x', name: 'X', active: true };
      const { svc, repo } = makeService([existing]);
      (repo._qb['getOne'] as jest.Mock).mockImplementation(async () => existing);

      await svc.update('tenant-1', 'user-2', 'uuid-1', { active: false } as any);

      const updateCall = (repo.update as jest.Mock).mock.calls[0][1] as Record<string, unknown>;
      expect(updateCall['active']).toBe(false);
      expect(updateCall['updated_by']).toBe('user-2');
      expect(updateCall['name']).toBeUndefined();
    });
  });

  describe('remove', () => {
    it('faz soft-delete gravando deleted_at', async () => {
      const existing = { id: 'uuid-2', tenant_id: 'tenant-1', kind: 'lead_type', slug: 'y', name: 'Y' };
      const { svc, repo } = makeService([existing]);
      (repo._qb['getOne'] as jest.Mock).mockImplementation(async () => existing);

      const result = await svc.remove('tenant-1', 'uuid-2');

      expect(result).toEqual({ deleted: true });
      const updateCall = (repo.update as jest.Mock).mock.calls[0][1] as Record<string, unknown>;
      expect(updateCall['deleted_at']).toBeInstanceOf(Date);
    });

    it('lança NotFoundException ao remover item de outro tenant', async () => {
      const { svc, repo } = makeService([]);
      (repo._qb['getOne'] as jest.Mock).mockResolvedValue(null);

      await expect(svc.remove('tenant-1', 'de-outro-tenant')).rejects.toThrow(NotFoundException);
    });
  });
});
