import type { Config } from 'jest';

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': ['ts-jest', {
      tsconfig: '<rootDir>/../tsconfig.json',
      // find-ec0a5729 (Wave 12): real diagnostics were previously downgraded to
      // warnOnly repo-wide, which let real compile errors (missing exports,
      // wrong constructor arity) pass CI silently as confusing runtime
      // failures instead of loud compile failures -- see find-89cba006 and the
      // integrations.oauth-security.spec.ts constructor-arity fix, both only
      // surfaced once this was turned on. The prior audiovisual.dto.spec.ts
      // exclusion (find-9ab67e64) was removed once its 6 missing DTOs were
      // implemented (Wave 13) -- diagnostics are now real repo-wide with no
      // exclusions.
      diagnostics: true,
    }],
  },
  collectCoverageFrom: [
    '**/*.ts',
    '!**/*.module.ts',
    '!**/*.dto.ts',
    '!**/*.decorator.ts',
    '!**/index.ts',
    '!**/main.ts',
    '!**/instrument.ts',
    '!**/*.spec.ts',
  ],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
  // Baseline locked just below the verified CI coverage from 2026-08-05:
  // lines 46.43%, statements 46.23%, functions 39.24%, branches 29.59%.
  // Any meaningful regression now fails CI instead of remaining hidden behind
  // the former 13/12/2/1 thresholds.
  coverageThreshold: {
    global: {
      lines:      45,
      statements: 45,
      functions:  38,
      branches:   28,
    },
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    // Pacote compartilhado de AI Skills (consumido como fonte TS; sem symlink em testes).
    '^@music-os-360/ai-skills$': '<rootDir>/../../../packages/ai-skills/src/index.ts',
    // Mesma razão: @music-os-360/types é consumido por database/entities.ts e ~59
    // outros arquivos; sem este mapeamento, qualquer ambiente sem o symlink do
    // workspace (ex.: node-linker isolado sem link, ou filesystem sem symlink)
    // quebra toda a suíte que importa entities.ts, não só specs de types.
    '^@music-os-360/types$': '<rootDir>/../../../packages/types/src/index.ts',
  },
};

export default config;
