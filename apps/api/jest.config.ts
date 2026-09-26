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
    // Shared AI Skills package (consumed as TS source; no symlink in tests).
    '^@music-os-360/ai-skills$': '<rootDir>/../../../packages/ai-skills/src/index.ts',
    // Same reason: @music-os-360/types is consumed by database/entities.ts and ~59
    // other files; without this mapping, any environment without the workspace
    // symlink (e.g. an isolated node-linker without a link, or a filesystem without symlinks)
    // breaks every suite that imports entities.ts, not only the types specs.
    '^@music-os-360/types$': '<rootDir>/../../../packages/types/src/index.ts',
  },
};

export default config;
