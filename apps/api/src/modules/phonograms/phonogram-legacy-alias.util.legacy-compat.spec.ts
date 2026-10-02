import { resolvePhonogramAliases, resolvePhonogramQueryAliases } from './phonogram-legacy-alias.util';

describe('phonogram legacy input mapper (legacy in, canonical out)', () => {
  const W = '11111111-1111-4111-8111-111111111111';
  const A = '22222222-2222-4222-8222-222222222222';

  it.each([
    [{ titulo: 'T' }, { title: 'T' }, ['titulo']],
    [{ workId: W }, { work_id: W }, ['workId']],
    [{ artistId: A }, { artist_id: A }, ['artistId']],
    [{ titulo: 'T', workId: W, artistId: A }, { title: 'T', work_id: W, artist_id: A }, ['titulo', 'workId', 'artistId']],
  ])('write input %j becomes %j', (input, normalized, used) => {
    const r = resolvePhonogramAliases(input);
    expect(r.normalized).toEqual(normalized);
    expect(r.legacyAliasesUsed.sort()).toEqual([...used].sort());
  });

  it('a canonical input reports no legacy alias', () => {
    expect(resolvePhonogramAliases({ title: 'T', work_id: W }).legacyAliasesUsed).toEqual([]);
  });

  it('conflicting canonical and legacy values are rejected', () => {
    expect(() => resolvePhonogramAliases({ title: 'A', titulo: 'B' })).toThrow();
    expect(() => resolvePhonogramAliases({ work_id: W, workId: A })).toThrow();
  });

  it('an invalid legacy uuid is rejected', () => {
    expect(() => resolvePhonogramAliases({ workId: 'nope' })).toThrow();
  });

  it('query aliases map workId/artistId and never process titulo', () => {
    const r = resolvePhonogramQueryAliases({ workId: W, artistId: A, titulo: 'x' });
    expect(r.normalized).toEqual({ work_id: W, artist_id: A });
  });
});
