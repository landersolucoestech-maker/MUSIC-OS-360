/**
 * PROD_FORBIDDEN_BYPASS_FLAGS (env.schema.ts) is the single source of the flags that must
 * never be 'true' in staging/production. Runtime code reuses the constant; the repo-level
 * scripts that cannot import TypeScript are checked here so they cannot silently drift.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PROD_FORBIDDEN_BYPASS_FLAGS } from './env.schema';

const REPO_ROOT = resolve(__dirname, '../../../../..');
const read = (rel: string) => readFileSync(resolve(REPO_ROOT, rel), 'utf8');

function extractArray(src: string, name: string): string[] {
  const m = src.match(new RegExp(`const ${name}\\s*=\\s*\\[([\\s\\S]*?)\\];`));
  if (!m) throw new Error(`${name} not found`);
  return [...m[1].matchAll(/"([A-Z0-9_]+)"/g)].map((x) => x[1]);
}

describe('bypass-flag single source agreement', () => {
  it('scripts/env-check.mjs api list equals PROD_FORBIDDEN_BYPASS_FLAGS', () => {
    const list = extractArray(read('scripts/env-check.mjs'), 'PROD_FORBIDDEN_API_BYPASS_FLAGS');
    expect([...list].sort()).toEqual([...PROD_FORBIDDEN_BYPASS_FLAGS].sort());
  });

  it('scripts/verify-production-flags.ts reuses the shared collector (no private flag list)', () => {
    const src = read('apps/api/scripts/verify-production-flags.ts');
    expect(src).toContain('collectProductionBypassFlagErrors');
    for (const flag of PROD_FORBIDDEN_BYPASS_FLAGS) expect(src).not.toMatch(new RegExp(`['"]${flag}['"]`));
  });

  it('create-app.ts and security-startup.service.ts reuse the constant and keep no literal list', () => {
    for (const rel of ['apps/api/src/create-app.ts', 'apps/api/src/core/security/security-startup.service.ts']) {
      const src = read(rel);
      expect(src).toContain('PROD_FORBIDDEN_BYPASS_FLAGS');
      expect(src).not.toMatch(/['"]MOCK_MODE['"]|['"]VITE_MOCK_MODE['"]/);
    }
  });

  it('web guards forbid the same frontend bypass flags', () => {
    const envCheck = extractArray(read('scripts/env-check.mjs'), 'PROD_FORBIDDEN_WEB_BYPASS_FLAGS');
    const assertWeb = read('apps/web/scripts/assert-supabase-env.mjs');
    for (const flag of envCheck) expect(assertWeb).toContain(`"${flag}"`);
    // live flags first, then the removed (inert) names whose stale "true" must still fail a prod-like build
    expect(envCheck).toEqual(['VITE_AUTH_DISABLED', 'VITE_DEV_AUTH_BYPASS', 'VITE_DISABLE_AUTH', 'VITE_USE_MOCK', 'VITE_MOCK_MODE']);
  });
});
