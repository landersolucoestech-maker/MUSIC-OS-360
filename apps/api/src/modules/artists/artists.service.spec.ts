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
  nome_artistico: 'Artista Alpha',
  email_encrypted: null,
  telefone_encrypted: null,
  cpf_cnpj_encrypted: null,
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
    // Task H: list() enriquece cada artista com o vínculo (exclusivo/
    // parceiro/independente) via uma query bruta restrita aos IDs da
    // página — sem nenhum contrato mockado, isso resolve pra "independente".
    query: jest.fn().mockResolvedValue([]),
    _repo: repo,
  };
}

describe('ArtistsService', () => {
  it('list() retorna artistas filtrados pelo tenant correcto', async () => {
    const ds = makeDataSource();
    const service = new ArtistsService(ds as any, makeEncryptionMock(), makeEventsMock() as any, makePlanLimitMock() as any);

    const result = await service.list(TENANT_A, {});

    // Contrato de resposta: ciphertext NUNCA sai da API; os campos PII voltam
    // decifrados nos nomes usados pelo formulário (null quando não preenchidos).
    const { email_encrypted, telefone_encrypted, cpf_cnpj_encrypted, ...artistAPublic } = artistA;
    expect(result.data).toEqual([{
      ...artistAPublic,
      email: null,
      telefone: null,
      cpf_cnpj: null,
      manager_contato: null,
      vinculo: 'independent',
    }]);
    expect(result.data[0]).not.toHaveProperty('email_encrypted');
    expect(result.meta.total).toBe(1);
    expect(ds._repo._qb.where).toHaveBeenCalledWith(
      'a.tenant_id = :tenantId',
      { tenantId: TENANT_A },
    );
  });

  it('find-924ed503: list() ignora um orderBy fora da allow-list (tentativa de SQL injection) e usa o fallback created_at', async () => {
    const ds = makeDataSource();
    const service = new ArtistsService(ds as any, makeEncryptionMock(), makeEventsMock() as any, makePlanLimitMock() as any);

    await service.list(TENANT_A, { orderBy: "id; DROP TABLE artists;--" } as any);

    expect(ds._repo._qb.orderBy).toHaveBeenCalledWith('a.created_at', 'DESC');
  });

  it('find-924ed503: list() aceita um orderBy da allow-list normalmente', async () => {
    const ds = makeDataSource();
    const service = new ArtistsService(ds as any, makeEncryptionMock(), makeEventsMock() as any, makePlanLimitMock() as any);

    await service.list(TENANT_A, { orderBy: 'nome_artistico', ascending: true } as any);

    expect(ds._repo._qb.orderBy).toHaveBeenCalledWith('a.nome_artistico', 'ASC');
  });

  it('findById() retorna artista quando pertence ao tenant', async () => {
    const ds = makeDataSource();
    const service = new ArtistsService(ds as any, makeEncryptionMock(), makeEventsMock() as any, makePlanLimitMock() as any);

    await expect(service.findById(TENANT_A, 'artist-001')).resolves.toEqual(artistA);
  });

  it('findById() lanca NotFoundException para artista nao encontrado', async () => {
    const ds = makeDataSource(null);
    const service = new ArtistsService(ds as any, makeEncryptionMock(), makeEventsMock() as any, makePlanLimitMock() as any);

    await expect(service.findById(TENANT_A, 'inexistente')).rejects.toThrow(NotFoundException);
  });

  it('create() encripta email, telefone e CPF/CNPJ antes de persistir', async () => {
    const ds = makeDataSource();
    const enc = makeEncryptionMock();
    const events = makeEventsMock();
    const service = new ArtistsService(ds as any, enc, events as any, makePlanLimitMock() as any);

    const dto = {
      nome_artistico: 'Artista Novo',
      email: 'artista@music.com',
      telefone: '+55 11 99999-0000',
      cpf_cnpj: '123.456.789-00',
    };

    const result = await service.create(TENANT_A, USER_ID, dto as any);

    expect(enc.encryptNullable).toHaveBeenCalledWith(dto.email);
    expect(enc.encryptNullable).toHaveBeenCalledWith(dto.telefone);
    expect(enc.encryptNullable).toHaveBeenCalledWith(dto.cpf_cnpj);
    expect(ds._repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant_id: TENANT_A,
        email_encrypted: `enc:${dto.email}`,
        telefone_encrypted: `enc:${dto.telefone}`,
        cpf_cnpj_encrypted: `enc:${dto.cpf_cnpj}`,
      }),
    );
    expect(ds._repo.save).toHaveBeenCalled();
    expect(events.emitTyped).toHaveBeenCalled();
    // Round-trip: a resposta devolve o valor decifrado e nunca o ciphertext.
    expect(result.email).toBe(dto.email);
    expect(result.telefone).toBe(dto.telefone);
    expect(result.cpf_cnpj).toBe(dto.cpf_cnpj);
    expect(result).not.toHaveProperty('email_encrypted');
  });

  it('update() limpa campo anulável com null e não toca campos omitidos', async () => {
    const ds = makeDataSource();
    const service = new ArtistsService(ds as any, makeEncryptionMock(), makeEventsMock() as any, makePlanLimitMock() as any);

    await service.update(TENANT_A, USER_ID, 'artist-001', {
      agencia_booking: null,
      observacoes: 'nova bio',
    } as any);

    expect(ds._repo.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'artist-001', tenant_id: TENANT_A }),
      expect.objectContaining({ agencia_booking: null, observacoes: 'nova bio' }),
    );
    const updates = ds._repo.update.mock.calls[0][1] as Record<string, unknown>;
    expect(updates).not.toHaveProperty('nome_artistico');
    expect(updates).not.toHaveProperty('email_encrypted');
  });

  it('softDelete() define deleted_at e updated_by sem apagar fisicamente', async () => {
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
