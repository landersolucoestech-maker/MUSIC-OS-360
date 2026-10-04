import { ImportMapperService } from './import-mapper.service';
import type { ReportEntityDefinition } from '../definitions/report-entity-definition.types';

const def = (tableName: string, importableColumns: string[]) =>
  ({ tableName, importableColumns } as unknown as ReportEntityDefinition);

describe('ImportMapperService — headers of spreadsheets exported before CZ-039/CZ-040', () => {
  const mapper = new ImportMapperService();

  it('maps the pre-rename works labels and technical names to the canonical columns', () => {
    const { mapping, unknownColumns } = mapper.build(
      def('works', ['title', 'ai_used', 'alternative_titles', 'lyrics', 'translator_names', 'society_code']),
      ['Título', 'Criada por IA', 'Outros títulos', 'Letra completa', 'Letristas', 'cod_entidade'],
    );
    expect(mapping['Criada por IA']).toBe('ai_used');
    expect(mapping['Outros títulos']).toBe('alternative_titles');
    expect(mapping['Letra completa']).toBe('lyrics');
    expect(mapping['Letristas']).toBe('translator_names');
    expect(mapping['cod_entidade']).toBe('society_code');
    expect(unknownColumns).toEqual([]);
  });

  it('maps the pre-rename phonogram labels; a legacy header whose target is not importable stays unknown', () => {
    const { mapping, unknownColumns } = mapper.build(
      def('phonograms', ['title', 'recording_date', 'country_of_recording']),
      ['Gravação original', 'País de origem', 'Duração (minutos)'],
    );
    expect(mapping['Gravação original']).toBe('recording_date');
    expect(mapping['País de origem']).toBe('country_of_recording');
    expect(unknownColumns).toEqual(['Duração (minutos)']);
  });

  it('never maps a legacy header of one entity onto another entity', () => {
    const { unknownColumns } = mapper.build(def('releases', ['title', 'lyrics']), ['Letra completa']);
    expect(unknownColumns).toEqual(['Letra completa']);
  });

  it('maps the pre-CT-D4 artist header "Seguidores no SoundCloud (link)" to the follower count', () => {
    const { mapping, unknownColumns } = mapper.build(
      def('artists', ['stage_name', 'soundcloud_followers']),
      ['Seguidores no SoundCloud (link)'],
    );
    expect(mapping['Seguidores no SoundCloud (link)']).toBe('soundcloud_followers');
    expect(unknownColumns).toEqual([]);
  });
});

/**
 * Legacy wiring of normalizeFieldKey in the mapper: header spellings of older exports/scripts
 * (kebab-case, PascalCase, camelCase) are resolved to the snake_case columns, and tenant_id "in any form"
 * is ignored (multi-tenant security: never importable, never reported as a mappable column).
 */
describe('ImportMapperService — header spelling normalization (legacy wiring)', () => {
  const mapper = new ImportMapperService();

  it.each([
    ['artist-id', 'artist_id'],
    ['Artist-Id', 'artist_id'],
    ['artistId', 'artist_id'],
    ['ArtistId', 'artist_id'],
    ['release-date', 'release_date'],
    ['releaseDate', 'release_date'],
    ['ReleaseDate', 'release_date'],
  ])('header %p maps to the snake_case column %p', (header, column) => {
    const { mapping, unknownColumns } = mapper.build(def('works', ['title', 'artist_id', 'release_date']), [header]);
    expect(mapping[header]).toBe(column);
    expect(unknownColumns).toEqual([]);
  });

  it.each(['tenant-id', 'Tenant-Id', 'tenantId', 'TenantId', 'tenant_id', 'Tenant_Id', 'TENANT_ID', 'tenant', 'TENANT'])(
    'tenant header %p is ignored and reported, never mapped (even when a column named tenant_id were importable)',
    (header) => {
      const { mapping, unknownColumns, ignoredColumns } = mapper.build(def('works', ['title', 'tenant_id']), [header]);
      expect(mapping[header]).toBeNull();
      expect(ignoredColumns).toEqual([header]);
      expect(unknownColumns).toEqual([]);
    },
  );

  it('a tenant header does not hide the other headers of the same file', () => {
    const { mapping, ignoredColumns, unknownColumns } = mapper.build(
      def('works', ['title', 'artist_id']),
      ['Tenant-Id', 'artist-id', 'title', 'bogus'],
    );
    expect(ignoredColumns).toEqual(['Tenant-Id']);
    expect(mapping['artist-id']).toBe('artist_id');
    expect(mapping['title']).toBe('title');
    expect(unknownColumns).toEqual(['bogus']);
  });
});
