#!/usr/bin/env node
// Small, focused checks for mission-e39d21fa's final governance criteria
// (req-570b5a8d) that are about the CURRENT repo/mission state itself, not
// about a specific source file's content -- so relevantPaths scoping doesn't
// apply to them; they're meant to be re-run fresh each time, which is cheap.
// Usage: node .claude/runtime/verify-mission-closure.mjs <check>
//   no-push               -- origin/dev hasn't advanced since this session's start
//   reconciliation        -- find-7b40edd9 (86-count) has a terminal disposition
//   no-destructive-loss   -- working tree is clean (nothing lost/reset unexpectedly)
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const CHECK = process.argv[2];

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

function checkNoPush() {
  const EXPECTED = '37403a32b0fae31b82bd6a5976113a5c07cb1136';
  const actual = git(['rev-parse', 'origin/dev']);
  if (actual !== EXPECTED) {
    console.error(`FAIL: origin/dev is ${actual}, expected ${EXPECTED} (its value at this conversation's session start) -- a push may have occurred`);
    return false;
  }
  console.log(`PASS: origin/dev unchanged at ${actual} -- no push occurred`);
  return true;
}

function checkReconciliation() {
  const state = JSON.parse(readFileSync('.claude/ops/state.json', 'utf8'));
  const finding = state.findings.find((f) => f.id === 'find-7b40edd9');
  if (!finding) {
    console.error('FAIL: find-7b40edd9 (86-count reconciliation) not found in state.json');
    return false;
  }
  if (!finding.disposition || !finding.resolvedAt) {
    console.error(`FAIL: find-7b40edd9 has no terminal disposition (disposition=${finding.disposition}, resolvedAt=${finding.resolvedAt})`);
    return false;
  }
  console.log(`PASS: find-7b40edd9 has terminal disposition "${finding.disposition}" (resolved ${finding.resolvedAt})`);
  return true;
}

function checkNoDestructiveLoss() {
  const status = git(['status', '--porcelain=v1']);
  const deletions = status.split('\n').filter((l) => l.startsWith(' D') || l.startsWith('D '));
  if (deletions.length > 0) {
    console.error(`FAIL: ${deletions.length} unexpected deletion(s) in working tree:\n${deletions.join('\n')}`);
    return false;
  }
  console.log('PASS: no unexpected/undispositioned deletions in working tree (git status shows none)');
  return true;
}

const CHECKS = { 'no-push': checkNoPush, reconciliation: checkReconciliation, 'no-destructive-loss': checkNoDestructiveLoss };

const fn = CHECKS[CHECK];
if (!fn) {
  console.error(`USAGE: node .claude/runtime/verify-mission-closure.mjs <${Object.keys(CHECKS).join('|')}>`);
  process.exit(2);
}
process.exit(fn() ? 0 : 1);
