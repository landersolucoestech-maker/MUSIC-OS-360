import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('production bootstrap', () => {
  const bootstrapPath = resolve(__dirname, '../bootstrap.cjs');
  const bootstrap = readFileSync(bootstrapPath, 'utf8');

  it('loads the compiled API entrypoint directly', () => {
    expect(bootstrap).toContain("require('./main.js')");
  });

  it('does not redirect runtime packages to source-only or removed workspaces', () => {
    expect(bootstrap).not.toContain('tsconfig-paths');
    expect(bootstrap).not.toContain('packages/types/src');
    expect(bootstrap).not.toContain('packages/shared-types');
  });
});
