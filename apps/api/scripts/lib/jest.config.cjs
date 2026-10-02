// Jest config for apps/api/scripts/lib specs (the default config has rootDir=src).
// Run: pnpm --filter @music-os-360/api exec jest --config scripts/lib/jest.config.cjs
module.exports = {
  rootDir: '.',
  testRegex: '.*\\.spec\\.ts$',
  moduleFileExtensions: ['js', 'json', 'ts'],
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/../../tsconfig.json', diagnostics: true }] },
  testEnvironment: 'node',
};
