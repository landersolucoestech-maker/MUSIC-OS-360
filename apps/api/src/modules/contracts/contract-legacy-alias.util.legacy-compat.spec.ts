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
