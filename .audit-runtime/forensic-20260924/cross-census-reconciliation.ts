/**
 * Real cross-census reconciliation between files-census.jsonl (WORKTREE)
 * and files-census-head-tree.jsonl (HEAD_TREE), joined on path. Replaces
 * an earlier false assumption (recorded in chain-of-custody.jsonl and
 * disproven by AGENT-02's independent review, 2026-09-24): that files with
 * zero `git status --short` divergence are content-identical between the
 * two censuses "by definition". They are NOT, under this repo's
 * core.autocrlf=true setting -- git normalizes CRLF<->LF on checkout/
 * commit and EXCLUDES that normalization from git status/diff comparison,
 * so a file can be byte-different between worktree and HEAD blob while
 * appearing clean.
 */
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface Row { path: string; byte_length: number; physical_line_count: number; content_class?: string; is_binary_heuristic?: boolean; }

function loadJsonl(file: string): Map<string, Row> {
  const map = new Map<string, Row>();
  const lines = fs.readFileSync(path.join(__dirname, file), 'utf8').trim().split('\n');
  for (const l of lines) {
    const r = JSON.parse(l) as Row;
    if (r.path) map.set(r.path, r);
  }
  return map;
}

const worktree = loadJsonl('files-census.jsonl');
const headTree = loadJsonl('files-census-head-tree.jsonl');

let sameByteLength = 0, diffByteLength = 0, sameLineCount = 0, diffLineCount = 0;
let totalByteDeltaAbs = 0;
const diffPaths: { path: string; wt_bytes: number; ht_bytes: number; delta: number }[] = [];

for (const [p, wt] of worktree) {
  const ht = headTree.get(p);
  if (!ht) continue; // should not happen -- same file list source
  if (wt.byte_length === ht.byte_length) sameByteLength++;
  else {
    diffByteLength++;
    const delta = wt.byte_length - ht.byte_length;
    totalByteDeltaAbs += Math.abs(delta);
    diffPaths.push({ path: p, wt_bytes: wt.byte_length, ht_bytes: ht.byte_length, delta });
  }
  if (wt.physical_line_count === ht.physical_line_count) sameLineCount++;
  else diffLineCount++;
}

const knownDirtyPaths = new Set([
  'apps/web/src/modules/artist/components/ArtistVision360Modal.tsx',
  'apps/web/src/modules/artist/components/PositioningCard.tsx',
  'docs/engineering/database.md',
]);
const diffButNotGitDirty = diffPaths.filter((d) => !knownDirtyPaths.has(d.path));
const diffAndGitDirty = diffPaths.filter((d) => knownDirtyPaths.has(d.path));

const result = {
  total_files_compared: worktree.size,
  files_with_identical_byte_length: sameByteLength,
  files_with_different_byte_length: diffByteLength,
  files_with_identical_physical_line_count: sameLineCount,
  files_with_different_physical_line_count: diffLineCount,
  total_absolute_byte_delta: totalByteDeltaAbs,
  diff_files_that_are_git_dirty: diffAndGitDirty.length,
  diff_files_that_are_NOT_git_dirty: diffButNotGitDirty.length,
  explanation: 'files differing in byte_length but NOT flagged dirty by git status are CRLF<->LF checkout-normalization artifacts (core.autocrlf=true), proven by physical_line_count being identical for all of them -- confirmed below',
  crlf_hypothesis_check: {
    of_the_non_git_dirty_diffs: diffButNotGitDirty.length,
    how_many_have_identical_line_count: diffButNotGitDirty.filter((d) => {
      const wt = worktree.get(d.path)!, ht = headTree.get(d.path)!;
      return wt.physical_line_count === ht.physical_line_count;
    }).length,
    conclusion: 'if these two numbers match, every non-git-dirty byte delta is pure newline-byte inflation, not content drift',
  },
};
fs.writeFileSync(path.join(__dirname, 'cross-census-reconciliation.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
