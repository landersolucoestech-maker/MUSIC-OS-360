import {
  assertSafePathSegment,
  assertSafeStorefront,
  assertSafeLimit,
  assertSafeTypes,
  assertSafeQueryValue,
  assertAllowedHost,
  assertPublicHttpsUrl,
  assertResolvesToPublicAddresses,
  isPrivateAddress,
  UnsafeInputError,
  DisallowedHostError,
} from './safe-url';

describe('safe-url SSRF guards (CWE-918)', () => {
  describe('assertSafePathSegment', () => {
    it('accepts a clean id', () => {
      expect(assertSafePathSegment('123abc_-.~', 'id')).toBe('123abc_-.~');
    });
    it.each([
      ['slash', 'a/b'],
      ['backslash', 'a\\b'],
      ['question', 'a?b'],
      ['hash', 'a#b'],
      ['at', 'a@b'],
      ['percent-encoded slash', 'a%2fb'],
      ['space', 'a b'],
      ['full url', 'https://evil.com'],
      ['scheme', 'http://x'],
      ['empty', ''],
    ])('rejects %s', (_label, value) => {
      expect(() => assertSafePathSegment(value, 'id')).toThrow(UnsafeInputError);
    });
  });

  describe('assertSafeStorefront', () => {
    it('accepts two lowercase letters', () => {
      expect(assertSafeStorefront('br')).toBe('br');
    });
    it.each(['BR', 'bra', 'b', '1r', 'b/', ''])('rejects "%s"', (v) => {
      expect(() => assertSafeStorefront(v)).toThrow(UnsafeInputError);
    });
  });

  describe('assertSafeLimit', () => {
    it('accepts an in-range integer', () => {
      expect(assertSafeLimit('10')).toBe(10);
      expect(assertSafeLimit(50)).toBe(50);
    });
    it.each([0, 51, -1, 1.5, NaN, 'abc', '10; DROP'])('rejects %s', (v) => {
      expect(() => assertSafeLimit(v as unknown)).toThrow(UnsafeInputError);
    });
  });

  describe('assertSafeTypes', () => {
    const allowed = ['artists', 'albums', 'songs'];
    it('accepts allowlisted, comma-separated values', () => {
      expect(assertSafeTypes('artists,albums', allowed)).toBe('artists,albums');
    });
    it.each(['playlists', 'artists,evil', '', 'artists;drop'])('rejects "%s"', (v) => {
      expect(() => assertSafeTypes(v, allowed)).toThrow(UnsafeInputError);
    });
  });

  describe('assertSafeQueryValue', () => {
    it('accepts a normal term', () => {
      expect(assertSafeQueryValue('hello world', 'term')).toBe('hello world');
    });
    it('rejects control characters and over-long input', () => {
      expect(() => assertSafeQueryValue('a\nb', 'term')).toThrow(UnsafeInputError);
      expect(() => assertSafeQueryValue('x'.repeat(9999), 'term')).toThrow(UnsafeInputError);
      expect(() => assertSafeQueryValue('', 'term')).toThrow(UnsafeInputError);
    });
  });

  describe('assertAllowedHost', () => {
    const ALLOWED = ['api.deezer.com', 'api.spotify.com'];
    it('accepts an allowlisted HTTPS host', () => {
      expect(assertAllowedHost('https://api.deezer.com/artist/1', ALLOWED)).toBe('https://api.deezer.com/artist/1');
    });
    it('rejects a non-allowlisted host', () => {
      expect(() => assertAllowedHost('https://evil.example.com/x', ALLOWED)).toThrow(DisallowedHostError);
    });
    it('rejects non-HTTPS', () => {
      expect(() => assertAllowedHost('http://api.deezer.com/x', ALLOWED)).toThrow(DisallowedHostError);
    });
    it('blocks @ host-spoofing', () => {
      expect(() => assertAllowedHost('https://api.deezer.com@internal/x', ALLOWED)).toThrow(DisallowedHostError);
    });
  });

  describe('tenant-configured public https endpoints', () => {
    it.each(['10.0.0.1', '127.0.0.1', '169.254.169.254', '172.16.0.1', '172.31.255.255', '192.168.1.1', '100.64.0.1', '0.0.0.0', '224.0.0.1',
      '::1', '::', 'fe80::1', 'fd00::1', '::ffff:10.0.0.1', '::ffff:7f00:1', '[::1]', '::7f00:1', '64:ff9b::a00:1', '2002:7f00:1::', '2002:a9fe:a9fe::1', 'fec0::1', '64:ff9b:1::a00:1', '64:ff9b:1::808:808'])('%s is private', (ip) => {
      expect(isPrivateAddress(ip)).toBe(true);
    });
    it.each(['8.8.8.8', '93.184.216.34', '172.32.0.1', '172.15.0.1', '2606:4700::1111', '::ffff:8.8.8.8', '64:ff9b::808:808', '2002:808:808::1'])('%s is public', (ip) => {
      expect(isPrivateAddress(ip)).toBe(false);
    });
    it('normalizes a valid URL and drops the trailing slash', () => {
      expect(assertPublicHttpsUrl(' https://Api.Example.com/base/ ', 'baseUrl')).toBe('https://api.example.com/base');
      expect(assertPublicHttpsUrl('https://api.example.com:443', 'baseUrl')).toBe('https://api.example.com');
    });
    it.each([
      'http://api.example.com', 'ftp://api.example.com', 'https://user@api.example.com', 'https://api.example.com:8080',
      'https://localhost', 'https://a.localhost', 'https://printer.local', 'https://svc.internal', 'https://intranet',
      'https://127.0.0.1', 'https://[::1]', 'https://169.254.169.254', '', 'garbage',
    ])('rejects %s', (url) => {
      expect(() => assertPublicHttpsUrl(url, 'baseUrl')).toThrow(UnsafeInputError);
    });
    it('rejects a non-string and an oversized value', () => {
      expect(() => assertPublicHttpsUrl(undefined, 'baseUrl')).toThrow(UnsafeInputError);
      expect(() => assertPublicHttpsUrl(`https://a.com/${'x'.repeat(3000)}`, 'baseUrl')).toThrow(UnsafeInputError);
    });
    it('accepts a host resolving only to public addresses', async () => {
      await expect(assertResolvesToPublicAddresses('a.example.com', async () => ['8.8.8.8'])).resolves.toBeUndefined();
    });
    it('rejects a host with any private or no address', async () => {
      await expect(assertResolvesToPublicAddresses('a.example.com', async () => ['8.8.8.8', '10.0.0.1'])).rejects.toThrow(UnsafeInputError);
      await expect(assertResolvesToPublicAddresses('a.example.com', async () => [])).rejects.toThrow(UnsafeInputError);
    });
  });
});
