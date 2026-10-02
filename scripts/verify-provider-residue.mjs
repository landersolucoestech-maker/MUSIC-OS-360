#!/usr/bin/env node
/**
 * Provider-residue guard. The project owner forbids any ACTIVE coupling to
 * three hosting/auth providers. This scans every tracked text file and fails
 * on any occurrence outside a small, validated allowlist of immutable
 * history.
 *
 * Detection (case-insensitive):
 *   1. the provider names themselves;
 *   2. provider-specific identifiers (VERCEL_*, @clerk/, clerk_*_id, ...);
 *   3. split-string evasions: quotes, `+`, commas, brackets, template
 *      scaffolding and `.join('')` are collapsed before re-testing, so
 *      `['cl','erk']` or `'ver' + 'cel'` are still caught.
 *
 * The allowlist is itself validated: a listed file that no longer exists or
 * no longer contains a match fails the run, so it cannot rot into a blanket
 * exemption.
 *
 * Provider names are assembled from fragments below so this file does not
 * trip its own scan (it is also allowlisted, together with its test).
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const WORDS = [['rep', 'lit'], ['ver', 'cel'], ['cl', 'erk']].map((parts) => parts.join(''));
const DIRECT = new RegExp(WORDS.join('|'), 'i');
const IDENTIFIERS = [
  /VERCEL_[A-Z0-9_]+/,
  /@clerk\//i,
  /clerk_(user|org)_id/i,
  /REPLIT_[A-Z0-9_]+/,
];
const SCAFFOLDING = /["'`+,\[\]\s]|\$\{[^}]*\}|\.join\(\s*(["'`]{2})?\s*\)/g;

/** Immutable history and the guard itself. Each entry needs a reason. */
export const ALLOWLIST = [
  {
    match: (file) => file === 'apps/api/src/database/migrations/20260520000004_SupabaseAuthColumnNames.ts',
    label: 'apps/api/src/database/migrations/20260520000004_SupabaseAuthColumnNames.ts',
    reason: 'applied migration; the split names are the legacy column names it renames',
  },
  {
    match: (file) => file === 'apps/api/src/database/migrations/20260801000001_RealtimeBroadcastAuthorization.ts',
    label: 'apps/api/src/database/migrations/20260801000001_RealtimeBroadcastAuthorization.ts',
    reason: 'applied migration; historical comment, immutable by convention',
  },
  {
    match: (file) => file.startsWith('docs/backend-v2/'),
    label: 'docs/backend-v2/**',
    reason: 'historical decision records for a superseded, never-built design',
  },
  {
    match: (file) => file.startsWith('docs/product-tasks/'),
    label: 'docs/product-tasks/**',
    reason: 'historical task records',
  },
  {
    match: (file) => file === 'scripts/verify-provider-residue.mjs' || file === 'scripts/verify-provider-residue.test.mjs',
    label: 'scripts/verify-provider-residue.{mjs,test.mjs}',
    reason: 'the guard and its test necessarily name the providers',
  },
];

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', '.turbo', 'graphify-out']);
const SKIP_FILES = new Set(['pnpm-lock.yaml']);
const TEXT_EXT = /\.(?:[cm]?[jt]sx?|json|ya?ml|toml|md|mdx|sql|sh|env|example|html|css|txt|conf|dockerfile)$/i;

/** Returns true when the text contains a provider reference (direct, identifier or split). */
export function hasProviderReference(text) {
  if (DIRECT.test(text)) return true;
  if (IDENTIFIERS.some((re) => re.test(text))) return true;
  return text.split('\n').some((line) => DIRECT.test(line.replace(SCAFFOLDING, '')));
}

function listFiles(root) {
  try {
    const out = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] });
    return out.split('\0').filter(Boolean);
  } catch {
    const files = [];
    const walk = (dir) => {
      for (const name of readdirSync(dir)) {
        if (SKIP_DIRS.has(name)) continue;
        const full = path.join(dir, name);
        if (statSync(full).isDirectory()) walk(full);
        else files.push(path.relative(root, full).split(path.sep).join('/'));
      }
    };
    walk(root);
    return files;
  }
}

function isScannable(file) {
  const base = path.posix.basename(file);
  if (SKIP_FILES.has(base)) return false;
  if (file.split('/').some((part) => SKIP_DIRS.has(part))) return false;
  return TEXT_EXT.test(base) || /^\.env/.test(base) || base === 'Dockerfile' || /^docker-compose/.test(base);
}

export function scan(root = REPO_ROOT) {
  const violations = [];
  const allowlistHits = new Map(ALLOWLIST.map((entry) => [entry.label, 0]));
  const nameHits = [];

  for (const file of listFiles(root)) {
    const base = path.posix.basename(file);
    if (DIRECT.test(base)) nameHits.push(file);
    if (!isScannable(file)) continue;
    const abs = path.join(root, file);
    if (!existsSync(abs)) continue;
    let text;
    try {
      text = readFileSync(abs, 'utf8');
    } catch {
      continue;
    }
    if (!hasProviderReference(text)) continue;
    const entry = ALLOWLIST.find((candidate) => candidate.match(file));
    if (entry) allowlistHits.set(entry.label, allowlistHits.get(entry.label) + 1);
    else violations.push(file);
  }

  const staleAllowlist = [...allowlistHits].filter(([, count]) => count === 0).map(([label]) => label);
  return { violations, nameHits, staleAllowlist };
}

function main() {
  const { violations, nameHits, staleAllowlist } = scan();
  const errors = [];
  for (const file of violations) errors.push(`${file}: references a forbidden provider (Replit, Vercel or Clerk)`);
  for (const file of nameHits) errors.push(`${file}: file name references a forbidden provider`);
  for (const label of staleAllowlist) errors.push(`allowlist entry no longer matches any file (remove it): ${label}`);

  if (errors.length > 0) {
    console.error('[verify-provider-residue] FAIL');
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }
  console.log('[verify-provider-residue] PASS — no active provider coupling; allowlist validated.');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
