import test from 'node:test';
import assert from 'node:assert/strict';
import { loadAuditAdvisories, loadWaivers, evaluate } from './verify-production-audit.mjs';

// All fixtures below are synthetic — no real advisory IDs, no network access.
const NOW = new Date('2026-08-01T00:00:00Z');

function auditWith(advisories) {
  const obj = {};
  for (const a of advisories) {
    obj[String(a.advisoryId)] = { id: a.advisoryId, module_name: a.package, severity: a.severity, title: a.title ?? 'synthetic' };
  }
  return JSON.stringify({ advisories: obj });
}

function waiverFileWith(waivers) {
  return JSON.stringify({
    waivers: waivers.map((w) => ({
      advisoryId: w.advisoryId,
      package: w.package,
      severity: w.severity ?? 'moderate',
      reason: w.reason ?? 'synthetic reason',
      owner: w.owner ?? 'test@example.com',
      introduced: w.introduced ?? '2026-01-01',
      reviewBy: w.reviewBy ?? '2099-01-01',
      closeCondition: w.closeCondition ?? 'synthetic close condition',
    })),
  });
}

test('baseline exactly permitted -> PASS (0 unauthorized)', () => {
  const advisories = loadAuditAdvisories(auditWith([{ advisoryId: 1, package: 'foo', severity: 'moderate' }]));
  const waivers = loadWaivers(waiverFileWith([{ advisoryId: 1, package: 'foo' }]));
  const { accepted, unauthorized, orphaned } = evaluate(advisories, waivers, NOW);
  assert.equal(accepted.length, 1);
  assert.equal(unauthorized.length, 0);
  assert.equal(orphaned.length, 0);
});

test('new advisory without a waiver -> FAIL', () => {
  const advisories = loadAuditAdvisories(auditWith([{ advisoryId: 2, package: 'bar', severity: 'moderate' }]));
  const waivers = loadWaivers(waiverFileWith([]));
  const { unauthorized } = evaluate(advisories, waivers, NOW);
  assert.equal(unauthorized.length, 1);
  assert.match(unauthorized[0].cause, /no waiver/);
});

test('new HIGH advisory without a waiver -> FAIL (severity does not exempt from waiver)', () => {
  const advisories = loadAuditAdvisories(auditWith([{ advisoryId: 3, package: 'baz', severity: 'high' }]));
  const waivers = loadWaivers(waiverFileWith([]));
  const { unauthorized } = evaluate(advisories, waivers, NOW);
  assert.equal(unauthorized.length, 1);
  assert.equal(unauthorized[0].severity, 'high');
});

test('expired waiver -> FAIL', () => {
  const advisories = loadAuditAdvisories(auditWith([{ advisoryId: 4, package: 'qux', severity: 'moderate' }]));
  const waivers = loadWaivers(waiverFileWith([{ advisoryId: 4, package: 'qux', reviewBy: '2025-01-01' }]));
  const { unauthorized } = evaluate(advisories, waivers, NOW);
  assert.equal(unauthorized.length, 1);
  assert.match(unauthorized[0].cause, /expired/);
});

test('waiver with wrong package -> FAIL', () => {
  const advisories = loadAuditAdvisories(auditWith([{ advisoryId: 5, package: 'real-pkg', severity: 'moderate' }]));
  const waivers = loadWaivers(waiverFileWith([{ advisoryId: 5, package: 'different-pkg' }]));
  const { unauthorized } = evaluate(advisories, waivers, NOW);
  assert.equal(unauthorized.length, 1);
  assert.match(unauthorized[0].cause, /another package/);
});

test('resolved advisory but leftover waiver -> reported as orphaned, does not fail the build', () => {
  const advisories = loadAuditAdvisories(auditWith([]));
  const waivers = loadWaivers(waiverFileWith([{ advisoryId: 6, package: 'fixed-pkg' }]));
  const { unauthorized, orphaned } = evaluate(advisories, waivers, NOW);
  assert.equal(unauthorized.length, 0);
  assert.equal(orphaned.length, 1);
  assert.equal(orphaned[0].advisoryId, 6);
});

test('invalid JSON in the audit -> throws an error (fails the process)', () => {
  assert.throws(() => loadAuditAdvisories('{ not valid json'), /is not valid JSON/);
});

test('invalid JSON in the waivers file -> throws an error (fails the process)', () => {
  assert.throws(() => loadWaivers('{ not valid json'), /is not valid JSON/);
});

test('waiver missing a required field -> throws an error', () => {
  const bad = JSON.stringify({ waivers: [{ advisoryId: 7, package: 'x' }] });
  assert.throws(() => loadWaivers(bad), /required field/);
});

test('pnpm audit with no usable output (e.g., the process failed) -> treated as invalid input', () => {
  assert.throws(() => loadAuditAdvisories(''), /is not valid JSON/);
});

test('mixed advisories: accepted + unauthorized are reported separately', () => {
  const advisories = loadAuditAdvisories(
    auditWith([
      { advisoryId: 8, package: 'ok-pkg', severity: 'moderate' },
      { advisoryId: 9, package: 'bad-pkg', severity: 'high' },
    ]),
  );
  const waivers = loadWaivers(waiverFileWith([{ advisoryId: 8, package: 'ok-pkg' }]));
  const { accepted, unauthorized } = evaluate(advisories, waivers, NOW);
  assert.equal(accepted.length, 1);
  assert.equal(unauthorized.length, 1);
  assert.equal(unauthorized[0].advisoryId, 9);
});
