import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { TakedownsService } from './takedowns.service';
import { CreateTakedownDto, QueryTakedownDto } from './dto/takedowns.dto';

/**
 * CZ-034: the takedown contract is English. Before it, the DTO only accepted
 * Portuguese statuses while the DB CHECK (and the web form) use TakedownStatus,
 * so every save and every status filter failed. LEGACY_WEB_TAKEDOWN is the
 * payload a pre-CZ-034 web build sends.
 */
const errorsFor = (dto: new () => object, plain: Record<string, unknown>) =>
  validateSync(plainToInstance(dto, plain, { enableImplicitConversion: true }), {
    whitelist: true,
    forbidNonWhitelisted: true,
  }).map((e) => e.property);

const LEGACY_WEB_TAKEDOWN = {
  title: 'Upload não autorizado',
  type: 'enviado',
  obra_afetada: 'Canção X',
  artista: 'Banda Y',
  plataforma: 'youtube',
  url_infracao: 'https://youtube.test/v/1',
  motivo: 'Uso sem licença',
  description: 'd',
  prioridade: 'alta',
  status: 'pending',
  data_identificacao: '2026-09-01',
  evidencias: 'print',
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
    save: jest.fn(async (v: unknown) => ({ id: 't1', ...(v as object) })),
    createQueryBuilder: jest.fn(() => qb),
  };
  const ds = { getRepository: jest.fn(() => repo), query: jest.fn(async () => [{ exists: 1 }]) };
  return { service: new TakedownsService(ds as never), repo, qb };
}

describe('Takedown request contract (CZ-034)', () => {
  it('accepts the TakedownStatus values the web sends (they used to be rejected) and rejects the old PT ones', () => {
    for (const status of ['pending', 'in_progress', 'completed', 'rejected']) {
      expect(errorsFor(CreateTakedownDto, { title: 'X', platform: 'p', reason: 'r', status })).toEqual([]);
      expect(errorsFor(QueryTakedownDto, { status })).toEqual([]);
    }
    expect(errorsFor(CreateTakedownDto, { title: 'X', platform: 'p', reason: 'r', status: 'pendente' })).toEqual(['status']);
  });

  it('requires platform and reason under either name', () => {
    expect(errorsFor(CreateTakedownDto, { title: 'X' })).toEqual(expect.arrayContaining(['platform', 'reason']));
  });

  it('the pre-CZ-034 web payload validates', () => {
    expect(errorsFor(CreateTakedownDto, LEGACY_WEB_TAKEDOWN)).toEqual([]);
  });

  it('persists the pre-CZ-034 payload with canonical columns and values only', async () => {
    const { service, repo } = makeService();
    await service.create('tenant-1', 'user-1', LEGACY_WEB_TAKEDOWN as never);
    const row = repo.create.mock.calls[0][0] as Record<string, unknown>;
    expect(row).toMatchObject({
      type: 'sent', affected_work: 'Canção X', artist_name: 'Banda Y', platform: 'youtube',
      infringing_url: 'https://youtube.test/v/1', url: 'https://youtube.test/v/1', reason: 'Uso sem licença',
      priority: 'high', status: 'pending', identified_at: '2026-09-01', evidence: 'print',
    });
    for (const legacy of ['obra_afetada', 'artista', 'plataforma', 'url_infracao', 'motivo', 'prioridade', 'data_identificacao', 'evidencias']) {
      expect(row).not.toHaveProperty(legacy);
    }
  });

  it('list filters by canonical platform, also when the legacy name is sent', async () => {
    const { service, qb } = makeService();
    await service.list('tenant-1', { plataforma: 'youtube', status: 'pending' } as never);
    expect(qb.andWhere).toHaveBeenCalledWith('t.platform = :platform', { platform: 'youtube' });
    expect(qb.andWhere).toHaveBeenCalledWith('t.status = :status', { status: 'pending' });
  });
});
