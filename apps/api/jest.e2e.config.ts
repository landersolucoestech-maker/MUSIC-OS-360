import type { Config } from 'jest';

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.*\\.e2e-spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  testEnvironment: 'node',
  testTimeout: 30000,
  // These specs run real INSERT/UPDATE/DELETE against one shared PostgreSQL
  // instance and some rely on fixtures (e.g. a well-known tenant UUID)
  // created by a sibling spec file — parallel workers race against that
  // shared state. Must run sequentially, one file at a time.
  maxWorkers: 1,
  // Fail-closed guard: aborts before any spec if the database target is not
  // authorized for NODE_ENV (test → no remote Supabase).
  setupFiles: ['<rootDir>/test/e2e/e2e-db-guard.ts'],
};

export default config;
