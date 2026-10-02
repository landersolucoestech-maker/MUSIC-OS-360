import { resolveDeprecatedImportHeader } from './deprecated-import-headers';
import { isWritableKey } from '../../../core/security/safe-object';

describe('resolveDeprecatedImportHeader', () => {
  it('maps the em dash duration headers to the current labels, which are writable keys', () => {
    expect(resolveDeprecatedImportHeader('Duração — Minutos')).toBe('Duração (minutos)');
    expect(resolveDeprecatedImportHeader(' duração – segundos ')).toBe('Duração (segundos)');
    expect(isWritableKey('Duração — Minutos')).toBe(false);
    expect(isWritableKey(resolveDeprecatedImportHeader('Duração — Minutos'))).toBe(true);
  });

  it('leaves every other header unchanged, including unsafe ones', () => {
    expect(resolveDeprecatedImportHeader('Nome da música')).toBe('Nome da música');
    expect(resolveDeprecatedImportHeader('__proto__')).toBe('__proto__');
    expect(resolveDeprecatedImportHeader('Outro — Cabeçalho')).toBe('Outro — Cabeçalho');
  });
});
