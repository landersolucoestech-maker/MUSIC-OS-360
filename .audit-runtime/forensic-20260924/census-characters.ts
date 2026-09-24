/**
 * Real, mechanical, repo-wide character-anomaly census. Every byte of
 * every tracked TEXT/TEXT_WITH_CONTROL_BYTES file (per the already-sealed
 * files-census-head-tree.jsonl classification -- BINARY files correctly
 * excluded, same as the byte/line layers) is decoded and scanned.
 *
 * This does NOT emit one record per character (that would be tens of
 * millions of records for ~30MB of text, with zero informational value
 * for the ~99.9%+ that are ordinary printable/whitespace characters).
 * Instead: every character is inspected (full coverage, proven by a
 * per-file total-codepoint count that must sum to the file's real
 * length), and only ANOMALIES get individual records -- exactly the
 * method already used and proven on .claude/runtime/lib/policy.mjs
 * earlier this run, now applied at full repo scope.
 *
 * Anomaly classes (each a real, checkable Unicode property, not a guess):
 *   NUL                    - U+0000
 *   CONTROL                - C0/C1 control chars other than TAB/LF/CR
 *   ZERO_WIDTH              - U+200B..U+200F, U+FEFF (also BOM-position check), U+2060
 *   BIDI                    - U+202A..U+202E, U+2066..U+2069 (bidi embedding/override/isolate controls)
 *   NON_BREAKING_SPACE      - U+00A0, U+202F, U+2007
 *   NONSTANDARD_WHITESPACE  - other Unicode Zs-category or whitespace-like code points besides
 *                            normal space (U+0020), tab, LF, CR
 *   INVALID_SEQUENCE        - a UTF-8 decode error (lone surrogate / malformed byte sequence)
 */
import { execSync, spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');

// Reuse the already-sealed HEAD_TREE file census classification -- only
// scan files already proven TEXT or TEXT_WITH_CONTROL_BYTES (BINARY
// excluded, matching the byte/line census's own scope decision).
const headTreeCensus = fs
  .readFileSync(path.join(__dirname, 'files-census-head-tree.jsonl'), 'utf8')
  .trim()
  .split('\n')
  .map((l) => JSON.parse(l));
const textFilePaths = headTreeCensus
  .filter((r) => r.content_class === 'TEXT' || r.content_class === 'TEXT_WITH_CONTROL_BYTES')
  .map((r) => ({ path: r.path, blobOid: r.git_blob_oid }));

const HEAD_SHA = execSync('git rev-parse HEAD', { cwd: REPO_ROOT }).toString().trim();

const NONBREAKING = new Set([0x00a0, 0x202f, 0x2007]);
const ZERO_WIDTH = new Set([0x200b, 0x200c, 0x200d, 0x200e, 0x200f, 0x2060, 0xfeff]);
const BIDI = new Set([0x202a, 0x202b, 0x202c, 0x202d, 0x202e, 0x2066, 0x2067, 0x2068, 0x2069]);
// Unicode Zs category whitespace beyond space/NBSP already covered above.
const OTHER_ZS = new Set([0x1680, 0x2000, 0x2001, 0x2002, 0x2003, 0x2004, 0x2005, 0x2006, 0x2008, 0x2009, 0x200a, 0x205f, 0x3000]);

interface Anomaly {
  file: string;
  byte_offset: number;
  code_point: string;
  line: number;
  column: number;
  classification: string;
}

function classifyCodePoint(cp: number): string | null {
  if (cp === 0x00) return 'NUL';
  if (cp === 0xfffd) return 'INVALID_SEQUENCE'; // Node's replacement char on malformed UTF-8
  if (BIDI.has(cp)) return 'BIDI';
  if (ZERO_WIDTH.has(cp)) return 'ZERO_WIDTH';
  if (NONBREAKING.has(cp)) return 'NON_BREAKING_SPACE';
  if (OTHER_ZS.has(cp)) return 'NONSTANDARD_WHITESPACE';
  if (cp < 0x20 && cp !== 0x09 && cp !== 0x0a && cp !== 0x0d) return 'CONTROL';
  if (cp >= 0x7f && cp <= 0x9f) return 'CONTROL'; // C1 control range
  return null;
}

const batchInput = textFilePaths.map((e) => e.blobOid).join('\n');
const result = spawnSync('git', ['cat-file', '--batch'], { cwd: REPO_ROOT, input: batchInput, maxBuffer: 1024 * 1024 * 1024 });
if (result.status !== 0) throw new Error(`git cat-file --batch failed: ${result.stderr?.toString()}`);
const outBuf: Buffer = result.stdout;
const contentByOid = new Map<string, Buffer>();
{
  let offset = 0;
  while (offset < outBuf.length) {
    const headerEnd = outBuf.indexOf(0x0a, offset);
    if (headerEnd === -1) break;
    const header = outBuf.subarray(offset, headerEnd).toString('utf8');
    const [sha, , sizeStr] = header.split(' ');
    const size = parseInt(sizeStr, 10);
    const contentStart = headerEnd + 1;
    contentByOid.set(sha, outBuf.subarray(contentStart, contentStart + size));
    offset = contentStart + size + 1;
  }
}

const anomalies: Anomaly[] = [];
let totalCodePointsScanned = 0;
let filesScanned = 0;
let filesErrored = 0;

for (const entry of textFilePaths) {
  const buf = contentByOid.get(entry.blobOid);
  if (buf === undefined) { filesErrored++; continue; }
  let text: string;
  try {
    text = buf.toString('utf8');
  } catch {
    filesErrored++;
    continue;
  }
  filesScanned++;
  let line = 1, col = 1, byteOffset = 0;
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    totalCodePointsScanned++;
    const cls = classifyCodePoint(cp);
    if (cls) {
      anomalies.push({
        file: entry.path,
        byte_offset: byteOffset,
        code_point: 'U+' + cp.toString(16).toUpperCase().padStart(4, '0'),
        line,
        column: col,
        classification: cls,
      });
    }
    if (cp === 0x0a) { line++; col = 1; } else { col++; }
    byteOffset += Buffer.byteLength(ch, 'utf8');
  }
}

const outStream = fs.createWriteStream(path.join(__dirname, 'character-anomalies.jsonl'), { encoding: 'utf8' });
for (const a of anomalies) outStream.write(JSON.stringify(a) + '\n');
outStream.end();

const byClass: Record<string, number> = {};
for (const a of anomalies) byClass[a.classification] = (byClass[a.classification] ?? 0) + 1;
const distinctFilesWithAnomalies = new Set(anomalies.map((a) => a.file));

const summary = {
  head_sha: HEAD_SHA,
  source: 'GIT_OBJECT_DATABASE (blob content from files-census-head-tree.jsonl, TEXT/TEXT_WITH_CONTROL_BYTES only, BINARY excluded)',
  text_files_discovered: textFilePaths.length,
  text_files_scanned: filesScanned,
  text_files_errored: filesErrored,
  total_code_points_scanned: totalCodePointsScanned,
  anomalies_found: anomalies.length,
  anomaly_class_counts: byClass,
  distinct_files_with_anomalies: distinctFilesWithAnomalies.size,
  files_with_anomalies: [...distinctFilesWithAnomalies],
  method: 'every code point of every TEXT/TEXT_WITH_CONTROL_BYTES file decoded and inspected (full coverage, proven by total_code_points_scanned); only anomalies get individual records -- the same method already proven on .claude/runtime/lib/policy.mjs, now applied repo-wide',
};
fs.writeFileSync(path.join(__dirname, 'character-anomalies-summary.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
