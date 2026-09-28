import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { ShareStatus } from '@music-os-360/types';
import { SharesService } from './shares.service';
import { CreateShareDto, QueryShareDto } from './dto/shares.dto';
import { SHARE_DEPRECATED_FIELDS } from './share-legacy-fields';

/**
 * CZ-037: share fields and values are English. LEGACY_WEB_SHARE is the payload a
 * pre-CZ-037 web build sends (Portuguese names and values, artist mirrored in
 * artista_project_id); it must validate and persist with canonical columns and
 * values only. Before CZ-037 every financial share save failed because the web
 * statuses (pendente, enviado, ...) were rejected by chk_shares_status.
 */
const errorsFor = (dto: new () => object, plain: Record<string, unknown>) =>
  validateSync(plainToInstance(dto, plain, { enableImplicitConversion: true }), {
    whitelist: true,
    forbidNonWhitelisted: true,
  }).map((e) => e.property);

const ARTIST = '11111111-1111-4111-8111-111111111111';

const LEGACY_WEB_SHARE = {
  share_type: 'external_receivable',
  music_title: 'Canção',
  artista_externo: 'Banda X',
  artista_project_id: ARTIST,
  artist_id: ARTIST,
  pagador: 'Gravadora Y',
  pagador_contato: 'contato@y.com',
  origem_acordo: 'Contrato 2025',
  data_prevista: '2026-10-01',
  acordo_notas: 'Notas',
  acordo_url: 'https://example.com/acordo.pdf',
  versao: 2,
  historico: [{ versao: 1, data: '2026-09-01', percentage: 10, autor: 'Sistema', descricao: 'Registro inicial' }],
  percentage: 10,
  status: 'enviado',
  direction: 'a_receber',
  type: 'interprete',
};

function makeService() {
  const repo = {
    create: jest.fn((v: unknown) => v),
    save: jest.fn(async (v: unknown) => ({ id: 'share-1', ...(v as object) })),
  };
  const manager = { getRepository: jest.fn(() => repo), query: jest.fn().mockResolvedValue([]) };
  const ds = {
    getRepository: jest.fn(() => repo),
    transaction: jest.fn(async (cb: (m: unknown) => unknown) => cb(manager)),
  };
  return { service: new SharesService(ds as never), repo };
}

describe('Share request contract (CZ-037)', () => {
  it('the pre-CZ-037 web payload validates', () => {
    expect(errorsFor(CreateShareDto, LEGACY_WEB_SHARE)).toEqual([]);
  });

  it('rejects a status outside the canonical and legacy vocabularies', () => {
    expect(errorsFor(CreateShareDto, { status: 'whatever' })).toContain('status');
    expect(errorsFor(CreateShareDto, { direction: 'sideways' })).toContain('direction');
  });

  it('accepts every canonical status and both directions', () => {
    for (const status of Object.values(ShareStatus)) expect(errorsFor(CreateShareDto, { status })).toEqual([]);
    for (const direction of ['receivable', 'payable']) expect(errorsFor(QueryShareDto, { direction })).toEqual([]);
  });

  it('persists the pre-CZ-037 payload with canonical columns and values only', async () => {
    const { service, repo } = makeService();
    await service.create('tenant-1', LEGACY_WEB_SHARE as never);
    const row = repo.create.mock.calls[0][0] as Record<string, unknown>;
    expect(row).toMatchObject({
      external_artist_name: 'Banda X', artist_id: ARTIST, payer: 'Gravadora Y', payer_contact: 'contato@y.com',
      agreement_source: 'Contrato 2025', expected_at: '2026-10-01', agreement_notes: 'Notas',
      agreement_url: 'https://example.com/acordo.pdf', version: 2,
      history: [{ version: 1, date: '2026-09-01', percentage: 10, author: 'Sistema', description: 'Registro inicial' }],
      status: ShareStatus.SENT, direction: 'receivable', type: 'performer',
    });
    for (const legacy of Object.keys(SHARE_DEPRECATED_FIELDS)) expect(row).not.toHaveProperty(legacy);
    expect(row).not.toHaveProperty('legacy_artist_project_id');
  });

  it('the canonical field wins over its deprecated alias', async () => {
    const { service, repo } = makeService();
    await service.create('tenant-1', { payer: 'Novo', pagador: 'Antigo', status: 'pending' } as never);
    expect(repo.create.mock.calls[0][0]).toMatchObject({ payer: 'Novo', status: 'pending' });
  });
});
