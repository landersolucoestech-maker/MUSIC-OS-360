#!/usr/bin/env node
/**
 * scripts/verify-staging-deploy-order.mjs
 *
 * Regression guard for DB-M2 (database review of bc40b76): staging.yml used to
 * run db:migrate while the previous build kept serving, and the in-place
 * column renames of the technical-language migrations broke every query of that
 * build until the deploy finished. The fixed order is documented in
 * docs/engineering/database.md ("Deploy order"); this guard fails CI when the
 * workflow drifts from it:
 *   - every run reads the schema/build state first (db-ops check:state) and a
 *     build older than the database is refused;
 *   - a schema change (migrate or rollback) requires the stop hook, stops the
 *     running build and proves it is down BEFORE touching the schema;
 *   - db:migrate / db:rollback run nowhere else in the workflow;
 *   - the deploy never runs after a rollback and proves the new build is up;
 *   - a running deploy is never cancelled.
 *
 * Text-based (js-yaml is not a dependency — see verify-db-verify-gate-wiring.mjs).
 *
 * Usage: node scripts/verify-staging-deploy-order.mjs
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { extractJobBlock } from './verify-db-verify-gate-wiring.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STAGING_YML = path.resolve(__dirname, '..', '.github', 'workflows', 'staging.yml');

/** Index of the first line of `block` matching `pattern` (-1 when absent). */
function lineOf(block, pattern) {
  return block.split('\n').findIndex((line) => pattern.test(line));
}

/** The text of the step (list item) containing line `index`. */
function stepAt(block, index) {
  const lines = block.split('\n');
  let start = index;
  while (start > 0 && !/^ {6}- /.test(lines[start])) start -= 1;
  let end = index + 1;
  while (end < lines.length && !/^ {6}- /.test(lines[end])) end += 1;
  return lines.slice(start, end).join('\n');
}

export function checkStagingDeployOrder(source) {
  const reasons = [];
  if (!/cancel-in-progress:\s*false/.test(source)) {
    reasons.push('concurrency.cancel-in-progress must be false — a cancelled deploy can leave the build stopped mid-migration');
  }

  const schema = extractJobBlock(source, 'migrations-staging');
  if (schema == null) return { ok: false, reasons: [...reasons, 'jobs.migrations-staging not found — did the job get renamed?'] };

  const state = lineOf(schema, /db-ops\.ts check:state/);
  const plan = lineOf(schema, /id:\s*plan\b/);
  const stop = lineOf(schema, /curl .*"\$STAGING_STOP_WEBHOOK_URL"/);
  const down = lineOf(schema, /wait-for-http-state\.mjs .*--until down/);
  const migrate = lineOf(schema, /run:\s*pnpm --filter @music-os-360\/api db:migrate\s*$/);
  const rollback = lineOf(schema, /db-ops\.ts rollback:to/);

  if (state === -1) reasons.push('the schema state (db-ops check:state) is not read before acting');
  if (plan === -1) reasons.push('the "plan" step deciding the schema change is missing');
  if (stop === -1) reasons.push('no step stops the running build through STAGING_STOP_WEBHOOK_URL');
  if (down === -1) reasons.push('no step proves the running build is down (wait-for-http-state --until down)');
  if (migrate === -1) reasons.push('db:migrate step not found in migrations-staging');
  if (rollback === -1) reasons.push('db-ops rollback:to step not found in migrations-staging');
  if ([state, plan, stop, down, migrate, rollback].every((i) => i !== -1)) {
    if (!(state < plan && plan < stop && stop < down && down < migrate && down < rollback)) {
      reasons.push('order must be: check:state -> plan -> stop hook -> prove down -> db:migrate / rollback:to');
    }
    if (!/if:\s*steps\.plan\.outputs\.change == 'migrate'/.test(stepAt(schema, migrate))) {
      reasons.push("db:migrate must run only when steps.plan.outputs.change == 'migrate'");
    }
    if (!/if:\s*steps\.plan\.outputs\.change == 'rollback'/.test(stepAt(schema, rollback))) {
      reasons.push("rollback:to must run only when steps.plan.outputs.change == 'rollback'");
    }
    for (const [name, index] of [['stop', stop], ['prove down', down]]) {
      if (!/if:\s*steps\.plan\.outputs\.change != 'none'/.test(stepAt(schema, index))) {
        reasons.push(`the ${name} step must run for every schema change (steps.plan.outputs.change != 'none')`);
      }
    }
    const planStep = stepAt(schema, plan);
    if (!/UNKNOWN_APPLIED" != "0"[\s\S]*exit 1/.test(planStep)) {
      reasons.push('the plan must refuse a build older than the database (unknown_applied != 0)');
    }
    if (!/test -n "\$STAGING_STOP_WEBHOOK_URL" \|\|[^\n]*exit 1/.test(planStep)) {
      reasons.push('the plan must fail closed when STAGING_STOP_WEBHOOK_URL is missing');
    }
  }

  const outsideSchema = source.replace(schema, '');
  if (/db:migrate\b|db:rollback\b|rollback:to\b/.test(outsideSchema.replace(/^\s*#.*$/gm, ''))) {
    reasons.push('db:migrate / db:rollback must run only in migrations-staging (after the stop gate)');
  }

  const deploy = extractJobBlock(source, 'deploy-staging');
  if (deploy == null) {
    reasons.push('jobs.deploy-staging not found — did the job get renamed?');
  } else {
    if (!/needs:\s*\[migrations-staging\]/.test(deploy)) reasons.push('deploy-staging must need migrations-staging');
    if (!/if:.*needs\.migrations-staging\.outputs\.rollback != 'true'/.test(deploy)) {
      reasons.push('deploy-staging must not run after a rollback (the newer build would serve an older schema)');
    }
    const hook = lineOf(deploy, /curl .*"\$STAGING_DEPLOY_WEBHOOK_URL"/);
    const up = lineOf(deploy, /wait-for-http-state\.mjs .*--until up/);
    if (hook === -1 || up === -1 || up < hook) reasons.push('deploy-staging must prove the deployed build is up after the deploy hook');
  }
  return { ok: reasons.length === 0, reasons };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = checkStagingDeployOrder(readFileSync(STAGING_YML, 'utf8'));
  if (!result.ok) {
    console.error('❌ verify-staging-deploy-order FAILED (DB-M2):');
    for (const reason of result.reasons) console.error(`  • ${reason}`);
    process.exit(1);
  }
  console.log('✓ verify-staging-deploy-order — no build serves while the staging schema changes.');
}
