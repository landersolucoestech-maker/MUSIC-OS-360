import { financialRuleLabel } from './notification.handler';

/**
 * find-9e7bc94e: a notificação de regra financeira é o único efeito de uma
 * regra disparada; ela precisa exibir o valor calculado e deixar explícito
 * que nenhum lançamento foi criado (antes o valor era descartado e o texto
 * sugeria uma consequência financeira inexistente).
 */
describe('financialRuleLabel', () => {
  it('inclui o valor calculado em BRL e declara que nenhum lançamento foi criado', () => {
    const label = financialRuleLabel({ ruleName: 'Multa 2%', result: { computed: 1234.5 } });
    expect(label).toMatch(/Multa 2%/);
    expect(label).toMatch(/R\$\s?1\.234,50/);
    expect(label).toMatch(/nenhum lançamento foi criado/);
  });

  it('sem valor calculado numérico, não inventa valor', () => {
    expect(financialRuleLabel({ ruleName: 'X', result: {} })).toBe('Regra financeira disparada: X');
  });
});
