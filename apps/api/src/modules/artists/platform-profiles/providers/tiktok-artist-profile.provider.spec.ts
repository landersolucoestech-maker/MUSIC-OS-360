import { TikTokArtistProfileProvider } from './tiktok-artist-profile.provider';
import { SoundchartsNotFoundError } from '../../../integrations/soundcharts/soundcharts.errors';
import type { SoundchartsService } from '../../../integrations/soundcharts/soundcharts.service';

const CANONICAL_URLS = {
  spotifyUrl: 'https://open.spotify.com/artist/6qqNVTkY8uBg9cP3Jd7DAH',
};

describe('TikTokArtistProfileProvider.resolve (Phase 1.3 — the registered handle is PRIMARY, the canonical is a secondary fallback)', () => {
  it('1) the registered handle resolves directly (exact, primary): followers persisted, resolution=own_handle, VERIFIED_EXACT — the canonical chain is not even queried', async () => {
    const soundcharts = {
      isConfigured: jest.fn().mockReturnValue(true),
      resolveArtistByPlatform: jest.fn().mockResolvedValue('own-uuid'),
      resolveCanonicalArtistUuid: jest.fn(),
      getTikTokFollowers: jest.fn().mockResolvedValue({
        value: 654321,
        observedAt: new Date(),
        source: 'soundcharts',
        endpoint: '/x',
        field: 'y',
      }),
    } as unknown as SoundchartsService;
    const provider = new TikTokArtistProfileProvider(soundcharts);

    const snapshot = await provider.resolve({
      tenantId: 't1',
      artistId: 'a1',
      externalId: 'djstayoficial',
      externalUrl: null,
      canonicalUrls: CANONICAL_URLS,
    });

    expect(soundcharts.resolveArtistByPlatform).toHaveBeenCalledWith('tiktok', 'djstayoficial');
    expect(soundcharts.resolveCanonicalArtistUuid).not.toHaveBeenCalled();
    expect(snapshot.followers).toBe(654321);
    expect(snapshot.sync_status).toBe('success');
    expect(snapshot.raw_payload.resolution).toBe('own_handle');
    expect(snapshot.raw_payload.primary_identity_status).toBe('VERIFIED_EXACT');
  });

  it('@handle and URL normalize to the same username', async () => {
    const soundcharts = {
      isConfigured: jest.fn().mockReturnValue(true),
      resolveArtistByPlatform: jest.fn().mockResolvedValue('own-uuid'),
      getTikTokFollowers: jest.fn().mockResolvedValue({ value: 1, observedAt: new Date(), source: 'soundcharts', endpoint: '/x', field: 'y' }),
    } as unknown as SoundchartsService;
    const provider = new TikTokArtistProfileProvider(soundcharts);

    const byUrl = await provider.resolve({
      tenantId: 't1', artistId: 'a1', externalId: null,
      externalUrl: 'https://www.tiktok.com/@djstayoficial?lang=pt', canonicalUrls: CANONICAL_URLS,
    });
    expect(byUrl.username).toBe('djstayoficial');
  });

  it('2) the registered handle is not indexed standalone (404): falls back to the canonical, the registry CONFIRMS the handle → still VERIFIED_EXACT', async () => {
    const soundcharts = {
      isConfigured: jest.fn().mockReturnValue(true),
      resolveArtistByPlatform: jest.fn().mockRejectedValue(new SoundchartsNotFoundError('not found', 404)),
      resolveCanonicalArtistUuid: jest.fn().mockResolvedValue('canonical-uuid'),
      getArtistIdentifiers: jest.fn().mockResolvedValue({
        raw: {},
        identifiers: [{ platform: 'tiktok', identifier: 'djstayoficial' }],
      }),
      getTikTokFollowers: jest.fn().mockResolvedValue({ value: 8888, observedAt: new Date(), source: 'soundcharts', endpoint: '/x', field: 'y' }),
    } as unknown as SoundchartsService;
    const provider = new TikTokArtistProfileProvider(soundcharts);

    const snapshot = await provider.resolve({
      tenantId: 't1',
      artistId: 'a1',
      externalId: 'djstayoficial',
      externalUrl: null,
      canonicalUrls: CANONICAL_URLS,
    });

    expect(soundcharts.getTikTokFollowers).toHaveBeenCalledWith('canonical-uuid');
    expect(snapshot.followers).toBe(8888);
    expect(snapshot.raw_payload.resolution).toBe('canonical');
    expect(snapshot.raw_payload.primary_identity_status).toBe('VERIFIED_EXACT');
  });

  it('3) the registered handle is not indexed, the canonical has data but the registry does NOT list TikTok: data is still used but labeled INSUFFICIENT_EVIDENCE (never VERIFIED_EXACT without proof)', async () => {
    const soundcharts = {
      isConfigured: jest.fn().mockReturnValue(true),
      resolveArtistByPlatform: jest.fn().mockRejectedValue(new SoundchartsNotFoundError('not found', 404)),
      resolveCanonicalArtistUuid: jest.fn().mockResolvedValue('canonical-uuid'),
      getArtistIdentifiers: jest.fn().mockResolvedValue({ raw: {}, identifiers: [] }),
      getTikTokFollowers: jest.fn().mockResolvedValue({ value: 4242, observedAt: new Date(), source: 'soundcharts', endpoint: '/x', field: 'y' }),
    } as unknown as SoundchartsService;
    const provider = new TikTokArtistProfileProvider(soundcharts);

    const snapshot = await provider.resolve({
      tenantId: 't1',
      artistId: 'a1',
      externalId: 'djstayoficial',
      externalUrl: null,
      canonicalUrls: CANONICAL_URLS,
    });

    expect(snapshot.followers).toBe(4242);
    expect(snapshot.sync_status).toBe('success');
    expect(snapshot.raw_payload.resolution).toBe('canonical');
    expect(snapshot.raw_payload.primary_identity_status).toBe('INSUFFICIENT_EVIDENCE');
  });

  it('4) the registered handle is not indexed and the canonical registry points to ANOTHER TikTok account: rejects the canonical data — never inherits another account\'s audience', async () => {
    const soundcharts = {
      isConfigured: jest.fn().mockReturnValue(true),
      resolveArtistByPlatform: jest.fn().mockRejectedValue(new SoundchartsNotFoundError('not found', 404)),
      resolveCanonicalArtistUuid: jest.fn().mockResolvedValue('canonical-uuid'),
      getArtistIdentifiers: jest.fn().mockResolvedValue({
        raw: {},
        identifiers: [{ platform: 'tiktok', identifier: 'other-canonical-account' }],
      }),
      getTikTokFollowers: jest.fn(),
    } as unknown as SoundchartsService;
    const provider = new TikTokArtistProfileProvider(soundcharts);

    const snapshot = await provider.resolve({
      tenantId: 't1',
      artistId: 'a1',
      externalId: 'djstayoficial',
      externalUrl: null,
      canonicalUrls: CANONICAL_URLS,
    });

    expect(soundcharts.getTikTokFollowers).not.toHaveBeenCalled();
    expect(snapshot.followers).toBeNull();
    expect(snapshot.sync_status).toBe('success');
    expect(snapshot.raw_payload.primary_identity_status).toBe('PROFILE_NOT_FOUND');
    expect(snapshot.raw_payload.source).not.toBe('dev_mock');
  });

  it('5) account not indexed on any path (404 on both): followers=null, sync_status=success (NEVER "Erro"), no mock (USE_MOCK off)', async () => {
    const soundcharts = {
      isConfigured: jest.fn().mockReturnValue(true),
      // Own-handle 404 (not indexed standalone); the canonical entity resolves via Spotify,
      // but that entity has no TikTok indexed either (404).
      resolveArtistByPlatform: jest.fn().mockRejectedValue(new SoundchartsNotFoundError('not found', 404)),
      resolveCanonicalArtistUuid: jest.fn().mockResolvedValue('canonical-uuid'),
      getArtistIdentifiers: jest.fn().mockResolvedValue({ raw: {}, identifiers: [] }),
      getTikTokFollowers: jest.fn().mockRejectedValue(new SoundchartsNotFoundError('not found', 404)),
    } as unknown as SoundchartsService;
    const provider = new TikTokArtistProfileProvider(soundcharts);

    const snapshot = await provider.resolve({
      tenantId: 't1',
      artistId: 'a1',
      externalId: 'djstayoficial',
      externalUrl: null,
      canonicalUrls: CANONICAL_URLS,
    });

    expect(snapshot.followers).toBeNull();
    expect(snapshot.sync_status).toBe('success');
    expect(snapshot.raw_payload.primary_identity_status).toBe('PROFILE_NOT_FOUND');
    expect(snapshot.raw_payload.source).toBe('soundcharts');
    expect(snapshot.raw_payload.source).not.toBe('dev_mock');
  });

  describe('registered handle normalization (the EXACT identifier used by the primary resolution)', () => {
    const cases: Array<[string, string, string]> = [
      ['@handle', '@djstayoficial', 'djstayoficial'],
      ['URL completa', 'https://www.tiktok.com/@djstayoficial', 'djstayoficial'],
      ['URL com trailing slash', 'https://www.tiktok.com/@djstayoficial/', 'djstayoficial'],
      ['URL com query params', 'https://www.tiktok.com/@djstayoficial?lang=pt', 'djstayoficial'],
    ];

    it.each(cases)('%s normaliza para o identifier exato "%s" → "%s"', async (_label, input, expected) => {
      const soundcharts = {
        isConfigured: jest.fn().mockReturnValue(true),
        resolveArtistByPlatform: jest.fn().mockResolvedValue('own-uuid'),
        getTikTokFollowers: jest.fn().mockResolvedValue({ value: 1, observedAt: new Date(), source: 'soundcharts', endpoint: '/x', field: 'y' }),
      } as unknown as SoundchartsService;
      const provider = new TikTokArtistProfileProvider(soundcharts);
      const isUrl = /^https?:\/\//.test(input);

      const snapshot = await provider.resolve({
        tenantId: 't1', artistId: 'a1',
        externalId: isUrl ? null : input,
        externalUrl: isUrl ? input : null,
        canonicalUrls: CANONICAL_URLS,
      });

      expect(soundcharts.resolveArtistByPlatform).toHaveBeenCalledWith('tiktok', expected);
      expect(snapshot.username).toBe(expected);
    });

    it('a malformed URL (wrong host) is rejected, never treated as a handle', async () => {
      const soundcharts = {
        isConfigured: jest.fn().mockReturnValue(true),
        resolveArtistByPlatform: jest.fn(),
      } as unknown as SoundchartsService;
      const provider = new TikTokArtistProfileProvider(soundcharts);

      await expect(
        provider.resolve({ tenantId: 't1', artistId: 'a1', externalId: null, externalUrl: 'https://twitter.com/djstayoficial', canonicalUrls: CANONICAL_URLS }),
      ).rejects.toThrow('TikTok username missing or invalid');
    });

    it('an empty identifier is rejected', async () => {
      const soundcharts = {
        isConfigured: jest.fn().mockReturnValue(true),
        resolveArtistByPlatform: jest.fn(),
      } as unknown as SoundchartsService;
      const provider = new TikTokArtistProfileProvider(soundcharts);

      await expect(
        provider.resolve({ tenantId: 't1', artistId: 'a1', externalId: null, externalUrl: '', canonicalUrls: CANONICAL_URLS }),
      ).rejects.toThrow('TikTok username missing or invalid');
    });
  });
});
