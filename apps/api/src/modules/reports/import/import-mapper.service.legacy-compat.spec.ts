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
