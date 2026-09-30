import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { verifyTopology } from './verify-branch-topology.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFileSync(path.join(root, file), 'utf8');

const real = () => ({
  ci: read('.github/workflows/ci.yml'),
  security: read('.github/workflows/security.yml'),
  staging: read('.github/workflows/staging.yml'),
  runbook: read('docs/runbooks/staging-to-production.md'),
});

test('the repository workflows and runbook satisfy the dev-only policy', () => {
  assert.deepEqual(verifyTopology(real()), []);
});

test('a workflow that targets staging or main is rejected', () => {
  const inputs = real();
  inputs.ci = inputs.ci.replace('branches: [dev]', 'branches: [dev, staging, main]');
  const errors = verifyTopology(inputs);
  assert.ok(errors.some((e) => e.includes('"staging"')));
  assert.ok(errors.some((e) => e.includes('"main"')));
});

test('staging.yml running on push is rejected', () => {
  const inputs = real();
  inputs.staging = inputs.staging.replace('on:\n  workflow_dispatch:', 'on:\n  push:\n    branches: [staging]\n  workflow_dispatch:');
  const errors = verifyTopology(inputs);
  assert.ok(errors.some((e) => e.includes('must not run on push')));
  assert.ok(errors.some((e) => e.includes('branch filters')));
});

test('a staging deploy guarded by refs/heads/staging is rejected', () => {
  const inputs = real();
  inputs.staging = inputs.staging.replace("github.ref == 'refs/heads/dev'", "github.ref == 'refs/heads/staging'");
  const errors = verifyTopology(inputs);
  assert.ok(errors.some((e) => e.includes('refs/heads/staging')));
});

test('a release job keyed to main is rejected', () => {
  const inputs = real();
  inputs.security += "\n    if: github.ref == 'refs/heads/main'\n";
  assert.ok(verifyTopology(inputs).some((e) => e.includes('refs/heads/main')));
});

test('a runbook that describes dev -> staging -> main is rejected', () => {
  const inputs = real();
  inputs.runbook += '\n```text\ndev -> staging -> main\n```\n';
  assert.ok(verifyTopology(inputs).some((e) => e.includes('must not describe')));
});

test('a runbook without the dev-only statement is rejected', () => {
  const inputs = real();
  inputs.runbook = inputs.runbook.replace(/dev is the only branch/gi, 'x');
  assert.ok(verifyTopology(inputs).some((e) => e.includes('dev is the only branch')));
});

test('the normalization workflow never commits, pushes or triggers on commit messages', () => {
  const workflow = read('.github/workflows/technical-english-normalization.yml');
  assert.ok(!/git push/.test(workflow));
  assert.ok(!/git commit/.test(workflow));
  assert.ok(!/head_commit\.message/.test(workflow));
  assert.ok(!/^\s*push:/m.test(workflow));
  assert.match(workflow, /contents: read/);
  assert.ok(!/contents: write/.test(workflow));
});
