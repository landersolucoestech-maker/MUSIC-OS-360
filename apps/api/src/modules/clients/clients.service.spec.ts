import 'reflect-metadata';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { ClientsService } from './clients.service';
import { EncryptionService } from '../../core/security/encryption.service';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeEncryption() {
  return {
    encryptNullable: jest.fn((v: string | null | undefined) =>
      v != null ? `enc:v1:${Buffer.from(v).toString('base64')}` : null,
    ),
    decryptNullable: jest.fn((v: string | null | undefined) => {
      if (!v) return null;
      const b64 = v.replace(/^enc:v1:/, '');
      return Buffer.from(b64, 'base64').toString('utf8');
    }),
  } as unknown as EncryptionService;
}

function makeRepo(rows: Record<string, unknown>[] = []) {
  const qb: Record<string, jest.Mock> = {};
  const chain = () => qb;
  qb['where']      = jest.fn(chain);
  qb['andWhere']   = jest.fn(chain);
  qb['orderBy']    = jest.fn(chain);
  qb['skip']       = jest.fn(chain);
  qb['take']       = jest.fn(chain);
  qb['getOne']     = jest.fn(async () => rows[0] ?? null);
  qb['getManyAndCount'] = jest.fn(async () => [rows, rows.length]);

  return {
    createQueryBuilder: jest.fn(() => qb),
    create: jest.fn((data: unknown) => ({ ...(data as object) })),
    save:   jest.fn(async (entity: unknown) => ({ id: 'uuid-new', ...entity as object })),
    update: jest.fn(async () => ({ affected: 1 })),
    _qb:    qb,
  };
}

function makeDs(repo: ReturnType<typeof makeRepo>) {
  return {
    getRepository: jest.fn(() => repo),
  } as any;
}

function makeService(
  rows: Record<string, unknown>[] = [],
  enc?: EncryptionService,
) {
  const encryption = enc ?? makeEncryption();
  const repo       = makeRepo(rows);
  const ds         = makeDs(repo);
  const svc        = new ClientsService(ds, encryption);
  return { svc, repo, encryption };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ClientsService — encryption', () => {
  describe('create', () => {
    it('encrypts email, phone, and document before persisting', async () => {
      const { svc, repo, encryption } = makeService();

      await svc.create('tenant-1', 'user-1', {
        email:    'alice@example.com',
        phone:    '+351910000000',
        document: '123456789',
        name:     'Alice',
      } as any);

      expect(encryption.encryptNullable).toHaveBeenCalledWith('alice@example.com');
      expect(encryption.encryptNullable).toHaveBeenCalledWith('+351910000000');
      expect(encryption.encryptNullable).toHaveBeenCalledWith('123456789');

      const saved = (repo.save as jest.Mock).mock.calls[0][0] as Record<string, unknown>;
      expect(saved['email']).toBeUndefined();
      expect(saved['email_encrypted']).toBeDefined();
      expect(saved['phone_encrypted']).toBeDefined();
      expect(saved['cpf_cnpj_encrypted']).toBeDefined();
    });

    it('handles null PII fields without error', async () => {
      const { svc, encryption } = makeService();

      await expect(
        svc.create('tenant-1', 'user-1', { name: 'Bob' } as any),
      ).resolves.toBeDefined();

      expect(encryption.encryptNullable).toHaveBeenCalledWith(undefined);
    });
  });

  describe('priority (GAP-11: priority is a real column, must round-trip)', () => {
    it('maps CreateClientDto.priority onto the priority column on create', async () => {
      const { svc, repo } = makeService();

      await svc.create('tenant-1', 'user-1', { name: 'Alice', priority: 'strategic' } as any);

      const saved = (repo.save as jest.Mock).mock.calls[0][0] as Record<string, unknown>;
      expect(saved['priority']).toBe('strategic');
    });

    it('does not touch priority when it is omitted', async () => {
      const { svc, repo } = makeService();

      await svc.create('tenant-1', 'user-1', { name: 'Bob' } as any);

      const saved = (repo.save as jest.Mock).mock.calls[0][0] as Record<string, unknown>;
      expect(saved['priority']).toBeUndefined();
    });

    it('returns the persisted priority as-is on read (mapClient passthrough)', async () => {
      const { svc } = makeService([
        { id: 'uuid-1', tenant_id: 'tenant-1', name: 'Bob', priority: 'high' },
      ]);

      const result = await svc.findById('tenant-1', 'uuid-1') as Record<string, unknown>;

      expect(result['priority']).toBe('high');
    });
  });

  describe('mapClient — decryption on read', () => {
    it('decrypts encrypted fields and removes raw encrypted columns from output', async () => {
      const encryptedEmail = `enc:v1:${Buffer.from('bob@example.com').toString('base64')}`;
      const { svc } = makeService([
        {
          id:                 'uuid-1',
          tenant_id:          'tenant-1',
          name:               'Bob',
          email_encrypted:    encryptedEmail,
          phone_encrypted: null,
          cpf_cnpj_encrypted: null,
        },
      ]);

      const result = await svc.findById('tenant-1', 'uuid-1') as Record<string, unknown>;

      expect(result['email']).toBe('bob@example.com');
      expect(result['email_encrypted']).toBeUndefined();
      expect(result['phone_encrypted']).toBeUndefined();
      expect(result['cpf_cnpj_encrypted']).toBeUndefined();
    });

    it('returns null for missing PII fields', async () => {
      const { svc } = makeService([
        {
          id:                 'uuid-2',
          tenant_id:          'tenant-1',
          name:               'Charlie',
          email_encrypted:    null,
          phone_encrypted: null,
          cpf_cnpj_encrypted: null,
        },
      ]);

      const result = await svc.findById('tenant-1', 'uuid-2') as Record<string, unknown>;

      expect(result['email']).toBeNull();
      expect(result['phone']).toBeNull();
      expect(result['cpf_cnpj']).toBeNull();
      expect(result).not.toHaveProperty('metadata');
    });
  });

  describe('update', () => {
    it('re-encrypts PII fields when provided in update payload', async () => {
      const existing = {
        id: 'uuid-3', tenant_id: 'tenant-1', name: 'Diana',
        email_encrypted: null, phone_encrypted: null, cpf_cnpj_encrypted: null,
      };
      const { svc, repo, encryption } = makeService([existing]);

      // findById is called twice: once to check existence, once to return updated record
      (repo._qb['getOne'] as jest.Mock).mockImplementation(async () => existing);

      await svc.update('tenant-1', 'user-1', 'uuid-3', {
        email: 'diana@updated.com',
      } as any);

      expect(encryption.encryptNullable).toHaveBeenCalledWith('diana@updated.com');

      const updateCall = (repo.update as jest.Mock).mock.calls[0][1] as Record<string, unknown>;
      expect(updateCall['email_encrypted']).toBeDefined();
      expect(updateCall['email']).toBeUndefined();
    });

    it('does not touch encrypted field when PII key absent from dto', async () => {
      const existing = {
        id: 'uuid-4', tenant_id: 'tenant-1', name: 'Eve',
        email_encrypted: 'enc:v1:existing', phone_encrypted: null, cpf_cnpj_encrypted: null,
      };
      const { svc, repo, encryption } = makeService([existing]);
      (repo._qb['getOne'] as jest.Mock).mockImplementation(async () => existing);

      await svc.update('tenant-1', 'user-1', 'uuid-4', { name: 'Eve Updated' } as any);

      const updateCall = (repo.update as jest.Mock).mock.calls[0][1] as Record<string, unknown>;
      expect(updateCall['email_encrypted']).toBeUndefined();
      expect(encryption.encryptNullable).not.toHaveBeenCalledWith(expect.anything());
    });
  });

  describe('findById', () => {
    it('throws NotFoundException when client does not belong to tenant', async () => {
      const { svc, repo } = makeService([]);
      (repo._qb['getOne'] as jest.Mock).mockResolvedValue(null);

      await expect(svc.findById('tenant-1', 'non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('soft-deletes client by setting deleted_at', async () => {
      const existing = {
        id: 'uuid-5', tenant_id: 'tenant-1', name: 'Frank',
        email_encrypted: null, phone_encrypted: null, cpf_cnpj_encrypted: null,
      };
      const { svc, repo } = makeService([existing]);
      (repo._qb['getOne'] as jest.Mock).mockImplementation(async () => existing);

      const result = await svc.remove('tenant-1', 'uuid-5');

      expect(result).toEqual({ deleted: true });
      const updateCall = (repo.update as jest.Mock).mock.calls[0][1] as Record<string, unknown>;
      expect(updateCall['deleted_at']).toBeInstanceOf(Date);
    });
  });

  describe('update — optimistic concurrency (Task K)', () => {
    const NOW = new Date('2026-08-14T12:00:00.000Z');
    const existing = {
      id: 'uuid-6', tenant_id: 'tenant-1', name: 'Gustavo',
      email_encrypted: null, phone_encrypted: null, cpf_cnpj_encrypted: null,
      updated_at: NOW,
    };

    it('without expectedUpdatedAt: applies an unconditional update (backward compatibility)', async () => {
      const { svc, repo } = makeService([existing]);
      (repo._qb['getOne'] as jest.Mock).mockImplementation(async () => existing);

      await svc.update('tenant-1', 'user-1', 'uuid-6', { name: 'Gustavo Novo' } as any);

      const [criteria] = (repo.update as jest.Mock).mock.calls[0];
      expect(criteria).toEqual({ id: 'uuid-6', tenant_id: 'tenant-1' });
    });

    it('with correct expectedUpdatedAt: includes updated_at in the criteria', async () => {
      const { svc, repo } = makeService([existing]);
      (repo._qb['getOne'] as jest.Mock).mockImplementation(async () => existing);

      await svc.update('tenant-1', 'user-1', 'uuid-6', {
        name: 'Gustavo Novo',
        expectedUpdatedAt: NOW.toISOString(),
      } as any);

      const [criteria] = (repo.update as jest.Mock).mock.calls[0];
      expect(criteria.id).toBe('uuid-6');
      expect(criteria.tenant_id).toBe('tenant-1');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const op = criteria.updated_at as any;
      expect(op._type).toBe('raw');
      expect(op._objectLiteralParameters).toEqual({ expected: NOW });
    });

    it('with a stale expectedUpdatedAt (0 rows affected): throws ConflictException, does not overwrite', async () => {
      const { svc, repo } = makeService([existing]);
      (repo._qb['getOne'] as jest.Mock).mockImplementation(async () => existing);
      (repo.update as jest.Mock).mockResolvedValueOnce({ affected: 0 });

      await expect(
        svc.update('tenant-1', 'user-1', 'uuid-6', {
          name: 'Edição concorrente',
          expectedUpdatedAt: new Date('2026-08-14T11:00:00.000Z').toISOString(),
        } as any),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('create — CRM fields (Part 79: Contact = Client, same physical table)', () => {
    it('maps city/state/instagram and the deprecated zipCode/responsible keys to the canonical columns', async () => {
      const { svc, repo } = makeService();

      await svc.create('tenant-1', 'user-1', {
        name: 'Casa Aurora',
        category: 'VENUE',
        city: 'Sao Paulo',
        state: 'SP',
        instagram: '@auroralive',
        zipCode: '01000-000',
        responsible: 'Operacoes',
        notes: 'Venue estratégico',
      } as any);

      const saved = (repo.save as jest.Mock).mock.calls[0][0] as Record<string, unknown>;
      expect(saved['city']).toBe('Sao Paulo');
      expect(saved['state']).toBe('SP');
      expect(saved['instagram']).toBe('@auroralive');
      expect(saved['zip_code']).toBe('01000-000');
      expect(saved['responsible_name']).toBe('Operacoes');
      expect(saved['notes']).toBe('Venue estratégico');
      // Never reintroduces the columns removed by the canonical migration.
      expect(saved['segmento']).toBeUndefined();
      expect(saved['endereco']).toBeUndefined();
    });
  });
});
