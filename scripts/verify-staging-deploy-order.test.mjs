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
  assert.match(checkStagingDeployOrder(mutate('--until up --expect-build "$GITHUB_SHA"', '--until up')).reasons.join('\n'), /prove the deployed build is up/);
  assert.match(checkStagingDeployOrder(mutate('cancel-in-progress: false', 'cancel-in-progress: true')).reasons.join('\n'), /cancel-in-progress/);
});

test('a db:migrate outside the gated job fails', () => {
  const r = checkStagingDeployOrder(mutate('      - run: pnpm build\n', '      - run: pnpm build\n      - run: pnpm --filter @music-os-360/api db:migrate\n'));
  assert.match(r.reasons.join('\n'), /only in migrations-staging/);
});

test('stopping without the pre-flight, without proving the probe reaches the build, or with a raw base URL fails (re-review M1/M3)', () => {
  assert.match(checkStagingDeployOrder(mutate('scripts/db-ops.ts preflight "$CHANGE"', 'scripts/db-ops.ts check:state')).reasons.join('\n'), /pre-flight/);
  assert.match(checkStagingDeployOrder(mutate('--until up --consecutive 1', '--until down --consecutive 1')).reasons.join('\n'), /reaches the running build/);
  assert.match(checkStagingDeployOrder(mutate('--url "$API_BASE/api/v1/health/live" --until down', '--url "$STAGING_API_URL/api/v1/health/live" --until down')).reasons.join('\n'), /normalized base URL/);
});

test('a deploy hook without this commit, or a rollback without its typed confirmation, fails (re-review M2 / security LOW-D)', () => {
  assert.match(checkStagingDeployOrder(mutate('--data "{\\"ref\\":\\"$GITHUB_SHA\\"}" ', '')).reasons.join('\n'), /send this commit/);
  assert.match(checkStagingDeployOrder(mutate('[ "$CONFIRM_ROLLBACK_TO" = "$ROLLBACK_TO_MIGRATION" ] ||', 'true ||')).reasons.join('\n'), /typed confirmation/);
});
