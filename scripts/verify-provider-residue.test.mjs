import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import { ALLOWLIST, hasProviderReference, scan } from './verify-provider-residue.mjs';

// Provider names are assembled from fragments so this file never contains
// them literally (it is also allowlisted in the guard).
const VERCEL = ['ver', 'cel'].join('');
const CLERK = ['cl', 'erk'].join('');
const REPLIT = ['rep', 'lit'].join('');

function fixture(files) {
  const root = mkdtempSync(path.join(tmpdir(), 'provider-residue-'));
  for (const [file, content] of Object.entries(files)) {
    const abs = path.join(root, file);
    mkdirSync(path.dirname(abs), { recursive: true });
    writeFileSync(abs, content);
  }
  return root;
}

// A fixture that satisfies every allowlist entry, so only the case under test can fail.
function allowlistedBaseline() {
  const contents = `// legacy ${CLERK}\n`;
  return {
    'apps/api/src/database/migrations/20260520000004_SupabaseAuthColumnNames.ts': contents,
    'apps/api/src/database/migrations/20260801000001_RealtimeBroadcastAuthorization.ts': contents,
    'apps/api/migrations-complete.sql': contents,
    'docs/backend-v2/61.md': contents,
    'docs/product-tasks/task-1.md': contents,
    'scripts/verify-provider-residue.mjs': contents,
  };
}

test('a clean tree passes with a fully matched allowlist', () => {
  const root = fixture({ ...allowlistedBaseline(), 'apps/web/src/a.ts': 'export const a = 1;\n' });
  const result = scan(root);
  assert.deepEqual(result.violations, []);
  assert.deepEqual(result.staleAllowlist, []);
});

for (const [name, word] of [['Vercel', VERCEL], ['Clerk', CLERK], ['Replit', REPLIT]]) {
  test(`a direct ${name} reference outside the allowlist fails`, () => {
    const root = fixture({ ...allowlistedBaseline(), 'apps/web/src/a.ts': `// uses ${word}\n` });
    assert.deepEqual(scan(root).violations, ['apps/web/src/a.ts']);
  });
}

test('split-string evasions are detected', () => {
  assert.equal(hasProviderReference(`const n = ['${CLERK.slice(0, 2)}','${CLERK.slice(2)}'].join('');`), true);
  assert.equal(hasProviderReference(`const n = '${VERCEL.slice(0, 3)}' + '${VERCEL.slice(3)}';`), true);
  assert.equal(hasProviderReference('const n = `${a}${b}`;'), false);
});

test('provider identifiers are detected', () => {
  assert.equal(hasProviderReference(`process.env.${VERCEL.toUpperCase()}_GIT_COMMIT_SHA`), true);
  assert.equal(hasProviderReference(`import x from '@${CLERK}/backend';`), true);
  assert.equal(hasProviderReference(`${CLERK}_user_id`), true);
});

test('unrelated code is not flagged', () => {
  assert.equal(hasProviderReference("const status = 'pending';"), false);
  assert.equal(hasProviderReference('SUPABASE_URL and BUILD_SHA'), false);
});

test('the same content inside an allowlisted path passes', () => {
  const root = fixture(allowlistedBaseline());
  assert.deepEqual(scan(root).violations, []);
});

test('a stale allowlist entry fails', () => {
  const files = allowlistedBaseline();
  delete files['apps/api/migrations-complete.sql'];
  const result = scan(fixture(files));
  assert.deepEqual(result.staleAllowlist, ['apps/api/migrations-complete.sql']);
});

test('a provider name in a file name fails', () => {
  const root = fixture({ ...allowlistedBaseline(), [`${VERCEL}.json`]: '{}' });
  assert.deepEqual(scan(root).nameHits, [`${VERCEL}.json`]);
});

test('every allowlist entry documents a reason', () => {
  for (const entry of ALLOWLIST) assert.ok(entry.reason.length > 10, entry.label);
});
