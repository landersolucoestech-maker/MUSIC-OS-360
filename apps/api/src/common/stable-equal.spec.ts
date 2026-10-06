import { jsonDeepEqual, stableStringify } from './stable-equal';

describe('jsonDeepEqual', () => {
  it('ignores the order of object keys at every depth', () => {
    const posted = { name: 'Ana', email: 'a@x.co', role: 'artist', nested: { b: 1, a: [{ z: 1, y: 2 }] } };
    const stored = { nested: { a: [{ y: 2, z: 1 }], b: 1 }, name: 'Ana', role: 'artist', email: 'a@x.co' };
    expect(jsonDeepEqual(posted, stored)).toBe(true);
  });

  it('keeps the order of array items', () => {
    expect(jsonDeepEqual([1, 2], [2, 1])).toBe(false);
    expect(jsonDeepEqual([{ a: 1 }, { a: 2 }], [{ a: 2 }, { a: 1 }])).toBe(false);
  });

  it('detects a changed value, a missing key and an extra key', () => {
    expect(jsonDeepEqual({ a: 1 }, { a: 2 })).toBe(false);
    expect(jsonDeepEqual({ a: 1, b: 2 }, { a: 1 })).toBe(false);
    expect(jsonDeepEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
  });

  it('treats null, undefined and an undefined property as the same absence', () => {
    expect(jsonDeepEqual(null, undefined)).toBe(true);
    expect(jsonDeepEqual({ a: 1, b: undefined }, { a: 1 })).toBe(true);
  });

  it('distinguishes types that stringify alike', () => {
    expect(jsonDeepEqual('1', 1)).toBe(false);
    expect(jsonDeepEqual(['a'], 'a')).toBe(false);
    expect(jsonDeepEqual({}, [])).toBe(false);
  });

  it('is deterministic', () => {
    expect(stableStringify({ b: 1, a: 2 })).toBe(stableStringify({ a: 2, b: 1 }));
  });
});
