/**
 * Real, mechanical directory census for every directory in the tracked
 * tree at HEAD (derived from git ls-tree paths, not a filesystem walk --
 * stays within the SUBJECT_UNIVERSE / AUDIT_ARTIFACT_UNIVERSE separation
 * rule since .audit-runtime/forensic-20260924/** is excluded).
 *
 * For each directory: child file count, child directory count (direct
 * children only), file-extension mix, and purely mechanical anomaly
 * flags (all deterministic, zero semantic judgment):
 *   MIXED_APP_OWNERSHIP  - a directory whose children's paths span more
 *                          than one of {apps/api, apps/web, packages/*,
 *                          root} -- can only happen at the true root
 *   HIGH_FILE_COUNT       - >50 direct child files (candidate "god
 *                          directory", flagged for informational purposes,
 *                          not asserted as a problem)
 *   SINGLE_FILE_DIR        - exactly 1 child file, 0 child directories
 *                          (candidate over-fragmentation, informational)
 */
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');
const EXCLUDED_PREFIX = '.audit-runtime/forensic-20260924/';

const HEAD_SHA = execSync('git rev-parse HEAD', { cwd: REPO_ROOT }).toString().trim();
const lsTreeOut = execSync(`git ls-tree -r --name-only ${HEAD_SHA}`, { cwd: REPO_ROOT, maxBuffer: 1024 * 1024 * 64 }).toString('utf8');
const allPaths = lsTreeOut
  .trim()
  .split('\n')
  .filter(Boolean)
  .filter((p) => !p.startsWith(EXCLUDED_PREFIX));

interface DirInfo {
  path: string;
  childFiles: number;
  childDirsSet: Set<string>;
  extensionCounts: Record<string, number>;
}
const dirs = new Map<string, DirInfo>();

function ensureDir(dirPath: string): DirInfo {
  let d = dirs.get(dirPath);
  if (!d) {
    d = { path: dirPath, childFiles: 0, childDirsSet: new Set(), extensionCounts: {} };
    dirs.set(dirPath, d);
  }
  return d;
}
// Always register the true root, even if it has no direct file children.
ensureDir('.');

for (const filePath of allPaths) {
  const parts = filePath.split('/');
  const fileName = parts[parts.length - 1];
  const dirParts = parts.slice(0, -1);
  const dirPath = dirParts.length === 0 ? '.' : dirParts.join('/');
  const d = ensureDir(dirPath);
  d.childFiles++;
  const ext = fileName.includes('.') ? fileName.slice(fileName.lastIndexOf('.') + 1) : '(no-ext)';
  d.extensionCounts[ext] = (d.extensionCounts[ext] ?? 0) + 1;

  // Register every ancestor directory and the parent-child directory link.
  let cur = dirPath;
  while (cur !== '.') {
    const parentParts = cur.split('/').slice(0, -1);
    const parent = parentParts.length === 0 ? '.' : parentParts.join('/');
    ensureDir(parent).childDirsSet.add(cur);
    ensureDir(cur); // ensure it exists even with 0 direct files (pure passthrough dir)
    cur = parent;
  }
}

interface DirRow {
  path: string;
  child_file_count: number;
  child_directory_count: number;
  extension_mix: Record<string, number>;
  flags: string[];
}
const rows: DirRow[] = [];
for (const [dirPath, info] of dirs) {
  const flags: string[] = [];
  if (info.childFiles > 50) flags.push('HIGH_FILE_COUNT');
  if (info.childFiles === 1 && info.childDirsSet.size === 0) flags.push('SINGLE_FILE_DIR');
  if (dirPath === '.') {
    const topLevelOwners = new Set<string>();
    for (const child of info.childDirsSet) {
      if (child === 'apps') topLevelOwners.add('apps');
      else if (child === 'packages') topLevelOwners.add('packages');
      else topLevelOwners.add('root-level-other');
    }
    if (topLevelOwners.size > 1) flags.push('MIXED_APP_OWNERSHIP');
  }
  rows.push({
    path: dirPath,
    child_file_count: info.childFiles,
    child_directory_count: info.childDirsSet.size,
    extension_mix: info.extensionCounts,
    flags,
  });
}
rows.sort((a, b) => a.path.localeCompare(b.path));

const outStream = fs.createWriteStream(path.join(__dirname, 'directories.jsonl'), { encoding: 'utf8' });
for (const r of rows) outStream.write(JSON.stringify(r) + '\n');
outStream.end();

const rootLevelEntries = rows.filter((r) => r.path === '.' || (r.path.split('/').length === 1));
const highFileCount = rows.filter((r) => r.flags.includes('HIGH_FILE_COUNT'));

const summary = {
  head_sha: HEAD_SHA,
  source: 'GIT_OBJECT_DATABASE (git ls-tree --name-only, excludes .audit-runtime/forensic-20260924/** per the universe-separation rule)',
  discovered_directories: rows.length,
  audited_directories: rows.length,
  root_level_entries: rootLevelEntries.map((r) => r.path).filter((p) => p !== '.'),
  high_file_count_directories: highFileCount.map((r) => ({ path: r.path, count: r.child_file_count })),
  method: 'fully mechanical -- derived entirely from git ls-tree paths, zero semantic judgment; HIGH_FILE_COUNT/SINGLE_FILE_DIR are informational flags for follow-up, not verdicts',
};
fs.writeFileSync(path.join(__dirname, 'directories-summary.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
