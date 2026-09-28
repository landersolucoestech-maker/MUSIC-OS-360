import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { ReleasesService } from './releases.service';
import { CreateReleaseDto } from './dto/releases.dto';
import { RELEASE_DEPRECATED_FIELDS } from './release-legacy-fields';

/**
 * CZ-038: release fields, type values and jsonb keys are English.
 * LEGACY_WEB_RELEASE is the payload a pre-CZ-038 web build sends; it must
 * validate and persist with canonical columns, values and keys only.
 */
const errorsFor = (plain: Record<string, unknown>) =>
  validateSync(plainToInstance(CreateReleaseDto, plain, { enableImplicitConversion: true }), {
    whitelist: true,
    forbidNonWhitelisted: true,
  }).map((e) => e.property);

const LEGACY_WEB_RELEASE = {
  title: 'Aurora',
  type: 'compilacao',
  distributor: 'onerpm',
  releasedAt: '2026-10-01',
  coverUrl: 'https://cdn/capa.png',
  notas_internas: 'Nota interna',
  gravadora: 'Selo X',
  idioma: 'pt-br',
  assets: { capa_url: 'https://cdn/capa.png', video_clipe_url: 'https://v', letra: 'la la', ficha_tecnica: 'ficha', epk_url: 'https://epk' },
  cronograma: { data_gravacao: '2026-08-01', data_mix_master: '2026-08-15', data_entrega_distribuidora: '2026-09-01' },
};

function build() {
  const repo = {
    create: jest.fn((v: Record<string, unknown>) => v),
    save: jest.fn(async (v: Record<string, unknown>) => ({ id: 'r-new', created_at: new Date(), ...v })),
  };
  const ds = { getRepository: jest.fn(() => repo) };
  const events = { emitTyped: jest.fn() };
  const workflow = { getAllowedTransitions: jest.fn(() => []), transitionInTx: jest.fn() };
  return { svc: new ReleasesService(ds as never, workflow as never, events as never), repo };
}

describe('Release request contract (CZ-038)', () => {
  it('the pre-CZ-038 web payload validates', () => {
    expect(errorsFor(LEGACY_WEB_RELEASE)).toEqual([]);
  });

  it('rejects an unknown release type', () => {
    expect(errorsFor({ title: 'x', type: 'mixtape' })).toContain('type');
  });

  it('persists the pre-CZ-038 payload with canonical columns, values and jsonb keys only', async () => {
    const { svc, repo } = build();
    await svc.create('tenant-1', 'user-1', LEGACY_WEB_RELEASE as never);
    const row = repo.create.mock.calls[0][0] as Record<string, unknown>;
    expect(row).toMatchObject({
      type: 'compilation', distributor: 'onerpm', cover_url: 'https://cdn/capa.png',
      internal_notes: 'Nota interna', record_label: 'Selo X', language: 'pt-br',
      assets: { cover_url: 'https://cdn/capa.png', music_video_url: 'https://v', lyrics: 'la la', credits: 'ficha', epk_url: 'https://epk' },
      schedule: { recording_date: '2026-08-01', mix_master_date: '2026-08-15', distributor_delivery_date: '2026-09-01' },
    });
    expect(row['release_date']).toBeInstanceOf(Date);
    for (const legacy of [...Object.keys(RELEASE_DEPRECATED_FIELDS), 'distribuidora', 'data_lancamento', 'plataformas', 'capa_url']) {
      expect(row).not.toHaveProperty(legacy);
    }
  });

  it('the canonical field wins over its deprecated alias', async () => {
    const { svc, repo } = build();
    await svc.create('tenant-1', 'user-1', { title: 'x', type: 'single', record_label: 'Novo', gravadora: 'Antigo' } as never);
    expect(repo.create.mock.calls[0][0]).toMatchObject({ record_label: 'Novo' });
  });
});
