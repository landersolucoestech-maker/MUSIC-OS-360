import { canonicalImportValue } from './import-value-canonicalizers';

/**
 * The reports import writes rows with its own INSERT (import-commit.service),
 * so a spreadsheet exported before CZ-032..CZ-038 must still land with the
 * canonical persisted values (CZ-037 review, finding M3).
 */
describe('canonicalImportValue', () => {
  it.each([
    ['shares', 'status', 'enviado', 'sent'],
    ['shares', 'direction', 'a_receber', 'receivable'],
    ['shares', 'type', 'compositor', 'composer'],
    ['shares', 'party_role', 'autor', 'author'],
    ['releases', 'type', 'compilacao', 'compilation'],
    ['takedowns', 'type', 'recebido', 'received'],
    ['takedowns', 'priority', 'alta', 'high'],
    ['licenses', 'status', 'ativa', 'active'],
    ['licenses', 'territory', 'mundial', 'worldwide'],
    ['inventory_items', 'status', 'disponivel', 'available'],
  ])('%s.%s: %s -> %s', (table, column, legacy, canonical) => {
    expect(canonicalImportValue(table, column, legacy)).toBe(canonical);
  });

  it('leaves canonical values, other columns, other tables and non-strings untouched', () => {
    expect(canonicalImportValue('shares', 'status', 'sent')).toBe('sent');
    expect(canonicalImportValue('shares', 'holder', 'autor')).toBe('autor');
    expect(canonicalImportValue('works', 'type', 'compilacao')).toBe('compilacao');
    expect(canonicalImportValue('shares', 'status', null)).toBeNull();
  });
});
