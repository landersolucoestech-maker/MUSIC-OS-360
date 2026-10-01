#!/usr/bin/env node
/**
 * scripts/verify-production-audit.mjs
 *
 * Interprets `pnpm audit --prod --json` against an explicit, auditable waiver
 * list (scripts/dependency-audit-waivers.json). PASS only when every reported
 * advisory has a matching, non-expired waiver. Any advisory without one —
 * new or previously unseen — fails the build. This never suppresses `pnpm
 * audit` itself and never uses `|| true`: the underlying audit always runs
 * for real, this script only decides whether its output is already known
 * and accepted.
 *
 * Usage:
 *   node scripts/verify-production-audit.mjs
 *   node scripts/verify-production-audit.mjs --input <audit.json> --waivers <waivers.json>
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const args = { input: null, waivers: path.join(__dirname, 'dependency-audit-waivers.json') };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--input') args.input = argv[++i];
    if (argv[i] === '--waivers') args.waivers = argv[++i];
  }
  return args;
}

function runPnpmAudit() {
  // Fixed, non-interpolated argument list — shell:true here mirrors
  // scripts/release-check.mjs's convention and carries no injection risk
  // since nothing external is concatenated into the command.
  const result = spawnSync('pnpm', ['audit', '--prod', '--json'], {
    encoding: 'utf8',
    shell: true,
  });
  if (result.error) {
    throw new Error(`Failed to run pnpm audit: ${result.error.message}`);
  }
  // pnpm audit exits non-zero when vulnerabilities are found — that is
  // expected and NOT itself a failure. Only missing/unparseable stdout is.
  const stdout = result.stdout ?? '';
  if (!stdout.trim()) {
    throw new Error(
      `pnpm audit produced no output (exit code ${result.status}). stderr: ${(result.stderr ?? '').slice(0, 2000)}`,
    );
  }
  return stdout;
}

export function loadAuditAdvisories(jsonText) {
  let data;
  try {
    data = JSON.parse(jsonText);
  } catch (err) {
    throw new Error(`pnpm audit output is not valid JSON: ${err.message}`);
  }
  const advisories = data.advisories && typeof data.advisories === 'object' ? data.advisories : {};
  return Object.values(advisories).map((a) => ({
    advisoryId: a.id,
    package: a.module_name,
    severity: a.severity,
    title: a.title,
  }));
}

export function loadWaivers(jsonText) {
  let data;
  try {
    data = JSON.parse(jsonText);
  } catch (err) {
    throw new Error(`Waivers file is not valid JSON: ${err.message}`);
  }
  if (!Array.isArray(data.waivers)) {
    throw new Error('Waivers file must have a "waivers" array.');
  }
  for (const w of data.waivers) {
    for (const field of ['advisoryId', 'package', 'severity', 'reason', 'owner', 'introduced', 'reviewBy', 'closeCondition']) {
      if (w[field] === undefined || w[field] === null || w[field] === '') {
        throw new Error(`Waiver for advisory ${w.advisoryId ?? '?'} is missing the required field "${field}".`);
      }
    }
  }
  return data.waivers;
}

/**
 * @param {ReturnType<typeof loadAuditAdvisories>} advisories
 * @param {ReturnType<typeof loadWaivers>} waivers
 * @param {Date} now
 */
export function evaluate(advisories, waivers, now = new Date()) {
  const today = now.toISOString().slice(0, 10);
  const waiverById = new Map(waivers.map((w) => [w.advisoryId, w]));
  const seenIds = new Set();

  const accepted = [];
  const unauthorized = [];

  for (const advisory of advisories) {
    seenIds.add(advisory.advisoryId);
    const waiver = waiverById.get(advisory.advisoryId);

    if (!waiver) {
      unauthorized.push({ ...advisory, cause: 'no waiver — new/unknown advisory' });
      continue;
    }
    if (waiver.package !== advisory.package) {
      unauthorized.push({
        ...advisory,
        cause: `a waiver exists for this advisoryId but for another package ("${waiver.package}")`,
      });
      continue;
    }
    if (waiver.reviewBy < today) {
      unauthorized.push({ ...advisory, cause: `waiver expired on ${waiver.reviewBy}` });
      continue;
    }
    accepted.push({ ...advisory, waiver });
  }

  const orphaned = waivers.filter((w) => !seenIds.has(w.advisoryId));

  return { accepted, unauthorized, orphaned };
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  const auditJson = args.input ? readFileSync(args.input, 'utf8') : runPnpmAudit();
  const waiversJson = readFileSync(args.waivers, 'utf8');

  const advisories = loadAuditAdvisories(auditJson);
  const waivers = loadWaivers(waiversJson);
  const { accepted, unauthorized, orphaned } = evaluate(advisories, waivers);

  for (const w of orphaned) {
    console.warn(
      `[WARN] orphan waiver: advisory ${w.advisoryId} (${w.package}) no longer appears in pnpm audit — probably already fixed. Consider removing the entry from ${path.basename(args.waivers)}.`,
    );
  }

  if (accepted.length > 0) {
    console.log(`${accepted.length} known advisories accepted temporarily:`);
    for (const a of accepted) {
      console.log(`  [WAIVED] ${a.advisoryId} ${a.package} (${a.severity}) — review by ${a.waiver.reviewBy}, owner ${a.waiver.owner}`);
    }
  }

  if (unauthorized.length > 0) {
    console.error(`${unauthorized.length} unexpected advisories:`);
    for (const a of unauthorized) {
      console.error(`  [FAIL] ${a.advisoryId} ${a.package} (${a.severity}) — ${a.cause}`);
    }
    console.error('\nDependency audit policy FAILED.');
    process.exitCode = 1;
    return;
  }

  console.log(`\n${accepted.length} known advisories accepted temporarily`);
  console.log('0 unexpected advisories');
  console.log('Dependency audit policy PASSED.');
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  main();
}
