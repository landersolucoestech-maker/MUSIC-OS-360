import { ImportValidationService } from './import-validation.service';
import { EntityCategory } from '../entity-metadata.types';
import type { ReportEntityDefinition } from '../definitions/report-entity-definition.types';

/**
 * Identity repetition: an entity whose contract declares a repeating group (projects -> tracks) legitimately repeats
 * the parent identity on every child row; a plain entity (artists) reports the repeated identity as a duplicate.
 */
const base = {
  category: EntityCategory.REPORTABLE, dateColumn: 'created_at',
  filterableColumns: [], sortableColumns: [], searchableColumns: [], sensitiveColumns: [],
  supportsExport: true, supportsImport: true,
};
const PROJECTS: ReportEntityDefinition = {
  ...base, entityName: 'ProjectEntity', tableName: 'projects',
  identityColumn: 'projectTitle', displayColumn: 'projectTitle',
  exportableColumns: ['projectTitle', 'trackName'], importableColumns: ['projectTitle', 'trackName'],
  requiredImportColumns: ['projectTitle'],
};
const ARTISTS: ReportEntityDefinition = {
  ...base, entityName: 'ArtistEntity', tableName: 'artists',
  identityColumn: 'stage_name', displayColumn: 'stage_name',
  exportableColumns: ['stage_name'], importableColumns: ['stage_name'], requiredImportColumns: ['stage_name'],
};

const DUPLICATE = 'registro duplicado no arquivo';

describe('ImportValidationService — repeated identity rows', () => {
  const svc = new ImportValidationService();

  it('projects (repeating group): consecutive track rows of the same project are NOT duplicates', () => {
    const result = svc.validate(
      PROJECTS, {},
      { mapping: { Projeto: 'projectTitle', Faixa: 'trackName' }, unknownColumns: [], ignoredColumns: [] },
      [{ Projeto: 'Meu EP', Faixa: 'Faixa 1' }, { Projeto: 'Meu EP', Faixa: 'Faixa 2' }, { Projeto: 'meu ep', Faixa: 'Faixa 3' }],
      'projects',
    );
    expect(result.validRows).toBe(3);
    for (const row of result.rows) expect(row.warnings.map((w) => w.message)).not.toContain(DUPLICATE);
  });

  it('artists (no repeating group): the repeated identity is flagged on the second occurrence only (case-insensitive)', () => {
    const result = svc.validate(
      ARTISTS, {},
      { mapping: { Nome: 'stage_name' }, unknownColumns: [], ignoredColumns: [] },
      [{ Nome: 'Ana' }, { Nome: 'ana' }, { Nome: 'Bia' }],
      'artists',
    );
    expect(result.rows[0].warnings).toEqual([]);
    expect(result.rows[1].warnings).toEqual([{ column: 'stage_name', message: DUPLICATE }]);
    expect(result.rows[2].warnings).toEqual([]);
  });
});
