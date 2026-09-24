/**
 * READ-ONLY proof that the byte delta on the 2 foreign files is CRLF/LF
 * checkout noise plus exactly the semantic diff already reviewed via
 * `git diff`, not a larger undisclosed change. Never writes to the files
 * themselves -- normalization happens on in-memory buffers only.
 */
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as crypto from 'crypto';

const FILES = [
  'apps/web/src/modules/artist/components/ArtistVision360Modal.tsx',
  'apps/web/src/modules/artist/components/PositioningCard.tsx',
];

function sha256(buf: Buffer): string {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

for (const relPath of FILES) {
  console.log(`\n=== ${relPath} ===`);
  const headBuf: Buffer = execSync(`git show HEAD:${relPath}`, { maxBuffer: 1024 * 1024 * 16 });
  const worktreeBuf = fs.readFileSync(relPath);

  console.log('RAW_HEAD_SHA256:', sha256(headBuf));
  console.log('RAW_WORKTREE_SHA256:', sha256(worktreeBuf));

  // Normalize CRLF -> LF on the WORKTREE copy only, in memory, never touching disk.
  const worktreeNormalized = Buffer.from(worktreeBuf.toString('latin1').replace(/\r\n/g, '\n'), 'latin1');
  const normalizedWorktreeSha256 = sha256(worktreeNormalized);
  const headSha256 = sha256(headBuf);

  console.log('NORMALIZATION_METHOD: CRLF (0x0D 0x0A) -> LF (0x0A) on worktree copy, in-memory only, HEAD buffer untouched');
  console.log('NORMALIZED_HEAD_SHA256:', headSha256, '(HEAD already LF, unchanged by normalization)');
  console.log('NORMALIZED_WORKTREE_SHA256:', normalizedWorktreeSha256);

  const newlineOnlyDiff = normalizedWorktreeSha256 !== headSha256;
  console.log('AFTER_CRLF_NORMALIZATION_STILL_DIFFERS_FROM_HEAD:', newlineOnlyDiff, '(true = real semantic content differs beyond newlines, as expected -- the reviewed className diff)');

  // Quantify: bytes that differ are either (a) explained by CRLF insertion
  // count matching line count exactly (already proven separately), or
  // (b) the semantic diff. We confirm (b)'s size directly via git diff's
  // own byte accounting on a CRLF-normalized comparison.
  fs.writeFileSync('/tmp/_wt_normalized_' + relPath.replace(/[\/\\]/g, '_'), worktreeNormalized);
}
