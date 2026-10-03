/**
 * The Supabase project refs (one per environment) and the banned refs exist in three places that cannot import each
 * other: the API schema (env.schema.ts, authoritative), the repo-level `pnpm env:check` (scripts/env-check.mjs) and the
 * web build guard (apps/web/scripts/assert-supabase-env.mjs). They are mirrored on purpose; this spec proves they agree,
 * together with the web bypass-flag lists of the two scripts, so a ref change in one place cannot silently drift.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  SUPABASE_DEV_REF,
  SUPABASE_PROD_REF,
  SUPABASE_REF_DENYLIST,
  SUPABASE_STAGING_REF,
} from './env.schema';

const REPO_ROOT = resolve(__dirname, '../../../../..');
const read = (rel: string) => readFileSync(resolve(REPO_ROOT, rel), 'utf8');

const ref = (src: string, name: string): string => {
  const m = src.match(new RegExp(`${name}\\s*=\\s*["']([a-z0-9]{18,22})["']`));
  if (!m) throw new Error(`${name} not found`);
  return m[1];
};
const list = (src: string, name: string): string[] => {
  const m = src.match(new RegExp(`${name}\\s*=\\s*\\[([^\\]]*)\\]`));
  if (!m) throw new Error(`${name} not found`);
  return [...m[1].matchAll(/["']([a-z0-9]{18,22})["']/g)].map((x) => x[1]);
};

describe('Supabase refs: env.schema.ts, scripts/env-check.mjs and the web guard agree', () => {
  const sources = {
    'scripts/env-check.mjs': read('scripts/env-check.mjs'),
    'apps/web/scripts/assert-supabase-env.mjs': read('apps/web/scripts/assert-supabase-env.mjs'),
  };

  it.each(Object.keys(sources))('%s mirrors the three environment refs', (file) => {
    const src = sources[file as keyof typeof sources];
    expect(ref(src, 'SUPABASE_PROD_REF')).toBe(SUPABASE_PROD_REF);
    expect(ref(src, 'SUPABASE_STAGING_REF')).toBe(SUPABASE_STAGING_REF);
    expect(ref(src, 'SUPABASE_DEV_REF')).toBe(SUPABASE_DEV_REF);
  });

  it.each(Object.keys(sources))('%s mirrors the banned refs', (file) => {
    const src = sources[file as keyof typeof sources];
    expect([...list(src, 'SUPABASE_REF_DENYLIST')].sort()).toEqual([...SUPABASE_REF_DENYLIST].sort());
  });

  it('the three environment refs are distinct and none is banned', () => {
    const refs = [SUPABASE_PROD_REF, SUPABASE_STAGING_REF, SUPABASE_DEV_REF];
    expect(new Set(refs).size).toBe(3);
    for (const r of refs) expect(SUPABASE_REF_DENYLIST).not.toContain(r);
  });

  it('the web bypass-flag lists of env:check and the web build guard are the same set', () => {
    const flags = (src: string, anchor: RegExp) => {
      const m = src.match(anchor);
      if (!m) throw new Error('web flag list not found');
      return [...m[1].matchAll(/"(VITE_[A-Z0-9_]+)"/g)].map((x) => x[1]).sort();
    };
    const fromCheck = flags(sources['scripts/env-check.mjs'], /PROD_FORBIDDEN_WEB_BYPASS_FLAGS\s*=\s*\[([^\]]*)\]/);
    const fromGuard = flags(sources['apps/web/scripts/assert-supabase-env.mjs'], /for \(const flag of \[([^\]]*)\]\)/);
    expect(fromGuard).toEqual(fromCheck);
  });
});
