import { catalogImportViolations } from './import-catalog-rules';

describe('catalogImportViolations: the import applies the invariants of the module services', () => {
  it.each([
    ['a free-text specialty', 'DJ | Guitarrista'],
    ['an unknown canonical value', 'wizard'],
  ])('artists: rejects %s', (_label, specialties) => {
    expect(catalogImportViolations('artists', { specialties })).toEqual([expect.stringContaining('especialidade inválida')]);
  });

  // the import parses a JSON cell before this check runs, so an older export's list arrives as an array
  it.each<[string | string[]]>([['DJ | Compositor/Autor'], ['dj'], ['songwriter'], [['producer', 'performer']]])('artists: accepts %j', (specialties) => {
    expect(catalogImportViolations('artists', { specialties })).toEqual([]);
  });

  it('artists: a blank specialties cell is no violation', () => {
    expect(catalogImportViolations('artists', { specialties: '  ' })).toEqual([]);
  });

  it.each(['T-123.456.789-0', 'T1234567890', 't 123.456.789 0'])('works: accepts the ISWC %s', (iswc) => {
    expect(catalogImportViolations('works', { iswc })).toEqual([]);
  });

  it.each(['123', 'T-12', 'XX1234567890', 'T-123.456.789-0-1'])('works: rejects the ISWC %s', (iswc) => {
    expect(catalogImportViolations('works', { iswc })).toEqual([expect.stringContaining('ISWC inválido')]);
  });

  it('works: an empty ISWC is not a violation', () => {
    expect(catalogImportViolations('works', { iswc: '' })).toEqual([]);
  });

  it('shares: a row with both a work and a phonogram is rejected, one of them is fine', () => {
    expect(catalogImportViolations('shares', { work_id: 'w', phonogram_id: 'p', percentage: 10 })).toEqual([expect.stringContaining('única estrutura')]);
    expect(catalogImportViolations('shares', { work_id: 'w', percentage: 10 })).toEqual([]);
    expect(catalogImportViolations('shares', { phonogram_id: 'p', percentage: 10 })).toEqual([]);
  });

  it.each(['-1', '100,01', '101', 'abc'])('shares: rejects the percentage %s', (percentage) => {
    expect(catalogImportViolations('shares', { work_id: 'w', percentage })).toEqual([expect.stringContaining('percentual inválido')]);
  });

  it.each(['0', '33,33', '100', 50])('shares: accepts the percentage %s', (percentage) => {
    expect(catalogImportViolations('shares', { work_id: 'w', percentage })).toEqual([]);
  });

  it('other tables are untouched', () => {
    expect(catalogImportViolations('events', { iswc: 'garbage', specialties: 'x', percentage: 900, work_id: 'w', phonogram_id: 'p' })).toEqual([]);
  });
});
