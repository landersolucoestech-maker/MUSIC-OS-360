import { normalizeEmail } from './normalize-email';

describe('normalizeEmail', () => {
  it('converts to lowercase', () => {
    expect(normalizeEmail('Deyvisson@LanderRecords.com')).toBe('deyvisson@landerrecords.com');
  });

  it('trims leading spaces', () => {
    expect(normalizeEmail('  deyvisson@landerrecords.com')).toBe('deyvisson@landerrecords.com');
  });

  it('trims trailing spaces', () => {
    expect(normalizeEmail('deyvisson@landerrecords.com  ')).toBe('deyvisson@landerrecords.com');
  });

  it('mixed-case email with spaces on both ends', () => {
    expect(normalizeEmail('  Deyvisson@LANDERRECORDS.com  ')).toBe('deyvisson@landerrecords.com');
  });

  it('empty input remains empty (format validation is the caller\'s responsibility)', () => {
    expect(normalizeEmail('')).toBe('');
    expect(normalizeEmail('   ')).toBe('');
  });

  it('already normalized input remains identical (idempotent)', () => {
    expect(normalizeEmail('deyvisson@landerrecords.com')).toBe('deyvisson@landerrecords.com');
  });
});
