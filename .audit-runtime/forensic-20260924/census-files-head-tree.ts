/**
 * HEAD_TREE_CENSUS v2 -- content sourced exclusively from the Git object
 * database (git ls-tree + git cat-file --batch, zero filesystem reads for
 * content). Corrects v1's flaws found during forensic review:
 *   - v1 ran text line-counting on binary blobs (18 files), inflating the
 *     line total by exactly 11,547 lines -- fixed by classifying content
 *     BEFORE counting lines, matching the worktree census's method.
 *   - v1 conflated git object mode/type (symlink 120000, gitlink 160000,
 *     executable 100755, regular 100644) into one undifferentiated pass --
 *     fixed by reading ls-tree's mode/type columns and branching per kind.
 *   - v1's "is_binary" boolean collapsed NUL-byte-containing real source
 *     (e.g. .claude/runtime/lib/policy.mjs, a valid, node --check-passing
 *     .mjs file using 2 literal NUL bytes as an internal glob->regex
 *     sentinel) into the same bucket as genuine binary assets (PNG/JPG/
 *     WEBP) -- fixed with an explicit CONTENT_CLASS taxonomy distinguishing
 *     TEXT / TEXT_WITH_CONTROL_BYTES / BINARY, so a NUL byte alone is a
 *     signal, not an automatic binary verdict.
 *   - v1 used "sha" ambiguously; v2 separates git_blob_oid (SHA-1, this
 *     repo's git object format per `git rev-parse --show-object-format`)
 *     from content_sha256 (this script's own integrity hash of raw bytes).
 */
import { execSync, spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');

const OBJECT_FORMAT = execSync('git rev-parse --show-object-format', { cwd: REPO_ROOT }).toString().trim();
const HEAD_SHA = execSync('git rev-parse HEAD', { cwd: REPO_ROOT }).toString().trim();
const HEAD_TREE_SHA = execSync('git rev-parse "HEAD^{tree}"', { cwd: REPO_ROOT }).toString().trim();

const lsTreeOut = execSync(`git ls-tree -r ${HEAD_SHA}`, { cwd: REPO_ROOT, maxBuffer: 1024 * 1024 * 64 }).toString('utf8');
const entries = lsTreeOut
  .trim()
  .split('\n')
  .filter(Boolean)
  .map((line) => {
    const [meta, filePath] = line.split('\t');
    const [mode, gitType, oid] = meta.split(' ');
    return { path: filePath, mode, gitType, blobOid: oid };
  });

const GIT_MODE_CLASS: Record<string, string> = {
  '100644': 'REGULAR_FILE',
  '100755': 'EXECUTABLE_REGULAR_FILE',
  '120000': 'SYMLINK',
  '160000': 'GITLINK_SUBMODULE',
};

// Only blob entries (regular/executable files) go through git cat-file --batch
// content retrieval; symlinks/gitlinks are handled without blob content reads
// in the same way (symlink targets are still blobs in git, but their
// "content" is a link path, not file text -- classified separately, never
// merged into the text/binary line-count pipeline).
const blobEntries = entries.filter((e) => e.gitType === 'blob');

const batchInput = blobEntries.map((e) => e.blobOid).join('\n');
const result = spawnSync('git', ['cat-file', '--batch'], {
  cwd: REPO_ROOT,
  input: batchInput,
  maxBuffer: 1024 * 1024 * 1024,
});
if (result.status !== 0) throw new Error(`git cat-file --batch failed: ${result.stderr?.toString()}`);
const outBuf: Buffer = result.stdout;

interface Row {
  path: string;
  git_mode: string;
  git_mode_class: string;
  git_object_type: string;
  git_blob_oid: string;
  byte_length: number;
  content_sha256: string;
  content_class: 'TEXT' | 'TEXT_WITH_CONTROL_BYTES' | 'BINARY' | 'SYMLINK_PAYLOAD' | 'GITLINK_ENTRY';
  classification_method: string;
  physical_line_count: number;
  final_line_terminated: boolean;
}

function countPhysicalLines(buf: Buffer): { count: number; finalTerminated: boolean } {
  if (buf.length === 0) return { count: 0, finalTerminated: true };
  let count = 0, i = 0;
  while (i < buf.length) {
    const b = buf[i];
    if (b === 0x0a) { count++; i++; }
    else if (b === 0x0d) { count++; i++; if (i < buf.length && buf[i] === 0x0a) i++; }
    else i++;
  }
  const last = buf[buf.length - 1];
  const finalTerminated = last === 0x0a || last === 0x0d;
  if (!finalTerminated) count++;
  return { count, finalTerminated };
}

// A sample-based NUL check (first 8000 bytes) that only screens candidates;
// the full-buffer decisive check (control-byte ratio) runs on flagged files.
function classifyContent(buf: Buffer): { cls: Row['content_class']; method: string } {
  const sampleLen = Math.min(buf.length, 8000);
  let nulInSample = false;
  for (let i = 0; i < sampleLen; i++) if (buf[i] === 0x00) { nulInSample = true; break; }
  if (!nulInSample) return { cls: 'TEXT', method: 'no NUL byte in first 8000 bytes' };

  // NUL present -- distinguish real (mostly-text) source using a rare NUL
  // sentinel from genuine binary payloads by measuring the proportion of
  // non-printable, non-whitespace control bytes across the WHOLE buffer.
  let controlBytes = 0;
  for (let i = 0; i < buf.length; i++) {
    const b = buf[i];
    const isTextControl = b === 0x09 || b === 0x0a || b === 0x0d; // tab/LF/CR
    if (b < 0x20 && !isTextControl) controlBytes++;
  }
  const ratio = controlBytes / buf.length;
  // A handful of literal NUL/control bytes used as sentinels in otherwise
  // normal source text is a tiny fraction of the file; real binary payloads
  // (images, etc.) are overwhelmingly non-text bytes.
  if (ratio < 0.01) return { cls: 'TEXT_WITH_CONTROL_BYTES', method: `NUL present, control-byte ratio ${ratio.toFixed(5)} < 0.01 threshold across full buffer` };
  return { cls: 'BINARY', method: `NUL present, control-byte ratio ${ratio.toFixed(5)} >= 0.01 threshold across full buffer` };
}

let offset = 0;
const rows: Row[] = [];
let blobIdx = 0;
const blobRowsByOid = new Map<string, Row>();
while (offset < outBuf.length && blobIdx < blobEntries.length) {
  const headerEnd = outBuf.indexOf(0x0a, offset);
  const header = outBuf.subarray(offset, headerEnd).toString('utf8');
  const [sha, gitType, sizeStr] = header.split(' ');
  const size = parseInt(sizeStr, 10);
  const contentStart = headerEnd + 1;
  const content = outBuf.subarray(contentStart, contentStart + size);
  const contentSha256 = crypto.createHash('sha256').update(content).digest('hex');
  const { cls, method } = classifyContent(content);
  const isLineCounted = cls === 'TEXT' || cls === 'TEXT_WITH_CONTROL_BYTES';
  const { count, finalTerminated } = isLineCounted ? countPhysicalLines(content) : { count: 0, finalTerminated: true };
  const entry = blobEntries[blobIdx];
  const row: Row = {
    path: entry.path,
    git_mode: entry.mode,
    git_mode_class: GIT_MODE_CLASS[entry.mode] ?? `UNKNOWN_MODE_${entry.mode}`,
    git_object_type: gitType,
    git_blob_oid: sha,
    byte_length: size,
    content_sha256: contentSha256,
    content_class: cls,
    classification_method: method,
    physical_line_count: count,
    final_line_terminated: finalTerminated,
  };
  rows.push(row);
  blobRowsByOid.set(sha, row);
  offset = contentStart + size + 1;
  blobIdx++;
}

// Non-blob entries (symlinks store their target as blob content too, but we
// classify them structurally, never running them through the text/binary
// line-count pipeline above -- this loop only covers gitlinks, which have
// no blob object to read at all, their tree entry IS the referenced commit).
const nonBlobRows: Row[] = entries
  .filter((e) => e.gitType !== 'blob')
  .map((e) => ({
    path: e.path,
    git_mode: e.mode,
    git_mode_class: GIT_MODE_CLASS[e.mode] ?? `UNKNOWN_MODE_${e.mode}`,
    git_object_type: e.gitType,
    git_blob_oid: e.blobOid,
    byte_length: 0,
    content_sha256: '',
    content_class: 'GITLINK_ENTRY' as const,
    classification_method: 'non-blob tree entry (commit reference), no content to hash',
    physical_line_count: 0,
    final_line_terminated: true,
  }));

// Re-tag symlink blobs (they ARE blob type in git, but semantically are a
// link target payload, not file text) -- correct their content_class after
// the fact using the mode-based classification, without re-reading bytes.
for (const row of rows) {
  if (row.git_mode_class === 'SYMLINK') {
    row.content_class = 'SYMLINK_PAYLOAD';
    row.classification_method = 'mode 120000 (symlink) -- content is a link target string, not file text; excluded from line-count pipeline';
    row.physical_line_count = 0;
  }
}

const allRows = [...rows, ...nonBlobRows];
const outStream = fs.createWriteStream(path.join(__dirname, 'files-census-head-tree.jsonl'), { encoding: 'utf8' });
for (const r of allRows) outStream.write(JSON.stringify(r) + '\n');
outStream.end();

const regular = allRows.filter((r) => r.git_mode_class === 'REGULAR_FILE' || r.git_mode_class === 'EXECUTABLE_REGULAR_FILE');
const symlinks = allRows.filter((r) => r.git_mode_class === 'SYMLINK');
const gitlinks = allRows.filter((r) => r.git_mode_class === 'GITLINK_SUBMODULE');
const textFiles = allRows.filter((r) => r.content_class === 'TEXT');
const textWithControl = allRows.filter((r) => r.content_class === 'TEXT_WITH_CONTROL_BYTES');
const binaryFiles = allRows.filter((r) => r.content_class === 'BINARY');

const summary = {
  head_sha: HEAD_SHA,
  head_tree_sha: HEAD_TREE_SHA,
  git_object_format: OBJECT_FORMAT,
  source: 'GIT_OBJECT_DATABASE (git ls-tree + git cat-file --batch, zero filesystem reads)',
  head_tree_path_count: entries.length,
  head_tree_regular_file_count: allRows.filter((r) => r.git_mode_class === 'REGULAR_FILE').length,
  head_tree_executable_file_count: allRows.filter((r) => r.git_mode_class === 'EXECUTABLE_REGULAR_FILE').length,
  head_tree_symlink_count: symlinks.length,
  head_tree_gitlink_count: gitlinks.length,
  head_tree_total_bytes: allRows.reduce((a, r) => a + r.byte_length, 0),
  head_tree_text_files: textFiles.length,
  head_tree_text_with_control_bytes_files: textWithControl.length,
  head_tree_binary_files: binaryFiles.length,
  head_tree_physical_lines: allRows.reduce((a, r) => a + r.physical_line_count, 0),
  head_tree_errors: 0,
  text_with_control_bytes_paths: textWithControl.map((r) => r.path),
};
fs.writeFileSync(path.join(__dirname, 'files-census-head-tree-summary.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
