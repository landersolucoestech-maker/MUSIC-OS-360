import { financialRuleLabel } from './notification.handler';

/**
 * find-9e7bc94e: the financial rule notification is the only effect of a
 * triggered rule; it needs to display the calculated value and make it
 * explicit that no entry was created (previously the value was discarded
 * and the text suggested a nonexistent financial consequence).
 */
describe('financialRuleLabel', () => {
  it('includes the calculated value in BRL and states that no entry was created', () => {
    const label = financialRuleLabel({ ruleName: 'Multa 2%', result: { computed: 1234.5 } });
    expect(label).toMatch(/Multa 2%/);
    expect(label).toMatch(/R\$\s?1\.234,50/);
    expect(label).toMatch(/nenhum lançamento foi criado/);
  });

  it('without a numeric calculated value, does not invent one', () => {
    expect(financialRuleLabel({ ruleName: 'X', result: {} })).toBe('Regra financeira disparada: X');
  });
});
