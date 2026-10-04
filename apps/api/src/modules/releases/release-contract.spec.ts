import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { ReleasesService } from './releases.service';
import { CreateReleaseDto, QueryReleaseDto } from './dto/releases.dto';
import {
  RELEASE_ASSET_DEPRECATED_KEYS,
  RELEASE_DEPRECATED_FIELDS,
  RELEASE_SCHEDULE_DEPRECATED_KEYS,
  canonicalReleaseType,
  canonicalizeReleaseInput,
} from './release-legacy-fields';

/**
 * CZ-038: release fields, type values and jsonb keys are English.
 * LEGACY_WEB_RELEASE is the payload a pre-CZ-038 web build sends; it must
 * validate and persist with canonical columns, values and keys only.
 */
const errorsFor = (plain: Record<string, unknown>, dto: new () => object = CreateReleaseDto) =>
  validateSync(plainToInstance(dto, plain, { enableImplicitConversion: true }), {
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

  it('the status filter accepts one ReleaseStatus or a comma-separated list, never a display label or PT value', () => {
    expect(errorsFor({ status: 'review' }, QueryReleaseDto)).toEqual([]);
    expect(errorsFor({ status: 'review,scheduled' }, QueryReleaseDto)).toEqual([]);
    for (const status of ['pendente', 'review,pendente', 'Pendente', 'review,']) {
      expect(errorsFor({ status }, QueryReleaseDto)).toContain('status');
    }
  });

  it('an edit from a pre-CZ-038 build keeps the stored asset/schedule keys it read as blank (merge, not replace)', async () => {
    const current = {
      id: 'r1', tenant_id: 'tenant-1', title: 'Aurora', status: 'draft',
      assets: { cover_url: 'https://cdn/c.png', lyrics: 'antiga' },
      schedule: { recording_date: '2026-08-01' },
    };
    const qb: Record<string, jest.Mock> = {};
    for (const m of ['leftJoinAndMapOne', 'select', 'where']) qb[m] = jest.fn(() => qb);
    qb['getOne'] = jest.fn(async () => ({ ...current }));
    const repo = { createQueryBuilder: jest.fn(() => qb), update: jest.fn(async () => ({ affected: 1 })) };
    const ds = { getRepository: jest.fn(() => repo) };
    const workflow = { getAllowedTransitions: jest.fn(() => []), transitionInTx: jest.fn() };
    const svc = new ReleasesService(ds as never, workflow as never, { emitTyped: jest.fn() } as never);

    // Old tab: read cover_url/recording_date as blank, sends them as nulls under the legacy keys.
    await svc.update('tenant-1', 'u1', 'r1', {
      assets: { capa_url: null, letra: 'nova' },
      cronograma: { data_gravacao: null, data_mix_master: '2026-08-20' },
    } as never);
    const written = (repo.update.mock.calls as unknown as unknown[][])[0][1] as Record<string, unknown>;
    expect(written['assets']).toEqual({ cover_url: 'https://cdn/c.png', lyrics: 'nova' });
    expect(written['schedule']).toEqual({ recording_date: '2026-08-01', mix_master_date: '2026-08-20' });
  });
  it('saving the form keeps metadata keys written by automations (merge, not replace)', async () => {
    const current = {
      id: 'r1', tenant_id: 'tenant-1', title: 'Aurora', status: 'draft',
      metadata: { checklist: { done: 3 }, territory: 'BR' },
    };
    const qb: Record<string, jest.Mock> = {};
    for (const m of ['leftJoinAndMapOne', 'select', 'where']) qb[m] = jest.fn(() => qb);
    qb['getOne'] = jest.fn(async () => ({ ...current }));
    const repo = { createQueryBuilder: jest.fn(() => qb), update: jest.fn(async () => ({ affected: 1 })) };
    const ds = { getRepository: jest.fn(() => repo) };
    const workflow = { getAllowedTransitions: jest.fn(() => []), transitionInTx: jest.fn() };
    const svc = new ReleasesService(ds as never, workflow as never, { emitTyped: jest.fn() } as never);

    await svc.update('tenant-1', 'u1', 'r1', { metadata: { territory: 'PT', pricing: 'mid' } } as never);
    const written = (repo.update.mock.calls as unknown as unknown[][])[0][1] as Record<string, unknown>;
    expect(written['metadata']).toEqual({ checklist: { done: 3 }, territory: 'PT', pricing: 'mid' });
  });

  describe('metadata persisted keys (dual-read, canonical write)', () => {
    const svcFor = (metadata: Record<string, unknown>) => {
      const current = { id: 'r1', tenant_id: 'tenant-1', title: 'Aurora', status: 'draft', metadata };
      const qb: Record<string, jest.Mock> = {};
      for (const m of ['leftJoinAndMapOne', 'select', 'where']) qb[m] = jest.fn(() => qb);
      qb['getOne'] = jest.fn(async () => ({ ...current }));
      const repo = {
        createQueryBuilder: jest.fn(() => qb),
        update: jest.fn(async () => ({ affected: 1 })),
        create: jest.fn((x: unknown) => x),
        save: jest.fn(async (x: Record<string, unknown>) => ({ id: 'r1', ...x })),
      };
      const ds = { getRepository: jest.fn(() => repo) };
      const workflow = { getAllowedTransitions: jest.fn(() => []), transitionInTx: jest.fn() };
      return { repo, svc: new ReleasesService(ds as never, workflow as never, { emitTyped: jest.fn() } as never) };
    };

    it('an old web build posting Portuguese keys is stored canonical on create', async () => {
      const { repo, svc } = svcFor({});
      await svc.create('tenant-1', 'u1', { title: 'A', type: 'single', metadata: { variosArtistas: true, faixas: [{ title: 't', letra: 'x', tipoVersao: 'live' }] } } as never);
      const created = (repo.create.mock.calls as unknown as unknown[][])[0][0] as Record<string, unknown>;
      expect(created['metadata']).toEqual({ variousArtists: true, tracks: [{ title: 't', lyrics: 'x', versionType: 'live' }] });
    });

    it('update merges a canonical payload over a legacy-keyed stored row without leaving both spellings', async () => {
      const { repo, svc } = svcFor({ checklist: { done: 3 }, faixas: [{ title: 'old', letra: 'old' }], generoSecundario: 'Samba' });
      await svc.update('tenant-1', 'u1', 'r1', { metadata: { tracks: [{ title: 'new', lyrics: 'new' }] } } as never);
      const written = (repo.update.mock.calls as unknown as unknown[][])[0][1] as Record<string, unknown>;
      expect(written['metadata']).toEqual({ checklist: { done: 3 }, secondaryGenre: 'Samba', tracks: [{ title: 'new', lyrics: 'new' }] });
    });

    it('findById returns canonical metadata for a row not yet backfilled', async () => {
      const { svc } = svcFor({ faixas: [{ title: 't', compositores: ['a'] }], copyrightDataLancamento: '2024' });
      const found = await svc.findById('tenant-1', 'r1');
      expect(found.metadata).toEqual({ tracks: [{ title: 't', composers: ['a'] }], copyrightReleaseYear: '2024' });
    });
  });
});

// ─── Exhaustive pins of every legacy name of release-legacy-fields.ts (explicit static tables, not derived from the module) ───
type Row2 = ReadonlyArray<readonly [string, string]>;
const X_RELEASE_FIELDS: Row2 = [
  ['notas_internas', 'internal_notes'],
  ['gravadora', 'record_label'],
  ['idioma', 'language'],
  ['cronograma', 'schedule'],
];

const X_RELEASE_SCHEDULE_KEYS: Row2 = [
  ['data_gravacao', 'recording_date'],
  ['data_mix_master', 'mix_master_date'],
  ['data_entrega_distribuidora', 'distributor_delivery_date'],
];

const X_RELEASE_ASSET_KEYS: Row2 = [
  ['capa_url', 'cover_url'],
  ['video_clipe_url', 'music_video_url'],
  ['letra', 'lyrics'],
  ['ficha_tecnica', 'credits'],
];

const X_RELEASE_TYPES: Row2 = [
  ['compilacao', 'compilation'],
  ['compilação', 'compilation'],
  ['outro', 'other'],
  ['álbum', 'album'],
  ['lp', 'album'],
  ['clipe', 'video'],
  ['vídeo', 'video'],
  ['videoclipe', 'video'],
];

describe('release legacy names: every deprecated field, jsonb key and type value, one by one', () => {
  it('the exported alias tables declare exactly the expected pairs', () => {
    expect({ ...RELEASE_DEPRECATED_FIELDS }).toEqual(Object.fromEntries(X_RELEASE_FIELDS));
    expect({ ...RELEASE_SCHEDULE_DEPRECATED_KEYS }).toEqual(Object.fromEntries(X_RELEASE_SCHEDULE_KEYS));
    expect({ ...RELEASE_ASSET_DEPRECATED_KEYS }).toEqual(Object.fromEntries(X_RELEASE_ASSET_KEYS));
  });

  it.each(X_RELEASE_FIELDS.filter(([legacy]) => legacy !== 'cronograma'))('field %s -> %s: legacy-only moves, the CANONICAL value wins when both are sent', (legacy, canonical) => {
    expect(canonicalizeReleaseInput({ [legacy]: 'legacy-value' })).toEqual({ [canonical]: 'legacy-value' });
    expect(canonicalizeReleaseInput({ [legacy]: 'legacy-value', [canonical]: 'canonical-value' })).toEqual({ [canonical]: 'canonical-value' });
  });

  it('field cronograma -> schedule: legacy-only moves (its keys canonicalised), the CANONICAL schedule wins when both are sent', () => {
    expect(canonicalizeReleaseInput({ cronograma: { data_gravacao: 'd' } })).toEqual({ schedule: { recording_date: 'd' } });
    expect(canonicalizeReleaseInput({ cronograma: { data_gravacao: 'old' }, schedule: { recording_date: 'new' } })).toEqual({ schedule: { recording_date: 'new' } });
  });

  it.each(X_RELEASE_SCHEDULE_KEYS)('schedule key %s -> %s: legacy-only moves, canonical wins when both are present', (legacy, canonical) => {
    expect(canonicalizeReleaseInput({ schedule: { [legacy]: 'legacy-value' } })).toEqual({ schedule: { [canonical]: 'legacy-value' } });
    expect(canonicalizeReleaseInput({ schedule: { [legacy]: 'legacy-value', [canonical]: 'canonical-value' } })).toEqual({ schedule: { [canonical]: 'canonical-value' } });
  });

  it.each(X_RELEASE_ASSET_KEYS)('asset key %s -> %s: legacy-only moves, canonical wins when both are present', (legacy, canonical) => {
    expect(canonicalizeReleaseInput({ assets: { [legacy]: 'legacy-value', epk_url: 'e' } })).toEqual({ assets: { [canonical]: 'legacy-value', epk_url: 'e' } });
    expect(canonicalizeReleaseInput({ assets: { [legacy]: 'legacy-value', [canonical]: 'canonical-value' } })).toEqual({ assets: { [canonical]: 'canonical-value' } });
  });

  it.each(X_RELEASE_TYPES)('type %s -> %s (trimmed, case-insensitive); the canonical type is unchanged', (legacy, canonical) => {
    expect(canonicalReleaseType(legacy)).toBe(canonical);
    expect(canonicalReleaseType(`  ${legacy.toUpperCase()} `)).toBe(canonical);
    expect(canonicalizeReleaseInput({ type: legacy })).toEqual({ type: canonical });
    expect(canonicalReleaseType(canonical)).toBe(canonical);
  });

  it('unknown and non-string types are kept; non-object schedule/assets are untouched', () => {
    expect(canonicalReleaseType('custom-type')).toBe('custom-type');
    expect(canonicalReleaseType(7)).toBe(7);
    expect(canonicalizeReleaseInput({ schedule: 'x', assets: ['y'] })).toEqual({ schedule: 'x', assets: ['y'] });
  });
});
