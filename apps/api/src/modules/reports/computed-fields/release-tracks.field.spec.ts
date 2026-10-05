import { BadRequestException } from '@nestjs/common';
import { fetchReleaseTracksForExport, writeReleaseTracksForImport } from './release-tracks.field';

/**
 * find-532335a9 (Wave 7 cross-review): per-track ISRC inside the
 * "Faixas do Lançamento" repeating-group child sheet bypassed ImportCommitService's
 * ISRC pre-check/normalization entirely — those only walk general/non-
 * repeating columns. This proves the per-track write path now applies the
 * same normalization/validation independently.
 */
describe('writeReleaseTracksForImport — per-track ISRC (find-532335a9)', () => {
  function makeQr() {
    return { query: jest.fn().mockResolvedValue(undefined) };
  }

  it('normalizes a hyphenated/lowercase per-track ISRC to canonical form before persist', async () => {
    const qr = makeQr();
    await writeReleaseTracksForImport(qr as never, 'tenant-1', 'release-1', [
      { trackTitle: 'Track 1', isrc: 'br-abc-26-00001' },
    ]);
    const [, params] = qr.query.mock.calls[0];
    const stored = JSON.parse(params[0]);
    expect(stored[0].isrc).toBe('BRABC2600001');
  });

  it('rejects a malformed per-track ISRC', async () => {
    const qr = makeQr();
    await expect(
      writeReleaseTracksForImport(qr as never, 'tenant-1', 'release-1', [
        { trackTitle: 'Track 1', isrc: 'not-an-isrc' },
      ]),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(qr.query).not.toHaveBeenCalled();
  });

  it('leaves an absent per-track ISRC as null (optional field)', async () => {
    const qr = makeQr();
    await writeReleaseTracksForImport(qr as never, 'tenant-1', 'release-1', [
      { trackTitle: 'Track 1' },
    ]);
    const [, params] = qr.query.mock.calls[0];
    const stored = JSON.parse(params[0]);
    expect(stored[0].isrc).toBeNull();
  });
});

describe('release tracks persisted keys (canonical write, dual-read)', () => {
  it('import writes the canonical track keys under metadata.tracks and drops the legacy faixas key', async () => {
    const qr = { query: jest.fn().mockResolvedValue(undefined) };
    await writeReleaseTracksForImport(qr as never, 'tenant-1', 'release-1', [
      { trackTitle: 'T', isAlternateVersion: true, versionType: 'live', composers: ['a'], releaseTrackLanguage: 'pt-br', lyrics: 'l', trackArtist: 'X' },
    ]);
    const [sql, params] = qr.query.mock.calls[0];
    expect(sql).toContain(`- 'faixas', '{tracks}'`);
    expect(JSON.parse(params[0])[0]).toEqual({
      title: 'T', isAlternateVersion: true, versionType: 'live', versionCustomName: null, composers: ['a'],
      aiAssistanceLevel: null, instrumental: null, language: 'pt-br', lyrics: 'l', explicit: null, isrc: null, artist: 'X',
    });
  });

  it('export reads canonical tracks and falls back to legacy faixas (rows not yet backfilled)', async () => {
    const ds = {
      query: jest.fn().mockResolvedValue([
        { id: 'new', tracks: [{ title: 'N', composers: ['c'], language: 'en', lyrics: 'x', artist: 'A', isAlternateVersion: false, versionType: null }] },
        { id: 'old', tracks: [{ title: 'O', compositores: ['d'], idioma: 'pt-br', letra: 'y', artista: 'B', isVersionAlternativa: true, tipoVersao: 'remix' }] },
      ]),
    };
    const out = await fetchReleaseTracksForExport(ds as never, 't', ['new', 'old']);
    expect(ds.query.mock.calls[0][0]).toContain(`COALESCE(NULLIF("metadata"->'tracks', 'null'::jsonb), "metadata"->'faixas')`);
    expect(out.get('new')![0]).toMatchObject({ trackTitle: 'N', composers: ['c'], releaseTrackLanguage: 'en', lyrics: 'x', trackArtist: 'A' });
    expect(out.get('old')![0]).toMatchObject({ trackTitle: 'O', composers: ['d'], releaseTrackLanguage: 'pt-br', lyrics: 'y', trackArtist: 'B', isAlternateVersion: true, versionType: 'remix' });
  });
});
