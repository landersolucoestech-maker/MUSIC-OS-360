import { matchCategoryRule, normalizeMatchText, type MatchableCategoryRule } from './finance-category-matcher.util';

function rule(overrides: Partial<MatchableCategoryRule> & Pick<MatchableCategoryRule, 'id' | 'keywords'>): MatchableCategoryRule {
  return {
    transaction_type: 'DESPESA',
    priority: 100,
    active: true,
    ...overrides,
  };
}

describe('normalizeMatchText', () => {
  it('strips accents, lowercases and collapses whitespace', () => {
    expect(normalizeMatchText('  Pagamento SPOTIFY   Assinatura  ')).toBe('pagamento spotify assinatura');
    expect(normalizeMatchText('São Paulo — Café')).toBe('sao paulo — cafe');
  });
});

describe('matchCategoryRule — match simples', () => {
  it('finds a rule whose keyword appears in the description', () => {
    const rules = [rule({ id: 'r1', keywords: ['spotify'] })];
    const result = matchCategoryRule(rules, { descricao: 'Pagamento Spotify mensal', transactionType: 'DESPESA' });
    expect(result?.id).toBe('r1');
  });

  it('returns null when no keyword matches', () => {
    const rules = [rule({ id: 'r1', keywords: ['spotify'] })];
    const result = matchCategoryRule(rules, { descricao: 'Aluguel do escritório', transactionType: 'DESPESA' });
    expect(result).toBeNull();
  });

  it('returns null for an empty description', () => {
    const rules = [rule({ id: 'r1', keywords: ['spotify'] })];
    expect(matchCategoryRule(rules, { descricao: '', transactionType: 'DESPESA' })).toBeNull();
  });
});

describe('matchCategoryRule — multiple keywords', () => {
  it('matches if ANY keyword of the rule appears in the description', () => {
    const rules = [rule({ id: 'r1', keywords: ['netflix', 'spotify', 'deezer'] })];
    expect(matchCategoryRule(rules, { descricao: 'Assinatura Deezer Premium', transactionType: 'DESPESA' })?.id).toBe('r1');
  });
});

describe('matchCategoryRule — priority', () => {
  it('prefers the rule with the lower priority number when more than one matches', () => {
    const rules = [
      rule({ id: 'generic', keywords: ['show'], priority: 200 }),
      rule({ id: 'specific', keywords: ['show'], priority: 10 }),
    ];
    // Both match — the priority-10 one must win IF it is already ordered
    // first in the received list (contract: caller sorts by priority ASC).
    const ordered = [...rules].sort((a, b) => a.priority - b.priority);
    expect(matchCategoryRule(ordered, { descricao: 'Show ao vivo', transactionType: 'DESPESA' })?.id).toBe('specific');
  });

  it('on a priority tie, the first item in the received list wins (stable order)', () => {
    const rules = [
      rule({ id: 'first', keywords: ['aluguel'], priority: 50 }),
      rule({ id: 'second', keywords: ['aluguel'], priority: 50 }),
    ];
    expect(matchCategoryRule(rules, { descricao: 'Pagamento aluguel estúdio', transactionType: 'DESPESA' })?.id).toBe('first');
  });
});

describe('matchCategoryRule — inactive rule', () => {
  it('never matches an inactive rule, even with a matching keyword', () => {
    const rules = [rule({ id: 'inactive', keywords: ['spotify'], active: false })];
    expect(matchCategoryRule(rules, { descricao: 'Pagamento Spotify', transactionType: 'DESPESA' })).toBeNull();
  });

  it('ignores the inactive rule and falls through to the next active one that also matches', () => {
    const rules = [
      rule({ id: 'inactive', keywords: ['spotify'], active: false, priority: 1 }),
      rule({ id: 'active', keywords: ['spotify'], active: true, priority: 999 }),
    ];
    expect(matchCategoryRule(rules, { descricao: 'Pagamento Spotify', transactionType: 'DESPESA' })?.id).toBe('active');
  });
});

describe('matchCategoryRule — transaction_type', () => {
  it('never matches a rule with a different transaction type', () => {
    const rules = [rule({ id: 'r1', keywords: ['spotify'], transaction_type: 'RECEITA' })];
    expect(matchCategoryRule(rules, { descricao: 'Pagamento Spotify', transactionType: 'DESPESA' })).toBeNull();
  });
});
