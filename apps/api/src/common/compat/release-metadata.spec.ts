import { canonicalizeReleaseMetadata, canonicalReleaseMetadata, renameKeys } from './release-metadata';

const legacy = {
  automation: { checklist: [1, 2] },
  variosArtistas: true,
  generoSecundario: 'Samba',
  copyrightDataLancamento: '2024',
  copyrightDataGravacao: '2023',
  artistasAdicionaisAlbum: [{ nome: 'Fulana', role: 'Featuring' }],
  territory: 'world',
  faixas: [
    {
      id: 1, title: 'Letra de Amor', artista: 'X', isrc: 'BRABC2400001',
      isVersionAlternativa: true, tipoVersao: 'remix', versionCustomName: 'v2',
      artistasAdicionais: [{ nome: 'A', role: 'DJ' }], produtores: [{ nome: 'P', role: 'Producer' }],
      compositores: ['C1', 'C2'], musicos: [{ nome: 'M', instrumento: 'guitar' }],
      aiAssistanceLevel: 'none', instrumental: false, idioma: 'pt-br', letra: 'olá mundo', explicit: 'no',
    },
  ],
};

describe('canonicalizeReleaseMetadata', () => {
  it('renames every legacy key (top level, tracks, credit entries) and preserves every other key and every value', () => {
    const { value, renamed, conflicts } = canonicalizeReleaseMetadata(legacy);
    expect(conflicts).toBe(0);
    expect(renamed).toBe(6 + 9 + 5);
    expect(value).toEqual({
      automation: { checklist: [1, 2] },
      variousArtists: true,
      secondaryGenre: 'Samba',
      copyrightReleaseYear: '2024',
      copyrightRecordingYear: '2023',
      additionalAlbumArtists: [{ name: 'Fulana', role: 'Featuring' }],
      territory: 'world',
      tracks: [
        {
          id: 1, title: 'Letra de Amor', artist: 'X', isrc: 'BRABC2400001',
          isAlternateVersion: true, versionType: 'remix', versionCustomName: 'v2',
          additionalArtists: [{ name: 'A', role: 'DJ' }], producers: [{ name: 'P', role: 'Producer' }],
          composers: ['C1', 'C2'], musicians: [{ name: 'M', instrument: 'guitar' }],
          aiAssistanceLevel: 'none', instrumental: false, language: 'pt-br', lyrics: 'olá mundo', explicit: 'no',
        },
      ],
    });
  });

  it('does not mutate the input and is idempotent on canonical metadata', () => {
    const snapshot = JSON.parse(JSON.stringify(legacy));
    const once = canonicalizeReleaseMetadata(legacy);
    expect(legacy).toEqual(snapshot);
    const twice = canonicalizeReleaseMetadata(once.value);
    expect(twice.value).toEqual(once.value);
    expect(twice.renamed).toBe(0);
  });

  it('canonical wins when both spellings are present, and the conflict is counted', () => {
    const { value, conflicts } = canonicalizeReleaseMetadata({
      variosArtistas: true, variousArtists: false,
      faixas: [{ title: 'a' }], tracks: [{ title: 'b' }],
    });
    expect(conflicts).toBe(2);
    expect(value).toEqual({ variousArtists: false, tracks: [{ title: 'b' }] });
  });

  it('keeps user content untouched (a track titled with a legacy key name is a value, not a key)', () => {
    const { value } = canonicalizeReleaseMetadata({ faixas: [{ title: 'faixas', letra: 'compositores: nome' }] });
    expect(value).toEqual({ tracks: [{ title: 'faixas', lyrics: 'compositores: nome' }] });
  });

  it('tolerates non-object input and malformed shapes', () => {
    expect(canonicalReleaseMetadata(null)).toBeNull();
    expect(canonicalReleaseMetadata(undefined)).toBeUndefined();
    expect(canonicalReleaseMetadata('x')).toBe('x');
    expect(canonicalReleaseMetadata({ faixas: 'oops', artistasAdicionaisAlbum: null })).toEqual({ tracks: 'oops', additionalAlbumArtists: null });
    expect(canonicalReleaseMetadata({ faixas: [null, 3, { produtores: ['a', 'b'] }] })).toEqual({ tracks: [null, 3, { producers: ['a', 'b'] }] });
  });

  it('never copies an own __proto__ key onto the result', () => {
    const polluted = JSON.parse('{"__proto__":{"x":1},"faixas":[]}');
    const out = canonicalReleaseMetadata(polluted) as Record<string, unknown>;
    expect(Object.getPrototypeOf(out)).toBe(Object.prototype);
    expect(({} as Record<string, unknown>)['x']).toBeUndefined();
    expect(out).toEqual({ tracks: [] });
  });
});

describe('renameKeys', () => {
  it('reports the renamed and conflicting counts', () => {
    expect(renameKeys({ a: 1, b: 2, c: 3 }, { a: 'b', c: 'd' })).toEqual({ value: { b: 2, d: 3 }, renamed: 2, conflicts: 1 });
  });
});

describe('renameKeys (SEC2 L1)', () => {
  it('keeps keys named like Object.prototype members', () => {
    const input = JSON.parse('{"faixas":[],"constructor":{"a":1},"toString":"t","valueOf":2}');
    const { value } = renameKeys(input, { faixas: 'tracks' });
    expect(value).toEqual({ tracks: [], constructor: { a: 1 }, toString: 't', valueOf: 2 });
  });
});
