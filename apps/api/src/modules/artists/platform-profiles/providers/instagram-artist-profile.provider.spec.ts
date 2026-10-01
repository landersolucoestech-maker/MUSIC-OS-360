import { InstagramArtistProfileProvider } from './instagram-artist-profile.provider';
import { SoundchartsNotFoundError } from '../../../integrations/soundcharts/soundcharts.errors';
import type { SoundchartsService } from '../../../integrations/soundcharts/soundcharts.service';

const CANONICAL_URLS = {
  spotifyUrl: 'https://open.spotify.com/artist/6qqNVTkY8uBg9cP3Jd7DAH',
};

describe('InstagramArtistProfileProvider.resolve (Phase 1.3 — the registered handle is PRIMARY, the canonical is a secondary fallback)', () => {
  it('1) the registered handle resolves directly (exact, primary): followers persisted, resolution=own_handle, VERIFIED_EXACT — the canonical chain is not even queried', async () => {
    const soundcharts = {
      isConfigured: jest.fn().mockReturnValue(true),
      resolveArtistByPlatform: jest.fn().mockResolvedValue('own-uuid'),
      resolveCanonicalArtistUuid: jest.fn(),
      getInstagramFollowers: jest.fn().mockResolvedValue({
        value: 123456,
        observedAt: new Date(),
        source: 'soundcharts',
        endpoint: '/x',
        field: 'y',
      }),
    } as unknown as SoundchartsService;
    const provider = new InstagramArtistProfileProvider(soundcharts);

    const snapshot = await provider.resolve({
      tenantId: 't1',
      artistId: 'a1',
      externalId: 'djstayofc',
      externalUrl: null,
      canonicalUrls: CANONICAL_URLS,
    });

    expect(soundcharts.resolveArtistByPlatform).toHaveBeenCalledWith('instagram', 'djstayofc');
    expect(soundcharts.resolveCanonicalArtistUuid).not.toHaveBeenCalled();
    expect(soundcharts.getInstagramFollowers).toHaveBeenCalledWith('own-uuid');
    expect(snapshot.followers).toBe(123456);
    expect(snapshot.sync_status).toBe('success');
    expect(snapshot.raw_payload.resolution).toBe('own_handle');
    expect(snapshot.raw_payload.primary_identity_status).toBe('VERIFIED_EXACT');
  });

  it('2) the registered handle is not indexed standalone (404): falls back to the canonical, the registry CONFIRMS the handle → still VERIFIED_EXACT', async () => {
    const soundcharts = {
      isConfigured: jest.fn().mockReturnValue(true),
      resolveArtistByPlatform: jest.fn().mockRejectedValue(new SoundchartsNotFoundError('not found', 404)),
      resolveCanonicalArtistUuid: jest.fn().mockResolvedValue('canonical-uuid'),
      getArtistIdentifiers: jest.fn().mockResolvedValue({
        raw: {},
        identifiers: [{ platform: 'instagram', identifier: 'djstayofc' }],
      }),
      getInstagramFollowers: jest.fn().mockResolvedValue({ value: 9999, observedAt: new Date(), source: 'soundcharts', endpoint: '/x', field: 'y' }),
    } as unknown as SoundchartsService;
    const provider = new InstagramArtistProfileProvider(soundcharts);

    const snapshot = await provider.resolve({
      tenantId: 't1',
      artistId: 'a1',
      externalId: 'djstayofc',
      externalUrl: null,
      canonicalUrls: CANONICAL_URLS,
    });

    expect(soundcharts.getInstagramFollowers).toHaveBeenCalledWith('canonical-uuid');
    expect(snapshot.followers).toBe(9999);
    expect(snapshot.raw_payload.resolution).toBe('canonical');
    expect(snapshot.raw_payload.primary_identity_status).toBe('VERIFIED_EXACT');
  });

  it('3) the registered handle is not indexed, the canonical has data but the registry does NOT list Instagram: data is still used but labeled INSUFFICIENT_EVIDENCE (never VERIFIED_EXACT without proof)', async () => {
    const soundcharts = {
      isConfigured: jest.fn().mockReturnValue(true),
      resolveArtistByPlatform: jest.fn().mockRejectedValue(new SoundchartsNotFoundError('not found', 404)),
      resolveCanonicalArtistUuid: jest.fn().mockResolvedValue('canonical-uuid'),
      getArtistIdentifiers: jest.fn().mockResolvedValue({ raw: {}, identifiers: [] }),
      getInstagramFollowers: jest.fn().mockResolvedValue({ value: 4242, observedAt: new Date(), source: 'soundcharts', endpoint: '/x', field: 'y' }),
    } as unknown as SoundchartsService;
    const provider = new InstagramArtistProfileProvider(soundcharts);

    const snapshot = await provider.resolve({
      tenantId: 't1',
      artistId: 'a1',
      externalId: 'djstayofc',
      externalUrl: null,
      canonicalUrls: CANONICAL_URLS,
    });

    expect(snapshot.followers).toBe(4242);
    expect(snapshot.sync_status).toBe('success');
    expect(snapshot.raw_payload.resolution).toBe('canonical');
    expect(snapshot.raw_payload.primary_identity_status).toBe('INSUFFICIENT_EVIDENCE');
  });

  it('4) the registered handle is not indexed and the canonical registry points to ANOTHER Instagram account: rejects the canonical data — never inherits another account\'s audience', async () => {
    const soundcharts = {
      isConfigured: jest.fn().mockReturnValue(true),
      resolveArtistByPlatform: jest.fn().mockRejectedValue(new SoundchartsNotFoundError('not found', 404)),
      resolveCanonicalArtistUuid: jest.fn().mockResolvedValue('canonical-uuid'),
      getArtistIdentifiers: jest.fn().mockResolvedValue({
        raw: {},
        identifiers: [{ platform: 'instagram', identifier: 'other-canonical-account' }],
      }),
      getInstagramFollowers: jest.fn(),
    } as unknown as SoundchartsService;
    const provider = new InstagramArtistProfileProvider(soundcharts);

    const snapshot = await provider.resolve({
      tenantId: 't1',
      artistId: 'a1',
      externalId: 'djstayofc',
      externalUrl: null,
      canonicalUrls: CANONICAL_URLS,
    });

    // Never fetches the canonical entity's metric when the registry points to another account.
    expect(soundcharts.getInstagramFollowers).not.toHaveBeenCalled();
    expect(snapshot.followers).toBeNull();
    expect(snapshot.sync_status).toBe('success');
    expect(snapshot.raw_payload.primary_identity_status).toBe('PROFILE_NOT_FOUND');
    expect(snapshot.raw_payload.source).not.toBe('dev_mock');
  });

  it('5) account not indexed on any path (404 on both): followers=null, sync_status=success (NEVER "Erro"), no mock (USE_MOCK off)', async () => {
    const soundcharts = {
      isConfigured: jest.fn().mockReturnValue(true),
      // Own-handle 404 (not indexed standalone); the canonical entity resolves via Spotify,
      // but that entity has no Instagram indexed either (404).
      resolveArtistByPlatform: jest.fn().mockRejectedValue(new SoundchartsNotFoundError('not found', 404)),
      resolveCanonicalArtistUuid: jest.fn().mockResolvedValue('canonical-uuid'),
      getArtistIdentifiers: jest.fn().mockResolvedValue({ raw: {}, identifiers: [] }),
      getInstagramFollowers: jest.fn().mockRejectedValue(new SoundchartsNotFoundError('not found', 404)),
    } as unknown as SoundchartsService;
    const provider = new InstagramArtistProfileProvider(soundcharts);

    const snapshot = await provider.resolve({
      tenantId: 't1',
      artistId: 'a1',
      externalId: 'djstayofc',
      externalUrl: null,
      canonicalUrls: CANONICAL_URLS,
    });

    expect(snapshot.followers).toBeNull();
    expect(snapshot.sync_status).toBe('success');
    expect(snapshot.raw_payload.primary_identity_status).toBe('PROFILE_NOT_FOUND');
    expect(snapshot.raw_payload.source).toBe('soundcharts');
    expect(snapshot.raw_payload.source).not.toBe('dev_mock');
  });

  it('6) an invalid username throws before any network call', async () => {
    const soundcharts = {
      isConfigured: jest.fn().mockReturnValue(true),
      resolveArtistByPlatform: jest.fn(),
    } as unknown as SoundchartsService;
    const provider = new InstagramArtistProfileProvider(soundcharts);

    await expect(
      provider.resolve({ tenantId: 't1', artistId: 'a1', externalId: null, externalUrl: 'https://not-instagram.com/x', canonicalUrls: CANONICAL_URLS }),
    ).rejects.toThrow('Instagram username missing or invalid');
    expect(soundcharts.resolveArtistByPlatform).not.toHaveBeenCalled();
  });

  describe('registered handle normalization (the EXACT identifier used by the primary resolution)', () => {
    const cases: Array<[string, string, string]> = [
      ['@handle', '@djstayofc', 'djstayofc'],
      ['URL completa', 'https://www.instagram.com/djstayofc', 'djstayofc'],
      ['URL com trailing slash', 'https://instagram.com/djstayofc/', 'djstayofc'],
      ['URL com query params', 'https://www.instagram.com/djstayofc/?hl=pt-br', 'djstayofc'],
    ];

    it.each(cases)('%s normaliza para o identifier exato "%s" → "%s"', async (_label, input, expected) => {
      const soundcharts = {
        isConfigured: jest.fn().mockReturnValue(true),
        resolveArtistByPlatform: jest.fn().mockResolvedValue('own-uuid'),
        getInstagramFollowers: jest.fn().mockResolvedValue({ value: 1, observedAt: new Date(), source: 'soundcharts', endpoint: '/x', field: 'y' }),
      } as unknown as SoundchartsService;
      const provider = new InstagramArtistProfileProvider(soundcharts);
      const isUrl = /^https?:\/\//.test(input);

      const snapshot = await provider.resolve({
        tenantId: 't1', artistId: 'a1',
        externalId: isUrl ? null : input,
        externalUrl: isUrl ? input : null,
        canonicalUrls: CANONICAL_URLS,
      });

      expect(soundcharts.resolveArtistByPlatform).toHaveBeenCalledWith('instagram', expected);
      expect(snapshot.username).toBe(expected);
    });

    it('a malformed URL (wrong host) is rejected, never treated as a handle', async () => {
      const soundcharts = {
        isConfigured: jest.fn().mockReturnValue(true),
        resolveArtistByPlatform: jest.fn(),
      } as unknown as SoundchartsService;
      const provider = new InstagramArtistProfileProvider(soundcharts);

      await expect(
        provider.resolve({ tenantId: 't1', artistId: 'a1', externalId: null, externalUrl: 'https://twitter.com/djstayofc', canonicalUrls: CANONICAL_URLS }),
      ).rejects.toThrow('Instagram username missing or invalid');
    });

    it('an empty identifier is rejected', async () => {
      const soundcharts = {
        isConfigured: jest.fn().mockReturnValue(true),
        resolveArtistByPlatform: jest.fn(),
      } as unknown as SoundchartsService;
      const provider = new InstagramArtistProfileProvider(soundcharts);

      await expect(
        provider.resolve({ tenantId: 't1', artistId: 'a1', externalId: null, externalUrl: '', canonicalUrls: CANONICAL_URLS }),
      ).rejects.toThrow('Instagram username missing or invalid');
    });
  });
});
