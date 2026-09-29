import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { checkStagingDeployOrder } from './verify-staging-deploy-order.mjs';

const real = readFileSync(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '.github', 'workflows', 'staging.yml'), 'utf8',
);
const mutate = (from, to) => {
  assert.ok(real.includes(from), `fixture drifted: ${from}`);
  return real.replace(from, to);
};

test('the committed staging.yml passes', () => {
  assert.deepEqual(checkStagingDeployOrder(real), { ok: true, reasons: [] });
});

test('migrating before the build is proven down fails', () => {
  const migrateStep = "      - name: db:migrate staging (build stopped, explicit authorization)\n        if: steps.plan.outputs.change == 'migrate'\n        run: pnpm --filter @music-os-360/api db:migrate\n\n";
  const withoutMigrate = mutate(migrateStep, '');
  const early = withoutMigrate.replace('      - name: Stop the running staging build', `${migrateStep}      - name: Stop the running staging build`);
  assert.match(checkStagingDeployOrder(early).reasons.join('\n'), /order must be/);
});

test('an unconditional db:migrate fails', () => {
  const r = checkStagingDeployOrder(mutate("if: steps.plan.outputs.change == 'migrate'", "if: always()"));
  assert.match(r.reasons.join('\n'), /db:migrate must run only when/);
});

test('a missing stop hook guard or a missing older-build refusal fails', () => {
  assert.match(checkStagingDeployOrder(mutate('test -n "$STAGING_STOP_WEBHOOK_URL" ||', 'true ||')).reasons.join('\n'), /fail closed/);
  assert.match(checkStagingDeployOrder(mutate('if [ "$UNKNOWN_APPLIED" != "0" ]; then', 'if false; then')).reasons.join('\n'), /older than the database/);
});

test('deploying after a rollback, skipping the up probe, or cancelling in progress fails', () => {
  assert.match(checkStagingDeployOrder(mutate(" && needs.migrations-staging.outputs.rollback != 'true'", '')).reasons.join('\n'), /not run after a rollback/);
  assert.match(checkStagingDeployOrder(mutate('--until up', '--until down')).reasons.join('\n'), /prove the deployed build is up/);
  assert.match(checkStagingDeployOrder(mutate('cancel-in-progress: false', 'cancel-in-progress: true')).reasons.join('\n'), /cancel-in-progress/);
});

test('a db:migrate outside the gated job fails', () => {
  const r = checkStagingDeployOrder(mutate('      - run: pnpm build\n', '      - run: pnpm build\n      - run: pnpm --filter @music-os-360/api db:migrate\n'));
  assert.match(r.reasons.join('\n'), /only in migrations-staging/);
});
