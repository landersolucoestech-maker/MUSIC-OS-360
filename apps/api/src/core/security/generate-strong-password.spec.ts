import { generateStrongPassword } from './generate-strong-password';

describe('generateStrongPassword', () => {
  it('generates at least 28 characters by default', () => {
    expect(generateStrongPassword().length).toBeGreaterThanOrEqual(28);
  });

  it('rejects length < 28', () => {
    expect(() => generateStrongPassword(20)).toThrow(/>= 28/);
  });

  it('contains at least one character from each required class', () => {
    for (let i = 0; i < 50; i++) {
      const pw = generateStrongPassword();
      expect(pw).toMatch(/[a-z]/);
      expect(pw).toMatch(/[A-Z]/);
      expect(pw).toMatch(/[0-9]/);
      expect(pw).toMatch(/[!@#$%&*+\-=?_]/);
    }
  });

  it('never repeats the same password across calls (high entropy, non-deterministic)', () => {
    const passwords = new Set(Array.from({ length: 100 }, () => generateStrongPassword()));
    expect(passwords.size).toBe(100);
  });

  it('never contains ambiguous characters (l, O, 0, 1) that hinder manual reading/typing', () => {
    for (let i = 0; i < 50; i++) {
      const pw = generateStrongPassword();
      expect(pw).not.toMatch(/[lO01]/);
    }
  });

  it('never contains quotes, backticks, backslashes, spaces, parentheses, brackets or braces (Part 75 — prone to copy/paste errors)', () => {
    for (let i = 0; i < 50; i++) {
      const pw = generateStrongPassword();
      expect(pw).not.toMatch(/["'`\\\s()[\]{}^]/);
    }
  });

  it('does not reference the project, user, UUID or date — it is purely random', () => {
    const pw = generateStrongPassword();
    expect(pw.toLowerCase()).not.toContain('music');
    expect(pw.toLowerCase()).not.toContain('lander');
    expect(pw).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(pw).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  });

  it('respects a custom length greater than the minimum', () => {
    expect(generateStrongPassword(40).length).toBe(40);
  });
});
