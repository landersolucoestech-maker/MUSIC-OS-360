import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { PhonogramsService } from './phonograms.service';
import { DATA_SOURCE } from '../../database/database.module';
import { EventsService } from '../../core/events/events.service';

/**
 * Legacy wiring: create()/update() must map a pre-CZ-040 (Portuguese-named) payload onto the
 * canonical columns before persistence. String-literal tables / computed keys only.
 */
const TENANT = 'tenant-test';
const ID = 'phono-1';

// legacy name -> canonical name tables, kept as data so the spec reads no Portuguese member
const LEGACY = {
  label: 'gravadora',
  media: 'midia',
  classification: 'classificacao',
  origin: 'pais_origem',
  publication: 'pais_publicacao',
  national: 'nacional',
  ai: 'criada_por_ia',
  simultaneous: 'pub_simultanea',
  participation: 'participacao',
  minutes: 'duracao_min',
  seconds: 'duracao_seg',
  recordingDate: 'gravacao_original',
  releaseDate: 'data_lancamento',
  title: 'titulo',
} as const;
const LEGACY_KEYS = Object.values(LEGACY);

const build = () => {
  const existing = { id: ID, tenant_id: TENANT, title: 'Existing', type: 'master', deleted_at: null };
  const qb: any = { where: jest.fn(), getOne: jest.fn().mockResolvedValue(existing) };
  qb.where.mockReturnValue(qb);
  const repo = {
    createQueryBuilder: jest.fn(() => qb),
    create: jest.fn((v: any) => v),
    save: jest.fn((v: any) => Promise.resolve({ id: ID, ...v })),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
  };
  const ds = { getRepository: jest.fn(() => repo), query: jest.fn().mockResolvedValue([{ exists: 1 }]) };
  return { repo, ds };
};

describe('PhonogramsService legacy wiring (canonicalizePhonogramInput)', () => {
  let service: PhonogramsService;
  let repo: ReturnType<typeof build>['repo'];

  beforeEach(async () => {
    jest.clearAllMocks();
    const built = build();
    repo = built.repo;
    const mod = await Test.createTestingModule({
      providers: [
        PhonogramsService,
        { provide: DATA_SOURCE, useValue: built.ds },
        { provide: EventsService, useValue: { emitTyped: jest.fn() } },
      ],
    }).compile();
    service = mod.get(PhonogramsService);
  });

  it('create(): legacy field names, values, duration and participation persist as canonical columns', async () => {
    await service.create(TENANT, 'u-1', {
      [LEGACY.title]: 'Noite',
      [LEGACY.label]: 'Selo X',
      [LEGACY.media]: 'físico',
      [LEGACY.classification]: 'outro',
      [LEGACY.origin]: 'brazil',
      [LEGACY.publication]: 'usa',
      [LEGACY.national]: true,
      [LEGACY.ai]: false,
      [LEGACY.minutes]: 3,
      [LEGACY.seconds]: 20,
      [LEGACY.participation]: { interprete: [{ nome: 'Ana', percentual: 50 }] },
    } as never);

    const persisted = repo.create.mock.calls[0][0] as Record<string, unknown>;
    expect(persisted).toMatchObject({
      title: 'Noite',
      record_label_name: 'Selo X',
      media_type: 'physical',
      recording_classification: 'other',
      country_of_recording: 'BR',
      publication_country: 'US',
      is_national: true,
      ai_used: false,
      duration_seconds: 200,
      participation: { performers: [{ name: 'Ana', percentage: 50 }] },
    });
    // negative: no deprecated key survives into the persisted entity
    for (const key of LEGACY_KEYS) expect(persisted).not.toHaveProperty(key);
    expect(JSON.stringify(persisted.participation)).not.toMatch(/interprete|percentual|"nome"/);
  });

  it('create(): legacy registry date duplicates map onto the registry columns', async () => {
    await service.create(TENANT, 'u-1', {
      title: 'Noite',
      [LEGACY.recordingDate]: '2020-01-02',
      [LEGACY.releaseDate]: '2021-03-04',
    } as never);
    const persisted = repo.create.mock.calls[0][0] as Record<string, unknown>;
    expect(persisted).toMatchObject({ recording_date: '2020-01-02', release_date: '2021-03-04' });
    for (const key of LEGACY_KEYS) expect(persisted).not.toHaveProperty(key);
  });

  it('update(): legacy payload maps to canonical columns and the unreadable form defaults are dropped', async () => {
    await service.update(TENANT, 'u-1', ID, {
      [LEGACY.label]: 'Selo Y',
      [LEGACY.media]: 'todos',
      [LEGACY.minutes]: 2,
      [LEGACY.seconds]: 5,
      // a pre-CZ-040 edit always re-sends these form defaults: they must NOT overwrite stored data
      [LEGACY.national]: true,
      [LEGACY.ai]: false,
      [LEGACY.simultaneous]: false,
      [LEGACY.participation]: { interprete: [], produtorFonografico: [], musicoAcompanhante: [] },
    } as never);

    expect(repo.update).toHaveBeenCalledTimes(1);
    const written = repo.update.mock.calls[0][1] as Record<string, unknown>;
    expect(written).toMatchObject({ record_label_name: 'Selo Y', media_type: 'all', duration_seconds: 125 });
    for (const key of LEGACY_KEYS) expect(written).not.toHaveProperty(key);
    for (const canonical of ['is_national', 'ai_used', 'is_simultaneous_publication', 'participation']) {
      expect(written).not.toHaveProperty(canonical);
    }
  });

  it('update(): a non-empty legacy participation is mapped (not dropped) to canonical keys', async () => {
    await service.update(TENANT, 'u-1', ID, {
      [LEGACY.participation]: { musicoAcompanhante: [{ nome: 'Beto', percentual: 10 }] },
    } as never);
    const written = repo.update.mock.calls[0][1] as Record<string, unknown>;
    expect(written.participation).toEqual({ session_musicians: [{ name: 'Beto', percentage: 10 }] });
  });
});
