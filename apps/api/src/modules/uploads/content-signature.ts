/**
 * Content signature check for uploads: the browser-declared type and the file name are not evidence of what
 * a file is, so the first bytes of the stored object are compared with the signature of the declared type.
 * A type without a known signature is not accepted (callers only pass types from the platform allow-list).
 */

const ascii = (head: Buffer, from: number, to: number): string => head.subarray(from, to).toString('latin1');
const startsWith = (head: Buffer, bytes: number[]): boolean => bytes.every((b, i) => head[i] === b);

const riff = (head: Buffer, form: string): boolean => ascii(head, 0, 4) === 'RIFF' && ascii(head, 8, 12) === form;
const isoBaseMedia = (head: Buffer): boolean => head.length >= 12 && ascii(head, 4, 8) === 'ftyp';
const quickTime = (head: Buffer): boolean =>
  head.length >= 12 && ['ftyp', 'moov', 'mdat', 'wide', 'free', 'skip'].includes(ascii(head, 4, 8));

const SIGNATURES: Record<string, (head: Buffer) => boolean> = {
  'audio/mpeg': (h) => ascii(h, 0, 3) === 'ID3' || (h[0] === 0xff && ((h[1] ?? 0) & 0xe0) === 0xe0),
  'audio/wav': (h) => riff(h, 'WAVE'),
  'audio/flac': (h) => ascii(h, 0, 4) === 'fLaC',
  'audio/ogg': (h) => ascii(h, 0, 4) === 'OggS',
  'audio/mp4': isoBaseMedia,
  'video/mp4': isoBaseMedia,
  'video/quicktime': quickTime,
  'video/webm': (h) => startsWith(h, [0x1a, 0x45, 0xdf, 0xa3]),
  'image/jpeg': (h) => startsWith(h, [0xff, 0xd8, 0xff]),
  'image/png': (h) => startsWith(h, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  'image/gif': (h) => ['GIF87a', 'GIF89a'].includes(ascii(h, 0, 6)),
  'image/webp': (h) => riff(h, 'WEBP'),
  // A PDF may be preceded by up to 1024 bytes of junk before the header.
  'application/pdf': (h) => h.subarray(0, 1024).toString('latin1').includes('%PDF-'),
  // Office Open XML files are ZIP containers.
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': (h) => startsWith(h, [0x50, 0x4b, 0x03, 0x04]),
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': (h) => startsWith(h, [0x50, 0x4b, 0x03, 0x04]),
  // Legacy Word documents are OLE compound files.
  'application/msword': (h) => startsWith(h, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
};

/** True when the leading bytes match the signature of the declared content type. */
export function contentMatchesDeclaredType(mimeType: string, head: Buffer): boolean {
  const matches = SIGNATURES[mimeType];
  return matches !== undefined && head.length > 0 && matches(head);
}

/** Content types this module can verify; used to keep the allow-list and the signature table in step. */
export const VERIFIABLE_MIME_TYPES: readonly string[] = Object.keys(SIGNATURES);
