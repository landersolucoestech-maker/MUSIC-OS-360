#!/usr/bin/env node
// One-time governance data repair: backfill the `head` field (git commit SHA at
// recording time) onto EvidenceRecords created before this field existed.
// Never touches status/verdict/command/summary -- only adds a provenance field
// derived from an already-true historical fact, so gate-engine.mjs's scoped
// freshness check (pathsChangedSince) can work for historical evidence too, not
// just evidence recorded going forward.
//
// Correlation source: `git reflog`, NOT `git log`. git log's default traversal
// is topological, not strictly chronological by commit date -- this repo has a
// real case where HEAD sat at one commit for ~4 days while unrelated-looking
// commits with EARLIER author/committer dates were later fast-forwarded past it
// (a long uncommitted-working-tree period followed by a batched commit run),
// which makes "find the newest commit with date <= target" over git log's
// output pick the WRONG commit. git reflog instead records the actual sequence
// of values HEAD held over real wall-clock time in THIS repo -- exactly the
// question "what was HEAD when this evidence was recorded" needs answered.
// Reflog is local-only and can expire/be absent (e.g. a shallow CI checkout);
// this script fails closed (skips, does not guess) when it can't find a
// covering entry, rather than falling back to an unreliable log-order guess.
//
// Usage: node .claude/runtime/backfill-evidence-head.mjs [--apply]
// Without --apply, prints what WOULD change (dry run) and writes nothing.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const REPO_ROOT = process.cwd();
const EVIDENCE_DIR = join(REPO_ROOT, '.claude', 'ops', 'evidence');
const APPLY = process.argv.includes('--apply');

const REFLOG_LINE_RE = /^([0-9a-f]+)\s+HEAD@\{([^}]+)\}:/;

function reflogEntries() {
  const out = execFileSync('git', ['reflog', '--date=iso-strict'], { cwd: REPO_ROOT, encoding: 'utf8' });
  const entries = out
    .trim()
    .split('\n')
    .map((line) => {
      const m = line.match(REFLOG_LINE_RE);
      if (!m) return null;
      const ts = new Date(m[2]).getTime();
      if (Number.isNaN(ts)) return null;
      return { sha: m[1], ts };
    })
    .filter(Boolean);
  // git reflog prints newest-first already; reflog entries ARE strictly
  // chronological (each one records a real HEAD transition in order), unlike
  // git log's topological order.
  return entries;
}

function headAt(entries, targetTs) {
  for (const e of entries) {
    if (e.ts <= targetTs) return e.sha;
  }
  return null;
}

function resolveFullSha(shortSha) {
  try {
    return execFileSync('git', ['rev-parse', shortSha], { cwd: REPO_ROOT, encoding: 'utf8' }).trim();
  } catch {
    return shortSha;
  }
}

function main() {
  const entries = reflogEntries();
  if (entries.length === 0) {
    console.error('No reflog entries available -- cannot backfill safely. Aborting without writing anything.');
    process.exitCode = 1;
    return;
  }
  const oldestCovered = entries[entries.length - 1].ts;
  console.log(`reflog covers back to ${new Date(oldestCovered).toISOString()} (${entries.length} entries)\n`);

  const files = readdirSync(EVIDENCE_DIR).filter((f) => f.endsWith('.json'));
  let backfilled = 0;
  let alreadyHad = 0;
  let unresolvable = 0;
  const shaCache = new Map();

  for (const file of files) {
    const path = join(EVIDENCE_DIR, file);
    const record = JSON.parse(readFileSync(path, 'utf8'));
    if (record.head !== undefined && record.head !== null) {
      alreadyHad++;
      continue;
    }
    const createdTs = new Date(record.createdAt).getTime();
    if (Number.isNaN(createdTs)) {
      console.log(`  ?  ${file}: unparseable createdAt "${record.createdAt}" -- skipped`);
      unresolvable++;
      continue;
    }
    if (createdTs < oldestCovered) {
      console.log(`  ?  ${file}: createdAt ${record.createdAt} predates reflog coverage -- skipped (fail closed)`);
      unresolvable++;
      continue;
    }
    const shortSha = headAt(entries, createdTs);
    if (!shortSha) {
      console.log(`  ?  ${file}: no reflog entry at or before ${record.createdAt} -- skipped`);
      unresolvable++;
      continue;
    }
    if (!shaCache.has(shortSha)) shaCache.set(shortSha, resolveFullSha(shortSha));
    const sha = shaCache.get(shortSha);
    console.log(`  +  ${file}: head=${sha.slice(0, 12)} (createdAt=${record.createdAt})`);
    backfilled++;
    if (APPLY) {
      record.head = sha;
      writeFileSync(path, JSON.stringify(record, null, 2) + '\n', 'utf8');
    }
  }

  console.log(`\n${APPLY ? 'APPLIED' : 'DRY RUN'}: ${backfilled} backfilled, ${alreadyHad} already had head, ${unresolvable} unresolvable (skipped, not guessed).`);
  if (!APPLY && backfilled > 0) console.log('Re-run with --apply to write.');
}

main();
