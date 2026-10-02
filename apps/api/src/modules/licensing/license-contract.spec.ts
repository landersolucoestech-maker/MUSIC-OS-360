import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { LicenseStatus } from '@music-os-360/types';
import { LicensingService } from './licensing.service';
import { CreateLicenseDto } from './dto/licensing.dto';

/**
 * CZ-035: the license contract is English. LEGACY_WEB_LICENSE is the payload a
 * pre-CZ-035 web build sends (slugified PT-BR labels as values, `valor`
 * back-compat field); it must validate and persist canonically.
 */
const errorsFor = (plain: Record<string, unknown>) =>
  validateSync(plainToInstance(CreateLicenseDto, plain, { enableImplicitConversion: true }), {
    whitelist: true,
    forbidNonWhitelisted: true,
  }).map((e) => e.property);

const LEGACY_WEB_LICENSE = {
  title: 'Sync comercial',
  type: 'sync_publicidade',
  work_id: '123e4567-e89b-12d3-a456-426614174000',
  client_id: '223e4567-e89b-12d3-a456-426614174000',
  projeto: 'Campanha Verão',
  midia_destino: 'tv_aberta',
  territorio: 'américa_latina',
  status: 'negociacao',
  start_date: '2026-10-01',
  end_date: '2027-10-01',
  remuneration_type: 'FIXED',
  currency: 'BRL',
  amount: 5000,
  percentage: null,
  valor: 5000,
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
    save: jest.fn(async (v: unknown) => ({ id: 'l1', ...(v as object) })),
    createQueryBuilder: jest.fn(() => qb),
    findOne: jest.fn(),
  };
  const ds = { getRepository: jest.fn(() => repo), query: jest.fn(async () => [{ exists: 1 }]) };
  return { service: new LicensingService(ds as never), repo, qb };
}

describe('License request contract (CZ-035)', () => {
  it('accepts every LicenseStatus and the legacy PT statuses, rejects unknown ones', () => {
    for (const status of [...Object.values(LicenseStatus), 'ativa', 'negociacao']) {
      expect(errorsFor({ title: 'X', status })).toEqual([]);
    }
    expect(errorsFor({ title: 'X', status: 'cancelada' })).toEqual(['status']);
  });

  it('the pre-CZ-035 web payload validates', () => {
    expect(errorsFor(LEGACY_WEB_LICENSE)).toEqual([]);
  });

  it('persists the pre-CZ-035 payload with canonical columns and values only', async () => {
    const { service, repo } = makeService();
    await service.create('tenant-1', 'user-1', LEGACY_WEB_LICENSE as never);
    const row = repo.create.mock.calls[0][0] as Record<string, unknown>;
    expect(row).toMatchObject({
      type: 'sync_advertising', project_name: 'Campanha Verão', target_media: 'free_tv',
      territory: 'latin_america', status: LicenseStatus.NEGOTIATION, amount: 5000, currency: 'BRL',
    });
    for (const legacy of ['projeto', 'midia_destino', 'territorio', 'valor', 'moeda']) expect(row).not.toHaveProperty(legacy);
  });

  it('maps the deprecated `cliente` alias to client_name and never persists it (CZ-035)', async () => {
    expect(errorsFor({ title: 'X', cliente: 'Acme' })).toEqual([]);
    const { service, repo } = makeService();
    await service.create('tenant-1', 'user-1', { title: 'X', cliente: 'Acme' } as never);
    const row = repo.create.mock.calls[0][0] as Record<string, unknown>;
    expect(row).toMatchObject({ client_name: 'Acme' });
    expect(row).not.toHaveProperty('cliente');
  });

  it('list maps a legacy comma-separated status filter and target media filter', async () => {
    const { service, qb } = makeService();
    await service.list('tenant-1', { status: 'negociacao,proposal', midia_destino: 'tv' } as never);
    expect(qb.andWhere).toHaveBeenCalledWith('l.status IN (:...statuses)', { statuses: ['negotiation', 'proposal'] });
    expect(qb.andWhere).toHaveBeenCalledWith('l.target_media ILIKE :media', { media: '%tv%' });
  });
});
