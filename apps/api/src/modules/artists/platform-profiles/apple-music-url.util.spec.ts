import { extractAppleMusicId } from './apple-music-url.util';

describe('extractAppleMusicId', () => {
  // Regression for the reported "Link do Apple Music inválido" bug for a
  // correctly registered URL: the frontend normalizer always produces the URL
  // WITHOUT the locale segment, but this extractor (before the fix) required
  // the locale as mandatory — the frontend's own normalized output could
  // never pass backend validation. This case must be accepted.
  it('accepts a URL without a locale (regression for the reported bug)', () => {
    expect(extractAppleMusicId('https://music.apple.com/artist/1543163588')).toBe('1543163588');
  });

  it('accepts a URL with a locale', () => {
    expect(extractAppleMusicId('https://music.apple.com/us/artist/1543163588')).toBe('1543163588');
  });

  it('accepts a URL with slug and locale', () => {
    expect(extractAppleMusicId('https://music.apple.com/us/artist/dj-stay/1543163588')).toBe('1543163588');
  });

  it('accepts a URL with slug and no locale', () => {
    expect(extractAppleMusicId('https://music.apple.com/artist/dj-stay/1543163588')).toBe('1543163588');
  });

  it('accepts a URL with a query string', () => {
    expect(extractAppleMusicId('https://music.apple.com/us/artist/1543163588?ls=1')).toBe('1543163588');
  });

  it('accepts a pure numeric id (without a URL)', () => {
    expect(extractAppleMusicId('1543163588')).toBe('1543163588');
  });

  it('rejects an invalid URL', () => {
    expect(extractAppleMusicId('not a url')).toBeNull();
  });

  it('rejects a fake domain', () => {
    expect(extractAppleMusicId('https://fake-apple.com/us/artist/1543163588')).toBeNull();
  });

  it('rejects when the id is missing', () => {
    expect(extractAppleMusicId('https://music.apple.com/us/artist/')).toBeNull();
  });

  it('rejects a non-numeric id', () => {
    expect(extractAppleMusicId('https://music.apple.com/us/artist/abc')).toBeNull();
  });

  it('rejects a blank string', () => {
    expect(extractAppleMusicId('   ')).toBeNull();
  });

  it('rejects an empty string', () => {
    expect(extractAppleMusicId('')).toBeNull();
  });

  it('rejects an arbitrary URL containing only digits outside the Apple Music domain', () => {
    expect(extractAppleMusicId('https://example.com/1543163588')).toBeNull();
  });
});
