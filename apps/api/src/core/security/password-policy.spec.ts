import { MIN_USER_PASSWORD_LENGTH, strongPasswordViolations } from './password-policy';

describe('strongPasswordViolations', () => {
  it('empty password accumulates all violations', () => {
    const violations = strongPasswordViolations('');
    expect(violations.length).toBe(5);
  });

  it('strong password has no violations', () => {
    expect(strongPasswordViolations('Correto-Cavalo9Bateria!')).toEqual([]);
  });

  it('rejects short password even with all character classes', () => {
    const violations = strongPasswordViolations('Ab1!Ab1!');
    expect(violations).toContain(`mínimo de ${MIN_USER_PASSWORD_LENGTH} caracteres`);
  });

  it('rejects password with only lowercase letters', () => {
    const violations = strongPasswordViolations('abcdefghijklmnop');
    expect(violations).toContain('ao menos uma letra maiúscula');
    expect(violations).toContain('ao menos um número');
    expect(violations).toContain('ao menos um símbolo');
  });

  it('rejects password without symbol', () => {
    expect(strongPasswordViolations('Abcdefghijkl9')).toContain('ao menos um símbolo');
  });
});
