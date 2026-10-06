import { contentMatchesDeclaredType, VERIFIABLE_MIME_TYPES } from './content-signature';
import { ALLOWED_UPLOAD_MIME_TYPES } from '../../storage/storage.service';

const bytes = (...values: number[]): Buffer => Buffer.from(values);
const text = (value: string, pad = 16): Buffer => Buffer.concat([Buffer.from(value, 'latin1'), Buffer.alloc(pad)]);
const wave = Buffer.concat([Buffer.from('RIFF'), bytes(0, 0, 0, 0), Buffer.from('WAVE'), Buffer.alloc(8)]);
const webp = Buffer.concat([Buffer.from('RIFF'), bytes(0, 0, 0, 0), Buffer.from('WEBP'), Buffer.alloc(8)]);
const ftyp = Buffer.concat([bytes(0, 0, 0, 24), Buffer.from('ftypisom'), Buffer.alloc(12)]);
const zip = Buffer.concat([bytes(0x50, 0x4b, 0x03, 0x04), Buffer.alloc(16)]);
const png = Buffer.concat([bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a), Buffer.alloc(8)]);
const ole = Buffer.concat([bytes(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1), Buffer.alloc(8)]);

const VALID: Record<string, Buffer> = {
  'audio/mpeg': text('ID3'),
  'audio/wav': wave,
  'audio/flac': text('fLaC'),
  'audio/ogg': text('OggS'),
  'audio/mp4': ftyp,
  'video/mp4': ftyp,
  'video/quicktime': Buffer.concat([bytes(0, 0, 0, 20), Buffer.from('moov'), Buffer.alloc(12)]),
  'video/webm': Buffer.concat([bytes(0x1a, 0x45, 0xdf, 0xa3), Buffer.alloc(12)]),
  'image/jpeg': Buffer.concat([bytes(0xff, 0xd8, 0xff, 0xe0), Buffer.alloc(12)]),
  'image/png': png,
  'image/gif': text('GIF89a'),
  'image/webp': webp,
  'application/pdf': text('%PDF-1.7'),
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': zip,
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': zip,
  'application/msword': ole,
};

describe('contentMatchesDeclaredType', () => {
  it.each(Object.entries(VALID))('accepts a real %s signature', (mime, head) => {
    expect(contentMatchesDeclaredType(mime, head)).toBe(true);
  });

  it('accepts an MP3 that starts with a frame sync instead of an ID3 tag', () => {
    expect(contentMatchesDeclaredType('audio/mpeg', Buffer.concat([bytes(0xff, 0xfb, 0x90), Buffer.alloc(13)]))).toBe(true);
  });

  it('accepts a PDF whose header follows a short junk prefix', () => {
    expect(contentMatchesDeclaredType('application/pdf', Buffer.concat([Buffer.from('\n\n  junk\n'), text('%PDF-1.4')]))).toBe(true);
  });

  it.each(Object.keys(VALID))('rejects %s content that is plain text', (mime) => {
    expect(contentMatchesDeclaredType(mime, text('this is only a text file'))).toBe(false);
  });

  it('rejects a script-bearing file declared as an image', () => {
    expect(contentMatchesDeclaredType('image/png', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'))).toBe(false);
  });

  it('rejects a real signature declared as a different type', () => {
    expect(contentMatchesDeclaredType('image/png', VALID['audio/wav'])).toBe(false);
    expect(contentMatchesDeclaredType('audio/wav', webp)).toBe(false);
    expect(contentMatchesDeclaredType('application/pdf', zip)).toBe(false);
  });

  it('rejects an empty file and a type with no known signature', () => {
    expect(contentMatchesDeclaredType('audio/mpeg', Buffer.alloc(0))).toBe(false);
    expect(contentMatchesDeclaredType('text/plain', text('hello'))).toBe(false);
    expect(contentMatchesDeclaredType('image/svg+xml', text('<svg/>'))).toBe(false);
  });

  it('verifies exactly the content types the platform accepts at upload', () => {
    expect([...VERIFIABLE_MIME_TYPES].sort()).toEqual([...ALLOWED_UPLOAD_MIME_TYPES].sort());
  });
});
