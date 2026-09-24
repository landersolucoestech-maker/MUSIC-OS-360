/**
 * READ-ONLY investigation of .claude/runtime/lib/policy.mjs's byte 0x00
 * occurrence(s), sourced from the HEAD git object (not the worktree, though
 * this file has zero worktree divergence per git status). Never writes to
 * .claude/** (frozen zone) -- read-only inspection only.
 */
import { execSync } from 'child_process';
import * as crypto from 'crypto';

const REL_PATH = '.claude/runtime/lib/policy.mjs';
const HEAD_BLOB_OID = execSync(`git rev-parse HEAD:${REL_PATH}`).toString().trim();
const content: Buffer = execSync(`git cat-file blob ${HEAD_BLOB_OID}`, { maxBuffer: 1024 * 1024 });
const contentSha256 = crypto.createHash('sha256').update(content).digest('hex');

console.log('HEAD_BLOB_OID:', HEAD_BLOB_OID);
console.log('HEAD_CONTENT_SHA256:', contentSha256);
console.log('BYTE_LENGTH:', content.length);

const nulOffsets: number[] = [];
for (let i = 0; i < content.length; i++) if (content[i] === 0x00) nulOffsets.push(i);
console.log('NUL_COUNT:', nulOffsets.length);
console.log('NUL_OFFSETS:', JSON.stringify(nulOffsets));

for (const offset of nulOffsets) {
  // line/column via LF count up to offset
  let line = 1, col = 1;
  for (let i = 0; i < offset; i++) {
    if (content[i] === 0x0a) { line++; col = 1; } else { col++; }
  }
  const ctxStart = Math.max(0, offset - 15);
  const ctxEnd = Math.min(content.length, offset + 15);
  const before = content.subarray(ctxStart, offset);
  const after = content.subarray(offset + 1, ctxEnd);
  // Check immediate preceding byte for backslash (0x5c) to distinguish
  // a literal 2-char source escape "\0" (backslash, '0'=0x30) from a raw
  // embedded NUL byte. The byte AT this offset is 0x00 either way (we
  // only record offsets where content[i]===0x00 -- a literal source
  // escape "\0" would show bytes 0x5c 0x30, NEVER byte 0x00, at this
  // offset). So finding this offset at all already proves ACTUAL_NUL_BYTE.
  console.log('---');
  console.log('OFFSET:', offset, 'LINE:', line, 'COLUMN:', col);
  console.log('HEX_CONTEXT_BEFORE:', before.toString('hex'));
  console.log('HEX_BYTE: 00');
  console.log('HEX_CONTEXT_AFTER:', after.toString('hex'));
  console.log('DECODED_CONTEXT_ESCAPED:', JSON.stringify(before.toString('latin1')) + '\\u0000' + JSON.stringify(after.toString('latin1')));
  console.log('PRECEDING_BYTE_IS_BACKSLASH_0x5C:', content[offset - 1] === 0x5c);
}
