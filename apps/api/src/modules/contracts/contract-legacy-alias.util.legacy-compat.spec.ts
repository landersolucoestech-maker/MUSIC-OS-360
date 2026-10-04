import { BadRequestException } from '@nestjs/common';
import {
  canonicalContractVersions,
  LEGACY_CONTRACT_VERSION_KEYS,
  resolveContractAliases,
  resolveContractQueryAliases,
} from './contract-legacy-alias.util';

describe('contract legacy alias resolver (legacy in, canonical out)', () => {
  const UUID = '11111111-1111-4111-8111-111111111111';

  it.each([
    [{ titulo: 'T' }, { title: 'T' }, ['titulo']],
    [{ tipo: 'service' }, { type: 'service' }, ['tipo']],
    [{ artistId: UUID }, { artist_id: UUID }, ['artistId']],
    [{ data_inicio: '2026-01-01' }, { start_date: '2026-01-01' }, ['data_inicio']],
    [{ startsAt: '2026-01-01' }, { start_date: '2026-01-01' }, ['startsAt']],
    [{ data_fim: '2026-12-31' }, { end_date: '2026-12-31' }, ['data_fim']],
    [{ expiresAt: '2026-12-31' }, { end_date: '2026-12-31' }, ['expiresAt']],
    [{ arquivo_url: 'u' }, { file_url: 'u' }, ['arquivo_url']],
    [{ fileUrl: 'u' }, { file_url: 'u' }, ['fileUrl']],
    [{ valor: '10.50' }, { fixed_value: '10.5' }, ['valor']],
    [{ value: 7 }, { fixed_value: '7' }, ['value']],
  ])('write input %j becomes %j', (input, normalized, used) => {
    const r = resolveContractAliases(input);
    expect(r.normalized).toEqual(normalized);
    expect(r.legacyAliasesUsed).toEqual(used);
  });

  it('the canonical name reports no legacy alias', () => {
    expect(resolveContractAliases({ title: 'T', start_date: '2026-01-01' }).legacyAliasesUsed).toEqual([]);
  });

  it('a legacy alias that conflicts with the canonical field is rejected, never silently merged', () => {
    expect(() => resolveContractAliases({ title: 'A', titulo: 'B' })).toThrow();
    expect(() => resolveContractAliases({ fixed_value: 1, valor: 2 })).toThrow();
  });

  it('query aliases resolve only type and artist_id', () => {
    const r = resolveContractQueryAliases({ tipo: 'x', artistId: UUID, titulo: 'ignored' });
    expect(r.normalized).toEqual({ type: 'x', artist_id: UUID });
    expect(r.legacyAliasesUsed.sort()).toEqual(['artistId', 'tipo']);
  });

  it('legacy version-history keys are rewritten to canonical keys; a canonical key already present wins', () => {
    expect(LEGACY_CONTRACT_VERSION_KEYS).toEqual({ versao: 'version', criado_em: 'created_at', notas: 'notes', autor: 'author' });
    const [a, b] = canonicalContractVersions([
      { versao: 1, criado_em: 'c', notas: 'n', autor: 'a', url: 'u' },
      { versao: 1, version: 2 },
    ]) as Record<string, unknown>[];
    expect(a).toEqual({ version: 1, created_at: 'c', notes: 'n', author: 'a', url: 'u' });
    expect(b).toEqual({ version: 2 });
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
    expect(() => resolveContractAliases({ titulo: 'T' })).not.toThrow();
    const r = resolveContractAliases({ titulo: 'T' });
    expect(r.normalized).toEqual({ title: 'T' });
    expect(r.legacyAliasesUsed).toEqual(['titulo']);
  });

  it('a blank / non-string / null titulo alone is rejected, naming titulo as the legacy field', () => {
    for (const bad of ['  ', 5, null]) {
      const body = bodyOf(() => resolveContractAliases({ titulo: bad }));
      expect(body.code).toBe('CONTRACT_TITLE_INVALID');
      expect(body.fields).toEqual([{ canonical: 'title', legacy: 'titulo' }]);
    }
  });

  it('title and titulo equal (after trim): resolves with the title value and reports titulo as used', () => {
    expect(() => resolveContractAliases({ title: 'A', titulo: ' A ' })).not.toThrow();
    const r = resolveContractAliases({ title: 'A', titulo: ' A ' });
    expect(r.normalized).toEqual({ title: 'A' });
    expect(r.legacyAliasesUsed).toEqual(['titulo']);
  });

  it('title valid + invalid titulo names titulo; invalid title + valid titulo names only title', () => {
    const legacyBad = bodyOf(() => resolveContractAliases({ title: 'A', titulo: '  ' }));
    expect(legacyBad.code).toBe('CONTRACT_TITLE_INVALID');
    expect(legacyBad.fields).toEqual([{ canonical: 'title', legacy: 'titulo' }]);
    const canonicalBad = bodyOf(() => resolveContractAliases({ title: '  ', titulo: 'A' }));
    expect(canonicalBad.code).toBe('CONTRACT_TITLE_INVALID');
    expect(canonicalBad.fields).toEqual([{ canonical: 'title', legacy: undefined }]);
  });

  it('title and titulo that differ conflict, naming titulo', () => {
    const body = bodyOf(() => resolveContractAliases({ title: 'A', titulo: 'B' }));
    expect(body.code).toBe('CONTRACT_ALIAS_CONFLICT');
    expect(body.fields).toEqual([{ canonical: 'title', legacy: 'titulo' }]);
  });
});

describe('legacy pair aliases (tipo, data_inicio, data_fim, arquivo_url, valor): both-present, conflict and invalid-value branches name the legacy key', () => {
  it.each([
    ['type', 'tipo', 'service', 'other'],
    ['start_date', 'data_inicio', '2026-01-01', '2027-01-01'],
    ['end_date', 'data_fim', '2026-12-31', '2027-12-31'],
    ['file_url', 'arquivo_url', 'https://a/1.pdf', 'https://a/2.pdf'],
    ['fixed_value', 'valor', 10, 20],
  ])('%s / %s', (canonical, legacy, a, b) => {
    // legacy alone: accepted, reported, moved
    expect(() => resolveContractAliases({ [legacy]: a })).not.toThrow();
    const only = resolveContractAliases({ [legacy]: a });
    expect(only.legacyAliasesUsed).toEqual([legacy]);
    expect(Object.keys(only.normalized)).toEqual([canonical]);
    // both present and equivalent: resolves and still reports the legacy key
    expect(() => resolveContractAliases({ [canonical]: a, [legacy]: a })).not.toThrow();
    const same = resolveContractAliases({ [canonical]: a, [legacy]: a });
    expect(same.legacyAliasesUsed).toEqual([legacy]);
    // both present and different: a conflict naming the legacy key
    const conflict = bodyOf(() => resolveContractAliases({ [canonical]: a, [legacy]: b }));
    expect(conflict.code).toBe('CONTRACT_ALIAS_CONFLICT');
    expect(conflict.fields).toEqual([{ canonical, legacy }]);
    // legacy null + canonical value: conflict naming the legacy key; both null: resolves to null and reports the legacy key
    const nullConflict = bodyOf(() => resolveContractAliases({ [canonical]: a, [legacy]: null }));
    expect(nullConflict.fields).toEqual([{ canonical, legacy }]);
    expect(() => resolveContractAliases({ [canonical]: null, [legacy]: null })).not.toThrow();
    expect(resolveContractAliases({ [canonical]: null, [legacy]: null }).legacyAliasesUsed).toEqual([legacy]);
  });

  it.each([
    ['data_inicio', 'start_date', 'CONTRACT_DATE_INVALID', 'not-a-date'],
    ['data_fim', 'end_date', 'CONTRACT_DATE_INVALID', 'not-a-date'],
    ['valor', 'fixed_value', 'CONTRACT_VALUE_INVALID', 'abc'],
  ])('an invalid %s is rejected as %s naming the legacy key (alone, and next to a valid canonical)', (legacy, canonical, code, bad) => {
    const alone = bodyOf(() => resolveContractAliases({ [legacy]: bad }));
    expect(alone.code).toBe(code);
    expect(alone.fields).toEqual([{ canonical, legacy }]);
    const valid = canonical === 'fixed_value' ? 10 : '2026-01-01';
    const next = bodyOf(() => resolveContractAliases({ [canonical]: valid, [legacy]: bad }));
    expect(next.code).toBe(code);
    expect(next.fields).toEqual([{ canonical, legacy }]);
  });

  it('the query resolver names tipo as the legacy key of type', () => {
    expect(bodyOf(() => resolveContractQueryAliases({ type: 'a', tipo: 'b' })).fields).toEqual([{ canonical: 'type', legacy: 'tipo' }]);
    expect(resolveContractQueryAliases({ tipo: 'a' }).legacyAliasesUsed).toEqual(['tipo']);
  });
});


describe('contract legacy alias resolver: null clearing and strict date typing (guards of the pair resolver)', () => {
  it.each([
    [{ data_inicio: null }, { start_date: null }, ['data_inicio']],
    [{ data_fim: null }, { end_date: null }, ['data_fim']],
    [{ valor: null }, { fixed_value: null }, ['valor']],
  ])('a lone legacy alias sent as null clears the canonical field: %j', (input, normalized, used) => {
    const r = resolveContractAliases(input);
    expect(r.normalized).toEqual(normalized);
    expect(r.legacyAliasesUsed).toEqual(used);
  });

  it('the title has its own resolver: a null title is invalid, on both spellings', () => {
    expect(() => resolveContractAliases({ titulo: null })).toThrow(BadRequestException);
    expect(() => resolveContractAliases({ title: null })).toThrow(BadRequestException);
  });

  it.each([0, 1_000_000_000_000, true, {}, ['2026-01-01']])('a date that is not a string is invalid on every spelling (%j), never converted through Date()', (value) => {
    for (const key of ['start_date', 'data_inicio', 'startsAt', 'end_date', 'data_fim', 'expiresAt']) {
      expect(() => resolveContractAliases({ [key]: value })).toThrow(BadRequestException);
    }
  });

  it('a string date still passes and is normalized to ISO', () => {
    expect(resolveContractAliases({ data_inicio: '2026-01-01' }).normalized).toEqual({ start_date: '2026-01-01' });
  });
});
