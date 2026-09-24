/**
 * WORKTREE_CENSUS -- every git-tracked file's raw byte length, sha256, and
 * physical line count, with content read from the FILESYSTEM WORKTREE
 * (fs.readFileSync), not the Git object database. File LIST comes from
 * `git ls-files` (the git index), but CONTENT reflects whatever is
 * currently on disk -- for the 2 known foreign files with uncommitted
 * local edits, this differs from files-census-head-tree.jsonl's HEAD
 * values; for all other files (zero worktree/HEAD divergence per `git
 * status --short`), the two censuses are content-identical by definition.
 *
 * Uses the same CONTENT_CLASS taxonomy as census-files-head-tree.ts
 * (TEXT / TEXT_WITH_CONTROL_BYTES / BINARY) so the two censuses are
 * directly comparable -- a NUL byte alone no longer forces a BINARY
 * verdict (see .claude/runtime/lib/policy.mjs, a valid node --check
 * -passing .mjs source file using 2 literal NUL bytes as an internal
 * glob->regex sentinel, correctly TEXT_WITH_CONTROL_BYTES here).
 */
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');

const trackedRaw = execSync('git ls-files', { cwd: REPO_ROOT, maxBuffer: 1024 * 1024 * 64 }).toString('utf8');
const files = trackedRaw.split('\n').filter((f) => f.length > 0);

interface CensusRow {
  path: string;
  byte_length: number;
  sha256: string;
  content_class: 'TEXT' | 'TEXT_WITH_CONTROL_BYTES' | 'BINARY';
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

function classifyContent(buf: Buffer): { cls: CensusRow['content_class']; method: string } {
  const sampleLen = Math.min(buf.length, 8000);
  let nulInSample = false;
  for (let i = 0; i < sampleLen; i++) if (buf[i] === 0x00) { nulInSample = true; break; }
  if (!nulInSample) return { cls: 'TEXT', method: 'no NUL byte in first 8000 bytes' };
  let controlBytes = 0;
  for (let i = 0; i < buf.length; i++) {
    const b = buf[i];
    const isTextControl = b === 0x09 || b === 0x0a || b === 0x0d;
    if (b < 0x20 && !isTextControl) controlBytes++;
  }
  const ratio = controlBytes / buf.length;
  if (ratio < 0.01) return { cls: 'TEXT_WITH_CONTROL_BYTES', method: `NUL present, control-byte ratio ${ratio.toFixed(5)} < 0.01 threshold across full buffer` };
  return { cls: 'BINARY', method: `NUL present, control-byte ratio ${ratio.toFixed(5)} >= 0.01 threshold across full buffer` };
}

const rows: CensusRow[] = [];
let errors = 0;
const outStream = fs.createWriteStream(path.join(__dirname, 'files-census.jsonl'), { encoding: 'utf8' });

for (const relPath of files) {
  const abs = path.join(REPO_ROOT, relPath);
  try {
    const buf = fs.readFileSync(abs);
    const sha256 = crypto.createHash('sha256').update(buf).digest('hex');
    const { cls, method } = classifyContent(buf);
    const isLineCounted = cls === 'TEXT' || cls === 'TEXT_WITH_CONTROL_BYTES';
    const { count, finalTerminated } = isLineCounted ? countPhysicalLines(buf) : { count: 0, finalTerminated: true };
    const row: CensusRow = {
      path: relPath,
      byte_length: buf.length,
      sha256,
      content_class: cls,
      classification_method: method,
      physical_line_count: count,
      final_line_terminated: finalTerminated,
    };
    rows.push(row);
    outStream.write(JSON.stringify(row) + '\n');
  } catch (e: any) {
    errors++;
    outStream.write(JSON.stringify({ path: relPath, error: String(e.message ?? e) }) + '\n');
  }
}
outStream.end();

const totalBytes = rows.reduce((a, r) => a + r.byte_length, 0);
const totalLines = rows.reduce((a, r) => a + r.physical_line_count, 0);
const textFiles = rows.filter((r) => r.content_class === 'TEXT').length;
const textWithControl = rows.filter((r) => r.content_class === 'TEXT_WITH_CONTROL_BYTES').length;
const binaryFiles = rows.filter((r) => r.content_class === 'BINARY').length;

const summary = {
  source: 'FILESYSTEM_WORKTREE (fs.readFileSync); file LIST from git ls-files (git index)',
  discovered_tracked_files: files.length,
  audited_files: rows.length,
  read_errors: errors,
  text_files: textFiles,
  text_with_control_bytes_files: textWithControl,
  binary_files: binaryFiles,
  discovered_bytes: totalBytes,
  discovered_physical_lines: totalLines,
};
fs.writeFileSync(path.join(__dirname, 'files-census-summary.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
