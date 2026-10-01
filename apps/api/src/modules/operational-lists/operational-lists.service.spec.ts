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
    it('seeds the default items when the tenant has none', async () => {
      const { svc, repo } = makeService([]);

      await svc.list('tenant-1', {} as any);

      expect(repo.count).toHaveBeenCalledWith({ where: { tenant_id: 'tenant-1' } });
      expect(repo._qb['insert']).toHaveBeenCalled();
      expect(repo._qb['orIgnore']).toHaveBeenCalled();
      const inserted = (repo._qb['values'] as jest.Mock).mock.calls[0][0] as Array<Record<string, unknown>>;
      expect(inserted).toHaveLength(OPERATIONAL_LIST_DEFAULTS.length);
      // bootstrapped defaults carry provenance + the English stable key
      expect(inserted.every((row) => row['origin'] === 'platform')).toBe(true);
      expect(new Set(inserted.map((row) => row['stable_key'])).size).toBe(inserted.length);
      expect(inserted.find((row) => row['kind'] === 'lead_status' && row['slug'] === 'new')).toMatchObject({ stable_key: 'lead_status.new', name: 'Novo' });
    });

    it('does not reseed when the tenant already has items', async () => {
      const { svc, repo } = makeService([{ id: 'x', tenant_id: 'tenant-1' }]);

      await svc.list('tenant-1', {} as any);

      expect(repo._qb['insert']).not.toHaveBeenCalled();
    });

    it('filters by kind and active when given in the query', async () => {
      const { svc, repo } = makeService([{ id: 'x', tenant_id: 'tenant-1' }]);

      await svc.list('tenant-1', { kind: 'event_type', active: true } as any);

      expect(repo._qb['andWhere']).toHaveBeenCalledWith('i.kind = :kind', { kind: 'event_type' });
      expect(repo._qb['andWhere']).toHaveBeenCalledWith('i.active = :active', { active: true });
    });

    it('resolves a slug filter through the legacy alias too', async () => {
      const { svc, repo } = makeService([{ id: 'x', tenant_id: 'tenant-1' }]);

      await svc.list('tenant-1', { kind: 'lead_type', slug: 'artista_banda' } as any);

      expect(repo._qb['andWhere']).toHaveBeenCalledWith('(i.slug = :slug OR i.legacy_slug = :slug)', { slug: 'artista_banda' });
    });
  });

  describe('create', () => {
    it('rejects a duplicate create for the same tenant+kind+slug (409)', async () => {
      const { svc, repo } = makeService([]);
      (repo._qb['getOne'] as jest.Mock).mockResolvedValueOnce({ id: 'existing' });

      await expect(
        svc.create('tenant-1', 'user-1', { kind: 'lead_type', slug: 'artista_banda', name: 'X' } as any),
      ).rejects.toThrow(ConflictException);
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('persists with the correct tenant_id and created_by/updated_by', async () => {
      const { svc, repo } = makeService([]);
      (repo._qb['getOne'] as jest.Mock).mockResolvedValueOnce(null);

      await svc.create('tenant-1', 'user-1', { kind: 'lead_type', slug: 'new-item', name: 'New item' } as any);

      const saved = (repo.create as jest.Mock).mock.calls[0][0] as Record<string, unknown>;
      expect(saved['tenant_id']).toBe('tenant-1');
      expect(saved['created_by']).toBe('user-1');
      expect(saved['updated_by']).toBe('user-1');
      expect(saved['origin']).toBe('tenant');
    });

    it('treats the legacy alias of a platform default as taken (409) and looks up slug OR legacy_slug', async () => {
      const { svc, repo } = makeService([]);
      (repo._qb['getOne'] as jest.Mock).mockResolvedValueOnce({ id: 'platform-row', slug: 'artist_or_band', legacy_slug: 'artista_banda' });

      await expect(
        svc.create('tenant-1', 'user-1', { kind: 'lead_type', slug: 'artista_banda', name: 'X' } as any),
      ).rejects.toThrow(ConflictException);
      expect(repo._qb['andWhere']).toHaveBeenCalledWith('(i.slug = :slug OR i.legacy_slug = :slug)', { slug: 'artista_banda' });
    });
  });

  describe('findBySlug', () => {
    it('returns the live row matching the canonical slug or the legacy alias, scoped to the tenant and kind', async () => {
      const row = { id: 'p', slug: 'artist_or_band', legacy_slug: 'artista_banda' };
      const { svc, repo } = makeService([row]);

      await expect(svc.findBySlug('tenant-1', 'lead_type', 'artista_banda')).resolves.toBe(row);
      expect(repo._qb['where']).toHaveBeenCalledWith('i.tenant_id = :tenantId AND i.kind = :kind AND i.deleted_at IS NULL', { tenantId: 'tenant-1', kind: 'lead_type' });
    });
  });

  describe('findById', () => {
    it('throws NotFoundException when the item does not belong to the tenant or does not exist', async () => {
      const { svc, repo } = makeService([]);
      (repo._qb['getOne'] as jest.Mock).mockResolvedValue(null);

      await expect(svc.findById('tenant-1', 'missing-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('updates only the given fields and always writes updated_by', async () => {
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

  describe('update slug clash', () => {
    it('rejects renaming a slug onto another live row (or its legacy alias) with 409', async () => {
      const existing = { id: 'uuid-1', tenant_id: 'tenant-1', kind: 'lead_type', slug: 'x', name: 'X' };
      const { svc, repo } = makeService([existing]);
      (repo._qb['getOne'] as jest.Mock)
        .mockResolvedValueOnce(existing)
        .mockResolvedValueOnce({ id: 'other', slug: 'artist_or_band', legacy_slug: 'artista_banda' });

      await expect(svc.update('tenant-1', 'user-2', 'uuid-1', { slug: 'artista_banda' } as any)).rejects.toThrow(ConflictException);
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('allows re-saving the same slug on the same row', async () => {
      const existing = { id: 'uuid-1', tenant_id: 'tenant-1', kind: 'lead_type', slug: 'x', name: 'X' };
      const { svc, repo } = makeService([existing]);
      (repo._qb['getOne'] as jest.Mock).mockImplementation(async () => existing);

      await svc.update('tenant-1', 'user-2', 'uuid-1', { slug: 'x' } as any);
      expect(repo.update).toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('soft-deletes by writing deleted_at', async () => {
      const existing = { id: 'uuid-2', tenant_id: 'tenant-1', kind: 'lead_type', slug: 'y', name: 'Y' };
      const { svc, repo } = makeService([existing]);
      (repo._qb['getOne'] as jest.Mock).mockImplementation(async () => existing);

      const result = await svc.remove('tenant-1', 'uuid-2');

      expect(result).toEqual({ deleted: true });
      const updateCall = (repo.update as jest.Mock).mock.calls[0][1] as Record<string, unknown>;
      expect(updateCall['deleted_at']).toBeInstanceOf(Date);
    });

    it('throws NotFoundException when removing another tenant\'s item', async () => {
      const { svc, repo } = makeService([]);
      (repo._qb['getOne'] as jest.Mock).mockResolvedValue(null);

      await expect(svc.remove('tenant-1', 'other-tenant-id')).rejects.toThrow(NotFoundException);
    });
  });
});
