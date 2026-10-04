import { ImportMapperService } from './import-mapper.service';
import type { ReportEntityDefinition } from '../definitions/report-entity-definition.types';

const def = (tableName: string, importableColumns: string[]) => ({ tableName, importableColumns } as unknown as ReportEntityDefinition);

describe('legacy spreadsheet headers (legacy in, canonical out)', () => {
  const mapper = new ImportMapperService();

  it.each([
    ['letristas', 'translator_names'],
    ['Letristas', 'translator_names'],
    ['Criada por IA', 'ai_used'],
    ['Outros títulos', 'alternative_titles'],
    ['Letra completa', 'lyrics'],
  ])('works header "%s" maps to %s', (header, column) => {
    const { mapping, unknownColumns } = mapper.build(
      def('works', ['title', 'translator_names', 'ai_used', 'alternative_titles', 'lyrics']),
      [header],
    );
    expect(mapping[header]).toBe(column);
    expect(unknownColumns).toEqual([]);
  });

  it('the legacy header is unknown on another entity and when its canonical target is not importable', () => {
    expect(mapper.build(def('releases', ['title']), ['letristas']).unknownColumns).toEqual(['letristas']);
    expect(mapper.build(def('works', ['title']), ['letristas']).unknownColumns).toEqual(['letristas']);
  });
});

/**
 * The mapper resolves a header through the exact column name, then the PT-BR label, then the camelCase key, and only then the legacy
 * table. Several legacy headers ('nome', 'letra', 'artista', 'compositores') are ALSO the PT-BR label of their canonical column, and
 * 'letristas' is also declared in the shared WORK_DEPRECATED_FIELDS table, so the real lookups could hide a dropped legacy entry.
 * Here the label lookup is neutralised and the shared work table emptied: each legacy header must then be carried by the mapper's
 * OWN legacy table (explicit static expectations, not derived from the table under test).
 */
describe('legacy spreadsheet headers are carried by the mapper\'s own table (label lookup and shared table neutralised)', () => {
  type MapperCtor = new () => { build: (d: ReportEntityDefinition, h: string[]) => { mapping: Record<string, string | null>; unknownColumns: string[] } };
  let Mapper: MapperCtor;

  beforeAll(() => {
    jest.isolateModules(() => {
      jest.doMock('../i18n/field-labels.pt-br', () => ({
        ...jest.requireActual('../i18n/field-labels.pt-br'),
        getFieldLabelPtBr: (column: string) => `label:${column}`,
      }));
      jest.doMock('../../works/work-legacy-fields', () => ({ WORK_DEPRECATED_FIELDS: {} }));
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      Mapper = (require('./import-mapper.service') as { ImportMapperService: MapperCtor }).ImportMapperService;
    });
  });

  afterAll(() => {
    jest.dontMock('../i18n/field-labels.pt-br');
    jest.dontMock('../../works/work-legacy-fields');
  });

  const RELEASE_HEADERS: ReadonlyArray<[string, string]> = [
    ['variosArtistas', 'variousArtists'],
    ['generoSecundario', 'secondaryGenre'],
    ['copyrightDataLancamento', 'copyrightReleaseYear'],
    ['copyrightDataGravacao', 'copyrightRecordingYear'],
    ['artistasAdicionaisAlbum', 'additionalAlbumArtists'],
    ['nome', 'trackTitle'],
    ['isVersionAlternativa', 'isAlternateVersion'],
    ['tipoVersao', 'versionType'],
    ['compositores', 'composers'],
    ['faixa_idioma', 'releaseTrackLanguage'],
    ['letra', 'lyrics'],
    ['artista', 'trackArtist'],
  ];
  const RELEASE_COLUMNS = RELEASE_HEADERS.map(([, canonical]) => canonical);

  it.each(RELEASE_HEADERS)('releases header "%s" maps to %s', (header, column) => {
    const { mapping, unknownColumns } = new Mapper().build(def('releases', RELEASE_COLUMNS), [header]);
    expect(mapping[header]).toBe(column);
    expect(unknownColumns).toEqual([]);
  });

  it('works header "letristas" maps to translator_names', () => {
    const { mapping, unknownColumns } = new Mapper().build(def('works', ['title', 'translator_names']), ['letristas']);
    expect(mapping['letristas']).toBe('translator_names');
    expect(unknownColumns).toEqual([]);
  });

  it('a release legacy header stays unknown when its canonical column is not importable', () => {
    for (const [header] of RELEASE_HEADERS) {
      expect(new Mapper().build(def('releases', ['title']), [header]).unknownColumns).toEqual([header]);
    }
  });

  it('an importable column named exactly like the legacy header wins over the legacy target', () => {
    const { mapping } = new Mapper().build(def('releases', ['nome', 'trackTitle']), ['nome']);
    expect(mapping['nome']).toBe('nome');
  });
});
