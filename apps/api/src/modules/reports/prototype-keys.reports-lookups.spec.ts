import { getReportFormContract } from './form-contracts/report-form-contracts';
import { resolveEntityLabel } from './i18n/entity-labels.pt-br';

// The entity/table name comes from request parameters: inherited Object members must never resolve.
const PROTOTYPE_KEYS = ['constructor', '__proto__', 'toString', 'hasOwnProperty', 'valueOf'];

describe('reports: own-property lookups of request-supplied entity names', () => {
  it.each(PROTOTYPE_KEYS)('getReportFormContract(%s) is null', (key) => {
    expect(getReportFormContract(key)).toBeNull();
  });
  it.each(PROTOTYPE_KEYS)('resolveEntityLabel(%s) is null', (key) => {
    expect(resolveEntityLabel(key)).toBeNull();
  });
  it('still resolves a real entity', () => {
    expect(getReportFormContract('briefings')).not.toBeNull();
  });
});
