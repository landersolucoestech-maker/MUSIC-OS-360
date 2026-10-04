import { BadRequestException } from '@nestjs/common';
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

// ─── Every branch of the legacy names: accepted, reported, and named in the error body ───
type Body = { code: string; fields?: Array<{ canonical: string; legacy?: string }> };
/** The 400 body of a resolver call; a call that does NOT throw fails the assertion. */
const bodyOf = (fn: () => unknown): Body => {
  let outcome: unknown = null;
  try { fn(); } catch (e) { outcome = e; }
  expect(outcome).toBeInstanceOf(BadRequestException);
  return (outcome as BadRequestException).getResponse() as Body;
};

describe('legacy title alias "titulo": every branch of the resolver', () => {
  it('titulo alone resolves to title and is reported as used', () => {
    expect(() => resolvePhonogramAliases({ titulo: 'T' })).not.toThrow();
    const r = resolvePhonogramAliases({ titulo: 'T' });
    expect(r.normalized).toEqual({ title: 'T' });
    expect(r.legacyAliasesUsed).toEqual(['titulo']);
  });

  it('a blank / non-string / null titulo alone is rejected, naming titulo as the legacy field', () => {
    for (const bad of ['  ', 5, null]) {
      const body = bodyOf(() => resolvePhonogramAliases({ titulo: bad }));
      expect(body.code).toBe('PHONOGRAM_TITLE_INVALID');
      expect(body.fields).toEqual([{ canonical: 'title', legacy: 'titulo' }]);
    }
  });

  it('title and titulo equal (after trim): resolves with the title value and reports titulo as used', () => {
    expect(() => resolvePhonogramAliases({ title: 'A', titulo: ' A ' })).not.toThrow();
    const r = resolvePhonogramAliases({ title: 'A', titulo: ' A ' });
    expect(r.normalized).toEqual({ title: 'A' });
    expect(r.legacyAliasesUsed).toEqual(['titulo']);
  });

  it('title valid + invalid titulo names titulo; invalid title + valid titulo names only title', () => {
    const legacyBad = bodyOf(() => resolvePhonogramAliases({ title: 'A', titulo: '  ' }));
    expect(legacyBad.code).toBe('PHONOGRAM_TITLE_INVALID');
    expect(legacyBad.fields).toEqual([{ canonical: 'title', legacy: 'titulo' }]);
    const canonicalBad = bodyOf(() => resolvePhonogramAliases({ title: '  ', titulo: 'A' }));
    expect(canonicalBad.code).toBe('PHONOGRAM_TITLE_INVALID');
    expect(canonicalBad.fields).toEqual([{ canonical: 'title', legacy: undefined }]);
  });

  it('title and titulo that differ conflict, naming titulo', () => {
    const body = bodyOf(() => resolvePhonogramAliases({ title: 'A', titulo: 'B' }));
    expect(body.code).toBe('PHONOGRAM_ALIAS_CONFLICT');
    expect(body.fields).toEqual([{ canonical: 'title', legacy: 'titulo' }]);
  });
});

