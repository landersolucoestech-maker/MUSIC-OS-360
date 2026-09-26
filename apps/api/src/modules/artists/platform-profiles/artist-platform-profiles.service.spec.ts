import { ArtistPlatformProfilesService } from './artist-platform-profiles.service';
import type { SocialPlatformProfileSnapshot } from './social-platform-sync.types';

function buildQb() {
  const qb: any = {
    insert: jest.fn(),
    into: jest.fn(),
    values: jest.fn(),
    orUpdate: jest.fn(),
    execute: jest.fn().mockResolvedValue(undefined),
  };
  qb.insert.mockReturnValue(qb);
  qb.into.mockReturnValue(qb);
  qb.values.mockReturnValue(qb);
  qb.orUpdate.mockReturnValue(qb);
  return qb;
}

function buildRepo(qb: ReturnType<typeof buildQb>) {
  return {
    createQueryBuilder: jest.fn(() => qb),
    findOne: jest.fn().mockResolvedValue(null),
  };
}

function buildNoopSnapshots() {
  return { recordFromProfileSnapshot: jest.fn().mockResolvedValue({ inserted: 0, skipped: 0 }) } as never;
}

function baseSnapshot(overrides: Partial<SocialPlatformProfileSnapshot>): SocialPlatformProfileSnapshot {
  return {
    tenant_id: 't1',
    artist_id: 'a1',
    platform: 'soundcloud',
    external_id: 'slug',
    external_url: 'https://soundcloud.com/slug',
    display_name: null,
    username: 'slug',
    profile_url: 'https://soundcloud.com/slug',
    image_url: null,
    followers: null,
    subscribers: null,
    monthly_listeners: null,
    popularity: null,
    total_views: null,
    total_videos: null,
    total_tracks: null,
    total_albums: null,
    raw_payload: {},
    sync_status: 'success',
    last_synced_at: null,
    last_error: null,
    ...overrides,
  };
}

// REGRESSAO (achado ao validar em produção real com dados reais — Métricas Fase 1):
// upsertSuccess() sobrescrevia sync_status/last_error com valores fixos ('success'/null),
// IGNORANDO o que o provider realmente decidiu. Resultado: um snapshot IDENTITY_MISMATCH
// (sync_status='failed', last_error explicando o mismatch) virava silenciosamente
// sync_status='success' no banco — o dado errado ficava mascarado como sucesso, exatamente
// o oposto do que a proteção de identidade deveria garantir. Confirmado ao vivo: syncar
// SoundCloud do Dj Stay real (Soundcharts real, sem mock) persistia followers=null +
// identity_status=IDENTITY_MISMATCH no raw_payload, mas sync_status chegava como
// 'success' na API — só descoberto rodando o fluxo real de ponta a ponta, não pelos
// testes unitários dos providers (que nunca passam pelo upsert de verdade).
describe('ArtistPlatformProfilesService.upsertSuccess', () => {
  it('persists sync_status=success/last_error=null when the snapshot is a normal success', async () => {
    const qb = buildQb();
    const repo = buildRepo(qb);
    const service = new ArtistPlatformProfilesService({ getRepository: () => repo } as never, buildNoopSnapshots());

    const snapshot = baseSnapshot({ followers: 777, sync_status: 'success', last_error: null });
    await service.upsertSuccess(snapshot);

    const values = qb.values.mock.calls[0][0];
    expect(values.sync_status).toBe('success');
    expect(values.last_error).toBeNull();
    expect(values.followers).toBe(777);
  });

  it('NEVER overwrites sync_status=failed/last_error of an IDENTITY_MISMATCH snapshot — persists exactly what the provider decided', async () => {
    const qb = buildQb();
    const repo = buildRepo(qb);
    const service = new ArtistPlatformProfilesService({ getRepository: () => repo } as never, buildNoopSnapshots());

    const snapshot = baseSnapshot({
      followers: null,
      sync_status: 'failed',
      last_error: 'Identidade divergente: ... (IDENTITY_MISMATCH)',
      raw_payload: { identity_status: 'IDENTITY_MISMATCH', resolved_uuid: 'b-uuid', canonical_uuid: 'a-uuid' },
    });
    await service.upsertSuccess(snapshot);

    const values = qb.values.mock.calls[0][0];
    expect(values.sync_status).toBe('failed');
    expect(values.last_error).toContain('IDENTITY_MISMATCH');
    expect(values.followers).toBeNull();
    expect(values.raw_payload).toEqual(snapshot.raw_payload);
  });
});
