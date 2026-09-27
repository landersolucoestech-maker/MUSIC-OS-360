import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';

/**
 * Structural regression: the tenant-zero identity (Blocks 6/7 of Part 69)
 * must not leak into RLS, RBAC, guards or services as a special case.
 * Only the constants module itself, the bootstrap and the tests are allowed
 * to reference the canonical symbols — any other file that
 * imports them is, by definition, an attempt to compare against tenant-zero
 * (`if (tenantId === TENANT_ZERO_TENANT_ID)`), exactly the pattern forbidden
 * by the absolute rules of Part 69.
 */
const SRC_ROOT = join(__dirname, '..');

const ALLOWED_FILES = new Set([
  'database/tenant-zero.constants.ts',
  'database/tenant-zero.constants.spec.ts',
  'database/tenant-zero-formalization.migration.spec.ts',
  'database/tenant-zero-no-special-case.spec.ts',
  'database/bootstrap-tenant-zero.ts',
  'database/bootstrap-tenant-zero.cli.ts',
  'database/bootstrap-tenant-zero.spec.ts',
]);

const SYMBOLS = [
  'TENANT_ZERO_ORG_ID',
  'TENANT_ZERO_TENANT_ID',
  'TENANT_ZERO_SYNTHETIC_OWNER_AUTH_USER_ID',
];

function listTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'dist') continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...listTsFiles(full));
    } else if (/\.tsx?$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

describe('tenant-zero: no RLS/RBAC/billing/guard special case', () => {
  it('tenant-zero canonical IDs appear only in the authorized files', () => {
    const offenders: string[] = [];

    for (const file of listTsFiles(SRC_ROOT)) {
      const relPath = relative(SRC_ROOT, file).replace(/\\/g, '/');
      if (ALLOWED_FILES.has(relPath)) continue;

      const content = readFileSync(file, 'utf8');
      for (const symbol of SYMBOLS) {
        if (content.includes(symbol)) {
          offenders.push(`${relPath} referencia ${symbol}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it('no policy/guard/service uses is_system_tenant to authorize (only the bootstrap writes/reads this column)', () => {
    const offenders: string[] = [];

    for (const file of listTsFiles(SRC_ROOT)) {
      const relPath = relative(SRC_ROOT, file).replace(/\\/g, '/');
      if (relPath.startsWith('database/migrations/20260801000002')) continue;
      if (ALLOWED_FILES.has(relPath)) continue;
      if (relPath === 'database/entities.ts') continue; // only the column definition

      const content = readFileSync(file, 'utf8');
      if (content.includes('is_system_tenant')) {
        offenders.push(relPath);
      }
    }

    expect(offenders).toEqual([]);
  });
});
