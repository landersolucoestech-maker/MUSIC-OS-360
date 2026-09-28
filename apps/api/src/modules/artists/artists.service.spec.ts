import 'reflect-metadata';
import { ArtistsService } from './artists.service';
import { EncryptionService } from '../../core/security/encryption.service';
import { EventsService } from '../../core/events/events.service';
import { PlanLimitService } from '../../core/billing/plan-limit.service';
import { NotFoundException } from '@nestjs/common';

function makePlanLimitMock(): jest.Mocked<Pick<PlanLimitService, 'enforce'>> {
  return { enforce: jest.fn().mockResolvedValue(undefined) };
}

function makeEventsMock(): jest.Mocked<Pick<EventsService, 'emit' | 'emitTyped' | 'emitAsync' | 'on' | 'off'>> {
  return {
    emit:      jest.fn(),
    emitTyped: jest.fn(),
    emitAsync: jest.fn().mockResolvedValue([]),
    on:        jest.fn(),
    off:       jest.fn(),
  } as unknown as jest.Mocked<Pick<EventsService, 'emit' | 'emitTyped' | 'emitAsync' | 'on' | 'off'>>;
}

function makeEncryptionMock(): jest.Mocked<EncryptionService> {
  return {
    encrypt:         jest.fn().mockImplementation((v: string) => `enc:${v}`),
    decrypt:         jest.fn().mockImplementation((v: string) => v.replace('enc:', '')),
    encryptNullable: jest.fn().mockImplementation((v: string | null | undefined) =>
      v == null || v === '' ? null : `enc:${v}`,
    ),
    decryptNullable: jest.fn().mockImplementation((v: string | null | undefined) =>
      v == null ? null : String(v).replace('enc:', ''),
    ),
  } as unknown as jest.Mocked<EncryptionService>;
}

const TENANT_A = 'tenant-aaa';
const USER_ID = 'user-111';

const artistA = {
  id: 'artist-001',
  tenant_id: TENANT_A,
  stage_name: 'Artista Alpha',
  status: 'in_negotiation',
  music_genre: null,
  contract_id: null,
  email_encrypted: null,
  phone_encrypted: null,
  cpf_cnpj_encrypted: null,
  manager_contact_encrypted: null,
  metadata: {},
  deleted_at: null,
  created_at: new Date(),
};

function makeQb(getOneValue: unknown = artistA) {
  const qb: Record<string, jest.Mock> = {
    where:           jest.fn(),
    andWhere:        jest.fn(),
    orderBy:         jest.fn(),
    skip:            jest.fn(),
    take:            jest.fn(),
    getOne:          jest.fn().mockResolvedValue(getOneValue),
    getManyAndCount: jest.fn().mockResolvedValue([[artistA], 1]),
  };

  qb.where.mockReturnValue(qb);
  qb.andWhere.mockReturnValue(qb);
  qb.orderBy.mockReturnValue(qb);
  qb.skip.mockReturnValue(qb);
  qb.take.mockReturnValue(qb);

  return qb;
}

function makeDataSource(getOneValue: unknown = artistA) {
  const qb = makeQb(getOneValue);
  const repo = {
    createQueryBuilder: jest.fn(() => qb),
    create: jest.fn((value: unknown) => value),
    save: jest.fn((value: Record<string, unknown>) =>
      Promise.resolve({ id: 'artist-001', ...value }),
    ),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    _qb: qb,
  };

  return {
    getRepository: jest.fn(() => repo),
    // Task H: list() enriches each artist with the linkage type (exclusive/
    // partner/independent) via a raw query restricted to the page's IDs —
    // with no contract mocked, this resolves to "independent".
    // Contract ownership probe (SELECT 1 FROM "contracts"): found; everything else empty.
    query: jest.fn(async (sql: string) => (String(sql).startsWith('SELECT 1 FROM "') ? [{ exists: 1 }] : [])),
    _repo: repo,
  };
}

describe('ArtistsService', () => {
  it('list() returns artists filtered by the correct tenant', async () => {
    const ds = makeDataSource();
    const service = new ArtistsService(ds as any, makeEncryptionMock(), makeEventsMock() as any, makePlanLimitMock() as any);

    const result = await service.list(TENANT_A, {});

    // Response contract: ciphertext NEVER leaves the API; PII fields come back
    // decrypted under the names used by the form (null when not filled in).
    const { email_encrypted, phone_encrypted, cpf_cnpj_encrypted, manager_contact_encrypted, metadata, ...artistAPublic } = artistA;
    expect(result.data).toEqual([{
      ...artistAPublic,
      email: null,
      phone: null,
      cpf_cnpj: null,
      manager_contact: null,
      relationship: 'independent',
    }]);
    expect(result.data[0]).not.toHaveProperty('email_encrypted');
    expect(result.meta.total).toBe(1);
    expect(ds._repo._qb.where).toHaveBeenCalledWith(
      'a.tenant_id = :tenantId',
      { tenantId: TENANT_A },
    );
  });

  it('find-924ed503: list() ignores an orderBy outside the allow-list (SQL injection attempt) and uses the created_at fallback', async () => {
    const ds = makeDataSource();
    const service = new ArtistsService(ds as any, makeEncryptionMock(), makeEventsMock() as any, makePlanLimitMock() as any);

    await service.list(TENANT_A, { orderBy: "id; DROP TABLE artists;--" } as any);

    expect(ds._repo._qb.orderBy).toHaveBeenCalledWith('a.created_at', 'DESC');
  });

  it('find-924ed503: list() accepts an orderBy from the allow-list normally', async () => {
    const ds = makeDataSource();
    const service = new ArtistsService(ds as any, makeEncryptionMock(), makeEventsMock() as any, makePlanLimitMock() as any);

    await service.list(TENANT_A, { orderBy: 'stage_name', ascending: true } as any);

    expect(ds._repo._qb.orderBy).toHaveBeenCalledWith('a.stage_name', 'ASC');
  });

  it('CZ-042: list() maps the pre-CZ-042 orderBy values to the canonical columns', async () => {
    const ds = makeDataSource();
    const service = new ArtistsService(ds as any, makeEncryptionMock(), makeEventsMock() as any, makePlanLimitMock() as any);

    await service.list(TENANT_A, { orderBy: 'nome_artistico', ascending: true } as any);
    expect(ds._repo._qb.orderBy).toHaveBeenLastCalledWith('a.stage_name', 'ASC');
    await service.list(TENANT_A, { orderBy: 'status_cadastro' } as any);
    expect(ds._repo._qb.orderBy).toHaveBeenLastCalledWith('a.registration_status', 'DESC');
  });

  it('CZ-042: list() searches the canonical stage_name/full_name columns', async () => {
    const ds = makeDataSource();
    const service = new ArtistsService(ds as any, makeEncryptionMock(), makeEventsMock() as any, makePlanLimitMock() as any);

    await service.list(TENANT_A, { search: 'ana' } as any);
    expect(ds._repo._qb.andWhere).toHaveBeenCalledWith(
      '(a.stage_name ILIKE :search OR a.full_name ILIKE :search)', { search: '%ana%' },
    );
  });

  it('findById() returns the artist when it belongs to the tenant', async () => {
    const ds = makeDataSource();
    const service = new ArtistsService(ds as any, makeEncryptionMock(), makeEventsMock() as any, makePlanLimitMock() as any);

    await expect(service.findById(TENANT_A, 'artist-001')).resolves.toEqual(artistA);
  });

  it('findById() throws NotFoundException for an artist that does not exist', async () => {
    const ds = makeDataSource(null);
    const service = new ArtistsService(ds as any, makeEncryptionMock(), makeEventsMock() as any, makePlanLimitMock() as any);

    await expect(service.findById(TENANT_A, 'inexistente')).rejects.toThrow(NotFoundException);
  });

  it('create() encrypts email, phone and cpf_cnpj before persisting', async () => {
    const ds = makeDataSource();
    const enc = makeEncryptionMock();
    const events = makeEventsMock();
    const service = new ArtistsService(ds as any, enc, events as any, makePlanLimitMock() as any);

    const dto = {
      stage_name: 'Artista Novo',
      email: 'artista@music.com',
      phone: '+55 11 99999-0000',
      cpf_cnpj: '123.456.789-00',
    };

    const result = await service.create(TENANT_A, USER_ID, dto as any);

    expect(enc.encryptNullable).toHaveBeenCalledWith(dto.email);
    expect(enc.encryptNullable).toHaveBeenCalledWith(dto.phone);
    expect(enc.encryptNullable).toHaveBeenCalledWith(dto.cpf_cnpj);
    expect(ds._repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant_id: TENANT_A,
        email_encrypted: `enc:${dto.email}`,
        phone_encrypted: `enc:${dto.phone}`,
        cpf_cnpj_encrypted: `enc:${dto.cpf_cnpj}`,
      }),
    );
    expect(ds._repo.save).toHaveBeenCalled();
    expect(events.emitTyped).toHaveBeenCalled();
    // Round-trip: the response returns the decrypted value and never the ciphertext.
    expect(result.email).toBe(dto.email);
    expect(result.phone).toBe(dto.phone);
    expect(result.cpf_cnpj).toBe(dto.cpf_cnpj);
    expect(result).not.toHaveProperty('email_encrypted');
  });

  it('update() clears a nullable field with null and does not touch omitted fields', async () => {
    const ds = makeDataSource();
    const service = new ArtistsService(ds as any, makeEncryptionMock(), makeEventsMock() as any, makePlanLimitMock() as any);

    await service.update(TENANT_A, USER_ID, 'artist-001', {
      booking_agency: null,
      notes: 'nova bio',
    } as any);

    expect(ds._repo.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'artist-001', tenant_id: TENANT_A }),
      expect.objectContaining({ booking_agency: null, notes: 'nova bio' }),
    );
    const updates = ds._repo.update.mock.calls[0][1] as Record<string, unknown>;
    expect(updates).not.toHaveProperty('stage_name');
    expect(updates).not.toHaveProperty('email_encrypted');
  });

  it('create() rejects a payload without a stage name (PT-BR copy, nothing persisted)', async () => {
    const ds = makeDataSource();
    const service = new ArtistsService(ds as any, makeEncryptionMock(), makeEventsMock() as any, makePlanLimitMock() as any);

    await expect(service.create(TENANT_A, USER_ID, { stage_name: '  ' } as any)).rejects.toThrow('Informe o nome artístico.');
    expect(ds._repo.save).not.toHaveBeenCalled();
  });

  it('update() to active without genre/contact fails with PT-BR copy (no technical names)', async () => {
    const ds = makeDataSource();
    const service = new ArtistsService(ds as any, makeEncryptionMock(), makeEventsMock() as any, makePlanLimitMock() as any);

    const error = await service.update(TENANT_A, USER_ID, 'artist-001', { status: 'active' } as any).catch((e: Error) => e);
    expect((error as Error).message).toBe('Gênero musical obrigatório para ativar o artista; Informe e-mail ou telefone para ativar o artista');
    expect((error as Error).message).not.toMatch(/music_genre|\bphone\b|\bemail\b/);
    expect(ds._repo.update).not.toHaveBeenCalled();
  });

  it('update() to signed requires a linked contract (deprecated contrato_id accepted; empty value does not count)', async () => {
    const ds = makeDataSource();
    const service = new ArtistsService(ds as any, makeEncryptionMock(), makeEventsMock() as any, makePlanLimitMock() as any);

    await expect(service.update(TENANT_A, USER_ID, 'artist-001', { status: 'signed', contract_id: '' } as any))
      .rejects.toThrow('Vincule um contrato para marcar o artista como contratado.');
    await service.update(TENANT_A, USER_ID, 'artist-001', { status: 'signed', contrato_id: '5f0c3c52-4a8e-4a39-9d51-2b7a2a4ac001' } as any);
    expect(ds._repo.update).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ status: 'signed', contract_id: '5f0c3c52-4a8e-4a39-9d51-2b7a2a4ac001' }),
    );
  });

  it('update()/create() reject a contract_id that belongs to another tenant (no cross-tenant reference)', async () => {
    const ds = makeDataSource();
    (ds as any).query = jest.fn().mockResolvedValue([]);
    const service = new ArtistsService(ds as any, makeEncryptionMock(), makeEventsMock() as any, makePlanLimitMock() as any);
    await expect(service.update(TENANT_A, USER_ID, 'artist-001', { contract_id: '5f0c3c52-4a8e-4a39-9d51-2b7a2a4ac009' } as any))
      .rejects.toThrow('Contrato não encontrado neste workspace.');
    await expect(service.create(TENANT_A, USER_ID, { stage_name: 'X', contract_id: '5f0c3c52-4a8e-4a39-9d51-2b7a2a4ac009' } as any))
      .rejects.toThrow('Contrato não encontrado neste workspace.');
    // The deprecated alias goes through the same tenant check.
    await expect(service.update(TENANT_A, USER_ID, 'artist-001', { contrato_id: '5f0c3c52-4a8e-4a39-9d51-2b7a2a4ac010' } as any))
      .rejects.toThrow('Contrato não encontrado neste workspace.');
    expect(ds._repo.update).not.toHaveBeenCalled();
    expect(ds._repo.save).not.toHaveBeenCalled();
  });

  it('the contract ownership query binds the caller tenant and excludes soft-deleted contracts', async () => {
    // Only a live contract of TENANT_A exists: the mock answers like Postgres
    // would, so dropping the tenant or deleted_at predicate makes this fail.
    const LIVE = '5f0c3c52-4a8e-4a39-9d51-2b7a2a4ac011';
    const DELETED = '5f0c3c52-4a8e-4a39-9d51-2b7a2a4ac012';
    const contracts = [
      { id: LIVE, tenant_id: TENANT_A, deleted_at: null },
      { id: DELETED, tenant_id: TENANT_A, deleted_at: new Date() },
    ];
    const ds = makeDataSource();
    (ds as any).query = jest.fn(async (sql: string, params: unknown[]) => {
      const [id, tenantId] = params as [string, string];
      const filtersTenant = /"tenant_id"\s*=\s*\$2/.test(sql);
      const filtersDeleted = /"deleted_at"\s+IS\s+NULL/i.test(sql);
      return contracts.filter((c) => c.id === id
        && (!filtersTenant || c.tenant_id === tenantId)
        && (!filtersDeleted || c.deleted_at === null)).map(() => ({ '?column?': 1 }));
    });
    const service = new ArtistsService(ds as any, makeEncryptionMock(), makeEventsMock() as any, makePlanLimitMock() as any);

    await expect(service.update('tenant-bbb', USER_ID, 'artist-001', { contract_id: LIVE } as any))
      .rejects.toThrow('Contrato não encontrado neste workspace.');
    expect((ds as any).query).toHaveBeenLastCalledWith(expect.stringContaining('"contracts"'), [LIVE, 'tenant-bbb']);
    await expect(service.update(TENANT_A, USER_ID, 'artist-001', { contract_id: DELETED } as any))
      .rejects.toThrow('Contrato não encontrado neste workspace.');
    expect(ds._repo.update).not.toHaveBeenCalled();

    await service.update(TENANT_A, USER_ID, 'artist-001', { contract_id: LIVE } as any);
    expect(ds._repo.update).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ contract_id: LIVE }));
  });

  it('caller-supplied metadata can never set an allow-listed response key that fails its DTO rule (SEC-F1)', async () => {
    const ds = makeDataSource();
    const service = new ArtistsService(ds as any, makeEncryptionMock(), makeEventsMock() as any, makePlanLimitMock() as any);
    const hostile = {
      instagram_url: 'javascript:alert(1)',
      tiktok_url: ' JaVaScRiPt:alert(document.cookie)',
      spotify_listeners: 'data:text/html,<script>alert(1)</script>',
      gender: 'female',
      instagram_followers: 10,
      origin: 'kept (never returned)',
    };

    const created = await service.create(TENANT_A, USER_ID, { stage_name: 'X', metadata: hostile } as any) as Record<string, unknown>;
    const saved = ds._repo.save.mock.calls[0][0] as Record<string, unknown>;
    expect(saved.metadata).toEqual({ gender: 'female', instagram_followers: 10, origin: 'kept (never returned)' });
    expect(created).not.toHaveProperty('instagram_url');
    expect(created).not.toHaveProperty('tiktok_url');
    expect(JSON.stringify(created)).not.toMatch(/javascript:|data:text/i);

    await service.update(TENANT_A, USER_ID, 'artist-001', { metadata: { tiktok_url: 'data:text/html,<b>x</b>' } } as any);
    const updates = ds._repo.update.mock.calls[0][1] as Record<string, unknown>;
    expect(updates.metadata).toEqual({});

    // A valid value goes through, exactly like the top-level field.
    await service.update(TENANT_A, USER_ID, 'artist-001', { metadata: { instagram_url: 'https://www.instagram.com/alpha' } } as any);
    expect((ds._repo.update.mock.calls[1][1] as Record<string, unknown>).metadata).toEqual({ instagram_url: 'https://www.instagram.com/alpha' });
  });

  it('softDelete() sets deleted_at and updated_by without physically deleting', async () => {
    const ds = makeDataSource();
    const service = new ArtistsService(ds as any, makeEncryptionMock(), makeEventsMock() as any, makePlanLimitMock() as any);

    const result = await service.softDelete(TENANT_A, 'user-actor', 'artist-001');

    expect(result).toEqual({ deleted: true });
    expect(ds._repo.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'artist-001', tenant_id: TENANT_A }),
      expect.objectContaining({ deleted_at: expect.any(Date), updated_by: 'user-actor' }),
    );
  });
});
