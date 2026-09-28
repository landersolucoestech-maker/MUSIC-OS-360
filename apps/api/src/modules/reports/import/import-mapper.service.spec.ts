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
