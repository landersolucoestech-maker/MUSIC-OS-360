#!/usr/bin/env node
/**
 * scripts/verify-staging-secrets-presence.mjs
 *
 * Confirms which canonical staging secrets exist in the GitHub `staging`
 * Environment — presence only, never a value. Uses `gh secret list`, whose
 * own output already never includes values (GitHub's API doesn't expose
 * secret values at all, by design). Run locally (requires `gh auth login`)
 * or as a CI step with a token that has repo admin/environment read access.
 *
 * Usage:
 *   node scripts/verify-staging-secrets-presence.mjs
 *   node scripts/verify-staging-secrets-presence.mjs --repo owner/name
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Canonical names this project's code actually reads for staging (see
// docs/STAGING_ARCHITECTURE.md's variable matrix and staging.yml).
export const REQUIRED_STAGING_SECRETS = [
  'STAGING_DATABASE_URL',
  'STAGING_APP_DATABASE_URL',
  'STAGING_API_URL',
  'STAGING_DEPLOY_WEBHOOK_URL',
  'STAGING_ENCRYPTION_KEY',
  'STAGING_SUPABASE_URL',
  'STAGING_SUPABASE_ANON_KEY',
  'STAGING_SUPABASE_SERVICE_ROLE_KEY',
];

export const OPTIONAL_STAGING_SECRETS = [
  'STAGING_SMOKE_TOKEN',
  'STAGING_SMOKE_TENANT',
];

export function evaluatePresence(existingNames) {
  const existing = new Set(existingNames);
  const required = REQUIRED_STAGING_SECRETS.map((name) => ({ name, present: existing.has(name) }));
  const optional = OPTIONAL_STAGING_SECRETS.map((name) => ({ name, present: existing.has(name) }));
  const missingRequired = required.filter((r) => !r.present).map((r) => r.name);
  return { required, optional, ok: missingRequired.length === 0, missingRequired };
}

function parseArgs(argv) {
  const args = { repo: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--repo') args.repo = argv[++i];
  }
  return args;
}

function listSecretNames(repo) {
  const cmdArgs = ['secret', 'list', '--env', 'staging', '--json', 'name'];
  if (repo) cmdArgs.push('--repo', repo);
  const result = spawnSync('gh', cmdArgs, { encoding: 'utf8' });
  if (result.error) {
    throw new Error(`Failed to run gh secret list: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(`gh secret list exited with code ${result.status}: ${result.stderr}`);
  }
  const parsed = JSON.parse(result.stdout || '[]');
  return parsed.map((entry) => entry.name);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const existingNames = listSecretNames(args.repo);
  const { required, optional, ok, missingRequired } = evaluatePresence(existingNames);

  console.log('=== Secrets of the GitHub Environment "staging" — presence only, never values ===\n');
  console.log('Required:');
  for (const { name, present } of required) {
    console.log(`  ${present ? '✓' : '✗'}  ${name}`);
  }
  console.log('\nOpcionais:');
  for (const { name, present } of optional) {
    console.log(`  ${present ? '✓' : '·'}  ${name}`);
  }

  if (!ok) {
    console.error(`\nFALTANDO: ${missingRequired.join(', ')}`);
    process.exitCode = 1;
    return;
  }
  console.log('\nAll required staging secrets are present.');
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  main();
}
